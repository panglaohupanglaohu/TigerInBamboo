// =====================================================================
//  V6-G8 算法可视化与工程证据 —— 调试层数据模型（纯逻辑半区）
//  五类共 20 层只读快照，每层输出 { id, version, hash, data }：
//  稳定 ID、JSON 可序列化；SVG/PNG 导出在 ./v6G8Export.js。
//  取数全部是只读接口：sources.wfc（v7 wave/trail/backtracker/result 或
//  v4 town solved）、sources.v4（compileCitadelV4 产物）、sources.agents、
//  sources.lighting { director, registry }、sources.ao { volume }。
//  取不到的字段一律 null 占位并在注释注明缺口，不伪造数据。
//  零开销契约：createG8DebugSession 默认关闭，关闭时 snapshot 直接返回 null，
//  不解引用任何输入——调试延迟不进入生产求解器/渲染路径。
//  纯逻辑，禁止 import Three.js / DOM。
// =====================================================================

import { hashHex } from "../../core/rng.js";
import { shannonEntropy } from "../../procgen/wfc/entropy.js";
import { hashVolume } from "../ao/voxelVolume.js";

export const V6_G8_LAYER_VERSION = 1;

export const V6_G8_LAYER_IDS = Object.freeze([
  // 1. WFC 求解
  "wfc-domain", "wfc-entropy", "wfc-propagation", "wfc-backtrack", "wfc-conflict",
  // 2. 模块 / variant / prop slot
  "module-family", "module-variant", "prop-slots", "clearance-occlusion",
  // 3. 地形
  "terrain-flow", "terrain-minima", "hard-route", "uv-seam", "texel-density",
  // 4. 表面 / 单位
  "nav-portal", "threat-map", "agent-intent",
  // 5. 光照
  "shadow-frustum", "ao-slice", "local-light-budget",
]);

// 快照条数上限：防止超大输入把 JSON 导出撑爆；截断时 total 保留真实总数
const CAP = Object.freeze({ flow: 2048, seam: 512, trail: 512, slots: 2048 });

