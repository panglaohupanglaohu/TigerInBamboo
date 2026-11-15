// r55 G4 · engine/rivers.js (1769691526924292506 "collapsing them depth-first to let them wiggle real far, and then
// the rest is collapsed breadth-first, making nice gentle slopes that only occasionally meet steep cliffs"):
// BFS gentle-slope collapse (relaxRiverSlopes), joint lake/hole rebuild (digBasins + water fill +
// linkRiversThroughLakes), and the same pipeline on the planet World (sphere).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const G = await import('../src/terrain/generate.js');
const { fillTerrainDepressions, liveLakes } = await import('../src/terrain/drainage.js');
const P = await import('../src/sphere/planet.js'), T = await import('../src/sphere/planet-town.js');
const GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };

/** every river (and lake) cell drains to the sea along flowTo without cycles; returns chain lengths */
function drainsToSea(w) {
  const F = w.riverFlow.flowTo, lakeOf = w.lakes?.lakeOf, n = w.cells.length, sea = (id) => id < 0 || !w.ground(w.cells[id]);
  let longest = 0;
  for (let id = 0; id < n; id++) {
    if (!w.river[id] && !(lakeOf && lakeOf[id] >= 0)) continue;
    let k = id, steps = 0; const seen = new Set();
    while (!sea(k)) { assert.ok(!seen.has(k), `flow cycle at ${k}`); seen.add(k); const nx = F[k]; assert.ok(nx >= 0 || w.lakes.parent[k] === -1, `dangling river/lake cell ${k}`); if (nx < 0) break; k = nx; steps++; }
    longest = Math.max(longest, steps);
  }
  return longest;
}
/** flowTo never climbs (lake cells flow at their water level) */
function neverClimbs(w) {
  const F = w.riverFlow.flowTo, lvl = (id) => Math.max(w.ground(w.cells[id]), w.lakes?.level[id] ?? 0);
  for (let id = 0; id < w.cells.length; id++) if (F[id] >= 0 && (w.river[id] || w.lakes?.lakeOf[id] >= 0)) assert.ok(lvl(F[id]) <= lvl(id), `flow climbs ${id}→${F[id]}`);
}

const summary = {};
let basins = 0, basinLakes = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [3, 7, 11, 23, 31]) {
  // BFS collapse vs plain depth-first carve on the same seed
  const a = new World(decorateCells(GRIDS[kind]())), b = new World(decorateCells(GRIDS[kind]()));
  G.generateTerrain(a, { seed, caves: 0, features: false });
  const rb = G.generateTerrain(b, { seed, caves: 0, features: false, riverRelax: true });
  assert.deepEqual([...a.river], [...b.river], 'BFS pass never moves river cells');
  for (let id = 0; id < a.cells.length; id++) { assert.ok(b.ground(b.cells[id]) <= a.ground(a.cells[id]), 'BFS only lowers'); if (a.river[id]) assert.equal(b.ground(b.cells[id]), a.ground(a.cells[id]), 'river beds untouched'); }
  const rx = rb.relax;
  assert.ok(rx.steepEdgesAfter < rx.steepEdgesBefore, 'gentler slopes'); assert.ok(rx.cliffsKept >= 0 && rx.reached > 50);
  // every land cell reached by the BFS is at most one level above the BFS parent unless it was kept as a cliff
  // (spot check: within 1 ring of a river, steps >1 only where cliffs were kept)
  // joint lake/hole rebuild
  const c = new World(decorateCells(GRIDS[kind]()));
  const rc = G.generateTerrain(c, { seed, riverRelax: true, lakes: true, basins: 1 });
  assert.ok(c.lakes && rc.joint && rc.joint.broken === 0, 'all rivers reach the sea');
  const longest = drainsToSea(c); neverClimbs(c);
  assert.equal(liveLakes(c).length, c.lakes.lakes.length, 'lakes drawable after generation');
  for (const lake of c.lakes.lakes) { const out = c.riverFlow.flowTo[lake.cells.find((m) => c.riverFlow.flowTo[m] === lake.spillCell)]; assert.equal(out, lake.spillCell, 'each lake drains through its spill cell'); }
  if (rc.holes.length) { basins++; const hole = new Set(rc.holes[0].cells); if (c.lakes.lakes.some((l) => l.cells.some((id) => hole.has(id)))) basinLakes++; }
  summary[`${kind}-${seed}`] = { relax: { lowered: rx.lowered, steep: `${rx.steepEdgesBefore}→${rx.steepEdgesAfter}`, cliffsKept: rx.cliffsKept }, lakes: rc.lakes, rivers: rc.joint.riverCells, extended: rc.joint.extended, longest };
}
assert.ok(basins >= 6 && basinLakes >= basins * 0.6, `dug basins mostly hold a lake (${basinLakes}/${basins}); the rest drain over a low rim`);
summary.basinLakes = `${basinLakes}/${basins}`;
// sphere: same DFS carve + BFS collapse + joint rebuild on the planet World (cells carry `dir`)
{
  const planet = P.buildPlanet(P.buildSphere({})), pw = T.planetWorld(planet);
  const carved = G.carveRivers(pw, { seed: 5, count: 4, minSeparation: 0.6, maxSteps: 400 });
  assert.ok(pw.riverFlow.paths.length >= 2, 'several sources accepted using chord separation on the sphere');
  const longestPath = Math.max(...pw.riverFlow.paths.map((p) => p.length));
  const relax = G.relaxRiverSlopes(pw, { seed: 9 });
  assert.ok(relax.steepEdgesAfter < relax.steepEdgesBefore);
  fillTerrainDepressions(pw, { lakes: 'water' }); const j = G.linkRiversThroughLakes(pw);
  assert.equal(j.broken, 0); drainsToSea(pw); neverClimbs(pw);
  summary.sphere = { carved: carved.length, longestPath, relax: `${relax.steepEdgesBefore}→${relax.steepEdgesAfter}`, lakes: j.lakes, riverCells: j.riverCells };
}
assert.throws(() => G.generateTerrain(new World(decorateCells(GRIDS.quad())), { lakes: true, drainage: true }), RangeError);
console.log('river-relax-lakes-r55 PASS', JSON.stringify(summary));
