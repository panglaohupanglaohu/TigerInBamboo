// 1471817524148940807 岩岛生成层：REACode squarehex.islandMask 公式逐点移植到共享 World。
// 对账口径：land 布尔场与裁判掩码逐位相等；陆地共边对数与裁判 countAdjacency 相等；
// 写 World 只动 rock 体素列，格网 edgeNeighbors/导航不变，再喂 rockIslandMesh 出切角轮廓。
import assert from 'node:assert/strict';
import { buildSquareGrid, buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { World, MAX_LEVEL } from '../src/core/world.js';
import { rockIslandLand, rockIslandField, rockIslandLevels, rockIslandGenerate, rockIslandMesh } from '../src/core/rock-island-c08.js';
import { cornerCutPlan, islandFootprints } from '../src/core/corner-footprint.js';
const REF = await import('../../REACode/src/squarehex.js');

// 1) land 场与裁判 islandMask 逐位对账（3 种子 × 32×32 全格点）
for (const seed of [7, 3, 11]) {
  const w = 32, h = 32, mask = REF.islandMask(w, h, seed);
  let land = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x - w / 2) / (w / 2), nz = (y - h / 2) / (h / 2);
    const isLand = rockIslandLand(nx, nz, { seed, lattice: w }) > .02;
    assert.equal(isLand, mask[y * w + x] === 1, `seed ${seed} @(${x},${y})`);
    land += isLand;
  }
  assert.ok(land > 50 && land < w * h, `seed ${seed} sane land fraction ${land}`);
}

// 2) 共享方格（33×33，cellSize 1 → 格心整数、xSpan=16）：
//    前 32×32 子块与裁判掩码逐格一致，陆地共边对数 = 裁判 countAdjacency。
{
  const g = buildSquareGrid({ radius: 16, cellSize: 1 });
  const { field } = rockIslandField(g, { seed: 7, lattice: 32 });
  const mask = REF.islandMask(32, 32, 7);
  const ix = (c) => c.cx + 16, iz = (c) => c.cz + 16;
  const isLand = new Map();
  let pairs = 0;
  for (const c of g.cells) {
    const land = field[c.id] > .02;
    isLand.set(c.id, land);
    if (ix(c) < 32 && iz(c) < 32) assert.equal(land, mask[iz(c) * 32 + ix(c)] === 1, `cell (${ix(c)},${iz(c)})`);
  }
  for (const c of g.cells) {
    if (!isLand.get(c.id) || ix(c) >= 32 || iz(c) >= 32) continue;
    for (let i = 0; i < c.n; i++) {
      const n = c.edgeNeighbors[i];
      if (n < 0 || n < c.id) continue;
      const o = g.cells[n];
      if (ix(o) < 32 && iz(o) < 32 && isLand.get(n)) pairs++;
    }
  }
  assert.equal(pairs, REF.countAdjacency(mask, 32, 32), 'land adjacency parity with referee');
  assert.ok(pairs > 100);
}

// 3) rockIslandGenerate：写共享 World，台地层为 cliff 倍数、不越 MAX_LEVEL；格网拓扑不变。
for (const [name, g] of [['square', buildSquareGrid({ radius: 12, cellSize: .8 })], ['quad', buildQuadGrid({ radius: 8, seed: 6 })]]) {
  const w = new World(g);
  const topo = JSON.stringify(g.cells.map((c) => c.edgeNeighbors));
  const rep = rockIslandGenerate(w, { seed: 4 });
  assert.ok(rep.land > 20 && rep.water > 20, `${name} land ${rep.land}`);
  assert.equal(rep.land + rep.water, g.cells.length);
  for (const c of g.cells) {
    const t = w.ground(c);
    assert.ok(t === 0 || (t % 2 === 0 && t <= MAX_LEVEL), `${name} cell ${c.id} level ${t}`);
    assert.equal(w.top(c), t);
  }
  assert.deepEqual(Object.keys(rep.histogram).map(Number).sort((a, b) => a - b), [2, 4, 6, 8]);
  let pairs = 0;
  for (const c of g.cells) for (let i = 0; i < c.n; i++) { const n = c.edgeNeighbors[i]; if (n > c.id && w.ground(c) > 0 && w.ground(g.cells[n]) > 0) pairs++; }
  assert.equal(rep.adjacency, pairs, 'adjacency report');
  assert.equal(JSON.stringify(g.cells.map((c) => c.edgeNeighbors)), topo, `${name} grid topology untouched`);

  // 生成 → 切角渲染闭环：plan 仍二分、共边接触 > 0、无断边；网格不被生成器改写。
  assert.ok(cornerCutPlan(g).bipartite, `${name} bipartite`);
  const m = rockIslandMesh(w, { cut: .5, L: .3 });
  assert.ok(m.cutCorners > 20 && m.walls > 0 && m.levels === 8, `${name} mesh`);
  const fp = islandFootprints(w, { cut: .5 });
  assert.equal(fp.metrics.brokenEdges, 0);
  assert.ok(fp.metrics.contact > .3, `${name} contact ${fp.metrics.contact}`);
  console.log(name, { land: rep.land, adjacency: rep.adjacency, cutCorners: m.cutCorners, walls: m.walls, contact: +fp.metrics.contact.toFixed(3) });
}

// 4) 确定性：同种子同结果，异种子不同图样。
{
  const g = buildSquareGrid({ radius: 10 });
  const a = rockIslandLevels(g, { seed: 5 }), b = rockIslandLevels(g, { seed: 5 }), c = rockIslandLevels(g, { seed: 6 });
  assert.deepEqual([...a], [...b]);
  assert.notDeepEqual([...a], [...c]);
}

// 5) 参数护栏。
assert.throws(() => rockIslandLand(0, 0, { lattice: 3 }), /lattice/);
assert.throws(() => rockIslandLand(NaN, 0), /finite/);
assert.throws(() => rockIslandLevels(buildSquareGrid({ radius: 4 }), { terraces: 0 }), /terraces/);
assert.throws(() => rockIslandLevels(buildSquareGrid({ radius: 4 }), { terraces: 7, cliff: 2 }), /MAX_LEVEL|cliff/);
assert.throws(() => rockIslandLevels(buildSquareGrid({ radius: 4 }), { peak: .01 }), /peak/);
{
  const empty = { cells: [{ id: 0, n: 4, cx: 0, cz: 0, pts: [] }] };
  assert.throws(() => rockIslandField(empty), /span/);
}
// 台地参数生效：terraces=2,cliff=3 → 层数 ⊆ {0,3,6}。
{
  const lv = rockIslandLevels(buildSquareGrid({ radius: 10 }), { seed: 2, terraces: 2, cliff: 3 });
  for (const v of lv) assert.ok(v === 0 || v === 3 || v === 6);
}
// 三角底图也能出掩码（mask 是逐格心场），只是切角渲染要求二分格。
{
  const g = buildMixedGrid({ radius: 5, seed: 3 }), w = new World(g);
  const rep = rockIslandGenerate(w, { seed: 9, terraces: 2 });
  assert.ok(rep.land >= 0 && rep.land + rep.water === g.cells.length);
  assert.throws(() => rockIslandMesh(w), /bipartite/);
}
console.log('PASS rock-island-gen: referee islandMask parity (3072 points), adjacency parity, terraced World write, topology intact, generate→corner-cut pipeline');
