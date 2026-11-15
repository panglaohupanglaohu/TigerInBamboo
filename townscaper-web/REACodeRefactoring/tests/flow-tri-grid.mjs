// flow-tri-grid.mjs — 972829402873716737 "the triangular flow fields we use for pathfinding and combat"
// 片子：岛上铺满按队伍分色的细线（红队一股、青队一股），单位沿着这些线走、在台地间接战。
// 验收：混合网格（三角 + 四边）上多源 Dijkstra 仍然完整——
//       每个可走格都有有限距离、父链一定能走到某个源、沿父链距离不回升，且三角格真的参与了继承。
import assert from 'node:assert/strict';
import { buildMixedGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { buildNav } from '../src/world/navgraph.js';
import { buildFlowField } from '../src/badnorth/flowfield.js';

const world = new World(buildMixedGrid({ radius: 4, seed: 5 }));
for (const c of world.cells) if (Math.hypot(c.cx, c.cz) < 2.6) world.fill(c, 1, { rock: true });
const walk = world.cells.filter((c) => world.top(c) === 1);
assert.ok(walk.length > 40, '应有一片可走地面，实得 ' + walk.length);
const nav = buildNav(world, { start: walk[0] });
const open = walk.filter((c) => nav.walk[c.id]);
const tri = open.filter((c) => c.n === 3), quad = open.filter((c) => c.n === 4);
assert.ok(tri.length > 10 && quad.length > 5, '这块地应同时含三角格与四边格：tri=' + tri.length + ' quad=' + quad.length);

// 两支不同队伍作源，和片子里「红/青两股线」对应
const sources = [
  { cell: open[0], squad: 0, type: '步兵' },
  { cell: open[open.length - 1], squad: 1, type: '弓手' },
];
const F = buildFlowField(world, nav, sources);

const stuck = open.filter((c) => !Number.isFinite(F.dist[c.id]));
assert.equal(stuck.length, 0, '可走格都该有有限距离，实得 ' + stuck.length + ' 格无效');

let maxDepth = 0, bad = 0, triInherit = 0;
for (const c of open) {
  let k = c.id, d = 0, ok = false;
  while (d <= open.length + 2) {
    const p = F.parent[k];
    if (p < 0) { ok = F.src[k] >= 0; break; }
    if (F.dist[p] > F.dist[k] + 1e-9) { bad++; break; }   // 沿父链必须单调不回升
    k = p; d++;
  }
  maxDepth = Math.max(maxDepth, d);
  if (!ok) bad++;
  if (c.n === 3 && F.src[c.id] >= 0 && F.parent[c.id] >= 0) triInherit++;
}
assert.equal(bad, 0, '父链异常 ' + bad + ' 条');
assert.ok(triInherit > 0, '三角格应参与数据继承');
assert.ok(maxDepth > 3, '父链应跨多格，实得最深 ' + maxDepth);

// 两支队伍的源各占一片（不是全被最近的源吃掉）
const perSource = sources.map((s, k) => open.filter((c) => F.src[c.id] === k).length);
assert.ok(perSource.every((n) => n > 0), '每个源都应吃到一块地盘，实得 ' + perSource.join('/'));
assert.equal(F.at(open[0]).dist, 0, '源自己到自己的距离应是 0');

console.log(JSON.stringify({ cells: world.cells.length, walk: open.length, tri: tri.length, quad: quad.length, maxDepth, perSource, triInherit }, null, 1));
console.log('PASS triangular flow field: ' + open.length + ' 格（三角 ' + tri.length + ' / 四边 ' + quad.length + '）全部有流向，父链最深 ' + maxDepth + ' 格，两源地盘 ' + perSource.join('/'));
