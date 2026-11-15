// 777596437534240768（第 51 轮，迁自 REACode src/mipcustom.js + src/mipfilter.js）：自定义 mip 的四档过滤与采样。
import assert from 'node:assert/strict';
import { buildMips, sampleTrilinear, sampleAniso, levelStats, srgbToLinear } from '../src/light/mip-chain.js';
const checker = (n) => { const d = new Float32Array(n * n * 3); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d.fill((x + y) % 2, (y * n + x) * 3, (y * n + x) * 3 + 3); return { w: n, h: n, data: d }; };
const img = checker(64), out = {};
for (const f of ['box', 'linear', 'kaiser', 'sharp']) {
  const ch = buildMips(img, { filter: f }); assert.equal(ch.at(-1).w, 1, `${f} 一直降到 1×1`);
  const s1 = levelStats(ch[1]), deep = levelStats(ch[4]);
  out[f] = { mean1: +s1.meanLinear.toFixed(3), amp1: +s1.amp.toFixed(3), amp4: +deep.amp.toFixed(3), last: +srgbToLinear(ch.at(-1).data[0]).toFixed(3) };
}
// ① 线性空间平均才对：棋盘真值线性 0.5；box 在 sRGB 数值上平均 → 线性 ≈0.21（偏暗）
assert.ok(Math.abs(out.linear.mean1 - 0.5) < 0.01 && Math.abs(out.box.mean1 - 0.214) < 0.01, '线性空间平均保亮度，sRGB 平均偏暗');
// ② 远处收敛：box / linear / kaiser 在 1 级就是平色（振幅 0）；sharp 把对比度还回去 → 不收敛
assert.ok(out.linear.amp1 < 1e-6 && out.kaiser.amp4 < 0.005, '线性 / Kaiser 远处收敛成平色');
const stripes = { w: 64, h: 64, data: new Float32Array(64 * 64 * 3) }; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) stripes.data.fill((x >> 2) % 2 ? 1 : 0.2, (y * 64 + x) * 3, (y * 64 + x) * 3 + 3);
const lin2 = levelStats(buildMips(stripes, { filter: 'linear' })[2]), sharp2 = levelStats(buildMips(stripes, { filter: 'sharp' })[2]), kai2 = levelStats(buildMips(stripes, { filter: 'kaiser' })[2]);
assert.ok(sharp2.amp > lin2.amp, `中景细节：sharp 振幅 ${sharp2.amp.toFixed(3)} > linear ${lin2.amp.toFixed(3)}`);
assert.ok(kai2.amp <= lin2.amp + 1e-9, 'Kaiser 宽核压高频更狠');
// ③ 三线性 lod 在两级之间连续；各向异性：纵向强压缩的足迹比各向同性保留更多横向细节
const ch = buildMips(stripes, { filter: 'linear' });
const a = sampleTrilinear(ch, 0.31, 0.5, 1.0)[0], b = sampleTrilinear(ch, 0.31, 0.5, 1.5)[0], c = sampleTrilinear(ch, 0.31, 0.5, 2.0)[0];
assert.ok((b - a) * (b - c) <= 1e-9, '三线性 lod 单调过渡');
let isoAmp = [Infinity, -Infinity], anisoAmp = [Infinity, -Infinity];
for (let i = 0; i < 32; i++) { const u = i / 32 + 1 / 64, iso = sampleTrilinear(ch, u, 0.5, Math.log2(16))[0], an = sampleAniso(ch, u, 0.5, [1 / 64, 0], [0, 16 / 64])[0]; isoAmp = [Math.min(isoAmp[0], iso), Math.max(isoAmp[1], iso)]; anisoAmp = [Math.min(anisoAmp[0], an), Math.max(anisoAmp[1], an)]; }
assert.ok(anisoAmp[1] - anisoAmp[0] > (isoAmp[1] - isoAmp[0]) + 0.1, '各向异性沿主轴取 tap，横向条纹细节保留');
console.log('PASS 自定义 mip：线性空间平均、远处收敛 / sharp 保中景、Kaiser、三线性、各向异性', JSON.stringify({ ...out, stripesAmp2: { linear: +lin2.amp.toFixed(3), sharp: +sharp2.amp.toFixed(3), kaiser: +kai2.amp.toFixed(3) }, isoRange: +(isoAmp[1] - isoAmp[0]).toFixed(3), anisoRange: +(anisoAmp[1] - anisoAmp[0]).toFixed(3) }));
