// 1703750394164199473（旋涡团块）/ 1704246032626762189（可变疏密+浅高度分段）
// 裁判 engine/blotch.js 逐式参数的对齐验收：配色/密度权重/细颗粒已移植；
// 跨崖（rim 场等深收口）与反射（只改 albedo）一致性为本地可验项。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQuadGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { decorateCells, buildCellIndex } from '../src/core/spatial.js';
import { BLOTCH_GLSL } from '../src/terrain/blotch-pattern.js';
import {
  createBlotchAtlasData, sampleBlotchAtlas, buildBlotchRimField,
  blotchRimTint, blotchWobble, BLOTCH_RIM_GLSL,
} from '../src/terrain/blotch-atlas.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

// ── ① GLSL 源码断言：旧噪声路径（uBlotch mode 1）按裁判 BODY 逐式参数 ──────────
assert.ok(BLOTCH_GLSL.includes('vec3 blotchTone'), 'blotchTone 应返回 vec3 配色 tint');
// 角度场 = 裁判 bHash/bNoise/bWobble 逐式移植（123.34/456.21/45.32、.72/.28、2.07+17.3）
for (const frag of ['123.34', '456.21', '45.32', 'bwWobble', '*.72+bwNoise(p*2.07+17.3)*.28', '(bwWobble(w.xz * .3) - .5) * 2.0 * uBlotchStyle.x'])
  assert.ok(BLOTCH_GLSL.includes(frag), '角度场缺裁判式 ' + frag);
// 遮罩阈值 / 密度权重 / 配色 / 边缘压暗 / 细颗粒 = 裁判常数
for (const frag of [
  'smoothstep(.44 - width, .60 + width, b)',          // cold .44/.60
  'smoothstep(.55 - width, .70 + width',              // warm .55/.70
  'smoothstep(.36 - width, .48 + width, b) * smoothstep(.70 + width, .54 - width, b)', // edge .36/.48·.70/.54
  'mix(1. - uBlotchStyle.y, 1. + uBlotchStyle.y * .45, smoothstep(.34, .66',           // dens=mix(1-d,1+d*.45,ss(.34,.66))
  'p * .22',                                          // 密度场=旋涡后坐标的 .22 倍尺度（裁判 buv*.22）
  'vec3(.86, 1.02, .74)', 'vec3(1.16, .88, .70)',     // 橄榄/锈红配色
  '1. - cold * .75', 'edge * wgt * .10',              // w2 抑制与边缘压暗
  'step(.80, bfbm(p * 12.0 + 4.4)) * wgt * .22 * grainRes',  // 细颗粒 step(.80)·w·.22
  'smoothstep(.010, .030, length(fwidth(w.xz)) * 14.',       // grainRes 像素宽淡出
]) assert.ok(BLOTCH_GLSL.includes(frag), 'mode1 缺裁判式 ' + frag);
// 确定性：uniform 只有 3 个 → 同一世界位置在两个网格/两次采样得同一 tint（双侧对照的结构性保证）
assert.equal((BLOTCH_GLSL.match(/uniform\s+\w+\s+\w+/g) || []).length, 3, 'blotchTone 只能读 3 个 uniform');

// ── ② 图集路径 BLOTCH_RIM_GLSL：补齐裁判 BODY 末项细颗粒 ──────────────────────
for (const frag of ['step(.80,bl.b)*w*.22*grainRes', 'grainRes=1.-smoothstep(.010,.030,length(fwidth(wp.xz))*14.'])
  assert.ok(BLOTCH_RIM_GLSL.includes(frag), '图集路径缺细颗粒 ' + frag);

// ── ③ 反射一致性：两条路径只改 diffuseColor（albedo），不碰高光/粗糙度/环境反射 ──
for (const [name, src] of [['BLOTCH_GLSL', BLOTCH_GLSL], ['BLOTCH_RIM_GLSL', BLOTCH_RIM_GLSL]])
  assert.ok(!/roughness|metalness|specular|envMap|outgoingLight|indirectDiffuse/i.test(src), name + ' 不应改光照项');
