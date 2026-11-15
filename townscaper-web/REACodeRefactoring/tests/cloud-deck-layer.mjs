// 第 55 批 G2：clouddeck 接渲染——三层塔视差/模糊随深度、云影团块 = deck 同一密度场沿太阳投到接收面。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { CloudDeckLayer, towerPuffs, towerDensity, TOWER_PUFFS } = await import('../src/world/cloud-deck-layer.js');
const { makeCloudDeck } = await import('../src/core/cloud-depth.js');
const cells = []; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) cells.push({ id: cells.length, cx: i - 4, cz: j - 4, minX: i - 4.5, maxX: i - 3.5, minZ: j - 4.5, maxZ: j - 3.5 });
const town = { version: 3, cells, top: (c) => (Math.hypot(c.cx, c.cz) < 3.5 ? 2 : 0) };
const uniforms = { uCloudAtlas: { value: null }, uCloudRect: { value: new THREE.Vector4() }, uCloudPuffs: { value: Array.from({ length: 64 }, () => new THREE.Vector4()) }, uCloudCount: { value: 0 }, uCloudStrength: { value: 0 }, uCloudSun: { value: new THREE.Vector3() } };
const view = { scene: new THREE.Scene(), town, distance: 30, sunDir: new THREE.Vector3(-.3, .8, .5).normalize(), waterUniforms: { uTime: { value: 0 } }, cloudShadow: { uniforms } };
const layer = new CloudDeckLayer(view);
assert.equal(layer.group.visible, false, '默认关'); layer.update(); assert.equal(uniforms.uCloudCount.value, 0, '关时不碰云影');
layer.setEnabled(true); layer.update();
assert.equal(layer.rings.length, 3);
const R = layer.rings.map((r) => r.R); assert.ok(R[0] > R[1] && R[1] > R[2], '远层半径大（深度 3.2 > 2 > 1）');
assert.ok(R[2] > view.distance, '最近一圈也在相机外：塔永远是背景');
const blur = layer.rings.map((r) => r.mesh.material.uniforms.uBlur.value); assert.ok(blur[0] > blur[1] && blur[1] > blur[2], '模糊 ∝ 深度');
// 视差：同一时间，平移量 ∝ 1/depth
view.waterUniforms.uTime.value = 10; layer.update();
const sh = layer.rings.map((r) => r.mesh.material.uniforms.uShift.value); assert.ok(Math.abs(sh[0] / sh[2] - 1 / 3.2) < 1e-9, '远层慢 3.2 倍');
// 塔：顶部窄、底部宽（往上堆）；CPU 孪生与 GLSL 同一组 6 圆
const ring = layer.rings[2], p = ring.puffs[0];
const base = -1, at = (y) => towerDensity([p], p.s, y, { circumference: ring.C, base });
assert.ok(at(base + .55 * p.r * p.k) > .9, '底部大圆中心实');
assert.ok(towerDensity([p], p.s + 1.4 * p.r, base + 2 * p.r * p.k, { circumference: ring.C, base }) === 0, '高处偏外是空的');
assert.ok(towerPuffs(layer.deck.layers[0], 100, layer.deck.span).length <= TOWER_PUFFS);
// 云影：每个投到 uniform 的圆都落在某个 deck 团块的椭圆里（与 deck.density 同位置、同漂移）
assert.ok(uniforms.uCloudCount.value > 0 && uniforms.uCloudStrength.value > 0); assert.equal(uniforms.uCloudAtlas.value, layer.atlas);
const deck = layer.deck, t = 10;
for (let i = 0; i < uniforms.uCloudCount.value; i++) {
  const c = uniforms.uCloudPuffs.value[i], li = deck.layers.findIndex((L) => Math.abs(L.height - c.y) < 1e-9);
  assert.ok(li >= 1, '只用近 / 中层');
  const wrapX = (x) => { const s = deck.span; return ((x % s) + s * 1.5) % s - s * .5; };
  const d = deck.density(li, layer.center[0] + wrapX(c.x - layer.center[0]), c.z, t);
  assert.ok(d > 0, 'puff ' + i + ' 落在 deck 密度 > 0 的地方');
}
// 投影几何：接收面越低，沿太阳方向的偏移越大（与 deck.shadowAt 一致）
const sun = view.sunDir.toArray(), L = deck.layers[2];
const hitAt = (y) => (L.height - y) / sun[1];
assert.ok(hitAt(0) > hitAt(1.5), '地面比屋顶偏得多');
assert.ok(Math.abs(deck.shadowAt(0, 0, 0, sun, 0, { layer: 2, strength: 1 }) - deck.density(2, sun[0] * hitAt(0), sun[2] * hitAt(0), 0)) < 1e-12);
layer.setEnabled(false); assert.equal(layer.group.visible, false);
console.log('PASS cloud-deck-layer: 3 rings outside camera, blur/parallax ∝ depth (', sh.map((x) => x.toFixed(2)).join('/'), '), shadow circles on deck density, receiver-height projection');
