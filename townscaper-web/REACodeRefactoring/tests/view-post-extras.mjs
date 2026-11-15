// 第 55 批 G2：view-post-extras.js 的渲染循环接法（假渲染器 + 假 View，不需要 GPU）。
// outline / smear 接管 (view.scene, view.camera) 的那一次屏幕渲染；其他渲染原样通过；风旗着色器补丁；
// 解析拖影的 GLSL 公式与 core/camera-motion.js 的 CPU smearImage 同权重、同位移。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { installPostExtras, parseFx, screenOmegaDt, POST_EXTRAS, ORBIT_SMEAR_CENTER_GLSL } = await import('../src/world/view-post-extras.js');
const { smearImage, orbitVelocity } = await import('../src/core/camera-motion.js');

// ---- 1. URL 解析与屏幕角速度 ----
assert.deepEqual([...parseFx('?fx=outline,smear,bogus').on], ['outline', 'smear']);
assert.equal(parseFx('?spin=1.5').spin, 1.5);
assert.equal(parseFx('').on.size, 0, '默认全关');
assert.equal(POST_EXTRAS.length, 11);
const om = screenOmegaDt(1.1, 1.0, Math.PI / 2, 1 / 30);
assert.ok(Math.abs(om - .1 / (1 / 30) / 60) < 1e-12, '俯视：ω·快门');
assert.ok(Math.abs(screenOmegaDt(1.1, 1.0, .3, 1 / 30) - om * Math.sin(.3)) < 1e-12, '斜视按 sin(俯角) 投影');
assert.ok(Math.abs(screenOmegaDt(-Math.PI + .05, Math.PI - .05, 1, .1) - .1 / .1 * Math.sin(1) / 60) < 1e-9, '跨 ±π 不跳');
assert.equal(screenOmegaDt(1, 1, 1, 0), 0);

// ---- 2. GLSL 拖影公式 = CPU smearImage（中心在画面中央时逐像素一致）----
assert.match(ORBIT_SMEAR_CENTER_GLSL, /vec2\(-\(p\.y - c\.y\), p\.x - c\.x\) \* omegaDt/);
assert.match(ORBIT_SMEAR_CENTER_GLSL, /w = 1\. - abs\(t - \.5\) \* 1\.5/);
{
  const w = 24, h = 24, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; data[i] = (x * 37 + y * 11) % 255; data[i + 1] = x * 10; data[i + 2] = y * 10; data[i + 3] = 255; }
  const omega = 9, dt = 1 / 60, cpu = smearImage({ data, w, h }, omega, { dt, maxPx: 24 });
  // 照着 GLSL 写的 JS 孪生（像素中心约定与 CPU 版一致：p = (x, y)，c = (w/2, h/2)）
  const tw = []; let ws = 0; for (let k = 0; k < 6; k++) { const t = k / 5, v = 1 - Math.abs(t - .5) * 1.5; tw.push(v); ws += v; }
  const bil = (fx, fy, c) => { const X = (i) => Math.max(0, Math.min(w - 1, i)), Y = (j) => Math.max(0, Math.min(h - 1, j)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; const g = (i, j) => data[(Y(j) * w + X(i)) * 4 + c]; return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty; };
  let maxd = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [vx, vy] = orbitVelocity(x, y, omega, dt, w / 2, h / 2);
    for (let c = 0; c < 3; c++) { let a = 0; for (let k = 0; k < 6; k++) { const f = k / 5 - .5; a += bil(x + vx * f, y + vy * f, c) * tw[k]; } maxd = Math.max(maxd, Math.abs(Math.round(a / ws) - cpu.data[(y * w + x) * 4 + c])); }
  }
  assert.ok(maxd <= 1, 'GLSL 孪生与 CPU smearImage 一致（差 ≤1/255）: ' + maxd);
}

// ---- 3. 渲染循环接管：假渲染器 ----
const calls = [];
let target = null;
const renderer = {
  render(scene, camera) { calls.push({ scene: scene.name || scene.type, target: target?.name ?? (target ? 'rt' : null) }); },
  getRenderTarget: () => target, setRenderTarget(t) { target = t; }, clear() {},
  getDrawingBufferSize: (v) => v.set(320, 200), getPixelRatio: () => 1,
};
const scene = new THREE.Scene(); scene.name = 'main';
const camera = new THREE.PerspectiveCamera(50, 1.6, .1, 500);
const flagMat = new THREE.MeshLambertMaterial();
let origFlagPatched = 0; flagMat.onBeforeCompile = (sh) => { origFlagPatched++; sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n// ORIGINAL-WAVE'); };
const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)); geom.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
let soft = 0;
const view = {
  renderer, scene, camera, levelHeight: .5, yaw: .3, pitch: .6, target: new THREE.Vector3(), distance: 30, sunDir: new THREE.Vector3(0, 1, 0),
  updateCamera() { camera.position.set(Math.sin(this.yaw) * 10, 6, Math.cos(this.yaw) * 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); },
  material: new THREE.MeshStandardMaterial(), mesh: new THREE.Mesh(geom), worldMesh: {}, town: { version: 1, cells: [] },
  decor: { flagMat, flags: { count: 0 } },
  atmosphere: { rebuild() { return 1; }, probes: { normalAt: () => [0, 1, 0] }, bakeSoftNormals(g) { soft++; g.getAttribute('normal').array.fill(.5); return { touched: 3, kept: 0, empty: 0 }; }, windTexture() { throw new Error('not built'); } },
  vegetation: { refresh() { return {}; }, group: new THREE.Group(), uLight: { value: 1 }, crowns: [], max: { crowns: 1 }, tufts: { visible: true } },
  cloudShadow: { uniforms: {}, update() {} }, waterUniforms: { uTime: { value: 0 } },
};
view.updateCamera();
const api = installPostExtras(view, { search: '' });
assert.equal(view.postExtras, api);
assert.ok(Object.values(api.state).every((v) => v === false), '全部默认关');
renderer.render(scene, camera);
assert.deepEqual(calls.at(-1), { scene: 'main', target: null }, '全关时原样直画屏幕');
// 其他场景/有目标时不接管
const other = new THREE.Scene(); other.name = 'other'; calls.length = 0; renderer.render(other, camera); assert.deepEqual(calls, [{ scene: 'other', target: null }]);

