// 1769641473895432220 残差：多格模块联合形状拟合 + 误差约束。
// 验收口径（队列 acceptance「多种高度/多格足迹记录误差前后曲线；不能以平均改善掩盖最差边
// 恶化，检查碰撞/接缝」）：
//   · 单格模块：联合拟合 = 分格拟合（退化为各自的期望形状，局部通过保持）；
//   · 多格模块：联合拟合后组内最差边误差 < 分格拟合最差边（分格的共享角点提案矛盾是主要
//     误差源），且 ≤ 阈值；多高度/多格足迹逐层记录前后曲线；
//   · 组内拓扑不变：无翻折扇形三角、共享角点逐位一致（接缝按构造闭合）、都在本层半径上；
//   · 误差约束：edgeTol 超阈值 → rejected=true 且回退分格拟合；
//   · 不同曲率半径（小半径=大曲率）不炸、确定性、墙倾斜 ≤ maxLean。
// 纯 Node 单测（浏览器红线，本批不跑页面）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, relaxConflictReport, moduleSizeReport, mushroomRatio } from '../src/sphere/planet.js';
import { fitModuleGroup, splitModuleFit, moduleGroupReport } from '../src/sphere/module-group-fit.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const planet = buildPlanet(buildSphere({ n: 900, seed: 3, spacing: 40, relax: 30 }), { R: 4, L: 0.32 });
const { cells, corners, H, R, L } = planet;
const atShape = cornerPositions(planet, { solver: 'shape' });
const prevOf = (l) => corners.map((d, k) => atShape(k, l - 1).map((x) => x / (R + (l - 1) * L)));

/** 在 level 层活动格内取一个 n 格连通足迹（确定性 BFS，跳过太小的残片）。 */
function footprint(l, n, skip = 0) {
  const act = new Set(cells.filter((c) => H[c.id] >= l).map((c) => c.id));
  const seen = new Set();
  for (const c of cells) {
    if (!act.has(c.id) || seen.has(c.id)) continue;
    const g = [], s = new Set([c.id]), fr = [c.id];
    while (g.length < n && fr.length) { const id = fr.shift(); g.push(id); for (const o of cells[id].nb) if (o >= 0 && act.has(o) && !s.has(o)) { s.add(o); fr.push(o); } }
    for (const id of g) seen.add(id);
    if (g.length === n && skip-- <= 0) return g;
  }
  return null;
}
const sampler = (dirs, prev) => (k, l) => (dirs.get(k) || prev[k]).map((x) => x * (R + l * L));

// ---- 单格模块：联合 = 分格，且局部通过（误差≈0） --------------------------------------
test('单格模块：联合拟合退化为分格期望形状，各层误差≈0', () => {
  const cell = cells.reduce((a, c) => (H[c.id] > H[a.id] ? c : a));
  for (let l = 1; l <= H[cell.id]; l++) {
    const prev = prevOf(l);
    const joint = fitModuleGroup(planet, [cell.id], prev, { level: l });
    const split = splitModuleFit(planet, [cell.id], prev, { level: l });
    assert.equal(joint.report.rejected, false);
    // 单格：联合的共享相似变换就是该格自己的期望形状 → 最差边 ≈ 0（局部通过保持）
    assert.ok(joint.report.worst < 0.02, `single cell L${l} worst ${joint.report.worst}`);
    // 与分格拟合一致（同口径同解）
    for (const k of cell.ring) {
      const d = sub(joint.dirs.get(k), split.dirs.get(k));
      assert.ok(len(d) < 0.05, `single cell corner ${k} deviates from split fit`);
    }
  }
});

