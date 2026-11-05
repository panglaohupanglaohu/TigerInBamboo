import assert from 'node:assert/strict';
import { campaignGraph, campaignWalk } from '../src/core/campaign-graph.js';
import { generateCampaign, groupRegions } from '../src/campaign/campaign.js';
const reachable = nb => { const set = new Set([0]), q = [0]; for (let h = 0; h < q.length; h++) for (const v of nb[q[h]]) if (!set.has(v)) { set.add(v); q.push(v); } return set.size; };
const nodes = [0, .2, .4, 10, 10.2, 10.4].map(x => ({ x, y: 0, r: .03 }));
const g = campaignGraph(nodes);
assert.equal(g.componentsBeforeRepair, 2); assert.equal(g.bridges.length, 1); assert.equal(reachable(g.nb), 6);
assert.deepEqual(g.bridges[0], [2, 3]);
const triangle = campaignGraph([{x:0,y:0,r:1},{x:1,y:0,r:1},{x:0,y:1,r:1}]);
assert.equal(triangle.tri.length, 3, 'all hull edges must be retained');
assert.deepEqual(campaignWalk(nodes, [[1],[0],[],[],[],[]], 0, 5, () => 0, 0), []);
assert.deepEqual(campaignWalk(nodes, g.nb, 0, 5, () => .5, 0), [0,2,3,5]);
assert.deepEqual(campaignWalk(nodes, g.nb, 0, 0, () => .5), [0]);
assert.throws(() => campaignGraph([]), RangeError);
assert.throws(() => generateCampaign({n:0}), RangeError);
assert.throws(() => generateCampaign({W:NaN}), RangeError);
assert.throws(() => groupRegions([0], [[]], 0), RangeError);
let total = 0, bridges = 0;
for (let seed = 0; seed < 160; seed++) {
  const c = generateCampaign({seed, n:seed < 80 ? 260 : 40});
  assert.equal(reachable(c.nb), c.nodes.length);
  assert.equal(c.main[0], c.start); assert.equal(c.main.at(-1), c.end);
  assert.equal(new Set(c.main).size, c.main.length);
  for (let i=1;i<c.main.length;i++) assert(c.nb[c.main[i-1]].includes(c.main[i]));
  for (const e of c.edges) { assert(e.a !== e.b); assert(c.nb[e.a].includes(e.b)); }
  for (const id of c.used) assert(Number.isInteger(c.region.get(id)));
  total += c.nodes.length; bridges += c.steps.bridges.length;
  if (seed < 3) assert.deepEqual(c, generateCampaign({seed}));
}
console.log('PASS campaign graph: hull, disconnected repair, BFS, loop erasure, 160 seeds', {total, bridges});
