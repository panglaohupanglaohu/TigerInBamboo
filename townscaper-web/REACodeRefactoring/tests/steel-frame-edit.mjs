// r204 · 1189902695303458816「钢架编辑」残差收口：编辑/移除楼层 → 长钢柱+横梁/斜撑显露的判定与整组事务。
// ① job 收集与 buildings.js underside 同口径（含拱排除）；② planSteelReveal 纯预览逐条给
// 显露/隐藏清单（reveal/hide/mixed/none + 按类计数）；③ commitSteelReveal 走 commitModulePatch
// fit 事务（socket/WFC/stale-version）+ 原子楼层写，withdrawModulePatch 整组撤回；
// ④ frameCollisions 碰撞清单口径：杆件不穿实心体素、不压可走面；⑤ 确定性。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { steelScene } = await import('../src/build/scenes-r56.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World, MAX_LEVEL } = await import('../src/core/world.js');
const { cornerVariantTiles } = await import('../src/core/wfc.js');
const { collectSteelJobs, steelFramePlan, planSteelReveal, planDiff, commitSteelReveal, withdrawSteelReveal, frameCollisions, normalizeSteelEdits } = await import('../src/build/steel-frame-edit.js');

const quadGrid = () => decorateCells(buildQuadGrid({ radius: 8, seed: 5 }));
const mixedGrid = () => decorateCells(buildMixedGrid({ radius: 10, seed: 3 }));
const catalog = () => { const t = []; for (let n = 3; n <= 8; n++) t.push(...cornerVariantTiles(n, 3)); return t; };
const snap = (w) => JSON.stringify(w.snapshot());
const interior = (w, n = 4) => w.cells.find((c) => c.n === n && c.edgeNeighbors.every((id) => id >= 0));
const keys = (p) => [...p.segments.map(SEG => SEG.a.join(',') + '>' + SEG.b.join(',')), ...p.boxes.map(b => b.p.join(','))].sort();

/* ---- 1. job 收集与渲染管线同口径 + 拱排除 ---------------------------------- */
{
  let checked = 0;
  for (const kind of ['quad', 'mixed']) for (const scene of ['town', 'fusion', 'steel']) {
    const w = F.world(kind, scene === 'steel' ? 'town' : scene, 7);
    if (scene === 'steel') steelScene(w);
    const jobs = collectSteelJobs(w);
    const { r } = F.build(w, { steelFrame: true });
    assert.equal(r.steel.blocks, jobs.length, `${kind}/${scene} 计划 job 数 = 管线钢架块数`);
    for (const { c, lv } of jobs) {
      assert.ok(world_isBuilt(w, c, lv) && !w.isSolid(c, lv - 1) && lv > 1, 'job 是 runBottom 建筑层');
      const arch = c.n === 4 && [0, 1].some((i) => { const a = w.neighbor(c, i), b = w.neighbor(c, i + 2); return a && b && w.isSolid(a, lv - 1) && w.isSolid(b, lv - 1); });
      assert.ok(!arch, '拱段不入钢架 job');
    }
    checked++;
  }
  function world_isBuilt(w, c, lv) { return w.isBuilt(c, lv); }
  // 拱排除的构造验证：方格悬空层、两条对边邻居在下层都实心 → 不收集
  const w = new World(quadGrid()); const c = interior(w);
  const a = w.neighbor(c, 0), b = w.neighbor(c, 2);
  w.setSolid(a, 2, true); w.setSolid(b, 2, true); w.setSolid(c, 3, true);
  assert.ok(!collectSteelJobs(w).some((j) => j.c.id === c.id && j.lv === 3), '对边支撑 → 拱，不入钢架');
  w.setSolid(b, 2, false);
  assert.ok(collectSteelJobs(w).some((j) => j.c.id === c.id && j.lv === 3), '撤一边支撑 → 悬空 → 入钢架');
  console.log('T1 jobs 同口径 + 拱排除 PASS', { checked });
}

