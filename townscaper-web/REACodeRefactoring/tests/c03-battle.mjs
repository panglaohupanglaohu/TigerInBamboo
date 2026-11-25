// 第 56 批 C03：Bad North 玩法/展示扩展（battle-c03.js）。node 直接跑真实 Battle，读状态与几何。
// 1092709665199345664 爆炸编排 · 828984794407170048/1007587828992266240 小屋火球+焦黑 · 890611046435627008 抛火团 ·
// 995034777756536833 Plunge+No valid targets+冷却 · 1016680972610359298 Select/Move/Swap · 902103473365417984 三维距离等值线 ·
// 827215002448846848 升级色阶+盔饰 · 1024679338292256769 UI flair 两轨时序
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, dataset: {}, appendChild() {}, remove() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { Battle } = await import('../src/badnorth/battle.js');
const { C03_FLAGS, isoLinesOnMesh } = await import('../src/badnorth/battle-c03.js');
const { uiRevealAt } = await import('../src/core/ui-reveal.js');

const N = 10;
const cells = Array.from({ length: N }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < N - 1 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const world = new World({ cells }); for (const c of cells) if (c.id) world.fill(c, 1, { rock: true });
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5) ?? null : null; } };
// 渲染网格：每格一块 y=.5 的顶面 + 第 8 格上一个「小屋」盒子（顶点色），给焦黑和等值线用
const pos = [], col = [];
const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) { pos.push(...p); col.push(.9, .85, .8); } };
quad([-.5, 0, -.5], [-.5, 0, .5], [.5, 0, .5], [.5, 0, -.5]);    // 海平面那格
for (let i = 1; i < N; i++) quad([i - .5, .5, -.5], [i - .5, .5, .5], [i + .5, .5, .5], [i + .5, .5, -.5]);
quad([.5, 0, -.5], [.5, 0, .5], [.5, .5, .5], [.5, .5, -.5]);     // 崖壁（x=.5，从海平面到台面）
// 多层台阶：低台 z=.5 外挑一块 y=1.0 的高台（x∈[2.5,4.5]，z∈[.5,1.5]），立面 + 顶面两级都供等值线爬
for (const x0 of [2.5, 3.5]) {
  quad([x0, .5, .5], [x0 + 1, .5, .5], [x0 + 1, 1, .5], [x0, 1, .5]);        // 台阶立面 .5→1.0
  quad([x0, 1, .5], [x0, 1, 1.5], [x0 + 1, 1, 1.5], [x0 + 1, 1, .5]);        // 高台顶面（y+ 朝上的绕序）
}
const hx = 8; quad([hx - .3, .5, -.3], [hx - .3, .9, -.3], [hx + .3, .9, -.3], [hx + .3, .5, -.3]); quad([hx - .3, .9, -.3], [hx - .3, .9, .3], [hx + .3, .9, .3], [hx + .3, .9, -.3]);
const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh, worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false };
const b = new Battle(view); b.start(world); b.nextWave = 1e9;
const c03 = b.c03;
assert.deepEqual(Object.values(c03.on), C03_FLAGS.map(() => false), '默认全关');
const tick = (secs, dt = 1 / 30) => { for (let t = 0; t < secs; t += dt) b.update(dt); };
const mkSquad = (id, goal) => { const sq = { id, members: [], alive: true, flag: new THREE.Group(), goal, goalFloor: 1 }; const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); sq.flag.userData = { cloth: new THREE.Mesh(cg), SEG: 1 }; return sq; };
const unit = (team, squad, x, extra = {}) => ({ uid: Math.random() * 1e9 | 0, team, squad, k: 0, hp: 3, max: 3, x, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, ...extra });
const reset = () => { for (const sq of b.squads) { b.group.remove(sq.flag, sq.flag.userData.cloth); } b.squads = []; b.units = []; b.houses = []; b.selected = null; b.scale = 1; };

// ① 全关：跑一阵子，C03 统计全 0
reset(); tick(1);
assert.equal(c03.stats.explosions + c03.stats.torches + c03.stats.plunges, 0, '关时无副作用');

