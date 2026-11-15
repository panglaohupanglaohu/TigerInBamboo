// 第 56 批 C06：1301816247479345152 在主场景生成网格上随机撒手工模板补丁（gems）。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid, signedArea } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { sprinkleGems } from '../src/core/grid-gems-c06.js';

for (const [name, g0] of [['quad', buildQuadGrid({ radius: 14, hexSize: 1.0 })], ['mixed', buildMixedGrid({ radius: 22, hexSize: .62 })]]) {
  const area0 = g0.cells.reduce((s, c) => s + Math.abs(signedArea(c.pts)), 0);
  const g = sprinkleGems(g0, { count: 4, seed: 11 });
  assert.equal(g.gems.length, 4, `${name} 撒满 4 块`);
  assert.deepEqual(new Set(g.gems.map((x) => x.template)), new Set(['courtyard', 'radial', 'block', 'rhombus']));
  for (let i = 0; i < g.gems.length; i++) for (let j = i + 1; j < g.gems.length; j++) assert.ok(Math.hypot(g.gems[i].x - g.gems[j].x, g.gems[i].z - g.gems[j].z) > 5, '互不重叠');
  const area = g.cells.reduce((s, c) => s + Math.abs(signedArea(c.pts)), 0);
  assert.ok(Math.abs(area - area0) / area0 < 1e-9, '总面积守恒');
  for (const c of g.cells) { assert.ok(signedArea(c.pts) !== 0); for (let e = 0; e < c.n; e++) { const o = c.edgeNeighbors[e]; if (o >= 0) assert.equal(g.cells[o].edgeNeighbors[c.edgeTwins[e]], c.id, '半边互逆'); } }
  assert.equal(g.radius, g0.radius, '网格半径不变（存档头仍按半径识别网格）');
  // 确定性 + 能直接建 World
  const g2 = sprinkleGems(g0, { count: 4, seed: 11 });
  assert.deepEqual(g2.gems, g.gems);
  const w = new World(g); const d = (x) => Math.hypot(x.cx - g.gems[1].x, x.cz - g.gems[1].z), c = g.cells.reduce((b, x) => d(x) < d(b) ? x : b); w.setSolid(c, 1, true); w.setSolid(c, 2, true); assert.equal(w.top(c), 2);
  // count=0：网格原样返回
  assert.equal(sprinkleGems(g0, { count: 0 }).cells.length, g0.cells.length);
}
console.log('PASS grid-gems-c06');
