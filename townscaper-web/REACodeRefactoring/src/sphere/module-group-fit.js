/**
 * module-group-fit.js — 多格模块的联合形状拟合与误差约束（1769641473895432220 残差）。
 *
 * 原话："all module-containing cells try to achieve their desired shape and size"。
 * planet.js 现状：'spring' 足迹弹簧逐边拉（共享角点平均 → 组内最差边被拉扯放大，实测
 *   组内边误差 worst 1.78 vs mean 0.23）；'shape' 组件级测地缩放（连通台地整片一个相似
 *   变换，共享角点天然一致，但"模块"尺度没有入口：一个占几格的模块嵌在大台地里时，
 *   整片组件的远心距 far 把收缩率 f 钉在墙倾斜上限上，模块自己的小足迹本可以收更多）。
 *   分格拟合（每格各自朝自己期望形状收）会在模块内部共享角点上互相矛盾——两个邻居格
 *   各自绕自己的格心缩，同一角点得到不同提案，取平均后组内边误差 worst 可达 0.36–0.48
 *   （本文件实测），而联合拟合同组同层 worst 0.001–0.17。
 *
 * 本文件：
 *   splitModuleFit   分格拟合基线/回退——每格绕自己的格心做测地缩放，共享角点取提案平均。
 *   fitModuleGroup   联合拟合——整组格共享一个相似变换（组质心 + 面积收缩率 + 墙倾斜上限），
 *                    再有界逐边投影精修（绝不接受比相似解更差的边，误差约束硬保证），
 *                    逐边误差诊断 + edgeTol 超阈值拒绝 → 回退分格拟合。
 *   moduleGroupReport 任意角点采样器上评估一组格的逐边误差（before/after 曲线用）。
 *   moduleConflictReport 多格模块声明的求解前冲突诊断（r213）：逐组枚举拒绝级原因
 *                    （invalid-cell/duplicate-cell/overlap/disconnected/unresolvable）与诊断级
 *                    原因（sea/uneven-support/assembly-cut），拒绝码对齐 build/multicell.js
 *                    validateHouseTiles 的同义口径——裁判库 REACode 把多格 tile 与球面 relax
 *                    都列为 not done/todo，没有可对齐的原作多格语义，本规则是本仓工程规则。
 *   resolveModuleGroups 确定性消解：剪非法/重复/重叠声明格 → 连通切分 → 仍超角距的组丢弃
 *                    并逐条记账，不伪造可行解。
 *   cornerPositions 侧：moduleCheck:true 时先跑 moduleConflictReport，拒绝级冲突即 RangeError。
 *
 * 期望形状与 relaxConflictReport/moduleSizeReport 同口径：格的海平面 ring（原模块目标形状
 * 在 REACode 里无出处，spheretown 标 "Not done"，属推断）；期望尺寸 = 海平面弦长（边误差
 * = 当前弦 / 海平面弦 − 1）。联合 ≠ 全能：尺寸与墙倾斜的矛盾仍在（far 越大上限越紧），
 * 最差边误差以"单格误差量级"为界如实报告，不声称消掉蘑菇化。纯函数、确定性。
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x) => Math.max(-1, Math.min(1, x));

/** 与 planet.js 同式：单位方向 p 绕单位中心 c 的测地缩放（角距 → f·角距）。 */
function geoScale(c, p, f) {
  const cs = clamp(dot(c, p)), ang = Math.acos(cs);
  if (ang < 1e-12) return p.slice();
  const t = norm(sub(p, c.map((x) => x * cs))), a = ang * f;
  return norm([c[0] * Math.cos(a) + t[0] * Math.sin(a), c[1] * Math.cos(a) + t[1] * Math.sin(a), c[2] * Math.cos(a) + t[2] * Math.sin(a)]);
}
const ringArea = (ring) => { let s = 0; for (let i = 1; i + 1 < ring.length; i++) s += len(cross(sub(ring[i], ring[0]), sub(ring[i + 1], ring[0]))) / 2; return s; };
const centroid = (pts) => norm(pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]));

