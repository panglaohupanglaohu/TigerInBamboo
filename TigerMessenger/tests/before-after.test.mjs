// R-B1 通用「之前 / 之后同机位对照」纯逻辑：pixelDiff / pushEntry / diffSentence + 面板接线静态检查。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/before-after.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pixelDiff, pushEntry, diffSentence, MAX_KEEP, DIFF_SIZE } from '../src/system-workshop/before-after.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const px = (n, v = 0) => new Uint8ClampedArray(n * 4).fill(v);

test('pixelDiff：全同 → 0；全不同 → changed 1；部分像素按 threshold 计', () => {
  const a = px(4, 100), b = px(4, 100);
  assert.deepEqual(pixelDiff(a, b), { mean: 0, changed: 0, pixels: 4 });
  const c = px(4, 200);
  const d = pixelDiff(a, c);
  assert.equal(d.changed, 1); assert.ok(d.mean > 0.3);
  const e = px(4); e[0] = 250; e[1] = 250; e[2] = 250;
  const f = pixelDiff(px(4), e, { threshold: 12 });
  assert.equal(f.changed, 0.25);
});

test('pixelDiff：尺寸不同 / 不是 RGBA 倍数 → RangeError', () => {
  assert.throws(() => pixelDiff(px(2), px(4)), RangeError);
  assert.throws(() => pixelDiff(new Uint8ClampedArray(6), px(2)), RangeError);
});

test('pushEntry：新的在前、最多 MAX_KEEP 组、字段齐全', () => {
  let es = [];
  for (let i = 0; i < MAX_KEEP + 3; i++) es = pushEntry(es, { layer: 'l', before: 'b' + i, after: 'a' + i, steps: ['x'], diff: { mean: i / 100, changed: 0 } });
  assert.equal(es.length, MAX_KEEP);
  assert.equal(es[0].before, 'b' + (MAX_KEEP + 2));
  assert.ok(es[0].at > 0 && es[0].pose === '当前镜头');
});

test('diffSentence：没比 / 完全一样 / 有差异三种说法', () => {
  assert.match(diffSentence(null), /还没比/);
  assert.match(diffSentence({ changed: 0, mean: 0 }), /完全一样/);
  assert.match(diffSentence({ changed: 0.5, mean: 0.12 }), /12\.00%.*50\.0%/);
});

test('面板接线：走 agent.compare(true/false) 同机位两拍、grabGame 读 #game 画布、只存内存不设默认', () => {
  const p = read('../src/system-workshop/before-after-panel.js');
  assert.match(p, /agent\.compare\(true\)/); assert.match(p, /agent\.compare\(false\)/);
  assert.match(p, /getElementById\('game'\)/);
  assert.match(p, /__tmBeforeAfter/);
  assert.doesNotMatch(p, /localStorage|setDefault|tm\.defaults/);
});
