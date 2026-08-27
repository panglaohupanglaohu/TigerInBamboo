// =====================================================================
// Castle profile planners — V7-G11~G13
//
// 这些 planner 只产生可序列化的结构约束，WFC/MC/Three 装配分别消费
// 它们。这样“不可随机改变的玩法路线”不会被错误地塞进建筑随机器，
// 也能在 Node/Worker 中做 seed 矩阵和失败解释。
// =====================================================================

import { compileHardRouteLocks } from "../constraints/hardRoutePlanner.js";
import { TROJAN_RULES, makeTrojanWave } from "../../agents/citadel/siegeDirector.js";

function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freezeDeep(item);
  return Object.freeze(value);
}

function edge(from, to, kind, extra = {}) {
  return { id: `${kind}:${from}->${to}`, from, to, kind, ...extra };
}

function route(id, nodes, edges, extra = {}) {
  return { id, nodes: [...nodes], edges: edges.map((item) => ({ ...item })), ...extra };
}

const HIGHLAND_LEGAL_EDGE_KINDS = Object.freeze(["surface", "stairs", "interior-rotating-stairs"]);
const HIGHLAND_INTERIOR_FLOORS = Object.freeze([1, 2, 3, 4, 5]);

/**
 * 高山圣城的不可变路线合同（PLAN 12.25 现役权威）：
 * - 连续山谷地面入口，不经五层室外台地、不经瀑布；
 * - 五层内部旋转楼梯接到 `castle-top`；
 * - 木马 keepout 钉在水岸，头朝水岸，不再占用 L1 waterfall basin；
 * - 木马下降仍是四绳×两次、两组；夜间走内部旋梯（ladderPolicy=disabled）；
 * - 所有跨层边都是显式 surface/stairs/interior-rotating-stairs portal，不允许 air / waterfall-climb。
 */
export function compileHighlandRoutePlan({ seed = 1, blueprint = null } = {}) {
  const interiorFloors = [...HIGHLAND_INTERIOR_FLOORS];
  const groundEntryPortals = [
    edge("valley-ground", "mountain-approach", "surface", { surface: "continuous-valley" }),
    edge("mountain-approach", "interior-entry", "stairs", { surface: "mountain-stair", portal: "stairs:ground-entry" }),
  ];
  const interiorPortals = interiorFloors.slice(1).map((floor, index) =>
    edge(
      `interior-floor:${interiorFloors[index]}`,
      `interior-floor:${floor}`,
      "interior-rotating-stairs",
      { surface: "interior-rotating-stairs", portal: `stairs:floor-${interiorFloors[index]}-${floor}` },
    )
  );
  interiorPortals.push(edge(
    "interior-floor:5",
    "castle-top",
    "interior-rotating-stairs",
    { surface: "interior-rotating-stairs", portal: "stairs:floor-5-castle-top" },
  ));
  const entryToFloor = edge(
    "interior-entry",
    "interior-floor:1",
    "interior-rotating-stairs",
    { surface: "interior-rotating-stairs", portal: "stairs:entry-floor-1" },
  );
  const groundEntryRoute = route(
    "highland:ground-entry",
    ["valley-ground", "mountain-approach", "interior-entry", "interior-floor:1"],
    [...groundEntryPortals, entryToFloor],
    { mode: "surface-run", speedBand: "slow", destination: "castle-top" },
  );
  const interiorRoute = route(
    "highland:interior-stairs",
    ["interior-entry", ...interiorFloors.map((floor) => `interior-floor:${floor}`), "castle-top"],
    [entryToFloor, ...interiorPortals],
    { patrolFloors: [...interiorFloors], mode: "interior-rotating-stairs", speedBand: "fast", destination: "castle-top" },
  );
  const retreatRoute = route(
    "highland:defender-retreat",
    ["castle-top", "interior-floor:5", "interior-floor:1", "interior-entry", "valley-ground"],
    [
      edge("castle-top", "interior-floor:5", "interior-rotating-stairs", { reverseOf: "stairs:floor-5-castle-top" }),
      edge("interior-floor:5", "interior-floor:1", "interior-rotating-stairs", { reverseOf: "stairs:floor-1-5" }),
      edge("interior-floor:1", "interior-entry", "interior-rotating-stairs", { reverseOf: "stairs:entry-floor-1" }),
      edge("interior-entry", "valley-ground", "stairs", { reverseOf: "stairs:ground-entry" }),
    ],
    { mode: "surface-run", side: "defender", destination: "valley-ground" },
  );
  const horse = {
    id: "wood-horse",
    surface: "valley-waterfront",
    heading: "waterfront",
    keepout: { kind: "clearance", id: "wood-horse:keepout", value: 3.2, repairRadius: 2 },
  };
  const anchors = [
    { id: "valley-ground", kind: "cell", cell: "valley-ground", variant: "ground-entry" },
    { id: "castle-top", kind: "cell", cell: "castle-top", variant: "capture-deck", repairRadius: 2 },
    { id: "wood-horse", kind: "cell", cell: "horse:waterfront", variant: "horse", repairRadius: 2 },
    { id: "wood-horse:heading", kind: "visibility", landmark: "waterfront", value: "waterfront", repairRadius: 2 },
    horse.keepout,
  ];
  const portals = [...groundEntryPortals, entryToFloor, ...interiorPortals];
  const hardConstraints = compileHardRouteLocks({
    anchors,
    routes: [
      { id: groundEntryRoute.id, portals: groundEntryRoute.edges },
      { id: interiorRoute.id, portals: interiorRoute.edges },
      { id: retreatRoute.id, portals: retreatRoute.edges },
    ],
    maxRepairRounds: 3,
  });
  const soldiers = makeTrojanWave(TROJAN_RULES);
  const plan = {
    kind: "highland-route-plan-v2",
    seed,
    blueprintHash: blueprint?.blueprintHash || null,
    destination: "castle-top",
    captureMode: "interior-rotating-stairs",
    ladderPolicy: "disabled",
    waterfallCount: 0,
    terraceLayerCount: 0,
    interiorFloors,
    anchorIds: anchors.map((item) => item.id),
    portals,
    routes: [groundEntryRoute, interiorRoute, retreatRoute],
    horse,
    trojan: {
      ropes: TROJAN_RULES.ropes,
      dropsPerRope: TROJAN_RULES.dropsPerRope,
      squads: TROJAN_RULES.squads,
      captureTarget: TROJAN_RULES.captureTarget,
      captureMode: TROJAN_RULES.captureMode,
      entries: soldiers.map((soldier) => ({
        id: soldier.id,
        rope: soldier.rope,
        drop: soldier.drop,
        squad: soldier.squad,
        role: soldier.role,
        shield: soldier.shield,
        torch: soldier.torch,
      })),
      returnAtDawn: TROJAN_RULES.returnAtDawn,
    },
    hardConstraints,
    routePolicy: {
      crossLayerKinds: [...HIGHLAND_LEGAL_EDGE_KINDS],
      offSurfaceEdgeKinds: ["air", "waterfall-climb", "terrace-transfer"],
      patrolDirection: "distributed-by-door",
    },
  };
  return freezeDeep(plan);
}