/** 校验一组格 id 并返回 cell 对象数组（保持传入顺序，去重）。 */
function groupCells(planet, ids) {
  if (!planet || !Array.isArray(planet.cells) || !Array.isArray(planet.corners)) throw new RangeError('Invalid planet');
  if (!Array.isArray(ids) || !ids.length) throw new RangeError('Module group needs cell ids');
  const seen = new Set();
  return ids.map((id) => {
    if (!Number.isInteger(id) || id < 0 || id >= planet.cells.length || planet.cells[id].id !== id) throw new RangeError('Invalid module group cell id');
    if (seen.has(id)) throw new RangeError('Duplicate cell id in module group');
    seen.add(id);
    return planet.cells[id];
  });
}

/** 组的唯一角点集合（ring 出现顺序）。 */
function groupCorners(gc) {
  const seen = new Set(), ks = [];
  for (const c of gc) for (const k of c.ring) if (!seen.has(k)) { seen.add(k); ks.push(k); }
  return ks;
}

/** 组内 ring 边去重表（每条边都属于组内至少一格；两侧格可能不全在组里）。 */
function groupEdgeList(gc) {
  const E = new Map();
  for (const c of gc) for (let i = 0; i < c.ring.length; i++) {
    const a = c.ring[i], b = c.ring[(i + 1) % c.ring.length], key = a < b ? a + ',' + b : b + ',' + a;
    if (!E.has(key)) E.set(key, [a, b]);
  }
  return [...E.values()];
}

/** 组内连通块数（只数组内格之间共享 ring 边的邻接）。 */
function groupPieces(gc, cells) {
  const inG = new Set(gc.map((c) => c.id)), seen = new Set();
  let pieces = 0;
  for (const c of gc) {
    if (seen.has(c.id)) continue;
    pieces++;
    const st = [c.id]; seen.add(c.id);
    while (st.length) {
      const id = st.pop();
      for (const o of cells[id].nb) if (o >= 0 && inG.has(o) && !seen.has(o)) { seen.add(o); st.push(o); }
    }
  }
  return pieces;
}

/**
 * 一组格在某一层的共享相似变换（联合姿态）：
 *   ctr  = 组角点在 prev 上的质心方向；
 *   want = √(海平面组面积 / 当前层组面积)（尺寸缺口，<1 要收）；
 *   f    = 实际收缩率 = max(want, 1 − cap/far)：墙倾斜上限优先（far = 组最远角点距 ctr 的世界距离，
 *          边缘角点侧移 ≤ cap = tan(maxLean)·L）；组角距跨 >farLimit 弧度时测地缩放发散 → f=1 记 unresolved。
 * 返回 {dirs:Map, f, want, capped, unresolved, ctr}。
 */
function groupSimilarity(planet, gc, ks, prev, { r, R, cap, farLimit }) {
  let aNow = 0, aWant = 0;
  for (const c of gc) {
    aNow += ringArea(c.ring.map((k) => prev[k])) * r * r;
    aWant += ringArea(c.ring.map((k) => planet.corners[k])) * R * R;
  }
  const want = aNow > 0 ? Math.min(1, Math.sqrt(aWant / aNow)) : 1;
  const ctr = centroid(ks.map((k) => prev[k]));
  const far = ks.reduce((m, k) => Math.max(m, Math.acos(clamp(dot(ctr, prev[k]))) * r), 0);
  const farAng = far / r;
  const unresolved = farAng > farLimit;
  const f = unresolved ? 1 : far > 1e-12 ? Math.max(want, 1 - cap / far) : 1;
  const dirs = new Map(ks.map((k) => [k, geoScale(ctr, prev[k], f)]));
  return { dirs, f, want, capped: f > want + 1e-9, unresolved, ctr, far };
}

/** 把一个角点沿 dir 推 amount（单位球面弦长），并把相对 prev 的侧移钳在 capU 内。 */
function nudge(k, dir, amount, D, prev, capU) {
  const p = D.get(k);
  let nd = norm([p[0] + dir[0] * amount, p[1] + dir[1] * amount, p[2] + dir[2] * amount]);
  const along = dot(nd, prev[k]);
  const side = sub(nd, prev[k].map((x) => x * along));
  const sl = len(side);
  if (sl > capU && sl > 1e-12) {
    const f2 = capU / sl;
    nd = norm([prev[k][0] * along + side[0] * f2, prev[k][1] * along + side[1] * f2, prev[k][2] * along + side[2] * f2]);
  }
  return nd;
}

