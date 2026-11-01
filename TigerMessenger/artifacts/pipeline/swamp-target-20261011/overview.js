// 湖沼目标图（2026-10-11 用户定稿的手绘目标图）对照机位：自由相机俯视全湖。
// 用法（页面内）：const OV=await import('/TigerMessenger/artifacts/pipeline/swamp-target-20261011/overview.js?v='+Date.now());
//   OV.show({az,pitch,dist,fov,tx,ty,tz})  —— 全屏贴一张 1600x1000 成片（与目标图同为 1.6:1）
const tm = () => window.__tm;
const inner = () => tm().messenger.landmarks.moebiusSwamp.userData.inner;
export function render({az = 3.9, pitch = .72, dist = 62, fov = 40, tx = 0, ty = 26, tz = 0, w = 1600, h = 1000, ink = true} = {}) {
  const T = tm().THREE, r = tm().renderer, cam = tm().camera, scene = tm().scene, inn = inner();
  inn.updateWorldMatrix(true, false);
  const target = inn.localToWorld(new T.Vector3(tx, ty, tz));
  const local = new T.Vector3(Math.cos(az) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.sin(az) * Math.cos(pitch) * dist).add(new T.Vector3(tx, ty, tz));
  const eye = inn.localToWorld(local);
  const save = { pos: cam.position.clone(), quat: cam.quaternion.clone(), up: cam.up.clone(), fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far, size: r.getSize(new T.Vector2()), pr: r.getPixelRatio() };
  try {
    r.setPixelRatio(1); r.setSize(w, h, false);
    cam.up.copy(new T.Vector3(0, 1, 0).transformDirection(inn.matrixWorld));
    cam.position.copy(eye); cam.lookAt(target); cam.fov = fov; cam.aspect = w / h; cam.near = .3; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // fade/ink systems keyed to the swamp camera stay off for an overview
    tm().swampWaterMarks?.update?.(performance.now() / 1000, cam);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/jpeg', .9);
  } finally {
    r.setPixelRatio(save.pr); r.setSize(save.size.x, save.size.y, false);
    cam.position.copy(save.pos); cam.quaternion.copy(save.quat); cam.up.copy(save.up); cam.fov = save.fov; cam.aspect = save.aspect; cam.near = save.near; cam.far = save.far; cam.updateProjectionMatrix();
  }
}
export function show(opts = {}) {
  const u = render(opts);
  document.getElementById('station-sheet')?.remove();
  const i = document.createElement('img'); i.id = 'station-sheet'; i.src = u;
  i.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:62.5vw;z-index:99999;object-fit:fill;background:#000';
  document.body.appendChild(i); return {w: innerWidth, h: Math.round(innerWidth * .625)};
}
// 画面中关键物体位置（inner 坐标）——用于对机位
export function landmarks() {
  const inn = inner(), u = inn.userData, out = {};
  const tiger = u.tiger, whale = u.whale;
  out.tiger = tiger && tiger.position.toArray().map(v => +v.toFixed(1));
  out.whale = whale && whale.position.toArray().map(v => +v.toFixed(1));
  out.boats = (u.lotuses || []).map(b => b.position.toArray().map(v => +v.toFixed(1)));
  out.rim = u.gregCoralRim && {entranceAngle: u.gregCoralRim.entranceAngle, topY: u.gregCoralRim.topY};
  const dock = inn.getObjectByName('greg-shore-dock-walk'); if (dock) out.dock = dock.getWorldPosition(new (tm().THREE.Vector3)()).applyMatrix4(inn.matrixWorld.clone().invert()).toArray().map(v => +v.toFixed(1));
  const steps = u.tigerWalkSurfaces || []; out.steps = steps.slice(0, 2).map(s => s.getWorldPosition(new (tm().THREE.Vector3)()).applyMatrix4(inn.matrixWorld.clone().invert()).toArray().map(v => +v.toFixed(1)));
  return out;
}

// —— 对机位：在页面里算"色块布局分"（与 paint_score.py 的 layout 项同一方法：模糊后 16x10 Lab 网格逐格 ΔE）——
function toLab(r, g, b) {
  const f = c => { c /= 255; return c > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92; };
  const R = f(r), G = f(g), B = f(b);
  let x = (R * .4124 + G * .3576 + B * .1805) / .95047, y = R * .2126 + G * .7152 + B * .0722, z = (R * .0193 + G * .1192 + B * .9505) / 1.08883;
  const h = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; x = h(x); y = h(y); z = h(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
async function grid(src) {
  const im = new Image(); im.src = src; await im.decode();
  const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d');
  g.filter = 'blur(1.5px)'; g.drawImage(im, 0, 0, 64, 40);
  const d = g.getImageData(0, 0, 64, 40).data, out = [];
  for (let j = 0; j < 10; j++) for (let i = 0; i < 16; i++) {
    let r = 0, gg = 0, b = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const k = ((j * 4 + y) * 64 + i * 4 + x) * 4; r += d[k]; gg += d[k + 1]; b += d[k + 2]; }
    out.push(toLab(r / 16, gg / 16, b / 16));
  }
  return out;
}
let _tg = null;
export async function layoutScore(opts) {
  _tg ??= await grid('/TigerMessenger/artifacts/pipeline/swamp-target-20261011/target.png');
  const g = await grid(render({...opts, w: 480, h: 300}));
  let s = 0; for (let i = 0; i < g.length; i++) { const d = Math.hypot(g[i][0] - _tg[i][0], g[i][1] - _tg[i][1], g[i][2] - _tg[i][2]); s += Math.max(0, 1 - d / 35); }
  return s / g.length;
}
export async function sweep(list) { const out = []; for (const o of list) out.push({...o, s: +(await layoutScore(o)).toFixed(3)}); return out.sort((a, b) => b.s - a.s); }
