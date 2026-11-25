/**
 * world-sphere.js — 平面 World / 模块 → 球面的接线层。
 *
 *   1768627849529893109 "I've gone and put this on a sphere"  队列残差：
 *   「补后续世界到球面的 World/模块接线和平滑岸线；不要用已有柱群球面代替」。
 *
 * 与 planet.js / planet-town.js 的分工：那两个文件把对偶柱群球面本身当 World（球面原生的
 * 五/六边形格）；本文件相反——把已经按平面管线建好的 World（grid.js 的不规则/方/六边形格、
 * multicell、module-patch-commit 等都以 (x,z) 平面坐标工作）整块贴到球面一片区域上。
 * 这正是游戏实景的做法：TigerMessenger src/world/apostlesReacode.js 每块门徒岩体在锚点
 * seaAnchor（|water|=Rw，方向 worldUp=Y）处立切平面 frame(X,Y,Z)，柱格 y −= (x²+z²)/(2Rw)
 * 下弯上球（bendU/uBend = S/(2Rw)，S=米/格）。本文件 'bend' 模式与那套数学逐式同口径，
 * 'sphere' 模式是严格落在球面上的方位等距映射（锚点出发沿测地线 σ=√(x²+z²)/R），
 * 两者在一阶内一致、可互换验收。
 *
 * 岸线：复用 core/shore-loops.js traceShoreLoops + core/shore-profile.js sampleShoreline
 * 的平面岸线（陆在左、法线朝海），再逐点贴球——法线沿测地线平行搬运、按角距折算在平面细分、
 * 球面 Taubin 平滑、沿搬运后法线测地外推（对应原机制的「黄线 → 蓝线」外推浪带起点；
 * 球面上没有栅格距离场，外推取测地距离，近锚点与原 march 同阶近似，如实不声称一致）。
 *
 * 纯函数、确定性；不含 THREE，不含渲染。
 */

import { traceShoreLoops } from '../core/shore-loops.js';
import { sampleShoreline } from '../core/shore-profile.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x) => Math.max(-1, Math.min(1, x));

/** 最小旋转：把向量 v 随「a → b」的旋转一起转（a、b、v 不要求单位长）。 */
function rotMin(a, b, v) {
  const k = cross(a, b), sn = len(k), cs = dot(a, b);
  if (sn < 1e-12) return v.slice();
  const u = [k[0] / sn, k[1] / sn, k[2] / sn], kv = cross(u, v), d = dot(u, v);
  return [0, 1, 2].map((i) => v[i] * cs + kv[i] * sn + u[i] * d * (1 - cs));
}

/** 确定性切平面基：(e1, up, e2) 右手系，e1×e2 = −up（与平面 (x,z)·y 向上的手性一致，
 *  也与实景 frame.makeBasis(X=e1, Y=up, Z=e2) 的右手系一致）。up 可指任意方向（含两极）。 */