// ---- 多格模块：联合最差边 < 分格最差边（多高度、多格足迹，前后曲线） ---------------------
test('多格模块：各层联合拟合最差边误差 < 分格拟合最差边', () => {
  const curve = [];
  for (let l = 1; l <= 6; l++) {
    const group = footprint(l, 4);
    assert.ok(group, `level ${l} footprint`);
    const prev = prevOf(l);
    const joint = fitModuleGroup(planet, group, prev, { level: l });
    const split = splitModuleFit(planet, group, prev, { level: l });
    const repJ = moduleGroupReport(planet, group, sampler(joint.dirs, prev), l);
    const repS = moduleGroupReport(planet, group, sampler(split.dirs, prev), l);
    curve.push({ l, joint: +repJ.worst.toFixed(4), split: +repS.worst.toFixed(4), sim: +joint.report.simWorst.toFixed(4), rejected: joint.report.rejected });
    // 逐边诊断与报告一致
    assert.equal(repJ.edges.length, joint.report.edges.length);
    // 联合最差边严格小于分格最差边（共享角点提案矛盾是分格固有误差源）
    assert.ok(repJ.worst < repS.worst, `L${l}: joint ${repJ.worst} !< split ${repS.worst}`);
    // 最差边受控：与单格误差同量级（≤0.35 阈值；高层台地 lean 上限决定残差下限）
    assert.ok(repJ.worst <= 0.35, `L${l}: joint worst ${repJ.worst} over bound`);
    // 不以平均掩盖最差：最差边也被压住，不只是均值
    assert.ok(repJ.mean <= repS.mean + 1e-9, `L${l}: joint mean ${repJ.mean} > split mean ${repS.mean}`);
    // 精修保证：联合最差边绝不差于共享相似解（误差约束硬保证）
    assert.ok(joint.report.worst <= joint.report.simWorst + 1e-9);
    // 组内拓扑不变：无翻折扇形三角
    for (const c of group.map((id) => cells[id])) {
      const ring = c.ring.map((k) => joint.dirs.get(k) || prev[k]);
      const m = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length, a[2] + p[2] / ring.length], [0, 0, 0]);
      for (let i = 0; i < ring.length; i++) assert.ok(dot(cross(sub(ring[i], m), sub(ring[(i + 1) % ring.length], m)), m) > 0, `folded cell ${c.id} L${l}`);
      // 全在 level 半径上（单位方向）
      for (const k of c.ring) assert.ok(Math.abs(len(joint.dirs.get(k)) - 1) < 1e-9);
    }
    // 接缝：组内相邻格共享角点由同一相似变换放置 → 逐位一致（构造保证，显式断言）
    for (const c of group.map((id) => cells[id])) for (let i = 0; i < c.ring.length; i++) {
      const o = c.nb[i];
      if (o < 0 || !group.includes(o)) continue;
      const a = c.ring[i], b = c.ring[(i + 1) % c.ring.length];
      assert.ok(cells[o].ring.includes(a) && cells[o].ring.includes(b));
      assert.ok(joint.dirs.get(a) && joint.dirs.get(b));
    }
  }
  console.log('  前后曲线', JSON.stringify(curve));
});

test('更大足迹（8 格）与双格模块：联合仍优于分格', () => {
  for (const [l, n] of [[2, 8], [3, 2]]) {
    const group = footprint(l, n);
    const prev = prevOf(l);
    const joint = fitModuleGroup(planet, group, prev, { level: l });
    const repJ = moduleGroupReport(planet, group, sampler(joint.dirs, prev), l);
    const repS = moduleGroupReport(planet, group, sampler(splitModuleFit(planet, group, prev, { level: l }).dirs, prev), l);
    assert.ok(repJ.worst < repS.worst, `n=${n} L${l}: ${repJ.worst} !< ${repS.worst}`);
  }
});

// ---- 误差约束：超阈值拒绝 → 回退分格拟合（r251：拒收不得把结果变差） --------------------
test('误差约束：edgeTol 超阈值 → 只有分格拟合确实更好时才回退，否则如实记 edgeTolMissed', () => {
  const group = footprint(3, 4);
  const prev = prevOf(3);
  const fit = fitModuleGroup(planet, group, prev, { level: 3, edgeTol: 1e-9 });
  const split = splitModuleFit(planet, group, prev, { level: 3 });
  // r251 不变量：无论走哪条分支，返回解的实测最差边不得比分格拟合差
  assert.ok(fit.report.finalWorst <= fit.report.splitWorst + 1e-12,
    `拒收把结果变差了：final ${fit.report.finalWorst} > split ${fit.report.splitWorst}`);
  // edgeTol=1e-9 在本层不可达 → 走哪条分支都要如实标出来
  assert.ok(fit.report.rejected || fit.report.edgeTolMissed, '不可达阈值必须有标记');
  if (fit.report.rejected) {
    assert.equal(fit.report.finalWorst, fit.report.splitWorst);
    for (const [k, d] of split.dirs) assert.deepEqual(fit.dirs.get(k), d, 'fallback returns split fit dirs');
  } else {
    // 阈值不可达：保留联合解（更好的那个），并记下它离阈值有多远
    assert.ok(fit.report.worst > 1e-9, 'missed 时联合解仍应超过阈值');
    assert.equal(fit.report.finalWorst, fit.report.worst);
  }
});

