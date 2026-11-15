// 第 54 轮：984813819280191488（盾面浸血 + 贴地血泊往外渗）与 946660607008403456（船舱整片血池）。
// 原片判读：船上不是几个血点，是整条舱底一片连续暗红、白尸体压在上面；地面血泊会随回合往外渗并成片。
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
const cells = Array.from({ length: 8 }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < 7 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const world = new World({ cells }); for (const c of cells) if (c.id) world.fill(c, 1, { rock: true });
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5) ?? null : null; } };
const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false };
const b = new Battle(view); b.start(world); b.nextWave = 1e9;

// ① 盾面吃同一份 aSoak，但门限是自己的（不能和身体/头共用 program）
assert.ok(b.mShield.geometry.getAttribute('aSoak'), '盾面挂了 aSoak');
const bodyKey = b.mBody.material.customProgramCacheKey(), headKey = b.mHead.material.customProgramCacheKey(), shieldKey = b.mShield.material.customProgramCacheKey();
assert.notEqual(bodyKey, headKey, '身体/头不许共用 program');
assert.notEqual(bodyKey, shieldKey, '盾/身体不许共用 program');
assert.deepEqual(
  [b.mShield.userData.soak.uSoakY0.value, b.mShield.userData.soak.uSoakYS.value],
  [0.030, 0.080], '盾面浸血门限 = 圆柱局部 y 0.03…0.11');

// ② 船舱血池：随 gore 变浓、沿船长铺开；未受伤时是 0（不能一开始就红）
b.units = []; b.nextWave = 0; b.paused = false; b.update(1 / 60); b.paused = true;
const boat = b.boats[0];
const pool = boat.mesh.userData.deckPool;
assert.ok(pool, '长船带舱底血池');
assert.equal(pool.material.opacity, 0, '新船血池透明');
assert.ok(pool.geometry.getAttribute('position').count === 50, '血池是贴舱底的带子（25 段 × 2 边）');
const shoot = (tg) => { const y = tg.y + .08 * (tg.bodyScale ?? 1); b.arrows.push({ mesh: new THREE.Mesh(), from: [tg.x, y, tg.z], to: [tg.x, y, tg.z], t: 0, dur: 1e-3, shot: { v: 0, th: 0 }, target: tg, stuck: false }); b.paused = false; b.update(1 / 60); b.paused = true; };
shoot(boat.crew[0]);
const o1 = pool.material.opacity, x1 = pool.scale.x;
assert.ok(o1 > 0 && x1 > 0.26, `流血后血池出现（opacity ${o1.toFixed(2)}, scaleX ${x1.toFixed(2)}）`);
for (const v of boat.crew.slice(0, 8)) { shoot(v); shoot(v); }
const o2 = pool.material.opacity, x2 = pool.scale.x;
assert.ok(o2 > o1 && x2 > x1, '死伤越多越浓越长');
assert.ok(o2 <= 0.94, '不满到不透光');
// 血池的 y 必须跟着舱底凹曲线走（中间低、两头高），否则会穿出船板
const pp = pool.geometry.getAttribute('position');
const yMid = (pp.getY(24) + pp.getY(25)) / 2, yEnd = (pp.getY(0) + pp.getY(1)) / 2;
assert.ok(yEnd - yMid > 0.06, `两头比中间高出一条凹舱（mid ${yMid.toFixed(3)} end ${yEnd.toFixed(3)}）`);

// ③ 地面血泊会往外渗（约 2.4s 铺到 1.42 倍），之后定型、不再改写实例矩阵
b.boats = []; b.blood.count = 0; b.poolGrow = [];
const squad = { id: 0, pike: false, members: [], alive: true, flag: new THREE.Group(), goal: cells[1], goalFloor: 1 };
squad.flag.userData = { cloth: new THREE.Mesh(), SEG: 1 };
const ground = { team: 0, squad, k: 0, hp: 3, max: 3, x: 3, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 };
b.units = [ground];
const scaleOf = (i) => { const m = new THREE.Matrix4(); b.blood.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixScale(m).x; };
const id0 = b.blood.count;
b.arrows.push({ mesh: new THREE.Mesh(), from: [ground.x, ground.y + .08, ground.z], to: [ground.x, ground.y + .08, ground.z], t: 0, dur: 1e-3, shot: { v: 0, th: 0 }, target: ground, stuck: false });
b.paused = false; b.update(1 / 60); b.paused = true;
assert.ok(ground.hp < 3, '箭命中掉血');
const fresh = b.blood.count - 1, s0 = scaleOf(fresh);
assert.ok(b.poolGrow.length > 0, '地面血泊进入扩张队列');
b.paused = false;
for (let i = 0; i < 90; i++) b.update(1 / 30);      // 3s
b.paused = true;
const s3 = scaleOf(fresh);
assert.ok(s3 > s0 * 1.3 && s3 < s0 * 1.5, `3s 后铺开到 1.3…1.5 倍（${(s3 / s0).toFixed(2)}×）`);
assert.equal(b.poolGrow.length, 0, '铺完出队，不再每帧改矩阵');
const sFinal = scaleOf(fresh);
b.paused = false; for (let i = 0; i < 30; i++) b.update(1 / 30); b.paused = true;
assert.equal(scaleOf(fresh), sFinal, '定型后不再长大');
console.log('PASS 盾面浸血门限独立 + 船舱整片血池 + 地面血泊外渗定型', JSON.stringify({
  shieldY0: b.mShield.userData.soak.uSoakY0.value, poolOpacity: +o2.toFixed(2), poolScaleX: +x2.toFixed(2),
  deckDip: +(yEnd - yMid).toFixed(3), poolGrow: +(s3 / s0).toFixed(2),
}));