/**
 * 最差边 minimax 下降（r251）：Jacobi 逐边投影求的是均值，最差边可能反而被放大
 * （r250 实测 3 格 6 层组：joint 最差 0.568 > spring 0.297）。这里每轮只动**当前最差边**
 * 的两端，朝期望弦长推（仍钳在墙倾斜上限内），且只在「全局最差严格下降」时接受 →
 * 结果对 worst 单调下降，直到几何下界（cap 顶死）不再有下降方向为止。
 * 返回 {dirs, worst, iters, stalled}。
 */
function worstEdgeDescent(E, rests, D, planet, r, prev, capU, { iters = 60, step = 0.5 } = {}) {
  const st0 = edgeStats(E, D, planet, r, null);
  let cur = D, worst = st0.worst, used = 0, stalled = false;
  for (let it = 0; it < iters; it++) {
    const st = edgeStats(E, cur, planet, r, null);
    let we = 0;
    for (let i = 1; i < st.edges.length; i++) if (st.edges[i].err > st.edges[we].err) we = i;
    const { a, b } = st.edges[we], rest = rests[we], curLen = st.edges[we].len || 1e-9;
    const dir = norm(sub(cur.get(b), cur.get(a)));
    let ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      const need = (rest - curLen) * step * Math.pow(0.5, t);
      const cand = new Map(cur);
      cand.set(a, nudge(a, dir, -need / 2, cur, prev, capU));
      cand.set(b, nudge(b, dir, need / 2, cur, prev, capU));
      const w = edgeStats(E, cand, planet, r, null).worst;
      if (w < worst - 1e-12) { cur = cand; worst = w; ok = true; }
    }
    used = it + 1;
    if (!ok) { stalled = true; break; }
  }
  return { dirs: cur, worst, iters: used, stalled };
}

/** 逐边误差（D 为 Map：corner→单位方向）：{edges:[{a,b,rest,len,err,simLen}],worst,mean}；rest/len 为世界弦长。 */
function edgeStats(E, D, planet, r, simD) {
  const edges = [];
  let worst = 0, mean = 0;
  for (const [a, b] of E) {
    const rest = len(sub(planet.corners[a], planet.corners[b])) * planet.R;   // 海平面世界弦
    const cur = len(sub(D.get(a), D.get(b))) * r;
    const simLen = simD ? len(sub(simD.get(a), simD.get(b))) * r : null;
    const err = Math.abs(cur / rest - 1);
    edges.push({ a, b, rest, len: cur, err, simLen });
    worst = Math.max(worst, err); mean += err;
  }
  mean = edges.length ? mean / edges.length : 0;
  return { edges, worst, mean };
}

/**
 * 分格拟合（回退基线）：每个活动格绕自己的格心做测地缩放（自己的 want/墙上限），
 * 共享角点取各格提案平均。提案在共享角点上互相矛盾是这种方案的固有误差源。
 * 返回 {dirs:Map, perCell:[{id,f}]}。
 */
export function splitModuleFit(planet, groupIds, prev, { level, maxLean = 30 } = {}) {
  const gc = groupCells(planet, groupIds);
  const { R, L } = planet;
  if (!Number.isInteger(level) || level < 0 || !Number.isFinite(maxLean) || maxLean < 0 || maxLean >= 90) throw new RangeError('Invalid split fit options');
  const r = R + level * L, cap = Math.tan(maxLean * Math.PI / 180) * L;
  if (!Array.isArray(prev) || prev.length !== planet.corners.length) throw new RangeError('Invalid prev directions');
  const ks = groupCorners(gc), prop = new Map(ks.map((k) => [k, []])), perCell = [];
  for (const c of gc) {
    const res = groupSimilarity(planet, [c], c.ring, prev, { r, R, cap, farLimit: Infinity });
    perCell.push({ id: c.id, f: res.f });
    for (const k of c.ring) prop.get(k).push(res.dirs.get(k));
  }
  const dirs = new Map(ks.map((k) => {
    const ps = prop.get(k), m = ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]);
    return [k, norm(m)];
  }));
  return { dirs, perCell };
}