// ---------------------------------------------------------------------
//  JSON 安全深拷贝：Map→按 key 排序的对象、Set→排序数组、
//  TypedArray→普通数组、非有限数（Infinity/NaN）→ null、函数→剔除。
//  只读：永不写回输入。
// ---------------------------------------------------------------------
export function jsonSafe(value) {
  if (value == null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (ArrayBuffer.isView(value)) return Array.from(value, (v) => (Number.isFinite(v) ? v : null));
  if (value instanceof Map) {
    const out = {};
    for (const k of [...value.keys()].sort()) out[String(k)] = jsonSafe(value.get(k));
    return out;
  }
  if (value instanceof Set) return [...value].sort().map(jsonSafe);
  if (Array.isArray(value)) return value.map((v) => jsonSafe(v) ?? null);
  const out = {};
  for (const k of Object.keys(value)) {
    const v = jsonSafe(value[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** canonical JSON（key 排序）→ 稳定 hash；同输入必同 hash */
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function layerHash(data) {
  return hashHex(canonical(jsonSafe(data)));
}

/** "cell:t:ix:iy:iz" → 网格坐标（SVG 布局用，导出层也复用） */
const CELL_RE = /cell:(\d+):(\d+):(\d+):(\d+)/;
export function cellXZ(id) {
  const m = CELL_RE.exec(id || "");
  return m ? { x: +m[2], y: +m[4] } : null;
}

/** 从 reason 解析传播 provenance（"neighbor-support:from=<cell>:dir=<d>"） */
const PROV_PREFIX = "neighbor-support:from=";
function parseProvenance(reason) {
  if (typeof reason !== "string" || !reason.startsWith(PROV_PREFIX)) return null;
  const sep = reason.lastIndexOf(":dir=");
  if (sep < PROV_PREFIX.length) return null;
  return { from: reason.slice(PROV_PREFIX.length, sep), dir: reason.slice(sep + 5) };
}

// =====================================================================
//  1. WFC 求解层
// =====================================================================

/** domain：每 cell 候选数 / 是否坍缩 / 是否空域。wave 优先，v4 solved.cells 兜底 */
function snapWfcDomain(src) {
  const w = src.wfc || {};
  let cells = null;
  if (w.wave) {
    const wave = w.wave;
    cells = [];
    for (let i = 0; i < wave.cellCount; i++) {
      const n = wave.count(i);
      cells.push({ id: wave.cellId(i), domainSize: n, collapsed: n === 1, contradiction: n === 0 });
    }
  } else if (w.solved?.cells) {
    cells = w.solved.cells.map((c) => ({
      id: c.cellId || c.id,
      domainSize: c.candidateCount ?? null,
      collapsed: (c.candidateCount ?? 1) <= 1,
      contradiction: c.contradiction === true,
    }));
  }
  const totals = cells
    ? { cellCount: cells.length, collapsed: cells.filter((c) => c.collapsed).length, contradiction: cells.filter((c) => c.contradiction).length }
    : null;
  return { cells, totals };
}

/** entropy：真实加权 Shannon 熵（复用 procgen/wfc/entropy.js）；已坍缩 = Infinity → null */
function snapWfcEntropy(src) {
  const wave = src.wfc?.wave;
  if (!wave) return { cells: null, min: null, max: null };
  const cells = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < wave.cellCount; i++) {
    const h = shannonEntropy(wave.count(i), wave.sumW[i], wave.sumWLogW[i]);
    const finite = Number.isFinite(h) ? h : null; // 坍缩/空域不参赛，序列化为 null
    if (finite != null) {
      min = Math.min(min, finite);
      max = Math.max(max, finite);
    }
    cells.push({ id: wave.cellId(i), domainSize: wave.count(i), entropy: finite });
  }
  return { cells, min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
}

/** 传播边：v7 trail 的 neighbor-support provenance 聚合 + v4 solved.log propagate 记录 */
function snapWfcPropagation(src) {
  const w = src.wfc || {};
  const edges = new Map(); // from|to|dir → 聚合计数
  let bans = 0;
  for (const rec of (w.trail?.records || []).slice(0, CAP.trail)) {
    const p = parseProvenance(rec.reason);
    if (!p) continue;
    bans++;
    const key = `${p.from}|${rec.cellId}|${p.dir}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  const v4LogEdges = (w.solved?.log || [])
    .filter((e) => e.type === "propagate")
    .slice(0, CAP.trail)
    .map((e) => ({ from: e.from, to: e.to, dir: e.dir, removed: (e.before ?? 0) - (e.after ?? 0) }));
  const stats = w.stats || w.result?.stats || null; // 显式 stats 优先（result 可能是另一次失败运行的）
  return {
    edges: [...edges.entries()].map(([k, count]) => {
      const [from, to, dir] = k.split("|");
      return { from, to, dir, bans: count };
    }),
    v4LogEdges,
    propagationBans: bans,
    stats: stats
      ? { bans: stats.bans ?? null, queuePushes: stats.queuePushes ?? null, peakQueue: stats.peakQueue ?? null, propagations: stats.propagations ?? null }
      : null,
  };
}

/** 回溯：backtracker 计数与历史 + v4 solved.log backtrack 记录 + 决策路径 */
function snapWfcBacktrack(src) {
  const w = src.wfc || {};
  const bt = w.backtracker || null;
  return {
    backtrackCount: bt ? bt.backtrackCount : null,
    maxBacktrack: bt ? bt.maxBacktrack : null,
    liveChoicePoints: bt ? bt.stack.length : null,
    // failedVariant 是 variant 下标：无 compiled variant 表可映射 key，保持原值不伪造
    history: bt
      ? bt.history.map((cp) => ({ cell: cp.cellId, failedVariant: cp.failedVariant, remainingCount: cp.remainingCount }))
      : null,
    v4Log: (w.solved?.log || []).filter((e) => e.type === "backtrack").slice(0, CAP.trail),
    decisionPath: w.result?.decisionPath ?? null,
  };
}

/** 冲突：conflictExplain 的结构化失败（近似最小冲突集 / ban 链 / 放宽建议） */
function snapWfcConflict(src) {
  const r = src.wfc?.result || null;
  if (!r) {
    return { ok: null, reason: null, cell: null, conflict: null, banReasons: null, suggestedRelaxations: null, decisionPath: null, solutionHash: null };
  }
  return {
    ok: r.ok ?? null,
    reason: r.reason ?? null,
    cell: r.cell ?? null,
    conflict: r.conflict ?? null,
    banReasons: r.banReasons ?? null,
    suggestedRelaxations: r.suggestedRelaxations ?? null,
    decisionPath: r.decisionPath ?? null,
    solutionHash: r.solutionHash ?? null,
  };
}

// =====================================================================
//  2. 模块 / variant / prop slot 层
// =====================================================================

const townCells = (src) => src.v4?.town?.cells || null;

/** module family 用量（真实统计自 town.cells，不用 catalog 名义空间凑数） */
function snapModuleFamily(src) {
  const cells = townCells(src);
  const counts = {};
  if (cells) {
    for (const c of cells) {
      const f = c.module?.family || "unknown";
      counts[f] = (counts[f] || 0) + 1;
    }
  }
  return {
    counts: cells ? counts : null,
    familyUsage: src.v4?.town?.props?.familyUsage ?? null,
    total: cells ? cells.length : null,
    fallback: src.v4?.town?.fallbackCount ?? null,
    gateLocks: src.v4?.town?.gateLocks ?? null,
  };
}

/** variant（module id）用量与求解原因分布（weighted / locked-route / explainable-fallback） */
function snapModuleVariant(src) {
  const cells = townCells(src);
  if (!cells) return { variants: null, reasons: null, catalogSize: null };
  const variants = {};
  const reasons = {};
  for (const c of cells) {
    const id = c.module?.id || "unknown";
    variants[id] = (variants[id] || 0) + 1;
    const r = c.reason || "unknown";
    reasons[r] = (reasons[r] || 0) + 1;
  }
  return { variants, reasons, catalogSize: src.v4?.catalog?.modules?.length ?? null };
}

/** prop slot：slot 与 placed 的对应（slotId 稳定 ID） */
function snapPropSlots(src) {
  const props = src.v4?.town?.props || null;
  if (!props?.slots) return { slots: null, totals: null };
  const placedBySlot = new Map((props.placed || []).map((p) => [p.slotId, p]));
  const slots = props.slots.slice(0, CAP.slots).map((s) => {
    const p = placedBySlot.get(s.id);
    return { id: s.id, kind: s.kind ?? null, cellId: s.cellId ?? null, placed: Boolean(p), propKind: p?.kind ?? null };
  });
  return {
    slots,
    totals: { slots: props.slots.length, placed: (props.placed || []).length, empty: slots.filter((s) => !s.placed).length },
  };
}

/** 净空 / 遮挡：propPlacement 的过滤条件（clearance≥0.18、occluded===false）。
 *  字段取自 clusterGeometry 产出的 slot；若上游缺字段则对应计数为 null 占位。 */
function snapClearanceOcclusion(src) {
  const slots = src.v4?.town?.props?.slots || null;
  if (!slots) return { slots: null, blockedByClearance: null, blockedByOcclusion: null, evaluated: null };
  let hasClearance = false;
  let hasOccluded = false;
  let blockedByClearance = 0;
  let blockedByOcclusion = 0;
  const rows = slots.slice(0, CAP.slots).map((s) => {
    if (s.clearance !== undefined) hasClearance = true;
    if (s.occluded !== undefined) hasOccluded = true;
    if (s.clearance !== undefined && s.clearance < 0.18) blockedByClearance++;
    if (s.occluded === true) blockedByOcclusion++;
    return { id: s.id, clearance: s.clearance ?? null, occluded: s.occluded ?? null };
  });
  return {
    slots: rows,
    blockedByClearance: hasClearance ? blockedByClearance : null,
    blockedByOcclusion: hasOccluded ? blockedByOcclusion : null,
    evaluated: hasClearance || hasOccluded,
  };
}

// =====================================================================
//  3. 地形层
// =====================================================================

const v4terrain = (src) => src.v4?.terrain || null;

/** terrain flow：排水向量场（flow Map join topo 顶点坐标）；截断时 total 为真实总数 */
function snapTerrainFlow(src) {
  const field = v4terrain(src)?.field;
  const mesh = src.v4?.topo?.halfEdge;
  if (!field?.flow || !mesh) return { vectors: null, total: null, outlets: null };
  const pos = new Map(mesh.vertices.map((v) => [v.id, v]));
  const entries = [...field.flow.entries()];
  const vectors = entries.slice(0, CAP.flow).map(([id, f]) => {
    const v = pos.get(id);
    return {
      id,
      x: v ? v.x : null,
      z: v ? v.z : null,
      dx: f.dx ?? 0,
      dz: f.dz ?? 0,
      outlet: f.outlet === true,
      height: field.height?.get?.(id) ?? null,
    };
  });
  return { vectors, total: entries.length, outlets: vectors.filter((v) => v.outlet).length };
}

/** local minima：无更低邻居且非出水口的顶点（从只读 height+邻接重算，不改 field）。
 *  邻接关系按 terrainGenerator 同一规则从 halfEdge 重建。 */
function snapTerrainMinima(src) {
  const field = v4terrain(src)?.field;
  const mesh = src.v4?.topo?.halfEdge;
  if (!field?.height || !mesh) return { localMinima: null, pools: null, lifted: null };
  const adj = new Map(mesh.vertices.map((v) => [v.id, new Set()]));
  for (const he of mesh.halfEdges) {
    const a = he.vertex;
    const b = mesh.halfEdges[he.next].vertex;
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  const localMinima = [];
  for (const v of mesh.vertices) {
    const h = field.height.get(v.id);
    if (h == null || field.flow?.get?.(v.id)?.outlet) continue; // 出水口是合法最低点
    let isMin = true;
    for (const nid of adj.get(v.id) || []) {
      if ((field.height.get(nid) ?? Infinity) < h) {
        isMin = false;
        break;
      }
    }
    if (isMin) localMinima.push(v.id);
  }
  const drainLog = (v4terrain(src)?.log || []).find((e) => e.pass === "solveDrainage") || null;
  return { localMinima: localMinima.sort(), pools: field.pools ?? null, lifted: drainLog?.lifted ?? null };
}

/** hard route：长窄有向结构先锁定 + 路线验证 log。
 *  缺口：materialize 不落 routeClearance/lockModuleId 原字段，
 *  以 semantic ∈ 锁定语义集 + reason==="locked-route" 重建（真实派生）。 */
const ROUTE_SEMANTICS = Object.freeze(["gate", "stairs-run", "road", "canal", "water-gate", "siege-route"]);
function snapHardRoute(src) {
  const cells = townCells(src);
  const validateLog = (v4terrain(src)?.log || []).find((e) => e.pass === "validatePlayableConnections") || null;
  return {
    routeCells: cells ? cells.filter((c) => ROUTE_SEMANTICS.includes(c.semantic)).map((c) => c.cellId || c.id) : null,
    lockedRoutes: cells ? cells.filter((c) => c.reason === "locked-route").map((c) => c.cellId || c.id) : null,
    validation: validateLog ? { ok: validateLog.ok ?? null, routes: validateLog.routes ?? null } : null,
  };
}

/** UV seam：同一顶点跨多个 chart 的角点（切线平行传输的缝合线证据） */
function snapUvSeam(src) {
  const uv = src.v4?.uv || null;
  if (!uv?.corners) return { seamVertices: null, total: null, nonFinite: null, flipped: null, chartCount: null };
  const byVertex = new Map();
  for (const c of uv.corners) {
    if (!byVertex.has(c.vertexId)) byVertex.set(c.vertexId, new Set());
    byVertex.get(c.vertexId).add(c.chartId);
  }
  const seams = [...byVertex.entries()].filter(([, charts]) => charts.size > 1);
  return {
    seamVertices: seams.slice(0, CAP.seam).map(([vertexId, charts]) => ({ vertexId, charts: [...charts].sort() })),
    total: seams.length,
    nonFinite: uv.stats?.nonFinite ?? null,
    flipped: uv.stats?.flipped ?? null,
    chartCount: uv.stats?.chartCount ?? null,
  };
}

/** texel density：编译器只导出均值/最大偏差；
 *  缺口：terrainUvCompiler 不导出每 chart 密度，perChart.density 为 null 占位。 */
function snapTexelDensity(src) {
  const uv = src.v4?.uv || null;
  return {
    mean: uv?.stats?.texelDensityMean ?? null,
    maxDev: uv?.stats?.texelDensityMaxDev ?? null,
    chartCount: uv?.stats?.chartCount ?? null,
    perChart: uv?.charts
      ? uv.charts.map((c) => ({ id: c.id, semantic: c.semantic ?? null, faceCount: c.faceCount ?? null, density: null }))
      : null,
  };
}

// =====================================================================
//  4. 表面 / 单位层
// =====================================================================

/** nav portal：表面图中非 walk 的跨层边（stairs / waterfall-climb），即导航门户 */
function snapNavPortal(src) {
  const graph = src.v4?.graph || null;
  if (!graph?.edges) return { portals: null, byType: null, nodeCount: null };
  const portals = [];
  const byType = {};
  for (const e of graph.edges.values()) {
    if (e.type === "walk") continue;
    byType[e.type] = (byType[e.type] || 0) + 1;
    portals.push({ id: e.id, a: e.a, b: e.b, type: e.type, width: e.width ?? null, capacity: e.capacity ?? null, danger: e.danger ?? null });
  }
  return { portals, byType, nodeCount: graph.nodes?.size ?? null };
}

/** 威胁图：按单位所在 surface 聚合 blackboard.localThreats（真实战斗黑板读数） */
function snapThreatMap(src) {
  const agents = src.agents || null;
  if (!agents) return { perSurface: null, totals: null };
  const per = new Map();
  let total = 0;
  let allyDown = 0;
  for (const a of agents) {
    const threats = a.blackboard?.localThreats || [];
    const sid = a.path?.currentSurfaceId ?? "unknown";
    if (!per.has(sid)) per.set(sid, { surfaceId: sid, agents: 0, threats: 0, minRange: null });
    const row = per.get(sid);
    row.agents++;
    row.threats += threats.length;
    total += threats.length;
    for (const t of threats) {
      if (t.allyDown) allyDown++;
      if (Number.isFinite(t.range)) row.minRange = row.minRange == null ? t.range : Math.min(row.minRange, t.range);
    }
  }
  return { perSurface: [...per.values()].sort((a, b) => (a.surfaceId < b.surfaceId ? -1 : 1)), totals: { threats: total, allyDown } };
}

/** 单位 intent / target / repath：
 *  缺口：combatResolver 不落显式 targetId、movementMotor 只累计 blockedT
 *  不记录 repath 原因，二者为 null 占位。 */
function snapAgentIntent(src) {
  const agents = src.agents || null;
  if (!agents) return { agents: null };
  return {
    agents: agents.map((a) => ({
      id: a.id,
      role: a.role ?? null,
      side: a.side ?? null,
      intent: a.intent?.name ?? null,
      intentScore: a.intent?.score ?? null,
      surfaceId: a.path?.currentSurfaceId ?? null,
      pathProgress: a.path ? { index: a.path.index ?? 0, length: (a.path.points || []).length } : null,
      blockedT: a.blockedT ?? null,
      repathAt: a.repathAt ?? null,
      targetId: null, // 缺口：攻击目标不落 agent 字段
      repathReason: null, // 缺口：repath 原因未被记录
    })),
  };
}

// =====================================================================
//  5. 光照层
// =====================================================================

/** shadow frustum：LightingDirector.getShadowDebugInfo() 只读快照 */
function snapShadowFrustum(src) {
  const info = src.lighting?.director?.getShadowDebugInfo?.() || null;
  if (!info) {
    return { mapSize: null, fit: null, lastFitReason: null, focusCount: null, camera: null, shadowType: null };
  }
  return {
    mapSize: info.mapSize ?? null,
    fit: info.fit ?? null, // { span, texel, near, far, center, sunDirection, reason }
    lastFitReason: info.lastFitReason ?? null,
    focusCount: info.focusCount ?? null,
    camera: info.camera ?? null, // ortho shadow camera bounds
    shadowType: info.shadowType ?? null,
  };
}

/** AO slice：体素 AO 的一个 z/y 切片（occupancy + ao 灰度只读拷贝），超大切片不下发 */
function snapAoSlice(src, opts = {}) {
  const vol = src.ao?.volume || null;
  if (!vol) return { dims: null, voxelSize: null, solidVoxels: null, volumeHash: null, slice: null };
  const [nx, ny, nz] = vol.dims;
  const axis = opts.aoAxis === "y" ? "y" : "z";
  const n = axis === "z" ? nz : ny;
  const index = Math.max(0, Math.min(n - 1, opts.aoIndex ?? Math.floor(n / 2)));
  let slice = null;
  const w = nx;
  const h = axis === "z" ? ny : nz;
  if (w * h <= 16384) {
    const ao = [];
    const occ = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = vol.index(i, axis === "z" ? j : index, axis === "z" ? index : j);
        ao.push(vol.ao[idx]);
        occ.push(vol.occupancy[idx]);
      }
    }
    slice = { axis, index, width: w, height: h, ao, occupancy: occ };
  }
  return {
    dims: [...vol.dims],
    voxelSize: vol.voxelSize ?? null,
    solidVoxels: vol.solidVoxels ?? null,
    volumeHash: hashVolume(vol),
    slice, // 超过 16384 体素时为 null（让调用方降采样后再取）
  };
}

/** local light budget：registry 登记表 + 预算内 active 选择（strip 不透明宿主引用 object） */
function snapLocalLightBudget(src, opts = {}) {
  const reg = src.lighting?.registry || null;
  if (!reg?.list) return { entries: null, budget: null, active: null, overBudget: null, debug: null };
  const entries = reg.list().map((e) => ({
    lightId: e.lightId,
    owner: e.owner,
    kind: e.kind,
    intensity: e.intensity,
    radius: e.radius,
    priority: e.priority,
    remainingLife: e.remainingLife,
    flicker: e.flicker === true,
    exception: e.exception === true,
    position: e.position ?? null,
    seed: e.seed ?? null,
  }));
  const budget = Number.isFinite(opts.lightBudget) ? opts.lightBudget : null;
  // 缺口：无相机参数时无法计算屏幕影响，active 为 null（不拿注册序冒充选择结果）
  const active =
    opts.camera && budget != null && reg.selectActive
      ? reg.selectActive(opts.camera, budget).map((e) => ({ lightId: e.lightId, score: e.score ?? null }))
      : null;
  const competing = entries.filter((e) => !e.exception && e.intensity > 0).length;
  return {
    entries,
    budget,
    active,
    overBudget: budget != null ? Math.max(0, competing - budget) : null,
    debug: reg.getDebugInfo?.() ?? null,
  };
}

// =====================================================================
//  快照装配
// =====================================================================

const LAYER_BUILDERS = Object.freeze({
  "wfc-domain": snapWfcDomain,
  "wfc-entropy": snapWfcEntropy,
  "wfc-propagation": snapWfcPropagation,
  "wfc-backtrack": snapWfcBacktrack,
  "wfc-conflict": snapWfcConflict,
  "module-family": snapModuleFamily,
  "module-variant": snapModuleVariant,
  "prop-slots": snapPropSlots,
  "clearance-occlusion": snapClearanceOcclusion,
  "terrain-flow": snapTerrainFlow,
  "terrain-minima": snapTerrainMinima,
  "hard-route": snapHardRoute,
  "uv-seam": snapUvSeam,
  "texel-density": snapTexelDensity,
  "nav-portal": snapNavPortal,
  "threat-map": snapThreatMap,
  "agent-intent": snapAgentIntent,
  "shadow-frustum": snapShadowFrustum,
  "ao-slice": snapAoSlice,
  "local-light-budget": snapLocalLightBudget,
});

/** 单层快照：{ id, version, hash, data }（冻结；data 已 jsonSafe） */
export function snapshotV6G8Layer(id, sources = {}, opts = {}) {
  const build = LAYER_BUILDERS[id];
  if (!build) throw new Error(`未知 V6-G8 调试层: ${id}`);
  const data = jsonSafe(build(sources, opts));
  return Object.freeze({ id, version: V6_G8_LAYER_VERSION, hash: layerHash(data), data });
}

/** 全部 20 层快照；layers 的 key 顺序 = V6_G8_LAYER_IDS */
export function snapshotV6G8Layers(sources = {}, opts = {}) {
  const layers = {};
  for (const id of V6_G8_LAYER_IDS) layers[id] = snapshotV6G8Layer(id, sources, opts);
  return { ids: V6_G8_LAYER_IDS, version: V6_G8_LAYER_VERSION, layers, hash: layerHash(layers) };
}

/**
 * 调试会话：生产路径零开销的唯一入口。
 * enabled=false（默认）时 snapshot 立即返回 null，不解引用 sources 的任何字段。
 */
export function createG8DebugSession({ enabled = false } = {}) {
  const on = enabled === true;
  return {
    enabled: on,
    snapshot(sources, opts) {
      if (!on) return null; // 关键：关闭时零计算，调试延迟不进生产路径
      return snapshotV6G8Layers(sources, opts);
    },
    snapshotLayer(id, sources, opts) {
      if (!on) return null;
      return snapshotV6G8Layer(id, sources, opts);
    },
  };
}
