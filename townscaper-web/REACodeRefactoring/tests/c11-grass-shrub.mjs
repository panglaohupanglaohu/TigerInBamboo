// 第 56 批 C11 · 1590674061092212738（草卡反差描边：站立处 vs 背景射线两次采样）+ 1707490932017279035（灌木带随崖高 + 崖壁台阶带）
// 测 core/c11-maps.js（烘图 + JS 孪生）和两个 View 着色补丁对真实着色器源码的 token / 改写。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const M = await import('../src/core/c11-maps.js');
const GL = await import('../src/world/view-c11-grassline.js');
const SB = await import('../src/world/view-c11-shrubband.js');
const { SHRUB_GLSL } = await import('../src/terrain/shrub-texture.js');
const { parseC11, C11_KEYS } = await import('../src/world/view-c11.js');

// 12×12 方格岛：外圈海；中间 6×6 是 1 层；其中 4×4 高台 4 层（高崖）；高台右下角 1 格 5 层（小落差）
const N = 12, cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const id = j * N + i;
  cells.push({ id, n: 4, cx: i + .5, cz: j + .5, pts: [{ id: j * (N + 1) + i, x: i, z: j }, { id: j * (N + 1) + i + 1, x: i + 1, z: j }, { id: (j + 1) * (N + 1) + i + 1, x: i + 1, z: j + 1 }, { id: (j + 1) * (N + 1) + i, x: i, z: j + 1 }],
    edgeNeighbors: [j > 0 ? id - N : -1, i < N - 1 ? id + 1 : -1, j < N - 1 ? id + N : -1, i > 0 ? id - 1 : -1] });
}
const world = new World({ cells });
const at = (i, j) => cells[j * N + i];
for (let j = 2; j < 10; j++) for (let i = 2; i < 10; i++) world.fill(at(i, j), 1, { rock: true });
for (let j = 4; j < 8; j++) for (let i = 4; i < 8; i++) world.fill(at(i, j), 4, { rock: true });
world.fill(at(7, 7), 5, { rock: true });
const index = { cellAt: (x, z) => (x >= 0 && z >= 0 && x < N && z < N ? at(Math.floor(x), Math.floor(z)) : null) };
const L = .5;

// ① 反差图：顶高写进 A，高台与低地颜色不同（对比边被拉开）
const map = M.bakeContrastHeightMap(world, index, { res: 96, levelHeight: L });
const hi = M.sampleMap(map, 5.5, 5.5), lo = M.sampleMap(map, 2.5, 2.5), sea = M.sampleMap(map, .5, .5);
assert.equal(sea[3], 0, '海：A=0');
assert.ok(Math.abs(hi[3] * map.maxH - 4 * L) < .02 && Math.abs(lo[3] * map.maxH - L) < .02, '顶高按层高写入 A');
const dRGB = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
assert.ok(dRGB(hi, lo) > .08, `高台/低地反差色不同（${dRGB(hi, lo).toFixed(3)}）`);
assert.ok(map.after.contrastDE > map.after.sameDE * 3, '求解后：对比边 ΔE ≫ 同类边');

// ② 草卡描边强度（JS 孪生）
// 高台中部的草，镜头在高处俯视：背景射线落回同一高台 → 几乎无描边
const mid = M.grassOutlineStrength(map, [5.5, 4 * L, 5.5], [5.5 - 3, 4 * L + 4, 5.5 - 3]);
assert.ok(mid.hit && mid.strength < .05, `高台中部：命中同区，强度 ${mid.strength.toFixed(3)}`);
// 高台沿口的草，镜头在台上低视角往外看：射线越过沿口落到低地 → 有描边
const rim = M.grassOutlineStrength(map, [4.1, 4 * L, 5.5], [6.5, 4 * L + 2.5, 5.5]);
assert.ok(rim.hit && rim.strength > .25, `高台沿口往外看：落到低地，强度 ${rim.strength.toFixed(3)}`);
// 同一棵草，镜头转到外面往里看：背景是高台自己 → 描边消失（随镜头变化）
const rimIn = M.grassOutlineStrength(map, [4.1, 4 * L, 5.5], [1, 4 * L + .6, 5.5]);
assert.ok(rimIn.strength < .05, `转到外侧往里看：背景同区，强度 ${rimIn.strength.toFixed(3)}`);
// 低地沿海的草往海看：没命中 → 背景色 0 → 有描边
const shore = M.grassOutlineStrength(map, [2.1, L, 5.5], [5, L + .5, 5.5]);
assert.ok(!shore.hit && shore.strength > .25, '往海看：背景是海/天，有描边');

