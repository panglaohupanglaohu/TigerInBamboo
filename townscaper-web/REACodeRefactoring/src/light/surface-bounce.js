/**
 * surface-bounce.js — 1580835075629133825 "my first decent attempt to actually have the light *bounce*".
 *
 * 迁自 REACode src/bouncegi.js：2.5D 表面形因子 gather（不是色渗），以及蒙特卡洛暴力参考与 audit。
 * 不再用独立的 makeCanyon 实验岛，而是从共享 World 采一张高度场（顶面高度 = top·L，水面 0），
 * 反照率由调用方按格给（与 lightvolume 的 albedoOf 同签名）。
 *
 *   E0[i] = albedo_i · (sun·ndl·可见 + sky·天空可见 + ambient)
 *   E_{k+1}[i] = E0[i] + albedo_i · (cal/π) Σ_j E_k[j] · cosI·cosJ·A_j / (r² + pitch²/4) · 可见(i,j)
 * A_j 是真实表面积 pitch²·√(1+|∇h|²)（崖面不被低估），采样圈按弧长均分（落点能落到崖面上）。
 * 仍是 2.5D：洞/拱/悬挑在高度场里不存在 —— 3D 情况由 lightvolume.js 的体素多跳负责。
 * 原文没说形因子/逆平方是原作做法；这里是可检验的物理近似，calibration 由 audit 与暴力参考对照给出。
 *
 * 第 55 批校准（model:'split'，默认）：旧版（'legacy'）把崖肩格当成一片放在崖顶沿口、法线取中心差分，
 * 谷底看崖壁几乎掠射、沿口同高邻格又把射线挡死；采样圈每点只按 1 格面积计、半径按格数（细 pitch 时只看 2 单位）。
 * 结果是总量只有参考的 1/12，只好乘 calibration=4 硬拉，相关 0.53。现在每格拆成顶面片 + 崖面片（崖面中点、朝低邻居、
 * 面积 pitch×落差），采样点按 2πr/n 面积加权，半径按世界单位 maxDist，端点邻域只拿端点格顶高判挡。
 * calibration 回到物理值 1。tests/surface-bounce.mjs 实测：峡谷 r 0.53→0.91、总量比 ≈1；凹凸柱场 r 0.88；
 * 共享 World「地形」岛 r 0.54→0.82、「融合」岛 0.65→0.84（对照 256 射线暴力参考）。
 */
export function rng(seed = 11) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** 共享 World → 2.5D 表面场。pitch 为采样间距（世界单位）。 */
export function surfaceFieldFromWorld(world, index, { L = 0.5, pitch = 0.25, pad = 1, albedoOf = () => [0.6, 0.6, 0.6], water = [0.3, 0.55, 0.6], maxCells = 40000 } = {}) {
  if (!(pitch > 0) || !(L > 0)) throw new RangeError('surface field options');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of world.cells) if (world.top(c)) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
  if (!Number.isFinite(minX)) return null;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const nx = Math.ceil((maxX - minX) / pitch), nz = Math.ceil((maxZ - minZ) / pitch);
  if (nx * nz > maxCells) throw new RangeError('surface field budget');
  const h = new Float32Array(nx * nz), albedo = new Float32Array(nx * nz * 3), cellOf = new Int32Array(nx * nz).fill(-1);
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const i = z * nx + x, c = index.cellAt(minX + (x + 0.5) * pitch, minZ + (z + 0.5) * pitch);
    const t = c ? world.top(c) : 0;
    h[i] = t * L;
    const a = t ? albedoOf(c, t) : water;
    if (!Array.isArray(a) || a.length !== 3 || a.some((v) => !(v >= 0 && v <= 1))) throw new RangeError('albedo');
    albedo.set(a, i * 3);
    if (c) cellOf[i] = c.id;
  }
  return { nx, nz, pitch, minX, minZ, h, albedo, cellOf, version: world.version, L };
}

