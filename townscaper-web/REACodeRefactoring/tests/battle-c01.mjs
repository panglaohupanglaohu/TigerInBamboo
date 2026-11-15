// 第 56 批 C01 · Bad North 特效 A（battle-c01.js）：
// 839067977781768193 旗顶血量槽 + 跳板；883447205176238083 节点图线网 / 菱形 / 箭线；837027901853810688 下令黄竖条 / 血迹老化 / 火光；
// 984813819280191488 血迹堆厚变暗；816743289500106752 成列行军 + 方块集结；995043346778415104 常驻路线预览；946660607008403456 沿岸泡沫 / 小花 / 水面血雾。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
const { C01_FLAGS, C01_DEFAULT_ON, bloodLook, blockSlot, graphEdges, coastEdges } = await import('../src/badnorth/battle-c01.js');
const out = {};
// 战斗里有 Math.random（出手冷却 / 血滴 / 击退），固定种子让断言可复现
{ let a = 20561; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── 纯函数
{
  const f = bloodLook(0), o = bloodLook(10), old = bloodLook(45), st = bloodLook(10, 3);
  assert.ok(f.color.r > o.color.r + 0.1, '新鲜血更鲜红');
  assert.equal(o.alpha, 1); assert.ok(old.alpha < 0.5 && old.alpha >= 0.45, '45s 后变淡');
  assert.ok(st.color.r < o.color.r * 0.7 && st.alpha > 1, '叠 3 层更暗更浓');
  const off = bloodLook(45, 3, { aging: false, stacking: false });
  assert.equal(off.alpha, 1); assert.equal(off.color.getHex(), new THREE.Color('#8e1f24').getHex(), '全关 = 原色原透明度');
  const slots = Array.from({ length: 8 }, (_, r) => blockSlot(r, 8, 0, 1));
  assert.equal(slots[0].cols, 4); assert.equal(slots[0].rows, 2);
  assert.equal(new Set(slots.map((s) => s.x.toFixed(3) + ',' + s.z.toFixed(3))).size, 8, '8 个槽位互不重合');
  assert.ok(Math.abs(slots.reduce((a, s) => a + s.x, 0)) < 1e-9 && Math.abs(slots.reduce((a, s) => a + s.z, 0)) < 1e-9, '方块以目标为中心');
  const big = blockSlot(0, 100, 1, 0); assert.ok(big.rows >= 3 && big.rows <= 4, '100 人 3–4 排');
  const chain = [0, .3, .6, 1.5].map((x) => ({ x, z: 0, y: 0 }));
  assert.deepEqual(graphEdges(chain, { radius: .4 }), [[0, 1], [1, 2]], '半径内连、走散就断');
  assert.deepEqual(graphEdges(chain, { radius: .4, canSee: (a, b) => a.x + b.x > .5 }), [[1, 2]], '视线挡住不连');
}

// ── 默认：只有 C01_DEFAULT_ON 那几层开着（第 97 轮 houseChar 破例），其余全关
const { world: w0, view: v0 } = makeIsland('quad', 7), b0 = new Battle(v0); b0.start(w0);
for (const k of C01_FLAGS) {
  const want = C01_DEFAULT_ON.includes(k);
  assert.equal(b0.c01.on[k], want, `默认档 ${k} 应为 ${want}`);
}
assert.deepEqual([...C01_DEFAULT_ON], ['houseChar'], '默认开的只有「失守屋体炭黑」这一层（837 原片默认观感）');
b0.nextWave = .5; for (let k = 0; k < 900; k++) b0.update(1 / 30);
assert.equal(b0.blood.instanceColor, null, '关：血迹没有逐实例颜色');
assert.equal(b0.blood.material.color.getHexString(), '8e1f24');
assert.equal(b0.c01.huds.size + b0.c01.diamonds.size + b0.c01.planks.size + b0.c01.glows.size, 0);
assert.ok(!b0.c01.net.visible && !b0.c01.foam);

// ── 全开：真实 Battle
const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world);
for (const k of C01_FLAGS) b.c01.set(k, true);
const C = b.c01;
assert.ok(C.stats.coast > 20 && C.stats.flowers > 10 && C.stats.foamDots === C.stats.coast * 3, '沿岸泡沫 + 小花 ' + JSON.stringify([C.stats.coast, C.stats.flowers]));
for (const e of coastEdges(world).slice(0, 40)) { const c = view.index.cellAt((e.a.x + e.b.x) / 2 + e.nx * .2, (e.a.z + e.b.z) / 2 + e.nz * .2); assert.ok(!c || world.top(c) === 0, '泡沫带朝外（落在水里）'); }
assert.equal(b.blood.material.color.getHexString(), 'ffffff'); assert.ok(b.blood.instanceColor);