/* ---- 2. 移除楼层 → 显露；补回 → 藏（原片 f22 行为） ------------------------ */
{
  const w = new World(quadGrid()); const c = interior(w);
  w.fill(c, 1); for (let lv = 2; lv <= 8; lv++) w.setSolid(c, lv, true);
  const r = planSteelReveal(w, [
    { cell: c, level: [2, 3, 4, 5], on: false, label: 'remove-l2-5' },
    { cell: c, level: [2, 3, 4, 5], on: true, label: 'fill-back' },
  ]);
  assert.ok(r.ok);
  assert.equal(r.before.segments.length, 0, '落地楼无钢架');
  const s1 = r.steps[0];
  assert.equal(s1.kind, 'reveal', '移除下层 → 纯显露');
  assert.equal(s1.revealedByKind.column, 4, '方格四根承重角柱');
  assert.ok(s1.revealedByKind.beam >= 4 && s1.revealedByKind.brace > 0, '头梁 + 斜撑');
  assert.ok(s1.revealedByKind.tie >= 1 && s1.revealedByKind.joint >= 1, '系杆层 + 接头');
  const mid = planSteelReveal(w, [{ cell: c, level: [2, 3, 4, 5], on: false }]).after;
  assert.ok(mid.stats.ties >= 1 && mid.stats.joints >= mid.stats.ties, '系杆层 + 接头统计');
  assert.ok(mid.stats.ladders >= 1, '落码头且开间高 → 柱间竖梯');
  for (const leg of mid.legs) { assert.equal(leg.landLevel, 1, '柱落码头面'); assert.ok(leg.flat); }
  const s2 = r.steps[1];
  assert.equal(s2.kind, 'hide', '补回楼板 → 骨架整组藏');
  assert.deepEqual(s2.hidden.sort(), s1.revealed.slice().sort(), '藏的=上一轮露的那组');
  assert.equal(r.revealed.length + r.hidden.length, 0, '净差为零（全藏回）');
  const back = planDiff(r.before, r.after); // r.after = 全步后（已补回）
  assert.equal(back.revealed.length + back.hidden.length, 0, '补回后与编辑前逐杆件一致');
  console.log('T2 移除/补回 显露·藏 PASS', { revealed: s1.revealed.length, ties: mid.stats.ties });
}

/* ---- 3. 抬高复合步（原片 f0–21 抬高绿屋）→ 长腿 + 系杆 + 爬梯 ------------- */
{
  const w = new World(quadGrid()); const c = interior(w);
  w.fill(c, 1); for (let lv = 2; lv <= 5; lv++) w.setSolid(c, lv, true);
  const r = planSteelReveal(w, [{ label: 'raise', ops: [
    { cell: c, level: [2, 3, 4, 5], on: false },
    { cell: c, level: [6, 7, 8, 9], on: true },
  ] }]);
  const s = r.steps[0];
  assert.equal(s.kind, 'reveal');
  assert.equal(s.revealedByKind.column, 4, '四根长钢柱');
  assert.ok(r.after.stats.ties >= 1, '跨度≥4层 → 约束求解出系杆层');
  assert.ok(r.after.stats.ladders >= 1, '落码头且开间≥3层 → 柱间竖梯');
  for (const c of r.after.clusters) assert.ok(!c.unsat, '系杆约束有解');
  console.log('T3 抬高复合步 PASS', { ties: r.after.stats.ties, ladders: r.after.stats.ladders });
}