export function normalAt(f, x, y) {
  const { nx, nz, h, pitch } = f;
  const xm = Math.max(0, x - 1), xp = Math.min(nx - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(nz - 1, y + 1);
  const dx = (h[y * nx + xp] - h[y * nx + xm]) / ((xp - xm) * pitch), dz = (h[yp * nx + x] - h[ym * nx + x]) / ((yp - ym) * pitch);
  const len = Math.hypot(dx, 1, dz);
  return { x: -dx / len, y: 1 / len, z: -dz / len };
}
export function cellAreaAt(f, x, y) {
  const { nx, nz, h, pitch } = f;
  const xm = Math.max(0, x - 1), xp = Math.min(nx - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(nz - 1, y + 1);
  const gx = (h[y * nx + xp] - h[y * nx + xm]) / ((xp - xm) * pitch), gz = (h[yp * nx + x] - h[ym * nx + x]) / ((yp - ym) * pitch);
  const slope = Math.min(9, Math.hypot(gx, gz));
  return pitch * pitch * Math.sqrt(1 + slope * slope);
}
export function worldAt(f, x, y) { return { x: f.minX + (x + 0.5) * f.pitch, y: f.h[y * f.nx + x], z: f.minZ + (y + 0.5) * f.pitch }; }
/**
 * 第 55 批校准：崖肩格（比最低的边邻居高出一格以上）在 2.5D 场里代表的是整面崖壁，
 * 但 worldAt 把它放在崖顶沿口 —— 谷底看过去几乎掠射、而且沿口两侧同高的邻格会把射线挡死，
 * 这是旧版 gather 只有暴力参考 1/12 的主因（tests/surface-bounce.mjs 分类对照：谷底 0.08×、崖面 0.09×）。
 * 这里把崖肩格的代表点放到崖面中点（高度取上下平均，水平往低邻居方向挪半格）。
 */
export function surfacePoint(f, x, y) {
  const { nx, nz, h, pitch } = f, hi = h[y * nx + x], p = worldAt(f, x, y);
  let lo = hi, ox = 0, oz = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= nx || yy >= nz) continue; const hn = h[yy * nx + xx]; if (hn < lo) { lo = hn; ox = dx; oz = dy; } }
  if (hi - lo > pitch) { p.y = (hi + lo) * 0.5; p.x += ox * pitch * 0.5; p.z += oz * pitch * 0.5; p.wall = hi - lo; p.face = [ox, 0, oz]; }
  return p;
}
const toGrid = (f, wx, wz) => [Math.round((wx - f.minX) / f.pitch - 0.5), Math.round((wz - f.minZ) / f.pitch - 0.5)];

/** a→b 中间段是否被高度场挡住（端点格跳过，否则起点格会挡住自己）。 */
export function visible(f, ax, ay, bx, by, { margin = 0, a = worldAt(f, ax, ay), b = worldAt(f, bx, by) } = {}) {
  const { nx, nz, h } = f, dx = bx - ax, dy = by - ay, steps = Math.ceil(Math.hypot(dx, dy) * 2);
  if (steps <= 1) return true;
  for (let s = 1; s < steps; s++) {
    const t = s / steps, cx = Math.min(nx - 1, Math.max(0, Math.round(ax + dx * t))), cy = Math.min(nz - 1, Math.max(0, Math.round(ay + dy * t)));
    if ((cx === ax && cy === ay) || (cx === bx && cy === by)) continue;
    // margin：端点 1 格邻域不判（崖肩格代表点在崖面中点，同排沿口邻格比它高，不能算遮挡）
    let lineY = a.y + (b.y - a.y) * t;
    if (margin) {
      if (Math.abs(cx - ax) <= margin && Math.abs(cy - ay) <= margin) lineY = Math.max(lineY, h[ay * nx + ax]);
      if (Math.abs(cx - bx) <= margin && Math.abs(cy - by) <= margin) lineY = Math.max(lineY, h[by * nx + bx]);
    }
    if (h[cy * nx + cx] > lineY + 1e-4) return false;
  }
  return true;
}
function sunVisible(f, x, y, s) {
  const p = worldAt(f, x, y), len = Math.hypot(s.x, s.z);
  if (len < 1e-9) return 1;
  const sx = s.x / len, sz = s.z / len, slope = s.y / len, maxT = Math.max(f.nx, f.nz) * f.pitch;
  for (let t = f.pitch * 0.75; t < maxT; t += f.pitch * 0.75) {
    const [gx, gy] = toGrid(f, p.x + sx * t, p.z + sz * t);
    if (gx < 0 || gy < 0 || gx >= f.nx || gy >= f.nz) break;
    if (f.h[gy * f.nx + gx] > p.y + slope * t + 1e-4) return 0;
  }
  return 1;
}
function skyVisible(f, x, y) {
  const p = worldAt(f, x, y), D = 8, maxT = Math.max(f.nx, f.nz) * f.pitch * 0.6;
  let acc = 0;
  for (let d = 0; d < D; d++) {
    const a = (d / D) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    let maxSlope = 0;
    for (let t = f.pitch; t < maxT; t += f.pitch) {
      const [gx, gy] = toGrid(f, p.x + cx * t, p.z + cz * t);
      if (gx < 0 || gy < 0 || gx >= f.nx || gy >= f.nz) break;
      maxSlope = Math.max(maxSlope, (f.h[gy * f.nx + gx] - p.y) / t);
    }
    acc += Math.sin(Math.atan(maxSlope));
  }
  return Math.max(0, 1 - acc / D);
}