/**
 * 联合形状拟合：整组格共享一个相似变换（不是每格一个），再有界逐边投影精修。
 *
 * 精修 = 逐边 Jacobi 投影朝期望弦长 rest=海平面弦×s 修正，每角点相对 prev 的侧移钳在
 *   capU（墙倾斜上限）内；每轮算完后评估组内最差边，保留历史最优——所以精修结果的最差边
 *   绝不差于共享相似解（误差约束硬保证，不接受"平均改善掩盖最差边恶化"）。
 * edgeTol：拟合后组内最差边误差 > edgeTol → rejected=true，dirs 回退成分格拟合结果。
 *   （相似解与精修解都超阈值时说明该组在本层的尺寸/墙矛盾无可行解，如实交给调用方。）
 *
 * 返回 {dirs:Map(corner→单位方向), report:{cells,level,f,want,capped,unresolved,pieces,
 *   edges,worst,mean,simWorst,splitWorst,iters,improved,leanMaxDeg,rejected}}。
 * dirs 只覆盖组内格触及的角点；调用方负责与其他组/邻居协商（共享角点平均）。
 */
export function fitModuleGroup(planet, groupIds, prev, { level, iters = 40, step = 0.5, maxLean = 30, edgeTol = Infinity, farLimit = 1.2, minimax = true, minimaxIters = 60 } = {}) {
  const gc = groupCells(planet, groupIds);
  const { R, L } = planet;
  if (!Number.isInteger(level) || level < 0 || !Number.isInteger(iters) || iters < 0 || iters > 1e4 ||
      !Number.isFinite(step) || step <= 0 || step > 1 || !Number.isFinite(maxLean) || maxLean < 0 || maxLean >= 90 ||
      !(edgeTol > 0) || !Number.isFinite(farLimit) || farLimit <= 0 || farLimit > Math.PI ||
      typeof minimax !== 'boolean' || !Number.isInteger(minimaxIters) || minimaxIters < 0 || minimaxIters > 1e4) throw new RangeError('Invalid fitModuleGroup options');
  if (!Array.isArray(prev) || prev.length !== planet.corners.length || !prev.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) throw new RangeError('Invalid prev directions');
  const r = R + level * L, s = R / r, cap = Math.tan(maxLean * Math.PI / 180) * L, capU = cap / r;
  const ks = groupCorners(gc), E = groupEdgeList(gc);
  const rests = E.map(([a, b]) => len(sub(planet.corners[a], planet.corners[b])) * s);   // 单位球面期望弦
  // 1. 共享相似变换（联合姿态初值）
  const sim = groupSimilarity(planet, gc, ks, prev, { r, R, cap, farLimit });
  const simErr = edgeStats(E, sim.dirs, planet, r, null);
  // 2. 有界逐边投影精修：target = 期望弦，逐轮保最优
  let D = new Map(ks.map((k) => [k, sim.dirs.get(k).slice()]));
  let best = D, bestWorst = simErr.worst, itersUsed = 0;
  for (let it = 0; it < iters && E.length; it++) {
    const acc = new Map(ks.map((k) => [k, [0, 0, 0, 0]]));
    for (let ei = 0; ei < E.length; ei++) {
      const [a, b] = E[ei], rest = rests[ei];
      const d = sub(D.get(b), D.get(a)), cur = len(d) || 1e-9, g = (cur - rest) / cur * 0.5 * step;
      const A = acc.get(a), B = acc.get(b);
      A[0] += d[0] * g; A[1] += d[1] * g; A[2] += d[2] * g; A[3]++;
      B[0] -= d[0] * g; B[1] -= d[1] * g; B[2] -= d[2] * g; B[3]++;
    }
    let moved = 0;
    const cand = new Map(ks.map((k) => [k, D.get(k)]));
    for (const k of ks) {
      const A = acc.get(k); if (!A[3]) continue;
      const p = D.get(k);
      let nd = norm([p[0] + A[0] / A[3], p[1] + A[1] / A[3], p[2] + A[2] / A[3]]);
      // 墙倾斜上限：相对上一层位置的侧移 ≤ capU
      const along = dot(nd, prev[k]);
      let side = sub(nd, prev[k].map((x) => x * along));
      const sl = len(side);
      if (sl > capU) { side = side.map((x) => x * capU / sl); nd = norm([prev[k][0] * along + side[0], prev[k][1] * along + side[1], prev[k][2] * along + side[2]]); }
      moved = Math.max(moved, len(sub(nd, D.get(k))));
      cand.set(k, nd);
    }
    itersUsed = it + 1;
    const w = edgeStats(E, cand, planet, r, null).worst;
    if (w < bestWorst - 1e-12) { bestWorst = w; best = cand; }
    D = cand;
    if (moved < 1e-9) break;
  }
  const jacobiWorst = bestWorst;
  // 2b. 最差边 minimax 下降（r251）：Jacobi 求均值，最差边可能反而放大
  let mmIters = 0, mmStalled = false;
  if (minimax && minimaxIters > 0 && E.length) {
    const mm = worstEdgeDescent(E, rests, best, planet, r, prev, capU, { iters: minimaxIters, step });
    mmIters = mm.iters; mmStalled = mm.stalled;
    if (mm.worst < bestWorst - 1e-12) { best = mm.dirs; bestWorst = mm.worst; }
  }
  const fitErr = edgeStats(E, best, planet, r, sim.dirs);
  // 2c. 上限探测：同口径下降但放开墙倾斜上限 → 「不受 cap 约束时的可达下界」
  //     两者之差就是墙倾斜约束本身要付的价（把这层残差分到几何 vs 算法，而不是含糊的"没有上限"）
  const free = minimax && minimaxIters > 0 && E.length
    ? worstEdgeDescent(E, rests, new Map(ks.map((k) => [k, sim.dirs.get(k).slice()])), planet, r, prev, Infinity, { iters: minimaxIters, step })
    : null;
  const freeWorst = free ? Math.min(free.worst, fitErr.worst) : null;
  // 3. 误差约束：超阈值 → 回退分格拟合。r251 补一条不变量：**拒收不得把结果变差** ——
  //    分格拟合自己的最差边可能比联合解还大（r250 实测 0.554 vs 0.568 只是碰巧略好），
  //    那就说明阈值在本层不可达（几何下界），退回更差的解只会让账面更假 → 保留联合解并记
  //    edgeTolMissed=true，把可达上限交给 boundWorst。
  let dirs = best, rejected = false, split = null, splitWorst = null, edgeTolMissed = false;
  if (fitErr.worst > edgeTol) {
    split = splitModuleFit(planet, groupIds, prev, { level, maxLean });
    const spErr = edgeStats(E, split.dirs, planet, r, null);
    splitWorst = spErr.worst;
    if (splitWorst < fitErr.worst - 1e-12) { dirs = split.dirs; rejected = true; }
    else edgeTolMissed = true;   // 阈值不可达：保留更好的联合解，如实记
  }
  // 墙倾斜实测量（本组角点，prev→本层）
  let leanMaxDeg = 0;
  for (const k of ks) {
    const a = prev[k].map((x) => x * (r - L)), b = dirs.get(k).map((x) => x * r);
    const d = sub(b, a), rr = norm(b), along = dot(d, rr), side = len(sub(d, rr.map((x) => x * along)));
    if (along > 1e-9) leanMaxDeg = Math.max(leanMaxDeg, Math.atan2(side, along) * 180 / Math.PI);
  }
  return {
    dirs,
    report: {
      cells: gc.map((c) => c.id), level, f: sim.f, want: sim.want, capped: sim.capped,
      unresolved: sim.unresolved, pieces: groupPieces(gc, planet.cells),
      edges: fitErr.edges, worst: fitErr.worst, mean: fitErr.mean, simWorst: simErr.worst,
      splitWorst, finalWorst: rejected ? splitWorst : fitErr.worst,   // 返回 dirs 的实测最差边（拒绝时分格拟合）
      edgeTolMissed,
      iters: itersUsed, improved: bestWorst < simErr.worst - 1e-12,
      leanMaxDeg, rejected,
      // r251：最差边的上限口径 —— jacobi 均值解的最差 / minimax 下降后的最差 / 放开墙倾斜上限的可达下界
      jacobiWorst, minimaxIters: mmIters, minimaxStalled: mmStalled, freeWorst,
      capPenalty: freeWorst === null ? null : +(fitErr.worst - freeWorst).toFixed(6),
      boundWorst: freeWorst === null ? fitErr.worst : Math.min(fitErr.worst, freeWorst),
    },
  };
}