export function tangentBasis(up, ref = null) {
  if (!Array.isArray(up) || up.length !== 3 || !up.every(Number.isFinite) || len(up) < 1e-9) throw new RangeError('tangentBasis needs a nonzero direction');
  const u = norm(up), r = ref || (Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const e1 = norm(cross(r, u)), e2 = cross(e1, u);
  return { e1, e2 };
}

/**
 * 球面贴片描述子。锚点 = center + up·R（海面上 patch 原点）；
 * e1/e2 缺省由 tangentBasis 派生，也可显式给（实景直接传 (X, Z) 即复刻 apostles frame）。
 */
export function makeSpherePatch({ R, center = [0, 0, 0], up = [0, 1, 0], e1 = null, e2 = null } = {}) {
  if (!Number.isFinite(R) || R <= 0) throw new RangeError('Invalid sphere radius');
  if (!Array.isArray(center) || center.length !== 3 || !center.every(Number.isFinite)) throw new RangeError('Invalid sphere center');
  if (!Array.isArray(up) || up.length !== 3 || !up.every(Number.isFinite) || len(up) < 1e-9) throw new RangeError('Invalid patch up');
  const u = norm(up);
  let E1 = e1, E2 = e2;
  if (E1 === null && E2 === null) ({ e1: E1, e2: E2 } = tangentBasis(u));
  else if (!E1 || !E2 || !E1.every(Number.isFinite) || !E2.every(Number.isFinite) ||
    Math.abs(len(E1) - 1) > 1e-6 || Math.abs(len(E2) - 1) > 1e-6 ||
    Math.abs(dot(E1, u)) > 1e-6 || Math.abs(dot(E2, u)) > 1e-6 || Math.abs(dot(E1, E2)) > 1e-6) {
    throw new RangeError('Invalid patch basis');
  }
  const patch = { R, center: center.slice(), up: u, e1: E1.slice(), e2: E2.slice() };
  patch.anchor = add(center, mul(u, R));       // = 实景 seaAnchor / water
  return Object.freeze(patch);
}

/* ---- 实景 bend 同口径（TigerMessenger apostlesReacode.js / twelveApostlesTarget.js） ------- */
/** 抛物面下沉（世界单位）：apostles toWorld 的 y −= (x²+z²)/(2·Rw)。 */
export function bendDrop(x, z, Rw) {
  if (![x, z, Rw].every(Number.isFinite) || Rw <= 0) throw new RangeError('Invalid bend arguments');
  return (x * x + z * z) / (2 * Rw);
}
/** 格单位下沉系数：apostles uBend = S/(2·Rw)（x,z 以格计时下沉格数 = k·(x²+z²)）。 */
export function bendCoefficient({ S = 1, Rw } = {}) {
  if (![S, Rw].every(Number.isFinite) || S <= 0 || Rw <= 0) throw new RangeError('Invalid bend coefficient args');
  return S / (2 * Rw);
}
/** 帽面倾斜法线（局部 frame 坐标）：apostles 顶面 N = normalize([x/Rw, 1, z/Rw])。 */
export function bendNormalLocal(x, z, Rw) {
  if (![x, z, Rw].every(Number.isFinite) || Rw <= 0) throw new RangeError('Invalid bend normal args');
  return norm([x / Rw, 1, z / Rw]);
}

/**
 * 平面 (x,z) → 球面位置。y = 沿局部「上」方向的高（世界单位，可为负）。
 *   mode 'sphere'：方位等距——d=√(x²+z²)，σ=d/R，dir = up·cosσ + t̂·sinσ（t̂ = x·e1+z·e2 方向），
 *     pos = center + dir·(R+y)。径向距离严格保持，y=0 的点严格在球面上。
 *   mode 'bend'：抛物面——pos = anchor + x·e1 + (y − d²/(2R))·up + z·e2，
 *     与 apostlesReacode.js toWorld(x,y,z) 逐式相同（frame 原点 = water = anchor）。
 * σ 超过 π（绕到对蹠点另一侧）数学上仍可算但已折叠，inRange 标记如实报。
 */
export function mapPoint(patch, x, z, { mode = 'sphere', y = 0 } = {}) {
  if (![x, z, y].every(Number.isFinite)) throw new RangeError('Invalid map point');
  if (mode !== 'sphere' && mode !== 'bend') throw new RangeError('Invalid map mode');
  const { R, center, up, e1, e2 } = patch;
  if (mode === 'bend') return add(add(patch.anchor, add(mul(e1, x), mul(e2, z))), mul(up, y - (x * x + z * z) / (2 * R)));
  const d = Math.hypot(x, z), s = d / R, dir = d < 1e-12 ? up : add(mul(up, Math.cos(s)), mul(norm(add(mul(e1, x), mul(e2, z))), Math.sin(s)));
  return add(center, mul(dir, R + y));
}

/** 逆映射：pos → { x, z, y, sigma, inRange }。σ = 径向与锚点 up 的角距；对蹠点附近 inRange=false。 */
export function unmapPoint(patch, pos, { mode = 'sphere' } = {}) {
  if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isFinite)) throw new RangeError('Invalid unmap point');
  if (mode !== 'sphere' && mode !== 'bend') throw new RangeError('Invalid map mode');
  const { R, center, up, e1, e2 } = patch, rel = sub(pos, center), r = len(rel);
  if (r < 1e-12) throw new RangeError('Point at sphere center');
  const dir = mul(rel, 1 / r), sigma = Math.acos(clamp(dot(dir, up)));
  let x, z, y;
  if (mode === 'bend') {   // 抛物面：x,z 是切平面坐标真值，y 由 y − d²/(2R) 还原
    const rel2 = sub(pos, patch.anchor); x = dot(rel2, e1); z = dot(rel2, e2);
    y = dot(rel2, up) + (x * x + z * z) / (2 * R);
  } else {
    y = r - R;
    const t = sub(dir, mul(up, Math.cos(sigma)));
    if (len(t) < 1e-9) { x = 0; z = 0; } else { const tt = norm(t); x = sigma * R * dot(tt, e1); z = sigma * R * dot(tt, e2); }
  }
  return { x, z, y, sigma, inRange: sigma < Math.PI - 1e-9 };
}