export function directLight(f, { sun = [-0.55, 0.62, 0.56], sunColor = [1.0, 0.82, 0.55], skyColor = [0.3, 0.4, 0.5], ambient = 0.1 } = {}) {
  const n = f.nx * f.nz, out = new Float32Array(n * 3), sunTerm = new Float32Array(n), skyTerm = new Float32Array(n);
  const l = Math.hypot(...sun); if (!(l > 0)) throw new RangeError('sun');
  const s = { x: sun[0] / l, y: sun[1] / l, z: sun[2] / l };
  for (let y = 0; y < f.nz; y++) for (let x = 0; x < f.nx; x++) {
    const i = y * f.nx + x, nn = normalAt(f, x, y), ndl = Math.max(0, nn.x * s.x + nn.y * s.y + nn.z * s.z);
    const vis = ndl > 0 ? sunVisible(f, x, y, s) : 0, sky = skyVisible(f, x, y);
    sunTerm[i] = ndl * vis; skyTerm[i] = sky;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = f.albedo[i * 3 + k] * (sunColor[k] * ndl * vis + skyColor[k] * sky + ambient * skyColor[k] * 0.5);
  }
  out.sunTerm = sunTerm; out.skyTerm = skyTerm;
  return out;
}

/** 按弧长均分的同心圈采样（远圈点多 ≈ 立体角均匀）。 */
export function samplePattern({ maxRad = 10, spacing = 1.2 } = {}) {
  const out = [];
  for (let rad = 1; rad <= maxRad; rad++) {
    const n = Math.max(8, Math.round((2 * Math.PI * rad) / spacing)), phase = rad * 0.6180339887;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + phase, dx = Math.round(Math.cos(a) * rad), dy = Math.round(Math.sin(a) * rad);
      if (dx || dy) out.push({ dx, dy, rad: Math.hypot(dx, dy), w: (2 * Math.PI * rad) / n });
    }
  }
  return out;
}