/**
 * 逐边误差诊断（误差约束的输出端）：在任意角点采样器 at(k, level)→世界位置 上，
 * 评估一组格在 level 层每条组内边的弦长误差（rest=海平面世界弦）。
 * 用于「多种高度/多格足迹记录误差前后曲线」：同一组格在 relax:false / 'spring' / 'shape' /
 * 'joint' 各采样器上各层跑一次，即得前后曲线。
 */
export function moduleGroupReport(planet, groupIds, at, level) {
  const gc = groupCells(planet, groupIds);
  const { R, L } = planet;
  if (typeof at !== 'function' || !Number.isInteger(level) || level < 0) throw new RangeError('Invalid module group report args');
  const E = groupEdgeList(gc);
  const edges = E.map(([a, b]) => {
    const pa = at(a, level), pb = at(b, level);
    if (!pa.every(Number.isFinite) || !pb.every(Number.isFinite)) throw new RangeError('Sampler returned non-finite position');
    const rest = len(sub(planet.corners[a], planet.corners[b])) * R;
    const cur = len(sub(pa, pb));
    return { a, b, rest, len: cur, err: Math.abs(cur / rest - 1) };
  });
  const worst = edges.reduce((m, e) => Math.max(m, e.err), 0);
  const mean = edges.length ? edges.reduce((s2, e) => s2 + e.err, 0) / edges.length : 0;
  return { cells: gc.map((c) => c.id), level, edges, worst, mean };
}

