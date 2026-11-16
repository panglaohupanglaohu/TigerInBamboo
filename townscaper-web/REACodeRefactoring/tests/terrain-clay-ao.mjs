// 1654401054828638214：灰模阶段的 AO 软阴 + 生成后的地形微调。
// 判据：① 平地不许有遮蔽/阴影（否则整片无故发灰）；② 凹处比台顶暗、且是连续值不是二值；
//       ③ 逆光侧被高台挡住时阴影 > 0；④ 微调只动半径内、整数层、夹在 0..levels、台地面积变大。
import assert from 'node:assert/strict';
import { buildIsland, tweakTerrain, terraceArea } from '../src/terrain/pipeline-stages.js';
import { vertexAO, sunShadow, shadeFactor, summarize, bakeClayField, triShade } from '../src/terrain/clay-ao.js';

// ---- 1. 平地：AO 全 1、阴影全 0、系数全 1（这条不过就等于"处处发灰"的假 AO）----
const flatPts = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 }, { x: 2, z: 2 }];
const flatH = [0, 0, 0, 0, 0];
const flatAO = vertexAO(flatPts, flatH, { radius: 3 });
const flatSh = sunShadow(flatPts, flatH, { dx: 1, dz: 0, steps: 6, reach: 0.4 });
assert.equal(Array.from(flatAO).every((v) => v === 1), true, '平地的 AO 必须全是 1');
assert.equal(Array.from(flatSh).every((v) => v === 0), true, '平地上不该有任何阴影');
assert.equal(Array.from(shadeFactor(flatAO, flatSh)).every((v) => Math.abs(v - 1) < 1e-9), true);

// ---- 2. 凹处：中心 0 层、四周 4 层 → 中心被压暗，且比四周暗 ----
const pitPts = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }, { x: 6, z: 6 }];
const pitH = [0, 4, 4, 4, 4, 5];
const pitAO = vertexAO(pitPts, pitH, { radius: 2.6, strength: 0.62, levels: 6 });
assert.ok(pitAO[0] < 0.8, '凹心的 AO 必须明显小于 1，实际 ' + pitAO[0]);
for (const i of [1, 2, 3, 4]) assert.ok(pitAO[i] > pitAO[0], '四周只要不比中心低，就应当比中心亮（i=' + i + '）');
assert.ok(pitAO[5] > pitAO[0], '远处的台顶不该被凹槽压暗');

// ---- 3. 软阴影：逆光侧被 6 层高的岩柱挡住 → 阴影 > 0；顺光侧没有东西挡 → 0 ----
const shPts = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: -2, z: 0 }];
const shH = [1, 6, 1];
const sh = sunShadow(shPts, shH, { dx: 1, dz: 0, steps: 12, reach: 0.25, tanSun: 0.35, cell: 1.2 });
assert.ok(sh[0] > 0, '岩柱在 +x 方向，原点必须被挡，实际 ' + sh[0]);
assert.equal(sh[1], 0, '岩柱自己顶上不该被自己的影子压暗');
assert.ok(sh[2] < sh[0], '−x 侧离岩柱更远、遮挡必须更少：' + sh[2] + ' vs ' + sh[0]);
assert.ok(sh[2] <= 0.2, '远处只允许扫到边缘一点遮挡，实际 ' + sh[2]);
assert.ok(sh[0] < 1, '软阴是比例不是布尔，实际 ' + sh[0]);

// ---- 4. 真岛：AO/阴影连续可分辨（不是 0/1 两档），且系数有下限 ----
const isl = buildIsland({ count: 150, radius: 10, seed: 1337 });
const field = bakeClayField(isl.points, isl.heights);
assert.equal(field.ao.length, isl.points.length);
assert.ok(summarize(field.ao).distinct > 20, 'AO 必须是一整段连续值：' + summarize(field.ao).distinct);
assert.ok(summarize(field.shadow).distinct > 3, '阴影也必须有中间值：' + summarize(field.shadow).distinct);
assert.ok(field.stats.ao.min >= 0 && field.stats.ao.max <= 1);
assert.ok(field.stats.factor.min >= 0.34 - 1e-9, '明暗系数不许低于下限');
assert.ok(field.stats.factor.max <= 1);
assert.ok(field.stats.factor.mean < 1, '岛上应当有被压暗的地方（否则 AO 没生效）');
const tri = triShade(isl.tris, field.factor);
assert.equal(tri.length, isl.tris.length);
assert.ok(tri.every((v) => v >= 0.34 - 1e-9 && v <= 1));

// ---- 5. 单调性 + 确定性 ----
assert.ok(shadeFactor([0.2], [0])[0] < shadeFactor([0.9], [0])[0], 'AO 越低必须越暗');
assert.ok(shadeFactor([1], [0.8])[0] < shadeFactor([1], [0.1])[0], '阴影越重必须越暗');
const field2 = bakeClayField(isl.points, isl.heights);
assert.deepEqual(Array.from(field2.factor), Array.from(field.factor), '同一输入必须给同一结果');

// ---- 6. 生成后微调：抬中心台地 → 台地面积变大、只动半径内、整数层 ----
const a0 = terraceArea(isl.points, isl.tris, isl.heights);
const tw = tweakTerrain(isl.points, isl.heights, { cx: 0, cz: 0, radius: 5, delta: 1 });
assert.ok(tw.count > 0, '必须真的改到点');
const a1 = terraceArea(isl.points, isl.tris, tw.heights);
assert.ok(a1 > a0, '抬台地之后面积必须变大：' + a0.toFixed(1) + ' → ' + a1.toFixed(1));
assert.equal(tw.heights.every((h) => Number.isInteger(h) && h >= 0 && h <= 6), true, '高度必须是 0..6 的整数层');
const changedIdx = new Set(tw.touched);
isl.points.forEach((p, i) => {
  const d = Math.hypot(p.x, p.z);
  if (d > 5) assert.equal(tw.heights[i], isl.heights[i], '半径外的点不许动（i=' + i + '）');
  if (!changedIdx.has(i)) assert.equal(tw.heights[i], isl.heights[i], '没被记进 touched 的点不许变');
});
assert.equal(new Set(tw.touched).size, tw.count, 'touched 不许重复');

// ---- 7. 微调参数卫生：delta 0 不动、反复抬到 levels 就夹住、不产生 NaN ----
const noop = tweakTerrain(isl.points, isl.heights, { cx: 0, cz: 0, radius: 5, delta: 0 });
assert.equal(noop.count, 0, 'delta=0 不该改任何点');
let cur = isl.heights;
for (let k = 0; k < 12; k++) cur = tweakTerrain(isl.points, cur, { cx: 0, cz: 0, radius: 5, delta: 1, levels: 6 }).heights;
assert.equal(cur.every((h) => h <= 6), true, '反复抬也要夹在 levels');
assert.equal(cur.every((h) => Number.isFinite(h)), true, '不许出现 NaN');
const down = tweakTerrain(isl.points, isl.heights, { cx: 0, cz: 0, radius: 5, delta: -1 });
assert.ok(down.heights.every((h) => h >= 0), '往下削也要夹在 0');

console.log('terrain-clay-ao PASS · AO ' + field.stats.ao.min.toFixed(3) + '–' + field.stats.ao.max.toFixed(3)
  + '（' + field.stats.ao.distinct + ' 档）· 阴影 P ' + (field.stats.shadow.mean * 100).toFixed(0) + '%'
  + ' · 微调 ' + tw.count + ' 点 · 台地面积 ' + a0.toFixed(1) + ' → ' + a1.toFixed(1));