/**
 * (x,z) 处的球面姿态：pos + 局部正交基 {up, right, forward}。
 *   up = 该点球面法线（'sphere' 严格径向；'bend' 取抛物面法线 = apostles 帽面法线同口径）。
 *   right/forward = 锚点基 e1/e2 沿最小旋转（'bend'）或测地平行搬运（'sphere'）到该点——
 *   'sphere' 的 rotMin(up→dir) 即沿锚点→该点测地线的平行搬运。
 */
export function localFrame(patch, x, z, { mode = 'sphere', y = 0 } = {}) {
  const pos = mapPoint(patch, x, z, { mode, y });
  const { R, center, up, e1, e2 } = patch;
  let upDir, right, forward;
  if (mode === 'bend') {
    const n = bendNormalLocal(x, z, R);
    upDir = norm([e1[0] * n[0] + up[0] * n[1] + e2[0] * n[2], e1[1] * n[0] + up[1] * n[1] + e2[1] * n[2], e1[2] * n[0] + up[2] * n[1] + e2[2] * n[2]]);
  } else {
    upDir = norm(sub(pos, center));
  }
  right = rotMin(up, upDir, e1);
  forward = rotMin(up, upDir, e2);
  const sigma = Math.acos(clamp(dot(norm(sub(pos, center)), up)));
  return { pos, up: upDir, right, forward, sigma, inRange: sigma < Math.PI - 1e-9 };
}

/**
 * 模块/柱格姿态：flat (x,z) + 切平面内 yaw + 高 y → 球面位姿。
 * yaw 在切平面内旋转 (right,forward)：right' = right·cos(yaw) + forward·sin(yaw)。
 * 返回 { position, up, right, forward, sigma, inRange }，基矢全部单位长且互相正交。
 */
export function modulePose(patch, { x, z, yaw = 0, y = 0 } = {}, { mode = 'sphere' } = {}) {
  if (![x, z, yaw, y].every(Number.isFinite)) throw new RangeError('Invalid module pose args');
  const f = localFrame(patch, x, z, { mode, y }), c = Math.cos(yaw), s = Math.sin(yaw);
  const right = add(mul(f.right, c), mul(f.forward, s)), forward = sub(mul(f.forward, c), mul(f.right, s));
  return { position: f.pos, up: f.up, right, forward, sigma: f.sigma, inRange: f.inRange };
}

/** 一格柱格：中心姿态 + 全部角点按同一模式贴球（cell.pts 为 grid.js 的 {x,z} 共享角点）。
 *  邻接格共享的角点坐标相同 ⇒ 贴球后角点逐位相同，接缝按构造闭合（验收的「接缝」项）。 */
export function mapCell(patch, cell, { mode = 'sphere', y = 0 } = {}) {
  if (!cell || !Array.isArray(cell.pts) || cell.pts.length < 3 || !Number.isFinite(cell.cx) || !Number.isFinite(cell.cz)) throw new RangeError('Invalid cell');
  const pose = modulePose(patch, { x: cell.cx, z: cell.cz, y }, { mode });
  const pts = cell.pts.map((p) => {
    if (![p.x, p.z].every(Number.isFinite)) throw new RangeError('Invalid cell corner');
    return mapPoint(patch, p.x, p.z, { mode, y });
  });
  return { id: cell.id, pose, pts };
}

/** 整张网格贴球：每格中心姿态 + 角点，附带覆盖率统计（σ = 径向角距，inRange=未到对蹠折叠）。 */
export function mapGridCells(patch, grid, { mode = 'sphere', y = 0 } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new RangeError('Invalid grid');
  const cells = grid.cells.map((c) => mapCell(patch, c, { mode, y }));
  let inRange = 0, maxSigma = 0;
  for (const c of cells) { if (c.pose.inRange) inRange++; maxSigma = Math.max(maxSigma, c.pose.sigma); }
  return { cells, coverage: { total: cells.length, inRange, maxSigma } };
}

/* ---- 平滑岸线（球面） -------------------------------------------------------------------- */

