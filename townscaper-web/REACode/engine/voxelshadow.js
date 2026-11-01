/**
 * voxelshadow.js — 逐顶点体素阴影（不是 shadow map）。
 *
 * 原文：x.com/OskSta/status/1190191289922465793
 *
 *   "Trying out some per vertex voxel based shadows. Not great not terrible.
 *    Looks better when not moving, and with less contrast, obviously."
 *
 * 画面（24 帧，512²，白色小城）：
 *   · 影子是**块状**的，边界落在三角形之间，能看出顶点密度分布（这就是
 *     "per vertex" 的代价：阴影分辨率 = 网格密度，不是屏幕分辨率）
 *   · 对比度很低：最深处也只比受光面暗 20~25%，整体仍然是一片白
 *   · 影子有方向（朝一个方向拖出去），并且**没有**软边 —— 软感来自顶点插值
 *   · 相机移动时边缘会"爬"，因为他说的 "looks better when not moving"
 *
 * 做法：沿用 lightvol.js 的占用栅格（同一张），只是这次不查 6 方向，
 * 而是沿**太阳方向**走一条短射线，命中就按"走了多远"给一个 0..1 的遮挡值。
 * 结果乘在顶点色上，交给正常的 Lambert 通道去插值 —— 块状感正是由此而来，
 * 所以这里**不做**任何按像素的平滑。
 *
 * 参数是从帧里量的：
 *   · 影子最远伸出去约 2.5 个格子 → 射线走 10 步（步长 ≈ 0.28 世界单位 ≈ 1/3 格）
 *   · 最深处压暗 ~0.22 → strength 0.24
 *   · 越远越淡：命中距离 d 归一化后 smoothstep(0.15, 1.0, d) 当作软度
 */

import * as THREE from 'three';

export function createVoxelSunShadow({
  town,
  grid,
  geometry,
  levelHeight = 0.42,
  sun = new THREE.Vector3(13, 12, 15),
  res = 64,
  ny = 24,
  steps = 10,
  strength = 0.24,
  normalBias = 0.05,
} = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let maxTop = 1;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
    maxTop = Math.max(maxTop, town.top(c));
  }
  const sizeX = Math.max(1e-3, maxX - minX);
  const sizeZ = Math.max(1e-3, maxZ - minZ);
  const sizeY = Math.max(1e-3, maxTop * levelHeight * 1.2);
  const cellY = sizeY / ny;

  // 占用栅格：一格一列（和 lightvol 踩过的同一个坑：按格心填，不要按包围盒刷）
  const solid = new Uint8Array(res * res * ny);
  const at = (x, y, z) => (z * ny + y) * res + x;
  for (const c of grid.cells) {
    const top = town.top(c);
    if (top <= 0) continue;
    const gx = Math.min(res - 1, Math.max(0, Math.floor(((c.cx - minX) / sizeX) * res)));
    const gz = Math.min(res - 1, Math.max(0, Math.floor(((c.cz - minZ) / sizeZ) * res)));
    // 只填到顶面之下，顶点不会站在实体里（同 lightvol 的教训）
    const yTop = Math.min(ny - 1, Math.max(0, Math.floor(((top * levelHeight) / sizeY) * ny) - 1));
    for (let y = 0; y <= yTop; y++) solid[at(gx, y, gz)] = 1;
  }

  // 太阳方向（归一化），射线步长按最小的那根轴走，保证不会跳过格子
  const dir = sun.clone().normalize();
  const stepW = Math.min(sizeX / res, sizeZ / res, cellY) * 0.85;

  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const col = geometry.getAttribute('color');
  const cnt = pos.count;
  const shade = new Float32Array(cnt);
  let sumShadow = 0, nShadowed = 0;

  const probe = (x, y, z) => {
    const gx = Math.floor(((x - minX) / sizeX) * res);
    const gy = Math.floor((y / sizeY) * ny);
    const gz = Math.floor(((z - minZ) / sizeZ) * res);
    if (gx < 0 || gx >= res || gy < 0 || gy >= ny || gz < 0 || gz >= res) return false;
    return solid[at(gx, gy, gz)] === 1;
  };

  for (let i = 0; i < cnt; i++) {
    const nx = nrm ? nrm.getX(i) : 0;
    const nyv = nrm ? nrm.getY(i) : 1;
    const nz = nrm ? nrm.getZ(i) : 0;
    const ox = pos.getX(i) + nx * normalBias;
    const oy = pos.getY(i) + nyv * normalBias;
    const oz = pos.getZ(i) + nz * normalBias;

    let s = 0;
    // 一共 steps 步，命中越早越黑；后面几步只留一点尾巴，形成"拖出去"的形状
    for (let k = 1; k <= steps; k++) {
      if (probe(ox + dir.x * stepW * k * 1.7, oy + dir.y * stepW * k * 1.7, oz + dir.z * stepW * k * 1.7)) {
        const d = k / steps;
        s = 1 - 0.55 * d * d;      // 远处命中 → 更淡
        break;
      }
    }
    shade[i] = s;
    sumShadow += s;
    if (s > 0.05) nShadowed++;
  }

  /** 把阴影乘进顶点色（在 lightvol 建之前调用，让它把这份当底色）。 */
  function apply(mult = 1) {
    if (!col) return null;
    for (let i = 0; i < cnt; i++) {
      const k = 1 - strength * shade[i] * mult;
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    col.needsUpdate = true;
    return { mean: sumShadow / Math.max(1, cnt), shadowed: nShadowed / Math.max(1, cnt) };
  }

  return {
    apply,
    shade,
    get stats() {
      return {
        grid: `${res}×${ny}×${res}`,
        steps,
        strength,
        mean: sumShadow / Math.max(1, cnt),
        shadowedFrac: nShadowed / Math.max(1, cnt),
      };
    },
    /** 调试：给世界坐标，返回最近顶点的阴影值。 */
    shadeNear(x, y, z) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < cnt; i++) {
        const d = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2 + (pos.getZ(i) - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return { shade: shade[best], dist: Math.sqrt(bestD) };
    },
  };
}
