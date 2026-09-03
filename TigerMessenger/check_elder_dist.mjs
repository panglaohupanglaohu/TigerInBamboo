import * as THREE from './vendor/three.module.js';
import { createFisherBoat } from './src/assets/harbor.js';

const eyeWorld = new THREE.Vector3(-64.59, -44.33, -114.55);
const elderPos = new THREE.Vector3(-75.6, -52.71, -131.7);
const WATER_R = 160.72;

const boat = createFisherBoat();
boat.scale.setScalar(2);
boat.rotation.set(0.16, 2.35, 0.42);
boat.updateMatrixWorld(true);
const off = new THREE.Vector3(1.78, 0.52, 0).applyMatrix4(new THREE.Matrix4().compose(
  new THREE.Vector3(), boat.quaternion, boat.scale));
boat.position.copy(eyeWorld.clone().sub(off));
boat.updateMatrixWorld(true);

const center = boat.getWorldPosition(new THREE.Vector3());
console.log('船心半径:', +center.length().toFixed(1));

// 遍历船壳顶点（世界系），分别统计：水线上方顶点里距老人最近者；以及全部顶点最近者
let minAbove = Infinity, minAny = Infinity, aboveCount = 0;
const tmp = new THREE.Vector3();
boat.traverse((o) => {
  if (!o.isMesh || !o.geometry?.attributes?.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 3) { // 每3个顶点取1个即可
    tmp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    const d = tmp.distanceTo(elderPos);
    minAny = Math.min(minAny, d);
    if (tmp.length() >= WATER_R) { aboveCount++; minAbove = Math.min(minAbove, d); }
  }
});
console.log('老人→任意船壳顶点最近:', +minAny.toFixed(1));
console.log('老人→水线上方船壳最近:', +minAbove.toFixed(1), '（水线上顶点数', aboveCount + '）');
console.log('老人自身半径:', +elderPos.length().toFixed(2), '水面:', WATER_R);