// 成列行军：选中 0 队，下令去远处同队可走格
const sq = b.squads[0], men = sq.members;
const cen = () => [men.reduce((s, u) => s + u.x, 0) / men.length, men.reduce((s, u) => s + u.z, 0) / men.length];
const [cx, cz] = cen();
b.onPointer({ cell: view.index.cellAt(cx, cz), point: { x: cx, y: b.squads[0].members[0].y, z: cz } });
assert.equal(b.selected, sq);
const lead = men[0];
const far = world.cells.filter((c) => world.top(c) >= 1 && b.navigation.pick(c, world.top(c) * b.L) && b.navigation.plan(lead, c, world.top(c)))
  .sort((p, q) => Math.hypot(q.cx - cx, q.cz - cz) - Math.hypot(p.cx - cx, p.cz - cz))
  .find((c) => Math.hypot(c.cx - cx, c.cz - cz) > 3 && Math.hypot(c.cx - cx, c.cz - cz) < 6);
assert.ok(far, '有远处目标');
b.onPointer({ cell: far, point: { x: far.cx, y: world.top(far) * b.L, z: far.cz } });
assert.equal(C.pillars.length, 1, '下令 → 黄竖条'); assert.ok(C.stats.routeSamples > 5, '路线预览');
const routeN = b.path.geometry.getAttribute('position').count;
assert.equal(routeN, C.stats.routeSamples);
b.nextWave = 1e9;   // 行军阶段先不来船
let persistent = true;
const track = (bb, ms, k) => { const xs = ms.map((u) => [u.x, u.z]); let m = 0; for (const a of xs) for (const c of xs) m = Math.max(m, Math.hypot(a[0] - c[0], a[1] - c[1])); return m; };
const series = [];
for (let k = 0; k < 240; k++) {
  b.update(1 / 30); series.push(men.map((u) => [u.x, u.z]));
  if (k === 90 && !(b.pathT > 0 && b.path.geometry.getAttribute('position').count > 0)) persistent = false;
}
assert.equal(C.pillars.length, 0, '0.6s 后黄竖条消失');
assert.ok(persistent, '3s 后路线点仍在（常驻，不是 2.5s 淡出）');
assert.ok(C.stats.routeTrimmed > 0, '走过的点被消掉');
assert.ok(C.stats.waits > 20, '后面的人等前面拉开（列队） waits=' + C.stats.waits);
for (let k = 0; k < 900 && C.stats.slotted < 200; k++) b.update(1 / 30);
for (let k = 0; k < 150; k++) b.update(1 / 30);
// 只看真正走到目标格的人（同岛同目标，column 关时也有 2 人卡在 328 格的窄口——旧导航行为，不是本组引入）
const arrived = men.filter((u) => !u.dead && view.index.cellAt(u.x, u.z) === far);
assert.ok(arrived.length >= 5, '多数人到达 ' + arrived.length);
const spreadOf = (ser, idx) => Math.max(...ser.map((f) => { let m = 0; for (const i of idx) for (const j of idx) m = Math.max(m, Math.hypot(f[i][0] - f[j][0], f[i][1] - f[j][1])); return m; }));
const idx = arrived.map((u) => men.indexOf(u));
const spreadOn = spreadOf(series, idx);
// 对照：同岛、同目标、column 关（原「各自奔目标格」）
const ref = makeIsland('quad', 7), rb = new Battle(ref.view); rb.start(ref.world);
{ const rm = rb.squads[0].members, rx = rm.reduce((s, u) => s + u.x, 0) / rm.length, rz = rm.reduce((s, u) => s + u.z, 0) / rm.length;
  rb.onPointer({ cell: ref.view.index.cellAt(rx, rz), point: { x: rx, y: rm[0].y, z: rz } }); const rf = ref.world.cells[far.id];
  rb.onPointer({ cell: rf, point: { x: rf.cx, y: ref.world.top(rf) * rb.L, z: rf.cz } }); rb.nextWave = 1e9; }
const rser = []; for (let k = 0; k < 240; k++) { rb.update(1 / 30); rser.push(rb.squads[0].members.map((u) => [u.x, u.z])); }
const spreadOff = spreadOf(rser, idx);
const ax = arrived.reduce((s, u) => s + u.x, 0) / arrived.length, az = arrived.reduce((s, u) => s + u.z, 0) / arrived.length;
const nn = arrived.map((a) => Math.min(...arrived.filter((c) => c !== a).map((c) => Math.hypot(a.x - c.x, a.z - c.z))));
out.column = { waits: C.stats.waits, arrived: arrived.length, spreadOn: +spreadOn.toFixed(2), spreadOff: +spreadOff.toFixed(2), nearest: nn.map((d) => +d.toFixed(3)), toGoal: +Math.hypot(ax - far.cx, az - far.cz).toFixed(3), routeSamples: C.stats.routeSamples, routeArcs: C.stats.routeArcs, routeCorners: C.stats.routeCorners, routeTrimmed: C.stats.routeTrimmed };
assert.ok(spreadOn > spreadOff * 1.3, '列队行军比各自奔跑拉得更长 ' + JSON.stringify(out.column));
assert.ok(C.stats.slotted > 0, '到达后方块落位');
assert.ok(Math.hypot(ax - far.cx, az - far.cz) < 0.2, '集结在目标格中心 ' + JSON.stringify(out.column));
assert.ok(nn.every((d) => d > 0.1 && d < 0.2), '方块间距均匀（0.13 槽距） ' + JSON.stringify(out.column));


