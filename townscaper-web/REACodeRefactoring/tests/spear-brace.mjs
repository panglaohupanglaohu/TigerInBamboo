// 903647529203634176 · 架矛：敌人进入 1.6 格（但还没到 0.44 突刺距离）→ 矛压平指向来敌、略前探；没敌人 → 斜举 40°；刺出 → 水平。
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
const world = new World({ cells }); for (const c of cells) world.fill(c, 1, { rock: true });
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5) ?? null : null; } };
const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false };
const b = new Battle(view); b.start(world); b.nextWave = 1e9;
const squad = { id: 0, pike: true, members: [], alive: true, flag: new THREE.Group(), goal: cells[1], goalFloor: 1 };
squad.flag.userData = { cloth: new THREE.Mesh(), SEG: 1 };
const pike = { team: 0, squad, k: 0, hp: 3, max: 3, x: 1, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: Math.PI, soak: 0, stunRemaining: 0, radius: .055 };
const read = () => { const m = new THREE.Matrix4(), t = new THREE.Matrix4(); b.mSpear.getMatrixAt(0, m); b.mSpearTip.getMatrixAt(0, t); const d = new THREE.Vector3(0, 0, 1).transformDirection(m), len = new THREE.Vector3().setFromMatrixColumn(m, 2).length(); const c = new THREE.Color(); b.mSpear.getColorAt(0, c); return { pitch: Math.asin(d.y) * 180 / Math.PI, yaw: Math.atan2(d.x, d.z), len, tip: new THREE.Vector3().setFromMatrixPosition(t), base: new THREE.Vector3().setFromMatrixPosition(m), color: c.getHexString(), tips: b.mSpearTip.count }; };
// ① 没敌人：斜举 40°
b.units = [pike]; b.paused = true; b.update(0);
let r = read();
assert.ok(Math.abs(r.pitch - 40) < 0.5, `待机斜举 ${r.pitch.toFixed(1)}°`);
assert.equal(r.tips, 1, '有矛头');
assert.ok(r.base.distanceTo(r.tip) > .3 && Math.abs(r.base.distanceTo(r.tip) - r.len) < 1e-6, '矛头在杆端');
// ② 来敌 1.1 格（未进突刺距离）：架矛压平指向敌人、杆 0.38
const vik = { team: 1, squad: null, k: 0, hp: 2, max: 2, x: 2.1, z: 0.2, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 };
b.units = [pike, vik]; b.paused = false; b.update(1e-4); b.paused = true; b.update(0);
r = read();
const want = Math.atan2(vik.x - pike.x, vik.z - pike.z);
assert.ok(Math.abs(r.pitch) < 0.5, `架矛水平 ${r.pitch.toFixed(2)}°`);
assert.ok(Math.abs(r.yaw - want) < 0.05, '指向来敌');
assert.ok(Math.abs(r.len - .38) < 1e-6, '架矛前探 0.38');
assert.equal(r.color, 'e2a59c', '矛杆偏粉');
// ③ 刺出：水平
pike.thrust = beginSpearThrust(pike, { x: 1, z: 0 }); b.paused = true; b.update(0);
r = read(); assert.ok(Math.abs(r.pitch) < 0.5, '刺出水平');
// ④ 敌人远去：回到斜举
pike.thrust = null; pike.spearRecovery = null; vik.x = 6; b.paused = false; b.update(1e-4); b.paused = true; b.update(0);
r = read(); assert.ok(Math.abs(r.pitch - 40) < 0.5, '敌人走远回斜举');
console.log('PASS 架矛：无敌斜举 40° / 来敌压平指向敌人前探 0.38 / 刺出水平 / 敌退回斜举；粉色矛杆 + 白矛头在杆端');
