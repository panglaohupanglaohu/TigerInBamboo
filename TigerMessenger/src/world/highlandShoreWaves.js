// =====================================================================
// S13 岸浪（台地-海衔接，Oskar 2026-03 推文）：*It's based on a looping
// vertex shader. The data is baked at generation-time. Each vert has an
// in-direction, an out-direction and a time offset.*
//
// 湖岸（waterfront cutout）内侧烘焙一圈浪带：每个顶点带 in-direction
// （来浪方向，指向岸）、out-direction（退浪方向，指向湖）、time offset
// （沿岸错相 → 推进波）与振幅（近岸大、远岸衰减）。运行期一个 looping
// vertex shader 沿 in→out 循环位移，形成涌岸/退岸的循环浪。
// =====================================================================

export const SHORE_WAVES_SCHEMA_VERSION = 1;

function hashString(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/**
 * 烘焙岸浪带（纯数据，headless 可测，不依赖 Three.js）。
 * 湖面开口在 z ∈ [zStart, zStart+depth]，半宽 shoreHalfWidth → basinHalfWidth。
 * 每排 z 取左右两岸，每岸沿 x 从岸线向湖内 crossStep×crossCount 生成顶点；
 * 相邻排两两连接成三角带（indices）。
 */
export function bakeHighlandShoreWaves({
  zStart = 24,
  zEnd = 58,
  rowStep = 1.2,
  crossStep = 0.95,
  crossCount = 4,
  shoreGap = 0.7,
  seed = 20260826,
  lakeCenterX = null,
  lakeHalfWidth = null,
} = {}) {
  // 湖岸线函数来自 highlandCitadelDesign；测试可注入常数实现。
  const centerX = lakeCenterX ?? ((z) => Math.sin((z - 24) * 0.16) * 1.35);
  const halfWidth = lakeHalfWidth ?? ((z) => {
    const u = Math.max(0, Math.min(1, (z - 24) / 34));
    const cap = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.72);
    return 10.0 + cap * 22.0;
  });

  const positions = [];
  const inDirs = [];
  const outDirs = [];
  const timeOffsets = [];
  const amplitudes = [];
  const dists = [];
  const rows = [];
  const seedState = { value: seed };
  const jitter = () => {
    // 确定性伪随机（±0.2u 沿岸抖动，避免直线条带）
    seedState.value = (Math.imul(seedState.value, 1664525) + 1013904223) >>> 0;
    return (seedState.value / 4294967296) * 0.4 - 0.2;
  };

  for (let z = zStart; z <= zEnd + 1e-6; z += rowStep) {
    const c = centerX(z);
    const half = halfWidth(z);
    const row = [];
    for (const side of [-1, 1]) {
      for (let cross = 0; cross < crossCount; cross++) {
        const x = c + side * (half + shoreGap + cross * crossStep + jitter());
        // 湖面高度（与 buildCurvedLakeSurface 同公式的 4.8 基准 + 球面偏移）
        const y = lakeHeightAt(x, z);
        positions.push(x, y, z);
        // in = 指向岸（陆地），out = 指向湖（远离岸）
        const toShore = [-side, 0, 0];
        const toLake = [side, 0, 0];
        inDirs.push(...toShore);
        outDirs.push(...toLake);
        // 沿岸推进错相：z 每 rowStep 错开固定相位；近岸排比远岸排略滞后
        const t = (z - zStart) / Math.max(1, zEnd - zStart);
        const timeOffset = (z * 0.11 + cross * 0.055) % 1;
        timeOffsets.push(timeOffset);
        const dist = cross / Math.max(1, crossCount - 1);
        const amp = 0.34 * (1 - dist * 0.72);
        amplitudes.push(amp);
        dists.push(dist);
        row.push(positions.length / 3 - 1);
        void t;
      }
    }
    rows.push(row);
  }

  // 三角带：相邻排同侧连接（近岸排对近岸排，远岸对远岸）
  const indices = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let side = 0; side < 2; side++) {
      for (let cross = 0; cross < crossCount - 1; cross++) {
        const a = rows[r][side * crossCount + cross];
        const b = rows[r][side * crossCount + cross + 1];
        const c = rows[r + 1][side * crossCount + cross + 1];
        const d = rows[r + 1][side * crossCount + cross];
        if ((r + cross) % 2 === 0) indices.push(a, b, d, b, c, d);
        else indices.push(a, b, c, a, c, d);
      }
    }
  }

  const hash = hashString(`${zStart}:${zEnd}:${rowStep}:${crossStep}:${crossCount}:${seed}:${positions.join(",")}`);
  return Object.freeze({
    version: SHORE_WAVES_SCHEMA_VERSION,
    positions: Object.freeze(positions),
    inDirs: Object.freeze(inDirs),
    outDirs: Object.freeze(outDirs),
    timeOffsets: Object.freeze(timeOffsets),
    amplitudes: Object.freeze(amplitudes),
    dists: Object.freeze(dists),
    indices: Object.freeze(indices),
    vertexCount: positions.length / 3,
    rowCount: rows.length,
    triangleCount: indices.length / 3,
    hash: `shore-waves:${hash}`,
    algorithm: "oskar-looping-vertex-shore-wave-v1",
  });
}