const shadingSrc = fs.readFileSync(new URL('../src/world/view-shading.js', import.meta.url), 'utf8');
assert.ok(shadingSrc.includes('diffuseColor.rgb*=blotchRimTint(vSpPos,shWN)'), '图集笔触应乘在 diffuseColor');
assert.ok(shadingSrc.includes(".replace('#include <color_fragment>'"), '注入点应在 color_fragment（光照前）');
const viewSrc = fs.readFileSync(new URL('../src/world/view.js', import.meta.url), 'utf8');
assert.ok(viewSrc.includes('diffuseColor.rgb *= blotchTone(vWPos)'), '旧路径也应乘在 diffuseColor');
// 裁判默认值在 View 侧同源：swirl 2.3 / density .55（engine/blotch.js createBlotch 默认）
assert.ok(viewSrc.includes('Vector4(2.3,.55,.9,1)'), 'blotchStyle 默认应与裁判 swirl2.3/density.55 同源');

// ── ④ 旧路径 tone 的 JS 镜像：逐式翻译 BLOTCH_GLSL mode1（fwidth 项取 0）────────
const bh = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const bn = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); return (bh(i, j) + (bh(i + 1, j) - bh(i, j)) * fx) * (1 - fy) + (bh(i, j + 1) + (bh(i + 1, j + 1) - bh(i, j + 1)) * fx) * fy; };
const bfbm = (x, y) => { let s = 0, a = .5, px = x, py = y; for (let k = 0; k < 4; k++) { s += a * bn(px, py); px = px * 2.03 + 7.1; py = py * 2.03 + 7.1; a *= .5; } return s; };
const bwHash = (x, y) => { let px = fract(x * 123.34), py = fract(y * 456.21); const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d; return fract(px * py); };
const bwNoise = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); return (bwHash(i, j) + (bwHash(i + 1, j) - bwHash(i, j)) * fx) * (1 - fy) + (bwHash(i, j + 1) + (bwHash(i + 1, j + 1) - bwHash(i, j + 1)) * fx) * fy; };
const bwWobbleJS = (x, y) => bwNoise(x, y) * .72 + bwNoise(x * 2.07 + 17.3, y * 2.07 + 17.3) * .28;
// 与图集路径已验收的 blotchWobble（裁判 bWobble 移植）逐位一致 → 两路角度场同源
for (const [x, y] of [[0, 0], [1.7, -3.2], [-8.4, 5.5], [12.34, -56.78]]) assert.equal(bwWobbleJS(x, y), blotchWobble(x, y), `wobble ${x},${y}`);

function blotchToneJS([x, y, z], { levelH = 1, swirl = 2.3, density = .55, scale = .9, strength = 1 } = {}) {
  const level = Math.floor(y / Math.max(levelH, 1e-5) + .01);
  let px = x * scale, pz = z * scale;
  const a = (bwWobbleJS(x * .3, z * .3) - .5) * 2 * swirl, ca = Math.cos(a), sa = Math.sin(a);
  // GLSL mat2(ca,-sa,sa,ca)*p = (ca·px+sa·pz, -sa·px+ca·pz)
  const rx = ca * px + sa * pz, rz = -sa * px + ca * pz; px = rx; pz = rz;
  const qx = bfbm(px * .7 + level * 1.7, pz * .7 + level * 1.7), qz = bfbm(px * .7 + 5.2 - level, pz * .7 + 5.2 - level);
  const b = bfbm(px * 1.1 + qx * 2.5 + level * 3.1, pz * 1.1 + qz * 2.5 + level * 3.1);
  const cold = sstep(.44, .60, b), warm = sstep(.55, .70, bfbm(px * .9 + qx * 1.3 + level * 2.6 + 17.7, pz * .9 + qz * 1.3 + level * 2.6 + 17.7));
  const edge = sstep(.36, .48, b) * sstep(.70, .54, b);
  const dens = (1 - density) + density * 1.45 * sstep(.34, .66, bfbm(px * .22 + 51.7, pz * .22 + 19.3));
  const cw = cold * dens, wgt = cw * strength, w2 = warm * strength * (1 - cold * .75);
  let t = [1, 1, 1];
  t = t.map((v, i) => v + ([.86, 1.02, .74][i] - v) * wgt);
  t = t.map((v, i) => v + ([1.16, .88, .70][i] - v) * w2);
  t = t.map((v) => v * (1 - edge * wgt * .10));
  const grain = (bfbm(px * 12 + 4.4, pz * 12 + 4.4) >= .80 ? 1 : 0) * wgt * .22;   // grainRes=1（默认像素宽）
  t = t.map((v) => v * (1 - grain));
  return { t, cold, warm, edge, dens, wgt, w2, grain };
}