// ---- cornerPositions solver:'joint' 端到端（多高度前后曲线） -----------------------------
test("solver 'joint' 端到端：半径正确、蘑菇化下降、最差边曲线优于 spring", () => {
  const atJ = cornerPositions(planet, { solver: 'joint' });
  const maxH = Math.max(...H);
  for (let l = 0; l <= maxH; l++) for (let k = 0; k < corners.length; k += 29) assert.ok(Math.abs(len(atJ(k, l)) - (R + l * L)) < 1e-9, 'on-sphere radius');
  const off = cornerPositions(planet, { relax: false });
  assert.ok(mushroomRatio(planet, atJ) < mushroomRatio(planet, off) - 0.1, 'joint relax contracts');
  const rc = relaxConflictReport(planet, atJ);
  assert.equal(rc.folded, 0);
  assert.ok(rc.leanMaxDeg <= 30 + 1e-6, `lean ${rc.leanMaxDeg}`);
  assert.ok(rc.sizeErrMean < relaxConflictReport(planet, off).sizeErrMean);
  // 前后曲线：同一组格在 off(前) / joint·shape·spring(后) 采样器上逐层最差边
  const atSpring = cornerPositions(planet, { solver: 'spring' });
  const atSh = cornerPositions(planet, { solver: 'shape' });
  const curve = [];
  for (let l = 2; l <= 6; l++) {
    const group = footprint(l, 5);
    const rJ = moduleGroupReport(planet, group, atJ, l);
    const rH = moduleGroupReport(planet, group, atSh, l);
    const rS = moduleGroupReport(planet, group, atSpring, l);
    const rO = moduleGroupReport(planet, group, off, l);
    curve.push({ l, off: +rO.worst.toFixed(3), joint: +rJ.worst.toFixed(3), shape: +rH.worst.toFixed(3), spring: +rS.worst.toFixed(3) });
    // 联合拟合最差边绝不差于它替代的组件相似解（有界精修按单元保证，子集容差 0.02）
    assert.ok(rJ.worst <= rH.worst + 0.02, `L${l}: joint ${rJ.worst} > shape ${rH.worst}`);
    // 不差于「前」（蘑菇化径向基线）：联合不会比不 relax 更差
    assert.ok(rJ.worst <= rO.worst + 1e-9, `L${l}: joint ${rJ.worst} > off ${rO.worst}`);
  }
  console.log('  足迹前后曲线(off/joint/shape/spring)', JSON.stringify(curve));
  // 全局最差边（逐格顶环口径）：联合拟合优于逐边弹簧（弹簧的最差边机制性放大）
  assert.ok(moduleSizeReport(planet, atJ).maxEdgeError < moduleSizeReport(planet, atSpring).maxEdgeError - 0.05,
    'joint global worst edge < spring global worst edge');
  // per-unit 报告挂在 components 上（误差约束诊断可消费）
  const units = (atJ.components || []).filter((c) => c.unitCells > 1);
  assert.ok(units.length > 0 && units.every((u) => Number.isFinite(u.worst) && u.worst >= 0));
});

// ---- moduleGroups 划分：声明模块独立成联合单元 ------------------------------------------
test('moduleGroups：声明组各自联合拟合，未覆盖格按连通性成组', () => {
  const tall = [...cells].sort((a, b) => H[b.id] - H[a.id])[0];
  const nb = tall.nb.find((o) => o >= 0 && H[o] > 0);
  const groups = [[tall.id, nb]];
  const at = cornerPositions(planet, { solver: 'joint', moduleGroups: groups });
  const unit = (at.components || []).find((u) => u.unitCells === 2 && u.cells.includes(tall.id) && u.cells.includes(nb));
  assert.ok(unit, 'declared group is its own joint unit');
  assert.ok(unit.worst < 0.05, `declared 2-cell module worst ${unit.worst}`);
  assert.throws(() => cornerPositions(planet, { solver: 'joint', moduleGroups: [[tall.id], [tall.id, nb]] }), RangeError);
  assert.throws(() => cornerPositions(planet, { solver: 'joint', moduleGroups: 'x' }), TypeError);
  assert.throws(() => cornerPositions(planet, { solver: 'joint', moduleGroups: [[cells.length + 1]] }), RangeError);
});

// ---- 不同曲率半径 / 确定性 / 校验 -------------------------------------------------------
test('曲率扫描（大曲率小半径不炸）+ 确定性 + 输入校验', () => {
  for (const cfg of [{ n: 200, seed: 5, R: 1.2, L: 0.5 }, { n: 200, seed: 5, R: 8, L: 0.2 }]) {
    const p2 = buildPlanet(buildSphere({ n: cfg.n, seed: cfg.seed, spacing: 6, relax: 6 }), { R: cfg.R, L: cfg.L });
    const at = cornerPositions(p2, { solver: 'joint' });
    const maxH = Math.max(...p2.H);
    for (let l = 0; l <= maxH; l++) for (let k = 0; k < p2.corners.length; k++) assert.ok(at(k, l).every(Number.isFinite));
    const rc = relaxConflictReport(p2, at);
    assert.ok(rc.leanMaxDeg <= 30 + 1e-6, `R=${cfg.R} lean ${rc.leanMaxDeg}`);
    assert.equal(rc.folded, 0);
    const at2 = cornerPositions(p2, { solver: 'joint' });
    for (let l = 0; l <= maxH; l++) for (let k = 0; k < p2.corners.length; k += 7) assert.deepEqual(at(k, l), at2(k, l), 'deterministic');
  }
  const prev = prevOf(2);
  assert.throws(() => fitModuleGroup(planet, [], prev, { level: 1 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [-1], prev, { level: 1 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [0.5], prev, { level: 1 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [1, 1], prev, { level: 1 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [1], prev, { level: 1, iters: -1 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [1], prev, { level: 1, maxLean: 95 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [1], prev, { level: 1, edgeTol: 0 }), RangeError);
  assert.throws(() => fitModuleGroup(planet, [1], corners.slice(1), { level: 1 }), RangeError);
  assert.throws(() => moduleGroupReport(planet, [1], null, 1), RangeError);
  console.log('PASS module-group-fit');
});
