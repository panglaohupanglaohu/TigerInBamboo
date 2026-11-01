/**
 * lightvolume.js — 光体积 + 多次反弹（第三个项目的 GI）。
 *
 * 依据：
 *   1580835075629133825 "I always write my own lighting solutions … this is my first decent attempt to actually have the
 *     light *bounce*"   画面：橙色台地，打开反弹后阴影里泛出地面的暖色、草地的绿色。
 *   1580845127207387137 "1st texture here is an sdf volume … 2nd is a baked 6 directional light volume, raycast against the
 *     sdf, sampling the mega texture using the UVs where it hits the sdf"
 *   1580846877855338497 "the slowed down bounce sequence … After about the 3rd bounce, further bounces are not noticeable"
 *   1582757294672314368 "if my light volume approach can work with point lights too … keep em big and soft"
 *   1481661852887265288 "Yet another light baker … 3D Signed Distance Field, 3D Ambient Occlusion in positive and negative X,Y and Z"
 *
 * 做法（CPU，按需烘一次）：
 *   1. 体素化：岛的包围盒切成 nx × ny × nz 的格子（水平 0.25、竖直半层），每格记 实心 / 反照率（地面草色 / 岩石 / 墙色）。
 *   2. 直射：每个空格子朝太阳走，没被挡住 = 1（+ 可选点光源：距离衰减、也要不被挡）。
 *   3. 反弹：每个空格子朝 6 个方向走，碰到实心格就取"那块表面的反照率 × 它旁边空格子的光"，6 向平均 = 间接光；
 *      迭代 bounces 次（第 3 次之后基本不变）。
 *   4. 6 向 AO：同样 6 个方向，走多远才碰到东西。
 *   网格顶点按位置 + 法线偏移在体积里三线性取样，得到间接光（RGB），着色器里加到 indirectDiffuse 上。
 */

