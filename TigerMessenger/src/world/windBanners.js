// 风中旗帜（系统工坊「天气 · 风」的实景效果之一）。2026-11-09。
// 学习工坊：
//   926890207298899969 "I build a custom mesh for the flag using a bezier curve along virtual wind particles"
//     → 旗杆顶放 3 个虚拟风粒子，每个跟着前一个走、再被风吹；旗面 = 这 4 个点的三次贝塞尔曲线，竖着拉出高度做成带子网格。
//   926834721392340992 "I built a wind system to get them flapping just right" → 风读游戏同一个风（P.windSpeed / P.windDir），叠一点阵风。
//   958410200146497537 透明裁出的分叉尾 + 白色徽记（REACodeRefactoring core/banner.js 的程序化旗面，原样引入）。
// 位置：高山圣城可见房子的屋顶最高点（house-*-roof），取最高的若干座。
// 星球上「风」要投影到旗杆所在的切平面上；「下垂」朝向星球中心。全部旗面合成两个网格（两种旗），旗杆一个实例网格。
// ?windBanners=0 关闭。
import * as THREE from 'three';
import { P } from '../core/params.js';
import { bakeBanner } from '../vendor/townscaper-rea-refactoring/src/core/banner.js';

const SEG = 10, LEN = 0.7, H = 1.0, POLE = 3.2;   // 按圣城房子尺寸（约 4 米高）
function bannerTexture(color, tail, emblem) {
  const c = new THREE.Color(color), b = bakeBanner({ width: 128, height: 64, color: [c.r, c.g, c.b].map((x) => Math.round(x * 255)), tail, emblem });
  const t = new THREE.DataTexture(b.rgba, b.width, b.height, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export function installWindBanners({ scene, castle, max = 8, radius = 161 }) {
  const none = { update() {}, count: 0 };
  if (new URLSearchParams(globalThis.location?.search || '').get('windBanners') === '0' || !castle) return none;
  // 旗位：可见房子的屋顶（house-*-roof）最高点。注意 buildingOwnedProps 里的旗位对应的是已隐藏的旧布局建筑格，不能用
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  castle.updateWorldMatrix(true, true);
  const box = new THREE.Box3(), corner = new THREE.Vector3(), anchors = [];
  castle.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || !/^house-.*-roof$/.test(o.name || '') || !visible(o)) return;
    box.setFromObject(o); if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), up = c.clone().normalize();
    let top = -Infinity;
    for (let i = 0; i < 8; i++) { corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); top = Math.max(top, corner.dot(up)); }
    // 用射线在屋顶上找真正的最高点（包围盒顶面中心可能悬空）：从上往下打到屋顶网格
    const from = c.clone().addScaledVector(up, top - c.dot(up) + 5), ray = new THREE.Raycaster(from, up.clone().negate(), 0, 30);
    const hit = ray.intersectObject(o, false)[0];
    const base = hit ? hit.point.clone() : c.clone().addScaledVector(up, top - c.dot(up));
    anchors.push({ base, up: base.clone().normalize(), r: base.length() });
  });
  if (!anchors.length) return none;
  anchors.sort((a, b) => b.r - a.r);
  // 挑最高的，彼此至少隔 6 米
  const picked = [];
  for (const a of anchors) { if (picked.length >= max) break; if (picked.every((b) => b.base.distanceTo(a.base) > 6)) picked.push(a); }
  if (!picked.length) return none;

  const group = new THREE.Group(); group.name = 'citadel-wind-banners'; scene.add(group);
  // 旗杆
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x5b4a3c });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.045, POLE, 6).translate(0, POLE / 2, 0), poleMat, picked.length);
  poles.name = 'citadel-wind-banner-poles';
  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  picked.forEach((a, i) => { q.setFromUnitVectors(Y, a.up); m4.compose(a.base, q, one); poles.setMatrixAt(i, m4); });
  group.add(poles);
  // 两种旗：蓝底塔徽（分叉尾）· 红底太阳徽（燕尾）
  const kinds = [
    { tex: bannerTexture('#2f62a8', 'fork', 'tower'), list: [] },
    { tex: bannerTexture('#b8473a', 'swallow', 'sun'), list: [] },
  ];
  picked.forEach((a, i) => {
    a.fid = i; a.top = a.base.clone().addScaledVector(a.up, POLE - 0.05); a.parts = null;
    kinds[i % 2].list.push(a);
  });
  for (const k of kinds) {
    const n = k.list.length; if (!n) continue;
    const pos = new Float32Array(n * (SEG + 1) * 2 * 3), uv = new Float32Array(n * (SEG + 1) * 2 * 2), idx = [];
    for (let f = 0; f < n; f++) {
      const o = f * (SEG + 1) * 2;
      for (let i = 0; i <= SEG; i++) uv.set([i / SEG, 1, i / SEG, 0], (o + i * 2) * 2);
      for (let i = 0; i < SEG; i++) { const a = o + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: k.tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.name = 'citadel-wind-banner-cloth'; mesh.frustumCulled = false; mesh.raycast = () => {};
    group.add(mesh); k.mesh = mesh;
  }

  const side = new THREE.Vector3(), wind = new THREE.Vector3(), w = new THREE.Vector3(), d = new THREE.Vector3(), b = new THREE.Vector3(), camPos = new THREE.Vector3();
  let t = 0;
  function step(a, dt) {
    const U = a.up;
    // 风（世界 XZ 方位角，与 weather.js windVec 同一换算）投影到旗杆所在的切平面
    const r = THREE.MathUtils.degToRad(P.windDir ?? 45), speed = Math.max(0, P.windSpeed ?? 0.8);
    w.set(Math.cos(r), 0, Math.sin(r)); w.addScaledVector(U, -w.dot(U));
    if (w.lengthSq() < 1e-6) w.set(1, 0, 0).addScaledVector(U, -U.x);
    w.normalize();
    const gust = (0.9 + 0.5 * Math.sin(t * 0.8 + a.fid * 1.3)) * (0.25 + speed);
    if (!a.parts) a.parts = [0, 1, 2].map((i) => a.top.clone().addScaledVector(w, LEN * (i + 1)));
    let prev = a.top;
    for (let i = 0; i < 3; i++) {
      const p = a.parts[i];
      p.addScaledVector(w, dt * 2.0 * gust);                                             // 被风吹
      const flap = (0.35 + speed) * (i + 1) / 3;                                          // 越靠旗尾摆得越大，风越大摆得越大
      p.addScaledVector(U, (Math.sin(t * 7 + i * 1.7 + a.fid) * 1.6 * flap - 0.5 / (0.4 + speed)) * dt * 2.0);   // 上下飘 + 风小时下垂
      side.crossVectors(U, w);
      p.addScaledVector(side, Math.sin(t * 5.3 + i * 2.1 + a.fid * 0.7) * 2.2 * flap * dt * 2.0);         // 左右甩
      d.copy(p).sub(prev); const l = d.length() || 1e-6; p.copy(prev).addScaledVector(d, LEN / l);       // 跟着前一个点
      prev = p;
    }
  }
  function writeCloth(k) {
    const pos = k.mesh.geometry.attributes.position;
    k.list.forEach((a, f) => {
      const o = f * (SEG + 1) * 2, [p0, p1, p2] = a.parts;
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG, v = 1 - u;
        b.copy(a.top).multiplyScalar(v * v * v).addScaledVector(p0, 3 * v * v * u).addScaledVector(p1, 3 * v * u * u).addScaledVector(p2, u * u * u);
        pos.setXYZ(o + i * 2, b.x, b.y, b.z);
        b.addScaledVector(a.up, -H * (1 - 0.25 * u));                                     // 旗尾稍窄
        pos.setXYZ(o + i * 2 + 1, b.x, b.y, b.z);
      }
    });
    pos.needsUpdate = true; k.mesh.geometry.computeVertexNormals(); k.mesh.geometry.computeBoundingSphere();
  }
  const api = {
    count: picked.length, group,
    update(dt, camera) {
      t += dt;
      if (camera) { camera.getWorldPosition(camPos); if (camPos.distanceTo(picked[0].base) > 420) return; }   // 离得很远就不算
      const h = Math.min(dt, 1 / 20);
      for (const k of kinds) { if (!k.mesh) continue; for (const a of k.list) step(a, h); writeCloth(k); }
    },
  };
  for (const k of kinds) if (k.mesh) { for (const a of k.list) step(a, 0); writeCloth(k); }
  globalThis.__tmWindBanners = api;
  return api;
}