/* ---- 4. 「哪些编辑动作露骨架」分类：无操作/不悬空的编辑 = none ------------ */
{
  const w = new World(quadGrid()); const c = interior(w);
  w.fill(c, 1); for (let lv = 2; lv <= 5; lv++) w.setSolid(c, lv, true);
  const r = planSteelReveal(w, [
    { cell: c, level: 5, on: false, label: 'remove-top' },      // 拆顶层：不悬空 → none
    { cell: c, level: 4, on: true, label: 'no-op-add' },        // 重复置位 → none
    { cell: c, level: 2, on: false, label: 'remove-l2' },       // 抽底层 → reveal
  ]);
  assert.equal(r.steps[0].kind, 'none', '拆顶层不造悬空');
  assert.equal(r.steps[1].kind, 'none', '重复置位无变化');
  assert.equal(r.steps[2].kind, 'reveal', '抽底层 → 悬空 → 显露');
  assert.ok(r.steps[2].revealedByKind.column === 4, '四腿');
  console.log('T4 编辑动作分类 PASS');
}

/* ---- 5. 确定性：同输入同输出 --------------------------------------------- */
{
  const w = new World(quadGrid()); const c = interior(w);
  w.fill(c, 1); for (let lv = 2; lv <= 5; lv++) w.setSolid(c, lv, true);
  const edits = [{ cell: c, level: [2, 3], on: false }];
  const a = planSteelReveal(w, edits), b = planSteelReveal(w, edits);
  assert.deepEqual(a.steps.map((s) => [s.kind, s.revealed, s.hidden]), b.steps.map((s) => [s.kind, s.revealed, s.hidden]), '揭示 diff 确定');
  assert.deepEqual(keys(steelFramePlan(w)), keys(steelFramePlan(w)), '计划键确定');
  console.log('T5 确定性 PASS');
}

/* ---- 6. 碰撞清单口径：钢架不穿实心、不压可走面 ---------------------------- */
{
  let total = 0;
  for (const kind of ['quad', 'mixed']) {
    const w = F.world(kind, 'town', 7); steelScene(w);
    const plan = steelFramePlan(w); total += plan.segments.length;
    assert.ok(plan.segments.length > 0, kind + ' 有钢架杆件');
    const hits = frameCollisions(w, plan);
    assert.deepEqual(hits, [], kind + ' 杆件不穿实心体素、不压可走面');
  }
  // 负例：人造一根穿实心列的杆件 → 命中且报可走面口径
  const w = new World(quadGrid()); const c = interior(w);
  w.fill(c, 3, { rock: true });
  const bad = { segments: [{ kind: 'column', a: [c.cx, 0.2, c.cz], b: [c.cx, 2.2, c.cz], r: 0.045 }], boxes: [] };
  const hits = frameCollisions(w, bad);
  assert.ok(hits.length >= 2, '穿三层岩柱应逐层命中');
  assert.ok(hits.every((h) => h.walkable === true && h.cell === c.id), '顶面岩石 → walkable 标记');
  const d = interior(w, 4);
  w.fill(d, 2);                                    // 建筑顶（非岩石）→ 不走面
  const bad2 = { segments: [{ kind: 'column', a: [d.cx, 0.2, d.cz], b: [d.cx, 0.9, d.cz], r: 0.045 }], boxes: [] };
  assert.ok(frameCollisions(w, bad2).every((h) => h.walkable === false), '建筑顶 → 非可走面');
  console.log('T6 碰撞审计 PASS', { segments: total, plantedHits: hits.length });
}

