// 第 94 轮 · 1120036868966502401 缺口 ③：窗口补丁的纯逻辑验收（不 import three）。
// 口径：原片白格网是一块**有界矩形补丁**（边界硬切），补丁外一格都不画 → 裁剪必须
//   ① 两个端点都在窗口内才留（没有半截悬在补丁外的线）；
//   ② 点（交点亮斑）同理；
//   ③ 三角层 = 分组区域 ∩ 窗口，不相交就整组不出；
//   ④ 传 null 一律还原（不能悄悄少画）。
import assert from 'node:assert/strict';
import { clipSegmentsToRect, clipPointsToRect, intersectRect, windowForBounds, windowEdgeSegments, buildRegularLattice, boundsForCells, mergeBounds, selectionBounds } from '../src/core/quad-lattice.js';

const out = [];
const t = (name, fn) => { fn(); out.push(name); };

t('① 线段：两端都在窗口内才留', () => {
  const seg = [
    0, 0, 0, 1, 0, 0,      // 全在（0..1 ⊂ 0..2）
    -1, 0, 0, 1, 0, 0,     // 起点在外 → 丢
    1, 0, 1, 3, 0, 1,      // 终点在外 → 丢
    1, 0, 2, 2, 0, 2,      // 边界上，全在（闭区间）
  ];
  const r = clipSegmentsToRect(seg, { minX: 0, maxX: 2, minZ: 0, maxZ: 2 });
  assert.equal(r.total, 4);
  assert.equal(r.kept, 2);
  assert.equal(r.positions.length, 12);
  assert.deepEqual(r.positions, [0, 0, 0, 1, 0, 0, 1, 0, 2, 2, 0, 2]);
});

t('② 点：只留窗口内的', () => {
  const pts = [0, 1, 0, 5, 1, 0, 1, 1, 1, -0.01, 1, 1];
  const r = clipPointsToRect(pts, { minX: 0, maxX: 2, minZ: 0, maxZ: 2 });
  assert.equal(r.total, 4);
  assert.equal(r.kept, 2);
  assert.deepEqual(r.positions, [0, 1, 0, 1, 1, 1]);
});

t('③ 窗口为 null：原样返回（不许悄悄少画）', () => {
  const seg = [0, 0, 0, 1, 0, 0, 9, 0, 9, 10, 0, 10];
  const rs = clipSegmentsToRect(seg, null);
  assert.equal(rs.kept, 2); assert.deepEqual(rs.positions, seg);
  const rp = clipPointsToRect([1, 2, 3], null);
  assert.deepEqual(rp.positions, [1, 2, 3]);
  assert.equal(rp.kept, 1);
  // 返回的是副本，改它不该动原数组
  rs.positions[0] = 777; assert.equal(seg[0], 0);
});

t('④ 矩形交：分组区域 ∩ 窗口', () => {
  const a = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const b = { minX: 0, maxX: 4, minZ: -4, maxZ: 0 };
  assert.deepEqual(intersectRect(a, b), { minX: 0, maxX: 2, minZ: -2, maxZ: 0 });
  assert.equal(intersectRect(a, { minX: 5, maxX: 6, minZ: 5, maxZ: 6 }), null, '不相交要 null');
  assert.deepEqual(intersectRect(null, b), b, '一边为 null = 另一边');
  assert.deepEqual(intersectRect(a, null), a);
  assert.equal(intersectRect(null, null), null);
});

t('⑤ 窗口空 → 一条都不留（不是回退成铺满）', () => {
  const seg = [0, 0, 0, 1, 0, 0];
  const r = clipSegmentsToRect(seg, { minX: 5, maxX: 6, minZ: 5, maxZ: 6 });
  assert.equal(r.kept, 0);
  assert.equal(r.total, 1);
  assert.equal(r.positions.length, 0);
});


