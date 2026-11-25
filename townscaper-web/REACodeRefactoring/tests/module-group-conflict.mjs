// 1769641473895432220 残差「多格冲突仍待补」：多格模块（跨格建筑）声明的冲突诊断 + 消解。
// 裁判库核对结论（townscaper-web/REACode 只读）：engine/relax.js 无模块组语义，
// src/spheretown.js 列 mushrooming relax 为 "Not done"，多格 tile 为 todo ——
// 无原作多格冲突语义可对齐；本仓按 build/multicell.js 的拒绝码对齐实现自己的规则。
// 验收口径：冲突检出（重叠/不连通/非法/超角距拒绝 + sea/uneven/装配切断诊断）、
// unresolved 角距边界（>69° 不收）、消解确定性、不冒充原模块。纯 Node 单测。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, assemblyOrder } from '../src/sphere/planet.js';
import { moduleConflictReport, resolveModuleGroups, fitModuleGroup } from '../src/sphere/module-group-fit.js';

const planet = buildPlanet(buildSphere({ n: 900, seed: 3, spacing: 40, relax: 30 }), { R: 4, L: 0.32 });
const { cells, H } = planet;

/** 取一个 n 格连通陆地足迹（确定性 BFS，按格序扫描；avoid 里的格跳过）。 */
function landFootprint(n, { minH = 1, start = 0, avoid = new Set() } = {}) {
  const seen = new Set();
  for (let s = start; s < cells.length; s++) {
    if (H[s] < minH || seen.has(s) || avoid.has(s)) continue;
    const g = [], q = [s], inq = new Set([s]);
    while (g.length < n && q.length) {
      const id = q.shift(); g.push(id);
      for (const o of cells[id].nb) if (o >= 0 && H[o] >= minH && !inq.has(o) && !avoid.has(o)) { inq.add(o); q.push(o); }
    }
    for (const id of g) seen.add(id);
    if (g.length === n) return g;
  }
  return null;
}
/** 找一对不同高度的相邻陆地格（跨台阶），用于 uneven-support 诊断。 */
function stepPair() {
  for (const c of cells) if (H[c.id] >= 2) for (const o of c.nb) if (o >= 0 && H[o] > 0 && H[o] !== H[c.id]) return [c.id, o];
  return null;
}

// ---- 干净声明：无冲突 -----------------------------------------------------------
test('干净声明：连通同高陆地组 ok，无拒绝原因', () => {
  const g1 = landFootprint(4, { minH: 2 });
  const g2 = landFootprint(3, { minH: 1, start: cells.length - 300, avoid: new Set(g1) });
  const rep = moduleConflictReport(planet, [g1, g2]);
  assert.equal(rep.ok, true);
  assert.equal(rep.overlaps.length, 0);
  for (const e of rep.groups) {
    assert.equal(e.size, e.cells.length);
    assert.deepEqual(e.pieces, [e.size]);
    assert.ok(e.farAng > 0 && e.farAng < 1.2);
    assert.ok(e.reasons.every((r) => r.severity !== 'reject'));
  }
});

// ---- 冲突检出：拒绝级 ------------------------------------------------------------
test('冲突检出：overlap / duplicate / invalid-cell / invalid-group / disconnected 全枚举', () => {
  const g1 = landFootprint(4);
  const g2 = landFootprint(3, { start: cells.length - 400, avoid: new Set(g1) });
  const overlapCell = g1[0];
  const farA = cells[0].id, farB = cells[cells.length - 1].id;   // 几乎对蹼 → 必不连通
  const rep = moduleConflictReport(planet, [
    g1,
    [overlapCell, g2[1]],                    // 与 g1 抢格（若不连通还会多一条 disconnected）
    [g2[0], g2[0]],                          // 组内重复
    [g2[2], cells.length + 5],               // 非法格 id
    'not-a-group',                           // 非法组
    [farA, farB],                            // 不连通
  ]);
  assert.equal(rep.ok, false);
  const codes = (gi) => rep.groups[gi].reasons.map((r) => r.code);
  assert.ok(codes(1).includes('overlap'));
  assert.ok(rep.overlaps.some((o) => o.cell === overlapCell && o.groups.includes(0) && o.groups.includes(1)));
  assert.ok(codes(2).includes('duplicate-cell'));
  assert.ok(codes(3).includes('invalid-cell'));
  assert.ok(codes(4).includes('invalid-group'));
  assert.ok(codes(5).includes('disconnected'));
  assert.ok(rep.groups[5].pieces.length >= 2);
  // 逐组全枚举，不是撞一个就停（拒绝级原因至少 5 条）
  assert.ok(rep.conflicts >= 5);
});

