// 1151137783785771008「aperiodic infinite deterministic irregular relaxed quadrilateral grid」（第 50 轮，迁自 REACode src/quadinf.js）：
// buildInfinite 支持 origin（任意块中心开窗口）；两个错开的窗口，重叠区里完整块的顶点 —— raw / patch / blend 三种位置都逐位相同 → 可以无限平移拼接。
import assert from 'node:assert/strict';
import { buildInfinite, patchStep, windowSeam, verify } from '../src/core/infinite.js';
const N = 3, out = {};
for (const k of [0, 2, 4]) {
  const [dq, dr] = patchStep(N, k);
  const a = buildInfinite({ N, rings: 2, passes: 40 }), b = buildInfinite({ N, rings: 2, passes: 40, origin: [dq, dr] });
  for (const mode of ['raw', 'patch', 'blend']) {
    const s = windowSeam(a, b, mode);
    assert.ok(s.compared > 30, `${mode} 有足够多的重叠顶点（${s.compared}）`);
    assert.ok(s.max < 1e-9, `${mode} 两窗口重叠处位置一致（最大差 ${s.max}）`);
    out[`dir${k}-${mode}`] = s.compared;
  }
  const v = verify(b, 'blend'); assert.equal(v.flipped, 0, '平移窗口不翻折'); assert.equal(v.invalid, 0);
}
assert.throws(() => buildInfinite({ origin: [0.5, 0] }), RangeError);
console.log('PASS 无限四边形网格：任意块中心开窗口、重叠区 raw/patch/blend 逐位一致', JSON.stringify(out));
