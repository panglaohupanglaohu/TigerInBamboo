// 第 56 批 C06：784847588893814785 / 784847933686575104 / 784848286272327680 球面三角格内容无关 WFC 拼装。
import assert from 'node:assert/strict';
import { buildSphere } from '../src/sphere/planet.js';
import { sphereTriGrid, solvePlanetTiles, tileConflicts, planetTileGeometry, TILESETS, biomeField } from '../src/sphere/planet-wfc-c06.js';

const sp = buildSphere({ n: 500, seed: 3, spacing: 25, relax: 15 });
const g = sphereTriGrid(sp);
assert.equal(g.cells.length, 2 * 500 - 4, '闭合三角球 F = 2n-4');
for (const c of g.cells) for (let k = 0; k < 3; k++) { const o = g.cells[c.edgeNeighbors[k]]; assert.equal(o.edgeNeighbors[c.edgeTwins[k]], c.id, '边邻接互逆'); }

const results = {};
for (const set of Object.keys(TILESETS)) {
  for (const root of [10, 400]) {
    const s = solvePlanetTiles(g, { set, root });
    assert.ok(s.ok, `${set} 求解成功`);
    assert.equal(tileConflicts(g, s.tiles), 0, `${set} 相邻插槽全一致`);
    assert.equal(s.order[0], root, `${set} 起点可指定（第一块 = root ${root}）`);
    assert.equal(new Set(s.order).size, g.cells.length, '每格恰好出现一次');
    assert.equal(s.stats.unrecorded, 0, '落定顺序全部来自求解器记录');
    assert.ok(s.stats.frontierRatio >= .98, `${set} 前沿生长（${s.stats.frontierRatio}）`);
    const geo = planetTileGeometry(g, s);
    assert.equal(geo.offsets.length, g.cells.length + 1);
    for (let i = 1; i < geo.offsets.length; i++) assert.ok(geo.offsets[i] >= geo.offsets[i - 1]);
    assert.ok(geo.position.every(Number.isFinite));
    results[set + root] = { s, geo };
  }
}
// 内容无关：同一个 solveWFC，只换瓷砖集；求解器拿到的瓷砖只有 id/edges/weight/variant
for (const ts of Object.values(TILESETS)) for (const t of ts.tiles) assert.deepEqual(Object.keys(t).sort(), ['edges', 'id', 'variant', 'weight']);
// tech：同插槽不同内容（圆顶变体）确实被选到
assert.ok(results.tech10.s.stats.counts['dome:FFF'] > 0, '圆顶变体出现');
// tubes：管子穿过的边两侧都是 1 → 管子连续（插槽一致已保证）；有端头、弯管、三叉
const tc = results.tubes10.s.stats.counts;
assert.ok(['100', '010', '001'].some((k) => tc[k]) && ['110', '011', '101'].some((k) => tc[k]) && tc['111'], '端头/弯管/三叉都有');
// plates：两级尺度 —— 碎块格（RRR）的顶点数远多于整块板格，且碎块只在 biome 带内
const pl = results.plates10;
const per = (id) => { const k = pl.s.order.indexOf(id); return pl.geo.offsets[k + 1] - pl.geo.offsets[k]; };
const rr = [...pl.s.tiles].filter(([, t]) => t.id === 'RRR').map(([id]) => id), pp = [...pl.s.tiles].filter(([, t]) => t.id === 'PPP').map(([id]) => id);
assert.ok(rr.length > 50 && pp.length > 50);
const avg = (ids) => ids.reduce((a, id) => a + per(id), 0) / ids.length;
assert.ok(avg(rr) > 1.8 * avg(pp), `碎块格内细分（${avg(rr).toFixed(0)} vs ${avg(pp).toFixed(0)} 顶点）`);
for (const [id, t] of pl.s.tiles) if (t.edges.includes('R')) assert.ok(biomeField(g.cells[id].center, 5) >= .44 - 1e-9, '碎块只在一片区域');
// 进度切片：前 k 块的顶点数单调
console.log('PASS planet-wfc-c06', JSON.stringify({ cells: g.cells.length, tubes: tc, platesRubble: rr.length, platesPlate: pp.length, perRubble: Math.round(avg(rr)), perPlate: Math.round(avg(pp)), frontier: results.tech400.s.stats.frontierRatio }));
