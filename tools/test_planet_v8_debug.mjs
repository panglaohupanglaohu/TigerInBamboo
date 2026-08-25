import assert from "node:assert/strict";
import { createPlanetSnapshotCommitQueue } from "../TigerMessenger/src/world/planetV8/snapshotCommitV8.js";
import { createPlanetV8Inspector, PLANET_V8_DEBUG_LAYERS } from "../TigerMessenger/src/tools/planetV8Inspector.js";
import { createPlanetFailureManifest } from "../TigerMessenger/src/world/planetV8/failureExport.js";
import { createPlanetPerformanceOverlay } from "../TigerMessenger/src/world/planetV8/performanceOverlay.js";

const queue = createPlanetSnapshotCommitQueue({ validate: (snapshot) => ({ ok: snapshot?.version === 8, errors: snapshot?.version === 8 ? [] : ["version"] }) });
const old = { version: 8, id: "old" };
const next = { version: 8, id: "next" };
queue.enqueue(old); assert.equal(queue.flush().snapshot, old);
assert.equal(queue.enqueue({ version: 7 }).ok, false);
queue.enqueue(next); assert.equal(queue.current, old); assert.equal(queue.flush().snapshot, next);
const inspector = createPlanetV8Inspector(next); assert.equal(inspector.layers.length, PLANET_V8_DEBUG_LAYERS.length); assert.equal(inspector.toJSON().snapshotVersion, 8);
const failure = createPlanetFailureManifest({ runId: "x", seed: 7, stage: "MC", report: { reason: "seam" }, artifacts: [{ id: "slice", type: "svg" }] }); assert.equal(failure.artifacts[0].type, "svg");
const overlay = createPlanetPerformanceOverlay({ phases: [{ durationMs: 2 }, { durationMs: 8 }, { durationMs: 4 }], queue: { pending: 1 }, gpu: { mcTriangles: 10 }, cacheHit: 0.5 }); assert.equal(overlay.phaseP95, 8); assert.equal(overlay.mcTriangles, 10);
console.log(`✅ Planet V8 debug/commit: layers=${inspector.layers.length}, atomicSnapshot=${queue.current.id}, p95=${overlay.phaseP95}ms`);