// ② kpow：explodeAt 时序 —— 0.1 s 内膨胀到接近 r，之后收缩；焦痕从红变焦黑；火星；黑烟源有寿命
c03.set('kpow', true);
c03.kpowT = 99;
const before = view.smoke.sources.length;
c03.explodeAt({ x: 3, y: .6, z: 0 }, { r: .4, smokeLife: 1 });
const blast = c03.blasts.at(-1); b.paused = false;
tick(.12); const s1 = blast.core.scale.x;
tick(.3); const s2 = blast.core.scale.x;
assert.ok(s1 > .3 && s2 < s1, `火球先膨胀再收缩 ${s1.toFixed(3)} → ${s2.toFixed(3)}`);
const sc = c03.scorches.at(-1); assert.ok(sc.mesh.material.color.r < .8 && Math.abs(sc.mesh.position.y - .512) < .02, '焦痕贴地并开始变黑');
assert.ok(c03.sparks.length > 0 || c03.stats.sparks >= 28, '火星');
assert.equal(view.smoke.sources.length, before + 1, '黑烟源接上');
tick(1.2); assert.equal(view.smoke.sources.length, before, '黑烟寿命到了移除');
tick(2.5); assert.ok(sc.mesh.material.color.r < .2, '焦痕最终焦黑');
c03.kpowT = 0; tick(.1); assert.ok(c03.stats.explosions >= 2, '演示模式自动在岸边炸');
c03.set('kpow', false);

// ③ plunge：没有敌人 → No valid targets，不进冷却；有 → 跃起落地、范围伤害、冷却
c03.set('plunge', true);
const sqA = mkSquad(0, cells[2]); b.squads.push(sqA);
for (let k = 0; k < 4; k++) { const u = unit(0, sqA, 2 + k * .05); u.k = k; sqA.members.push(u); b.units.push(u); }
assert.equal(c03.castPlunge(sqA, { x: 4.5, y: .5, z: 0 }), 'no-target');
assert.equal(c03.stats.noTargets, 1); assert.equal(c03.toast?.msg ?? c03.toastEl?.textContent, 'No valid targets'); assert.equal(c03.cooldown, 0, '没目标不进冷却');
const vik = unit(1, null, 4.6, { hp: 2, max: 2 }); b.units.push(vik);
assert.equal(c03.castPlunge(sqA, { x: 4.5, y: .5, z: 0 }), 'ok');
tick(.3); const mid = sqA.members[0];
assert.ok(mid.y > .7 && mid.c03Leap, `半空中 y=${mid.y.toFixed(2)}`);
tick(.6);
assert.ok(!mid.c03Leap && Math.abs(mid.x - 4.5) < .05 && Math.abs(mid.y - .5) < .01 && mid.navFloor === 1, '落到目标');
assert.ok(c03.stats.plungeHits >= 1 && (vik.hp < 2 || vik.dead), '落地范围伤害');
assert.ok(c03.cooldown > 8, '进入冷却'); assert.equal(c03.castPlunge(sqA, { x: 4.5, y: .5, z: 0 }), 'cooldown');
tick(10); assert.equal(c03.cooldown, 0, '冷却走完');
c03.set('plunge', false); reset();