export function bounce(f, E0, { maxDist = 4, maxRad = Math.max(4, Math.round(maxDist / f.pitch)), spacing = 1.2, bounces = 1, gain = 1, model = 'split', calibration = model === 'split' ? 1 : 4, wallMin = null } = {}) {
  if (!Number.isInteger(bounces) || bounces < 0 || bounces > 6) throw new RangeError('bounces');
  if (!['legacy', 'split'].includes(model)) throw new RangeError('bounce model');
  const t0 = performance.now(), { nx, nz, pitch, h } = f, n = nx * nz, split = model === 'split';
  // 接收端几何与暴力参考一致：格顶点 + 中心差分法线
  const N = new Float32Array(n * 3), P = new Float32Array(n * 3), A = new Float32Array(n);
  // split（第 55 批校准）：每格拆成「顶面片」（格顶、朝上、pitch²）与「崖面片」（崖面中点、朝低邻居、pitch×落差）两个发光片。
  // legacy：每格一片（格顶 + 中心差分法线 + 斜面积），即第 53 批版本，与暴力参考 r≈0.53。
  const SN = new Float32Array(n * 3), SP = new Float32Array(n * 3), SA = new Float32Array(n), WN = new Float32Array(n * 3), WP = new Float32Array(n * 3), WA = new Float32Array(n);
  const wMin = wallMin ?? pitch * 0.5;
  for (let y = 0; y < nz; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x, nn = normalAt(f, x, y), p = worldAt(f, x, y);
    N[i * 3] = nn.x; N[i * 3 + 1] = nn.y; N[i * 3 + 2] = nn.z; P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; A[i] = cellAreaAt(f, x, y);
    if (!split) { SN.set(N.subarray(i * 3, i * 3 + 3), i * 3); SP.set(P.subarray(i * 3, i * 3 + 3), i * 3); SA[i] = A[i]; continue; }
    const hi = h[i]; let lo = hi, ox = 0, oz = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= nx || yy >= nz) continue; const hn = h[yy * nx + xx]; if (hn < lo) { lo = hn; ox = dx; oz = dy; } }
    const wall = hi - lo > wMin;
    SN[i * 3 + 1] = 1; SP[i * 3] = p.x; SP[i * 3 + 1] = hi; SP[i * 3 + 2] = p.z; SA[i] = wall ? pitch * pitch : A[i];
    if (!wall) { SN.set(N.subarray(i * 3, i * 3 + 3), i * 3); continue; }
    WN[i * 3] = ox; WN[i * 3 + 2] = oz; WP[i * 3] = p.x + ox * pitch * 0.5; WP[i * 3 + 1] = (hi + lo) * 0.5; WP[i * 3 + 2] = p.z + oz * pitch * 0.5; WA[i] = pitch * (hi - lo);
  }
  const pat = samplePattern({ maxRad, spacing }), k = gain * calibration / Math.PI, history = [];
  const patch = (i, j, PP, NN, AA, w) => {
    if (!AA[j]) return 0;
    const vx = PP[j * 3] - P[i * 3], vy = PP[j * 3 + 1] - P[i * 3 + 1], vz = PP[j * 3 + 2] - P[i * 3 + 2], d2 = vx * vx + vy * vy + vz * vz;
    if (d2 < 1e-8) return 0;
    const d = Math.sqrt(d2), ix = vx / d, iy = vy / d, iz = vz / d;
    const cosI = N[i * 3] * ix + N[i * 3 + 1] * iy + N[i * 3 + 2] * iz;
    if (cosI <= 0) return 0;
    const cosJ = -(NN[j * 3] * ix + NN[j * 3 + 1] * iy + NN[j * 3 + 2] * iz);
    if (cosJ <= 0.02) return 0;
    return cosI * cosJ * AA[j] * w / (d2 + 0.25 * pitch * pitch);
  };
  let src = Float32Array.from(E0), E = Float32Array.from(E0);
  for (let b = 0; b < bounces; b++) {
    const next = new Float32Array(n * 3);
    for (let y = 0; y < nz; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      let ar = 0, ag = 0, ab = 0;
      for (const s of pat) {
        const jx = x + s.dx, jy = y + s.dy;
        if (jx < 0 || jy < 0 || jx >= nx || jy >= nz) continue;
        const j = jy * nx + jx;
        if (src[j * 3] + src[j * 3 + 1] + src[j * 3 + 2] <= 1e-5) continue;
        let F;
        if (!split) { F = patch(i, j, SP, SN, SA, 1); if (F > 0 && !visible(f, x, y, jx, jy)) F = 0; }
        else {
          // 采样圈每个点代表 2πr/n 格的面积（旧版按 1 格算，系统性偏低）
          const Ft = patch(i, j, SP, SN, SA, s.w), Fw = patch(i, j, WP, WN, WA, s.w);
          F = 0;
          if (Ft > 0 && visible(f, x, y, jx, jy, { margin: 1, a: { y: P[i * 3 + 1] }, b: { y: SP[j * 3 + 1] } })) F += Ft;
          if (Fw > 0 && visible(f, x, y, jx, jy, { margin: 1, a: { y: P[i * 3 + 1] }, b: { y: WP[j * 3 + 1] } })) F += Fw;
        }
        if (!F) continue;
        ar += src[j * 3] * F; ag += src[j * 3 + 1] * F; ab += src[j * 3 + 2] * F;
      }
      next[i * 3] = E0[i * 3] + ar * k * f.albedo[i * 3];
      next[i * 3 + 1] = E0[i * 3 + 1] + ag * k * f.albedo[i * 3 + 1];
      next[i * 3 + 2] = E0[i * 3 + 2] + ab * k * f.albedo[i * 3 + 2];
    }
    let change = 0; for (let q = 0; q < n * 3; q++) change += Math.abs(next[q] - E[q]);
    history.push(change / (n * 3));
    E = next; src = next;
  }
  const added = new Float32Array(n * 3); for (let q = 0; q < n * 3; q++) added[q] = E[q] - E0[q];
  return { E, added, history, timeMs: performance.now() - t0, model };
}

