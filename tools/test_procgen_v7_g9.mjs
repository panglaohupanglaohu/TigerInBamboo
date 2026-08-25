// V7-G9：WFC 离散占用 → ScalarField → MC surface
import assert from "node:assert/strict";
import { createVoxelGrid3D } from "../TigerMessenger/src/procgen/graph/voxelGrid3d.js";
import { compileWfcSurface, occupancyToScalarField } from "../TigerMessenger/src/procgen/bridge/wfcFieldBridge.js";

const graph = createVoxelGrid3D({ width: 3, height: 2, depth: 3 });
const compiled = { variants: [{ key: "solid", protoId: "solid" }], variantIndex: new Map([["solid", 0]]) };
const assignment = new Int32Array(graph.cellCount).fill(0);
const result = { ok: true, assignment, solutionHash: "fixture-hash" };

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

{
  const field = occupancyToScalarField({ graph, assignment, compiled, padding: 1, semanticOf: ({ x, y, z }) => x + y + z });
  assert.equal(field.resolution.x, 6);
  assert.equal(field.resolution.y, 5);
  assert.ok(field.data.some((value) => value < 0));
  assert.ok(field.data.some((value) => value > 0));
  assert.equal(field.semantics.length, field.count);
  ok("WFC occupancy 投影为带 padding 的 ScalarField，并保留 semantic channel");
}

{
  const surface = compileWfcSurface({ graph, result, compiled, padding: 1, semanticOf: () => 7 });
  assert.equal(surface.ok, true);
  assert.equal(surface.solutionHash, "fixture-hash");
  assert.ok(surface.mesh.stats.triangleCount > 0);
  assert.ok(surface.mesh.semantics === null || [...surface.mesh.semantics].every((v) => v >= 0 && v <= 7));
  const failed = compileWfcSurface({ graph, result: { ok: false, reason: "unsatisfiable" }, compiled });
  assert.deepEqual(failed, { ok: false, reason: "unsatisfiable", solutionHash: null });
  ok("surface pipeline：只有 WFC 成功才生成 MC mesh，failure 保留 phase reason");
}

console.log(`✅ V7-G9 assertions=${passed}`);
