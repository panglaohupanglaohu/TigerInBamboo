// 第 53 批 G5 · 880853661936734211「Units got stuck when meeting in narrow passages. I fixed it by introducing left handed traffic」
// + 886199305522085890 / 795010582239997952。REACode/src/traffic.js 的 A/B 是一条直走廊；本文件在真实 Battle 上加三类压力：
//   L 形弯道 12 对 12（含 2 个大体型）、T 形三岔 10×3 三向对穿、直走廊 8 对 8；量全员到达时间、最大身体穿插、暂停不漂移；
//   再验体型重路由：身体直径塞不进的窄通口，大个子改走另一行，小个子照走。
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle, World } from './fixtures/g5-battle.mjs';
import { BattleNavigation } from '../src/world/battle-navigation.js';
const report = {};
function scenario(name, walk, groups, { big = false, seconds = 40 } = {}) {
  const S = stripWorld(7, 7); for (const [i, j] of walk) S.world.fill(S.at(i, j), 1, { rock: true });
  const view = makeView(S.world, S.index);
  const b = new Battle(view); b.start(S.world); b.nextWave = 1e9; b.units = []; b.squads = [];
  let uid = 0;
  groups.forEach(([from, to, n], gi) => {
    const squad = { id: gi, members: [], alive: true, goal: S.at(...to), goalFloor: 1 };
    for (let k = 0; k < n; k++) {
      const large = big && k < 2;
      const u = { uid: ++uid, team: 0, squad, k, hp: 3, max: 3, x: from[0] + (k % 3 - 1) * .12, z: from[1] + ((k / 3 | 0) - 1.5) * .1, y: .5, navFloor: 1, cd: 9, dead: false, onBoat: null, face: 0, soak: 0, radius: large ? .0825 : .055, bodyScale: large ? 1.5 : 1, stunRemaining: 0 };
      // 起点格外的人钳回起点格
      u.x = Math.max(from[0] - .4, Math.min(from[0] + .4, u.x)); u.z = Math.max(from[1] - .4, Math.min(from[1] + .4, u.z));
      squad.members.push(u); b.units.push(u);
    }
  });
  let t = 0, maxPen = 0, penFrames = 0;
  const arrived = () => b.units.every((u) => Math.hypot(u.x - u.squad.goal.cx, u.z - u.squad.goal.cz) < .45);
  for (; t < seconds * 30 && !arrived(); t++) {
    b.update(1 / 30);
    for (let i = 0; i < b.units.length; i++) for (let j = i + 1; j < b.units.length; j++) {
      const a = b.units[i], c = b.units[j];
      // 只量「路上」：两人都还没到自己目标格（到了以后是队形站位，与通行无关）
      if (Math.hypot(a.x - a.squad.goal.cx, a.z - a.squad.goal.cz) < .5 || Math.hypot(c.x - c.squad.goal.cx, c.z - c.squad.goal.cz) < .5) continue;
      const pen = (a.radius + c.radius - Math.hypot(a.x - c.x, a.z - c.z)) / (a.radius + c.radius);
      if (pen > maxPen) maxPen = pen; if (pen > .5) penFrames++;
    }
  }
  assert.ok(arrived(), `${name}: 全员到达（无死锁）`);
  // 暂停：位置一帧不动
  const before = b.units.map((u) => [u.x, u.z]); b.paused = true; for (let i = 0; i < 20; i++) b.update(1 / 30);
  assert.ok(b.units.every((u, i) => u.x === before[i][0] && u.z === before[i][1]), `${name}: 暂停不漂移`);
  // 全程没人走出地面（都在走廊格里）
  assert.ok(b.units.every((u) => { const c = S.index.cellAt(u.x, u.z); return c && S.world.top(c) === 1; }));
  report[name] = { seconds: +(t / 30).toFixed(1), units: b.units.length, maxPenetration: +maxPen.toFixed(2), deepFrames: penFrames };
  return report[name];
}
const L = []; for (let i = 0; i <= 3; i++) L.push([i, 3]); for (let j = 0; j < 3; j++) L.push([3, j]);
const T = []; for (let i = 0; i <= 6; i++) T.push([i, 3]); for (let j = 0; j < 3; j++) T.push([3, j]);
const I = []; for (let i = 0; i <= 6; i++) I.push([i, 3]);
const rl = scenario('L弯道12对12', L, [[[0, 3], [3, 0], 12], [[3, 0], [0, 3], 12]], { big: true });
const rt = scenario('T三岔10x3', T, [[[0, 3], [6, 3], 10], [[6, 3], [3, 0], 10], [[3, 0], [0, 3], 10]], { big: true });
const ri = scenario('直走廊8对8', I, [[[0, 3], [6, 3], 8], [[6, 3], [0, 3], 8]]);
// 软分离不是刚体：L 弯道拐角处最深穿插约 0.8 个半径和（实测，见 report），但深穿插（>0.5）只占极少的人对帧
for (const r of [rl, rt, ri]) assert.ok(r.maxPenetration < .9 && r.deepFrames < 100, '软分离：不完全叠在一起，深穿插很少 ' + JSON.stringify(r));