/**
 * 平面岸线点串 → 球面闭合环。pts: [{x,z,nx?,nz?}]（sampleShoreline 的输出或同构）。
 * 每点贴球（y=0 即海面半径 R，可用 y 抬到岸壁高）；nx/nz 为平面外法线，按平行搬运到该点切平面。
 * maxStep：相邻点最大角距（弧度）。细分在平面 (x,z) 上做（边长按等距映射的切向伸长
 * σ/sinσ 保守折算；'bend' 用同一阶近似），保证贴球后相邻角距 ≤ maxStep——环在球面上连续。
 * 返回 { pts, dirs, normals, subdivided, closed:true }；pts 即 3D 位置，dirs 为单位径向。
 */
export function shoreLoopOnSphere(patch, pts, { mode = 'sphere', maxStep = 0.05, y = 0 } = {}) {
  if (!Array.isArray(pts) || pts.length < 3) throw new RangeError('Shore loop needs at least 3 points');
  if (!Number.isFinite(maxStep) || maxStep <= 0 || maxStep >= Math.PI) throw new RangeError('Invalid shore maxStep');
  const { R } = patch, rad = R + y;
  if (!(rad > 0)) throw new RangeError('Invalid shore radius');
  const hasN = pts.every((p) => Number.isFinite(p.nx) && Number.isFinite(p.nz));
  const frames = pts.map((p) => {
    if (![p.x, p.z].every(Number.isFinite)) throw new RangeError('Invalid shore point');
    return localFrame(patch, p.x, p.z, { mode });
  });
  const out = [], outN = [], n = pts.length;
  let subdivided = 0;
  const emit = (x, z, nx, nz) => {
    const pos = mapPoint(patch, x, z, { mode, y }), f = localFrame(patch, x, z, { mode });
    out.push(pos);
    if (hasN) {
      const t = rotMin(patch.up, f.up, add(mul(patch.e1, nx), mul(patch.e2, nz)));   // 平行搬运，仍为单位切向量
      const u = norm(sub(pos, patch.center));   // 投到径向切面（'sphere' 下与 f.up 相同；'bend' 下与球面外推口径一致）
      outN.push(norm(sub(t, mul(u, dot(t, u)))));
    }
  };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    emit(a.x, a.z, a.nx, a.nz);
    const edge = Math.hypot(b.x - a.x, b.z - a.z);
    if (edge < 1e-12) continue;
    const sm = Math.max(frames[i].sigma, frames[(i + 1) % n].sigma);
    const stretch = sm < 1e-6 ? 1 : Math.min(sm / Math.sin(sm), 20);   // 等距映射切向伸长；对蹠附近封顶
    const k = Math.ceil(edge * stretch / (maxStep * R));
    for (let s2 = 1; s2 < k; s2++) {
      const t = s2 / k;
      emit(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, hasN ? (a.nx + (b.nx - a.nx) * t) : 0, hasN ? (a.nz + (b.nz - a.nz) * t) : 0);
      subdivided++;
    }
  }
  return { pts: out, dirs: out.map((p) => norm(sub(p, patch.center))), normals: hasN ? outN : null, subdivided, closed: true };
}

/** 球面 Taubin λ/μ 平滑（与 planet-smooth-c08 同口径的独立折线版）：每点沿两邻点均值方向
 *  先 λ 收缩再 μ 膨回，逐次重投回各自半径；闭环。返回新数组（不写原数组）。 */
export function smoothSphereLoop(pts, { iters = 6, lambda = 0.5, mu = -0.53, closed = true } = {}) {
  if (!Number.isInteger(iters) || iters < 0 || iters > 100) throw new RangeError('Invalid smooth iters');
  if (!Array.isArray(pts) || pts.length < 3) throw new RangeError('Loop too short');
  let D = pts.map((p) => ({ p: p.slice(), r: len(p) }));
  const n = D.length;
  for (let it = 0; it < iters; it++) for (const f of [lambda, mu]) {
    D = D.map(({ p, r }, i) => {
      const a = D[(i + n - 1) % n].p, b = D[(i + 1) % n].p;
      if (!closed && (i === 0 || i === n - 1)) return { p, r };
      const m = [(a[0] + b[0]) / 2 - p[0], (a[1] + b[1]) / 2 - p[1], (a[2] + b[2]) / 2 - p[2]];
      return { p: mul(norm([p[0] + f * m[0], p[1] + f * m[1], p[2] + f * m[2]]), r), r };
    });
  }
  return D.map(({ p }) => p);
}

