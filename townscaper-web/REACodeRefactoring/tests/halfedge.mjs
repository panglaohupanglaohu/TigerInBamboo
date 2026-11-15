// 1458921394855718917 等（第 51 轮，迁自 REACode src/halfedge.js）：共享网格的显式半边 —— next/prev/twin 一致、圆盘 Euler = 1、
// 单一边界环且长度 = 边界边数、顶点扇覆盖全部出边、twin 与 grid.edgeTwins 对应；方格切三角后仍是流形、Euler 不变。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { buildHalfEdge, checkHalfEdge, splitQuads } from '../src/core/halfedge.js';
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 6 })], ['mixed', buildMixedGrid({ radius: 8 })]]) {
  const H = buildHalfEdge(grid.cells);
  assert.deepEqual(checkHalfEdge(H), [], `${name} 半边一致`);
  assert.equal(H.euler, 1, `${name} 圆盘 Euler = 1`);
  assert.equal(H.boundaryLoops.length, 1, '单一边界环'); assert.equal(H.boundaryLoops[0].length, H.boundaryEdges, '环长 = 边界边数');
  // 与共享网格的邻接一致：内部半边的 twin 所在格 = grid.edgeNeighbors 里的邻格
  const nbSets = new Map(grid.cells.map((c) => [c.id, new Set(c.edgeNeighbors.filter((x) => x >= 0))]));
  for (const h of H.he) if (h.twin >= 0) assert.ok(nbSets.get(h.cell).has(H.he[h.twin].cell), 'twin 对应共享网格邻格');
  const S = splitQuads(grid.cells, { share: 0.5, seed: 3 }), H2 = buildHalfEdge(S.cells);
  assert.deepEqual(checkHalfEdge(H2), [], '切三角后仍是流形'); assert.equal(H2.euler, 1, 'Euler 不变'); assert.equal(H2.cells, grid.cells.length + S.split, '每切一格多一面');
  assert.equal(H2.edges, H.edges + S.split, '每切一格多一条边');
  out[name] = { V: H.verts, E: H.edges, F: H.cells, boundary: H.boundaryEdges, split: S.split };
}
console.log('PASS 显式半边：一致性、Euler、边界环、顶点扇、对应共享邻接、方格切三角仍流形', JSON.stringify(out));
