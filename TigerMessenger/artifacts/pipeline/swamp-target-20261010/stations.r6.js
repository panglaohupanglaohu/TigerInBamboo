// 湖沼目标图机位工具（美术总监）：在正式游戏页面里 import 本文件。
// 机位 = 信使站位 + 朝向；镜头由游戏相机按当前规则生成。输出：成片 / 语义图 / 深度图 / 信使剪影。
const tm = () => window.__tm;
export const STATIONS = {
  entrance: { p: [Math.cos(.5) * 42, 40.2, Math.sin(.5) * 42], face: 'in' },
  rim: { p: [Math.cos(1.25) * 40.9, 40.2, Math.sin(1.25) * 40.9], face: 'ccw' },
  middle: { p: [16.815, 30.9, -17.487], face: 'in' },
  lake: { p: [-6.6, 27.0, -20.4], face: 'in' },
  stairs: { p: [25.6, 28.8, 14.0], face: 'in' },
};
export const CLASS_COLORS = {
  sky: [0, 0, 0], water: [0, 0, 255], path: [255, 255, 0], wall: [128, 128, 128], foliage: [0, 200, 0],
  bark: [150, 75, 0], creature: [255, 128, 0], warm: [255, 150, 200], other: [100, 100, 200],
  courier: [255, 255, 255], far: [0, 255, 255], legacy: [255, 0, 0],
};
function inner() { return tm().messenger.landmarks.moebiusSwamp.userData.inner; }
function swampRoot() { return tm().messenger.landmarks.moebiusSwamp; }
function courierGroup() { let pg; tm().scene.children.forEach(c => { if (c.type === 'Group' && c.children.some(k => k.name === 'Courier' && k.userData.isHumanCourier)) pg = c; }); return pg; }
const under = (o, r) => { for (let q = o; q; q = q.parent) if (q === r) return true; return false; };
const visibleChain = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };

