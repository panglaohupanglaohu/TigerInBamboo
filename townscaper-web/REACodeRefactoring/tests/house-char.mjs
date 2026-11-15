// 第 93 轮 · 屋体炭黑（837027901853810688）纯逻辑验收：src/badnorth/house-char.js
// 判据全部来自帧量测：一帧跳变、只压屋格内且高于地面的顶点、颜色近黑带斑驳、可逆。
import assert from 'node:assert/strict';
import { CHAR, expandOutline, inOutline, charShade, charHouseVerts, restoreChar } from '../src/badnorth/house-char.js';

// node 端没有 three（本仓 only browser），用最小 BufferAttribute 替身；matrixWorld 用单位矩阵
const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
class Attr {
  constructor(arr, size) { this.array = Float32Array.from(arr); this.itemSize = size; this.count = arr.length / size; this.needsUpdate = false; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setXYZ(i, x, y, z) { this.array[i * this.itemSize] = x; this.array[i * this.itemSize + 1] = y; this.array[i * this.itemSize + 2] = z; }
}

// 3×3 的小地形网格：每格 1 单位，顶面 y=1，外加 4 个「地面」顶点 y=0
const cellPts = [{ x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }, { x: 0.5, z: 0.5 }, { x: -0.5, z: 0.5 }];
const cell = { cx: 0, cz: 0, top: 1, pts: cellPts };

// ── 轮廓外扩：1.3 倍（含屋檐），元素是 {x,z} 不是数组
const ex = expandOutline(cell);
assert.equal(ex.length, 4);
assert.equal(Math.abs(ex[1].x - 0.65) < 1e-12, true, '外扩后 x=0.65');
assert.equal(inOutline(ex, 0, 0), true, '中心在内');
assert.equal(inOutline(ex, 0.7, 0), false, 'x=0.7 在 0.65 之外');
assert.equal(inOutline(ex, 0.6, 0.6), true, '角内');

// ── 明暗系数：确定性、均值 1
const s = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => charShade(i));
assert.equal(charShade(3), charShade(3), '同下标同值');
assert.ok(Math.min(...s) > 0.6 && Math.max(...s) < 1.4, '斑驳幅度约 ±0.375');

// ── 合成网格：屋格内顶面 4 个顶点(y=1) + 屋格外顶面 4 个(y=1) + 屋格内地面 4 个(y=0)
const pos = [], col = [], push = (x, y, z, c) => { pos.push(x, y, z); col.push(c, c, c); };
for (let i = 0; i < 4; i++) push(cellPts[i].x, 1, cellPts[i].z, 0.8);       // 0–3 屋格顶面
for (let i = 0; i < 4; i++) push(3 + cellPts[i].x, 1, 3 + cellPts[i].z, 0.8); // 4–7 远处的顶面
for (let i = 0; i < 4; i++) push(cellPts[i].x, 0, cellPts[i].z, 0.8);       // 8–11 屋格地面
const geometry = { attributes: {} };
geometry.attributes.position = new Attr(pos, 3);
geometry.attributes.color = new Attr(col, 3);
const mesh = { matrixWorld: { elements: ident } };
mesh.updateMatrixWorld = () => {};

const c = geometry.attributes.color, p = geometry.attributes.position;
const r = charHouseVerts({ color: c, position: p, matrix: mesh.matrixWorld.elements, cell, baseY: 0 });

// ── 只有屋格内 + 高于地面(y≥0.02) 的 4 个顶点被压黑；地面 4 个与远处 4 个不动
assert.equal(r.count, 4, '炭化顶点数 ' + r.count);
assert.deepEqual(r.idx, [0, 1, 2, 3]);
assert.equal(r.rgb.length, 12);
for (const i of [4, 5, 6, 7, 8, 9, 10, 11]) assert.equal(+c.getX(i).toFixed(4), 0.8, `顶点 ${i} 不该动`);

// ── 颜色：近黑（三通道都 < 0.08），且保留斑驳（不是纯常量）
const dark = [0, 1, 2, 3].map((i) => [c.getX(i), c.getY(i), c.getZ(i)]);
// 斑驳上限 = base·(1+0.375)：B 0.070 → 0.096，所以上界按 0.11 判（别写成 0.08 又把好实现判红）
for (const [rr, gg, bb] of dark) { assert.ok(rr < 0.09 && gg < 0.09 && bb < 0.11, '近黑'); assert.ok(rr > gg, 'R 高于 G'); assert.ok(bb > gg, 'B 也高于 G（原片近黑区 B 最高 = 冷紫黑）'); }
assert.ok(new Set(dark.map(([v]) => v.toFixed(4))).size > 1, '斑驳：顶点之间有差异');

// ── 还原：回到 0.8，且只动记录过的下标
const n = restoreChar(c, r);
assert.equal(n, 4);
for (const i of [0, 1, 2, 3]) assert.equal(+c.getX(i).toFixed(4), 0.8, `顶点 ${i} 还原`);

// ── 边界：空属性 / 空 cell 不炸，返回 0
assert.equal(charHouseVerts({ color: null, position: p, matrix: mesh.matrixWorld.elements, cell, baseY: 0 }).count, 0);
assert.equal(charHouseVerts({ color: c, position: p, matrix: mesh.matrixWorld.elements, cell: { cx: 99, cz: 99, pts: cellPts }, baseY: 0 }).count, 0, '远离的屋格不命中任何顶点');
assert.equal(restoreChar(c, null), 0);

// ── 颜色钉死：数值来自 837 片屏幕中位色 [46,29,51] 的逐通道折算，别顺手改成「更暖的黑」
assert.equal(CHAR.r, 0.044); assert.equal(CHAR.g, 0.021); assert.equal(CHAR.b, 0.07);
assert.equal(CHAR.grow, 1.3, '屋檐外扩 1.3 是原实现口径');
console.log('house-char: ALL PASS', JSON.stringify({ charred: r.count, r: CHAR.r, g: CHAR.g, b: CHAR.b, grow: CHAR.grow }));

// C01/C03 can char the same vertices, then turn off in either order.
for(const reverse of [false,true]){
 const A={},B={},args={color:c,position:p,matrix:mesh.matrixWorld.elements,cell,baseY:0},baseline=Array.from(c.array),a=charHouseVerts({...args,owner:A}),b=charHouseVerts({...args,owner:B});
 const first=reverse?B:A,second=reverse?A:B;restoreChar(c,reverse?b:a,first);assert.ok(c.getX(a.idx[0])<.25,'other owner retains char');restoreChar(c,reverse?a:b,second);assert.deepEqual(Array.from(c.array),baseline,'last owner restores exact original RGB');
}
console.log('PASS overlapping C01/C03 char owners, both release orders, exact original restoration');