/** 黄线 → 蓝线外推：每条岸线点沿（已搬运到切平面的）外法线方向走测地距离 dist。
 *  pts 为球面位置；normals 为单位切向量（须与 pts 正交，容差 1e-3）。 */
export function pushOutSphere(pts, normals, dist) {
  if (!Array.isArray(pts) || !Array.isArray(normals) || pts.length !== normals.length) throw new RangeError('pushOut length mismatch');
  if (!Number.isFinite(dist)) throw new RangeError('Invalid push distance');
  return pts.map((p, i) => {
    const n = normals[i], r = len(p), u = mul(p, 1 / r);
    if (Math.abs(dot(u, n)) > 1e-3 || Math.abs(len(n) - 1) > 1e-3) throw new RangeError('pushOut normal not tangent');
    const s = dist / r;
    return mul(norm(add(mul(u, Math.cos(s)), mul(n, Math.sin(s)))), r);
  });
}

/** 岸线连续度报告：相邻点角距（闭环含首尾）。用于「岸线点在球面上连续」验收。 */
export function shoreReport(pts, { closed = true } = {}) {
  if (!Array.isArray(pts) || !pts.length) throw new RangeError('Empty shore');
  const steps = [], n = pts.length;
  for (let i = 0; i < n - 1; i++) steps.push(Math.acos(clamp(dot(norm(pts[i]), norm(pts[i + 1])))));
  if (closed && n > 2) steps.push(Math.acos(clamp(dot(norm(pts[n - 1]), norm(pts[0])))));
  const max = steps.length ? Math.max(...steps) : 0, mean = steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : 0;
  let minChord = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) minChord = Math.min(minChord, len(sub(pts[i], pts[j])));
  return { count: n, closed, maxStepAngle: max, meanStepAngle: mean, minChord };
}

/**
 * 整条管线：平面 World → 球面岸线。isLand 缺省 = 与 buildShore 同口径（lv1 有实心）。
 * 每条环：平面 traceShoreLoops → 顶点法线平均 → sampleShoreline → 贴球细分 → 可选 Taubin 平滑
 *   → 可选沿法线测地外推 reach 得「蓝线」。
 * 返回 [{ pts, sea, normals, report, subdivided }]；sea 为 null 当 reach=0。
 */
export function worldShorelines(patch, world, {
  mode = 'sphere', spacing = 0.18, maxStep = 0.05, y = 0,
  reach = 0, smoothIters = 0, isLand = (c) => world.isSolid(c, 1),
} = {}) {
  if (!world || !Array.isArray(world.cells)) throw new RangeError('Invalid world');
  if (!(reach >= 0) || !Number.isInteger(smoothIters) || smoothIters < 0) throw new RangeError('Invalid shoreline options');
  const loops = traceShoreLoops(world.cells, isLand);
  const out = [];
  for (const loop of loops) {
    // 与 water/shore.js 同口径：边 → 顶点（两邻边法线平均）
    const raw = loop.map((seg, i) => {
      const prev = loop[(i + loop.length - 1) % loop.length];
      let nx = seg.nx + prev.nx, nz = seg.nz + prev.nz; const l = Math.hypot(nx, nz);
      if (l > 1e-9) { nx /= l; nz /= l; } else { nx = seg.nx; nz = seg.nz; }
      return { x: seg.a.x, z: seg.a.z, nx, nz };
    });
    const flat = sampleShoreline(raw, spacing);
    if (flat.length < 3) continue;
    const ring = shoreLoopOnSphere(patch, flat, { mode, maxStep, y });
    let pts = ring.pts, nrm = ring.normals;
    if (smoothIters) {
      pts = smoothSphereLoop(pts, { iters: smoothIters });
      // 平滑后法线重投影到新位置切平面（搬运法线属旧切平面）
      if (nrm) nrm = nrm.map((nv, i) => { const u = norm(sub(pts[i], patch.center)); return norm(sub(nv, mul(u, dot(nv, u)))); });
    }
    const sea = reach > 0 && nrm ? pushOutSphere(pts, nrm, reach) : null;
    out.push({ pts, sea, normals: nrm, subdivided: ring.subdivided, report: shoreReport(pts) });
  }
  return out;
}
