// 第 53 批 G5 · 828984794407170048（PRO TIP: Protect your real estate investments…；画面：一列人沿台阶一级级爬上去、每人贴着自己那一级）
// + 890611046435627008（两拨人分站上下两层台面）。对照 REACode/src/unitsnap.js：逐人取脚下台面，measure = 悬空/埋入/层数/相邻落差。
// 本轮补：楼梯踏面高度（与 navlayer 渲染的台阶同参数）进 BattleNavigation.footHeight，Battle 逐帧往它缓动；换层时对准楼梯中线。
import assert from 'node:assert/strict';
import { makeIsland, Battle } from './fixtures/g5-battle.mjs';
import { STAIR_STEP_DEPTH } from '../src/world/battle-navigation.js';
import { easeUnitToHeight } from '../src/core/unit-ground-height.js';
const L = .5, report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const nav = b.navigation; nav.refresh();
  assert.ok(nav.stairs.length > 0, '岛上有楼梯');
  // ① 踏面几何：从墙脚往低格中心，一级比一级低；超出宽度或进深就是平地
  const s = nav.stairs.find((t) => (t.rise || 1) === 1 && world.top(t.low) === nav.graph.nodes[nav.graph.at(t.low, world.top(t.low))]?.floor);
  const st = nav.stairBetween(s.low, s.high), low = nav.graph.nodes[nav.graph.at(s.low, world.top(s.low))];
  const toward = { x: s.low.cx - st.mid.x, z: s.low.cz - st.mid.z }, tl = Math.hypot(toward.x, toward.z);
  // 沿墙法线（不一定指向格心）取样：用 surfaceHeight 自己的方向——在中线前方逐步后退
  const ys = [];
  for (let d = .02; d < .5; d += .03) { const x = st.mid.x + toward.x / tl * d, z = st.mid.z + toward.z / tl * d; ys.push(nav.surfaceHeight(x, z, low)); }
  assert.ok(ys[0] > low.floor * L + .5 * (s.rise || 1) * L, '贴墙那一级接近上层');
  assert.ok(ys.every((y, i) => i === 0 || y <= ys[i - 1] + 1e-12), '离墙越远越低（单调）');
  assert.equal(ys.at(-1), low.floor * L, '出了楼梯进深就是本层地面');
  assert.ok(new Set(ys.map((y) => y.toFixed(4))).size >= 3, '至少三级不同踏面');
  // ② 实际 Battle：三队都派到另一层的远处，逐帧看脚高
  for (const sq of b.squads) {
    const lead = sq.members[0], here = nav.unitNode(lead); let best = null;
    for (const n of nav.graph.nodes) { if (n.floor === here.floor || n.floor !== world.top(n.cell)) continue; const p = nav.plan(lead, n.cell, n.floor); if (p && (!best || p.distance > best.d)) best = { n, d: p.distance }; }
    sq.goal = best.n.cell; sq.goalFloor = best.n.floor;
  }
  let treads = 0, maxStep = 0, maxErr = 0; const prevY = new Map();
  for (let i = 0; i < 900; i++) {
    b.update(1 / 30);
    for (const sq of b.squads) for (const u of sq.members) {
      if (u.dead || u.fall) continue;
      const fh = nav.footHeight(u); if (Math.abs(fh / L - Math.round(fh / L)) > .05) treads++;
      if (prevY.has(u)) maxStep = Math.max(maxStep, Math.abs(u.y - prevY.get(u)));
      prevY.set(u, u.y); maxErr = Math.max(maxErr, Math.abs(u.y - fh));
    }
  }
  assert.ok(treads > 10, `${kind}: 有人踩在楼梯踏面上（${treads} 人帧）`);
  assert.ok(maxStep < L * .6, `${kind}: 单帧高度变化 ${maxStep.toFixed(3)} 远小于跨越的层高（逐级缓动上楼，不是整层瞬移；2 级台阶的无楼梯崖口仍按指数缓动）`);
  // ③ 停下后逐人贴地：悬空 / 埋入 = 0
  b.paused = true; for (let i = 0; i < 30; i++) { b.paused = false; b.update(1 / 30); }
  for (const sq of b.squads) sq.goal = null;   // 原地站住：Battle 里 goal 为空就不走
  for (let i = 0; i < 60; i++) b.update(1 / 30);
  const m = nav.measureFooting(b.squads.flatMap((q) => q.members));
  assert.equal(m.floating, 0, `${kind}: 无悬空 ${JSON.stringify(m)}`); assert.equal(m.buried, 0, `${kind}: 无埋入`);
  // ④ unitsnap 的 A/B：一队跨楼梯两侧（4 人低格 / 4 人高格）。逐人 = 0 误差；整队用平均高度 = 全员悬空或埋入
  const sq = b.squads[0], hi = nav.graph.nodes[nav.graph.at(s.high, world.top(s.high))];
  sq.members.forEach((u, i) => { const n = i < 4 ? low : hi; Object.assign(u, { x: n.cell.cx + (i % 2) * .05, z: n.cell.cz, navFloor: n.floor, dead: false, fall: null, onBoat: null }); u.y = nav.footHeight(u); });
  const per = nav.measureFooting(sq.members), mean = sq.members.reduce((a, u) => a + u.y, 0) / 8;
  const flat = nav.measureFooting(sq.members.map((u) => ({ ...u, y: mean })));
  assert.ok(per.floating === 0 && per.buried === 0 && per.levels === 2 && per.maxGap > 0);
  assert.ok(flat.floating + flat.buried === 8, `整队平均高度：8 人全不贴地 ${JSON.stringify(flat)}`);
  report[kind] = { stairs: nav.stairs.length, treads, maxStep: +maxStep.toFixed(3), settled: m, flat };
}
// ⑤ 缓动可组合：30/60/120Hz 走完 0.5s 同一结果
const run = (hz) => { let y = 0; for (let i = 0; i < hz / 2; i++) y = easeUnitToHeight(y, .5 + STAIR_STEP_DEPTH, 1 / hz); return y; };
assert.ok(Math.abs(run(30) - run(120)) < 1e-12 && Math.abs(run(60) - run(120)) < 1e-12);
assert.throws(() => easeUnitToHeight(0, NaN, .1));
console.log('PASS 楼梯踏面单调逐级、实际 Battle 逐人上下楼梯无整层瞬移、停下后无悬空/埋入、整队平均高度 A/B、缓动跨帧率一致', JSON.stringify(report));