/* ---- 7. commitSteelReveal 整组事务 + 撤回 ---------------------------------- */
{
  const w = new World(quadGrid());
  for (const c of w.cells) if (Math.hypot(c.cx, c.cz) < 4.5) w.fill(c, 1);
  const c = w.cells.find((x) => x.n === 4 && x.edgeNeighbors.every((id) => id >= 0) && Math.hypot(x.cx, x.cz) < 3);
  for (let lv = 2; lv <= 7; lv++) w.setSolid(c, lv, true);
  const before = snap(w), v0 = w.version;
  const edits = [{ cell: c, level: [2, 3, 4, 5], on: false }];
  const r = commitSteelReveal(w, edits, { tiles: catalog(), socket: () => 0, seed: 5 });
  assert.ok(r.ok, 'commit: ' + r.reason);
  assert.equal(r.commit.mode, 'fit');
  assert.equal(r.commit.boundary.length, c.n, '被编辑足迹每条外边一条 socket');
  assert.ok(r.commit.boundary.every((b) => b.socket === 0), 'socket 声明透传');
  assert.ok(!w.isSolid(c, 2) && !w.isSolid(c, 5) && w.isSolid(c, 6), '楼层位写已落');
  assert.equal(r.reveal.revealedByKind.column, 4, '事务显露四根钢柱');
  assert.ok(r.reveal.revealedByKind.beam >= 4 && r.reveal.revealedByKind.tie >= 1, '横梁 + 系杆');
  const frameNow = keys(steelFramePlan(w));
  const back = withdrawSteelReveal(w, r.receipt);
  assert.ok(back.ok);
  assert.equal(snap(w), before, '撤回后体素快照逐字节复原');
  assert.equal(steelFramePlan(w).segments.length, 0, '钢架随体素藏回');
  assert.equal(w.version, v0 + 3, 'version = commit + 楼层写 + restore');
  // 失败路径：stale-version / WFC 矛盾 / 非法编辑 → World 原样
  assert.equal(commitSteelReveal(w, edits, { tiles: catalog(), expectedVersion: -1 }).reason, 'stale-version');
  const bad = commitSteelReveal(w, edits, { tiles: catalog(), socket: () => 9, seed: 3 });
  assert.equal(bad.ok, false); assert.equal(bad.reason, 'wfc-contradiction');
  assert.equal(commitSteelReveal(w, [{ cell: c, level: 99, on: false }], { tiles: catalog() }).reason, 'edit');
  assert.equal(commitSteelReveal(w, [], { tiles: catalog() }).reason, 'edits');
  assert.equal(snap(w), before, '失败路径不写 World');
  // 混合网格（含三角格）同过事务层
  const wm = new World(mixedGrid());
  for (const cc of wm.cells) if (Math.hypot(cc.cx, cc.cz) < 4) wm.fill(cc, 1);
  const cm = wm.cells.find((x) => x.edgeNeighbors.every((id) => id >= 0) && Math.hypot(x.cx, x.cz) < 3);
  for (let lv = 2; lv <= 4; lv++) wm.setSolid(cm, lv, true);
  const rm = commitSteelReveal(wm, [{ cell: cm, level: 2, on: false }], { tiles: catalog(), socket: () => 0, seed: 7 });
  assert.ok(rm.ok, 'mixed commit: ' + rm.reason);
  assert.ok(rm.reveal.revealedByKind.column >= 3, '三角/多边形格同样显露承重柱');
  assert.ok(withdrawSteelReveal(wm, rm.receipt).ok);
  assert.ok(wm.isSolid(cm, 2), 'mixed 撤回复原');
  console.log('T7 事务 + 撤回 + 失败路径 PASS');
}

/* ---- 8. 计划 ≡ 渲染产出：stats 与 buildBuildings 的 emitSteelFrame 同数 ----- */
{
  for (const kind of ['quad', 'mixed']) {
    const w = F.world(kind, 'town', 7); steelScene(w);
    const { r } = F.build(w, { steelFrame: true });
    const plan = steelFramePlan(w);
    assert.equal(plan.stats.columns, r.steel.legs.length);
    assert.equal(plan.stats.ties, r.steel.ties);
    assert.equal(plan.stats.cranks, r.steel.cranks);
    assert.equal(plan.stats.ladders, r.steel.ladders.length);
    assert.equal(plan.jobs.length, r.steel.blocks);
  }
  console.log('T8 计划≡渲染统计 PASS');
}
console.log('PASS steel-frame-edit：job 同口径/拱排除、移除→显露→补回→藏、抬高复合步、动作分类、确定性、碰撞审计、fit 事务+撤回、计划≡渲染');