/* ============================== r213 多格模块冲突诊断 / 消解 ==============================
 *
 * 「多格冲突仍待补」残差拆分。裁判库核对（townscaper-web/REACode 只读）：
 *   engine/relax.js 是平面四叉格面积 relax，没有任何模块组语义；
 *   src/spheretown.js 把本片的 mushrooming relax 明列 "Not done"；
 *   LEARNING.md/STUDY-INDEX 把多格 tile（1579483114178768898）列为 todo——
 *   原作与裁判库都没有可对齐的多格模块冲突语义。下面的拒绝/诊断码对齐本仓
 *   build/multicell.js validateHouseTiles 的同义口径（overlap/disconnected/support），
 *   是本仓工程规则，不冒充原作。
 *
 * 冲突类（severity: 'reject' 声明即不可解 / 'warn' 可解但如实记）：
 *   invalid-group   reject  组不是非空 id 数组
 *   invalid-cell    reject  非法格 id（非整数 / 越界 / 不是该 planet 的格）
 *   duplicate-cell  reject  同一组内重复格
 *   overlap         reject  一格被多组同时声明（声明互斥，先到先得）
 *   disconnected    reject  组内格按 edgeNeighbors 不连通 → 求解器只能把它切成多片，
 *                           声明的「一个模块」名不副实
 *   unresolvable    reject  组足迹角距 farAng > farLimit（默认 1.2 rad ≈ 69°，与
 *                           groupSimilarity 的 unresolved 同界）：第 1 层 prev=海平面
 *                           角点已超限 ⇒ 逐层必 unresolved，联合拟合不可行（尺寸 vs
 *                           墙倾斜的几何下界，不是能修的声明错）
 *   sea             warn    组含 H=0 海格：建筑足迹无支撑（对齐 multicell 'support'）
 *   uneven-support  warn    组内格高不一 → 每层活动子集不同，模块跨台阶只在最低层以下
 *                           才是一个联合单元；partialLevels 列出部分活动的层
 *   assembly-cut    warn    给了装配顺序 order：组内格在 order 里不连续 → 存在某个
 *                           前缀 t 把模块切成两半（跨格建筑在装配下的冲突）
 */

/** 组 id 列表 → 唯一角点的海平面角距包络（farAng = 组最远角点距组质心的角距，弧度）。 */
function groupFarAng(planet, ids) {
  const ks = new Set();
  for (const id of ids) for (const k of planet.cells[id].ring) ks.add(k);
  const pts = [...ks].map((k) => planet.corners[k]);
  const ctr = centroid(pts);
  return pts.reduce((m, p) => Math.max(m, Math.acos(clamp(dot(ctr, p)))), 0);
}

/** id 集合按 edgeNeighbors 切连通块；返回按首格 id 排序的 id 数组列表（确定性）。 */
function connectedPieces(planet, ids) {
  const inG = new Set(ids), seen = new Set(), pieces = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    if (seen.has(id)) continue;
    const piece = [], st = [id];
    seen.add(id);
    while (st.length) {
      const u = st.pop();
      piece.push(u);
      for (const o of planet.cells[u].nb) if (o >= 0 && inG.has(o) && !seen.has(o)) { seen.add(o); st.push(o); }
    }
    pieces.push(piece.sort((a, b) => a - b));
  }
  return pieces.sort((a, b) => a[0] - b[0]);
}