// ---- 诊断级：sea / uneven-support / assembly-cut ---------------------------------
test('诊断级原因：sea、uneven-support（partialLevels）为 warn 不拒', () => {
  const seaCell = cells.find((c) => H[c.id] === 0).id;
  const [hi, lo] = stepPair();
  const rep = moduleConflictReport(planet, [[seaCell], [hi, lo]]);
  const codes = (gi) => rep.groups[gi].reasons.map((r) => r.code);
  assert.ok(codes(0).includes('sea'));
  assert.ok(rep.groups[0].reasons.every((r) => r.severity === 'warn'));
  const un = rep.groups[1];
  assert.ok(codes(1).includes('uneven-support'));
  assert.ok(un.reasons.every((r) => r.severity === 'warn'));
  assert.equal(un.minH < un.maxH, true);
  // 跨台阶模块：高于较矮成员顶层的各层只剩部分格活动
  for (let l = un.minH + 1; l <= un.maxH; l++) assert.ok(un.partialLevels.includes(l), `partial level ${l}`);
  assert.equal(rep.ok, true);   // warn 不拒绝
});

test('装配切断：装配顺序里不连续的模块足迹 → assembly-cut 诊断', () => {
  const order = assemblyOrder(planet, { mode: 'frontier', seed: 7 });
  const gContig = order.slice(0, 4);                          // 顺序前四格 → 不切
  const gCut = [order[0], order[order.length - 1]];           // 顺序首尾 → 必切（也可能不连通，另记）
  const rep = moduleConflictReport(planet, [gContig, gCut], { order });
  const codes = (gi) => rep.groups[gi].reasons.map((r) => r.code);
  assert.ok(!codes(0).includes('assembly-cut'), 'contiguous prefix must not be flagged');
  const a0 = rep.groups[0].assembly, a1 = rep.groups[1].assembly;
  assert.equal(a0.span, a0.placed);
  assert.ok(codes(1).includes('assembly-cut'));
  assert.ok(a1.span > a1.placed, `span ${a1.span} > placed ${a1.placed}`);
});

// ---- unresolved 边界：组角距 >69°（farLimit=1.2 rad）记 unresolvable ---------------
test('unresolved 边界：超 farLimit 足迹 → reject unresolvable；拟合报告逐层 unresolved', () => {
  // 整球星足迹（全部格连通成一片，角距包络 ~π/2+ ≫ 1.2 rad ≈ 69°）——确定性超限
  const small = buildPlanet(buildSphere({ n: 60, seed: 5, spacing: 10, relax: 10 }), { R: 4, L: 0.32 });
  const wide = small.cells.map((c) => c.id);
  const rep = moduleConflictReport(small, [wide]);
  const e = rep.groups[0];
  assert.ok(e.farAng > 1.2, `widest land group farAng ${e.farAng} should exceed 1.2`);
  assert.equal(e.unresolvable, true);
  assert.ok(e.reasons.some((r) => r.code === 'unresolvable' && r.severity === 'reject'));
  assert.equal(rep.ok, false);
  // 与求解器同界：该组第 1 层联合拟合必 unresolved（海平面 farAng 超限 ⇒ 逐层不收）
  const prev = small.corners.map((d) => d.slice());
  const fit = fitModuleGroup(small, wide, prev, { level: 1 });
  assert.equal(fit.report.unresolved, true);
  assert.equal(fit.report.f, 1);
  // 边界另一侧：单格 farAng ≪ 1.2 → 不报
  const one = landFootprint(1);
  const rep1 = moduleConflictReport(planet, [one]);
  assert.equal(rep1.groups[0].unresolvable, false);
  assert.equal(rep1.ok, true);
  // farLimit 可调：收紧阈值同一足迹必报
  const repT = moduleConflictReport(small, [wide], { farLimit: 0.5 });
  assert.ok(repT.groups[0].unresolvable);
});

