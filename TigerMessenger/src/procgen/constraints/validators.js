// =====================================================================
// Hard route / global validators（V7-G6）
// 生成器的“能解”不等于世界“可玩”：这里集中检查锁定单元、连通、支撑、
// 水路、净空和战术公平。所有函数可在 Node、Worker、Three 主线程复用。
// =====================================================================

function indexOf(graph, cell) {
  return typeof cell === "number" ? cell : graph.indexOfId(cell);
}

function bfs(graph, starts, edgeFilter = () => true) {
  const queue = [];
  const seen = new Set();
  for (const start of starts) {
    const i = indexOf(graph, start);
    if (i >= 0 && !seen.has(i)) { seen.add(i); queue.push(i); }
  }
  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.neighborsOf(current)) {
      if (!edgeFilter(current, edge) || seen.has(edge.to)) continue;
      seen.add(edge.to); queue.push(edge.to);
    }
  }
  return seen;
}

export function validateLockedCells({ graph, assignment, locks = [] } = {}) {
  const issues = [];
  for (const lock of locks) {
    const cell = indexOf(graph, lock.cell);
    if (cell < 0) { issues.push({ code: "unknown-locked-cell", cell: lock.cell }); continue; }
    const actual = assignment?.[cell];
    const expected = lock.variant ?? lock.value;
    if (expected !== undefined && actual !== expected && !(lock.allowed || []).includes(actual)) {
      issues.push({ code: "locked-cell-mismatch", cell: graph.cellId(cell), expected, actual });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateConnectivity({ graph, sources, targets, edgeFilter = () => true } = {}) {
  const reached = bfs(graph, sources || [], edgeFilter);
  const missing = (targets || []).filter((cell) => !reached.has(indexOf(graph, cell)));
  return { ok: missing.length === 0, issues: missing.map((cell) => ({ code: "unreachable", cell })), reachedCount: reached.size };
}

export function validateSupport({ graph, occupied = [], supportOf, belowDirection = "D" } = {}) {
  const issues = [];
  for (const raw of occupied) {
    const cell = indexOf(graph, raw);
    if (cell < 0) { issues.push({ code: "unknown-occupied-cell", cell: raw }); continue; }
    const below = graph.neighborsOf(cell).find((e) => e.direction === belowDirection);
    if (!below || typeof supportOf !== "function" || !supportOf(below.to, cell)) {
      issues.push({ code: "unsupported", cell: graph.cellId(cell), below: below ? graph.cellId(below.to) : null });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateWaterContinuity({ graph, waterCells = [], sources = [], edgeFilter = () => true } = {}) {
  const water = new Set(waterCells.map((cell) => indexOf(graph, cell)).filter((i) => i >= 0));
  const reached = bfs(graph, sources, (from, edge) => water.has(from) && water.has(edge.to) && edgeFilter(from, edge));
  const disconnected = [...water].filter((i) => !reached.has(i)).map((i) => graph.cellId(i));
  return { ok: disconnected.length === 0, issues: disconnected.map((cell) => ({ code: "water-disconnected", cell })), reachedCount: reached.size };
}

export function validateClearance({ graph, occupied = [], clearanceAt, required = 0 } = {}) {
  const issues = [];
  for (const raw of occupied) {
    const cell = indexOf(graph, raw);
    if (cell < 0) continue;
    const actual = clearanceAt?.(cell);
    if (!Number.isFinite(actual) || actual < required) issues.push({ code: "clearance", cell: graph.cellId(cell), required, actual });
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 语义 exclusion volume（V7-G5）：门洞 / 桥洞 / 楼梯体积 / 船净空。
 * 与 validateClearance 的通用数值校验不同，volume 是一组必须保持
 * "开放"语义的 cell 集合，逐 cell 判定占用是否合法。
 * @param {object} opts
 * @param {object} opts.graph 图适配器
 * @param {Array<{id:string, kind:"door-opening"|"bridge-arch"|"stair-volume"|"boat-clearance"|string,
 *   cells:Array<string|number>, allow:(variant, cellIndex:number)=>boolean}>} opts.volumes
 *   allow 返回 false 即违规（variant 为 null 表示 cell 未占用/未赋值）。
 * @param {(cellIndex:number)=>(object|null)} opts.variantAt cell → 占用 variant（或 null）
 */
export function validateExclusionVolumes({ graph, volumes = [], variantAt } = {}) {
  const issues = [];
  for (const volume of volumes) {
    if (!volume || !Array.isArray(volume.cells) || typeof volume.allow !== "function") {
      issues.push({ code: "invalid-exclusion-volume", volume: volume?.id ?? null });
      continue;
    }
    for (const raw of volume.cells) {
      const cell = indexOf(graph, raw);
      if (cell < 0) {
        issues.push({ code: "exclusion-volume-unknown-cell", volume: volume.id, kind: volume.kind, cell: raw });
        continue;
      }
      const variant = typeof variantAt === "function" ? variantAt(cell) : null;
      if (!volume.allow(variant, cell)) {
        issues.push({
          code: "exclusion-volume-violated",
          volume: volume.id,
          kind: volume.kind,
          cell: graph.cellId(cell),
          variant: variant?.key ?? null,
        });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

function shortestDistance(graph, source, target, edgeFilter = () => true) {
  const s = indexOf(graph, source); const t = indexOf(graph, target);
  if (s < 0 || t < 0) return Infinity;
  const distance = new Map([[s, 0]]); const queue = [s];
  while (queue.length) {
    const from = queue.shift();
    if (from === t) return distance.get(from);
    for (const edge of graph.neighborsOf(from)) if (edgeFilter(from, edge) && !distance.has(edge.to)) {
      distance.set(edge.to, distance.get(from) + 1); queue.push(edge.to);
    }
  }
  return Infinity;
}

export function validateTacticalFairness({ graph, teams = [], maxDistanceRatio = 2.5, edgeFilter = () => true } = {}) {
  const issues = [];
  if (teams.length >= 2) {
    const distances = teams.map((team) => shortestDistance(graph, team.start, team.objective, edgeFilter));
    const finite = distances.filter(Number.isFinite);
    const ratio = finite.length === distances.length ? Math.max(...distances) / Math.max(1, Math.min(...distances)) : Infinity;
    if (ratio > maxDistanceRatio) issues.push({ code: "tactical-imbalance", distances, ratio, maxDistanceRatio });
    if (finite.length !== distances.length) issues.push({ code: "tactical-unreachable", distances });
  }
  return { ok: issues.length === 0, issues };
}

export function validateWorldSolution(input = {}) {
  const checks = {
    locks: validateLockedCells(input),
    connectivity: validateConnectivity(input),
    support: validateSupport(input),
    water: validateWaterContinuity(input),
    clearance: validateClearance(input),
    tactical: validateTacticalFairness(input),
  };
  const issues = Object.values(checks).flatMap((check) => check.issues || []);
  return { ok: issues.length === 0, issues, checks };
}