t('⑥ 自动窗口：对齐格点 + 每边留 1 格（原片补丁比对象多一圈）', () => {
  // 格距 1、原点 0；对象包围盒 x[-0.4,1.4] z[2.2,3.1] → 外扩 1 格再向外取整到格点
  const r = windowForBounds({ minX: -0.4, maxX: 1.4, minZ: 2.2, maxZ: 3.1 }, { step: 1, origin: { x: 0, z: 0 }, pad: 1 });
  assert.deepEqual([r.minX, r.maxX, r.minZ, r.maxZ], [-2, 3, 1, 5]);
  assert.equal(r.cols, 5); assert.equal(r.rows, 4);
  // 每个边界都必须落在格点上（origin + k*step）—— 否则补丁边界会切在两条格线之间
  for (const v of [r.minX, r.maxX, r.minZ, r.maxZ]) assert.equal(Math.abs(v - Math.round(v)), 0);
});

t('⑦ 自动窗口：非零原点也要对齐（对齐的是格子，不是世界 0）', () => {
  const r = windowForBounds({ minX: 10.2, maxX: 11.1, minZ: 10.3, maxZ: 10.9 }, { step: 0.5, origin: { x: 10.05, z: 10.05 }, pad: 1 });
  const g = (v) => +(((v - 10.05) / 0.5) % 1).toFixed(6);
  for (const v of [r.minX, r.maxX, r.minZ, r.maxZ]) assert.ok(Math.abs(g(v)) < 1e-6 || Math.abs(Math.abs(g(v)) - 1) < 1e-6, `${v} 不在格点上`);
  assert.ok(r.minX <= 10.2 && r.maxX >= 11.1, '窗口必须包住对象');
});