// outline：颜色 + 法线两遍进 RT，再合成到屏幕
api.set('outline', true); calls.length = 0; renderer.render(scene, camera);
assert.equal(calls.length, 3, 'outline = 颜色 + 法线 + 合成: ' + JSON.stringify(calls));
assert.ok(calls[0].target && calls[1].target && calls[2].target === null, '前两遍进目标，合成到屏幕');
assert.equal(api.outlinePass.uniforms.uResolution.value.x, 320);

// smear：先画进拖影目标（含 outline），再一遍全屏合成；静止时 ω=0
api.set('smear', true); calls.length = 0; renderer.render(scene, camera);
assert.equal(calls.length, 4, 'outline 3 遍（合成进拖影目标）+ 拖影合成 1 遍');
assert.ok(calls[2].target && calls[3].target === null);
assert.equal(api.stats().smear.omegaDt, 0, '相机不动 → 无拖影');
api.set('outline', false);
view.yaw += .2; calls.length = 0; renderer.render(scene, camera);
assert.equal(calls.length, 2); assert.ok(api.stats().smear.omegaDt > 0, '转动 → ω>0');
api.set('smear', false); calls.length = 0; renderer.render(scene, camera); assert.equal(calls.length, 1, '关掉恢复直画');

// spin 调试：每帧推 yaw
api.spin = 2; const y0 = view.yaw; renderer.render(scene, camera); assert.ok(view.yaw > y0); api.spin = 0;

// 软法线：开 → 写回主网格；关 → 硬法线原样还原
const before = Float32Array.from(geom.getAttribute('normal').array);
api.set('softnormals', true); renderer.render(scene, camera);
assert.equal(soft, 1); assert.equal(geom.getAttribute('normal').array[0], .5);
renderer.render(scene, camera); assert.equal(soft, 1, '同一几何不重复烘');
view.atmosphere.rebuild(); renderer.render(scene, camera); assert.equal(soft, 2, 'Atmosphere 重建后重烘');
assert.equal(api.groundAt(.2, .2), 0, '变形网格碰撞：主网格三角形上的高度'); assert.equal(api.groundAt(5, 5), null);
api.set('softnormals', false); renderer.render(scene, camera); assert.equal(api.groundAt(.2, .2), null, '关时不提供');
assert.deepEqual([...geom.getAttribute('normal').array], [...before], '关闭后还原硬法线');

// 风旗：链在原 onBeforeCompile 之后，原波动保留、在投影前读风场纹理
const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: '' };
flagMat.onBeforeCompile(sh, renderer);
assert.equal(origFlagPatched, 1); assert.match(sh.vertexShader, /ORIGINAL-WAVE/);
assert.match(sh.vertexShader, /sampleWind\(pole\)/); assert.ok(sh.vertexShader.indexOf('sampleWind(pole)') < sh.vertexShader.indexOf('#include <project_vertex>'));
assert.ok('uWindField' in sh.uniforms && 'uWindTexOn' in sh.uniforms);
assert.match(flagMat.customProgramCacheKey(), /windtex/);
api.set('windflag', true); renderer.render(scene, camera);
assert.equal(sh.uniforms.uWindTexOn.value, 0, 'Atmosphere 未建好时不开（不抛错）');
view.atmosphere.windTexture = () => ({ texture: 'TEX', uniforms: { uWindGrid: { value: new THREE.Vector4(1, 2, .5, .5) }, uWindDims: { value: new THREE.Vector3(4, 5, 6) } } });
renderer.render(scene, camera);
assert.equal(sh.uniforms.uWindTexOn.value, 1); assert.equal(sh.uniforms.uWindField.value, 'TEX'); assert.deepEqual(sh.uniforms.uWindDims.value.toArray(), [4, 5, 6]);
assert.throws(() => api.set('nope', true));
console.log('PASS view-post-extras: URL/开关默认关, 渲染接管(outline 3 遍/smear 合成/直通), GLSL 拖影 = CPU smearImage, 软法线写回与还原, 风旗链式着色器');