function ringEdges(ring, kind = "wall") {
  return ring.map((point, index) => edge(
    `ring:${index}`,
    `ring:${(index + 1) % ring.length}`,
    kind,
    { fromPoint: point.slice(), toPoint: ring[(index + 1) % ring.length].slice() },
  ));
}

/** 古堡：先锁结构骨架，再允许 WFC 填充墙体/塔/楼层。 */
export function compileAncientFortressPlan({ seed = 1, fixture } = {}) {
  if (!fixture?.wallRing?.length || !fixture?.gates?.length) throw new Error("ancient fortress requires wallRing and gates");
  const ring = fixture.wallRing.map((point) => point.slice());
  const walls = ringEdges(ring);
  const gateNodes = fixture.gates.map((gate, index) => ({ id: `gate:${index}`, ...clone(gate) }));
  const innerRoad = ["gate:0", "courtyard:0", "tower:0", "tower:1", "gate:0"];
  const outerRoad = ["gate:0", "ring:0", "ring:1", "ring:2", "ring:3", "gate:0"];
  const patrolLoops = (fixture.patrolLoops || []).map((points, index) => route(
    `ancient:patrol:${index}`,
    points.map((_, pointIndex) => `patrol:${index}:${pointIndex}`),
    points.map((_, pointIndex) => edge(
      `patrol:${index}:${pointIndex}`,
      `patrol:${index}:${(pointIndex + 1) % points.length}`,
      "surface",
    )),
    { closed: true, mode: "surface-patrol" },
  ));
  const damagePins = (fixture.damagePins || []).map((pin) => ({ ...clone(pin), version: pin.version || 1 }));
  const hardConstraints = compileHardRouteLocks({
    anchors: gateNodes.map((gate) => ({ id: gate.id, kind: "cell", cell: gate.id, variant: "gate" })),
    routes: [
      { id: "ancient:wall-ring", locks: walls.map((item) => ({ ...item, kind: "edge" })) },
      { id: "ancient:inner-road", portals: innerRoad.slice(1).map((node, index) => ({ from: innerRoad[index], to: node, kind: "portal" })) },
      { id: "ancient:outer-road", portals: outerRoad.slice(1).map((node, index) => ({ from: outerRoad[index], to: node, kind: "portal" })) },
    ],
  });
  return freezeDeep({
    kind: "ancient-fortress-plan-v1",
    seed,
    wallRing: ring,
    wallEdges: walls,
    gates: gateNodes,
    towers: clone(fixture.towers || []),
    roads: { inner: innerRoad, outer: outerRoad },
    patrolLoops,
    damagePins,
    hardConstraints,
    invariants: {
      closedWallRing: true,
      gateCount: gateNodes.length,
      patrolLoopCount: patrolLoops.length,
      damageUsesFieldSubtract: true,
      uniqueDefenseCannotBeRandomlyBroken: true,
    },
  });
}