export function place(name) {
  const THREE = tm().THREE, s = STATIONS[name], [x, y, z] = s.p, inn = inner();
  inn.updateWorldMatrix(true, false);
  const w = inn.localToWorld(new THREE.Vector3(x, y, z)), up = w.clone().normalize(); w.addScaledVector(up, .4);
  const pl = tm().player; pl.position.copy(w); pl.velocity.set(0, 0, 0);
  let d = s.face === 'in' ? new THREE.Vector3(-x, 0, -z) : (() => { const a = Math.atan2(z, x); return new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)); })();
  d.normalize().applyQuaternion(inn.getWorldQuaternion(new THREE.Quaternion())); d.addScaledVector(up, -d.dot(up)).normalize();
  pl.facing?.copy(d); pl.forward?.copy(d);
  const pg = courierGroup(); pg.position.copy(pl.position);
  const r = new THREE.Vector3().crossVectors(up, d).normalize();
  pg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, d)); pg.updateMatrixWorld(true);
  tm().cameraRig.snapToPlayer?.();
}
export function settle(swampCam = true, seconds = 4) {
  const prof = tm().swampCameraProfile; if (prof) { prof.report.enabled = swampCam; if (!swampCam) prof.release(); }
  for (let i = 0; i < seconds * 30; i++) { prof?.update(1 / 30); tm().cameraRig.update(1 / 30); }
  tm().swampOcclusionFade?.update(tm().camera, tm().player, swampCam && (prof?.report.weight || 0) > .2);
  if (prof) prof.report.enabled = true;
}
export function classify(o) {
  const n = (o.name || '') + ' ' + (o.parent?.name || '') + ' ' + (o.parent?.parent?.name || '');
  const role = o.userData.gregVisualRole;
  if (/tiger|whale|resident|monkey|bird|fish|frog|crab|boat|raft|courier|keeper|villager|turtle|gecko|lizard|butterfly|moth/i.test(n)) return 'creature';
  if (role === 'water' || /water|lake-surface|lake-floor/i.test(n)) return 'water';
  if (role === 'foliage' || /leaf|leaves|crown|frond|fern|foliage|vine|understory|pendant|algae|grass|reed|moss|canopy|palm|lily|pad/i.test(n)) return 'foliage';
  if (/flower|lamp|glow|lantern|blossom|petal/i.test(n) || role === 'flower') return 'warm';
  if (role === 'bark' || /trunk|branch|root|bark|tree/i.test(n)) return 'bark';
  if (role === 'path' || role === 'stone' || /tread|step|stair|path|walk|rim-rock|slab|dock|bridge|terrace|plank|deck|ledge/i.test(n)) return 'path';
  if (role === 'wall' || /wall|cliff|rock|stone|sinkhole|bank|bowl/i.test(n)) return 'wall';
  return byColor(o) || 'other';
}
const FAM = { bark: ['#bd929e', '#a37c87'], foliage: ['#99bbaa', '#6f9794', '#7da294'], wall: ['#777388', '#67647c'], path: ['#f1e8ce', '#e9a18f', '#d98d86'], water: ['#9ec8cc'] };
function byColor(o) {
  const THREE = tm().THREE, m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m?.color) return null;
  let c = m.color.clone();
  if (m.vertexColors && o.geometry?.attributes?.color) { const a = o.geometry.attributes.color; c = new THREE.Color(a.getX(0), a.getY(0), a.getZ(0)); }
  if (c.r > .97 && c.g > .97 && c.b > .97) return null;
  const hex = '#' + c.getHexString(); let best = null, bd = 1e9;
  for (const [k, list] of Object.entries(FAM)) for (const h of list) { const t = new THREE.Color(h), d = (t.r - c.r) ** 2 + (t.g - c.g) ** 2 + (t.b - c.b) ** 2; if (d < bd) { bd = d; best = k; } }
  return bd < .03 ? best : null;
}
const swapped = [];
function swap(o, m) { swapped.push([o, o.material, o.onBeforeRender]); o.material = m; o.onBeforeRender = () => {}; }
export function restore() { for (const [o, m, f] of swapped.splice(0)) { o.material = m; o.onBeforeRender = f; } }
const legacyMats = {};
function legacyMaterial(clipped = false) {
  const THREE = tm().THREE;
  if (legacyMats[clipped]) return legacyMats[clipped];
  let legacyMat;
  const { SWAMP_RIM_OUTER_MAX = 46.8 } = window.__swampRim || {};
  legacyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, side: THREE.DoubleSide });
  legacyMat.userData.uInv = { value: new THREE.Matrix4() };
  legacyMat.onBeforeCompile = sh => {
    sh.uniforms.uInv = legacyMat.userData.uInv;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvW=(modelMatrix*wp).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;uniform mat4 uInv;').replace('#include <color_fragment>', `#include <color_fragment>
      vec3 l=(uInv*vec4(vW,1.)).xyz;float r=length(l.xz);
      bool inside=(r<35.5&&l.y>4.)||(r<${(SWAMP_RIM_OUTER_MAX + 1).toFixed(2)}&&l.y>38.6);
      ${clipped ? 'if(inside) discard;' : ''}${clipped === 'ocean' ? 'if(r<72.&&(l.y>30.||(r>36.&&l.y>8.))) discard;' : ''}
      diffuseColor.rgb=inside?vec3(1.,0.,0.):vec3(0.,1.,1.);`);
  };
  legacyMat.customProgramCacheKey = () => 'station-legacy-probe-' + clipped;
  legacyMats[clipped] = legacyMat;
  return legacyMat;
}
export function render(kind) {
  const THREE = tm().THREE, scene = tm().scene, renderer = tm().renderer, cam = tm().camera;
  const hidden = [], hide = o => { if (o.visible) { o.visible = false; hidden.push(o); } };
  const prevBg = scene.background, prevFog = scene.fog, prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const root = swampRoot(), pg = courierGroup(), inn = inner();
  if (kind !== 'beauty') {
    scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 1);
    const mats = {}; const M = c => { if (mats[c]) return mats[c]; const m = mats[c] = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...CLASS_COLORS[c].map(v => v / 255), THREE.SRGBColorSpace), fog: false, toneMapped: false, side: THREE.DoubleSide });
      // occluders that make way in the game make way in the semantic map too
      if ((c === 'foliage' || c === 'bark') && tm().swampOcclusionFade?.patch) tm().swampOcclusionFade.patch(m);
      return m; };
    scene.traverse(o => {
      if (o.isSprite || o.isPoints || o.isLine) { hide(o); return; }
      if (!o.isMesh) return;
      if (o.userData.isOutline || /outline|ink/i.test(o.name)) { hide(o); return; }
      if (kind === 'courier') { if (!under(o, pg)) hide(o); else swap(o, M('courier')); return; }
      if (kind === 'depth') { _uInvShared.value ||= new THREE.Matrix4(); _uInvShared.value.copy(inn.matrixWorld).invert(); const orig = Array.isArray(o.material) ? o.material[0] : o.material; swap(o, depthMat(!under(o, root) && orig?.userData?.swampColumnClip ? (orig.isShaderMaterial ? 'ocean' : true) : false)); return; }
      if (under(o, pg)) swap(o, M('courier'));
      else if (under(o, root)) swap(o, M(classify(o)));
      else { const orig = Array.isArray(o.material) ? o.material[0] : o.material; const lm = legacyMaterial(orig?.userData?.swampColumnClip ? (orig.isShaderMaterial ? 'ocean' : true) : false); lm.userData.uInv.value.copy(inn.matrixWorld).invert(); swap(o, lm); }
    });
  }
  try {
    renderer.render(scene, cam);
    return renderer.domElement.toDataURL(kind === 'beauty' ? 'image/jpeg' : 'image/png', .85);
  } finally {
    restore(); for (const o of hidden) o.visible = true;
    scene.background = prevBg; scene.fog = prevFog; renderer.setClearColor(prevClear, prevAlpha);
  }
}
const _depth = {};
const _uInvShared = { value: null };
function depthMat(clipped = false) {
  const THREE = tm().THREE; if (_depth[clipped]) return _depth[clipped];
  _uInvShared.value ||= new THREE.Matrix4();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uInv = _uInvShared;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vD;varying vec3 vW;').replace('#include <project_vertex>', '#include <project_vertex>\nvD=-mvPosition.z;vec4 wp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvW=(modelMatrix*wp).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vD;varying vec3 vW;uniform mat4 uInv;').replace('#include <color_fragment>', `#include <color_fragment>
      ${clipped ? 'vec3 l=(uInv*vec4(vW,1.)).xyz;float r=length(l.xz);if((r<35.5&&l.y>4.)||(r<47.8&&l.y>38.6))discard;' : ''}${clipped === 'ocean' ? 'if(r<72.&&(l.y>30.||(r>36.&&l.y>8.)))discard;' : ''}
      float g=1.-clamp(vD/60.,0.,1.);diffuseColor.rgb=vec3(g*g);`);
  };
  m.customProgramCacheKey = () => 'station-depth-' + clipped;
  return _depth[clipped] = m;
}
// one station → 2×2 sheet overlay (beauty | semantic / depth | courier silhouette) for a screenshot
export function sheet(name, { swampCam = true, label = '' } = {}) {
  place(name); settle(swampCam);
  const imgs = [render('beauty'), render('semantic'), render('depth'), render('courier')];
  const box = document.createElement('div'); box.id = 'station-sheet';
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;background:#000;gap:0';
  for (const u of imgs) { const i = document.createElement('img'); i.src = u; i.style.cssText = 'width:100%;height:100%;object-fit:fill;image-rendering:pixelated'; box.appendChild(i); }
  document.getElementById('station-sheet')?.remove(); document.body.appendChild(box);
  return { name, label, report: { ...tm().swampCameraProfile?.report } };
}
export function clear() { document.getElementById('station-sheet')?.remove(); }
