// 1305951750638231552 半影「画三遍」裁判对照：只读 REACode/src/penumbra.js 当裁判，
// 同一份高度场 + 同一个太阳下逐格比 core/penumbra.js。裁判是独立 2D 诊断（合成岛+塔），
// 这里只借用它的 composite/castShadow 输出，不改它的文件。
import assert from 'node:assert/strict';
import { buildWorld, composite } from '../../REACode/src/penumbra.js';
import { threeShadow, penumbraStats, PENUMBRA_THRICE } from '../src/core/penumbra.js';

// 裁判可量化参数钉死：权重 [.8,.34,.44]、内收 +0.7 体素高度、3×均值粗格、半影带 .10–.50、封顶 12 格
assert.deepEqual([...PENUMBRA_THRICE.weights], [.8, .34, .44]);
assert.equal(PENUMBRA_THRICE.pull, .7); assert.equal(PENUMBRA_THRICE.coarse, 3);
assert.deepEqual([...PENUMBRA_THRICE.band], [.1, .5]); assert.equal(PENUMBRA_THRICE.cap, 12);

const w = buildWorld(7);                       // 裁判合成场：岛 + 五塔，高度单位为体素层
const field = { nx: w.nx, nz: w.ny, res: 1, heights: w.hf };
for (const az of [0.3, 1.1, 2.4, 4.0]) {
  const ref = composite(w, az, {});            // 裁判默认 tanE=.52
  const sun = [Math.cos(az), 0.52, Math.sin(az)];
  const r = threeShadow(field, sun, { onTerrain: true });
  // 正常/内收两遍与裁判 hard/pulled 逐格一致（同 bias 口径：门槛 +pull）
  for (let i = 0; i < r.normal.length; i++) { assert.equal(r.normal[i], ref.hard.mask[i]); assert.equal(r.pulled[i], ref.pulled.mask[i]); }
  const s = penumbraStats(field, r);
  assert.equal(s.hard, ref.hardN); assert.equal(s.pulled, ref.pulledN);
  // 默认 bigSlopeScale=1（世界尺度坡率）：大体素足迹远小于裁判——裁判粗格未缩放坡率的尺度差，刻意不照抄
  const refBig = ref.bigUp.reduce((n, v) => n + (v > .5 ? 1 : 0), 0);
  assert.ok(s.big * 3 < refBig, `correct-slope big pass ${s.big} vs referee ${refBig}`);
  // bigSlopeScale=1/coarse 复现裁判第三遍：带宽与半影带格数贴齐
  const rq = threeShadow(field, sun, { onTerrain: true, bigSlopeScale: 1 / 3 });
  const sq = penumbraStats(field, rq);
  assert.ok(Math.abs(sq.bandWidth - ref.bandWidth) / ref.bandWidth < 0.08, `bandW ${sq.bandWidth} vs ${ref.bandWidth}`);
  assert.ok(Math.abs(sq.band - ref.band) / ref.band < 0.1, `band ${sq.band} vs ${ref.band}`);
  let mad = 0; for (let i = 0; i < rq.alpha.length; i++) mad += Math.abs(rq.alpha[i] - ref.alpha[i]);
  assert.ok(mad / rq.alpha.length < 0.02, 'alpha meanAbsDiff ' + mad / rq.alpha.length);
}
// 确定性：同输入两次逐字节一致
const a = threeShadow(field, [.6, .52, .4], { onTerrain: true }), b = threeShadow(field, [.6, .52, .4], { onTerrain: true });
assert.deepEqual([...a.alpha], [...b.alpha]); assert.deepEqual([...a.big], [...b.big]);
// pull 单调：内收门槛越高，pulled 越收（永远是 normal 的子集）
const count = (r) => r.pulled.reduce((n, v) => n + v, 0);
assert.ok(count(threeShadow(field, [.6, .52, .4], { pull: .9, onTerrain: true })) <= count(threeShadow(field, [.6, .52, .4], { pull: .2, onTerrain: true })));
// 权重全零 → 全透；非法 bigSlopeScale 拒绝
assert.ok(threeShadow(field, [.6, .52, .4], { weights: [0, 0, 0] }).alpha.every((v) => v === 0));
assert.throws(() => threeShadow(field, [.6, .52, .4], { bigSlopeScale: 0 }));
console.log('PASS referee parity: normal/pulled cell-identical, big-pass slope quirk parameterized (bandW ±8%), deterministic, pull monotonic');
