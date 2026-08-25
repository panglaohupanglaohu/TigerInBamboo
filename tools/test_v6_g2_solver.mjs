// V6-G2：不规则骨架 + domain 约束求解（不上默认、不换全城网格）
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

for (const rel of ["src/world/citadel/irregularSkeleton.js", "src/world/citadel/constraintSolver.js", "src/world/citadel/solverDebug.js"]) {
  const src = fs.readFileSync(fileURLToPath(new URL(rel, BASE)), "utf8");
  assert.equal(/from ["']three["']/.test(src), false, `${rel} 不得 import Three`);
}
console.log("  ✓ G2 数据层无 Three.js");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileTopology, buildMainGrid, validateHalfEdge } = await import(new URL("src/world/citadel/topology.js", BASE).href);
const { perturbSkeletonVertices, collectLockedVertices, skeletonHash } = await import(
  new URL("src/world/citadel/irregularSkeleton.js", BASE).href
);
const { createModuleCatalog } = await import(new URL("src/world/citadel/moduleCatalog.js", BASE).href);
const { extractTownCells, resolveTown } = await import(new URL("src/world/citadel/moduleResolver.js", BASE).href);
const {
  GOLDEN_SEEDS,
  MAX_BACKTRACK,
  appearanceHash,
  initializeDomain,
  uniqueTransforms,
  solveDirtyRegion,
  buildNeighborMap,
  expandByTopology,
} = await import(new URL("src/world/citadel/constraintSolver.js", BASE).href);
const { solverToSvg, solverDebugModel } = await import(new URL("src/world/citadel/solverDebug.js", BASE).href);

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const catalog = createModuleCatalog();

{
  const spec = buildMainGrid(bp);
  const locked = collectLockedVertices(spec.faces);
  const a = perturbSkeletonVertices(spec, bp, 7);
  const b = perturbSkeletonVertices(spec, bp, 7);
  const c = perturbSkeletonVertices(spec, bp, 7);
  assert.equal(a.hash, b.hash);
  assert.equal(b.hash, c.hash);
  const d = perturbSkeletonVertices(spec, bp, 1);
  assert.notEqual(d.hash, a.hash);
  let moved = 0;
  let held = 0;
  const orig = new Map(spec.vertices.map((v) => [v.id, v]));
  for (const v of a.vertices) {
    const o = orig.get(v.id);
    const dist = Math.hypot(v.x - o.x, v.z - o.z);
    if (locked.has(v.id) || v.lockReason) {
      assert.ok(dist < 1e-9, `locked ${v.id} moved`);
      held += 1;
    } else if (dist > 1e-6) moved += 1;
  }
  assert.ok(held > 0, "有锁定顶点");
  assert.ok(moved > 10, `未锁定顶点应扰动 ${moved}`);
  const t1 = compileTopology(bp, 7);
  const t2 = compileTopology(bp, 7);
  const t3 = compileTopology(bp, 7);
  assert.equal(t1.skeleton.hash, t2.skeleton.hash);
  assert.equal(t2.skeleton.hash, t3.skeleton.hash);
  assert.equal(t1.report.ok, true, t1.report.errors.join("; "));
  assert.equal(t1.halfEdge.faces.length, spec.faces.length);
  console.log(`  ✓ 骨架 hash=${t1.skeleton.hash} locked=${held} moved=${moved} ×3 一致`);
}

{
  const cells = extractTownCells(bp, catalog);
  assert.ok(cells.length >= 100);
  let empty = 0;
  let rotated = 0;
  for (const cell of cells) {
    const domain = initializeDomain(cell, catalog);
    if (!domain.length) empty += 1;
    if (domain.some((e) => e.rot !== "r0" || e.mirror)) rotated += 1;
  }
  assert.equal(empty, 0, `空 domain ${empty}`);
  assert.ok(uniqueTransforms(catalog.modules.find((m) => m.family === "gate")).length >= 2);
  console.log(`  ✓ domain 初始化 ${cells.length} 格全非空 · 不对称旋转/镜像 ${rotated}`);
}

{
  const hashes = [];
  for (const seed of GOLDEN_SEEDS) {
    const town = resolveTown(bp, catalog, seed);
    assert.equal(town.fallbackCount, 0, `golden ${seed} fallback`);
    assert.equal(town.contradiction, 0, `golden ${seed} contradiction`);
    assert.ok(town.solver.ok);
    assert.ok(town.backtracks <= MAX_BACKTRACK);
    assert.ok(town.cells.every((c) => c.module && c.module.family !== undefined));
    hashes.push(town.hash);
  }
  const t7a = resolveTown(bp, catalog, 7);
  const t7b = resolveTown(bp, catalog, 7);
  const t7c = resolveTown(bp, catalog, 7);
  assert.equal(t7a.hash, t7b.hash);
  assert.equal(t7b.hash, t7c.hash);
  const topoH = [0, 1, 2].map(() => compileTopology(bp, 7).skeleton.hash);
  assert.equal(topoH[1], topoH[0]);
  console.log(`  ✓ golden fallback=0 hash7=${t7a.hash} backtracks=${t7a.backtracks}`);
}

{
  const stats = [];
  for (let s = 1; s <= 100; s++) {
    const town = resolveTown(bp, catalog, s);
    stats.push({
      seed: s,
      ok: town.solver.ok,
      contradiction: town.contradiction,
      backtrack: town.backtracks,
      fallback: town.fallbackCount,
      ms: town.solver.ms,
    });
  }
  const fail = stats.filter((x) => !x.ok || x.fallback > 0);
  const ms = stats.map((x) => x.ms).sort((a, b) => a - b);
  const out = {
    n: stats.length,
    fail: fail.length,
    backtrackP50: stats.map((x) => x.backtrack).sort((a, b) => a - b)[49],
    backtrackMax: Math.max(...stats.map((x) => x.backtrack)),
    fallbackMax: Math.max(...stats.map((x) => x.fallback)),
    msP50: ms[49],
    msP95: ms[94],
    goldenFallback: 0,
  };
  fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
  fs.writeFileSync(new URL("./out/v6-g2-solver-stats.json", import.meta.url), JSON.stringify({ ...out, samples: stats }, null, 2));
  assert.equal(out.fallbackMax, 0);
  console.log(`  ✓ 100 seed contradiction=${fail.length} backtrackMax=${out.backtrackMax} msP50=${out.msP50.toFixed(2)}`);
}

{
  const first = resolveTown(bp, catalog, 7);
  const dirty = [first.cells[40].cellId];
  const region = new Set(expandByTopology(dirty, 2).filter((id) => first.solver.byId[id]));
  const second = resolveTown(bp, catalog, 7, { dirtyIds: dirty, previous: first.solver, ring: 2 });
  assert.ok(second.solver.ok);
  const skip = region;
  assert.equal(appearanceHash(first.cells, skip), appearanceHash(second.cells, skip), "两环外 appearance 不变");
  console.log(`  ✓ dirty 两环 ${region.size} 格，区域外 hash 不变`);
}

{
  const isolated = {
    id: "cell:0:3:0:3",
    occupancy: { N: 1, E: 1, S: 1, W: 1, U: 0, D: 1 },
    semantic: "block",
    support: 1,
    lockModuleId: catalog.modules.find((m) => m.family === "balcony")?.id,
  };
  const world = { cells: [isolated], catalog, neighbors: buildNeighborMap([isolated]) };
  const bad = solveDirtyRegion(world, [isolated.id], 7, { ring: 0 });
  assert.equal(bad.ok, false);
  assert.ok(bad.emptyCells?.length >= 1 || bad.suggestions?.length);
  assert.equal(bad.fallbackCount, 0);
  assert.ok(!bad.cells[0].module || bad.cells[0].contradiction);
  console.log(`  ✓ 无解解释 empty=${(bad.emptyCells || []).length} 建议=${(bad.suggestions || [])[0]}`);
}

{
  const mk = (id, family, sockets, weight) =>
    Object.freeze({
      id,
      family,
      role: "x",
      sockets,
      requires: [],
      forbids: [],
      transforms: ["r0"],
      weight,
      rarity: "common",
      walkSurface: null,
    });
  const wall = { N: "wall", E: "wall", S: "wall", W: "wall", U: "roof", D: "support" };
  const openU = { ...wall, U: "open" };
  const mBad = mk("floor.openu.v1", "floor", openU, 8);
  const mGood = mk("floor.base.v1", "floor", wall, 0.05);
  const cat = {
    modules: [mBad, mGood],
    byId: { [mBad.id]: mBad, [mGood.id]: mGood },
    byFamily: { floor: [mBad, mGood] },
  };
  const a = { id: "cell:0:1:0:1", occupancy: { N: 0, E: 0, S: 0, W: 0, U: 1, D: 1 }, semantic: "block", support: 1 };
  const b = { id: "cell:0:1:1:1", occupancy: { N: 0, E: 0, S: 0, W: 0, U: 0, D: 1 }, semantic: "block", support: 1 };
  const world = { cells: [a, b], catalog: cat, neighbors: buildNeighborMap([a, b]) };
  const solved = solveDirtyRegion(world, [a.id, b.id], 3, { ring: 0 });
  assert.equal(solved.ok, true);
  assert.ok(solved.backtracks >= 1, `应回溯，实际 ${solved.backtracks}`);
  assert.equal(solved.cells.find((c) => c.cellId === a.id).module.id, "floor.base.v1");
  console.log(`  ✓ 上限回溯生效 backtracks=${solved.backtracks} ≤${MAX_BACKTRACK}`);
}

{
  const town = resolveTown(bp, catalog, 7);
  const svg = solverToSvg(town.solver, { terrace: 0, iy: 0 });
  assert.match(svg, /<svg /);
  const model = solverDebugModel(town.solver);
  assert.equal(model.fallbackCount, 0);
  fs.writeFileSync(new URL("./out/v6-g2-domain.svg", import.meta.url), svg);
  fs.writeFileSync(new URL("./out/v6-g2-solver.json", import.meta.url), JSON.stringify({ hash: town.hash, backtracks: town.backtracks, cells: town.cells.length, skeleton: compileTopology(bp, 7).skeleton }, null, 2));
  console.log(`  ✓ debug SVG/JSON 已写 tools/out/v6-g2-*`);
}

console.log("\nV6-G2 骨架+约束求解验收通过（TESTED，未 DEFAULT_ON）");
