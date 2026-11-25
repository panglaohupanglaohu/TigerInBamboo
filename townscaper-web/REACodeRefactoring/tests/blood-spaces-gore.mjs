// 两条 combat 队列条目残差批（984813819280191488 + 999185422403055616）：
//   ① hp→体表浸血映射锁死：damageCombatUnit → soak = 1−hp/max，aSoak 随绘制同步（确定性 + hp 边界 + 不伤走位）；
//   ② 物体空间血斑双空间：躯干 = 单位空间（sprite-space 对应物，钉在躯干），头/盾 = 部件空间
//      （skin-space 对应物，局部坐标跟头/手臂走）—— uSoakSpace/uSoakPivot uniforms + u.headYaw/headRoll 独立姿态；
//   ③ gore 总开关补漏：goreOff → aSoak 归零、体表发红归零（原先只关地面血/血滴/尸体，体表浸血漏关）；
//   ④ 0096 棋盘格分界调试层：setSoakDebug 翻 uSoakDebug uniform；
//   ⑤ c01 bloodStack（opt-in 可选美术增强，既有机制复验）：同点位反复流血 → 重叠旧斑逐次变暗。
// node --test tests/blood-spaces-gore.mjs
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
const mkView = () => ({ scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: 0 }, navLayer: null, effects: { fireSources: [], showFire() {} }, smoke: { sources: [] }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera: new THREE.PerspectiveCamera(), debugState: {}, goreOff: false });
const view = mkView();
const b = new Battle(view); b.start(world); b.nextWave = 1e9;
const squad = { id: 0, pike: false, members: [], alive: true, flag: new THREE.Group(), goal: cells[1], goalFloor: 1 };
squad.flag.userData = { cloth: new THREE.Mesh(), SEG: 1 };
const mkUnit = (x, hp = 3) => { const u = { team: 0, squad, k: 0, hp, max: hp, x, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 }; squad.members.push(u); return u; };
const bodyM = new THREE.Matrix4(), headM = new THREE.Matrix4(), col = new THREE.Color();

// ── ① hp→体表浸血：确定性 + 边界（u.soak 全程锁 1−hp/max，aSoak 同步）──────────
const u1 = mkUnit(3); b.units = [u1]; b.paused = true; b.update(0);
assert.equal(b.aSoak.getX(0), 0, '满血 → aSoak 0');
const x0 = u1.x, z0 = u1.z;
b.applyHit(u1, null);                              // 命中 1：hp 3→2
assert.ok(Math.abs(u1.soak - 1 / 3) < 1e-12, `命中后 soak=1/3（${u1.soak}）`);
b.paused = true; b.update(0);
assert.ok(Math.abs(b.aSoak.getX(0) - 1 / 3) < 1e-6, 'aSoak 跟着 hp 同步');
b.applyHit(u1, null);                              // 命中 2：hp 2→1
assert.ok(Math.abs(u1.soak - 2 / 3) < 1e-12, '再命中 soak=2/3');
b.update(0);
assert.ok(Math.abs(b.aSoak.getX(0) - 2 / 3) < 1e-6, 'aSoak=2/3');
assert.equal(u1.x, x0, 'applyHit(by=null) 不产生击退位移');
assert.equal(u1.dead, false, '还有血还活着');
b.applyHit(u1, null);                              // 命中 3：hp 1→0 → dead
assert.ok(u1.dead && u1.hp === 0 && u1.soak === 1, '阵亡：hp=0、soak=1');
b.update(0);
assert.ok(Math.abs(b.aSoak.getX(0) - 0.9) < 1e-6, '阵亡 aSoak=0.9（整具浸透）');
// 边界：soak 不越界（再打不会超 1、不为负）
b.applyHit(u1, null);
assert.ok(u1.soak <= 1 && u1.soak >= 0, 'soak 钳在 [0,1]');

