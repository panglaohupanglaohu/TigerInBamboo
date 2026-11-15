// 高山圣城步道灯（2026-11-09，目标图 citadel-target-20261024：山路、桥和码头沿线一串暖色灯点，是暖色点缀，不是大探照灯）。
// 位置：可见的长步道扶手（崖面长廊、通往新城 / 老城的连接道）——取扶手网格最高的一圈顶点，沿路每隔约 5 米挑一个，灯在扶手顶上 0.5 米。
// 画法：暖色小灯泡（实例网格）+ 一圈加色柔光晕（点精灵），合计 2 次绘制；不加真实光源（避免逐片元光照开销）。
// 亮度规则与暖窗一致：max(入夜程度, 圣城暮色权重 × 0.85)；白天熄灭。?citadelLanterns=0 关闭。
import * as THREE from 'three';
import { nightWeightAt } from '../render/lighting/highlandLightVolumes.js';
import { officialOceanLevelAt } from './waterV8/officialOcean.js';

const PATHS = /^(central-cliff-gallery-handrails|new-city-link-side-handrails|old-city-link-side-handrails)$/;
const SPACING = 5, LIFT = 0.5;

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(0.25, 'rgba(255,196,110,.55)'); r.addColorStop(0.6, 'rgba(255,160,70,.12)'); r.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function installCitadelPathLanterns({ scene, castle }) {
  const none = { update() {}, count: 0 };
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelLanterns') === '0' || !castle) return none;
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  castle.updateWorldMatrix(true, true);
  const spots = [], v = new THREE.Vector3();
  castle.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !PATHS.test(o.name || '') || !visible(o)) return;
    const pos = o.geometry.attributes.position; if (!pos) return;
    // 扶手顶：每个顶点的半径，取比所在局部最高略低的那些（扶手上沿）
    const pts = [];
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push({ p: v.clone(), r: v.length() }); }
    pts.sort((a, b) => b.r - a.r);
    const mine = [];
    for (const q of pts) {
      if (mine.length > 40) break;
      // 同一位置附近只留最高的那个点，彼此隔 SPACING
      if (mine.every((m) => m.distanceTo(q.p) > SPACING) && spots.every((m) => m.distanceTo(q.p) > SPACING * 0.8)) mine.push(q.p);
    }
    // 只保留「在扶手上沿」的点：比 2 米范围内最高点低不超过 0.15 米
    for (const m of mine) {
      let top = -Infinity; for (const q of pts) if (q.p.distanceTo(m) < 2) top = Math.max(top, q.r);
      if (m.length() > top - 0.15) spots.push(m);
    }
  });
  if (!spots.length) return none;
  const group = new THREE.Group(); group.name = 'citadel-path-lanterns'; scene.add(group);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), bulbMat, spots.length);
  bulbs.name = 'citadel-path-lantern-bulbs'; bulbs.raycast = () => {};
  const haloPos = new Float32Array(spots.length * 3), m4 = new THREE.Matrix4();
  spots.forEach((s, i) => {
    const p = s.clone().addScaledVector(s.clone().normalize(), LIFT);
    m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); p.toArray(haloPos, i * 3);
  });
  const haloGeo = new THREE.BufferGeometry(); haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({ map: haloTexture(), size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const halos = new THREE.Points(haloGeo, haloMat); halos.name = 'citadel-path-lantern-halos'; halos.raycast = () => {}; halos.renderOrder = 7;
  group.add(bulbs, halos);
  // 海面倒影（目标图灯下的金色倒影条）：离海面 40 米以内的灯，在正下方海面放一条细长加色光带，
  // 每帧朝镜头方向拉长（倒影总是从灯下指向观察者），越高的灯倒影越长越淡。
  const refl = [];
  for (const s of spots) {
    const dir = s.clone().normalize(), seaR = 160 + officialOceanLevelAt(dir) + 0.06, h = s.length() - seaR;
    if (h > 0.5 && h < 40) refl.push({ sea: dir.clone().multiplyScalar(seaR), up: dir, h });
  }
  let streaks = null;
  if (refl.length) {
    const sg = new THREE.BufferGeometry(), sp = new Float32Array(refl.length * 4 * 3), su = new Float32Array(refl.length * 4 * 2), si = [];
    refl.forEach((_, i) => { su.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8); const a = i * 4; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); });
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('uv', new THREE.BufferAttribute(su, 2)); sg.setIndex(si);
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uGlow: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uGlow; uniform float uTime; varying vec2 vUv;
        void main(){ float across = 1.0 - abs(vUv.x * 2.0 - 1.0); float along = 1.0 - vUv.y;
          float ripple = 0.6 + 0.4 * sin(vUv.y * 38.0 - uTime * 2.3) * sin(vUv.y * 13.0 + uTime * 1.1);
          float a = smoothstep(0.0, 0.8, across) * along * along * ripple * uGlow * 0.55;
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a, a); }`,
    });
    streaks = new THREE.Mesh(sg, sm); streaks.name = 'citadel-path-lantern-sea-reflections'; streaks.frustumCulled = false; streaks.renderOrder = 6; streaks.raycast = () => {};
    group.add(streaks);
  }
  const toCam = new THREE.Vector3(), side = new THREE.Vector3(), c0 = new THREE.Vector3(), t0 = performance.now();
  const writeStreaks = (camera) => {
    if (!streaks || !camera) return;
    const pos = streaks.geometry.attributes.position;
    refl.forEach((r, i) => {
      toCam.copy(camera.position).sub(r.sea); toCam.addScaledVector(r.up, -toCam.dot(r.up));
      if (toCam.lengthSq() < 1e-4) toCam.set(1, 0, 0); toCam.normalize();
      side.crossVectors(r.up, toCam).normalize();
      const len = Math.min(14, 2 + r.h * 0.6), w = 0.35 + r.h * 0.02;
      // 光带从灯下的海面开始，朝镜头方向延伸 len
      for (let k = 0; k < 4; k++) {
        c0.copy(r.sea).addScaledVector(side, (k & 1 ? 1 : -1) * w).addScaledVector(toCam, k & 2 ? len : 0);
        pos.setXYZ(i * 4 + k, c0.x, c0.y, c0.z);
      }
    });
    pos.needsUpdate = true;
    streaks.material.uniforms.uTime.value = (performance.now() - t0) / 1000;
  };
  const dark = new THREE.Color(0x6b5a48), lit = new THREE.Color(0xffd7a0);
  const api = {
    count: spots.length, reflections: refl.length, group,
    update(timeOfDay, duskWeight = 0, camera = null) {
      const glow = Math.min(1, Math.max(nightWeightAt(timeOfDay), duskWeight * 0.85));
      bulbMat.color.copy(dark).lerp(lit, glow); haloMat.opacity = 0.9 * glow; halos.visible = glow > 0.01;
      if (streaks) { streaks.material.uniforms.uGlow.value = glow; streaks.visible = glow > 0.01; if (streaks.visible) writeStreaks(camera); }
    },
  };
  globalThis.__tmPathLanterns = api;
  return api;
}
