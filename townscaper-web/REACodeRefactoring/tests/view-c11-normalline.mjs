// 第 56 批 C11 · 1482011744843223042「pixel thin lines from contrasts in my procedural normal map」
// view-c11-normalline.js：法线遍用大笔触法线扰动（最近邻副本）、合成阈值 uniform 化、只用法线反差（uDepthMix 0）、
// 没 normal 属性的网格不进法线遍（草卡把法线缓冲盖黑的实测问题）；关掉逐项还原，outline-pass.js 默认行为不变。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { ScreenOutlinePass } = await import('../src/world/outline-pass.js');
const NL = await import('../src/world/view-c11-normalline.js');
const { parseC11, C11_KEYS } = await import('../src/world/view-c11.js');

// 假 renderer：记录每次 render 时场景里哪些物体可见、覆盖材质是谁
const calls = [];
let target = null;
const renderer = {
  getPixelRatio: () => 1, getDrawingBufferSize: (v) => v.set(64, 48),
  getRenderTarget: () => target, setRenderTarget: (t) => { target = t; }, clear() {},
  render(scene, camera) { const vis = []; scene.traverse((o) => { if (o.isMesh && o.visible) vis.push(o.name); }); calls.push({ target, override: scene.overrideMaterial, vis }); },
};
const pass = new ScreenOutlinePass(renderer, { thickness: 1 });
const origFrag = pass.material.fragmentShader, origNormalMat = pass.normalMaterial;
assert.ok(origFrag.includes(NL.ND_TOKEN), '合成着色器里有默认法线阈值');

// ① 合成源补丁：阈值换 uniform，其他不动
const patched = NL.patchCompositeSource(origFrag);
assert.ok(patched.includes('smoothstep(uNdLo, uNdHi, nd)') && patched.includes('uniform float uNdLo;') && !patched.includes(NL.ND_TOKEN));
assert.equal(patched.replace('smoothstep(uNdLo, uNdHi, nd)', NL.ND_TOKEN).replace('\nuniform float uNdLo;\nuniform float uNdHi;', ''), origFrag, '只改了阈值两处');
assert.throws(() => NL.patchCompositeSource('void main(){}'), /token/);

// ② 法线遍材质：与主材质同一套扰动，最近邻副本，海面平法线
const map = new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(128), 4, 4); map.magFilter = THREE.LinearFilter;
const shadingU = { uShPN: { value: 1 }, uShPNMap: { value: map }, uShPNScale: { value: 4 } };
const mat = NL.paintedNormalMaterial(shadingU);
const near = mat.userData.uMap.value;
assert.ok(near !== map && near.magFilter === THREE.NearestFilter && near.image.data === map.image.data, '法线遍用最近邻副本（同一份像素）');
const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.normal.vertexShader, fragmentShader: THREE.ShaderLib.normal.fragmentShader };
mat.onBeforeCompile(sh);
assert.ok(sh.vertexShader.includes('vC11Pos = (modelMatrix * c11w).xyz') && sh.vertexShader.includes('USE_INSTANCING'), '顶点：世界坐标（含实例矩阵）');
assert.ok(sh.fragmentShader.includes('texture2D(uShPNMap, shUV / uShPNScale)') && sh.fragmentShader.includes('vC11Pos.y < uC11SeaY'), '片元：大笔触扰动 + 海面平法线');
assert.equal(sh.uniforms.uShPN, shadingU.uShPN, '强度 uniform 与主材质共用同一个对象（开关同步）');
assert.equal(sh.uniforms.uShPNMap, mat.userData.uMap);

// ③ 过滤渲染：没 normal 属性的网格只在法线遍里藏起来，渲染后恢复
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
const terrain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); terrain.name = 'terrain';
const cardGeo = new THREE.BufferGeometry(); cardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
const cards = new THREE.Mesh(cardGeo, new THREE.ShaderMaterial()); cards.name = 'grasscards';
const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); glass.name = 'cloudcard';
scene.add(terrain, cards, glass);
pass.normalMaterial = mat; calls.length = 0;
NL.renderWithNormalFilter(pass, scene, camera);
assert.equal(calls.length, 3, '颜色 / 法线 / 合成三遍');
assert.deepEqual(calls[0].vis.sort(), ['cloudcard', 'grasscards', 'terrain'], '颜色遍全画');
assert.equal(calls[1].target, pass.normalTarget); assert.equal(calls[1].override, mat);
assert.deepEqual(calls[1].vis, ['terrain'], '法线遍：草卡（无法线）与透明不写深度的都藏起来');
assert.ok(cards.visible && glass.visible && scene.overrideMaterial === null, '渲染后恢复');
assert.equal(pass.c11NoNormalHidden, 1);
pass.normalMaterial = origNormalMat;

// ④ install：开 → 改；关 → 逐项还原（含 r55 开关的原状态）
const state = { outline: false }, setLog = [];
const debug = { paintnormal: false };
const view = {
  postExtras: { get state() { return { ...state }; }, set(n, on) { state[n] = on; setLog.push([n, on]); }, get outlinePass() { return pass; } },
  shading: { on: debug, u: shadingU },
  setDebug(k, on) { debug[k] = on; setLog.push(['shade:' + k, on]); },
};
const nl = NL.install(view);
await nl.set(true);
assert.ok(state.outline && debug.paintnormal, '打开 outline + paintnormal');
assert.equal(pass.uniforms.uDepthMix.value, 0, '只用法线反差（剪影不另描）');
assert.ok(pass.material.fragmentShader.includes('uNdLo') && pass.uniforms.uNdLo.value === 0.025);
assert.ok(Object.prototype.hasOwnProperty.call(pass, 'render'), '实例上挂过滤 render');
const s1 = nl.stats(); assert.ok(s1.on && s1.paintedNormalPass);
nl.setThresholds(0.02, 0.07); assert.equal(pass.uniforms.uNdHi.value, 0.07); assert.throws(() => nl.setThresholds(0.1, 0.05), RangeError);
await nl.set(false);
assert.equal(pass.material.fragmentShader, origFrag, '合成着色器逐字还原');
assert.equal(pass.normalMaterial, origNormalMat, '法线遍材质还原');
assert.equal(pass.uniforms.uDepthMix.value, 1, 'uDepthMix 还原');
assert.ok(!Object.prototype.hasOwnProperty.call(pass, 'render') && typeof pass.render === 'function', '实例 render 删掉，回到类方法');
assert.ok(!state.outline && !debug.paintnormal, '本开关打开的 outline / paintnormal 按原状态关回去');
// 事先已开 outline 的情况：关 normalline 不该把用户的 outline 关掉
state.outline = true; await nl.set(true); await nl.set(false); assert.ok(state.outline, '用户原本开着的 outline 保留');

// ⑤ URL 解析
assert.deepEqual(parseC11('?c11=normalline,bogus,grassline'), ['normalline', 'grassline']);
assert.ok(C11_KEYS.includes('normalline'));
console.log('PASS view-c11-normalline：笔触法线进法线遍（最近邻）、阈值 uniform 化、无法线网格不进法线遍、开关逐项还原');
