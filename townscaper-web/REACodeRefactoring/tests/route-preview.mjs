import assert from 'node:assert/strict';
import { buildRoutePreview, landArcs, roundCorners, buriedSamples } from '../src/core/route-preview.js';
import { samplePath } from '../src/core/path-samples.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// 1. 空 / 单点
assert.deepEqual(buildRoutePreview([]).points, []);
assert.deepEqual(buildRoutePreview([[1, 2, 3]]).points, [[1, 2, 3]]);
assert.equal(buildRoutePreview([[1, 2, 3]]).hops, 0);

// 2. 平直段：不加弧、不加圆角，长度等于折线长度
const flat = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]];
const fr = buildRoutePreview(flat, { spacing: 0.1 });
assert.equal(fr.hops, 0); assert.equal(fr.corners, 0); assert.equal(fr.arcs, 0);
assert.ok(near(fr.length, 3), 'flat length ' + fr.length);
assert.ok(fr.points.every((p) => Math.abs(p[1]) < 1e-12));

// 3. 等弧长：相邻点间距都是 spacing（末点除外）
for (let i = 1; i < fr.distances.length; i++) {
  const step = fr.distances[i] - fr.distances[i - 1];
  assert.ok(near(step, 0.1) || i === fr.distances.length - 1, 'spacing at ' + i + ' = ' + step);
}

// 4. 平地直角：尖角被切掉、路径变短，但不出两段围成的方框
const L = [[0, 0, 0], [2, 0, 0], [2, 0, 2]];
const pressed = roundCorners(L, { radius: 0.3, segs: 10 });
assert.equal(pressed.corners, 1);
const len = pressed.points.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pressed.points[i - 1][0], p[1] - pressed.points[i - 1][1], p[2] - pressed.points[i - 1][2]) : 0), 0);
assert.ok(len < 4 - 1e-3, '圆角应当把尖角切短 ' + len);
const nearCorner = Math.min(...pressed.points.map((p) => Math.hypot(p[0] - 2, p[1], p[2])));
assert.ok(nearCorner > 0.02, '尖角本身不该留在点串里 ' + nearCorner);
assert.ok(pressed.points.every((p) => p[0] <= 2 + 1e-9 && p[2] >= -1e-9), '圆角不得越出方框');

// 5. 落崖弧：沿口在上层高度，落点外抛 land 落在下层
const step = [[0, 1, 0], [4, 0, 0]];
const la = landArcs(step, { minStep: 0.5, at: 0.5, land: 0.55 });
assert.equal(la.arcs, 1);
assert.deepEqual(la.points[1], [2, 1, 0], '沿口位置');
const land = la.points.find((p) => near(p[1], 0) && p[0] > 2);
assert.ok(land && near(land[0], 2.55), '落点应当外抛 0.55，实际 ' + JSON.stringify(land));
// 落差不到 minStep 不加弧
assert.equal(landArcs([[0, 1, 0], [4, 0.7, 0]], { minStep: 0.5 }).arcs, 0);
// 段太短：外抛距离是**上限**，按剩余段长收边（第 175 轮：真实导航图一格只有 0.42–0.47 宽，
// 固定 0.55 会越过终点，原实现整段放弃弧 → 主战场 2 处跨崖 6 个点埋进崖体）
const short = landArcs([[0, 1, 0], [0.4, 0, 0]], { minStep: 0.5, land: 0.55 });
assert.equal(short.arcs, 1);
const shortLand = short.points.find((p) => near(p[1], 0));
assert.ok(shortLand && shortLand[0] > 0.2 && shortLand[0] < 0.4, '落点收边到剩余段内，实际 ' + JSON.stringify(shortLand));
// 剩余余量小到塞不下弧（< 5% 段长）才退化成斜落
assert.equal(landArcs([[0, 1, 0], [0.4, 0, 0]], { minStep: 0.5, land: 0.55, at: 0.95 }).arcs, 0);

// 6. 关节点：预览点串一个都不许埋在岩体里，直连折线必然埋
const surface = (x) => (x < 2 ? 1 : 0);            // 崖沿在 x=2，左侧高 1 层
const naive = samplePath(step, { spacing: 0.12 }).points;
assert.ok(buriedSamples(naive, surface, 0.02).length > 10, '直连折线本该埋着');
const preview = buildRoutePreview(step, { spacing: 0.12, radius: 0.3 });
assert.equal(preview.hops, 1); assert.equal(preview.arcs, 1);
assert.deepEqual(buriedSamples(preview.points, surface, 0.02), []);
assert.ok(preview.points.every((p) => p[1] >= -1e-9 && p[1] <= 1 + 1e-9), '不得冲出两层地面');
assert.ok(preview.points.every((p) => p[0] >= -1e-9 && p[0] <= 4 + 1e-9), '不得飞出水平范围');
// 外抛段真的存在：x 在 (2, 2.55) 之间、y 严格介于两层之间的点至少 2 个
const onArc = preview.points.filter((p) => p[0] > 2.01 && p[0] < 2.54 && p[1] > 0.05 && p[1] < 0.95);
assert.ok(onArc.length >= 2, '外抛弧上的点 ' + onArc.length);

// 7. 两级台阶：崖沿位置必须给对，否则弧会落在台地中间自己埋自己
const twoStep = [[1, 2, 1], [5, 1, 1], [5, 1, 6], [9, 0, 6]];
const terraces = (x) => (x < 4 ? 2 : x < 8 ? 1 : 0);   // 两道崖：x=4 与 x=8
const cliffAt = (a, b) => ((a[1] === 2 ? 4 : 8) - a[0]) / (b[0] - a[0]);
const tr = buildRoutePreview(twoStep, { spacing: 0.1, at: cliffAt });
assert.equal(tr.hops, 2); assert.equal(tr.arcs, 2);
assert.deepEqual(buriedSamples(tr.points, terraces, 0.05), []);
// 反向对照：崖沿瞎猜在段中点，弧落在台地上，点串必然埋住
const blind = buildRoutePreview(twoStep, { spacing: 0.1 });
assert.equal(blind.arcs, 2);
assert.ok(buriedSamples(blind.points, terraces, 0.05).length > 10, '中点落崖本该埋着');

// 8. 参数与输入校验
assert.throws(() => buildRoutePreview([[NaN, 0, 0]]));
assert.throws(() => buildRoutePreview([[0, 0, 0]], { spacing: 0 }));
assert.throws(() => landArcs([[0, 0, 0]], { minStep: 0 }));
assert.throws(() => landArcs([[0, 0, 0]], { at: 1 }));
assert.throws(() => landArcs([[0, 1, 0], [4, 0, 0]], { land: 0 }));
assert.throws(() => landArcs([[0, 1, 0], [4, 0, 0]], { arcSegs: 1 }));
assert.throws(() => buildRoutePreview(twoStep, { at: () => 1.2 }));
assert.throws(() => roundCorners(L, { radius: 0 }));
assert.throws(() => roundCorners(L, { segs: 1 }));
assert.throws(() => buriedSamples(naive, surface, -1));
assert.throws(() => buriedSamples([[0, 0]], surface));

// 9. 不修改输入
const frozen = [[0, 1, 0], [4, 0, 0]];
const copy = JSON.stringify(frozen);
buildRoutePreview(frozen, { spacing: 0.2 });
assert.equal(JSON.stringify(frozen), copy);

console.log('PASS 落崖弧/圆角/等弧长/不埋点/输入不变式');
