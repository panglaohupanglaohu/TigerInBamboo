// 第 78 轮 · 1120036868966502401 缺口 ①：等距格「贴地表 + 按岛体轮廓裁」。
// 原片依据：frame-0280 格网外缘是一格一格退让的锯齿（不是矩形外接框）、格线止于台沿；
// frame-0470 平台顶面整片方格、侧面无白格线、交点亮斑只在顶面。
// 这里锁三条纯逻辑判据：① 取不到地面的交点被丢掉；② 高差小 → 斜线跟随表面；③ 高差超阈值 → 竖线不画斜线。
import assert from 'node:assert/strict';
import { buildRegularLattice, drapeLattice } from '../src/core/quad-lattice.js';

// 4×3 格、格距 2 → 5×4 个交点，x∈[0,8]、z∈[0,6]
const lat = buildRegularLattice({ cols: 4, rows: 3, size: 2, origin: { x: 0, z: 0 } });
assert.equal(lat.vertices.length, 20, '交点 5×4');

// 地形：只有 x∈[2,6] 这一段有地面（模拟岛体只占中间），地面高 = 0.5 + 0.1x
const ground = (x) => 0.5 + 0.1 * x;
const sampleBox = (x) => (x >= 2 && x <= 6 ? ground(x) : null);
const boxed = drapeLattice(lat, sampleBox);

assert.equal(boxed.stats.vertices, 20);
assert.equal(boxed.stats.dropped, 8, 'x=0 与 x=8 两列共 8 个交点落在岛外 → 丢');
assert.equal(boxed.stats.kept, 12);
// 外缘锯齿：被丢掉的交点所在的边不画，所以边数少于满铺
assert.ok(boxed.stats.drawn < lat.stats.edges, '外缘按格退让：画出的边少于满铺 ' + boxed.stats.edges + ' 条');
assert.equal(boxed.stats.drawn + boxed.stats.vertical, boxed.positions.length / 6, '段数 = 贴面边 + 竖线');
assert.equal(boxed.stats.corners, boxed.stats.kept, '保留下来的交点都有亮斑');

// ② 沿 x 方向高差 0.2（格距 2 → 阈值 1.0，不算跨层）→ 斜线跟随表面，不落竖线
assert.equal(boxed.stats.vertical, 0, '高差 0.2 远小于阈值 → 不画竖线');
assert.ok(boxed.stats.stepped > 0, '沿坡的边确实带高差（斜线跟着地表走）');
assert.ok(boxed.stats.yFlat > 0.3, '整张格子不再是一张平板（y 跨度 ' + boxed.stats.yFlat + '）');
assert.equal(boxed.stats.maxY, +(0.5 + 0.1 * 6).toFixed(4), '最高交点 = 该处地表高');
assert.equal(boxed.stats.minY, +(0.5 + 0.1 * 2).toFixed(4), '最低交点 = 该处地表高');

// ③ 跨层：x<4 高 1、x>=4 高 3（差 2 > 阈值 1）→ 不画斜线。
//    第 79 轮改口径：默认 `breakMode='none'`，一条跨层线都不画（原片 frame-0072 / 0300 / 0470 / 0076 里
//    白格线到台沿就停住，没有把上下两层交点连起来的竖短线）；'single'/'pair' 是对照档。
const cliff = (x) => (x >= 2 && x <= 6 ? (x < 4 ? 1 : 3) : null);
const step = drapeLattice(lat, cliff);
assert.equal(step.stats.breakMode, 'none', '默认档就是 none');
assert.equal(step.stats.vertical, 0, '默认档跨层不落竖线（原片台沿处格线终止）');
assert.equal(step.stats.stepped, 0, '跨层不当成斜线，所以没有带高差的贴面边');
// x=4 竖列 4 个交点，跨层边共 2 行 × 2 侧 = 4 条 → 默认档全部跳过
assert.equal(step.stats.skipped, 4, '4 条跨层边被跳过');
assert.equal(step.stats.drawn + step.stats.vertical, step.positions.length / 6, '段数 = 贴面边 + 竖线');
assert.equal(step.stats.rim, boxed.stats.rim, '跨层不算外缘：外缘黑方块只出现在被裁断那一圈，台面中间的落差处没有');

const stepPair = drapeLattice(lat, cliff, { breakMode: 'pair' });
assert.equal(stepPair.stats.vertical, 8, 'pair 档：4 条跨层边 → 8 根竖线（第 71 轮旧观感）');
assert.equal(stepPair.stats.skipped, 0);
const stepSingle = drapeLattice(lat, cliff, { breakMode: 'single' });
assert.equal(stepSingle.stats.vertical, 4, 'single 档：每条跨层边一根');
assert.throws(() => drapeLattice(lat, cliff, { breakMode: 'zigzag' }), RangeError, '未知跨层档直接拒');

// ⑦ 外缘顶点分类：frame-0072 / 0470 / 0076 外缘是黑空心方块，内部交点才是白亮点
assert.equal(boxed.stats.rim, 8, '贴着被裁掉那一列的交点算外缘（x=2 与 x=6 各 4 个）');
assert.equal(boxed.stats.inner, 4, '内部交点 4 个');
assert.equal(boxed.stats.rim + boxed.stats.inner, boxed.stats.corners, '外缘 + 内部 = 全部交点');
assert.equal(boxed.rimPositions.length / 3, boxed.stats.rim, 'rimPositions 与统计一致');

// ④ 全无地面 → 一段都不画（不能崩、不能回落到平板）
const empty = drapeLattice(lat, () => null);
assert.equal(empty.positions.length, 0, '没有地面就一段都不画');
assert.equal(empty.stats.dropped, 20);
assert.equal(empty.stats.kept, 0);
assert.equal(empty.stats.minY, 0);

// ⑤ 全平面 → 退化成原来那张平板（观感不变，只是仍按轮廓裁）
const flatAll = drapeLattice(lat, () => 0.02);
assert.equal(flatAll.stats.vertical, 0, '全平面没有竖线');
assert.equal(flatAll.stats.stepped, 0, '全平面没有带高差的边');
assert.equal(flatAll.stats.drawn, lat.stats.edges, '全平地全画（等价旧观感）');
assert.equal(flatAll.stats.yFlat, 0);

// ⑥ 参数校验
assert.throws(() => drapeLattice({}, () => 0), RangeError, '没有 vertices/edges 直接拒');
assert.throws(() => drapeLattice(lat, null), TypeError, 'sample 不是函数直接拒');

console.log('quad-lattice-drape PASS  dropped=' + boxed.stats.dropped + ' drawn=' + boxed.stats.drawn +
  ' cliffVertical=' + step.stats.vertical + ' yFlat=' + boxed.stats.yFlat);
