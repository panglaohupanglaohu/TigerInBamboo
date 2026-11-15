// 第 53 批 G5 · 883447205176238083「A dynamic node graph help the fellas keep track of their mates and share local info.
// Makes for somewhat more cohesive groups」。对照 REACode/src/infograph.js：每次按距离重建边、只沿边转告（hops/decay）、
// 源在第 0 跳就生效、A/B 量紧凑度；接真实 Battle：看不见守军的维京人跟着同伴的转告扑过去，关掉共享就各奔小屋。
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle } from './fixtures/g5-battle.mjs';
import { InfoGraph } from '../src/badnorth/info-graph.js';
// ① 链式转告：5 人间距 0.9，只有第 0 人看得见敌人
const chain = Array.from({ length: 5 }, (_, i) => ({ x: i * .9, z: 0, y: 0 })), foe = { x: -1, z: 0, y: 0, navFloor: 1 };
const G = new InfoGraph({ radius: 1, sight: 1.2, hops: 2, decay: .55 });
let st = G.update(chain, [foe]);
assert.deepEqual(chain.map((u) => +G.info.get(u).conf.toFixed(4)), [1, .55, .3025, 0, 0], '只沿边、每跳 ×0.55、两跳为止（第 0 跳不慢一拍）');
assert.equal(st.edges, 4); assert.equal(st.components, 1); assert.equal(st.sources, 1);
assert.equal(G.relayed(chain[0]), null, '自己看到的不算转告'); assert.equal(G.relayed(chain[1]).foe, foe); assert.equal(G.relayed(chain[3]), null, '超出 hops 没有情报');
chain[2].x = 5; st = G.update(chain, [foe]);
assert.equal(st.components, 3, '动态：走散就断边（0-1 | 2 | 3-4）'); assert.equal(G.info.get(chain[3]).conf, 0);
// 视线挡住 = 不连边
G.update(chain.slice(0, 2), [foe], { canSee: () => false }); assert.equal(G.stats.edges, 0); assert.equal(G.stats.sources, 0);
assert.throws(() => new InfoGraph({ decay: 1 }));
// ② 原版 A/B：同一批人、同一目标、同一噪声，只切换共享 → 平均两两距离更小
const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const sim = (share) => {
  const r = rnd(11), us = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2, d = 1.1 + r() * .7; return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, sp: 1.55 + r() * .25 }; });
  const g = new InfoGraph({ radius: 1.9, sight: 1e-9, cohesion: 1.5 }), target = { x: 9.5, z: 2.2 };
  for (let s = 0; s < 240; s++) {   // 4 秒：还在路上（到了目标大家都挤成一团，比不出差别）
    g.update(us, []);
    if (share) { const front = us.slice().sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)).slice(0, 3); for (const u of us) g.info.get(u).conf = front.includes(u) ? 1 : .3; }
    for (const u of us) { const dx = target.x - u.x, dz = target.z - u.z, d = Math.hypot(dx, dz) || 1, c = share ? g.cohesionOffset(u) : { x: 0, z: 0 };
      let ax = dx / d * u.sp + c.x + (r() - .5) * .35, az = dz / d * u.sp + c.z + (r() - .5) * .35;
      for (const v of g.info.get(u).neighbors) { const sx = u.x - v.x, sz = u.z - v.z, sd = Math.hypot(sx, sz) || 1; if (sd < .52) { ax += sx / sd * .8; az += sz / sd * .8; } } const l = Math.hypot(ax, az); u.x += ax / l * u.sp / 60; u.z += az / l * u.sp / 60; }
  }
  let p = 0, k = 0; for (let i = 0; i < 24; i++) for (let j = i + 1; j < 24; j++) { p += Math.hypot(us[i].x - us[j].x, us[i].z - us[j].z); k++; } return p / k;
};
const plain = sim(false), shared = sim(true);
assert.ok(shared < plain * .9, `共享后更紧凑（平均两两距离 ${shared.toFixed(3)} < ${plain.toFixed(3)}）`);
// ③ 真实 Battle：守军在 x=0；维京人 v0 在 1.0（看得见），v1/v2 在 1.8/2.6（看不见）；小屋门在 x=9
const run = (sharing) => {
  const S = stripWorld(11, 1); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  const b = new Battle(makeView(S.world, S.index)); b.start(S.world); b.nextWave = 1e9; b.infoSharing = sharing; b.squads = [];
  b.houses = [{ cell: S.at(10, 0), burn: 0, lost: false, door: S.at(9, 0) }];
  const sq = { id: 0, members: [], alive: true, goal: S.at(0, 0), goalFloor: 1 };
  const def = { uid: 1, team: 0, squad: sq, k: 0, hp: 99, max: 99, x: 0, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, stunRemaining: 0 };
  sq.members.push(def);
  const viks = [1.0, 1.8, 2.6].map((x, i) => ({ uid: 2 + i, team: 1, squad: null, k: i, hp: 99, max: 99, x, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, stunRemaining: 0 }));
  b.units = [def, ...viks];
  for (let i = 0; i < 30; i++) { def.x = 0; def.z = 0; b.update(1 / 30); }
  return { viks, stats: b.infoGraph?.stats ?? null };
};
const on = run(true), off = run(false);
assert.ok(on.viks[1].x < 1.8 - .1 && on.viks[2].x < 2.6 - .1, `共享：看不见的两人也朝守军走 ${on.viks.map((v) => v.x.toFixed(2))}`);
assert.ok(off.viks[1].x > 1.8 + .1 && off.viks[2].x > 2.6 + .1, `不共享：各奔小屋 ${off.viks.map((v) => v.x.toFixed(2))}`);
assert.ok(on.stats.sources >= 1 && on.stats.informed >= 1, JSON.stringify(on.stats));   // 走近后前两人已亲眼看见，最后一人仍靠转告
console.log('PASS 动态边/逐跳衰减转告/断边/视线、A/B 紧凑度、真实 Battle 维京人按同伴转告扑向守军（关掉则奔小屋）', JSON.stringify({ plain: +plain.toFixed(3), shared: +shared.toFixed(3), on: on.viks.map((v) => +v.x.toFixed(2)), off: off.viks.map((v) => +v.x.toFixed(2)), stats: on.stats }));