/** 蒙特卡洛暴力参考：余弦重要性采样，命中格 E0 的平均即为估计量。 */
export function bruteForce(f, E0, { samples = 96, maxDist = null, seed = 5, wallPoints = false } = {}) {
  const { nx, nz, pitch } = f, rnd = rng(seed), maxT = maxDist ?? Math.max(nx, nz) * pitch * 0.6;
  const out = new Float32Array(nx * nz * 3), hitRate = new Float32Array(nx * nz);
  for (let y = 0; y < nz; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x, nn = normalAt(f, x, y), p = wallPoints ? surfacePoint(f, x, y) : worldAt(f, x, y);
    const up = Math.abs(nn.y) > 0.99 ? [1, 0, 0] : [0, 1, 0];
    let tx = up[1] * nn.z - up[2] * nn.y, ty = up[2] * nn.x - up[0] * nn.z, tz = up[0] * nn.y - up[1] * nn.x; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = nn.y * tz - nn.z * ty, by = nn.z * tx - nn.x * tz, bz = nn.x * ty - nn.y * tx;
    let ar = 0, ag = 0, ab = 0, hits = 0;
    for (let s = 0; s < samples; s++) {
      const r = Math.sqrt(rnd()), phi = 2 * Math.PI * rnd(), dx = r * Math.cos(phi), dz = r * Math.sin(phi), dy = Math.sqrt(Math.max(0, 1 - r * r));
      const wx = tx * dx + nn.x * dy + bx * dz, wy = ty * dx + nn.y * dy + by * dz, wz = tz * dx + nn.z * dy + bz * dz;
      for (let t = pitch * 0.75; t < maxT; t += pitch * 0.75) {
        const [gx, gy] = toGrid(f, p.x + wx * t, p.z + wz * t);
        if (gx < 0 || gy < 0 || gx >= nx || gy >= nz) break;
        if (f.h[gy * nx + gx] >= p.y + wy * t) {
          const j = gy * nx + gx, jn = normalAt(f, gx, gy);
          hits++;
          if (-(jn.x * wx + jn.y * wy + jn.z * wz) > 0.02) { ar += E0[j * 3]; ag += E0[j * 3 + 1]; ab += E0[j * 3 + 2]; }
          break;
        }
      }
    }
    out[i * 3] = ar / samples * f.albedo[i * 3]; out[i * 3 + 1] = ag / samples * f.albedo[i * 3 + 1]; out[i * 3 + 2] = ab / samples * f.albedo[i * 3 + 2];
    hitRate[i] = hits / samples;
  }
  out.hitRate = hitRate;
  return out;
}

