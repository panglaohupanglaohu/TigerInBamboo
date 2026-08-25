// V7-G5/G6：三维模型封装与硬约束/全局 validator
import assert from "node:assert/strict";
import { createVoxelGrid3D } from "../TigerMessenger/src/procgen/graph/voxelGrid3d.js";
import { createVoxelModuleModel, solveVoxelModel, validateVoxelAssignment, boundaryFaces } from "../TigerMessenger/src/procgen/wfc/voxelModel3d.js";
import { validateLockedCells, validateConnectivity, validateSupport, validateWaterContinuity, validateClearance, validateTacticalFairness, validateWorldSolution } from "../TigerMessenger/src/procgen/constraints/validators.js";

const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });
const proto = (id, below = null, support = 0) => ({
  id, family: "voxel-fixture", weight: 1, orientationGroup: "NONE",
  faces: { U: F("stack"), D: F("stack", { support }) },
  rules: below ? { requiresBelow: below } : {},
});

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

{
  const graph = createVoxelGrid3D({ width: 1, height: 2, depth: 1 });
  const model = createVoxelModuleModel({ prototypes: [proto("base"), proto("top", "base", 1)], graph });
  const result = solveVoxelModel({ model, seed: 4, pins: [{ cell: "v:0:0:0", variant: "base@r0" }] });
  assert.equal(result.ok, true, JSON.stringify(result));
  const check = validateVoxelAssignment(model, result);
  assert.equal(check.ok, true, JSON.stringify(check));
  assert.deepEqual(boundaryFaces(graph, 0), ["N", "E", "S", "W", "D"]);
  ok("Voxel Model：U/D 连接、requiresBelow、边界面和解后支撑校验");
}

{
  const graph = createVoxelGrid3D({ width: 3, height: 1, depth: 1 });
  const assignment = ["A", "B", "A"];
  assert.equal(validateLockedCells({ graph, assignment, locks: [{ cell: "v:1:0:0", variant: "B" }] }).ok, true);
  assert.equal(validateConnectivity({ graph, sources: ["v:0:0:0"], targets: ["v:2:0:0"] }).ok, true);
  assert.equal(validateSupport({ graph, occupied: ["v:1:0:0"], supportOf: () => true }).ok, false, "无 D 邻居不能伪造支撑");
  assert.equal(validateClearance({ graph, occupied: ["v:1:0:0"], clearanceAt: () => 3, required: 2 }).ok, true);
  ok("locked cell / connectivity / support / clearance validator");
}

{
  const graph = createVoxelGrid3D({ width: 4, height: 1, depth: 1 });
  const water = ["v:0:0:0", "v:1:0:0", "v:2:0:0"];
  assert.equal(validateWaterContinuity({ graph, waterCells: water, sources: ["v:0:0:0"] }).ok, true);
  assert.equal(validateWaterContinuity({ graph, waterCells: [...water, "v:3:0:0"], sources: ["v:0:0:0"], edgeFilter: (_a, e) => e.to !== 2 }).ok, false);
  assert.equal(validateTacticalFairness({ graph, teams: [{ start: "v:0:0:0", objective: "v:2:0:0" }, { start: "v:1:0:0", objective: "v:3:0:0" }] }).ok, true);
  const world = validateWorldSolution({ graph, assignment: [0, 0, 0, 0], locks: [], sources: ["v:0:0:0"], targets: ["v:3:0:0"], occupied: [], waterCells: [] });
  assert.equal(world.ok, true, JSON.stringify(world));
  ok("water continuity / tactical fairness / aggregate world validator");
}

console.log(`✅ V7-G5/G6 assertions=${passed}`);