t('⑧ 自动窗口：超大对象被收到 maxCells 格（原片补丁恒 7–8 格）', () => {
  const r = windowForBounds({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, { step: 1, origin: { x: 0, z: 0 }, pad: 1, maxCells: 8 });
  assert.equal(r.cols, 8); assert.equal(r.rows, 8);
  assert.ok(r.minX <= 0 && r.maxX >= 0 && r.minZ <= 0 && r.maxZ >= 0, '收缩要以包围盒中心为心');
});

t('⑨ 边缘线段：4 条闭合边 + 逐点取地面高', () => {
  const rect = { minX: 0, maxX: 2, minZ: 0, maxZ: 1 };
  const e = windowEdgeSegments(rect, 0.5);
  assert.equal(e.length, 24, '4 条边 × 2 端点 × 3 分量');
  assert.equal(e.length / 6, 4);
  // 首尾相接成环：第 i 条边的终点 == 第 i+1 条边的起点
  for (let i = 0; i < 4; i++) {
    const o = i * 6, n = ((i + 1) % 4) * 6;
    assert.equal(e[o + 3], e[n], 'x 接头'); assert.equal(e[o + 5], e[n + 2], 'z 接头');
  }
  assert.equal(e[1], 0.5);
  // 贴面档：逐点抽高（拿不到地面的点退回统一 y）
  const sample = (x, z) => (x === 2 ? 3 : null);
  const e2 = windowEdgeSegments(rect, 0.5, sample);
  assert.ok(e2.includes(3), '角落按采样高度抬起');
  const fallback = windowEdgeSegments(rect, 0.5, () => null);
  assert.deepEqual(fallback, e, '采样全落空 = 退回统一高度');
});

t('⑩ buildRegularLattice 暴露 origin/size（自动窗口靠它对齐）', () => {
  const l = buildRegularLattice({ cols: 3, rows: 2, size: 0.25, origin: { x: -1, z: 2 }, y: 0 });
  assert.deepEqual(l.stats.origin, { x: -1, z: 2 });
  assert.equal(l.stats.size, 0.25);
});

t('⑪ 选中格 → 包围盒：优先用格子多边形外轮廓', () => {
  const sq = (cx, cz, h) => ({ cx, cz, pts: [{ x: cx - h, z: cz - h }, { x: cx + h, z: cz - h }, { x: cx + h, z: cz + h }, { x: cx - h, z: cz + h }] });
  const b = boundsForCells([sq(0, 0, 1), sq(2, 1, 1)]);
  assert.deepEqual(b, { minX: -1, maxX: 3, minZ: -1, maxZ: 2 });
  // 只有 cx/cz 的格子退回 ±half（默认 half=0 就退化成点）
  assert.deepEqual(boundsForCells([{ cx: 2, cz: -3 }]), { minX: 2, maxX: 2, minZ: -3, maxZ: -3 });
  assert.deepEqual(boundsForCells([{ cx: 2, cz: -3 }], { half: 0.75 }), { minX: 1.25, maxX: 2.75, minZ: -3.75, maxZ: -2.25 });
  // 空选中 = 没有对象，不许返回全 0 的假盒子
  assert.equal(boundsForCells([]), null);
  assert.equal(boundsForCells(null), null);
  assert.equal(boundsForCells([null, {}]), null);
});

t('⑫ 包围盒求并（多选对象）', () => {
  const a = { minX: -2, maxX: -1, minZ: 0, maxZ: 1 };
  const b = { minX: 1, maxX: 3, minZ: -4, maxZ: -2 };
  assert.deepEqual(mergeBounds([a, b]), { minX: -2, maxX: 3, minZ: -4, maxZ: 1 });
  assert.deepEqual(mergeBounds([a]), a);
  assert.equal(mergeBounds([]), null);
  assert.equal(mergeBounds(null), null);
  // 坏盒子（NaN/缺字段）被丢掉，不能把整次合并污染成 NaN
  assert.deepEqual(mergeBounds([a, { minX: NaN, maxX: 1, minZ: 0, maxZ: 0 }, null]), a);
});

t('⑬ 选中态 → 包围盒：三种写法可混用，null/空选中一律清', () => {
  const sq = (cx, cz, h) => ({ cx, cz, pts: [{ x: cx - h, z: cz - h }, { x: cx + h, z: cz - h }, { x: cx + h, z: cz + h }, { x: cx - h, z: cz + h }] });
  // ① 直接给包围盒
  assert.deepEqual(selectionBounds({ bounds: { minX: 1, maxX: 2, minZ: 3, maxZ: 4 } }), { minX: 1, maxX: 2, minZ: 3, maxZ: 4 });
  // ② 给格子
  assert.deepEqual(selectionBounds({ cells: [sq(0, 0, 0.5)] }), { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 });
  // ③ 给对象列表（bounds 与 cells 混着）
  const sel = { objects: [{ bounds: { minX: 5, maxX: 6, minZ: 0, maxZ: 1 } }, { cells: [sq(-2, -2, 0.5)] }] };
  assert.deepEqual(selectionBounds(sel), { minX: -2.5, maxX: 6, minZ: -2.5, maxZ: 1 });
  // 三种混用 = 并集
  assert.deepEqual(selectionBounds({ bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, cells: [sq(3, 3, 0.5)] }),
    { minX: 0, maxX: 3.5, minZ: 0, maxZ: 3.5 });
  // 没有选中 → null（窗口该清掉，不能退回「铺满」以外的东西）
  assert.equal(selectionBounds(null), null);
  assert.equal(selectionBounds({}), null);
  assert.equal(selectionBounds({ cells: [] }), null);
  // 坏输入要显式报错，别静默算出错窗口
  assert.throws(() => selectionBounds({ bounds: { minX: NaN, maxX: 1, minZ: 0, maxZ: 0 } }), RangeError);
  assert.throws(() => selectionBounds({ objects: 'nope' }), TypeError);
  // 选中态的包围盒交给 windowForBounds，必须仍然对齐格点（这是 r96 的口径）
  const r = windowForBounds(selectionBounds({ cells: [sq(0.3, -1.2, 0.5)] }), { step: 1, origin: { x: 0, z: 0 }, pad: 1 });
  for (const v of [r.minX, r.maxX, r.minZ, r.maxZ]) assert.equal(Math.abs(v - Math.round(v)), 0);
  assert.ok(r.minX <= -0.2 && r.maxX >= 0.8 && r.minZ <= -1.7 && r.maxZ >= -0.7, '窗口包住选中格子');
});

console.log('grid-window ALL PASS × ' + out.length + '\n' + out.join('\n'));