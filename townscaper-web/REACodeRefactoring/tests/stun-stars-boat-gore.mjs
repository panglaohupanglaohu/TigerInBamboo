// 第 49 轮：984813819280191488 僵直头顶星 + 946660607008403456 船体浸血。原：903647529203634176 · 架矛：敌人进入 1.6 格（但还没到 0.44 突刺距离）→ 矛压平指向来敌、略前探；没敌人 → 斜举 40°；刺出 → 水平。
// 矛杆偏粉色 + 白矛头（原片「粉红放射线」）。node 直接跑 Battle，读实例矩阵。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { Battle } = await import('../src/badnorth/battle.js');
const { beginSpearThrust } = await import('../src/core/spear-thrust.js');
const cells = Array.from({ length: 8 }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < 7 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const world = new World({ cells }); for (const c of cells) if (c.id) world.fill(c, 1, { rock: true });   // 格 0 是海（长船要靠岸）
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5) ?? null : null; } };
const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false };
const b = new Battle(view); b.start(world); b.nextWave = 1e9;
const squad = { id: 0, pike: true, members: [], alive: true, flag: new THREE.Group(), goal: cells[1], goalFloor: 1 };
squad.flag.userData = { cloth: new THREE.Mesh(), SEG: 1 };

// ① 僵直头顶星：僵直单位 3 颗，绕头转；随身高缩放；僵直结束清零
const u = { team: 0, squad, k: 0, hp: 3, max: 3, x: 3, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: .6, radius: .055 };
b.units = [u]; b.paused = true; b.update(0);
assert.equal(b.mStun.count, 3, '僵直 → 3 颗星');
const m = new THREE.Matrix4(); b.mStun.getMatrixAt(0, m); const sp = new THREE.Vector3().setFromMatrixPosition(m);
assert.ok(sp.y > u.y + .18 && Math.hypot(sp.x - u.x, sp.z - u.z) < .06, '星在头顶一圈');
u.bodyScale = 2; b.update(0); b.mStun.getMatrixAt(0, m); sp.setFromMatrixPosition(m); assert.ok(sp.y > u.y + .4, '随身高缩放');
u.stunRemaining = 0; b.update(0); assert.equal(b.mStun.count, 0, '僵直结束星消失');
// ② 船体浸血：船上的人被箭射中流血 → 船身由木色往暗红过渡，死伤越多越红
b.units = []; b.nextWave = 0; b.paused = false; b.update(1 / 60); b.paused = true;
const boat = b.boats[0]; assert.ok(boat && boat.mesh.userData.hullMat, '来船、有自己的船体材质');
const base = boat.mesh.userData.hullMat.color.clone(), redness = (c) => c.r - (c.g + c.b) / 2;
const shoot = (tg) => { const y = tg.y + .08 * (tg.bodyScale ?? 1); b.arrows.push({ mesh: new THREE.Mesh(), from: [tg.x, y, tg.z], to: [tg.x, y, tg.z], t: 0, dur: 1e-3, shot: { v: 0, th: 0 }, target: tg, stuck: false }); b.paused = false; b.update(1 / 60); b.paused = true; };
const r0 = redness(base); let r1 = r0;
for (const v of boat.crew.slice(0, 2)) shoot(v);
r1 = redness(boat.mesh.userData.hullMat.color);
assert.ok(r1 > r0, '两箭后船身变红');
for (const v of boat.crew.slice(0, 8)) { shoot(v); shoot(v); }
const r2 = redness(boat.mesh.userData.hullMat.color);
assert.ok(r2 > r1 && boat.gore > .9, `多次死伤后接近浸满（gore ${boat.gore.toFixed(2)}）`);
console.log('PASS 僵直头顶三星（随身高、结束即消失）+ 船体浸血（木色→暗红，随死伤累积）', JSON.stringify({ r0: +r0.toFixed(3), r1: +r1.toFixed(3), r2: +r2.toFixed(3), gore: +boat.gore.toFixed(2) }));
