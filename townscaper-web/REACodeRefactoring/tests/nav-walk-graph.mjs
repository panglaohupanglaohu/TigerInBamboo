// nav-walk-graph.mjs — 917405214638006273 "a heuristic for deliberately generating navigable levels"
// 片子：灰模上叠一层「每格一个点 + 黄线连邻格」的可走图，塔身上有竖着的连线（跨台阶的那几根）；
//       岛一代代重新生成，每次都能从沙滩走遍所有台地。
// 验收：四边网格多个 seed 的岛，从沙滩出发的最短路树覆盖所有 top>=2 的可走格（没有够不着的台地）；
//       削台账（world.bnNavFix）自洽：passes<=6、lowered 等于真的被削低的 fill 次数、每次只削一道崖（2 层）。
// 附记（本轮实测，写进 next 的缺口）：三角网格下岛的半径口径不匹配——R=5.4 把 radius 6 的网格铺满，
//       整片没有 0 层海格，既无沙滩也无岸格，启发式只能空转（passes=0）。这里把它当断言固定下来，别再假装验过。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateBadNorth } from '../src/badnorth/island.js';
import { buildNav } from '../src/world/navgraph.js';

const gen = (make, seed) => {
  const world = new World(make({ radius: 6, seed }));
  // 记账要对上「真的被削低的格」：包一层 fill，记下所有把 top 往下改的调用（只可能是第 3 步的启发式）
  const loweredFills = [];
  const origFill = world.fill.bind(world);
  world.fill = (c, lv, opt) => {
    const prev = world.top(c);
    const out = origFill(c, lv, opt);
    if (lv < prev) loweredFills.push({ id: c.id, from: prev, to: lv });
    return out;
  };
  generateBadNorth(world, seed);
  world.fill = origFill;
  return { world, loweredFills };
};

const rows = [];
for (const seed of [3, 7, 11, 19, 23, 31]) {
  const { world, loweredFills } = gen(buildQuadGrid, seed);
  const shore = world.cells.filter((c) => world.top(c) > 0 && c.edgeNeighbors.some((id) => id >= 0 && world.top(world.cells[id]) === 0));
  assert.ok(shore.length, `quad/${seed} 应该有岸格`);
  const beach = shore.find((c) => world.top(c) === 1) || shore.find((c) => world.top(c) === Math.min(...shore.map((x) => world.top(x))));
  const nav = buildNav(world, { start: beach });
  const terraces = world.cells.filter((c) => nav.walk[c.id] && nav.hgt[c.id] >= 2);
  const stuck = terraces.filter((c) => !Number.isFinite(nav.tree.time[c.id]));
  assert.equal(stuck.length, 0, `quad/${seed} 还有 ${stuck.length} 块台地走不上去`);

  const fix = world.bnNavFix;
  assert.ok(fix, `quad/${seed} 应写下削台账`);
  assert.ok(fix.passes >= 1 && fix.passes <= 6, `quad/${seed} passes=${fix.passes}`);
  assert.equal(fix.unreachableAfter, 0, `quad/${seed} unreachableAfter=${fix.unreachableAfter}`);
  assert.equal(fix.lowered, loweredFills.length, `quad/${seed} 台账 ${fix.lowered} ≠ 实际削低 ${loweredFills.length}`);
  for (const f of loweredFills) assert.equal(f.from - f.to, 2, `quad/${seed} 格 ${f.id} 一次削了 ${f.from - f.to} 层，应只削一道崖`);
  rows.push({ kind: 'quad', seed, terraces: terraces.length, lowered: loweredFills.length, passes: fix.passes, start: fix.start });
}

// 三角网格：固定「没有海格 → 启发式空转」这个事实（要么真的修好，要么一直报出来）
const mixed = gen(buildMixedGrid, 3).world;
const seaCells = mixed.cells.filter((c) => mixed.top(c) === 0).length;
if (seaCells === 0) {
  assert.equal(mixed.bnNavFix.passes, 0, '没有海格时不该硬跑启发式');
  rows.push({ kind: 'mixed', seed: 3, seaCells, passes: 0, note: '无海格：岛铺满网格，可走性启发式无起点' });
} else {
  const shore = mixed.cells.filter((c) => mixed.top(c) > 0 && c.edgeNeighbors.some((id) => id >= 0 && mixed.top(mixed.cells[id]) === 0));
  const beach = shore.find((c) => mixed.top(c) === 1) || shore[0];
  const nav = buildNav(mixed, { start: beach });
  const stuck = mixed.cells.filter((c) => nav.walk[c.id] && nav.hgt[c.id] >= 2 && !Number.isFinite(nav.tree.time[c.id]));
  assert.equal(stuck.length, 0, `mixed/3 还有 ${stuck.length} 块台地走不上去`);
  rows.push({ kind: 'mixed', seed: 3, seaCells, stuck: stuck.length, passes: mixed.bnNavFix.passes });
}

assert.ok(rows.some((r) => r.kind === 'quad' && r.lowered > 0), '至少有一个 seed 该触发过削台，否则这个启发式没被验到');
console.log(JSON.stringify(rows, null, 1));
const mixedNote = rows[rows.length - 1].note ? '；三角网格：' + rows[rows.length - 1].note : '';
console.log('PASS navigable levels: ' + rows.filter((r) => r.kind === 'quad').length + ' 个四边网格岛全部可从沙滩走到每块台地，共削台 ' +
  rows.filter((r) => r.kind === 'quad').reduce((n, r) => n + r.lowered, 0) + ' 格' + mixedNote);
