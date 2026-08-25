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

/**
 * 高山圣城的不可变路线合同：
 * - 港口→高台走阶梯；
 * - 台面 2→1 走瀑布攀爬；
 * - 木马固定在 L1 waterfall basin，头朝 canal；
 * - 木马下降使用四根绳，每根两次，分为两组；
 * - 所有跨层边都是显式 surface portal，不允许 air edge。
 */
export function compileHighlandRoutePlan({ seed = 1, blueprint = null } = {}) {
  const terraces = [1, 2, 3, 4, 5];
  const stairPortals = [
    edge("terrace:5", "terrace:4", "stairs", { surface: "terrace-surface" }),
    edge("terrace:4", "terrace:3", "stairs", { surface: "terrace-surface" }),
    edge("terrace:3", "terrace:2", "stairs", { surface: "terrace-surface" }),
  ];
  const waterfallPortals = [
    edge("terrace:2", "terrace:1", "waterfall-climb", { surface: "waterfall-surface", direction: "downhill" }),
  ];
  const stairRoute = route(
    "highland:stairs-patrol",
    ["harbor", "terrace:5", "terrace:4", "terrace:3"],
    [
      edge("harbor", "terrace:5", "stairs", { portal: "stairs:harbor-5" }),
      ...stairPortals.slice(0, 2),
    ],
    { patrolTerraces: [5, 4, 3], mode: "surface-run", speedBand: "slow" },
  );
  const waterfallRoute = route(
    "highland:waterfall-patrol",
    ["terrace:2", "terrace:1"],
    waterfallPortals,
    { patrolTerraces: [2, 1], mode: "surface-climb", speedBand: "fast" },
  );
  const retreatRoute = route(
    "highland:defender-retreat",
    ["terrace:3", "terrace:4", "terrace:5", "harbor"],
    [
      edge("terrace:3", "terrace:4", "stairs", { reverseOf: "stairs:4->3" }),
      edge("terrace:4", "terrace:5", "stairs", { reverseOf: "stairs:5->4" }),
      edge("terrace:5", "harbor", "stairs", { portal: "stairs:harbor-5" }),
    ],
    { mode: "surface-run", side: "defender" },
  );
  const horse = {
    id: "wood-horse",
    surface: "lower-waterfall-basin",
    terrace: 1,
    heading: "canal",
    keepout: { kind: "clearance", id: "wood-horse:keepout", value: 3.2, repairRadius: 2 },
  };
  const anchors = [
    { id: "harbor", kind: "cell", cell: "harbor", variant: "harbor" },
    { id: "waterfall-1", kind: "cell", cell: "waterfall-1", variant: "waterfall", repairRadius: 2 },
    { id: "wood-horse", kind: "cell", cell: "horse:l1-basin", variant: "horse", repairRadius: 2 },
    { id: "wood-horse:heading", kind: "visibility", landmark: "canal", value: "canal", repairRadius: 2 },
    horse.keepout,
  ];
  const portals = [...stairPortals, ...waterfallPortals, edge("harbor", "terrace:5", "stairs", { portal: "stairs:harbor-5" })];
  const hardConstraints = compileHardRouteLocks({
    anchors,
    routes: [
      { id: stairRoute.id, portals: stairRoute.edges },
      { id: waterfallRoute.id, portals: waterfallRoute.edges },
      { id: retreatRoute.id, portals: retreatRoute.edges },
    ],
    maxRepairRounds: 3,
  });
  const soldiers = makeTrojanWave(TROJAN_RULES);
  const plan = {
    kind: "highland-route-plan-v1",
    seed,
    blueprintHash: blueprint?.blueprintHash || null,
    terraces,
    anchorIds: anchors.map((item) => item.id),
    portals,
    routes: [stairRoute, waterfallRoute, retreatRoute],
    horse,
    trojan: {
      ropes: TROJAN_RULES.ropes,
      dropsPerRope: TROJAN_RULES.dropsPerRope,
      squads: TROJAN_RULES.squads,
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
      crossTerraceKinds: ["stairs", "waterfall-climb", "ladder"],
      offSurfaceEdgeKinds: ["air"],
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
  if (plan?.kind === "highland-route-plan-v1") {
    if (plan.terraces?.join(",") !== "1,2,3,4,5") errors.push("terrace-order");
    if (plan.horse?.surface !== "lower-waterfall-basin" || plan.horse?.heading !== "canal") errors.push("horse-anchor");
    if (plan.trojan?.ropes !== 4 || plan.trojan?.dropsPerRope !== 2 || plan.trojan?.entries?.length !== 8) errors.push("trojan-rope-contract");
    if (plan.routes?.some((route) => route.edges.some((item) => !["stairs", "waterfall-climb", "surface"].includes(item.kind)))) errors.push("illegal-cross-terrace-edge");
  }
  if (plan?.kind === "ancient-fortress-plan-v1" && !plan.invariants?.closedWallRing) errors.push("wall-ring-open");
  if (plan?.kind === "canal-citadel-plan-v1" && !plan.invariants?.waterOwnedByPlanner) errors.push("canal-not-planner-owned");
  return { ok: errors.length === 0, errors };
}
