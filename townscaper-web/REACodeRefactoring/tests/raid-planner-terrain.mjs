// 第 53 批 G5 · 974325184525201409「We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefully) by making our
// own box-box test in two incredibly stressful hours. Behold, our beautiful viking raid planner」。对照 REACode/src/boxtest.js：
// ① 穿透深度 + 俯视二维 SAT 与「裁剪求交面积」真值逐对一致（随机 2 万对，贴边不算相交）；② 规划器：航道不得压礁石/别处陆地，
// 正对岸被挡时试 ±0.35 rad 车道；③ 真实岛双网格连续多波：航道全程不压陆地、泊位/航道两两不相交。
import assert from 'node:assert/strict';
import { makeIsland, Battle, stripWorld } from './fixtures/g5-battle.mjs';
import { makeBox, obbOverlap, obbPenetration, obbFootprintXZ, convexOverlapXZ, convexDepthXZ, clipAreaXZ } from '../src/core/obb.js';
import { planLanding, seawayBox, berthBox, approachBox, seawayBlocked } from '../src/badnorth/landing-plan.js';
// ① 随机长条盒（原片量的长宽比 ~7）：SAT（3D 偏航盒与 2D 占地）⇔ 裁剪面积 > 0
let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
let mismatch = 0, grazing = 0, hits = 0;
for (let i = 0; i < 20000; i++) {
  const mk = (cx, cz) => makeBox([cx, 0, cz], [.28 + rnd() * .4, .2, .04 + rnd() * .12], [0, rnd() * Math.PI * 2, 0]);
  const A = mk(rnd() * 8, rnd() * 8), B = mk(A.c[0] + (rnd() - .5) * 1.6, A.c[2] + (rnd() - .5) * 1.6);
  const PA = obbFootprintXZ(A), PB = obbFootprintXZ(B), area = clipAreaXZ(PA, PB), d2 = convexDepthXZ(PA, PB), d3 = obbPenetration(A, B);
  const truth = area > 1e-6, sat = d2 > 1e-6;
  if (truth) hits++;
  if (sat !== truth) { if (Math.abs(d2) < 1e-3 && area < 1e-4) grazing++; else mismatch++; }
  // 3D 穿透（SAT 半径和 - 中心距）与 2D 区间重叠长度定义不同，只要求同号
  if (Math.abs(d2) > 1e-6) assert.equal(d3 > 0, d2 > 0, '3D 穿透深度与俯视判定同号（盒同高同厚）');
  assert.equal(obbOverlap(A, B, { touching: false }), d3 > 0);
}
assert.equal(mismatch, 0, `SAT 与裁剪面积逐对一致（擦边 ${grazing}）`); assert.ok(hits > 2000);
const touch = [makeBox([0, 0, 0], [1, .2, .1]), makeBox([2, 0, 0], [1, .2, .1])];
assert.ok(Math.abs(obbPenetration(...touch)) < 1e-12 && !convexOverlapXZ(obbFootprintXZ(touch[0]), obbFootprintXZ(touch[1])), '贴边：深度 0、不算相交');
assert.throws(() => obbFootprintXZ(makeBox([0, 0, 0], [1, 1, 1], [.3, 0, 0])), '非偏航盒没有俯视矩形');
// ② 手工地形：海里一排礁石正挡在正对岸的航道上 → 换 ±0.35 rad 车道
const S = stripWorld(20, 9);
const land = S.at(2, 4); S.world.fill(land, 1, { rock: true });
for (const [i, j] of [[8, 4], [12, 4], [16, 4], [9, 4]]) S.world.fill(S.at(i, j), 1, { rock: true });   // 正东方向的礁石
const plan = planLanding(S.world, [], { random: () => 0 });
assert.ok(plan && plan.land === land, '找到登陆点');
assert.ok(!seawayBlocked(S.world, plan.stop, plan.dir, { except: [land] }), '航道不压礁石');
const straight = planLanding(S.world, [], { random: () => 0, terrain: false });
assert.ok(straight.dir[0] > .99 || Math.abs(straight.dir[1]) > .99, '不看地形时选正对岸方向');
const east = [[1, 0], [0, 1], [0, -1], [-1, 0]].map((d) => seawayBlocked(S.world, [S.at(3, 4).cx + d[0] * .25, S.at(3, 4).cz + d[1] * .25], d, { except: [land] }));
assert.equal(east[0], true, '正东航道被礁石挡住');
// ③ 真实岛：双网格连续 6 波，所有航道不压陆地，泊位/航道两两不相交
const report = {};
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11]) {
  const { world, view } = makeIsland(kind, seed);
  const boats = []; let lanes = 0, blockedByTerrain = 0;
  for (let k = 0; k < 6; k++) {
    const p = planLanding(world, boats, { random: () => (k * .37) % 1 }); if (!p) break;
    if (p.lane) lanes++;
    assert.ok(!seawayBlocked(world, p.stop, p.dir, { except: [p.land] }));
    boats.push({ stop: p.stop, dir: p.dir, land: p.land });
  }
  for (let i = 0; i < boats.length; i++) for (let j = i + 1; j < boats.length; j++) {
    assert.equal(obbOverlap(berthBox(boats[i].stop, boats[i].dir), berthBox(boats[j].stop, boats[j].dir)), false);
    assert.equal(obbOverlap(approachBox(boats[i].stop, boats[i].dir), approachBox(boats[j].stop, boats[j].dir)), false);
  }
  // 对照：不看地形时有没有航道压陆地的方案
  const naive = []; for (let k = 0; k < 6; k++) { const p = planLanding(world, naive, { random: () => (k * .37) % 1, terrain: false }); if (!p) break; if (seawayBlocked(world, p.stop, p.dir, { except: [p.land] })) blockedByTerrain++; naive.push({ stop: p.stop, dir: p.dir }); }
  report[`${kind}${seed}`] = { boats: boats.length, rotatedLanes: lanes, naiveThroughLand: blockedByTerrain };
  assert.ok(boats.length >= 3, `${kind}/${seed}: 至少排下 3 条船`);
}
assert.ok(Object.values(report).some((r) => r.naiveThroughLand > 0), '真实岛上确实存在会穿陆地的直线航道（地形检测不是摆设）');
// ④ 真实 Battle：一局里连续来船，planLanding 结果都经过地形检测
{ const { world, view } = makeIsland('quad', 7); const b = new Battle(view); b.start(world); b.nextWave = 0;
  for (let i = 0; i < 6; i++) { b.update(1 / 30); b.nextWave = b.t; }
  assert.ok(b.boats.length >= 2 && b.boats.every((bt) => !seawayBlocked(world, bt.stop, bt.dir, { except: [bt.land] }))); report.battleBoats = b.boats.length; }
console.log('PASS 2 万对 SAT⇔裁剪面积、穿透深度、贴边、礁石挡道换车道、真实岛双网格多船航道不压陆地且两两不交、真实 Battle', JSON.stringify({ grazing, hits, report }));