// ④a 确定性双侧：同一世界点两次/两侧取值逐位相等
const P = [3.456, 2.0, -7.891];
assert.deepEqual(blotchToneJS(P), blotchToneJS(P), '同点同参应逐位一致（双侧着色对照）');
// ④b 零强度 = 关闭（本路径契约；裁判在图集路径的 edge 特例不适用这里）
assert.deepEqual(blotchToneJS(P, { strength: 0 }).t, [1, 1, 1], 'strength=0 应恒等');
// ④c density=0 → dens≡1（裁判 mix(1-0,1+0,·)=1）；density 变化改权重
assert.equal(blotchToneJS(P, { density: 0 }).dens, 1);
const dLo = blotchToneJS(P, { density: 0 }), dHi = blotchToneJS(P, { density: 1 });
assert.notEqual(dLo.dens, dHi.dens, '密度滑杆应改变覆盖权重');
// ④d 配色方向：扫一片区域，色块内部 tint 应呈裁判橄榄色（g 最高）而非旧的灰褐三档
let olive = null, warmPt = null;
for (let x = -30; x < 30 && (!olive || !warmPt); x += .37) for (let z = -30; z < 30; z += .41) {
  const r = blotchToneJS([x, 2, z]);
  if (!olive && r.cold > .9 && r.warm < .05 && r.edge < .05 && r.grain === 0) olive = r;
  if (!warmPt && r.warm > .7 && r.cold < .1 && r.grain === 0) warmPt = r;
}
assert.ok(olive, '应找到冷色块内部点');
assert.ok(olive.t[1] > olive.t[0] && olive.t[1] > olive.t[2], `色块内应偏橄榄绿 ${olive.t}`);
// 冷块核心 tint ≈ mix(1, 橄榄, wgt)（warm/edge/grain 均已筛到 ~0，容差 .02）
for (const [i, target] of [[0, 1 + (.86 - 1) * olive.wgt], [1, 1 + (1.02 - 1) * olive.wgt], [2, 1 + (.74 - 1) * olive.wgt]])
  assert.ok(Math.abs(olive.t[i] - target) < .02, `橄榄混合应与裁判同式 ch${i}: ${olive.t[i]} vs ${target}`);
assert.ok(warmPt && warmPt.t[0] > 1.0, '暖色斑应向裁判锈红方向提亮');

// ── ⑤ 图集路径细颗粒（CPU 参考与 GLSL 同式）：B≥.80 且色块覆盖内 → grain>0 ────
const atlas = createBlotchAtlasData();
const fakeRim = { sample: () => [0.5, 2.0, 2.0] };   // rimDist .5→rimMask=1、below=0、flat 顶面
let gp = null, np = null;
for (let u = 0; u < 4 && (!gp || !np); u += 1 / 128) for (let v = 0; v < 4 && (!gp || !np); v += 1 / 128) {
  const bl = sampleBlotchAtlas(atlas, u, v);
  if (!gp && bl[0] >= .62 && bl[2] >= .80) gp = [u, v];
  if (!np && bl[0] >= .62 && bl[2] <= .70) np = [u, v];
}
assert.ok(gp && np, '图集应同时存在 颗粒点/无颗粒 的色块位置');
// 裁判口径：grainRes=1-ss(.010,.030,|fwidth|*14) —— 颗粒是极近景细节，像素宽>.002 wu 即淡出
const gt = blotchRimTint(atlas, fakeRim, [gp[0] / .09, 2, gp[1] / .09], [0, 1, 0], { swirl: 0, streak: 0, segments: 0, segFootprint: .001 });
assert.ok(gt.grain > 0 && gt.coverage > 0, `颗粒点应有 grain ${gt.grain}`);
assert.ok(gt.tint.every((v) => v > .5 && v < 1.5));
const nt = blotchRimTint(atlas, fakeRim, [np[0] / .09, 2, np[1] / .09], [0, 1, 0], { swirl: 0, streak: 0, segments: 0, segFootprint: .001 });
assert.equal(nt.grain, 0, 'B<.80 处不应有颗粒');
// 细颗粒随像素宽淡出：segFootprint 大 → grainRes 0 → grain 0（远处不噪闪；默认 .02 本就远于阈值）
const gf = blotchRimTint(atlas, fakeRim, [gp[0] / .09, 2, gp[1] / .09], [0, 1, 0], { swirl: 0, streak: 0, segments: 0, segFootprint: .1 });
assert.equal(gf.grain, 0, '像素宽>0.03 时颗粒应淡出（远处不噪闪）');