// ③ 草卡着色器补丁：用真实 Vegetation 的草卡材质源码
const { Vegetation } = await import('../src/life/vegetation.js');
const veg = new Vegetation({ scene: new THREE.Group(), levelHeight: L });
const tm = veg.tufts.material, sh = { uniforms: {}, vertexShader: tm.vertexShader, fragmentShader: tm.fragmentShader };
GL.patchTuftShader(sh);
assert.ok(sh.vertexShader.includes('vEdge = uGL > .5 ? glOutline(origin, TH * scale * .8) : aEdge;') && sh.vertexShader.includes('float glOutline(vec3 o, float lift)'), '顶点着色器两次采样');
assert.ok(sh.fragmentShader.includes('uniform float uGL;') && sh.fragmentShader.includes('smoothstep(.06, .4, vEdge)'), '外轮廓乘描边强度');
assert.throws(() => GL.patchTuftShader({ vertexShader: 'void main() {}', fragmentShader: '' }), /tokens/);
// 关闭时（uGL=0）走原路径：vEdge=aEdge、外轮廓乘 1 → 与原着色器同义
assert.ok(sh.fragmentShader.includes('(uGL > .5 ? smoothstep(.06, .4, vEdge) : 1.)'));

// ④ 灌木带：崖高图 + 带宽缩放 + 崖壁台阶带
const drop = M.bakeShrubDropMap(world, index, { res: 96 });
const g = (x, z) => M.sampleMap(drop, x, z);
assert.equal(Math.round(g(4.5, 5.5)[1] * 15), 3, '高台沿口格最大落差 3 层'); assert.equal(Math.round(g(5.5, 5.5)[1] * 15), 0, '高台内部格无崖边');
assert.equal(Math.round(g(7.5, 7.5)[1] * 15), 4, '5 层格落差 4（对低地）');
assert.equal(Math.round(g(2.5, 2.5)[1] * 15), 1, '低地沿海落差 1');
assert.equal(drop.maxDrop, 4);
assert.ok(M.shrubDropScale(1) === .8 && M.shrubDropScale(4) === 1.6 && M.shrubDropScale(2.5) > M.shrubDropScale(2), '带宽随落差单调变宽');
// 4 层高台（落差 3）：中间台阶线 y = 2L、3L 下挂带；顶沿 4L 和崖脚 1L 不挂
assert.equal(M.wallLedgeBand(3 * L - .02, 4, 3, L), 1, '台阶线 3L 下方 → 带');
assert.equal(M.wallLedgeBand(2 * L - .02, 4, 3, L), 1, '台阶线 2L 下方 → 带');
assert.equal(M.wallLedgeBand(3 * L - .3, 4, 3, L), 0, '离台阶线远 → 无');
assert.equal(M.wallLedgeBand(4 * L - .02, 4, 3, L), 0, '顶沿不挂（顶面带负责）');
assert.equal(M.wallLedgeBand(1 * L - .02, 4, 3, L), 0, '崖脚以下不挂');
assert.equal(M.wallLedgeBand(.5 * L, 1, 1, L), 0, '1 层崖没有中间台阶');