/** 湖面高度基准（与 buildCurvedLakeSurface 的 4.8 一致）。 */
export function lakeHeightAt(x, z, radius = 160) {
  const rhoSq = x * x + z * z;
  const offset = -(radius - Math.sqrt(Math.max(0, radius * radius - rhoSq)));
  const ripple = Math.sin(x * 0.38 + z * 0.17) * 0.009 + Math.cos(z * 0.26 - x * 0.21) * 0.006;
  return offset + 4.8 + ripple;
}

/**
 * 渲染岸浪带：一条 BufferGeometry + looping vertex shader。
 * 顶点沿 in→out 循环位移（涌岸/退岸），time offset 形成沿岸推进波；
 * 近岸振幅大、远岸衰减，fragment 按离岸距离淡出。
 */
export function createHighlandShoreWaveSystem(THREE, scene, data, { speed = 0.55 } = {}) {
  if (!THREE?.BufferGeometry || !scene) throw new Error("shore wave system requires THREE and scene");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("aInDir", new THREE.Float32BufferAttribute(data.inDirs, 3));
  geometry.setAttribute("aOutDir", new THREE.Float32BufferAttribute(data.outDirs, 3));
  geometry.setAttribute("aTimeOffset", new THREE.Float32BufferAttribute(data.timeOffsets, 1));
  geometry.setAttribute("aAmplitude", new THREE.Float32BufferAttribute(data.amplitudes, 1));
  geometry.setAttribute("aDist", new THREE.Float32BufferAttribute(data.dists, 1));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uWaveSpeed: { value: speed },
      uDay: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aInDir;
      attribute vec3 aOutDir;
      attribute float aTimeOffset;
      attribute float aAmplitude;
      attribute float aDist;
      uniform float uTime;
      uniform float uWaveSpeed;
      varying float vDist;
      varying float vPhase;
      void main() {
        // Oskar 岸浪：looping vertex shader。phase 在 0→1 循环，
        // swell = sin 包络让顶点先涌向岸（沿 aInDir）再退回湖（沿 aOutDir）。
        float phase = fract(uTime * uWaveSpeed + aTimeOffset);
        float swell = sin(phase * 6.2831853) * 0.5 + 0.5;
        vec3 dir = normalize(mix(aOutDir, aInDir, swell));
        vec3 displaced = position + dir * aAmplitude * (0.45 + 0.55 * swell);
        // 浪高起伏：近岸更高，远岸趋平
        displaced.y += sin(phase * 6.2831853 * 1.0 + aTimeOffset * 3.0) * 0.11 * (1.0 - aDist * 0.65);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        vDist = aDist;
        vPhase = phase;
      }
    `,
    fragmentShader: `
      uniform float uDay;
      varying float vDist;
      varying float vPhase;
      void main() {
        // 备用岸浪保持蓝青色；正式场景不挂载这层动态带，避免读成白条。
        float alpha = (1.0 - vDist) * 0.24 * (0.72 + 0.28 * sin(vPhase * 6.2831853));
        if (alpha < 0.015) discard;
        vec3 foam = mix(vec3(0.18, 0.52, 0.68), vec3(0.34, 0.70, 0.80), 1.0 - vDist);
        gl_FragColor = vec4(foam * mix(0.75, 1.0, uDay), alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "highland-shore-waves";
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  mesh.userData.shoreWaves = true;
  mesh.userData.waveAlgorithm = data.algorithm;
  mesh.userData.vertexCount = data.vertexCount;
  mesh.userData.triangleCount = data.triangleCount;
  mesh.userData.schemaHash = data.hash;
  scene.add(mesh);
  return {
    mesh,
    data,
    update(time, weather = 0, day = 1) {
      material.uniforms.uTime.value = time;
      material.uniforms.uDay.value = day;
      void weather;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}

// =====================================================================
//  C13-5 · 城堡轮廓泡沫带（PLAN §10.5）—— Claude 2026-09-04
//
//  S23 sheetA 2s / sheet_0：岸线一圈**浅色泡沫带**。PLAN 要求「复用 S13 的烘焙器，
//  沿城堡轮廓环再生成一条窄带」。S13 的 bakeHighlandShoreWaves 假设的是
//  「左右两岸 + 沿 z 排开」的湖口，城堡轮廓是**闭合环**，所以这里是同一套
//  顶点属性 schema（positions / inDirs / outDirs / timeOffsets / amplitudes /
//  dists / indices）的第二个烘焙器——createHighlandShoreWaveSystem 可以原样渲染。
//
//  ⚠️ 默认不挂进正式场景。odysseyCitadel.js 里 S13 岸浪带早已因为
//  「近白色 foam shader 在当前海面构图里读成悬浮白条」被关掉；轮廓带用的是
//  同一个 shader，同一个毛病会原样复现。所以本函数只提供**可烘焙、可测的数据**，
//  开关留给 `P.foamBand`（默认 false），等着色单独做过一轮再打开。
// =====================================================================

/**
 * 把占据格集合的外边界描成闭合环（局部 XZ）。
 * 纯数据、确定性：边按 (格,方向) 生成，再首尾相接串成环；有洞就返回多个环。
 *
 * @param {Iterable<[number, number]>} cells 占据格 [ix, iz]
 * @param {{cellSize?:number, originX?:number, originZ?:number}} [opts]
 * @returns {number[][][]} 环数组，每环是 [x, z] 顶点列（闭合，首点不重复）
 */
export function traceGridOutlineRings(cells, { cellSize = 1, originX = 0, originZ = 0 } = {}) {
  const set = new Set();
  for (const [ix, iz] of cells) set.add(`${ix},${iz}`);
  const px = (ix) => originX + ix * cellSize;
  const pz = (iz) => originZ + iz * cellSize;
  // 每个外露格边贡献一条有向边（让内部始终在左手侧，环因此方向一致）
  const edges = new Map(); // "x,z" -> "x,z"（起点 → 终点）
  const key = (x, z) => `${x.toFixed(4)},${z.toFixed(4)}`;
  const addEdge = (x0, z0, x1, z1) => { edges.set(key(x0, z0), [x1, z1]); };
  for (const k of set) {
    const [ix, iz] = k.split(",").map(Number);
    const x0 = px(ix), x1 = px(ix + 1);
    const z0 = pz(iz), z1 = pz(iz + 1);
    if (!set.has(`${ix},${iz - 1}`)) addEdge(x0, z0, x1, z0); // 北
    if (!set.has(`${ix + 1},${iz}`)) addEdge(x1, z0, x1, z1); // 东
    if (!set.has(`${ix},${iz + 1}`)) addEdge(x1, z1, x0, z1); // 南
    if (!set.has(`${ix - 1},${iz}`)) addEdge(x0, z1, x0, z0); // 西
  }
  const rings = [];
  const startKeys = [...edges.keys()].sort();
  const used = new Set();
  for (const start of startKeys) {
    if (used.has(start)) continue;
    const ring = [];
    let cur = start;
    while (edges.has(cur) && !used.has(cur)) {
      used.add(cur);
      const [x, z] = cur.split(",").map(Number);
      ring.push([x, z]);
      const next = edges.get(cur);
      cur = key(next[0], next[1]);
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/**
 * 沿闭合轮廓环烘焙泡沫窄带，输出与 bakeHighlandShoreWaves 完全同构的属性表。
 *
 * @param {{ring:number[][], bandWidth?:number, crossCount?:number,
 *          heightAt?:(x:number,z:number)=>number, seed?:number,
 *          amplitude?:number, resample?:number}} opts
 *   ring        闭合轮廓 [x, z][]（首点不重复）
 *   bandWidth   带宽（沿外法线向外）
 *   crossCount  横向排数（≥2）
 *   heightAt    水面高度函数，缺省用 lakeHeightAt
 *   resample    沿环重采样步长（0 = 不重采样，直接用原顶点）
 */
export function bakeContourFoamBand({
  ring,
  bandWidth = 1.6,
  crossCount = 3,
  heightAt = null,
  seed = 20260904,
  amplitude = 0.22,
  resample = 0,
} = {}) {
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error("bakeContourFoamBand: ring 至少要 4 个点");
  }
  const yAt = heightAt ?? ((x, z) => lakeHeightAt(x, z));
  const cross = Math.max(2, crossCount | 0);

  // 可选重采样：轮廓是格边折线，直接用会让每格只有 1 个顶点、浪相位太粗
  let path = ring;
  if (resample > 0) {
    path = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const n = Math.max(1, Math.round(len / resample));
      for (let k = 0; k < n; k++) path.push([a[0] + (dx * k) / n, a[1] + (dz * k) / n]);
    }
  }

  const positions = [];
  const inDirs = [];
  const outDirs = [];
  const timeOffsets = [];
  const amplitudes = [];
  const dists = [];
  const seedState = { value: seed >>> 0 };
  const jitter = () => {
    seedState.value = (Math.imul(seedState.value, 1664525) + 1013904223) >>> 0;
    return (seedState.value / 4294967296) * 0.24 - 0.12;
  };

  const N = path.length;
  // 沿环累计弧长 → 推进波的相位；闭合，所以最后一段接回起点
  let perimeter = 0;
  const arc = new Array(N);
  for (let i = 0; i < N; i++) {
    arc[i] = perimeter;
    const a = path[i];
    const b = path[(i + 1) % N];
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  for (let i = 0; i < N; i++) {
    const prev = path[(i - 1 + N) % N];
    const next = path[(i + 1) % N];
    // 切线取前后邻居的差（角点自动取平分方向），外法线 = 切线右转 90°
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = tz;   // 右转 90°：(tx,tz) → (tz,−tx)
    const nz = -tx;
    const phase = perimeter > 0 ? (arc[i] / perimeter) % 1 : 0;
    for (let c = 0; c < cross; c++) {
      const dist = c / (cross - 1);             // 0 = 贴岸，1 = 带外缘
      const off = dist * bandWidth + jitter() * (c > 0 ? 1 : 0.3);
      const x = path[i][0] + nx * off;
      const z = path[i][1] + nz * off;
      positions.push(x, yAt(x, z), z);
      // in = 指向岸（−法线），out = 指向水（+法线）——与 S13 同约定
      inDirs.push(-nx, 0, -nz);
      outDirs.push(nx, 0, nz);
      timeOffsets.push((phase * 3 + c * 0.055) % 1);
      amplitudes.push(amplitude * (1 - dist * 0.72));
      dists.push(dist);
    }
  }

  // 三角带：相邻环点同排连接，最后一点接回第 0 点（闭合）
  const indices = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let c = 0; c < cross - 1; c++) {
      const a = i * cross + c;
      const b = i * cross + c + 1;
      const d = j * cross + c + 1;
      const e = j * cross + c;
      if ((i + c) % 2 === 0) indices.push(a, b, e, b, d, e);
      else indices.push(a, b, d, a, d, e);
    }
  }

  const hash = hashString(`contour:${bandWidth}:${cross}:${seed}:${resample}:${positions.join(",")}`);
  return Object.freeze({
    version: SHORE_WAVES_SCHEMA_VERSION,
    positions: Object.freeze(positions),
    inDirs: Object.freeze(inDirs),
    outDirs: Object.freeze(outDirs),
    timeOffsets: Object.freeze(timeOffsets),
    amplitudes: Object.freeze(amplitudes),
    dists: Object.freeze(dists),
    indices: Object.freeze(indices),
    vertexCount: positions.length / 3,
    rowCount: N,
    triangleCount: indices.length / 3,
    perimeter,
    hash: `contour-foam:${hash}`,
    algorithm: "oskar-looping-vertex-contour-foam-v1",
  });
}
