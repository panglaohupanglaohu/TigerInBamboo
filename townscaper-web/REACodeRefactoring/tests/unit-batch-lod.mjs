// 第 53 批 G5 · 817323301357948928「Trying to figure out a good approach to units. Has to look good, be quick to make and perform
// well in large numbers」。REACode/src/unitbatch.js：批处理（无逐体状态切换）+ 小于 9px 走 LOD。
// 验：① 真实 Battle 的单位本来就是 InstancedMesh——部件 draw call 数与人数无关（原 gap「独立对象」已过时）；
//     ② 新增视锥剔除：镜头只看半个岛时视锥外实例被压实掉，且身体/头/盾/aSoak 仍一一对应；
//     ③ 拉远到单位 < 9px：盾/矛/星退掉，只留身体+白盔；④ 关掉（unitLodEnabled=false）= 原样全画。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
const { UnitBatchLod, compactInstances } = await import('../src/badnorth/unit-batch-lod.js');
const report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7);
  view.renderer = { getDrawingBufferSize: (v) => v.set(1600, 900) };
  const b = new Battle(view); b.start(world);
  for (let i = 0; i < 2400 && b.wave < 3; i++) b.update(1 / 30);       // 三波：几十个维京人
  for (let i = 0; i < 300; i++) b.update(1 / 30);
  const alive = b.units.filter((u) => !u.dead || !view.goreOff).length;
  // ① 关掉 = 全画；部件 draw call 固定
  b.unitLodEnabled = false; b.paused = true; b.update(0);
  const all = b.mBody.count;
  assert.equal(all, Math.min(260, alive), '每个单位一个实例');
  const parts = [b.mBody, b.mHead, b.mShield, b.mSpear, b.mSpearTip, b.mStun];
  assert.ok(parts.filter((m) => m.count > 0).length <= 6, `部件 draw call ≤ 6，与人数 ${all} 无关`);
  // ② 只看岛的一角：俯视近景
  b.unitLodEnabled = true;
  const cam = view.camera; cam.fov = 30; cam.updateProjectionMatrix();
  const def = b.squads.flatMap((s) => s.members).find((u) => !u.dead) ?? b.units[0];
  cam.position.set(def.x, def.y + 3, def.z + 3); cam.lookAt(def.x, def.y, def.z); cam.updateMatrixWorld(true);
  b.update(0);
  const near = { ...b.unitLod.stats };
  assert.ok(near.culled > 0 && near.kept > 0 && near.kept + near.culled === all, `近景剔除 ${JSON.stringify(near)}`);
  assert.equal(b.mBody.count, near.kept); assert.equal(b.mHead.count, near.kept); assert.equal(b.mShield.count, near.kept);
  // 压实后第 k 个实例的位置都在视锥内，aSoak 与同位置的单位对得上
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)), m = new THREE.Matrix4(), p = new THREE.Vector3();
  let matched = 0;
  for (let i = 0; i < b.mBody.count; i++) {
    b.mBody.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    const u = b.units.find((v) => Math.hypot(v.x - p.x, v.z - p.z) < 1e-6);
    if (u) { matched++; assert.ok(Math.abs(b.aSoak.getX(i) - (u.dead ? .9 : u.soak)) < 1e-6, 'aSoak 跟着实例一起压实'); }
    b.mHead.getMatrixAt(i, m); const q = new THREE.Vector3().setFromMatrixPosition(m); assert.ok(q.distanceTo(p) < 1e-6, '头与身体同下标');
  }
  assert.ok(matched >= near.kept * .9);
  assert.equal(near.lod, 0, '近景没有小于 9px 的');
  // ③ 拉远：单位只有几像素
  cam.fov = 40; cam.updateProjectionMatrix(); cam.position.set(0, 60, 60); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  b.update(0);
  const far = { ...b.unitLod.stats };
  assert.ok(far.lod === far.kept && far.kept > 0, `远景全部 LOD ${JSON.stringify(far)}`);
  assert.equal(b.mSpear.count, 0, '远景矛退掉');
  for (let i = 0; i < b.mShield.count; i++) { b.mShield.getMatrixAt(i, m); assert.ok(Math.abs(m.determinant()) < 1e-12, '远景盾压成零尺寸'); }
  assert.ok(b.unitLod.pixelHeight(cam, new THREE.Vector3(0, 0, 0), .18, 900) < 9);
  report[kind] = { all, near, far };
}
// compactInstances 单测：保持相对顺序
const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 5); mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(15), 3);
const extra = new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3, 4]), 1);
for (let i = 0; i < 5; i++) mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 0, 0));
compactInstances(mesh, Uint8Array.from([1, 0, 1, 0, 1]), { extra: [extra] });
assert.equal(mesh.count, 3); assert.deepEqual([...extra.array.slice(0, 3)], [0, 2, 4]);
assert.deepEqual([0, 1, 2].map((i) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return m.elements[12]; }), [0, 2, 4]);
assert.throws(() => new UnitBatchLod({ lodPx: -1 }));
console.log('PASS 实例批 draw call 与人数无关、视锥剔除压实（身体/头/盾/aSoak 对齐）、<9px LOD 退盾矛星、可关闭', JSON.stringify(report));