// ── ⑥ 共享 World 跨崖一致性：顶面崖肩收住→崖面受控渗漏→等深线收口 ────────────
const grid = decorateCells(buildQuadGrid({ radius: 8 }));
const world = new World(grid); generateTerrain(world, { seed: 3 });
const index = buildCellIndex(grid), L = .5;
const rim = buildBlotchRimField(world, { res: 96, levelHeight: L, index });
// 6a 世界位置唯一决定着色：相邻两格共边中点，从两侧各算一次 → 逐位一致（跨网格面片无跳变）
let shared = 0;
for (const c of grid.cells) {
  if (!world.top(c)) continue;
  for (const nid of c.edgeNeighbors) {
    if (nid < 0 || nid <= c.id) continue; const n = grid.cells[nid]; if (world.top(n) !== world.top(c)) continue;
    const mx = (c.cx + n.cx) / 2, mz = (c.cz + n.cz) / 2, p = [mx, world.top(c) * L, mz];
    const a1 = blotchRimTint(atlas, rim, p, [0, 1, 0]), a2 = blotchRimTint(atlas, rim, p, [0, 1, 0]);
    assert.deepEqual(a2.tint, a1.tint, '共边点两次采样应逐位一致'); shared++;
  }
}
assert.ok(shared > 30, `共边对照点 ${shared}`);
// 6b 崖肩格顶面不画（rimDist≈0），崖面在 bleed 内受控渗、过深归零（等深线收口一致）
const rimCell = grid.cells.find((c) => rim.rimCell[c.id] && world.top(c) >= 3);
assert.ok(rimCell, '需要≥3层的崖肩格');
const top = world.top(rimCell) * L, e = rimCell.pts[0];
const onTop = blotchRimTint(atlas, rim, [e.x, top, e.z], [0, 1, 0], { bleed: .14 });
const onWall = blotchRimTint(atlas, rim, [e.x, top - .05, e.z], [1, 0, 0], { bleed: .14 });
const tooDeep = blotchRimTint(atlas, rim, [e.x, top - .30, e.z], [1, 0, 0], { bleed: .14 });
assert.equal(onTop.coverage, 0, '崖肩顶面应停在边前（rimMask=0）');
assert.ok(onWall.bleedMask > 0 && onWall.coverage >= 0, '崖面贴边处应受控渗漏');
assert.equal(tooDeep.coverage, 0, '超过 bleed 深度应齐平归零（等深线收口）');

// ── ⑦ 反射/光照结构复核：裁判 MeshStandardMaterial 也是先改 diffuseColor 再统一光照 ──
assert.ok(!/uBlotchRimSeg|uBlotchRimP|uBlotchRimQ/.test(BLOTCH_GLSL), '旧路径不应依赖图集路径 uniform（两路独立可开关）');
console.log(`PASS judge-aligned blotch: vec3 tints (.86,1.02,.74 / 1.16,.88,.70), dens mix(1-d,1+d*.45), verbatim wobble (== blotchWobble), grain step(.80)·w·.22 ported to both paths, albedo-only (reflection-consistent), shared-World two-sided ${shared} points bitwise, cross-cliff top-stop→bleed→isodepth`);