/**
 * 多格模块声明的求解前冲突诊断。返回
 *   { ok, conflicts, groups:[{index,cells,size,reasons,pieces,minH,maxH,partialLevels,
 *      farAng,unresolvable,assembly}], overlaps:[{cell,groups}], note }
 * ok = 没有任何 reject 级原因；conflicts = reasons 总数（含 warn）。
 * 本函数只诊断，不改求解行为；拒绝入口见 cornerPositions 的 moduleCheck 选项。
 */
export function moduleConflictReport(planet, moduleGroups, { farLimit = 1.2, order = null } = {}) {
  if (!planet || !Array.isArray(planet.cells) || !Array.isArray(planet.corners) || !Array.isArray(planet.H)) throw new RangeError('Invalid planet');
  if (!Array.isArray(moduleGroups)) throw new TypeError('moduleGroups must be an array of cell id lists');
  if (!Number.isFinite(farLimit) || farLimit <= 0 || farLimit > Math.PI) throw new RangeError('Invalid farLimit');
  if (order !== null && (!Array.isArray(order) || order.some((id) => !Number.isInteger(id)))) throw new RangeError('Invalid assembly order');
  const rank = order ? new Map(order.map((id, i) => [id, i])) : null;
  const owner = new Map();   // cell → [group indices]
  moduleGroups.forEach((g, gi) => { if (Array.isArray(g)) for (const id of g) if (Number.isInteger(id)) { const l = owner.get(id) || []; l.push(gi); owner.set(id, l); } });
  const overlaps = [...owner.entries()].filter(([, gs]) => gs.length > 1).map(([cell, gs]) => ({ cell, groups: gs })).sort((a, b) => a.cell - b.cell);
  let conflicts = 0;
  const groups = moduleGroups.map((g, gi) => {
    const reasons = [];
    const reject = (code, detail) => reasons.push({ code, severity: 'reject', detail });
    const warn = (code, detail) => reasons.push({ code, severity: 'warn', detail });
    const entry = { index: gi, cells: Array.isArray(g) ? [...g] : g, size: 0, reasons, pieces: [], minH: null, maxH: null, partialLevels: [], farAng: null, unresolvable: false, assembly: null };
    if (!Array.isArray(g) || !g.length) { reject('invalid-group', 'module group must be a non-empty array of cell ids'); return entry; }
    const seen = new Set(), ids = [], bad = [], dup = [];
    for (const id of g) {
      if (!Number.isInteger(id) || id < 0 || id >= planet.cells.length || !planet.cells[id] || planet.cells[id].id !== id) { bad.push(id); continue; }
      if (seen.has(id)) { dup.push(id); continue; }
      seen.add(id); ids.push(id);
    }
    if (bad.length) reject('invalid-cell', bad);
    if (dup.length) reject('duplicate-cell', dup);
    const shared = overlaps.filter((o) => o.groups.includes(gi));
    if (shared.length) reject('overlap', shared.map((o) => ({ cell: o.cell, groups: o.groups })));
    entry.size = ids.length;
    entry.cells = ids;
    if (!ids.length) return entry;
    // 连通性（声明的一组必须是一个模块：求解器按连通组件切，不连通的声明名不副实）
    const pieces = connectedPieces(planet, ids);
    entry.pieces = pieces.map((p) => p.length);
    if (pieces.length > 1) reject('disconnected', entry.pieces);
    // 支撑 / 逐层活动子集
    const hs = ids.map((id) => planet.H[id]);
    entry.minH = Math.min(...hs); entry.maxH = Math.max(...hs);
    if (hs.some((h) => h <= 0)) warn('sea', ids.filter((id) => planet.H[id] <= 0));
    for (let l = 1; l <= entry.maxH; l++) { const act = hs.filter((h) => h >= l).length; if (act > 0 && act < ids.length) entry.partialLevels.push(l); }
    if (entry.minH !== entry.maxH) warn('uneven-support', { minH: entry.minH, maxH: entry.maxH, partialLevels: entry.partialLevels });
    // 角距包络：第 1 层 prev = 海平面角点，海平面 farAng 超限 ⇒ 逐层必 unresolved
    entry.farAng = groupFarAng(planet, ids);
    entry.unresolvable = entry.farAng > farLimit;
    if (entry.unresolvable) reject('unresolvable', { farAng: entry.farAng, farLimit });
    // 装配原子性：成员格在 order 里不连续 ⇒ 有前缀把模块切成两半
    if (rank) {
      const placed = ids.filter((id) => rank.has(id)).map((id) => rank.get(id));
      if (placed.length >= 2) {
        const first = Math.min(...placed), last = Math.max(...placed), span = last - first + 1;
        entry.assembly = { first, last, span, placed: placed.length, unplaced: ids.length - placed.length };
        if (span !== placed.length) warn('assembly-cut', entry.assembly);
      } else entry.assembly = { placed: placed.length, unplaced: ids.length - placed.length };
    }
    return entry;
  });
  for (const e of groups) conflicts += e.reasons.length;
  return {
    ok: groups.every((e) => e.reasons.every((r) => r.severity !== 'reject')),
    conflicts, groups, overlaps,
    note: '多格冲突语义为本仓工程规则（拒绝码对齐 build/multicell.js：overlap/disconnected/support）；裁判库 REACode 多格 tile 与球面 relax 均列 not done/todo，原片模块目标形状在 REACode 无出处，海平面足迹=推断目标',
  };
}

