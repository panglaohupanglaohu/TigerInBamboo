// 第 55 批 G3 · cheesenav / holenav / voxelnav 共同缺口：格内精细门户 + 形变侧壁（src/world/fine-portals.js）。
// 906425294533394432「It's like navigating a Swiss cheese」/ 797119718477991936「Got some basic navigation going」：
// 白点穿的是拱洞，不是整条格边。门户 = 拱下净空够身高的那段 ∩ 邻格那一侧；钢柱占掉平底洞的门户两端。
import assert from 'node:assert/strict';
import { stripWorld, makeIsland, Battle } from './fixtures/g5-battle.mjs';
import { BattleNavigation } from '../src/world/battle-navigation.js';
import { undersideAt, buildFinePortals, UNIT_HEIGHT } from '../src/world/fine-portals.js';
const L = .5;
const make = ({ gap = false, opts = {}, rows = 3, archRow = 1 } = {}) => {
  const S = stripWorld(7, rows); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  for (let j = 0; j < rows; j++) for (let lv = 2; lv <= 5; lv++) S.world.setSolid(S.at(3, j), lv, true, { rock: true });
  S.world.setSolid(S.at(3, archRow), 2, false);                                   // 拱洞：2 层空、3–5 层门楣，两侧 (3,0)(3,2) 托着
  if (gap) for (let lv = 2; lv <= 5; lv++) S.world.setSolid(S.at(3, 0), lv, false);
  return { ...S, archCell: S.at(3, archRow), nav: new BattleNavigation(S.world, S.index, { levelHeight: L, ...opts }) };
};
const drive = (S, from, to, { radius = .055, steps = 900 } = {}) => {
  const u = { x: from.cx, z: from.cz + .3, y: L, navFloor: 1, radius }; let minZ = Infinity, maxZ = -Infinity, inArch = 0;
  for (let k = 0; k < steps; k++) {
    const p = S.nav.plan(u, to, 1); if (!p) return { ok: false, u };
    if (p.arrived && Math.hypot(u.x - to.cx, u.z - to.cz) < .2) return { ok: true, u, minZ, maxZ, inArch, k };
    const aim = S.nav.steerTarget(u, p) ?? p.next, dx = aim.x - u.x, dz = aim.z - u.z, l = Math.hypot(dx, dz) || 1, s = Math.min(.03, l);
    if (!S.nav.move(u, u.x + dx / l * s, u.z + dz / l * s, p)) { S.nav.move(u, u.x + dx / l * s, u.z, p) || S.nav.move(u, u.x, u.z + dz / l * s, p); }
    if (S.index.cellAt(u.x, u.z)?.id === S.archCell.id) { inArch++; minZ = Math.min(minZ, u.z); maxZ = Math.max(maxZ, u.z); }
  }
  return { ok: false, u };
};