// ④ confirm：空地 = 单个 Move；有队 = Select/Move/Swap；Swap 两队互换阵地
c03.set('confirm', true);
const sq1 = mkSquad(0, cells[2]), sq2 = mkSquad(1, cells[6]); b.squads.push(sq1, sq2);
for (const [sq, x] of [[sq1, 2], [sq2, 6]]) for (let k = 0; k < 3; k++) { const u = unit(0, sq, x + k * .04); u.k = k; sq.members.push(u); b.units.push(u); }
const hitAt = (x) => ({ cell: index.cellAt(x, 0), point: new THREE.Vector3(x, .5, 0) });
b.selected = sq1;
assert.equal(b.onPointer(hitAt(4)), true); assert.deepEqual(c03.pending.options, ['move']); assert.equal(sq1.goal, cells[2], '确认前不动');
assert.ok(c03.marker.visible, '地面标记');
assert.ok(Math.abs(c03.marker.position.x - 4) < .01 && Math.abs(c03.marker.position.z - 0) < .01, '标记钉在目标格中心');
c03.confirmAction('move'); assert.equal(sq1.goal, cells[4], 'Move 确认后才下令'); assert.equal(b.selected, null);
assert.equal(c03.marker.visible, false, '确认后标记收回'); assert.equal(c03.pending, null, 'pending 清理');
b.selected = sq1; b.onPointer(hitAt(6.3)); assert.deepEqual(c03.pending.options, ['select', 'move', 'swap'], '目标处有别队 → 三项');
c03.confirmAction('swap'); assert.equal(sq1.goal, cells[6]); assert.equal(sq2.goal, cells[4], 'Swap 互换');
assert.equal(sq2.goalFloor, sq1.goalFloor, 'Swap 楼层也互换');
assert.equal(c03.marker.visible, false, 'Swap 后标记收回');
b.selected = sq1; b.onPointer(hitAt(4.1)); c03.confirmAction('select'); assert.equal(b.selected, sq2, 'Select 改选那一队');
// Esc 取消：弹窗开着 → 收掉且不下令；没开 → cancelPopup 返回 false
b.selected = sq1; b.onPointer(hitAt(3)); assert.ok(c03.pending && c03.marker.visible, '再开弹窗');
assert.equal(c03.cancelPopup(), true, 'Esc 取消返回 true'); assert.equal(c03.pending, null); assert.equal(c03.marker.visible, false, 'Esc 收回标记');
assert.equal(sq1.goal, cells[6], '取消不下令'); assert.equal(c03.cancelPopup(), false, '没弹窗返回 false');
// 确认走 battle 原下令路径：navigation.plan 必须被调（不绕过校验）；plan 打回 → 不改 goal
const origPlan = b.navigation.plan.bind(b.navigation); const planCells = [];
b.navigation.plan = (u, cell, floor) => { planCells.push(cell?.id); return origPlan(u, cell, floor); };
b.selected = sq1; b.onPointer(hitAt(5)); c03.confirmAction('move');
assert.equal(sq1.goal, cells[5], '确认 Move 落到真实 goal'); assert.ok(planCells.includes(5), 'navigation.plan 校验过目标');
b.navigation.plan = () => null;
sq1.goal = cells[6]; b.selected = sq1; b.onPointer(hitAt(5)); assert.ok(c03.pending, '弹窗照开');
c03.confirmAction('move'); assert.equal(sq1.goal, cells[6], 'plan 打回 → 目标不变');
b.navigation.plan = origPlan;
// 弹窗期间队伍阵亡 / 选中被顶替 → 自动收
b.selected = sq1; b.onPointer(hitAt(3)); sq1.alive = false; tick(.05);
assert.equal(c03.pending, null, '队伍阵亡自动收'); assert.equal(c03.marker.visible, false);
sq1.alive = true;
// 关档时开着弹窗 → 收回
b.selected = sq1; b.onPointer(hitAt(3)); assert.ok(c03.pending);
c03.set('confirm', false); assert.equal(c03.pending, null); assert.equal(c03.marker.visible, false, '关档收回标记');
assert.ok(!c03._escKey, '关档摘掉 Esc 监听（Node 无 addEventListener，本来就不挂）');
reset();

// ⑤ houseFx：失守 → 屋下焦痕 → 2.2 s 后火球（粉辉光）→ 屋体顶点压成焦黑；stop 还原
c03.set('houseFx', true);
b.houses = [{ cell: cells[hx], burn: 5, lost: true, door: cells[hx - 1] }];
const n0 = c03.stats.scorches; tick(.1); assert.ok(c03.stats.scorches >= n0 + 2, '屋下 + 门口焦痕');
tick(2.3); assert.equal(c03.stats.housesCharred, 1); assert.ok(c03.stats.charredVerts >= 9, '屋体顶点焦黑 ' + c03.stats.charredVerts);
const ca = geo.attributes.color; let dark = 0; for (let i = 0; i < ca.count; i++) if (ca.getX(i) < .25) dark++;
assert.equal(dark, c03.stats.charredVerts, '只压暗屋格内、地面以上的顶点（地面不动）');
assert.ok(c03.blasts.some((x) => x.glow) || c03.stats.explosions >= 1, '火球');
c03.set('houseFx', false);