// 体型重路由：两行走廊，第 0 行 (1,0)|(2,0) 之间的竖边被捏到 0.25 宽
const S = stripWorld(5, 2); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
const pinch = S.at(1, 0).pts[1]; for (const c of [S.at(1, 0), S.at(2, 0)]) for (const p of c.pts) if (p.id === pinch.id) p.z = .25;
const inside = (c, x, z) => { let s = 0; for (let i = 0; i < c.n; i++) { const a = c.pts[i], q = c.pts[(i + 1) % c.n], k = (q.x - a.x) * (z - a.z) - (q.z - a.z) * (x - a.x); if (Math.abs(k) < 1e-12) continue; if (s && Math.sign(k) !== s) return false; s = Math.sign(k); } return true; };
const index = { cellAt: (x, z) => S.cells.find((c) => inside(c, x, z)) ?? null };
for (const c of S.cells) { c.cx = c.pts.reduce((a, p) => a + p.x, 0) / 4; c.cz = c.pts.reduce((a, p) => a + p.z, 0) / 4; }
const nav = new BattleNavigation(S.world, index);
const route = (r) => { const u = { x: S.at(0, 0).cx, z: S.at(0, 0).cz, y: .5, navFloor: 1, radius: r }, out = [0]; for (let k = 0; k < 20; k++) { const p = nav.plan(u, S.at(4, 0), 1); if (!p) return null; if (p.arrived) return out; u.x = p.next.cell.cx; u.z = p.next.cell.cz; out.push(p.next.cell.id); } return null; };
const small = route(.055), large = route(.15);
assert.ok(small.includes(S.at(2, 0).id) && !small.includes(S.at(1, 1).id), '小个子穿 0.25 宽的捏口');
assert.ok(!large.some((id, i) => id === S.at(2, 0).id && large[i - 1] === S.at(1, 0).id), '大个子（直径 0.3）不走捏口');
assert.ok(large.includes(S.at(1, 1).id) || large.includes(S.at(2, 1).id), '大个子绕第 1 行');
assert.equal(nav.trees.size, 2, '按体型分档缓存两棵树');
// 实际 Battle 里跑：大个子真的从第 1 行绕过去到达
const view = makeView(S.world, index); const b = new Battle(view); b.start(S.world); b.nextWave = 1e9; b.squads = [];
const sq = { id: 0, members: [], alive: true, goal: S.at(4, 0), goalFloor: 1 };
const g = { uid: 1, team: 0, squad: sq, k: 0, hp: 6, max: 6, x: S.at(0, 0).cx, z: S.at(0, 0).cz, y: .5, navFloor: 1, cd: 9, dead: false, onBoat: null, face: 0, soak: 0, radius: .15, bodyScale: 2.7, stunRemaining: 0 };
sq.members.push(g); b.units = [g]; let visitedRow1 = false;
for (let i = 0; i < 600 && Math.hypot(g.x - S.at(4, 0).cx, g.z - S.at(4, 0).cz) > .3; i++) { b.update(1 / 30); if (g.z > .5) visitedRow1 = true; }
assert.ok(Math.hypot(g.x - S.at(4, 0).cx, g.z - S.at(4, 0).cz) <= .3 && visitedRow1, '大个子实际绕行到达');
console.log('PASS 弯道/三岔/直走廊对穿全员到达、软分离穿插有界、暂停不漂移、体型重路由（规划+实际 Battle）', JSON.stringify({ ...report, small, large }));