// ── ② 双空间血斑：躯干=单位空间，头/盾=部件空间 ────────────────────────────────
assert.equal(b.mBody.userData.soak.uSoakSpace.value, 0, '躯干走单位空间（sprite-space 对应）');
assert.equal(b.mHead.userData.soak.uSoakSpace.value, 1, '头/盔走部件空间（skin-space 对应）');
assert.equal(b.mShield.userData.soak.uSoakSpace.value, 1, '盾/手臂走部件空间');
const hpiv = b.mHead.userData.soak.uSoakPivot.value, spiv = b.mShield.userData.soak.uSoakPivot.value;
assert.ok(Math.abs(hpiv.y - 0.145) < 1e-6, '头 pivot = 盔心 (0,0.145,0)');
assert.ok(Math.abs(spiv.y - 0.07) < 1e-6 && Math.abs(spiv.z - 0.05) < 1e-6, '盾 pivot = 盾心 (0,0.07,0.05)');
assert.notEqual(b.mBody.material.customProgramCacheKey(), b.mHead.material.customProgramCacheKey(), '两种空间不许共用 program');

// 头有独立姿态通道：headRoll≠0 → mHead 旋转与 mBody 不同、平移列不变（斑纹钉在头上而不是单位框架上）
const u2 = mkUnit(5); b.units = [u2]; b.paused = true; b.update(0);
b.mBody.getMatrixAt(0, bodyM); b.mHead.getMatrixAt(0, headM);
assert.ok(bodyM.equals(headM), 'headRoll=0：头与身体同矩阵');
u2.headRoll = 0.4; b.update(0);
b.mBody.getMatrixAt(0, bodyM); b.mHead.getMatrixAt(0, headM);
const bp = new THREE.Vector3().setFromMatrixPosition(bodyM), hp2 = new THREE.Vector3().setFromMatrixPosition(headM);
assert.ok(bp.distanceTo(hp2) < 1e-6, '头局部姿态不改平移列（LOD 压实对齐不破）');
const bq = new THREE.Quaternion().setFromRotationMatrix(bodyM), hq = new THREE.Quaternion().setFromRotationMatrix(headM);
assert.ok(bq.angleTo(hq) > 0.1, `headRoll 时头与身体姿态分离（${bq.angleTo(hq).toFixed(2)} rad）`);
u2.headRoll = 0; b.update(0);
b.mHead.getMatrixAt(0, headM); assert.ok(bodyM.equals(headM), '姿态归零 → 恢复同矩阵');

// ── ③ gore 总开关：体表浸血归零 + 往返恢复 ────────────────────────────────────
const u3 = mkUnit(6); u3.soak = 0.5; u3.hp = 1.5; b.units = [u3]; b.paused = true; b.update(0);
assert.ok(Math.abs(b.aSoak.getX(0) - 0.5) < 1e-6, 'gore 开：aSoak=0.5');
b.mBody.getColorAt(0, col); const redOn = col.r - (col.g + col.b) / 2;
view.goreOff = true; b.update(0);
assert.equal(b.aSoak.getX(0), 0, 'gore 关：aSoak 归零（体表血斑整层消失）');
b.mBody.getColorAt(0, col); const redOff = col.r - (col.g + col.b) / 2;
assert.ok(redOff < redOn - 0.02, `gore 关：体表不再发红（redness ${redOn.toFixed(3)}→${redOff.toFixed(3)}）`);
view.goreOff = false; b.update(0);
assert.ok(Math.abs(b.aSoak.getX(0) - 0.5) < 1e-6, 'gore 恢复：aSoak 回 0.5');
b.mBody.getColorAt(0, col); assert.ok(col.r - (col.g + col.b) / 2 > redOff, 'gore 恢复：发红回来');

