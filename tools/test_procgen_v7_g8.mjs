// V7-G8：256-case MC / indexed mesh / normals / semantic / seam
import assert from "node:assert/strict";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { createChunkField } from "../TigerMessenger/src/procgen/field/chunkField.js";
import { marchingCubes, MARCHING_CUBES_CASE_COUNT, MARCHING_CUBES_TABLE_SIZE } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { EDGE_TABLE, TRI_TABLE } from "../TigerMessenger/src/procgen/field/marchingCubesTables.js";
import { ambiguityDecision } from "../TigerMessenger/src/procgen/field/ambiguity.js";
import { validateChunkSeam } from "../TigerMessenger/src/procgen/field/seamValidator.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

assert.equal(EDGE_TABLE.length, MARCHING_CUBES_CASE_COUNT);
assert.equal(TRI_TABLE.length, 4096);
assert.equal(MARCHING_CUBES_TABLE_SIZE, 4096);
assert.equal(ambiguityDecision([-1, 1, -1, 1, -1, 1, -1, 1]).ambiguous, true);
ok("256 case edge table + 256×16 triangle table + ambiguity diagnostics");

{
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 15, sample: (p) => Math.hypot(...p) - 0.65 });
  const mesh = marchingCubes(field, { semanticAt: (_p, x, y, z) => (x + y + z) & 3 });
  assert.ok(mesh.stats.activeCells > 0);
  assert.ok(mesh.stats.triangleCount > 0);
  assert.ok(mesh.stats.edgeCacheSize < mesh.stats.triangleCount * 3);
  assert.equal(mesh.positions.length, mesh.normals.length);
  assert.equal(mesh.indices.length % 3, 0);
  assert.equal(mesh.semantics.length, mesh.positions.length / 3);
  assert.ok([...mesh.normals].every(Number.isFinite));
  assert.ok([...mesh.indices].every((index) => index < mesh.positions.length / 3));
  ok("MC：sphere 产生 indexed positions/indices/normals/semantic channel");
}

{
  const sample = (p) => Math.hypot(p[0] - 1, p[1] - 1, p[2] - 1) - 0.7;
  const left = createChunkField({ origin: [0, 0, 0], size: [1, 2, 2], resolution: 9, halo: 1, sample });
  const right = createChunkField({ origin: [1, 0, 0], size: [1, 2, 2], resolution: 9, halo: 1, sample });
  const core = (chunk) => ({ min: [chunk.halo, chunk.halo, chunk.halo], max: [chunk.halo + chunk.resolution.x - 1, chunk.halo + chunk.resolution.y - 1, chunk.halo + chunk.resolution.z - 1] });
  const a = marchingCubes(left.field, { cellRange: core(left) });
  const b = marchingCubes(right.field, { cellRange: core(right) });
  const seam = validateChunkSeam(a, b, { axis: 0, coordinate: 1, tolerance: 1e-4 });
  assert.equal(seam.ok, true, JSON.stringify(seam));
  ok("chunk halo：相邻块使用同一世界坐标采样，接缝顶点报告一致");
}

console.log(`✅ V7-G8 assertions=${passed}`);