/** 对照表：无/一跳/两跳的暗部亮度与暖度，以及与暴力参考的绝对误差、去掉全局系数后的形状误差。 */
export function audit(f, { samples = 64, sun, maxDist = 4, maxRad = Math.max(4, Math.round(maxDist / f.pitch)), spacing = 1.2, model = 'split', calibration = model === 'split' ? 1 : 4 } = {}) {
  const E0 = directLight(f, sun ? { sun } : {});
  const b1 = bounce(f, E0, { maxRad, spacing, bounces: 1, calibration, model }), b2 = bounce(f, E0, { maxRad, spacing, bounces: 2, calibration, model });
  const shadow = []; for (let i = 0; i < f.nx * f.nz; i++) if (E0.sunTerm[i] === 0 && E0.skyTerm[i] > 0.25) shadow.push(i);
  const lum = (a) => shadow.length ? shadow.reduce((s, i) => s + luma(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]), 0) / shadow.length : 0;
  const warm = (a) => shadow.length ? shadow.reduce((s, i) => s + a[i * 3] - a[i * 3 + 2], 0) / shadow.length : 0;
  const bf = bruteForce(f, E0, { samples });
  let errAbs = 0, ref = 0, dot = 0, nrm = 0;
  for (let q = 0; q < bf.length; q++) { errAbs += Math.abs(b1.added[q] - bf[q]); ref += bf[q]; dot += b1.added[q] * bf[q]; nrm += bf[q] * bf[q]; }
  const scale = nrm > 0 ? dot / nrm : 1;
  let errShape = 0; for (let q = 0; q < bf.length; q++) errShape += Math.abs(b1.added[q] / (scale || 1) - bf[q]);
  let ca = 0, cb = 0, cab = 0, caa = 0, cbb = 0; const m = bf.length;
  for (let q = 0; q < m; q++) { ca += b1.added[q]; cb += bf[q]; }
  ca /= m; cb /= m; for (let q = 0; q < m; q++) { const a = b1.added[q] - ca, b = bf[q] - cb; cab += a * b; caa += a * a; cbb += b * b; }
  const L0 = lum(E0) || 1e-6, L1 = lum(b1.E), L2 = lum(b2.E);
  const shadowRatio = (lum(b1.added) || 0) / (lum(bf) || 1e-9);
  return { cells: f.nx * f.nz, shadowCells: shadow.length, shadowLumaNoBounce: L0, shadowLumaOneBounce: L1, shadowLumaTwoBounce: L2, shadowGain1: L1 / L0, shadowGain2: L2 / L0,
    warmthNoBounce: warm(E0), warmthOneBounce: warm(b1.E), secondBounceDeltaPct: ((L2 - L1) / (L1 || 1)) * 100,
    vsBruteForceRelErrPct: (errAbs / (ref || 1)) * 100, vsBruteForceShapeErrPct: (errShape / (ref || 1)) * 100, bestFitScale: scale,
    correlation: cab / Math.sqrt(caa * cbb || 1), shadowRatioVsBruteForce: shadowRatio, model, calibration, maxRad, gatherMs: b1.timeMs, twoBounceMs: b2.timeMs, samples, E0, b1, b2, bf };
}

/** 双线性取样一张逐格 RGB（例如 bounce().added），给顶点着色用。 */
export function sampleSurface(f, rgb, wx, wz) {
  const fx = (wx - f.minX) / f.pitch - 0.5, fz = (wz - f.minZ) / f.pitch - 0.5;
  const x0 = Math.max(0, Math.min(f.nx - 2, Math.floor(fx))), z0 = Math.max(0, Math.min(f.nz - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - x0)), tz = Math.max(0, Math.min(1, fz - z0)), out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = rgb[(z0 * f.nx + x0) * 3 + c], b = rgb[(z0 * f.nx + x0 + 1) * 3 + c], d = rgb[((z0 + 1) * f.nx + x0) * 3 + c], e = rgb[((z0 + 1) * f.nx + x0 + 1) * 3 + c];
    out[c] = (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e * tx) * tz;
  }
  return out;
}
/** 把反弹加进 MeshWriter 顶点色（col += col·added·gain），只碰朝上/侧向的顶点。 */
export function applySurfaceBounce(w, f, added, { gain = 1, offset = 0.1 } = {}) {
  const pos = w.pos, col = w.col; let touched = 0;
  for (let t = 0; t < pos.length; t += 9) {
    const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2], vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (ny < -0.2) continue;
    for (let v = 0; v < 3; v++) { const o = t + v * 3, s = sampleSurface(f, added, pos[o] + nx * offset, pos[o + 2] + nz * offset); for (let c = 0; c < 3; c++) col[o + c] += col[o + c] * s[c] * gain; touched++; }
  }
  return touched;
}
