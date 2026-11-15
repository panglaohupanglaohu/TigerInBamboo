// 苔庭：维京人打霸天（mossBatianAttack.js）。node 跑真 REA Battle + 假霸天舰队 / 假重甲兵：
//   ① 上岸维京人向 140 m 内的霸天单位投矛，矛飞到船体 → applySaihojiFleetHullContact → fleet.receiveHit；有护盾时中途被拦截；
//   ② 重甲兵落在舞台陆地上 → 维京人 REA 寻路扑过去（u.tmGoal），2 m 内挥斧 hitVanguard('melee')；重甲兵反手砍维京人。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const threeUrl = pathToFileURL(join(root, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};return n(s,c);}`));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, documentElement: el() }, { get: (t, k) => k in t ? t[k] : () => el() });
globalThis.addEventListener ??= () => {}; globalThis.location ??= { search: "" }; try { globalThis.navigator ??= {}; } catch {}
globalThis.window ??= globalThis;

const THREE = await import('three');
const V = join(root, 'src/vendor/townscaper-rea-refactoring/src');
const { World } = await import(pathToFileURL(join(V, 'core/world.js')).href);
const { Battle } = await import(pathToFileURL(join(V, 'badnorth/battle.js')).href);
const { createVikingBatianAttack } = await import(pathToFileURL(join(root, 'src/world/vikings/mossBatianAttack.js')).href);

// 舞台：8×1 条形陆地（格 0 是海），舞台坐标 = 世界坐标 × 2（scale 2），放在 y=160 的星球表面
const cells = Array.from({ length: 8 }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < 7 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const world = new World({ cells }); for (const c of cells) if (c.id) world.fill(c, 1, { rock: true });
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5 && (c.id || x < .5)) ?? null : null; } };
const scene = new THREE.Scene();
const anchor = new THREE.Group(); anchor.matrixAutoUpdate = false; anchor.matrix.makeScale(2, 2, 2).setPosition(0, 160, 0); scene.add(anchor); anchor.updateMatrixWorld(true);
const view = { scene: anchor, levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false };
const battle = new Battle(view); battle.start(world); battle.nextWave = 1e9;
const stage = { battle, anchor, view, index, world, toWorld: (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(anchor.matrixWorld), worldToStage: (w, out = new THREE.Vector3()) => out.copy(w).applyMatrix4(anchor.matrixWorld.clone().invert()) };

// 假霸天：一艘护航舰停在舞台上方 30 m，护盾可开关
const ship = new THREE.Object3D(); ship.position.set(6, 190, 0); scene.add(ship);
const hits = []; let shield = false;
const fleet = { active: true, units: () => [ship], snapshot: () => ({ target: 'moss', cycle: 1 }),
  shieldPoint: (m, a, b) => shield ? b.clone() : null,
  receiveHit: (m, amount, point) => { hits.push({ amount, shield }); return { accepted: true, intercepted: shield, disabled: false }; } };
// 假重甲兵：落在格 6（舞台 x=6 → 世界 x=12）
const squad = new THREE.Group(); squad.name = 'vanguard-squad'; scene.add(squad);
const tr = new THREE.Object3D(); tr.position.set(12, 161, 0); squad.add(tr); squad.userData.troopers = [tr];
let strikes = 0; tr.userData.saihojiReceiveHit = (kind) => { strikes++; return { wounded: strikes % 15 === 0, dead: false }; };
scene.updateMatrixWorld(true);

const mk = (x) => ({ team: 1, squad: null, k: 0, hp: 2, max: 2, x, z: 0, y: .5, navFloor: 1, cd: 9, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, thrust: null, spearRecovery: null, radius: .055 });
const vik = [mk(2), mk(2.2), mk(2.4)];
battle.units = [...vik];
const atk = createVikingBatianAttack({ scene, stage, getFleet: () => fleet });
const step = (n) => { for (let i = 0; i < n; i++) { battle.update(1 / 60); atk.update(1 / 60); } };

step(60 * 6);
assert.ok(atk.stats.throws > 0, '投矛');
assert.ok(hits.length > 0 && hits.some((h) => !h.shield), '矛打到霸天船体（receiveHit）');
assert.ok(atk.stats.hull > 0, '记船体命中');
assert.ok(atk.stats.pursuing > 0 || atk.stats.trooperStrikes > 0, '扑向重甲兵');
assert.ok(atk.stats.trooperStrikes > 0, '近身砍重甲兵');
assert.ok(vik.some((u) => u.x > 4.5), '维京人沿 REA 寻路走到重甲兵那边');
assert.ok(atk.stats.vikingsCut > 0, '重甲兵反手砍维京人');

tr.userData.dead = true;   // 重甲兵倒下，活着的维京人回头继续投矛
shield = true; const s0 = atk.stats.shield;
step(60 * 5);
assert.ok(atk.stats.shield > s0, '有护盾时矛在半空被拦截');
console.log('PASS 苔庭维京人打霸天：投矛中船体 / 被护盾拦截；扑重甲兵、挥斧、被反砍', JSON.stringify(atk.stats));