// ---- 消解：确定性修复 + 不伪造可行解 -----------------------------------------------
test('resolveModuleGroups：剪非法/重复/重叠 → 连通切分 → 消解后 report.ok', () => {
  const g1 = landFootprint(4);
  const g2 = landFootprint(3, { start: cells.length - 400, avoid: new Set(g1) });
  const farA = cells[0].id, farB = cells[cells.length - 1].id;
  const messy = [
    [...g1, g1[0], cells.length + 9],        // 重复 + 非法
    [g1[0], g2[0], g2[1]],                   // 与 g1 重叠 + 可能不连通
    [farA, farB],                            // 不连通 → 切分
    [],                                      // 空组 → 丢弃
  ];
  const res = resolveModuleGroups(planet, messy);
  assert.equal(res.report.ok, true, '消解后不应有拒绝级冲突');
  // 记账：每条修复都在 repairs 里
  const acts = res.repairs.map((r) => r.action + ':' + (r.reason || ''));
  assert.ok(acts.some((a) => a.includes('dedup')));
  assert.ok(acts.some((a) => a.includes('invalid-cell')));
  assert.ok(acts.some((a) => a.includes('overlap')));
  assert.ok(acts.some((a) => a.includes('split') || a.includes('dropped')));
  // 先到先得：g1[0] 留在第 0 组，不进入后续组
  assert.ok(res.groups[0].includes(g1[0]));
  assert.ok(res.groups.slice(1).every((p) => !p.includes(g1[0])));
  // 消解结果可直接进 cornerPositions solver:'joint'
  const at = cornerPositions(planet, { solver: 'joint', moduleGroups: res.groups, moduleCheck: true });
  assert.ok(typeof at === 'function');
  // 确定性：两次消解逐字一致
  const res2 = resolveModuleGroups(planet, messy);
  assert.deepEqual(res2.groups, res.groups);
  assert.deepEqual(res2.repairs, res.repairs);
});

test('unresolvable 组：消解只拒不拆——不伪造模块语义', () => {
  const small = buildPlanet(buildSphere({ n: 60, seed: 5, spacing: 10, relax: 10 }), { R: 4, L: 0.32 });
  const all = small.cells.map((c) => c.id);   // 整球星连通足迹 → farAng 超 1.2
  const res = resolveModuleGroups(small, [all]);
  const drop = res.repairs.filter((r) => r.action === 'dropped' && r.reason === 'unresolvable');
  assert.ok(drop.length >= 1, 'unresolvable piece must be dropped, not split silently');
  for (const d of drop) assert.ok(d.farAng > 1.2);
  // 被丢弃的格不进入消解结果（不把一个仍不可解的组塞回去）
  for (const d of drop) for (const id of d.cells) assert.ok(res.groups.every((p) => !p.includes(id)));
  assert.equal(res.report.ok, true);
});

// ---- cornerPositions 拒绝入口 moduleCheck ------------------------------------------
test('cornerPositions moduleCheck：拒绝级冲突 RangeError 枚举原因；warn 不拦', () => {
  const g1 = landFootprint(4);
  const farA = cells[0].id, farB = cells[cells.length - 1].id;
  // 不连通声明：默认不查（旧行为保持），moduleCheck 拒绝并列出原因码
  cornerPositions(planet, { solver: 'joint', moduleGroups: [[farA, farB]] });
  assert.throws(() => cornerPositions(planet, { solver: 'joint', moduleGroups: [[farA, farB]], moduleCheck: true }), /Module group conflicts.*disconnected/);
  // 干净组 + moduleCheck → 正常求解
  const at = cornerPositions(planet, { solver: 'joint', moduleGroups: [g1], moduleCheck: true });
  assert.ok(at(0, 1).every(Number.isFinite));
  // 重叠等硬校验依旧先抛（原有行为不变）
  assert.throws(() => cornerPositions(planet, { solver: 'joint', moduleGroups: [[g1[0]], [g1[0], g1[1]]], moduleCheck: true }), RangeError);
});

// ---- 不冒充原模块 ------------------------------------------------------------------
test('报告如实标注：多格冲突语义是本仓规则，原模块目标无出处（卡点·B）', () => {
  const rep = moduleConflictReport(planet, [landFootprint(2)]);
  assert.match(rep.note, /REACode/);
  assert.match(rep.note, /推断|inferred/i);
  assert.match(rep.note, /本仓|build\/multicell/);
  // 校验：输入类型错误先抛
  assert.throws(() => moduleConflictReport(planet, 'x'), TypeError);
  assert.throws(() => moduleConflictReport(planet, [[1]], { farLimit: 0 }), RangeError);
  assert.throws(() => moduleConflictReport(planet, [[1]], { order: ['a'] }), RangeError);
  assert.throws(() => resolveModuleGroups(planet, null), TypeError);
  console.log('PASS module-group-conflict');
});
