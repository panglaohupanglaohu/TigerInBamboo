// 第 55 批 G2：engine/impostor.js 多俯仰视图 + 球面卡片 + 原云材质（src/life/impostor.js），默认单仰角不变。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { ImpostorBaker, ImpostorField, cloudGeometry, blobCloudGeometry } = await import('../src/life/impostor.js');
const cams = [];
const renderer = { setRenderTarget() {}, getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0, getClearColor: (c) => c, getClearAlpha: () => 1, setClearColor() {}, clear() {},
  render(scene, cam) { if (cam.isOrthographicCamera) cams.push(cam.position.clone()); } };
const baker = new ImpostorBaker(renderer, 2048);
const geo = new THREE.IcosahedronGeometry(.5, 1);
// 默认：8 方位、一个仰角，定义与旧版一致
const one = baker.bake(geo);
assert.equal(one.frames.length, 32); assert.equal(one.pitches.length, 1);
const f1 = new ImpostorField(baker.rt.texture, one, 4);
assert.equal(f1.material.defines.PITCHES, 1); assert.equal(f1.material.defines.NFRAMES, 8); assert.equal(f1.material.defines.SPHERE, 0);
assert.equal(f1.material.uniforms.uFrames.value.length, 8);
// 三行俯仰：24 帧，按 [行][方位]；每行相机仰角 = 设定值
cams.length = 0;
const P = [.12, .42, .85], three = baker.bake(geo, 128, { pitches: P });
assert.equal(three.frames.length, 24 * 4); assert.equal(cams.length, 24);
for (let k = 0; k < 24; k++) { const c = cams[k], el = Math.atan2(c.y, Math.hypot(c.x, c.z)); assert.ok(Math.abs(el - P[Math.floor(k / 8)]) < 1e-6, 'frame ' + k + ' elevation'); }
// 同一行内方位每 45° 一张
const az = (c) => Math.atan2(c.x, c.z); assert.ok(Math.abs(Math.abs(az(cams[1]) - az(cams[0])) - Math.PI / 4) < 1e-6);
const f3 = new ImpostorField(baker.rt.texture, three, 4, { sphere: true });
assert.equal(f3.material.defines.PITCHES, 3); assert.equal(f3.material.defines.NFRAMES, 24); assert.equal(f3.material.defines.SPHERE, 1);
assert.deepEqual(f3.material.uniforms.uPitch.value.toArray().slice(0, 3), P);
assert.match(f3.material.vertexShader, /#if PITCHES > 1/); assert.match(f3.material.fragmentShader, /mix\(c, mix\(a2, b2, vT\), vTp\)/);
assert.match(f3.material.fragmentShader, /SPHERE && !CLOUD/);
// 图集：多帧全分配、互不重叠
const rects = []; for (let i = 0; i < three.frames.length; i += 4) rects.push(three.frames.slice(i, i + 4));
for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [a, b] = [rects[i], rects[j]]; assert.ok(a[0] + a[2] <= b[0] + 1e-9 || b[0] + b[2] <= a[0] + 1e-9 || a[1] + a[3] <= b[1] + 1e-9 || b[1] + b[3] <= a[1] + 1e-9, 'frames overlap'); }
assert.throws(() => baker.bake(geo, 128, { pitches: [.5, .2] }), /ascending/);
assert.throws(() => baker.bake(geo, 128, { pitches: [0, .2, .4, .6, .8] }));
// CPU 孪生：仰角 → (行, 混合系数)，与着色器同规则
const pick = (el) => { let row = 0; for (let r = 0; r < P.length - 1; r++) if (el >= P[r]) row = r; return [row, Math.min(1, Math.max(0, (el - P[row]) / (P[row + 1] - P[row])))]; };
assert.deepEqual(pick(.12), [0, 0]); assert.deepEqual(pick(.85), [1, 1]); assert.equal(pick(1.2)[1], 1, '高于最高行夹住'); assert.equal(pick(-.3)[1], 0);
assert.ok(Math.abs(pick(.635)[1] - .5) < 1e-9);
// 原云材质：5 个压扁二十面体、光照烘进顶点色（顶亮底暗）
const bc = blobCloudGeometry(3), pos = bc.getAttribute('position'), col = bc.getAttribute('color');
assert.equal(pos.count, 5 * 240, "5 个 detail-1 二十面体"); assert.ok(col && col.count === pos.count);
let top = 0, nt = 0, bot = 0, nb = 0; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), l = col.getX(i) + col.getY(i) + col.getZ(i); if (y > .6) { top += l; nt++; } else if (y < .25) { bot += l; nb++; } }
assert.ok(top / nt > bot / nb, '顶亮底暗'); bc.computeBoundingBox(); assert.ok(bc.boundingBox.max.x - bc.boundingBox.min.x > 1.2, '一字排开');
cams.length = 0; const cb = baker.bake(blobCloudGeometry(3), 256, { vertexColors: true }); assert.equal(cb.frames.length, 32); assert.ok(baker.matVC.vertexColors);
assert.ok(cloudGeometry().getAttribute('position').count > 0, '旧云几何仍在（默认画面不变）');
console.log('PASS impostor-pitch: default 1 pitch/8 frames unchanged; 3 pitches → 24 frames at', P.join('/'), 'rad, no overlap; sphere card + leaf alpha shader; original blob cloud baked colours');
