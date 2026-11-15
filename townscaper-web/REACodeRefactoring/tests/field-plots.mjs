/**
 * field-plots.mjs — 田块耕纹（1798310423554658732）纯逻辑验收
 *
 * 断言的是片子里能直接看到的三件事：
 *   1. 同一地块内所有格共用一条主轴（本地旧实现逐格随机 → 这里必须为 0 差）；
 *   2. 地块边界上主轴确实改向（否则"地块"没有意义）；
 *   3. 垄线是人字：正中对称、折痕处不跳变、边界格标田埂。
 */
import { buildSquareGrid } from '../src/core/grid.js';
import {
  partitionPlots, principalAxis, plotUV, chevronRow,
  plotBorderCells, sampleField, borderAngleSpread, mulberry32,
} from '../src/core/field-plots.js';

let fails = 0;
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}${extra ? ' · ' + extra : ''}`);
  if (!cond) fails++;
};

const grid = buildSquareGrid({ radius: 6 });
const cells = grid.cells;
const byId = new Map(cells.map((c) => [c.id, c]));
const neighbors = (c) => c.edgeNeighbors.filter((i) => i >= 0).map((i) => byId.get(i));
console.log(`网格 ${cells.length} 格（${{ 4: '四边' }[cells[0].n] || cells[0].n + '边'}）`);

const { plotOf, plots } = partitionPlots({ cells, neighbors, seed: 7, joinChance: 0.55, maxCells: 8 });
ok(plotOf.size === cells.length, '每格都归了地块', `${plotOf.size}/${cells.length}`);
ok(plots.length >= 8 && plots.length <= cells.length, '地块数落在合理区间', `${plots.length} 块`);
ok(Math.max(...plots.map((p) => p.cells.length)) <= 8, '单块不超过 8 格',
  `最大 ${Math.max(...plots.map((p) => p.cells.length))}`);
ok(plots.some((p) => p.cells.length > 1), '存在多格地块（否则等于没连）',
  `多格地块 ${plots.filter((p) => p.cells.length > 1).length} 块`);

// 1. 同一地块内主轴唯一：用格心重算主轴，必须等于块上记录的轴
let worst = 0, multi = 0;
for (const p of plots) {
  if (p.cells.length < 2) continue;
  multi++;
  const ax = principalAxis(p.cells.map((id) => byId.get(id)));
  if (Number.isFinite(ax.angle) && ax.len > 1e-6) {
    let d = Math.abs(ax.angle - p.axis) * 180 / Math.PI;
    if (d > 90) d = 180 - d;
    worst = Math.max(worst, d);
  }
}
ok(multi > 0 && worst < 1e-6, '块内主轴唯一（格心 PCA 与块记录同值）',
  `${multi} 块，最大偏差 ${worst.toExponential(2)}°`);

// 旧实现（逐格 hash 随机角）作对照：同块内各格角度应当互不相同
const legacy = (id) => (mulberry32(id * 19 + 5)() * 180);
const legacySpread = plots.filter((p) => p.cells.length > 1)
  .map((p) => Math.max(...p.cells.map((id) => legacy(id))) - Math.min(...p.cells.map((id) => legacy(id))));
ok(legacySpread.every((s) => s > 1), '对照：逐格随机角在同块内确实互相顶（差值 >1°）',
  `最小 ${Math.min(...legacySpread).toFixed(1)}°`);

// 2. 边界改向
const spread = borderAngleSpread({ cells, neighbors, plots, plotOf });
ok(spread.count > 0, '存在异块相邻边', `${spread.count} 条`);
ok(spread.median > 5, '异块边界主轴中位差 > 5°', `中位 ${spread.median.toFixed(1)}°`);

// 3. 人字
const big = plots.filter((p) => p.cells.length >= 3).sort((a, b) => b.len - a.len)[0];
const { cx, cz } = big;
const eps = 1e-3;
const at = (u) => chevronRow(big, cx + Math.cos(big.axis) * u, cz + Math.sin(big.axis) * u, { skew: 0.35, width: 0.5 });
const L = at(-0.8), R = at(0.8), M = at(0);
ok(Math.abs(L.row - R.row) < 1e-9, '垄线沿主轴左右对称（人字两侧同高）',
  `row(±0.8)=${L.row.toFixed(4)}`);
ok(Math.abs(at(eps).row - at(-eps).row) < 0.01 * 0.5, '折痕处不跳变',
  `Δ=${Math.abs(at(eps).row - at(-eps).row).toExponential(2)}`);
const outer = Math.abs(at(0.8).row - M.row), inner = Math.abs(at(0.05).row - M.row);
ok(outer > inner, '人字张开：离中线越远垄线下沉越多',
  `u=0.8 → ${outer.toFixed(3)}，u=0.05 → ${inner.toFixed(3)}`);
ok(at(-0.8).mirror === -1 && at(0.8).mirror === 1, 'mirror 标记左右两侧');
const uv = plotUV(big, cx, cz);
ok(Math.abs(uv.u) < 1e-9 && Math.abs(uv.v) < 1e-9, '地块中心局部坐标为 0');

// 4. 田埂
const borders = plotBorderCells({ cells, neighbors, plotOf });
ok(borders.size > 0 && borders.size < cells.length, '田埂格存在且不是全部',
  `${borders.size}/${cells.length} 格`);
ok([...borders].every((id) => {
  const me = plotOf.get(id);
  return neighbors(byId.get(id)).some((o) => plotOf.get(o.id) !== me);
}), '田埂格定义自洽（确实挨着异块格）');

// 5. 取色
const c0 = cells[(cells.length / 2) | 0];
const s = sampleField({ cells, plots, plotOf, borders, x: c0.cx, z: c0.cz, cellAt: () => c0 });
ok(s && Number.isFinite(s.shade) && s.shade >= 0 && s.shade <= 1, 'sampleField 取到合法 shade',
  s ? `shade ${s.shade.toFixed(3)} band ${s.band}` : 'null');
ok(sampleField({ cells, plots, plotOf, borders, x: 0, z: 0, cellAt: () => null }) === null,
  '没有格就返回 null（不瞎猜）');

// 6. 确定性
const again = partitionPlots({ cells, neighbors, seed: 7, joinChance: 0.55, maxCells: 8 });
const sameMap = cells.every((c) => again.plotOf.get(c.id) === plotOf.get(c.id));
const other = partitionPlots({ cells, neighbors, seed: 8, joinChance: 0.55, maxCells: 8 });
const diffCount = cells.filter((c) => other.plotOf.get(c.id) !== plotOf.get(c.id)).length;
ok(sameMap, '同 seed 结果完全一致');
ok(diffCount > cells.length * 0.2, '换 seed 划分确实变了', `${diffCount} 格不同`);

// 7. 真六边格也吃得下（buildMixedGrid 里混了三角/四边，这里只验导入不炸）
ok(Array.isArray(plots[0].cells) && plots.every((p) => p.cells.length >= 1), '地块结构完整');
const tiny = partitionPlots({ cells: [{ id: 0, cx: 0, cz: 0 }], neighbors: () => [], seed: 3 });
ok(tiny.plots.length === 1 && Number.isFinite(tiny.plots[0].axis), '单格地块也有合法主轴',
  `${(tiny.plots[0].axis * 180 / Math.PI).toFixed(1)}°`);

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
