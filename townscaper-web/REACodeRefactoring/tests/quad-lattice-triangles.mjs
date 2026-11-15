// 第 80 轮 · 1120036868966502401 缺口 ②：黄色三角化轮廓（四边格按对角线切出一个三角）。
// 原片依据（460×460 原尺寸 + 5–6× 最近邻裁切）：
//   · frame-0301 —— 浅色地面上散着 6 个黄色三角，直角边沿格线、斜边是格对角线；相邻格没有描边 → 局部调试层；
//   · frame-0105 / frame-0520 同批黄三角，对角线方向逐格交替（"\" / "/" 混着来）。
// 这里锁五条纯逻辑判据：
//   ① 只画 region 里的格子；② 每格只出一条三角（3 条边）；③ auto 档对角线方向按 (col+row) 奇偶交替；
//   ④ 顶点高度用 drapeLattice 的 heights → 黄三角贴地；⑤ 出界/没地面的格子跳过。
import assert from 'node:assert/strict';
import { buildRegularLattice, drapeLattice, latticeTriangles } from '../src/core/quad-lattice.js';

// 5×4 格、格距 2，x∈[0,10]、z∈[0,8]，交点 6×5=30
const lat = buildRegularLattice({ cols: 5, rows: 4, size: 2, origin: { x: 0, z: 0 } });
assert.equal(lat.vertices.length, 30, '交点 6×5');

// ① 只画 region 里的格子：取中间 2×2 格（x∈[2,6]、z∈[2,6] 的格心范围）
const region = { minX: 2, maxX: 6, minZ: 2, maxZ: 6 };
const got = latticeTriangles(lat, { region });
assert.equal(got.stats.quads, 4, '2×2 = 4 格，实得 ' + got.stats.quads);
assert.equal(got.stats.triangles, 4);
// ② 每格 3 条边、6 个端点 → 24 个三元组
assert.equal(got.stats.edges, 12, '4 格 × 3 边');
assert.equal(got.positions.length, 4 * 3 * 2 * 3, '12 段 × 2 端点 × 3 分量');
// ③ 奇偶交替：(c,r) 从 (1,1) 起 → a,b / b,a 各两条
assert.equal(got.stats.splits.a + got.stats.splits.b, 4, '两个方向合计等于格数');
assert.equal(got.stats.splits.a, 2, 'auto 档不是全同一方向（a=' + got.stats.splits.a + '）');
assert.equal(got.stats.splits.b, 2, 'auto 档不是全同一方向（b=' + got.stats.splits.b + '）');
// 平铺档 y 取格网自身的 y
assert.equal(got.stats.yMin, 0);
assert.equal(got.stats.yMax, 0);

// 写死方向的两档：a 用对角线 v00–v11（三角 v00,v10,v11），b 用 v10–v01（三角 v00,v10,v01）
const onlyA = latticeTriangles(lat, { region, split: 'a' });
assert.equal(onlyA.stats.splits.a, 4);
assert.equal(onlyA.stats.splits.b, 0);
const onlyB = latticeTriangles(lat, { region, split: 'b' });
assert.equal(onlyB.stats.splits.b, 4);
// 两种方向画出来的三角确实不同：把端点集合排序后比较
const sig = (r) => {
  const xs = [];
  for (let i = 0; i < r.positions.length; i += 3) xs.push(r.positions[i].toFixed(3) + ',' + r.positions[i + 2].toFixed(3));
  return [...new Set(xs)].sort().join('|');
};
assert.notEqual(sig(onlyA), sig(onlyB), 'a / b 两档的三角顶点集合必须不同');

// ④ 贴地：接一张有起伏的地面，黄三角顶点跟着地表高走（不是钉在 y=0）
const ground = (x, z) => (x >= 0 && x <= 10 && z >= 0 && z <= 8 ? 1 + 0.25 * x + 0.1 * z : null);
const draped = drapeLattice(lat, ground);
const gone = latticeTriangles(lat, { region, heights: draped.heights });
assert.ok(gone.stats.yMin > 1, '顶点高度取贴面档 heights，最低 ' + gone.stats.yMin);
// 每个画出来的顶点，y 必须正好等于它脚下的地表高（黄三角贴地，不是钉在某个常数高度上）。
// 注意：一个格子只画 3 个角，第 4 个角（对角线另一侧的尖点）不出现，所以 yMax 不会等于整块 region 的最高角。
for (let i = 0; i < gone.positions.length; i += 3) {
  const x = gone.positions[i], y = gone.positions[i + 1], z = gone.positions[i + 2];
  assert.ok(Math.abs(y - ground(x, z)) < 1e-9, `顶点 (${x},${z}) 的 y=${y} 应等于地表高 ${ground(x, z)}`);
}
assert.ok(gone.stats.yMin >= 1 + 0.25 * 2 + 0.1 * 2 - 1e-9, '最低顶点不低于 region 左下角的地表高');

// ⑤ 出界跳过：只在 x∈[0,4] 有地面 → 右侧两列格被跳过
const halfGround = (x, z) => (x <= 4 ? 1 : null);
const half = drapeLattice(lat, halfGround);
const cut = latticeTriangles(lat, { region, heights: half.heights });
assert.ok(cut.stats.skipped > 0, '没地面的格子要跳过（skipped=' + cut.stats.skipped + '）');
assert.ok(cut.stats.triangles < 4, '被裁掉的格子不再出三角，实得 ' + cut.stats.triangles);

// 边界：region 必填在 view 层拦；这里锁「拿不到 cols/rows 就报错」
assert.throws(() => latticeTriangles({ vertices: [], edges: [] }, { region }), RangeError, '缺 stats.cols/rows 要报错');
assert.throws(() => latticeTriangles(lat, { region, split: 'x' }), RangeError, "split 只接受 auto/a/b");

console.log('quad-lattice-triangles: PASS');
console.log(JSON.stringify({ region: got.stats, draped: gone.stats, cut: cut.stats }, null, 1));