// ① 拱的几何与 buildings.js 同源：一层洞 spring 在地面上 .075，rise .375
let S = make({ opts: { finePortals: true, unitHeight: .3 } });
S.nav.refresh();
const archId = S.nav.graph.at(S.at(3, 1), 1), U = S.nav.fine.under[archId];
assert.equal(U.kind, 'arch'); assert.equal(U.axis, 0, '两侧支撑在边 0/2（z 向邻格）→ 开口在边 1/3');
assert.ok(Math.abs(U.clearanceAtWall - .075) < 1e-9 && Math.abs(U.budget.rise - .375) < 1e-9, JSON.stringify(U.budget));
assert.ok(Math.abs(U.u0 - .1) < 1e-9, '身高 .3：净空 .075+.375·√(1−s²) ≥ .3 ⇒ |s| ≤ .8 ⇒ u0 = .1');
assert.equal(U.sideWalls.length, 2, '两道侧壁');
const ap = S.nav.fine.aperture(archId, 1);
assert.ok(Math.abs(ap.width - .8) < 1e-9 && Math.abs(ap.t0 - .1) < 1e-9, '门户 = 格边中间 80%：' + JSON.stringify(ap));
// 邻格一侧（twin 边）同一个门户，参数反向
const west = S.nav.graph.at(S.at(2, 1), 1), apW = S.nav.fine.aperture(west, 1), ap3 = S.nav.fine.aperture(archId, 3);
assert.ok(Math.abs(apW.width - .8) < 1e-9 && Math.abs(apW.p.z - ap3.q.z) < 1e-9 && Math.abs(apW.q.z - ap3.p.z) < 1e-9, '两侧门户重合：' + JSON.stringify([apW, ap3]));
const st = S.nav.fine.stats();
assert.ok(st.archNodes === 1 && st.narrowed >= 4 && st.closed === 0, JSON.stringify(st));
// ② discFits：贴着格边（门户外）站不住；关掉精细门户就站得住
const node = S.nav.graph.nodes[archId], zEdge = 1 - .5 + .06;              // 离边 0 只有 .06（在 u<.1 的低净空带里）
assert.equal(S.nav.discFits(node, 3, zEdge, .03), false, '拱脚低净空带：身体放不进');
assert.equal(S.nav.discFits(node, 3, 1, .055), true, '拱中线：放得进');
S.nav.finePortals = false; S.nav.refresh();
assert.equal(S.nav.discFits(S.nav.graph.nodes[archId], 3, zEdge, .03), true, '关掉后：整格都算可站（旧行为）');
assert.equal(S.nav.fine, null);
// ③ 实际走：开了以后穿拱时始终在侧壁之间（z∈[.6+r, 1.4−r]），关掉时会贴边
S = make({ opts: { finePortals: true, unitHeight: .3 } });
let r = drive(S, S.at(0, 1), S.at(6, 1));
assert.ok(r.ok && r.inArch > 0, '开：穿拱到达 ' + JSON.stringify(r.u));
assert.ok(r.minZ >= .6 + .055 - 1e-6 && r.maxZ <= 1.4 - .055 + 1e-6, `开：拱内 z ∈ [${r.minZ.toFixed(3)}, ${r.maxZ.toFixed(3)}]`);
const off = drive(make({ opts: { unitHeight: .3 } }), S.at(0, 1), S.at(6, 1));
assert.ok(off.ok, '关：也能到');
// ④ 太高（拱顶 .45 < 身高）：门户封死；只有拱洞这一条路时不可达，开了无顶缺口就绕过去
S = make({ opts: { finePortals: true, unitHeight: .5 } }); S.nav.refresh();
assert.equal(S.nav.fine.aperture(archId, 1).width, 0, '身高超过拱顶：门户宽 0');
assert.equal(S.nav.plan({ x: 0, z: 1, y: L, navFloor: 1 }, S.at(6, 1), 1), null, '唯一通路被封：不可达');
S = make({ gap: true, rows: 4, archRow: 2, opts: { finePortals: true, unitHeight: .5 } });   // 缺口在第 0 行，不挨着拱（挨着就不是拱了）
const tall = drive(S, S.at(0, 2), S.at(6, 2));
assert.ok(tall.ok && tall.inArch === 0, '太高的人绕无顶缺口，不进拱');
// ⑤ 形变侧壁：把拱格的一个角挪开（不规则网格），侧壁沿笼形映射倾斜，不再与支撑边平行
S = make({ opts: { finePortals: true, unitHeight: .3 } });
const shift = (vid, dx, dz) => { for (const c of S.cells) for (const p of c.pts) if (p.id === vid) { p.x += dx; p.z += dz; } };
const arch = S.at(3, 1); shift(arch.pts[2].id, .12, .25);                   // 角 2（+x,+z）挪 (.12,.25)
S.world.touch(); S.nav.refresh();
const D = S.nav.fine.under[S.nav.graph.at(arch, 1)], [w0, w1] = D.sideWalls;
const ang = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);
// 两条支撑边（边 0：A0→A1，边 2 反向：B0→B1）方向不同；侧壁方向按 u 在两者之间插值——不平行于任何一条格边
const e0 = ang(arch.pts[0], arch.pts[1]), e2 = ang(arch.pts[3], arch.pts[2]), a0 = ang(w0[0], w0[1]), a1 = ang(w1[0], w1[1]);
console.log('deformed angles', { e0, e2, a0, a1, u0: D.u0 });
assert.ok(Math.abs(e2 - e0) > .1, '格子确实变形了');
for (const a of [a0, a1]) assert.ok(Math.min(Math.abs(a - e0), Math.abs(a - e2)) > .005 && (a - e0) * (a - e2) < 0, `侧壁夹在两支撑边方向之间（形变）：${a.toFixed(3)}`);
assert.ok(Math.abs(a1 - e2) < Math.abs(a1 - e0), '靠 B 侧的侧壁更接近 B 侧支撑边方向');
// 侧壁两端正好落在开口边上（笼形 P(u0,0)、P(u0,1)）
const onSeg = (p, a, b) => Math.abs((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) < 1e-9;
assert.ok(onSeg(w0[0], arch.pts[3], arch.pts[0]) && onSeg(w0[1], arch.pts[1], arch.pts[2]), '侧壁端点在两条开口边上');
// ⑥ 平底洞（无对边支撑）：角上钢柱占掉门户两端
const F = stripWorld(5, 3); for (const c of F.cells) F.world.fill(c, 1, { rock: true });
F.world.setSolid(F.at(2, 1), 3, true, { rock: true });                     // 悬空一块，2 层空，四周无支撑 → 平底 + 4 根柱
const fn = new BattleNavigation(F.world, F.index, { levelHeight: L, finePortals: true }); fn.refresh();
const fu = fn.fine.under[fn.graph.at(F.at(2, 1), 1)];
assert.equal(fu.kind, 'flat'); assert.equal(fu.legs.length, 4);
const fa = fn.fine.aperture(fn.graph.at(F.at(2, 1), 1), 1);
assert.ok(fa.width < 1 && fa.width > .8, '钢柱占掉两端：' + fa.width.toFixed(3));
assert.equal(fn.discFits(fn.graph.nodes[fn.graph.at(F.at(2, 1), 1)], 2.5 - .06, .5 + .06, .03), false, '站在柱子上：不行');
// ⑦ 默认关：门户宽与旧图逐条相同；真实岛上开着跑仗不报错
for (const kind of ['quad', 'mixed']) {
  const I = makeIsland(kind, 7), a = new BattleNavigation(I.world, I.index, { levelHeight: L }); a.refresh();
  const b = new BattleNavigation(I.world, I.index, { levelHeight: L }); b.refresh();
  assert.deepEqual(a.graph.portals.map(p => p.width), b.graph.portals.map(p => p.width));
  const fine = buildFinePortals(I.world, b.graph, { L });
  const s = fine.stats();
  assert.ok(s.portals === b.graph.portals.length, kind + JSON.stringify(s));
  const battle = new Battle(I.view); battle.start(I.world); battle.navigation.finePortals = true;
  for (let k = 0; k < 400; k++) battle.update(1 / 30);
  assert.ok(battle.navigation.fine, kind + '：Battle 里精细门户已生效');
  console.log(kind, JSON.stringify(battle.navigation.fine.stats()), 'alive', battle.units.filter(u => !u.dead).length);
}
assert.equal(UNIT_HEIGHT, .18);
assert.ok(undersideAt(make().world, make().at(0, 1), 1) === null, '露天节点没有洞下几何');
console.log('fine-portals: PASS');
