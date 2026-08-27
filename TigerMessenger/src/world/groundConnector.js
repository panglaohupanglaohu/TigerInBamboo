// =====================================================================
// S14 relax pass 连接带（Oskar 2024-03）：瓦片星球上高山会「蘑菇化」
// （越高越宽）；relax pass 让所有含模块的格子迭代尝试达到自己的期望
// 形状与尺寸。本模块把该思想落实为「地面连接带」烘焙器：
//
//   bakeGroundConnector(from, to, {fromHeight, toHeight, ...})
//     → 基础剖面（两端 lerp + 确定性起伏）→ relax 迭代（每点高度向
//       邻居均值收敛，同时向期望剖面回归；偏离期望超限即钳制 = 防
//       蘑菇化膨胀）→ 输出地形带（positions / indices / heights）。
//
// 纯数据、headless 可测，不依赖 Three.js。
// =====================================================================

export const GROUND_CONNECTOR_SCHEMA_VERSION = 1;

function hashString(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/**
 * 沿路径（从→到，平面 XZ）生成地形带。
 * @param {object} options
 * @param {[number,number]} options.from 起点平面坐标
 * @param {[number,number]} options.to 终点平面坐标
 * @param {number} [options.fromHeight] 起点地面高度
 * @param {number} [options.toHeight] 终点地面高度
 * @param {number} [options.width] 连接带宽度
 * @param {number} [options.segments] 沿路径段数
 * @param {number} [options.crossSegments] 横截面段数
 * @param {number} [options.relaxPasses] relax 迭代次数
 * @param {number} [options.maxDeviation] 相对期望剖面的最大偏离（防蘑菇化）
 * @param {number} [options.terrainScale] 确定性起伏幅度
 * @param {number} [options.seed] 确定性种子
 */
export function bakeGroundConnector({
  from = [0, 0],
  to = [46, 22],
  fromDir = null,
  toDir = null,
  radius = 160,
  fromHeight = 5.0,
  toHeight = 3.2,
  width = 10,
  segments = 12,
  crossSegments = 5,
  relaxPasses = 24,
  maxDeviation = 0.55,
  terrainScale = 0.5,
  seed = 20260826,
} = {}) {
  // S15 球面版：fromDir/toDir 单位方向向量 → 沿大圆弧采样；
  // 高度向球面（localSphericalSurfaceOffset 曲率）收敛。
  const spherical = !!(fromDir && toDir);
  const sx = from[0], sz = from[1];
  const ex = to[0], ez = to[1];
  const dx = ex - sx, dz = ez - sz;
  const length = Math.hypot(dx, dz) || 1;
  const dirX = dx / length, dirZ = dz / length;
  let perpX = -dirZ, perpZ = dirX;
  // 球面大圆弧：slerp 插值方向 + 切向
  const arc = spherical ? (() => {
    const a = [fromDir[0], fromDir[1], fromDir[2]];
    const b = [toDir[0], toDir[1], toDir[2]];
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    dot = Math.max(-1, Math.min(1, dot));
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega) || 1e-9;
    const at = (t) => {
      const s0 = Math.sin((1 - t) * omega) / sinOmega;
      const s1 = Math.sin(t * omega) / sinOmega;
      return [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
    };
    return { at, omega };
  })() : null;
  const sphericalOffset = (x, z) => {
    const rhoSq = x * x + z * z;
    return -(radius - Math.sqrt(Math.max(0, radius * radius - rhoSq)));
  };

  let rngState = seed >>> 0;
  const rand = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  // 确定性起伏（hash 噪声，避免直线剖面）
  const noise = (u, v) => {
    const h = Math.sin(u * 12.9898 + v * 78.233 + seed * 0.01) * 43758.5453;
    return (h - Math.floor(h)) - 0.5;
  };

  const rows = segments + 1;
  const cols = crossSegments + 1;
  // 初始剖面：沿路径 lerp(fromHeight, toHeight, t) + 起伏；两侧边缘略低（自然坡脚）
  const heights = new Float32Array(rows * cols);
  const desired = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const t = r / Math.max(1, segments);
    const px = sx + dirX * t * length;
    const pz = sz + dirZ * t * length;
    for (let c = 0; c < cols; c++) {
      const u = c / Math.max(1, crossSegments) - 0.5;
      const edgeFalloff = 1 - Math.abs(u) * 0.35;
      const h = (fromHeight + (toHeight - fromHeight) * t) * edgeFalloff
        + noise(t * 7.3, u * 3.1 + r) * terrainScale * (1 - Math.abs(u) * 0.5);
      const idx = r * cols + c;
      heights[idx] = h;
      desired[idx] = h; // 期望剖面 = 基础剖面（不含 relax 膨胀）
    }
  }

  // ---- relax pass（Oskar 方法）----
  // 每点高度向邻居均值收敛，同时向期望剖面回归；偏离期望超过
  // maxDeviation 即钳制 —— 防蘑菇化（山体/连接带异常膨胀）。
  const next = new Float32Array(rows * cols);
  let maxChange = Infinity;
  for (let pass = 0; pass < relaxPasses && maxChange > 1e-4; pass++) {
    maxChange = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        let sum = 0;
        let count = 0;
        if (r > 0) { sum += heights[(r - 1) * cols + c]; count++; }
        if (r < rows - 1) { sum += heights[(r + 1) * cols + c]; count++; }
        if (c > 0) { sum += heights[r * cols + c - 1]; count++; }
        if (c < cols - 1) { sum += heights[r * cols + c + 1]; count++; }
        const neighborAvg = sum / Math.max(1, count);
        // 混合：一半邻居均值（平滑），一半期望剖面（回归）
        const blend = pass < relaxPasses * 0.6 ? 0.5 : 0.7;
        let h = neighborAvg * (1 - blend) + desired[idx] * blend;
        // 防蘑菇化钳制：相对期望的偏离有上限
        const lo = desired[idx] - maxDeviation;
        const hi = desired[idx] + maxDeviation;
        h = Math.max(lo, Math.min(hi, h));
        next[idx] = h;
        maxChange = Math.max(maxChange, Math.abs(h - heights[idx]));
      }
    }
    heights.set(next);
  }

  // 三角带索引
  const indices = [];
  for (let r = 0; r < segments; r++) {
    for (let c = 0; c < crossSegments; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      if ((r + c) % 2 === 0) indices.push(a, b, d, b, e, d);
      else indices.push(a, b, e, a, e, d);
    }
  }

  // 输出 positions（平面 XZ + 高度 Y）
  const positions = new Float32Array(rows * cols * 3);
  for (let r = 0; r < rows; r++) {
    const t = r / Math.max(1, segments);
    let px, pz, tx, tz;
    if (arc) {
      const d = arc.at(t);
      const d2 = arc.at(Math.min(1, t + 0.01));
      const tan = [d2[0] - d[0], d2[1] - d[1], d2[2] - d[2]];
      tx = tan[0]; tz = tan[2];
      // 横向 = normalize(cross(tangent, dir))：在球切平面内垂直于弧
      const cross = [
        tan[1] * d[2] - tan[2] * d[1],
        tan[2] * d[0] - tan[0] * d[2],
        tan[0] * d[1] - tan[1] * d[0],
      ];
      const cl = Math.hypot(cross[0], cross[1], cross[2]) || 1;
      for (let c = 0; c < cols; c++) {
        const u = c / Math.max(1, crossSegments) - 0.5;
        const idx = r * cols + c;
        // 球面：方向 = normalize(dir + 横向偏移)，半径 = radius + 相对抬升
        const off = [
          d[0] + (cross[0] / cl) * u * (width / radius),
          d[1] + (cross[1] / cl) * u * (width / radius),
          d[2] + (cross[2] / cl) * u * (width / radius),
        ];
        const ol = Math.hypot(off[0], off[1], off[2]) || 1;
        const rr = radius + heights[idx];
        positions[idx * 3] = (off[0] / ol) * rr;
        positions[idx * 3 + 1] = (off[1] / ol) * rr;
        positions[idx * 3 + 2] = (off[2] / ol) * rr;
      }
      void tx; void tz;
    } else {
      px = sx + dirX * t * length;
      pz = sz + dirZ * t * length;
      for (let c = 0; c < cols; c++) {
        const u = c / Math.max(1, crossSegments) - 0.5;
        const idx = r * cols + c;
        positions[idx * 3] = px + perpX * u * width;
        positions[idx * 3 + 1] = heights[idx];
        positions[idx * 3 + 2] = pz + perpZ * u * width;
      }
    }
  }

  const hashInput = `${spherical ? "sph" : "flat"}:${from[0]},${from[1]}:${to[0]},${to[1]}:${fromDir ? fromDir.join(",") : ""}:${toDir ? toDir.join(",") : ""}:${radius}:${fromHeight}:${toHeight}:${width}:${segments}:${crossSegments}:${relaxPasses}:${maxDeviation}:${seed}`;
  return Object.freeze({
    version: GROUND_CONNECTOR_SCHEMA_VERSION,
    from: Object.freeze([...from]),
    to: Object.freeze([...to]),
    fromHeight,
    toHeight,
    width,
    segments,
    crossSegments,
    relaxPasses,
    maxDeviation,
    positions: Array.from(positions),
    heights: Array.from(heights),
    desired: Array.from(desired),
    indices: Array.from(indices),
    spherical,
    vertexCount: rows * cols,
    triangleCount: indices.length / 3,
    relaxFinalMaxChange: maxChange,
    hash: `ground-connector:${hashString(hashInput)}`,
    algorithm: "oskar-relax-pass-ground-connector-v1",
  });
}
