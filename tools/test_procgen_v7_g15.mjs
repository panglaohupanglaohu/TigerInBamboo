// V7-G15：Inspector 结构化报告
import assert from "node:assert/strict";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { createProcgenInspector, summarizeFailure } from "../TigerMessenger/src/procgen/inspector/procgenInspector.js";

const inspector = createProcgenInspector({ jobId: "i-1", profile: "canal-citadel", seed: 8 });
inspector.recordStage("wfc", { observations: 4 }, 1.2).recordStage("mc", { triangles: 12 }, 2.4).recordEvent("conflict", { cell: "v:0:0:0" });
inspector.recordWfcCell("v:0:0:0", { domainCount: 3, entropy: 1.1, variant: "tower@r0", orientation: "r0", locked: true, decisionLevel: 2, prototype: "tower", sockets: { U: "roof", D: "support" }, support: 2, clearance: 1 });
inspector.setFieldSlices({ x: 1, y: 2, z: 3, iso: 0, semantic: "rock", flow: [0, 1, 0], primitiveProvenance: "castle.foundation", dirtyChunks: ["chunk:0"] });
inspector.setOverlay("mc:case", { kind: "mc", caseIndex: 3, activeEdges: [0, 1], interpolation: [0.5], gradient: [0, 1, 0], ambiguous: true, degenerate: 0, seam: "ok" });
inspector.setWorkerStats({ queue: { pending: 1 }, jobVersion: 3, cancelled: 0, cacheHit: 0.75, phaseTime: { WFC: 1.2 }, mainApplyMs: 0.3, gpu: { drawCalls: 2 } });
const field = createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 2, sample: () => 1 });
const report = inspector.report({ solution: { ok: true, reason: "solved", solutionHash: "h", stats: { observations: 4 } }, field, mesh: { stats: { triangleCount: 12 }, normals: new Float32Array(3), semantics: null } });
assert.equal(report.version, 1);
assert.equal(report.stages.length, 2);
assert.equal(report.events[0].type, "conflict");
assert.equal(report.wfc.cells[0].domainCount, 3);
assert.equal(report.field.slices.flow[1], 1);
assert.equal(report.mesh.overlays[0].caseIndex, 3);
assert.equal(report.worker.cacheHit, 0.75);
assert.equal(JSON.parse(inspector.toJSON({ field })).jobId, "i-1");
assert.match(inspector.toSVG({ field }), /v:0:0:0/);
assert.match(inspector.toPNG(), /^data:image\/png;base64,/);
assert.equal(summarizeFailure({ ok: true }), null);
assert.equal(summarizeFailure({ ok: false, reason: "unsatisfiable", cell: "r:1:1", suggestedRelaxations: ["unlock"] }).cell, "r:1:1");
console.log("  ✓ inspector stage/event/field/mesh/failure report");
console.log("✅ V7-G15 assertions=1");
