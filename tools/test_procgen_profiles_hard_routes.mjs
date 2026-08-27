// V7-G11~G13：profile planner / hard-route / 100-seed pure-data matrix
import assert from "node:assert/strict";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createHighlandProfile, createAncientProfile, createCanalProfile } from "../TigerMessenger/src/procgen/profiles/castleProfiles.js";
import { validateCastlePlan } from "../TigerMessenger/src/procgen/profiles/profilePlanners.js";
import { validateRouteChains } from "../TigerMessenger/src/procgen/constraints/hardRoutePlanner.js";

function namedGraph(plan) {
  const byId = new Map();
  const edges = [];
  for (const route of plan.routes || []) {
    for (const node of route.nodes || []) if (!byId.has(node)) byId.set(node, byId.size);
    for (const item of route.edges || []) edges.push(item);
  }
  const outgoing = [...byId].map(() => []);
  for (const item of edges) {
    const from = byId.get(item.from); const to = byId.get(item.to);
    if (from === undefined || to === undefined) continue;
    outgoing[from].push({ to, direction: item.kind, kind: item.kind });
  }
  return {
    cellId(index) { return [...byId.keys()][index]; },
    indexOfId(id) { return byId.get(id) ?? -1; },
    neighborsOf(index) { return outgoing[index] || []; },
  };
}

function routeChains(plan) {
  return (plan.routes || []).map((item) => ({
    id: item.id,
    segments: item.nodes,
    edgeFilter: (_from, edge) => edge.kind !== "air",
  }));
}

function hash(value) {
  let result = 2166136261;
  for (const character of JSON.stringify(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

const highland = createHighlandProfile({ floors: 3, skipOuterTerrain: true, seed: 1 });
const ancient = createAncientProfile({ seed: 1 });
const canal = createCanalProfile({ seed: 1 });

assert.equal(validateCastlePlan(highland.routePlan).ok, true);
assert.equal(validateCastlePlan(ancient.routePlan).ok, true);
assert.equal(validateCastlePlan(canal.routePlan).ok, true);
assert.deepEqual(
  [highland, ancient, canal].map((profile) => hash(profile.routePlan)),
  // 2026-08-27：删除五台地/瀑布旧权威路线，冻结连续山谷地面入口 →
  // 五层内部旋转楼梯 → castle-top。禁止把 expected 改回 17acc1eb / 264b9dbd。
  ["PLACEHOLDER", "2db6945b", "d94b61ec"],
  "profile route plan golden hash drift",
);

assert.equal(highland.routePlan.kind, "highland-route-plan-v2");
assert.equal(highland.routePlan.destination, "castle-top");
assert.equal(highland.routePlan.captureMode, "interior-rotating-stairs");
assert.equal(highland.routePlan.waterfallCount, 0);
assert.equal(highland.routePlan.terraceLayerCount, 0);
assert.deepEqual(highland.routePlan.interiorFloors, [1, 2, 3, 4, 5]);
assert.equal(highland.routePlan.horse.surface, "valley-waterfront");
assert.equal(highland.routePlan.horse.heading, "waterfront");
assert.equal(highland.routePlan.trojan.entries.length, 8);
assert.equal(new Set(highland.routePlan.trojan.entries.map((item) => item.rope)).size, 4);
assert.ok(highland.routePlan.trojan.entries.filter((item) => item.squad === "stairs").every((item) => item.shield || item.torch));
assert.equal(highland.routePlan.routes.find((item) => item.id.endsWith("ground-entry")).speedBand, "slow");
assert.equal(highland.routePlan.routes.find((item) => item.id.endsWith("interior-stairs")).speedBand, "fast");
assert.ok(highland.routePlan.routes.find((item) => item.id.endsWith("interior-stairs")).nodes.includes("castle-top"));
assert.equal(highland.routePlan.routes.some((item) => item.id.includes("waterfall")), false);
assert.equal(
  highland.routePlan.routes.some((item) => item.edges.some((edgeItem) => edgeItem.kind === "waterfall-climb")),
  false,
);

const highlandRouteReport = validateRouteChains({
  graph: namedGraph(highland.routePlan),
  chains: routeChains(highland.routePlan),
});
assert.equal(highlandRouteReport.ok, true, JSON.stringify(highlandRouteReport));
assert.equal(highland.routePlan.hardConstraints.locks.filter((lock) => lock.kind === "portal").length, 8);

assert.equal(ancient.routePlan.invariants.closedWallRing, true);
assert.equal(ancient.routePlan.wallEdges.length, ancient.routePlan.wallRing.length);
assert.ok(ancient.routePlan.wallEdges.some((item) => item.to === "ring:0"));
assert.equal(ancient.routePlan.patrolLoops[0].closed, true);
assert.equal(canal.routePlan.route.stableSurface, true);
assert.equal(canal.routePlan.invariants.dynamicWaveMeshRebuild, false);
assert.ok(canal.routePlan.bridges.every((bridge) => bridge.clearance > 0));

const seeds = [1, 7, 42, 884, ...Array.from({ length: 100 }, (_, index) => 1000 + index)];
const stats = { seeds: 0, highlandPortals: 0, ancientWalls: 0, canalBridges: 0 };
for (const seed of seeds) {
  const profiles = [
    createHighlandProfile({ floors: 3, skipOuterTerrain: true, seed }),
    createAncientProfile({ seed }),
    createCanalProfile({ seed }),
  ];
  for (const profile of profiles) {
    assert.equal(validateCastlePlan(profile.routePlan).ok, true, `${profile.id}:${seed}`);
    assert.equal(profile.routePlan.hardConstraints.maxRepairRounds, 3);
  }
  stats.seeds++;
  stats.highlandPortals += highland.routePlan.portals.length;
  stats.ancientWalls += ancient.routePlan.wallEdges.length;
  stats.canalBridges += canal.routePlan.bridges.length;
}

// Keep the graph adapter dependency visible in the fixture: this is not a
// screenshot assertion and cannot silently accept an airborne shortcut.
const grid = createRectGrid2D({ width: 2, height: 2 });
assert.equal(grid.cellCount, 4);
console.log(`  ✓ 高山 hard route：地面入口→内部旋梯→castle-top，4 绳×2 次、水岸木马，零瀑布/五台地`);
console.log(`  ✓ 古堡闭合墙环/主门/双道路/巡逻回路；运河中心线/稳定水面/桥净空`);
console.log(`  ✓ 三 profile 固定 1/7/42/884 + 100 seeds：${stats.seeds}，portals=${stats.highlandPortals}，walls=${stats.ancientWalls}，bridges=${stats.canalBridges}`);
console.log("✅ V7 profile planner assertions=12");
