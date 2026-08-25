// V7-G6/V8 HardRoutePlanner：schema、hard locks、路线/支撑/水路/可见性及有限 repair。
import assert from "node:assert/strict";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createHardConstraintSchema, compileHardRouteLocks, solverPinsFromHardLocks, validateRouteChains, validateLoadPaths, validateOpeningsAndCoverage, validateWaterRoute, validateVisibilityKeepouts, validateTacticalRoutes, repairLocalRegion, summarizeHardRouteFailure } from "../TigerMessenger/src/procgen/constraints/hardRoutePlanner.js";

let passed = 0;
const ok = (message) => { passed++; console.log(`  ✓ ${message}`); };

{
  const schema = createHardConstraintSchema({
    maxRepairRounds: 2,
    locks: [
      { id: "gate", kind: "cell", cell: "r:0:0", variant: "gate@r0" },
      { id: "horse", kind: "visibility", landmark: "horse", repairRadius: 2 },
      { id: "stairs", kind: "portal", from: "r:0:0", to: "r:1:0" },
    ],
  });
  assert.equal(schema.kind, "hard-constraint-schema");
  assert.equal(schema.locks.length, 3);
  assert.deepEqual(solverPinsFromHardLocks(schema), [{ cell: "r:0:0", variant: "gate@r0", source: "gate" }]);
  assert.throws(() => createHardConstraintSchema({ locks: [{ kind: "cell" }] }), /invalid hard constraints/);
  const compiled = compileHardRouteLocks({ anchors: [{ id: "highland", hardLocks: { cell: [{ cell: "r:0:0", variant: "gate@r0" }], portal: [{ from: "r:0:0", to: "r:1:0" }] } }] });
  assert.equal(compiled.locks.length, 2);
  ok("hard constraint schema 与 manifest route locks 可编译为 solver pins");
}

{
  const graph = createRectGrid2D({ width: 4, height: 1 });
  const chain = validateRouteChains({ graph, chains: [{ id: "door-stairs-floor", segments: ["r:0:0", "r:1:0", "r:3:0"] }] });
  assert.equal(chain.ok, true, JSON.stringify(chain));
  const broken = validateRouteChains({ graph, chains: [{ id: "broken", segments: ["r:0:0", "r:99:0"] }] });
  assert.equal(broken.ok, false);
  assert.equal(broken.issues[0].repairRadius, 1);
  ok("门→道路→楼梯→台面连通 validator 输出 cell 与 repairRadius");
}

{
  const graph = createRectGrid2D({ width: 1, height: 3 });
  const supports = validateLoadPaths({
    graph,
    occupied: ["r:0:0"],
    belowDirection: "S",
    supportOf: (below) => below >= 0,
    foundationOf: (cell) => cell === 2,
  });
  assert.equal(supports.ok, true, JSON.stringify(supports));
  const broken = validateLoadPaths({ graph, occupied: ["r:0:0"], belowDirection: "S", supportOf: () => false, foundationOf: () => false });
  assert.equal(broken.ok, false);
  const openings = validateOpeningsAndCoverage({ roofs: [{ id: "roof", covered: true }], openings: [{ id: "door", open: true, requiredClearance: 2, clearance: 3 }] });
  assert.equal(openings.ok, true);
  ok("非悬挑模块完整追溯 foundation，门窗/屋顶/净空统一校验");
}

{
  const graph = createRectGrid2D({ width: 4, height: 1 });
  const water = validateWaterRoute({ graph, waterCells: ["r:0:0", "r:1:0", "r:2:0"], sources: ["r:0:0"], sinks: ["r:2:0"], elevations: (cell) => cell, maxSlope: 2 });
  assert.equal(water.ok, true, JSON.stringify(water));
  const tactical = validateTacticalRoutes({ graph, attackRoutes: [{ id: "a1", start: "r:0:0", objective: "r:2:0" }, { id: "a2", start: "r:1:0", objective: "r:3:0" }], retreatRoutes: [{ id: "r1", start: "r:2:0", objective: "r:0:0" }] });
  assert.equal(tactical.ok, true, JSON.stringify(tactical));
  const visible = validateVisibilityKeepouts({ camera: { project: (p) => [p[0], p[2]] }, landmarks: [{ id: "waterfall", position: [0, 0, 0] }], towers: [{ id: "tower", position: [2, 0, 0], projectedRadius: 0.5 }] });
  assert.equal(visible.ok, true);
  const blocked = validateVisibilityKeepouts({ camera: { project: (p) => [p[0], p[2]] }, landmarks: [{ id: "waterfall", position: [0, 0, 0] }], towers: [{ id: "tower", position: [0.1, 0, 0], projectedRadius: 0.5 }] });
  assert.equal(blocked.ok, false);
  ok("水路入口/出口/坡度、双进攻+撤退路线、镜头 keepout validator");
}

{
  const original = { ok: true, assignmentByCellId: { "r:0:0": "keep", "r:1:0": "old", "r:2:0": "keep" } };
  let calls = 0;
  const repaired = repairLocalRegion({
    current: original,
    dirtyCells: ["r:1:0"],
    hardLocks: [{ cell: "r:0:0", variant: "keep" }],
    maxRepairRounds: 2,
    validate: (state) => state.assignmentByCellId["r:1:0"] === "new" ? { ok: true, issues: [] } : { ok: false, issues: [{ code: "bad-cell", cell: "r:1:0", repairRadius: 1 }] },
    solve: ({ pins, round, previous }) => {
      calls++;
      assert.ok(pins.some((pin) => pin.cell === "r:0:0" && pin.variant === "keep"));
      assert.ok(pins.some((pin) => pin.cell === "r:2:0" && pin.variant === "keep"));
      return { ok: true, state: { ...previous, assignmentByCellId: { ...previous.assignmentByCellId, "r:1:0": round > 0 ? "new" : "still-old" } } };
    },
  });
  assert.equal(repaired.ok, true, JSON.stringify(repaired));
  assert.equal(calls, 2);
  const failed = repairLocalRegion({ current: original, dirtyCells: ["r:1:0"], maxRepairRounds: 1, validate: () => ({ ok: false, issues: [{ code: "bad", cell: "r:1:0", repairRadius: 3 }] }), solve: ({ previous }) => previous });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "repair-limit");
  assert.equal(summarizeHardRouteFailure(failed).repairRadius, 3);
  ok("局部 repair 有限轮次、区域外 pins 不变、失败返回 snapshot/日志");
}

console.log(`✅ HardRoutePlanner assertions=${passed}`);