// ⑥ torches：维京人到屋旁 → 抛火团 → 命中加燃烧
c03.set('torches', true);
b.houses = [{ cell: cells[3], burn: 0, lost: false, door: cells[2] }];
const v2 = unit(1, null, 2.6, { torchCd: 0 }); b.units = [v2];
tick(1.2); assert.ok(c03.stats.torches >= 1 && c03.stats.torchHits >= 1, '抛出并命中');
assert.ok(b.houses[0].burn > .9 || b.houses[0].lost, '燃烧进度增加 ' + b.houses[0].burn);
c03.set('torches', false); reset();

// ⑦ distIso：表面测地距离 —— 从海平面那格出发，线爬上崖壁（竖直面上有段），台面上等间距
const iso = isoLinesOnMesh(mesh, { spacing: .2 });
assert.ok(iso.sources > 0 && iso.levels >= 10 && iso.segments > 30 && iso.wallSegments >= 2, JSON.stringify({ ...iso, positions: iso.positions.length }));
// 多层台阶补强：侧挑高台（y=1.0，z>.5）顶面有线、第二级立面（z≈.5，y∈[.55,.95]）也有线
let tierSegs = 0, riserSegs = 0;
for (let s = 0; s < iso.positions.length; s += 6) {
  const xs = [iso.positions[s], iso.positions[s + 3]], ys = [iso.positions[s + 1], iso.positions[s + 4]], zs = [iso.positions[s + 2], iso.positions[s + 5]];
  if (ys.every((y) => y > .93) && zs.every((z) => z > .55)) tierSegs++;
  // 立面段：两端 z≈.5（贴墙），中点落在墙内部 y∈(.5,1)、x∈(2.5,4.5)
  if (zs.every((z) => Math.abs(z - .5) < .025) && (ys[0] + ys[1]) / 2 > .52 && (ys[0] + ys[1]) / 2 < .98 && xs.every((x) => x > 2.4 && x < 4.6)) riserSegs++;
}
assert.ok(tierSegs >= 4, '高台顶面有等值线段 ' + tierSegs);
assert.ok(riserSegs >= 3, '第二级台阶立面爬线 ' + riserSegs);
c03.isoSpacing = .2; c03.set('distIso', true); tick(.05); assert.ok(c03.isoLines?.visible && c03.stats.isoSegments === iso.segments);
c03.set('distIso', false); assert.equal(c03.isoLines.visible, false);

// ⑧ tierUp + flair：打退一波 → 升级（色阶，不回血），三级金盔饰；flair 两轨时序
c03.set('tierUp', true); c03.set('flair', true);
const sq3 = mkSquad(0, cells[2]); b.squads.push(sq3);
const d1 = unit(0, sq3, 2, { hp: 1 }); sq3.members.push(d1); b.units.push(d1);
const v3 = unit(1, null, 8); b.units.push(v3); b.wave = 1; tick(.05);
v3.dead = true; tick(.05); assert.equal(sq3.tier, 2); assert.equal(d1.appearanceTier, 2); assert.equal(d1.hp, 1, '升级不回血');
v3.dead = false; b.wave = 2; tick(.05); v3.dead = true; tick(.05); assert.equal(sq3.tier, 3); assert.equal(c03.crests.count, 1, '三级盔饰');
assert.ok(c03.stats.flairs >= 2 && c03.flairs.length >= 1, 'flair 弹出');
const early = uiRevealAt(.5), late = uiRevealAt(2.7), end = uiRevealAt(3.5);
assert.ok(early.title > early.ornament && late.title < late.ornament && end.title === 0 && end.ornament > 0, '中央先显后退、外纹后展后退');
b.stop(); assert.equal(c03.flairs.length, 0); assert.equal(ca.getX(0) > .5, true, 'stop 还原焦黑顶点色');
let restored = 0; for (let i = 0; i < ca.count; i++) if (ca.getX(i) < .25) restored++; assert.equal(restored, 0);
console.log('PASS battle-c03', JSON.stringify({ s1: +s1.toFixed(3), s2: +s2.toFixed(3), charred: c03.stats.charredVerts, iso: { levels: iso.levels, segs: iso.segments, wall: iso.wallSegments }, plungeHits: c03.stats.plungeHits }));
