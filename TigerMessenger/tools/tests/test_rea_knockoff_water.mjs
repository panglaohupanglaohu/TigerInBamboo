// 击退落水（REACode combatfx.js → vendor badnorth/battle.js [TM]）：node 直接跑 REA Battle，无浏览器。
// 场景：一条 6 格的码头，格 0 是海（top 0），格 1–5 是 1 层陆地。
//   ① 长矛把站在码头边的维京人沿矛轴顶出去 → 上抛翻滚 → 落水溺水（不摔死、不留血），水花出现，1.6 s 后不再画；
//   ② 同样一矛打在码头中间的人身上：只后退，不掉水；
//   ③ 普通近战（无矛）在水边按 REA 崖边 60% 手感掉水（Math.random 固定 0.1 → 必掉）。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const threeUrl = pathToFileURL(join(root, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};return n(s,c);}`));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : k.startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = { createElement: el, body: el(), createElementNS: el };

const THREE = await import('three');
const V = join(root, 'src/vendor/townscaper-rea-refactoring/src');
const { World } = await import(pathToFileURL(join(V, 'core/world.js')).href);
const { Battle } = await import(pathToFileURL(join(V, 'badnorth/battle.js')).href);
const { beginSpearThrust } = await import(pathToFileURL(join(V, 'core/spear-thrust.js')).href);

const cells = Array.from({ length: 6 }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < 5 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const world = new World({ cells }); for (const c of cells) if (c.id) world.fill(c, 1, { rock: true });
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5 && (c.id || x < .5)) ?? null : null; } };
const scene = new THREE.Group();
const view = { scene, levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [], setFireCoupling() {}, ignite() {} }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false, knockoffWater: true };
const b = new Battle(view);
b.start(world); b.nextWave = 1e9;
const squad = { id: 0, pike: true, archer: false, members: [], alive: true, flag: new THREE.Group(), goal: cells[3], goalFloor: 1 };
squad.flag.userData = { cloth: new THREE.Mesh(), SEG: 1 };
const mk = (team, x, extra = {}) => ({ team, squad: team === 0 ? squad : null, k: 0, hp: 2, max: 2, x, z: 0, y: .5, navFloor: 1, cd: 9, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, thrust: null, spearRecovery: null, ...extra });
const run = (sec) => { for (let i = 0; i < sec * 60; i++) b.update(1 / 60); };

// ① 码头边被矛顶下水
let def = mk(0, 1.0, { face: -Math.PI / 2 }), vik = mk(1, .58);
b.units = [def, vik]; b.squads = [];
def.thrust = beginSpearThrust(def, { x: -1, z: 0 }, { targets: [vik] });
for (let i = 0; i < 14 && !vik.fall; i++) b.update(1 / 60);
assert.ok(vik.fall, '矛顶到水边 → 进入 fall');
assert.ok(vik.fall.spin, '被打飞有翻滚');
const peak = { y: vik.y };
for (let i = 0; i < 120 && !vik.drowned; i++) { b.update(1 / 60); peak.y = Math.max(peak.y, vik.y); }
assert.ok(peak.y > .5, '离地上抛看得见');
assert.ok(vik.drowned && vik.dead, '落水即溺水');
assert.ok(vik.x < .5, '落点在海格');
const bloodAtDrown = b.blood.count, dropsInAir = b.drops.length;   // 挨打那一下的血滴还在空中，落地会照常成斑
assert.ok(b.splashes.length >= 2 && b.splashes.some((s) => s.mesh.visible || s.t < 0), '出水花');
assert.equal(b.drownStats.vik, 1, "溺水计数");
run(2);
assert.ok(vik.drown.t > 1.6, '下沉计时');
assert.ok(b.blood.count <= bloodAtDrown + dropsInAir, '溺水本身不铺血、不留尸体血泊');

// ② 码头中间挨矛：只退不掉
def = mk(0, 3.45, { face: -Math.PI / 2 }); vik = mk(1, 3.05);
b.units = [def, vik];
def.thrust = beginSpearThrust(def, { x: -1, z: 0 }, { targets: [vik] });
for (let i = 0; i < 14; i++) b.update(1 / 60);
assert.ok(vik.hp < 2, '挨到矛');
assert.ok(!vik.fall && !vik.drowned, '离水远：不掉');
assert.ok(vik.x < 3.05, '沿矛被顶着后退');

// ③ 普通近战水边（随机固定 0.1 → 必中 60%）
const R = Math.random; Math.random = () => .1;
def = mk(0, .85, { squad: { ...squad, pike: false, members: [] }, face: -Math.PI / 2, cd: 0 }); vik = mk(1, .62, { cd: 9 });
b.units = [def, vik];
for (let i = 0; i < 90 && !vik.fall && !vik.drowned; i++) b.update(1 / 60);
Math.random = R;
assert.ok(vik.fall || vik.drowned, '普通近战在水边也会打下水');
run(2);
assert.ok(vik.drowned, '最终溺水');
console.log('PASS 击退落水：矛顶下码头 → 上抛翻滚 → 溺水 + 水花；码头中间只后退；普通近战水边 60% 掉水', JSON.stringify(b.drownStats));

// ④ 单位 / 长船放大（view.unitScale，苔庭 1.7 m）：人、旗、船、座位同倍放大；战斗逻辑不变
{
  const v2 = { ...view, scene: new THREE.Group(), unitScale: 2.36 };
  const b2 = new Battle(v2); b2.start(world);
  const sq = b2.spawnSquad({ cell: cells[3], size: 4, flagScale: 1 });
  assert.ok(Math.abs(sq.members[0].bodyScale - 2.36) < 1e-9, '守军 ×2.36');
  assert.ok(Math.abs(sq.flag.scale.x - 2.36) < 1e-9 && Math.abs(sq.flag.userData.scale - 2.36) < 1e-9, '旗 ×2.36');
  b2.nextWave = 0; b2.update(1 / 60);
  const boat = b2.boats[0];
  assert.ok(boat, '来船');
  assert.ok(Math.abs(boat.mesh.scale.x - 2.36) < 1e-9, '长船 ×2.36');
  assert.ok(boat.crew.every((u) => u.bodyScale >= 2.36 - 1e-9), '船上维京人 ×2.36');
  const seat = boat.crew.map((u) => Math.hypot(u.x - boat.x, u.z - boat.z));
  assert.ok(Math.max(...seat) > 0.3, '座位随船拉开（原 ≤0.36，×2.36 后最远 ≈0.85）');
  console.log('PASS 单位放大：守军 / 旗 / 长船 / 船上维京人同倍放大，船退后', JSON.stringify({ stop: boat.stop.map((x) => +x.toFixed(2)), seatMax: +Math.max(...seat).toFixed(2) }));
}
