// 高山圣城新设计的墨线描边 + 逆光亮边（2026-11-09 用户要求「圣城新设计加墨线描边并带逆光亮边（会改画风）」）。
// 复用 REACodeRefactoring src/world/outline.js 的 OutlineLayers（TigerMessenger vendor 副本，原样）：
//   1751945034851570056 "another inverted mesh outline layer that shows up when looking into the sun, masked by shadows"
//   1017355723171344385 "thicker outlines for all you 4k high ballers"：线宽按像素比 × 分辨率放大
//   墨线 ≈1.4 px、逆光暖边 ≈3.2 px，屏幕像素外扩、远近一样粗；入夜墨线变淡、亮边换月光色（setTimeOfDay）。
// 这里只做三件事：
//   1. 把圣城可见的静态建筑网格（新城、老城、台阶房、城墙、连接道…；不含山体 / 草皮 / 树 / 水 / 云 / 我加的旗和灯）
//      按世界坐标合成一份几何，并按位置焊接算出平均法线 aOutline（REA worldmesh 里的 outline 属性同义）；
//   2. 编译时把 REA 着色器里「朝下的面视为在阴影里」用的世界 Y 轴换成星球局部「上」（小星球上 Y 轴不是上）；
//   3. 每帧调 OutlineLayers.update(renderer, camera, sunDir)，按昼夜调 setTimeOfDay；离圣城远就整组隐藏。
// 默认关闭（用户 2026-11-09 不要墨边）；?citadelInk=1 打开。
import * as THREE from 'three';
import { OutlineLayers } from '../vendor/townscaper-rea-refactoring/src/world/outline.js';
import { nightWeightAt } from '../render/lighting/highlandLightVolumes.js';

const EXCLUDE = /mountain|rock|cliff|terrain|ridge|tree|cypress|grass|turf|planting|water|sea|ocean|cloud|reflection|foam|wave|banner|lantern|glow|shadow|fog|veil|guardian|crag|footing|shore|plant|leaf|flower|bush|hedge|backdrop/i;

function buildMergedGeometry(castle) {
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  castle.updateWorldMatrix(true, true);
  const parts = [];
  castle.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.isOutline || !visible(o)) return;
    const path = `${o.name || ''}<${o.parent?.name || ''}<${o.parent?.parent?.name || ''}`;
    if (EXCLUDE.test(path)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.transparent || m.visible === false) return;
    const g = o.geometry; if (!g?.attributes?.position) return;
    parts.push(o);
  });
  let vCount = 0, iCount = 0;
  for (const o of parts) { const g = o.geometry; vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vCount * 3), idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  const normSum = new Map(); // 焊接：同一位置（1 cm 量化）所有面法线求和 → aOutline
  const keys = new Array(vCount);
  let vo = 0, io = 0;
  for (const o of parts) {
    const g = o.geometry, P = g.attributes.position;
    let N = g.attributes.normal;
    if (!N) { const c = g.clone(); c.computeVertexNormals(); N = c.attributes.normal; }
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); v.toArray(pos, (vo + i) * 3);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      const k = `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`; keys[vo + i] = k;
      const s = normSum.get(k); if (s) s.add(n); else normSum.set(k, n.clone());
    }
    if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo; io += I.length; }
    else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
    vo += P.count;
  }
  const outline = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) { const s = normSum.get(keys[i]); n.copy(s).normalize(); n.toArray(outline, i * 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOutline', new THREE.BufferAttribute(outline, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return { geo, meshes: parts.length, verts: vCount };
}

export function installCitadelInkOutline({ scene, castle }) {
  const none = { update() {}, count: 0 };
  // 2026-11-09 用户：「墨边不用描了，没意义」→ 默认关；?citadelInk=1 才装
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelInk') !== '1' || !castle) return none;
  const { geo, meshes, verts } = buildMergedGeometry(castle);
  if (!meshes) return none;
  const layers = new OutlineLayers(geo);
  // 星球上的「朝下」= 背离局部上方（顶点世界坐标方向），不是世界 Y 轴
  for (const mat of [layers.inkMat, layers.rimMat]) {
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('float lit = clamp(wn.y * 0.6 + 0.6, 0.0, 1.0);', 'float lit = clamp(dot(wn, normalize(wp.xyz)) * 0.6 + 0.6, 0.0, 1.0);');
    };
    mat.customProgramCacheKey = () => 'tm-planet-outline';
  }
  layers.group.name = 'citadel-ink-outline';
  scene.add(layers.group);
  const sun = new THREE.Vector3(), centre = geo.boundingSphere.center.clone(), camPos = new THREE.Vector3();
  let mode = '', inkScale = 1, rimScale = 1;
  const api = {
    count: meshes, verts, layers,
    /** thickness：墨线粗细倍数；rim：亮边强度倍数（「光照与时间 · 墨线与逆光」能力调用） */
    setStyle({ thickness, rim } = {}) { if (Number.isFinite(thickness)) inkScale = thickness; if (Number.isFinite(rim)) rimScale = rim; },
    update(renderer, camera, sunDir, timeOfDay) {
      camera.getWorldPosition(camPos);
      const near = camPos.distanceTo(centre) < 450; layers.group.visible = near; if (!near) return;
      sun.copy(sunDir || sun.set(0.3, 0.8, 0.2));
      layers.thickness = inkScale;
      layers.update(renderer, camera, sun);
      const nw = nightWeightAt(timeOfDay), t = ((timeOfDay % 1) + 1) % 1;
      const m = nw > 0.85 ? 'night' : t > 0.62 && t < 0.9 ? 'dusk' : 'day';
      if (m !== mode) { mode = m; layers.setTimeOfDay(m); }
      layers.rimMat.uniforms.uStrength.value = (m === 'night' ? 0.5 : 1.0) * rimScale;
      layers.ink.visible = inkScale > 0.01; layers.rim.visible = rimScale > 0.01;
    },
  };
  globalThis.__tmCitadelInk = api;
  return api;
}