// ⑤ 灌木着色补丁：token 来自真实 view.js 源码与 SHRUB_GLSL
const viewSrc = readFileSync(join(root, 'src/world/view.js'), 'utf8');
assert.ok(viewSrc.includes("diffuseColor.rgb = shrubApply(diffuseColor.rgb, vEdge, vWPos);"), 'view.js 有灌木 token');
const frag = '#include <common>\nuniform float uMountainMode;\nvarying vec3 vField;\nvarying float vUp;\nvarying vec3 vWPos;\nfloat bn(vec2 p){return 0.;}\nfloat bfbm(vec2 p){return 0.;}\n' + SHRUB_GLSL + '\nvoid main() {\n#include <color_fragment>\nif (uShrub > 0.5 && vField.z > 0.5 && vField.z < 1.5 && vUp > 0.8 && vEdge < 0.999) diffuseColor.rgb = shrubApply(diffuseColor.rgb, vEdge, vWPos);\n}';
const s2 = SB.patchShrubShader({ fragmentShader: frag }, L).fragmentShader;
assert.ok(s2.includes('uShrubStyle.x * c11ShrubScale(w) * ('), '带宽乘崖高缩放');
assert.equal(s2.split('uniform vec4 uShrubStyle;').length - 1, 1, 'uShrubStyle 只声明一次');
assert.equal(s2.split('uniform vec3 uShrubColor;').length - 1, 1, 'uShrubColor 只声明一次');
assert.ok(s2.indexOf('float c11ShrubScale') < s2.indexOf('vec3 shrubApply') && s2.indexOf('vec3 c11WallShrub') < s2.indexOf('void main()'), '函数在使用前声明');
assert.ok(s2.includes('c11WallShrub(diffuseColor.rgb, vWPos, 0.5000)'), '崖壁台阶带接在顶面带之后');
// 关时 uC11SB=0：c11ShrubScale 返回 1，墙带不进 → 与旧画面同义
assert.ok(SB.SHRUB_C11_GLSL.includes('if (uC11SB < .5) return 1.;'));

// ⑥ 分发
assert.deepEqual(parseC11('?c11=grassline,shrubband,bogus'), ['grassline', 'shrubband']);
assert.ok(C11_KEYS.includes('grassline') && C11_KEYS.includes('shrubband'));
console.log('PASS c11 grassline + shrubband', JSON.stringify({ mid: +mid.strength.toFixed(3), rim: +rim.strength.toFixed(3), rimIn: +rimIn.strength.toFixed(3), shore: +shore.strength.toFixed(3), contrastDE: +map.after.contrastDE.toFixed(1), sameDE: +map.after.sameDE.toFixed(2), maxDrop: drop.maxDrop }));

// ⑦ 1786014232594485497 山体贴图：岩壁片元 = 顶点烘焙明度 × 下坡条痕 + 脊线墨；只在 opaque_fragment 前插一行，运行时不采法线图
const MT = await import('../src/world/view-c11-mountaintex.js');
const mtFrag = 'float bn(vec2 p){return 0.;}\nfloat bfbm(vec2 p){return 0.;}\nvoid main() {\n#include <opaque_fragment>\n}';
const mt = MT.patchMountainShader({ fragmentShader: mtFrag }, L).fragmentShader;
assert.ok(mt.includes('c11MountainTex(diffuseColor.rgb, vMountainTone, vWPos') && mt.indexOf('vec3 c11MountainTex') < mt.indexOf('void main()'), '岩壁用顶点烘焙明度 vMountainTone');
assert.ok(!/texture2D\(\s*\w*[Nn]ormal/.test(MT.MOUNTAIN_TEX_GLSL), '不采法线图');
assert.ok(viewSrc.includes("attribute float aMountainTone;") && viewSrc.includes('#include <opaque_fragment>'), 'view.js 有 aMountainTone 与 opaque token');
assert.throws(() => MT.patchMountainShader({ fragmentShader: 'void main(){}' }, L), /tokens/);
assert.ok(C11_KEYS.includes('mountaintex'));
console.log('PASS c11 mountaintex patch');