// 战斗：放船来，近战 → 血量槽 / 闪红 / 节点图 / 血迹堆厚
b.nextWave = b.t + .2;
for (let k = 0; k < 1400 && !b.units.some((u) => u.team === 1 && !u.onBoat && !u.dead); k++) b.update(1 / 30);
assert.ok(C.stats.planks >= 1, '卸人时搭跳板');
const plank = [...C.planks.values()][0]; assert.ok(plank.scale.z > .2 && plank.scale.z <= 1.4);
const viks = b.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat && !u.fall), inf = b.squads[1].members.filter((u) => !u.dead);
viks.forEach((v, i) => { const d = inf[i % inf.length], a = i * 2.4; v.x = d.x + Math.sin(a) * .2; v.z = d.z + Math.cos(a) * .2; v.y = d.y; v.navFloor = d.navFloor; });
for (let k = 0; k < 600; k++) b.update(1 / 30);
assert.ok(C.huds.size === 3 && C.stats.hudRedraws > 3 && C.stats.hitFlashes > 0, 'HUD ' + JSON.stringify(C.stats));
const hurt = [...C.huds.entries()].find(([s]) => s.members.some((u) => u.dead));
if (hurt) assert.ok(hurt[1].userData.bar.fill.w < 64, '有人阵亡 → 槽变短');
assert.ok(C.stats.edges > 5 && C.stats.nodes > 10 && C.stats.diamonds >= 1, '节点图 ' + C.stats.edges);
assert.ok(C.stats.bloodTracked > 10 && C.stats.stacked > 0, '血迹堆厚 ' + C.stats.stacked);
// 血迹老化：最早的斑比最新的暗（颜色系数）
const ic = b.blood.instanceColor; assert.ok(ic.getX(0) < ic.getX(b.blood.count - 1) + 1e-6);
// 水面血雾：一滴血落在海里
b.drops.push({ x: 40, y: .3, z: 40, vx: 0, vy: 0, vz: 0 });
for (let k = 0; k < 30; k++) b.update(1 / 30);
assert.ok(C.stats.hazes >= 1 && C.hazeMesh.count >= 1, '水面血雾');
// 火光：烧掉一间小屋
const h = b.houses[0]; h.burn = 5; viksAt(h); for (let k = 0; k < 10; k++) b.update(1 / 30);
function viksAt() { h.lost = true; }
assert.ok(C.stats.glows >= 1 && [...C.glows.values()][0].light.intensity > 1, '烧屋火光');
// 登陆规划盒（974325184525201409）：每条船 2 个盒（泊位 + 走廊）+ 下一波候选，同一套判定
for (let k = 0; k < 30; k++) b.update(1 / 30);
assert.ok(C.stats.raidBoats >= 1 && C.stats.raidOk + C.stats.raidRejected > 10 && C.raid.geometry.getAttribute('position').count >= 24 * 2 * C.stats.raidBoats, '登陆规划盒 ' + JSON.stringify([C.stats.raidBoats, C.stats.raidOk, C.stats.raidRejected]));
// 头像卡（1010979395719319552）：每队一张，血量条跟着存活比
assert.equal(C.cards.items.length, 3); assert.ok(C.cards.items.every((it) => it.spec.parts.frame === 'cut' && 'gear' in it.spec.parts));
const dead1 = C.cards.items.find((it) => it.sq.members.some((u) => u.dead)); if (dead1) assert.ok(dead1.ratio < 1);
// 风轨迹（926903893866541057）：桩 atmosphere 有 trace 时画红线（真实场景见浏览器截图）
view.atmosphere.trace = (s0) => ({ points: [s0, [s0[0] + .2, s0[1], s0[2]], [s0[0] + .4, s0[1], s0[2] + .05]], blocked: 0 }); view.atmosphere.probes = { occupied: () => false };
C.traceT = 0; b.update(1 / 30); assert.ok(C.stats.traces > 20 && C.traces.visible, '风轨迹 ' + C.stats.traces);
// 关掉 → 全部隐藏、血迹材质复原
for (const k of C01_FLAGS) b.c01.set(k, false);
assert.equal(b.blood.instanceColor, null); assert.equal(b.blood.material.color.getHexString(), '8e1f24');
b.update(1 / 30);
assert.ok(!C.net.visible && [...C.huds.values()].every((x) => !x.visible) && !C.foam.visible && !C.raid.visible && !C.traces.visible && !C.cards);
assert.ok(b.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite)));
out.fx = { coast: C.stats.coast, flowers: C.stats.flowers, edges: C.stats.edges, stacked: C.stats.stacked, maxStack: C.stats.maxStack, hitFlashes: C.stats.hitFlashes, planks: C.stats.planks, hazes: C.stats.hazes, glows: C.stats.glows };
console.log('battle-c01 PASS', JSON.stringify(out));
