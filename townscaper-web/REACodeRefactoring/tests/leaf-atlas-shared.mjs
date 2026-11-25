// 1241046107125399552（原版裁判：REACode src/texelsnap.js bakeAtlas——
// x0 = y0 = size − corner = 96，128² 图集右下 32² 植物角；采样 = UV 按 2 texel
// 台阶的连续重映射 + 双线性，非最近邻点采样）。
// 断言：① 保留区布局与全城 TownSkin 同一份常量；② 独立叶图集与全城图集的植物角
// 逐字节一致（同一 motif，单一来源）；③ 图集数据是进程级单例；④ 连续 texel
// 采样（中点取混合值、ε 扰动 ε 变化）；⑤ 确定性。
import assert from 'node:assert/strict';
import { buildLeafAtlas, sharedLeafAtlas, leafPatternCPU, sphereLeafUV, LEAF_ATLAS_SIZE, LEAF_CORNER } from '../src/core/leaf-atlas.js';
import { buildSkinAtlas, PLANT_RECT, SKIN_SIZE } from '../src/core/town-skin.js';

/* ① 布局对齐原作：128² 图集、右下 32² 角 = (96,96,32,32) */
assert.equal(LEAF_ATLAS_SIZE, 128); assert.equal(SKIN_SIZE, 128);
assert.deepEqual(PLANT_RECT, { x: 96, y: 96, w: 32, h: 32 }, '植物保留区 = 右下 32² 角（裁判：size−corner=96）');
assert.equal(LEAF_CORNER, PLANT_RECT, 'leaf-atlas 与 town-skin 同一份布局常量');

/* ② 独立叶图集的植物角 == 全城图集的植物角（逐字节），角外 alpha = 0 */
const leaf = buildLeafAtlas();
const town = buildSkinAtlas([{ r: .6, g: .55, b: .5 }]);
let cornerChecked = 0, outsideAlpha = 0;
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
  const o = (y * 128 + x) * 4, inside = x >= 96 && y >= 96;
  if (inside) { for (let c = 0; c < 4; c++) assert.equal(leaf.data[o + c], town[o + c], `角内(${x},${y}) ch${c} 与全城图集一致`); cornerChecked++; }
  else if (leaf.data[o + 3] !== 0) outsideAlpha++;
}
assert.equal(cornerChecked, 1024, '32² = 1024 texel'); assert.equal(outsideAlpha, 0, '角外保留为空（不占其他色格）');

/* ③ 共享单例：两次取同一对象；数据与新建图集逐字节一致 */
assert.equal(sharedLeafAtlas(), sharedLeafAtlas(), 'sharedLeafAtlas 返回同一对象');
assert.equal(sharedLeafAtlas().data.length, 128 * 128 * 4);
assert.deepEqual(sharedLeafAtlas().data, leaf.data, '单例数据与 buildLeafAtlas 一致');

/* ④ 连续 texel 采样（CPU 镜像 leafPattern）：中点是混合、ε 扰动 ε 变化。
 * skipTexel(t, fw=1) = t − .5：角内 texel k 的中心映射在 u = (k+1)/32。 */
const f = (u, v) => leafPatternCPU(leaf.data, u, v, 1);
const cornerUV = (k) => (k + 1) / 32;   // u 使双线性采样恰好落在角内 texel k 中心
let found = null;
outer: for (let y = 97; y < 127; y++) for (let x = 97; x < 127; x++) {
  const a = leaf.data[(y * 128 + x) * 4], b = leaf.data[(y * 128 + x + 1) * 4];
  if (Math.abs(a - b) > 20) { found = { kx: x - 96, ky: y - 96, a, b }; break outer; }
}
assert.ok(found, '植物角内存在相邻不等 texel');
// texel 中心各自精确回读；两中心中点取双线性混合
const cA = f(cornerUV(found.kx), cornerUV(found.ky)), cB = f(cornerUV(found.kx + 1), cornerUV(found.ky));
const mid = f((cornerUV(found.kx) + cornerUV(found.kx + 1)) / 2, cornerUV(found.ky));
assert.ok(Math.abs(cA * 255 - found.a) < 1 && Math.abs(cB * 255 - found.b) < 1,
  `texel 中心精确回读（cA=${(cA * 255).toFixed(1)} vs ${found.a}，cB=${(cB * 255).toFixed(1)} vs ${found.b}）`);
assert.ok(mid > Math.min(cA, cB) - 1e-3 && mid < Math.max(cA, cB) + 1e-3 && Math.abs(mid - (cA + cB) / 2) < 0.2,
  `中点连续混合（cA=${cA.toFixed(3)} mid=${mid.toFixed(3)} cB=${cB.toFixed(3)}）`);
// ε 扰动 → ε 变化（连续，不是量化跳变）；绕开 motif 硬边取多点
for (const [u, v] of [[.2, .3], [.45, .6], [.7, .15], [.55, .8], [.1, .9]]) {
  const base = f(u, v), du = Math.abs(f(u + 1e-4, v) - base), dv = Math.abs(f(u, v + 1e-4) - base);
  assert.ok(du < 0.05 && dv < 0.05, `连续采样 (${u},${v}) du=${du.toFixed(4)} dv=${dv.toFixed(4)}`);
}
// 大导数（缩小）淡出到 .5：与着色器 smoothstep(1,2,fw) 同口径
assert.equal(leafPatternCPU(leaf.data, .3, .4, 4), .5, 'fw≥2 完全淡出到均值');
// 球面 UV 连续（非接缝处）+ 确定性
const d0 = sphereLeafUV(.5, .3, .4), d1 = sphereLeafUV(.5001, .3, .4);
assert.ok(Math.abs(d0[0] - d1[0]) < 1e-3 && Math.abs(d0[1] - d1[1]) < 1e-3, 'sphereLeafUV 连续');

/* ⑤ 确定性 */
assert.deepEqual(buildLeafAtlas().data, leaf.data, 'buildLeafAtlas 确定性');
assert.equal(sharedLeafAtlas(), sharedLeafAtlas(), '单例二次调用仍同一对象');

console.log('PASS 1241046107125399552：32² 保留区对齐原作 (96,96,32,32)、独立/全城图集角内逐字节一致、共享单例、连续 texel 采样、确定性');
