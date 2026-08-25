import assert from "node:assert/strict";
import { createProcgenJob, validateProcgenJob, createProgressResult } from "../TigerMessenger/src/procgen/worker/jobProtocol.js";
import { createPlanetCompileHost } from "../TigerMessenger/src/procgen/worker/compileWorker.js";
import { createResourceRegistry } from "../TigerMessenger/src/core/resourceRegistry.js";

const job = createProcgenJob({ id: "job-1", type: "planet", seed: 7, dirty: ["chart:1"], schemaVersions: { graph: 2 } });
assert.equal(validateProcgenJob(job).ok, true);
assert.equal(job.schemaVersions.graph, 2);
assert.deepEqual(job.dirty, ["chart:1"]);
assert.equal(createProgressResult(job, "MC", 0.5).progress, 0.5);

const phases = [];
const host = createPlanetCompileHost({ budgetMs: 1 });
const response = await host.compile({ subdivision: 1, chartLimit: 1, resolution: 8 }, { id: "planet-test", seed: 7, onProgress: (message) => phases.push(message.phase) });
assert.equal(response.ok, true, response.payload?.report);
assert.ok(phases.includes("graph") && phases.includes("MC") && phases.includes("complete"));
host.dispose();

const cancelledPhases = [];
const cancellingHost = createPlanetCompileHost({ budgetMs: 1 });
const cancelled = await cancellingHost.compile({ subdivision: 1, chartLimit: 1, resolution: 8 }, {
  id: "planet-cancel-test",
  seed: 7,
  onProgress: (message) => {
    cancelledPhases.push(message.phase);
    if (message.phase === "graph") cancellingHost.cancel("planet-cancel-test");
  },
});
assert.equal(cancelled.ok, false);
assert.equal(cancelled.error?.code, "cancelled");
assert.deepEqual(cancelledPhases, ["graph"]);
cancellingHost.dispose();

let disposed = 0;
const registry = createResourceRegistry();
registry.retain("geometry", "a", () => ({ dispose: () => { disposed++; } }));
registry.retain("geometry", "a", () => ({ dispose: () => { disposed++; } }));
registry.replace("geometry", "a", () => ({ dispose: () => { disposed++; } }));
registry.disposeAll();
assert.equal(registry.size(), 0);
assert.equal(disposed, 2);
console.log(`✅ Planet V8 worker/resource: cooperative phases=${phases.length}, old resources disposed=${disposed}`);