/** 运河：中心线/水位/桥净空先于两岸 WFC；水面不是 MC 动画输入。 */
export function compileCanalCitadelPlan({ seed = 1, fixture } = {}) {
  if (!fixture?.canalCenterline?.length || !(fixture.width > 0)) throw new Error("canal fortress requires centerline and width");
  const centerline = fixture.canalCenterline.map((point) => point.slice());
  const bridges = (fixture.bridges || []).map((bridge, index) => ({
    id: bridge.id || `bridge:${index}`,
    at: bridge.at.slice(),
    clearance: Number(bridge.clearance),
    waterRoute: "canal:main",
  }));
  const routeNodes = centerline.map((_, index) => `water:${index}`);
  const waterEdges = routeNodes.slice(1).map((node, index) => edge(routeNodes[index], node, "water", { route: "canal:main" }));
  const hardConstraints = compileHardRouteLocks({
    anchors: [{ id: "canal:entry", kind: "cell", cell: routeNodes[0], variant: "water-entry" }, { id: "canal:exit", kind: "cell", cell: routeNodes.at(-1), variant: "water-exit" }],
    routes: [{ id: "canal:main", locks: waterEdges.map((item) => ({ ...item, kind: "edge" })) }],
  });
  return freezeDeep({
    kind: "canal-citadel-plan-v1",
    seed,
    centerline,
    width: fixture.width,
    waterLevel: fixture.waterLevel,
    route: { id: "canal:main", nodes: routeNodes, edges: waterEdges, closed: false, stableSurface: true },
    bridges,
    docks: clone(fixture.docks || []),
    locks: clone(fixture.locks || []),
    hardConstraints,
    invariants: {
      waterOwnedByPlanner: true,
      wfcFillsBanksOnly: true,
      mcCarvesBanksAndFoundations: true,
      dynamicWaveMeshRebuild: false,
      bridgeClearanceMin: Math.min(...bridges.map((bridge) => bridge.clearance), Infinity),
    },
  });
}

export function validateCastlePlan(plan) {
  const errors = [];
  if (!plan?.kind || !plan?.hardConstraints?.locks) errors.push("missing-plan-contract");
  const edgeKinds = (plan?.routes || []).flatMap((item) => item.edges || []).map((item) => item.kind);
  if (edgeKinds.includes("air")) errors.push("air-edge");
  if (plan?.kind === "highland-route-plan-v2" || plan?.kind === "highland-route-plan-v1") {
    if (plan.kind !== "highland-route-plan-v2") errors.push("retired-five-terrace-plan");
    if (plan.destination !== "castle-top") errors.push("destination");
    if (plan.interiorFloors?.join(",") !== HIGHLAND_INTERIOR_FLOORS.join(",")) errors.push("interior-floors");
    if (plan.waterfallCount !== 0 || plan.terraceLayerCount !== 0) errors.push("waterfall-or-terrace-not-retired");
    if (plan.horse?.surface !== "valley-waterfront" || plan.horse?.heading !== "waterfront") errors.push("horse-anchor");
    if (plan.trojan?.ropes !== 4 || plan.trojan?.dropsPerRope !== 2 || plan.trojan?.entries?.length !== 8) errors.push("trojan-rope-contract");
    if (plan.routes?.some((item) => item.edges.some((edgeItem) => !HIGHLAND_LEGAL_EDGE_KINDS.includes(edgeItem.kind)))) {
      errors.push("illegal-cross-layer-edge");
    }
    if (plan.routes?.some((item) => item.edges.some((edgeItem) => edgeItem.kind === "waterfall-climb"))) {
      errors.push("waterfall-climb-retired");
    }
    if (!plan.routes?.some((item) => item.id.endsWith("ground-entry"))) errors.push("missing-ground-entry");
    if (!plan.routes?.some((item) => item.id.endsWith("interior-stairs") && item.nodes?.includes("castle-top"))) {
      errors.push("missing-interior-castle-top");
    }
  }
  if (plan?.kind === "ancient-fortress-plan-v1" && !plan.invariants?.closedWallRing) errors.push("wall-ring-open");
  if (plan?.kind === "canal-citadel-plan-v1" && !plan.invariants?.waterOwnedByPlanner) errors.push("canal-not-planner-owned");
  return { ok: errors.length === 0, errors };
}
