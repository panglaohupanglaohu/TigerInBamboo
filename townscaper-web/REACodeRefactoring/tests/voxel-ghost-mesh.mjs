// 第 61 轮新增：任意三角网格体素化（含空腔）/ 逐层材质分组 / 中轴竖柱装配序
// 对应 794993371261665280（Go! + 逐层材质 + 任意体素化）与 797844857821732864（中轴竖柱 + dolly）
import assert from 'node:assert/strict';
import {
  rasterizeBoxes, rasterizeMesh, voxelOrder, spineColumn, layerMaterials,
  LAYER_PALETTE, previewState, phaseCounts,
} from '../src/world/voxel-ghost.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

/** 闭合立方体（水密，12 三角）—— 奇偶法不看绕序，只要壳闭 */
function cube(x0, y0, z0, s) {
  const x1 = x0 + s, y1 = y0 + s, z1 = z0 + s;
  const P = (x, y, z) => [x, y, z];
  const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
  return [
    ...quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)), // z0
    ...quad(P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1)), // z1
    ...quad(P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)), // x0
    ...quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)), // x1
    ...quad(P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0)), // y0
    ...quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)), // y1
  ];
}

// ---------- 1. 实心立方：2³ 格 ----------
const solid = rasterizeMesh(cube(0, 0, 0, 2), { cell: 1 });
ok(solid.size === 8, `2×2×2 实心立方 = 8 格，实得 ${solid.size}`);
ok(solid.has('0,0,0') && solid.has('1,1,1'), '对角两格都在');
ok([...solid.values()].every((v) => Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z)), '格坐标都是整数');

// ---------- 2. 空心立方：中间两格是空的（空腔保留） ----------
const hollow = rasterizeMesh([...cube(0, 0, 0, 4), ...cube(1, 1, 1, 2)], { cell: 1 });
ok(hollow.size === 64 - 8, `4³ 外壳 + 2³ 空腔 = 56 格，实得 ${hollow.size}`);
ok(!hollow.has('1,1,1') && !hollow.has('2,2,2'), '空腔中心的格不在占位表里');
ok(hollow.has('0,0,0') && hollow.has('3,3,3'), '外壳角点还在');

// ---------- 3. 与 rasterizeBoxes 口径一致（盒子 = 轴对齐水密网格的特例） ----------
const fromBox = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 3, h: 2, d: 4 }]);
const fromMesh = rasterizeMesh(cube(0, 0, 0, 1).map((t) => t) /* 占位，下面用缩放的盒子网格 */);
void fromMesh;
const boxMesh = (() => {
  const tris = [];
  const [x0, y0, z0, x1, y1, z1] = [0, 0, 0, 3, 2, 4];
  const P = (x, y, z) => [x, y, z];
  const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
  tris.push(...quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)));
  tris.push(...quad(P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1)));
  tris.push(...quad(P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)));
  tris.push(...quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)));
  tris.push(...quad(P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0)));
  tris.push(...quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)));
  return tris;
})();
const mesh3 = rasterizeMesh(boxMesh, { cell: 1 });
ok(mesh3.size === fromBox.size, `3×2×4 盒：盒式 ${fromBox.size} 格 vs 网格式 ${mesh3.size} 格，应相等`);

assert.throws(() => rasterizeMesh([]), RangeError); checks++;
assert.throws(() => rasterizeMesh([[0, 0, 0]]), RangeError); checks++;
assert.throws(() => rasterizeMesh(cube(0, 0, 0, 2), { cell: 0 }), RangeError); checks++;
assert.throws(() => rasterizeMesh(cube(0, 0, 0, 2), { cell: 0.01, maxCells: 100 }), RangeError); checks++;