// ── ④ 棋盘格调试层（0096 分界） ───────────────────────────────────────────────
b.setSoakDebug(true);
assert.equal(b.mBody.userData.soak.uSoakDebug.value, 1, '身体棋盘格 uniform 开');
assert.equal(b.mHead.userData.soak.uSoakDebug.value, 1, '头棋盘格 uniform 开');
assert.equal(b.mShield.userData.soak.uSoakDebug.value, 1, '盾棋盘格 uniform 开');
b.setSoakDebug(false);
assert.equal(b.mBody.userData.soak.uSoakDebug.value, 0, '关掉还原');

// ── ⑤ bloodStack（opt-in，既有 c01 机制）：同点位反复流血 → 重叠旧斑逐次变暗 ──
assert.throws(() => b.c01.set('bloodStackX', true), RangeError, '未知 flag 拒绝');
assert.equal(b.c01.on.bloodStack, false, 'bloodStack 默认关');
assert.equal(b.blood.instanceColor, null, '默认档：血迹无逐实例颜色');
const u4 = mkUnit(7); b.units = [u4]; b.boats = []; b.blood.count = 0; b.poolGrow = [];
b.c01.set('bloodStack', true);
assert.ok(b.blood.instanceColor, '开后建逐实例颜色');
const spotColor = (i) => { const c = new THREE.Color(); b.blood.getColorAt(i, c); return c; };
u4.hp = u4.max = 9; u4.soak = 0;
const base = b.blood.count;
b.applyHit(u4, null); b.update(0);                  // 第 1 摊（斑 i0）
assert.ok(b.blood.count > base, '流血落地成斑');
const i0 = base, c0 = spotColor(i0).r;
b.applyHit(u4, null); b.update(0);                  // 第 2 摊同点位 → i0 堆 1 层、变暗
const c0b = spotColor(i0).r;
assert.ok(b.c01.stats.stacked >= 1, `同点位重叠计入堆厚（stacked=${b.c01.stats.stacked}）`);
assert.ok(c0b < c0 - 0.02, `旧斑变暗（${c0.toFixed(2)}→${c0b.toFixed(2)}）`);
b.applyHit(u4, null); b.update(0);                  // 第 3 摊 → 更深
const c0c = spotColor(i0).r;
assert.ok(c0c < c0b, '第三次叠加：更暗');
assert.ok(b.c01.stats.maxStack >= 2, '最大堆层在涨');
b.c01.set('bloodStack', false);
assert.equal(b.c01.on.bloodStack, false, '可关');
assert.equal(b.blood.instanceColor, null, '关后逐实例颜色还原');
assert.equal(b.blood.material.color.getHexString(), '8e1f24', '关后血迹材质原色还原');
// 不伤走位/战斗逻辑：单位坐标、血量状态机没被血斑模块碰过
assert.ok(!u4.dead && u4.x === 7 && u4.z === 0, '血斑模块不动单位状态');

// ── 确定性：同一序列重放，aSoak 读数一致 ─────────────────────────────────────
{
  const b2 = new Battle(mkView()); b2.start(world); b2.nextWave = 1e9;
  const v = { team: 0, squad, k: 0, hp: 3, max: 3, x: 3, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 };
  b2.units = [v]; b2.paused = true; b2.update(0);
  const r1 = b2.aSoak.getX(0);
  b2.applyHit(v, null); b2.update(0);
  const r2 = b2.aSoak.getX(0);
  assert.equal(r1, 0, '重放满血一致');
  assert.ok(Math.abs(r2 - 1 / 3) < 1e-6, '重放命中一致（确定性）');
}
console.log('PASS hp→体表浸血（边界/确定性/不伤走位）+ 双空间血斑（头/盾部件空间+独立姿态）+ gore 全关（体表归零往返）+ 棋盘格调试 + c01 bloodStack 变暗', JSON.stringify({
  soakAfter3Hits: 1, deadSoak: 0.9, headSpace: b.mHead.userData.soak.uSoakSpace.value,
  headPoseSplit: +bq.angleTo(hq).toFixed(3), stackDarken: +c0c.toFixed(2), stacked: b.c01.stats.stacked }));
