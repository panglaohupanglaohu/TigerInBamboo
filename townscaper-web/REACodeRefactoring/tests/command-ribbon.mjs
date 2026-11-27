// 第 53 批 G5 · REACode/src/navribbon.js（引用 827215002448846848 / 823848950553780226，两条均无配文：前者实为单位等级、后者为尘粒 AO，
// 本文件只迁 navribbon 的工程做法）：控制点 ≠ 航点——Catmull-Rom 中线按弧长等距重采样，相邻两点 + 半宽 = 首尾共享边的带状格子。
// 接在真实 Battle 的「选中小队 → 点地面」命令路径上：平滑不得把点拉出可站区域；点贴实际地面（含楼梯踏面）；带宽 = 格内到封闭边的净距。
import assert from 'node:assert/strict';
import { makeIsland, Battle } from './fixtures/g5-battle.mjs';
import { smoothRoutedPath, ribbonCells, samplePath } from '../src/core/path-samples.js';
// ① 纯几何：直线不变形；拒绝的样本退回折线；带状格子首尾共享两角
const line = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
assert.deepEqual(smoothRoutedPath(line, { perSeg: 4 }).map((p) => p.map((v) => +v.toFixed(12))).at(-1), [2, 0, 0]);
assert.ok(smoothRoutedPath(line, { perSeg: 4 }).every((p) => Math.abs(p[2]) < 1e-12));
const corner = [[0, 0, 0], [1, 0, 0], [1, 0, 1]];
const free = smoothRoutedPath(corner, { perSeg: 8 }), held = smoothRoutedPath(corner, { perSeg: 8, accept: () => false });
assert.ok(free.some((p) => p[0] > 1 + 1e-6 || p[2] < -1e-6), '无约束的 Catmull-Rom 会过冲');
assert.ok(held.every((p, i) => i === 0 || (p[0] <= 1 + 1e-12 && p[2] >= -1e-12)), '全部拒绝 = 原折线');
const cells = ribbonCells(samplePath(corner, { spacing: .1 }).points, { halfWidth: (p, i) => .1 + .01 * i });
for (let i = 0; i + 1 < cells.length; i++) { assert.deepEqual(cells[i].quad[1], cells[i + 1].quad[0]); assert.deepEqual(cells[i].quad[2], cells[i + 1].quad[3]); }
assert.throws(() => smoothRoutedPath([[0, 0, NaN]]));
// ② 真实 Battle：双网格，选中小队后点远处另一层的格子
const report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9; b.paused = true; b.update(0);
  const nav = b.navigation, sq = b.squads[0], lead = sq.members[0];
  const cx = sq.members.reduce((a, u) => a + u.x, 0) / 8, cz = sq.members.reduce((a, u) => a + u.z, 0) / 8, cy = sq.members.reduce((a, u) => a + u.y, 0) / 8;
  let best = null;
  for (const n of nav.graph.nodes) { if (n.floor !== world.top(n.cell)) continue; const p = nav.plan(lead, n.cell, n.floor); if (p && (!best || p.distance > best.d)) best = { n, d: p.distance }; }
  assert.equal(b.onPointer({ cell: view.index.cellAt(cx, cz), point: { x: cx, y: cy, z: cz } }), true);
  assert.equal(b.selected, sq, '选中');
  b.onPointer({ cell: best.n.cell, point: { x: best.n.cell.cx, y: best.n.floor * .5, z: best.n.cell.cz } });
  const s = b.commandPathSamples;
  assert.ok(s && s.cells && s.points.length > 20, '命令路径带状格子');
  for (let i = 1; i < s.distances.length - 1; i++) assert.ok(Math.abs(s.distances[i] - s.distances[i - 1] - .15) < 1e-9, '弧长等距 0.15');
  let onFloor = 0, treads = 0, offSurface = 0;
  for (const p of s.points) {
    const c = view.index.cellAt(p[0], p[2]); assert.ok(c, '每点在格内');
    const n = nav.graph.nodes[nav.graph.nearest(c, (p[1] - .05) / .5)];
    const h = nav.surfaceHeight(p[0], p[2], n);
    if (Math.abs(p[1] - .05 - h) < 1e-9) onFloor++;
    else if (Math.abs(p[1] - .05 - n.floor * .5) > 1e-9) offSurface++;
    // 真骑在踏面上的点：y 不在整层平面上（r255 起只允许在折线换层的那一段出现）
    if (Math.abs((p[1] - .05) / .5 - Math.round((p[1] - .05) / .5)) > .05) treads++;
  }
  assert.equal(offSurface, 0, '每点要么贴实际地面（含踏面）、要么钉在本层平面，不悬空');
  assert.ok(onFloor > 0, '仍有贴地样本');
  console.log(`  ${kind}: 贴地 ${onFloor}/${s.points.length}（其余钉本层平面）、骑踏面 ${treads}`);
  for (let i = 0; i + 1 < s.cells.length; i++) assert.deepEqual(s.cells[i].quad[1], s.cells[i + 1].quad[0], '首尾共享边');
  assert.ok(s.cells.every((c) => c.wA > 0 && c.wA <= .12 + 1e-9), '带宽 ≤ 0.12 且 > 0（贴封闭边时收窄）');
  // 平滑：拐角处比原折线转角小（同一条分层折线）
  const plan = nav.plan(lead, best.n.cell, best.n.floor), raw = [];
  for (let id = plan.from.id, k = 0; id >= 0 && k < 999; k++) { const a = nav.graph.nodes[id]; raw.push([a.x, a.floor * .5 + .05, a.z]); const nx = plan.tree.next[id]; if (nx < 0) break; id = nx; }
  const turn = (P) => { let m = 0; for (let i = 1; i + 1 < P.length; i++) { const a = Math.atan2(P[i][2] - P[i - 1][2], P[i][0] - P[i - 1][0]), c = Math.atan2(P[i + 1][2] - P[i][2], P[i + 1][0] - P[i][0]); let d = Math.abs(c - a); if (d > Math.PI) d = 2 * Math.PI - d; m = Math.max(m, d); } return m; };
  const rawTurn = turn(samplePath(raw, { spacing: .15 }).points), smoothTurn = turn(s.points);
  assert.ok(smoothTurn <= rawTurn + 1e-9, `平滑后单步最大转角不大于折线 ${smoothTurn.toFixed(2)} vs ${rawTurn.toFixed(2)}`);
  report[kind] = { samples: s.points.length, cells: s.cells.length, smoothed: s.smoothed, treads, rawTurn: +rawTurn.toFixed(2), smoothTurn: +smoothTurn.toFixed(2) };
}
console.log('PASS Catmull-Rom 约束平滑、弧长等距、贴地含踏面、带状格子共享边/按净距收窄、真实 Battle 双网格命令路径', JSON.stringify(report));
// ③ 带宽收窄：一条 1 格宽走廊（两侧是海），贴着封闭边的命令点半宽被净距卡住
{
  const { stripWorld } = await import('./fixtures/g5-battle.mjs');
  const { BattleNavigation } = await import('../src/world/battle-navigation.js');
  const S = stripWorld(6, 1); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  const nav = new BattleNavigation(S.world, S.index);
  const r = nav.commandRibbon([[0, .55, .4], [5, .55, .4]], { spacing: .25, halfWidth: .3 });
  assert.ok(r.cells.every((c) => Math.abs(c.wA - .1) < 1e-9), '贴 z=0.5 封闭边：半宽 = 净距 0.1');
  const mid = nav.commandRibbon([[0, .55, 0], [5, .55, 0]], { spacing: .25, halfWidth: .3 });
  assert.ok(mid.cells.every((c) => Math.abs(c.wA - .3) < 1e-9), '居中：不收窄');
  console.log('PASS 带宽按格内到封闭边净距收窄');
}
// ④ 同层穿洞：墙上挂着 1→3 的楼梯，路线在洞道里平走 → 命令线一律钉在洞道平面，不许被抬到墙顶
//    （r255 现场：mixed 网格洞里单位 y 恒 0.5，命令线被 surfaceHeight 的踏面分支抬到 1.217）
{
  const { stripWorld } = await import('./fixtures/g5-battle.mjs');
  const { BattleNavigation } = await import('../src/world/battle-navigation.js');
  const S = stripWorld(6, 1);
  for (const c of S.cells) { S.world.fill(c, 1, { rock: true }); if (c.cx === 2 || c.cx === 3) S.world.setSolid(c, 3, true, { rock: true }); }
  const nav = new BattleNavigation(S.world, S.index);
  const r = nav.commandRibbon([[0, .55, 0], [1, .55, 0], [4, .55, 0], [5, .55, 0]], { spacing: .1 });
  const ys = r.points.map((p) => p[1]);
  const tread = ys.filter((y) => Math.abs((y - .05) / .5 - Math.round((y - .05) / .5)) > .02).length;
  assert.ok(r.points.length > 20, '洞道命令线有点');
  assert.equal(tread, 0, `同层穿洞不得骑踏面（实测最高 ${Math.max(...ys).toFixed(3)}，洞道平面应 ${.55}）`);
  assert.ok(Math.max(...ys) < .56, '洞道命令线 maxY < 0.56');
  console.log(`PASS 同层穿洞命令线钉在洞道平面（${r.points.length} 点、maxY ${Math.max(...ys).toFixed(3)}、踏面 0）`);
}
// ⑤ 多点过渡（r256）：两段 rise=2 楼梯 + 中间隔一格平走。楼梯在**低格**里、楼层要到洞口才变，
//    所以固定 ±4 样本（0.6）的窗口盖不住整段楼梯进深（2·3·0.11=0.66）—— 靠里那头已经踩在踏面上却被钉回 floor*L，
//    命令线先贴地钻进楼梯再一步跳 rise·L（改前实测单步 0.833）。判据改为「只在几何命中踏面时把窗口放到整段楼梯进深」。
{
  const { stripWorld } = await import('./fixtures/g5-battle.mjs');
  const { BattleNavigation } = await import('../src/world/battle-navigation.js');
  const S = stripWorld(6, 1);
  // x: 0–1 = 1 层（y .5）｜2–3 = 3 层（y 1.5）｜4–5 = 5 层（y 2.5）：两段各 rise 2 的楼梯，中间 x=2→3 平走
  for (const c of S.cells) S.world.fill(c, c.cx <= 1 ? 1 : c.cx <= 3 ? 3 : 5, { rock: true });
  const nav = new BattleNavigation(S.world, S.index);
  nav.refresh();
  assert.equal(nav.stairs.length, 2, '两段楼梯');
  assert.deepEqual(nav.stairs.map((s) => [s.low.cx, s.high.cx, s.rise]).sort((a, b) => a[0] - b[0]), [[1, 2, 2], [3, 4, 2]], '楼梯都在低格里、rise 均为 2');
  const r = nav.commandRibbon([[0, .55, 0], [1, .55, 0], [2, 1.55, 0], [3, 1.55, 0], [4, 2.55, 0], [5, 2.55, 0]], { spacing: .1 });
  assert.ok(r.points.length > 40, '命令线有点');
  const TREAD = 2 * .5 / (2 * 3);            // 一级踏面 = rise·L / (rise·3) = 0.1667
  const rows = r.points.map((p, i) => {
    const c = S.index.cellAt(p[0], p[2]); assert.ok(c, '每点在格内');
    const n = nav.graph.nodes[nav.graph.nearest(c, (p[1] - .05) / .5)];
    const surf = n ? nav.surfaceHeight(p[0], p[2], n) : null;
    return { i, x: p[0], y: p[1], floor: n?.floor ?? null, surf };
  });
  // ① 逐点对照真实地面：踩在踏面上就必须贴那一级踏面（不许沉到层平面），没踩踏面就必须钉本层平面
  let treads = 0, flat = 0;
  for (const q of rows) {
    assert.ok(q.floor != null, '每点都有节点');
    const onStair = Math.abs(q.surf - q.floor * .5) > 1e-9;
    const want = (onStair ? q.surf : q.floor * .5) + .05;
    assert.ok(Math.abs(q.y - want) < 1e-9, `f${q.i} x=${q.x.toFixed(2)} y=${q.y.toFixed(3)} 应 ${want.toFixed(3)}（踏面 ${q.surf.toFixed(3)} / 层 ${q.floor * .5}）`);
    if (onStair) treads++; else flat++;
  }
  // ② 不许出现「钻进楼梯再跳上顶」：相邻样本落差 ≤ 一级踏面
  let maxStep = 0, at = -1;
  for (let i = 1; i < rows.length; i++) { const d = Math.abs(rows[i].y - rows[i - 1].y); if (d > maxStep) { maxStep = d; at = i; } }
  assert.ok(maxStep <= TREAD + 1e-9, `相邻样本落差 ${maxStep.toFixed(3)} ≤ 一级踏面 ${TREAD.toFixed(3)}（改前 0.833，断在 x=${rows[at]?.x.toFixed(2)}）`);
  // ③ 两段爬升各有踏面样本；中间平走（x 1.65–2.75）一个踏面都不许有
  const firstRun = rows.filter((q) => q.x < 1.6 && Math.abs(q.surf - q.floor * .5) > 1e-9).length;
  const secondRun = rows.filter((q) => q.x > 2.8 && q.x < 3.6 && Math.abs(q.surf - q.floor * .5) > 1e-9).length;
  const midFlat = rows.filter((q) => q.x > 1.65 && q.x < 2.75);
  assert.ok(firstRun >= 3 && secondRun >= 3, `两段爬升都要骑踏面（${firstRun} / ${secondRun}）`);
  assert.ok(midFlat.length >= 8, '中间平走有足够样本');
  assert.ok(midFlat.every((q) => Math.abs(q.y - 1.55) < 1e-9), `中间平走一律钉 1.55（实测 ${[...new Set(midFlat.map((q) => q.y.toFixed(3)))]}），不许被判成换层`);
  assert.ok(midFlat.every((q) => Math.abs(q.surf - q.floor * .5) < 1e-9), '中间平走几何上确实不在踏面上');
  console.log(`PASS 多点过渡（两段楼梯 + 中间平走）：${rows.length} 点、骑踏面 ${treads}、钉层 ${flat}、单步最大 ${maxStep.toFixed(3)}、平走 ${midFlat.length} 点全钉 1.55`);
}