// ---------- 4. 逐层材质分组 ----------
const tower = rasterizeBoxes([
  { x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
  { x: 1, y: 1, z: 1, w: 4, h: 9, d: 4, hollow: true },
  { x: 0, y: 10, z: 0, w: 6, h: 1, d: 6 },
]);
const lm = layerMaterials(tower, { bandHeight: 3 });
ok(lm.bands === Math.ceil(11 / 3), `11 层按 3 层一段 = 4 段，实得 ${lm.bands}`);
ok(lm.counts.reduce((a, b) => a + b, 0) === tower.size, `各色槽计数之和 = 总格数（${tower.size}）`);
ok(lm.of.size === tower.size, '每格都有色槽号');
ok([...lm.of.values()].every((i) => i >= 0 && i < LAYER_PALETTE.length), '色槽号落在色板范围内');
ok(typeof lm.colorOf([...tower.values()][0]) === 'string' && lm.colorOf([...tower.values()][0]).startsWith('#'), 'colorOf 返回十六进制色');
// 同一段内的格必须同色
const yOf = (k) => +k.split(',')[1];
const groups = new Map();
for (const [k, idx] of lm.of) {
  const band = Math.floor((yOf(k) - 0) / 3);
  if (!groups.has(band)) groups.set(band, idx);
  ok(groups.get(band) === idx, `第 ${band} 段的色槽一致（y=${yOf(k)}）`);
}
assert.throws(() => layerMaterials([]), RangeError); checks++;
assert.throws(() => layerMaterials(tower, { bandHeight: 0 }), RangeError); checks++;

// ---------- 5. 中轴竖柱 ----------
const sp = spineColumn(tower);
ok(sp.cells.length > 0, `中轴柱有格（${sp.cells.length}）`);
let mono = true;
for (let i = 1; i < sp.cells.length; i++) if (sp.cells[i].y < sp.cells[i - 1].y) mono = false;
ok(mono, '中轴柱按 y 升序');
ok(sp.cells[0].y <= 1 && sp.cells[sp.cells.length - 1].y >= 9, `中轴柱从底板长到顶（y ${sp.cells[0].y} → ${sp.cells[sp.cells.length - 1].y}）`);
const monox = new Set(sp.cells.map((v) => v.x)), monoz = new Set(sp.cells.map((v) => v.z));
ok(monox.size <= 3 && monoz.size <= 3, `中轴柱是竖柱不是整片（x 跨度 ${monox.size} / z 跨度 ${monoz.size}）`);

// ---------- 6. spine 装配序：先竖柱（自下而上）后横铺 ----------
const spineOrder = voxelOrder(tower, { mode: 'spine' });
ok(spineOrder.length === tower.size, `spine 序长度 = 占位数（${spineOrder.length}）`);
const spineIds = new Set(sp.cells.map((v) => `${v.x},${v.y},${v.z}`));
const head = spineOrder.slice(0, sp.cells.length);
ok(head.every((v) => spineIds.has(`${v.x},${v.y},${v.z}`)), '前 N 个正好是中轴柱的格');
let headMono = true;
for (let i = 1; i < head.length; i++) if (head[i].y < head[i - 1].y) headMono = false;
ok(headMono, '竖柱段自下而上');
ok(!spineIds.has(`${spineOrder[spineOrder.length - 1].x},${spineOrder[spineOrder.length - 1].y},${spineOrder[spineOrder.length - 1].z}`), '末格不再是竖柱（已切到横铺段）');
// spine 序仍是完整排列（每格恰好一次）
ok(new Set(spineOrder.map((v) => `${v.x},${v.y},${v.z}`)).size === tower.size, 'spine 序无重复无遗漏');

// ---------- 7. 三态时间线对 spine 序照样成立 ----------
const st = previewState(spineOrder, 0.55);
const c = phaseCounts(st);
ok(c.solid + c.ghost + c.points + c.hidden === tower.size, '三态 + 未出现 = 总格数');
ok(c.solid === Math.floor(tower.size * 0.375) + 1, `t=0.55 时实体数是装配序前缀（${c.solid}）`);

// ---------- 8. 旧模式未受影响 ----------
for (const mode of ['scan', 'radial', 'shuffle']) {
  const o = voxelOrder(tower, { mode });
  ok(o.length === tower.size, `${mode} 序长度不变`);
}
assert.throws(() => voxelOrder(tower, { mode: 'nope' }), RangeError); checks++;

console.log(`voxel-ghost-mesh: ${checks} checks PASS`);