export function bakeLightVolume(world, index, { L = 0.5, sun = [0.4, 0.8, 0.45], res = 0.25, bounces = 3, point = null, albedoOf } = {}) {
  const t0 = performance.now();
  // 包围盒
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 1;
  for (const c of world.cells) { const t = world.top(c); if (!t) continue; minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); maxH = Math.max(maxH, t); }
  if (!Number.isFinite(minX)) return null;
  minX -= 1; minZ -= 1; maxX += 1; maxZ += 1;
  const nx = Math.ceil((maxX - minX) / res), nz = Math.ceil((maxZ - minZ) / res), ny = (maxH + 2) * 2;
  const dy = L / 2;
  const N = nx * ny * nz, id = (x, y, z) => (z * ny + y) * nx + x;
  const solid = new Uint8Array(N), alb = new Float32Array(N * 3);
  // 1. 体素化（每个 xz 柱只查一次格子）
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const wx = minX + (x + 0.5) * res, wz = minZ + (z + 0.5) * res;
    const c = index.cellAt(wx, wz);
    for (let y = 0; y < ny; y++) {
      const wy = (y + 0.5) * dy;
      const k = id(x, y, z);
      if (y === 0 && (!c || world.top(c) === 0)) { solid[k] = 2; alb.set([0.30, 0.55, 0.60], k * 3); continue; }   // 海面：也反光（偏青）
      if (!c) continue;
      const lv = Math.floor(wy / L) + 1;
      if (world.isSolid(c, lv)) { solid[k] = 1; alb.set(albedoOf(c, lv, wy), k * 3); }
    }
  }
  const S = sun.slice(); { const l = Math.hypot(...S); S[0] /= l; S[1] /= l; S[2] /= l; }
  const march = (x, y, z, dx, dy2, dz, maxSteps) => {
    // 返回第一个碰到的实心格序号，没碰到返回 -1（单位：格）
    let fx = x + 0.5, fy = y + 0.5, fz = z + 0.5;
    for (let s = 0; s < maxSteps; s++) {
      fx += dx; fy += dy2; fz += dz;
      const ix = fx | 0, iy = fy | 0, iz = fz | 0;
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return -1;
      const k = id(ix, iy, iz);
      if (solid[k]) return k;
    }
    return -1;
  };
  // 2. 直射（每个空格子）
  const direct = new Float32Array(N * 3);
  const sdx = S[0] / res * 0.5, sdy = S[1] / dy * 0.5, sdz = S[2] / res * 0.5;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const k = id(x, y, z);
    if (solid[k]) continue;
    let r = 0, g = 0, b = 0;
    if (march(x, y, z, sdx, sdy, sdz, 120) < 0) { r = 1.0; g = 0.95; b = 0.85; }
    if (point) {
      const wx = minX + (x + 0.5) * res, wy = (y + 0.5) * dy, wz = minZ + (z + 0.5) * res;
      const ex = point.pos[0] - wx, ey = point.pos[1] - wy, ez = point.pos[2] - wz, d = Math.hypot(ex, ey, ez);
      if (d < point.radius) {
        const steps = Math.ceil(d / res * 2);
        if (march(x, y, z, ex / d / res * 0.5, ey / d / dy * 0.5, ez / d / res * 0.5, steps - 1) < 0) {
          const f = (1 - d / point.radius) ** 2 * point.intensity;
          r += point.color[0] * f; g += point.color[1] * f; b += point.color[2] * f;
        }
      }
    }
    direct[k * 3] = r; direct[k * 3 + 1] = g; direct[k * 3 + 2] = b;
  }
  // 3. 反弹：6 方向收集
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const total = direct.slice();
  const indirect = new Float32Array(N * 3);
  const ao = new Float32Array(N);
  const hist = [];
  for (let b = 0; b < bounces; b++) {
    const next = new Float32Array(N * 3);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const k = id(x, y, z);
      if (solid[k]) continue;
      let r = 0, g = 0, bl = 0, open = 0;
      for (const [ax, ay, az] of DIRS) {
        const hit = march(x, y, z, ax, ay, az, 10);
        if (hit < 0) { if (ay > 0) { r += 0.55; g += 0.62; bl += 0.75; } open++; continue; }   // 朝上看到天
        // 命中面的光 = 命中格子"前一格"（朝回走一步）的总光 × 反照率
        const hx = hit % nx, hy = ((hit / nx) | 0) % ny, hz = (hit / (nx * ny)) | 0;
        const bx = hx - ax, by = hy - ay, bz = hz - az;
        if (bx < 0 || by < 0 || bz < 0 || bx >= nx || by >= ny || bz >= nz) continue;
        const kb = id(bx, by, bz);
        r += total[kb * 3] * alb[hit * 3]; g += total[kb * 3 + 1] * alb[hit * 3 + 1]; bl += total[kb * 3 + 2] * alb[hit * 3 + 2];
      }
      next[k * 3] = r / 6; next[k * 3 + 1] = g / 6; next[k * 3 + 2] = bl / 6;
      if (b === 0) ao[k] = open / 6;
    }
    let change = 0;
    for (let i = 0; i < N * 3; i++) { change += Math.abs(next[i] - indirect[i]); indirect[i] = next[i]; total[i] = direct[i] + indirect[i]; }
    hist.push(+(change / N).toFixed(4));
  }
  const vol = { nx, ny, nz, minX, minZ, res, dy, indirect, direct, ao, solid, ms: Math.round(performance.now() - t0), bounceChange: hist };
  /** 世界坐标 → 三线性插值的间接光 [r,g,b] */
  vol.sample = (px, py, pz) => {
    const fx = (px - minX) / res - 0.5, fy = py / dy - 0.5, fz = (pz - minZ) / res - 0.5;
    const x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy))), z0 = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)), tz = Math.min(1, Math.max(0, fz - z0));
    const out = [0, 0, 0];
    let wsum = 0;
    for (let c = 0; c < 8; c++) {
      const x = x0 + (c & 1), y = y0 + ((c >> 1) & 1), z = z0 + ((c >> 2) & 1);
      const k = id(x, y, z);
      if (solid[k]) continue;   // 只从空格子取（实心格子里没有光）
      const w = (c & 1 ? tx : 1 - tx) * ((c >> 1) & 1 ? ty : 1 - ty) * ((c >> 2) & 1 ? tz : 1 - tz);
      out[0] += indirect[k * 3] * w; out[1] += indirect[k * 3 + 1] * w; out[2] += indirect[k * 3 + 2] * w; wsum += w;
    }
    if (wsum > 1e-4) { out[0] /= wsum; out[1] /= wsum; out[2] /= wsum; }
    return out;
  };
  return vol;
}
