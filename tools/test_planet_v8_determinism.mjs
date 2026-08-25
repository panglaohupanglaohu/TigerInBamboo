import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

function digest(value) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value.snapshot));
  for (const chart of value.charts) { hash.update(Buffer.from(chart.mesh.positions.buffer)); hash.update(Buffer.from(chart.mesh.indices.buffer)); hash.update(Buffer.from(chart.semantic.weights.buffer)); }
  return hash.digest("hex");
}
const runs = [1, 2, 3].map(() => compilePlanetV8({ seed: 884, subdivision: 1, chartLimit: 3, resolution: 10 }));
assert.ok(runs.every((run) => run.ok));
assert.equal(new Set(runs.map(digest)).size, 1);
assert.equal(new Set(runs.map((run) => run.snapshot.graph.landmarkHash)).size, 1);
console.log(`✅ Planet V8 deterministic snapshot: hash=${digest(runs[0]).slice(0, 16)} runs=3`);

