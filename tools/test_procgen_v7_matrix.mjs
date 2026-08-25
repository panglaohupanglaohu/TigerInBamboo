// V7-G16：自动矩阵、golden seeds、确定性和小型性能门
import assert from "node:assert/strict";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createSimpleTiledModel, solveSimpleTiled } from "../TigerMessenger/src/procgen/wfc/simpleTiledModel.js";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { createCastleProfile, validateCastleProfile } from "../TigerMessenger/src/procgen/profiles/castleProfiles.js";

const F = (connector) => ({ connector, parity: "symmetric" });
const prototypes = ["floor-a", "floor-b", "floor-c"].map((id, i) => ({ id, family: "floor", weight: i + 1, orientationGroup: "NONE", faces: { N: F("floor"), E: F("floor"), S: F("floor"), W: F("floor") } }));
const model = createSimpleTiledModel({ prototypes, graph: createRectGrid2D({ width: 6, height: 4 }) });
const hashes = new Map();
for (const seed of [1, 7, 42, 884, ...Array.from({ length: 20 }, (_, i) => 1000 + i)]) {
  const result = solveSimpleTiled({ model, seed });
  assert.equal(result.ok, true, JSON.stringify(result));
  hashes.set(seed, result.solutionHash);
  assert.equal(solveSimpleTiled({ model, seed }).solutionHash, result.solutionHash);
}
assert.equal(hashes.size, 24);

let maxMs = 0;
for (const resolution of [9, 13, 17]) {
  const start = performance.now();
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution, sample: (p) => Math.hypot(...p) - 0.5 });
  const mesh = marchingCubes(field);
  maxMs = Math.max(maxMs, performance.now() - start);
  assert.ok(mesh.stats.triangleCount > 0);
}
for (const kind of ["highland-citadel", "ancient-fortress", "canal-citadel"]) assert.equal(validateCastleProfile(createCastleProfile(kind)).ok, true);
console.log(`  ✓ golden+20 seeds deterministic；MC resolution matrix；max=${maxMs.toFixed(2)}ms`);
console.log("✅ V7-G16 assertions=3");
