import * as THREE from './vendor/three.module.js';
import { createFisherBoat } from './src/assets/harbor.js';

// 由浏览器实测日志取得
const eyeWorld = new THREE.Vector3(-64.59, -44.33, -114.55); // 船眼（本地 1.78,0.52,0）
const elderPos = new THREE.Vector3(-75.6, -52.71, -131.7);   // 老人落点
const WATER_R = 160.72;

const boat = createFisherBoat();
boat.scale.setScalar(2);
boat.rotation.set(0.16, 2.35, 0.42);
boat.updateMatrixWorld(true);
// shipPos = eyeWorld - M * localEye
const localEye = new THREE.Vector3(1.78, 0.52, 0);
const off = localEye.clone().applyMatrix4(new THREE.Matrix4().compose(
  new THREE.Vector3(), boat.quaternion, boat.scale));
const shipPos = eyeWorld.clone().sub(off);
boat.position.copy(shipPos);
boat.updateMatrixWorld(true);

// 校验：重建后船眼世界坐标应与实测一致
const eyeCheck = boat.localToWorld(localEye.clone());
console.log('eye check:', eyeCheck.toArray().map(n => +n.toFixed(2)), '(实测 [-64.59,-44.33,-114.55])');

const rc = new THREE.Raycaster();
const elderBoatDist = elderPos.distanceTo(eyeWorld);
console.log('elder 与船眼距离:', +elderBoatDist.toFixed(2));

// 从落点向四周 26 个方向打射线，量到船壳的距离；全部极近 ⇒ 被包在壳内
let hits = 0, minDist = Infinity;
const dirs = [];
for (let a = 0; a < 360; a += 45) {
  for (const el of [-0.6, 0, 0.6]) {
    const d = new THREE.Vector3(Math.cos(a * Math.PI / 180) * Math.cos(el), Math.sin(el), Math.sin(a * Math.PI / 180) * Math.cos(el));
    dirs.push(d);
  }
}
for (const d of dirs) {
  rc.set(elderPos.clone(), d);
  rc.far = 30;
  const h = rc.intersectObject(boat, true);
  if (h.length) { hits++; minDist = Math.min(minDist, h[0].distance); }
}
console.log('26 向射线命中船壳:', hits + '/26, 最近距离:', +minDist.toFixed(2));
console.log(hits >= 22 && minDist < 1.5 ? '【落点被船壳包住 → 会被遮挡】' : '【落点在船壳之外 → 正常可见】');

// 模拟玩家/相机视角遮挡：从“船眼正上方水面外 8 单位”看向老人，中间是否隔船壳
const viewer = elderPos.clone().normalize().multiplyScalar(WATER_R + 2.0)
  .add(elderPos.clone().sub(eyeWorld).setLength(6));
const toElder = elderPos.clone().sub(viewer).normalize();
rc.set(viewer, toElder);
rc.far = viewer.distanceTo(elderPos);
const block = rc.intersectObject(boat, true);
console.log('视角→老人 通路被船壳挡住:', block.length ? '是（第一遮挡距离 ' + (+block[0].distance.toFixed(2)) + '）' : '否');
