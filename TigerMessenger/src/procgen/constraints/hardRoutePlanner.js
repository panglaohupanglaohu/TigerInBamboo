// =====================================================================
// HardRoutePlanner — V7-G6/V8 route contract
//
// WFC 负责候选模块的局部相容；本模块负责玩法锚点、门/楼梯/瀑布/港口/
// 木马等不可被随机改写的约束，以及有限轮次的局部修复。它只处理稳定
// 数据，不依赖 Three.js/DOM，因此可在 Node、Worker 和浏览器 debug 层复用。
// =====================================================================

import {
  validateConnectivity,
  validateWaterContinuity,
} from "./validators.js";

export const HARD_ROUTE_KINDS = Object.freeze([
  "cell", "edge", "portal", "clearance", "height", "water", "visibility",
]);

const ROUTE_ANCHOR_KINDS = Object.freeze([
  "door", "road", "stairs", "waterfall", "canal", "harbor", "horse", "boat", "gate", "route",
]);

function finiteNumber(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function clone(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function hash(value) {
  let h = 2166136261;
  for (const char of stableJson(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function repairRadius(issue, fallback = 1) {
  return Math.max(0, Math.ceil(Number(issue?.repairRadius ?? fallback) || fallback));
}

function issue(code, data = {}, radius = 1) {
  return { code, ...data, repairRadius: repairRadius(data, radius) };
}

function unique(values) {
  return [...new Set(values)];
}

/**
 * 校验并冻结一组通用 hard constraints。
 * cell/edge/portal 是离散约束，其余三类保存数值/可见性契约，交给对应 validator。
 */
export function createHardConstraintSchema({ locks = [], maxRepairRounds = 3, version = 1 } = {}) {
  if (!Number.isInteger(maxRepairRounds) || maxRepairRounds < 0 || maxRepairRounds > 32) {
    throw new Error("maxRepairRounds must be an integer in [0,32]");
  }
  if (!Array.isArray(locks)) throw new Error("hard constraints locks must be an array");
  const errors = [];
  const normalized = locks.map((raw, index) => {
    const lock = raw && typeof raw === "object" ? { ...raw } : {};
    const kind = lock.kind || (lock.variant !== undefined ? "cell" : null);
    if (!HARD_ROUTE_KINDS.includes(kind)) errors.push(`locks[${index}].kind`);
    if (lock.id !== undefined && (typeof lock.id !== "string" || !lock.id)) errors.push(`locks[${index}].id`);
    if (kind === "cell" && lock.cell === undefined) errors.push(`locks[${index}].cell`);
    if (kind === "edge" && (!lock.from || !lock.to)) errors.push(`locks[${index}].edge-endpoints`);
    if (kind === "portal" && (!lock.from || !lock.to)) errors.push(`locks[${index}].portal-endpoints`);
    if (["clearance", "height"].includes(kind) && !Number.isFinite(lock.value ?? lock.min ?? lock.max)) {
      errors.push(`locks[${index}].${kind}-value`);
    }
    if (kind === "visibility" && lock.landmark === undefined && lock.camera === undefined) {
      errors.push(`locks[${index}].visibility-target`);
    }
    if (lock.repairRadius !== undefined && (!Number.isFinite(lock.repairRadius) || lock.repairRadius < 0)) {
      errors.push(`locks[${index}].repairRadius`);
    }
    return Object.freeze({
      ...lock,
      kind,
      id: lock.id || `${kind}:${index}`,
      repairRadius: repairRadius(lock),
    });
  });
  if (errors.length) throw new Error(`invalid hard constraints: ${errors.join(", ")}`);
  return Object.freeze({
    kind: "hard-constraint-schema",
    version,
    maxRepairRounds,
    locks: Object.freeze(normalized),
    hash: `locks:${hash({ version, maxRepairRounds, locks: normalized })}`,
  });
}

/**
 * 把 manifest/route anchor 转成 solver 前可消费的 cell locks，并保留 edge/portal
 * 及方向信息供导航 validator 使用。未知字段不会被静默丢弃。
 */
export function compileHardRouteLocks({ anchors = [], routes = [], maxRepairRounds = 3 } = {}) {
  if (!Array.isArray(anchors) || !Array.isArray(routes)) throw new Error("anchors/routes must be arrays");
  const locks = [];
  const add = (raw, source) => {
    if (!raw || typeof raw !== "object") throw new Error(`invalid hard route anchor from ${source}`);
    const kind = raw.kind || raw.type || (raw.variant !== undefined ? "cell" : null);
    if (kind && !HARD_ROUTE_KINDS.includes(kind) && !ROUTE_ANCHOR_KINDS.includes(kind)) {
      throw new Error(`unknown hard route kind: ${kind}`);
    }
    const normalizedKind = HARD_ROUTE_KINDS.includes(kind) ? kind : (raw.cell !== undefined ? "cell" : "portal");
    locks.push({
      ...raw,
      kind: normalizedKind,
      id: raw.id || `${source}:${locks.length}`,
      source,
      routeKind: ROUTE_ANCHOR_KINDS.includes(kind) ? kind : raw.routeKind || null,
      repairRadius: repairRadius(raw, normalizedKind === "visibility" ? 2 : 1),
    });
  };
  anchors.forEach((anchor, index) => {
    if (anchor?.hardLocks && typeof anchor.hardLocks === "object") {
      for (const [kind, values] of Object.entries(anchor.hardLocks)) {
        const list = Array.isArray(values) ? values : [values];
        list.forEach((value, valueIndex) => add({ ...(typeof value === "object" ? value : { value }), kind, id: `${anchor.id || index}:${kind}:${valueIndex}` }, `manifest:${anchor.id || index}`));
      }
    } else add(anchor, `anchor:${index}`);
  });
  routes.forEach((route, index) => {
    if (!route || typeof route !== "object") throw new Error(`invalid route:${index}`);
    if (Array.isArray(route.locks)) route.locks.forEach((lock) => add(lock, `route:${route.id || index}`));
    if (Array.isArray(route.portals)) route.portals.forEach((portal, portalIndex) => add({ ...portal, kind: "portal", id: portal.id || `${route.id || index}:portal:${portalIndex}` }, `route:${route.id || index}`));
  });
  return createHardConstraintSchema({ locks, maxRepairRounds });
}

/** 将 cell locks 转成 solver pins；非 cell 约束留给 validator。 */
export function solverPinsFromHardLocks(schema) {
  if (!schema || schema.kind !== "hard-constraint-schema") throw new Error("solverPinsFromHardLocks requires hard constraint schema");
  return schema.locks
    .filter((lock) => lock.kind === "cell" && lock.cell !== undefined && lock.variant !== undefined)
    .map((lock) => ({ cell: lock.cell, variant: lock.variant, source: lock.id }));
}

/** 门→道路→楼梯→台面的多段连通校验。 */
export function validateRouteChains({ graph, chains = [], edgeFilter = () => true } = {}) {
  const issues = [];
  const reports = [];
  for (const chain of chains) {
    if (!Array.isArray(chain?.segments) || chain.segments.length < 2) {
      issues.push(issue("invalid-route-chain", { route: chain?.id || null }, 1));
      continue;
    }
    const segmentReports = [];
    for (let index = 1; index < chain.segments.length; index++) {
      const from = chain.segments[index - 1];
      const to = chain.segments[index];
      const report = validateConnectivity({ graph, sources: [from], targets: [to], edgeFilter: chain.edgeFilter || edgeFilter });
      segmentReports.push(report);
      if (!report.ok) {
        issues.push(...report.issues.map((entry) => issue("route-segment-unreachable", {
          route: chain.id || null,
          segment: index - 1,
          from,
          target: entry.cell,
        }, chain.repairRadius ?? 1)));
      }
    }
    reports.push({ id: chain.id || `route:${reports.length}`, ok: segmentReports.every((entry) => entry.ok), segments: segmentReports });
  }
  return { ok: issues.length === 0, issues, reports };
}

/** 支撑不是只看一格：沿 D 方向追溯直到 foundation，检测断链和环。 */
export function validateLoadPaths({ graph, occupied = [], supportOf, foundationOf, belowDirection = "D", maxDepth = 256 } = {}) {
  const issues = [];
  for (const raw of occupied) {
    const start = typeof raw === "number" ? raw : graph.indexOfId(raw);
    if (start < 0) { issues.push(issue("unknown-occupied-cell", { cell: raw })); continue; }
    const seen = new Set();
    let current = start;
    let reachedFoundation = false;
    for (let depth = 0; depth <= maxDepth; depth++) {
      if (seen.has(current)) { issues.push(issue("support-cycle", { cell: graph.cellId(current), start: graph.cellId(start) }, depth)); break; }
      seen.add(current);
      if (typeof foundationOf === "function" && foundationOf(current, start)) { reachedFoundation = true; break; }
      const below = graph.neighborsOf(current).find((edge) => edge.direction === belowDirection);
      if (!below) {
        if (typeof supportOf !== "function" || !supportOf(current, null, start)) {
          issues.push(issue("support-path-broken", { cell: graph.cellId(current), start: graph.cellId(start), depth }, Math.max(1, depth)));
        }
        break;
      }
      if (typeof supportOf === "function" && !supportOf(below.to, current, start)) {
        issues.push(issue("support-path-insufficient", { cell: graph.cellId(current), below: graph.cellId(below.to), start: graph.cellId(start), depth }, Math.max(1, depth)));
        break;
      }
      current = below.to;
    }
    if (!reachedFoundation && typeof foundationOf === "function" && !issues.some((entry) => entry.start === graph.cellId(start))) {
      issues.push(issue("foundation-unreachable", { cell: graph.cellId(start) }, 1));
    }
  }
  return { ok: issues.length === 0, issues };
}

/** 屋顶覆盖、门窗开放面和净空统一检查。 */
export function validateOpeningsAndCoverage({ roofs = [], openings = [], coverageAt, openingAt, clearanceAt } = {}) {
  const issues = [];
  for (const roof of roofs) {
    const covered = typeof coverageAt === "function" ? coverageAt(roof) : roof.covered;
    if (covered !== true) issues.push(issue("roof-not-covered", { id: roof.id || null, cell: roof.cell }, roof.repairRadius ?? 1));
  }
  for (const opening of openings) {
    const open = typeof openingAt === "function" ? openingAt(opening) : opening.open;
    if (open !== true) issues.push(issue("opening-blocked", { id: opening.id || null, kind: opening.kind || "opening", cell: opening.cell }, opening.repairRadius ?? 1));
    if (opening.requiredClearance !== undefined) {
      const actual = typeof clearanceAt === "function" ? clearanceAt(opening) : opening.clearance;
      if (!Number.isFinite(actual) || actual < opening.requiredClearance) {
        issues.push(issue("opening-clearance", { id: opening.id || null, cell: opening.cell, required: opening.requiredClearance, actual }, opening.repairRadius ?? 1));
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/** 水路 continuity 之外再约束入口/出口、水平和坡度。 */
export function validateWaterRoute({ graph, waterCells = [], sources = [], sinks = [], elevations = null, maxSlope = Infinity, edgeFilter = () => true } = {}) {
  const continuity = validateWaterContinuity({ graph, waterCells, sources, edgeFilter });
  const issues = continuity.issues.map((entry) => issue(entry.code, entry, 1));
  const water = new Set(waterCells.map((cell) => typeof cell === "number" ? cell : graph.indexOfId(cell)).filter((cell) => cell >= 0));
  for (const sink of sinks) {
    const index = typeof sink === "number" ? sink : graph.indexOfId(sink);
    if (!water.has(index)) issues.push(issue("water-sink-outside", { cell: sink }, 1));
  }
  if (typeof elevations === "function") {
    for (const from of water) for (const edge of graph.neighborsOf(from)) {
      if (!water.has(edge.to) || !edgeFilter(from, edge)) continue;
      const slope = Math.abs(elevations(edge.to) - elevations(from));
      if (slope > maxSlope) issues.push(issue("water-slope", { from: graph.cellId(from), to: graph.cellId(edge.to), slope, maxSlope }, 1));
    }
  }
  return { ok: issues.length === 0, issues, continuity };
}

/** 固定镜头 keepout：塔/建筑投影不得吞掉关键 landmark。 */
export function validateVisibilityKeepouts({ camera, towers = [], landmarks = [], minSeparation = 0.05 } = {}) {
  if (!camera || typeof camera.project !== "function") throw new Error("visibility validator requires camera.project");
  const issues = [];
  for (const landmark of landmarks) {
    const projectedLandmark = camera.project(landmark.position || landmark.direction || landmark);
    for (const tower of towers) {
      const projectedTower = camera.project(tower.position);
      const distance = Math.hypot(projectedLandmark[0] - projectedTower[0], projectedLandmark[1] - projectedTower[1]);
      const radius = Number(tower.projectedRadius ?? tower.radius ?? 0);
      if (distance <= radius + minSeparation) {
        issues.push(issue("visibility-keepout", { landmark: landmark.id || null, tower: tower.id || null, distance, radius }, tower.repairRadius ?? 2));
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/** 战术公平：攻击路线至少两条、撤退至少一条、且不能含 air/off-surface。 */
export function validateTacticalRoutes({ graph, attackRoutes = [], retreatRoutes = [], offSurfaceEdges = 0, edgeFilter = () => true } = {}) {
  const issues = [];
  if (attackRoutes.length < 2) issues.push(issue("attack-route-count", { actual: attackRoutes.length, required: 2 }, 1));
  if (retreatRoutes.length < 1) issues.push(issue("retreat-route-count", { actual: retreatRoutes.length, required: 1 }, 1));
  if (offSurfaceEdges > 0) issues.push(issue("off-surface", { count: offSurfaceEdges }, 1));
  for (const route of [...attackRoutes, ...retreatRoutes]) {
    if (!route?.start || !route?.objective) { issues.push(issue("invalid-tactical-route", { route: route?.id || null }, 1)); continue; }
    const report = validateConnectivity({ graph, sources: [route.start], targets: [route.objective], edgeFilter: route.edgeFilter || edgeFilter });
    if (!report.ok) issues.push(...report.issues.map((entry) => issue("tactical-unreachable", { route: route.id || null, cell: entry.cell }, route.repairRadius ?? 1)));
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 在 dirty region 内有限次重求；每轮保留区域外现状作为 hard pins，并返回
 * 可复现的 failure snapshot，不会无限重启整张地图。
 */
export function repairLocalRegion({ current, dirtyCells = [], hardLocks = [], maxRepairRounds = 3, solve, validate, expandDirty, hashState = hash } = {}) {
  if (typeof solve !== "function" || typeof validate !== "function") throw new Error("repairLocalRegion requires solve and validate callbacks");
  if (!Number.isInteger(maxRepairRounds) || maxRepairRounds < 0 || maxRepairRounds > 32) throw new Error("maxRepairRounds must be an integer in [0,32]");
  const original = clone(current);
  const dirty = new Set(dirtyCells);
  const logs = [];
  const outsidePins = (state) => Object.entries(state?.assignmentByCellId || {}).filter(([cell]) => !dirty.has(cell)).map(([cell, variant]) => ({ cell, variant, source: "repair-outside" }));
  let state = current;
  for (let round = 0; round <= maxRepairRounds; round++) {
    const report = validate(state);
    if (report.ok) return { ok: true, state, rounds: round, logs, dirty: [...dirty].sort(), hash: hashState(state) };
    if (round === maxRepairRounds) break;
    const issueCells = (report.issues || []).map((entry) => entry.cell).filter((cell) => cell !== undefined);
    issueCells.forEach((cell) => dirty.add(cell));
    const nextDirty = typeof expandDirty === "function" ? expandDirty([...dirty].sort(), report.issues || [], round) : [...dirty].sort();
    nextDirty.forEach((cell) => dirty.add(cell));
    const started = Date.now();
    const next = solve({ round, dirtyCells: [...dirty].sort(), pins: [...hardLocks, ...outsidePins(state)], previous: state, issues: report.issues || [] });
    logs.push({ round, dirty: [...dirty].sort(), locks: hardLocks.map(clone), outsidePins: outsidePins(state), previousHash: hashState(state), resultHash: hashState(next), issueCodes: (report.issues || []).map((entry) => entry.code), durationMs: Date.now() - started });
    if (!next || next.ok === false) {
      return { ok: false, reason: "repair-solve-failed", rounds: round + 1, logs, dirty: [...dirty].sort(), failureSnapshot: { original, lastState: state, solver: next || null, issues: report.issues || [], hardLocks: hardLocks.map(clone), hash: hashState(state) } };
    }
    state = next.state ?? next;
  }
  const finalReport = validate(state);
  return { ok: false, reason: "repair-limit", rounds: maxRepairRounds, logs, dirty: [...dirty].sort(), failureSnapshot: { original, lastState: state, issues: finalReport.issues || [], hardLocks: hardLocks.map(clone), hash: hashState(state) } };
}

export function summarizeHardRouteFailure(report) {
  if (!report || report.ok) return null;
  return {
    reason: report.reason || "hard-route-failure",
    issueCodes: unique((report.issues || report.failureSnapshot?.issues || []).map((entry) => entry.code)),
    cells: unique((report.issues || report.failureSnapshot?.issues || []).map((entry) => entry.cell).filter(Boolean)),
    repairRadius: Math.max(0, ...(report.issues || report.failureSnapshot?.issues || []).map((entry) => repairRadius(entry, 1))),
    rounds: report.rounds ?? null,
    hash: report.failureSnapshot?.hash || null,
  };
}
