import assert from "node:assert/strict";
import { compileCastleProfileV7, validateCastleProfileV7, compileCastleProfileMatrix } from "../TigerMessenger/src/procgen/profiles/castleModuleCompilerV7.js";

for (const kind of ["highland", "ancient", "canal"]) {
  for (const seed of [1, 7, 42, 884]) {
    const result = compileCastleProfileV7({ kind, seed });
    assert.equal(result.ok, true, `${kind}:${seed}:${result.stage}`);
    assert.equal(validateCastleProfileV7(result).ok, true);
    assert.ok(result.horizontal.solutionHash || result.horizontal.solution?.solutionHash);
    assert.ok(result.vertical.solutionHash || result.vertical.solution?.solutionHash);
    assert.ok(result.surface.mesh.stats.triangleCount > 0);
    assert.equal(result.surface.mesh.stats.degenerateTriangles, 0);
    assert.equal(result.sourceContract.field, result.sourceContract.collision);
  }
  const matrix = compileCastleProfileMatrix({ kind, seeds: Array.from({ length: 100 }, (_, index) => index + 1) });
  assert.equal(matrix.ok, true, `${kind}:100-seed`);
  assert.equal(matrix.seeds.length, 100);
}
const highlandThousand = compileCastleProfileMatrix({ kind: "highland", seeds: Array.from({ length: 1000 }, (_, index) => index + 1) });
assert.equal(highlandThousand.ok, true);
assert.equal(highlandThousand.seeds.length, 1000);

console.log("✅ V7 castle profile compiler: 2D WFC + 3D WFC + MC surface/source contract, three profiles × 100 seeds + highland × 1000 passed");