/**
 * 确定性消解：把一组「带冲突的声明」修成一组可求解声明。
 * 规则（逐条记进 repairs，不伪造可行解）：
 *   invalid-cell   → 剪掉；duplicate-cell → 去重（保留首次）；
 *   overlap        → 先到先得：声明序号小的组保留该格，大组剪除；
 *   disconnected   → 按 edgeNeighbors 连通块切成多个组；
 *   unresolvable   → 切分后角距仍超 farLimit 的组丢弃（尺寸 vs 墙倾斜的下界
 *                    不是声明错误，自动拆分会伪造模块语义 → 拒，如实记账）。
 * 返回 { groups, repairs, report }；report 是对消解结果重跑 moduleConflictReport——
 * 按上面规则消解后 reject 级冲突应为 0（ok=true），warn 级（sea/uneven）如实保留。
 */
export function resolveModuleGroups(planet, moduleGroups, { farLimit = 1.2 } = {}) {
  if (!planet || !Array.isArray(planet.cells) || !Array.isArray(planet.corners)) throw new RangeError('Invalid planet');
  if (!Array.isArray(moduleGroups)) throw new TypeError('moduleGroups must be an array of cell id lists');
  if (!Number.isFinite(farLimit) || farLimit <= 0 || farLimit > Math.PI) throw new RangeError('Invalid farLimit');
  const claimed = new Set(), groups = [], repairs = [];
  for (const [gi, g] of moduleGroups.entries()) {
    if (!Array.isArray(g) || !g.length) { repairs.push({ group: gi, action: 'dropped', reason: 'invalid-group' }); continue; }
    const seen = new Set(), ids = [], bad = [];
    for (const id of g) {
      if (!Number.isInteger(id) || id < 0 || id >= planet.cells.length || !planet.cells[id] || planet.cells[id].id !== id) { bad.push(id); continue; }
      if (seen.has(id)) { repairs.push({ group: gi, action: 'dedup', cell: id }); continue; }
      seen.add(id); ids.push(id);
    }
    if (bad.length) repairs.push({ group: gi, action: 'pruned', reason: 'invalid-cell', cells: bad });
    const kept = [];
    for (const id of ids) {
      if (claimed.has(id)) repairs.push({ group: gi, action: 'pruned', reason: 'overlap', cell: id });
      else kept.push(id);
    }
    if (!kept.length) { repairs.push({ group: gi, action: 'dropped', reason: 'empty-after-prune' }); continue; }
    const pieces = connectedPieces(planet, kept);
    if (pieces.length > 1) repairs.push({ group: gi, action: 'split', pieces: pieces.map((p) => p.length) });
    for (const p of pieces) {
      const farAng = groupFarAng(planet, p);
      if (farAng > farLimit) { repairs.push({ group: gi, action: 'dropped', reason: 'unresolvable', cells: [...p], farAng }); continue; }
      for (const id of p) claimed.add(id);
      groups.push(p);
    }
  }
  return { groups, repairs, report: moduleConflictReport(planet, groups, { farLimit }) };
}
