/**
 * squad-footprint-cells.mjs — 883447205176238083 的口径：线网沿**格边界**走，凹口保留。
 * 纯逻辑：格并集边界 → 环、面积/周长、耳切三角面、角标/辐条、环形（洞）与非法输入。
 */
import assert from 'node:assert/strict';
import { cellOutline, earClip, ringArea, footprintCells } from '../src/badnorth/squad-footprint.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const grid = (w, h) => { const out = []; for (let x = 0; x < w; x++) for (let z = 0; z < h; z++) out.push([x, z]); return out; };

// 1. 3×4 整块：边界是一个矩形 → 4 个角、面积 12、周长 14
const block = grid(3, 4);
const [br] = cellOutline(block);
assert.equal(br.length, 4, '矩形环应只有 4 个角 ' + JSON.stringify(br));
assert.ok(near(ringArea(br), 12), '面积 ' + ringArea(br));
const bfp = footprintCells(block, block);
assert.equal(bfp.ring.length, 4);
assert.ok(near(bfp.area, 12) && near(bfp.perimeter, 14), `面积/周长 ${bfp.area}/${bfp.perimeter}`);
assert.ok(near(bfp.notchArea, 0), '整块没有凹口');
assert.equal(bfp.tris.length, 4, '辐条把矩形切 4 个扇形');
assert.equal(bfp.fillTris.length, 2, '矩形耳切 = 2 个三角');
assert.ok(near(bfp.triArea, bfp.area), '三角面铺满轮廓');

// 2. L 形（3 格）：边界 6 个角，凹口保留 → 面积 3，凸包 3.5，凹口 0.5
const L = [[0, 0], [1, 0], [0, 1]];
const [lr] = cellOutline(L);
assert.equal(lr.length, 6, 'L 形边界 6 个角 ' + JSON.stringify(lr));
const lfp = footprintCells([[0, 0], [1, 0], [0, 1]], L);
assert.ok(near(lfp.area, 3), 'L 形面积 ' + lfp.area);
assert.ok(near(lfp.hullArea, 3.5), '凸包面积 ' + lfp.hullArea);
assert.ok(near(lfp.notchArea, 0.5), '凹口面积 ' + lfp.notchArea);
assert.equal(lfp.spokes.length, 6);
assert.equal(lfp.ticks.length, 6);
assert.equal(lfp.tris.length, 6, 'L 形 6 条辐条 = 6 个扇形');
assert.equal(lfp.fillTris.length, 4, 'L 形耳切 4 个三角');
assert.ok(near(lfp.triArea, 3), '凹形三角面也只铺在轮廓内 ' + lfp.triArea);
for (const [a, b, c] of lfp.fillTris) {
  const s = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  assert.ok(s > 0, '三角面必须正向 ' + s);
}

// 3. U 形（3×2 挖掉中间一格）：面积 5，凹口 1，周长 12
const U = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]];
const ufp = footprintCells([[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], U);
assert.ok(near(ufp.area, 5), 'U 形面积 ' + ufp.area);
assert.ok(near(ufp.notchArea, 1), 'U 形凹口 ' + ufp.notchArea);
assert.ok(near(ufp.perimeter, 12), 'U 形周长 ' + ufp.perimeter);
assert.equal(ufp.ring.length, 8);
assert.ok(near(ufp.triArea, 5), 'U 形三角面 ' + ufp.triArea);

// 4. 重复格 / 非整数格坐标：去重后与整块等价
const dup = footprintCells(block, [...block, [0, 0], [1, 1]]);
assert.ok(near(dup.area, 12) && dup.ring.length === 4);
const frac = footprintCells(block, [[0.2, -0.1], [1, 0], [2, 3]]);
assert.equal(frac.cellCount, 3);

// 5. 环形（3×3 挖中间）：两个环、面积 8、洞 1
const donut = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const loops = cellOutline(donut);
assert.equal(loops.length, 2, '外环 + 内环 ' + loops.length);
const dfp = footprintCells(donut, donut);
assert.ok(near(dfp.area, 8), '环形面积 ' + dfp.area);
assert.equal(dfp.holes.length, 1);

// 5b. 不相邻的占位（隔一格 / 斜角相接）：多个环各自算面积，不互相扣
const twoIsland = footprintCells([[0, 0], [3, 0]], [[0, 0], [3, 0]]);
assert.equal(twoIsland.rings.length, 2);
assert.equal(twoIsland.islands.length, 1);
assert.ok(near(twoIsland.area, 2), '两块分开的占位面积 ' + twoIsland.area);
const diag = footprintCells([[0, 0], [1, 1]], [[0, 0], [1, 1]]);
assert.equal(diag.rings.length, 2, '斜角相接 = 两个环');
assert.ok(near(diag.area, 2), '斜角面积 ' + diag.area);

// 6. 单格：4 个角、面积 1
const one = footprintCells([[0, 0]], [[0, 0]]);
assert.equal(one.ring.length, 4);
assert.ok(near(one.area, 1) && near(one.perimeter, 4));
assert.equal(one.tris.length, 4);
assert.equal(one.fillTris.length, 2);

// 7. 耳切对自交/退化不抛
assert.deepEqual(earClip([[0, 0], [1, 0]]), []);
assert.equal(earClip([[0, 0], [1, 0], [1, 1]]).length, 1);

// 8. 非法输入
assert.throws(() => cellOutline([[NaN, 0]]), RangeError);
assert.throws(() => cellOutline(['a']), RangeError);
assert.throws(() => footprintCells([], [[0, 0]]), RangeError);
assert.throws(() => footprintCells([[0, 0]], []), RangeError);

console.log('PASS squad-footprint-cells：格边界环（矩形/L/U/环）、凹口保留、耳切铺满、角标辐条、去重与非法输入');
