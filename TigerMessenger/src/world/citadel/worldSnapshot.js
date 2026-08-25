// =====================================================================
//  CitadelWorldSnapshot — 运行时单一真源（V6-G1）
//  纯数据，禁止 import Three.js。可见网格 / 碰撞 / 导航 / prop / 战斗投射
//  必须读同一份 snapshot；V6 外观配 legacy 高度是非法混合态。
// =====================================================================

import { compileCitadelV4 } from "./pipeline.js";
import { THEME, resolveBuildingTheme } from "./visualTheme.js";
import { hashHex } from "../../core/rng.js";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_LAYERS = Object.freeze([
  "mesh",
  "surface",
  "uv",
  "nav",
  "module",
  "prop",
  "semanticMaterial",
]);

export function normalizeSnapshotFlags(flags = {}) {
  return Object.freeze({
    town: flags.town === true,
    uv: flags.uv === true,
    combat: flags.combat === true,
  });
}

/** visual 跟 town 网格；walk 跟 town 或显式 UV。禁止 visual=v6 且 walk=legacy。 */
export function snapshotSources(flags = {}) {
  const f = normalizeSnapshotFlags(flags);
  const visual = f.town ? "v6" : "legacy";
  const walk = f.town || f.uv ? "v6" : "legacy";
  const combat = f.combat ? "v6" : "legacy";
  return Object.freeze({ visual, walk, combat, nav: walk });
}

export function mixedStateDump(sources) {
  return {
    visual: sources.visual,
    walk: sources.walk,
    combat: sources.combat,
    nav: sources.nav,
    mixedVisualCollision: sources.visual === "v6" && sources.walk === "legacy",
  };
}

export function assertNoMixedSources(sources) {
  const dump = mixedStateDump(sources);
  if (dump.mixedVisualCollision) {
    throw new Error("mixed-state:v6-visual-legacy-collision");
  }
  return dump;
}

function countFamilies(cells) {
  const families = {};
  for (const cell of cells) {
    const family = cell.module?.family || "floor";
    families[family] = (families[family] || 0) + 1;
  }
  return families;
}

function meshLayer(town, flags) {
  const cells = town.cells || [];
  const ids = cells.map((c) => c.cellId);
  const families = countFamilies(cells);
  return {
    kind: flags.town ? "v4-box-cone" : "legacy-town-terrace",
    cellCount: cells.length,
    roofCount: families.roof || 0,
    families,
    cellIdHash: hashHex(ids.join(",")),
  };
}

function surfaceLayer(provider) {
  const all = provider.surfaces || [];
  const walkable = provider.walkable();
  return {
    count: all.length,
    walkable: walkable.length,
    idHash: hashHex(all.map((s) => s.id).join(",")),
  };
}

function uvLayer(uv) {
  return { stats: uv?.stats || {}, chartCount: uv?.charts?.length ?? uv?.stats?.charts ?? 0 };
}

function navLayer(graph) {
  const nodeIds = [...graph.nodes.keys()].sort();
  const edgeIds = [...graph.edges.keys()].sort();
  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
    nodeIdHash: hashHex(nodeIds.join(",")),
    edgeIdHash: hashHex(edgeIds.join(",")),
  };
}

function moduleLayer(town) {
  const cells = town.cells || [];
  const moduleIds = cells.map((c) => c.module?.id || "");
  return {
    cellCount: cells.length,
    fallback: town.fallbackCount ?? 0,
    gateLocks: town.gateLocks ?? 0,
    moduleIdHash: hashHex(moduleIds.join(",")),
  };
}

function propLayer(town) {
  if (town.props?.placed) {
    return {
      slots: (town.props.slots || []).map((s) => ({ id: s.id, kind: s.kind, cellId: s.cellId })),
      placed: town.props.placed.map((p) => ({ id: p.id, kind: p.kind, slotId: p.slotId })),
      note: town.props.note || "v6-g3-data",
    };
  }
  return { slots: [], placed: [], note: "no-props" };
}

function semanticMaterialLayer(town, seed) {
  const tokens = Object.keys(THEME).sort();
  const sample = (town.cells || []).slice(0, 16).map((c) => {
    const th = resolveBuildingTheme(c.cellId, { seed });
    return `${c.cellId}:${th.wallMain}:${th.roof}:${th.trim}`;
  });
  return { tokens, sampleHash: hashHex(sample.join("|")), tokenCount: tokens.length };
}

export function snapshotFingerprint(layers, flags, seed) {
  return hashHex(
    JSON.stringify({
      v: SNAPSHOT_SCHEMA_VERSION,
      seed,
      flags,
      mesh: layers.mesh,
      surface: layers.surface,
      uv: layers.uv.stats,
      nav: { n: layers.nav.nodeCount, e: layers.nav.edgeCount, nh: layers.nav.nodeIdHash },
      module: layers.module,
      prop: layers.prop.slots.map((s) => s.id),
      mat: layers.semanticMaterial,
    })
  );
}

export function compileWorldSnapshot(blueprint, seed = 1, flags = {}, opts = {}) {
  if (!blueprint) throw new Error("snapshot.no-blueprint");
  const f = normalizeSnapshotFlags(flags);
  const sources = snapshotSources(f);
  assertNoMixedSources(sources);
  const compiled = opts.compiled || compileCitadelV4(blueprint, seed);
  const layers = Object.freeze({
    mesh: Object.freeze(meshLayer(compiled.town, f)),
    surface: Object.freeze(surfaceLayer(compiled.surfaces)),
    uv: Object.freeze(uvLayer(compiled.uv)),
    nav: Object.freeze(navLayer(compiled.graph)),
    module: Object.freeze(moduleLayer(compiled.town)),
    prop: Object.freeze(propLayer(compiled.town)),
    semanticMaterial: Object.freeze(semanticMaterialLayer(compiled.town, seed)),
  });
  const dirtyRegion = Array.isArray(opts.dirtyRegion) ? Object.freeze([...opts.dirtyRegion].sort()) : null;
  const snap = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    version: opts.version ?? 1,
    seed,
    hash: snapshotFingerprint(layers, f, seed),
    flags: f,
    sources,
    dirtyRegion,
    layers,
    compiled,
    surfaces: compiled.surfaces,
    uv: compiled.uv,
    graph: compiled.graph,
    town: compiled.town,
  };
  Object.freeze(snap);
  assertSnapshotConsistent(snap);
  return snap;
}

export function assertSnapshotConsistent(snap, need = SNAPSHOT_LAYERS) {
  if (!snap || snap.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error("snapshot.schema");
  if (!snap.hash || !snap.compiled) throw new Error("snapshot.hash");
  for (const k of need) {
    if (!snap.layers?.[k]) throw new Error(`snapshot.missing:${k}`);
  }
  if (snap.layers.mesh.cellCount !== snap.layers.module.cellCount) {
    throw new Error("snapshot.mesh-module-mismatch");
  }
  if (snap.layers.surface.walkable !== snap.layers.nav.nodeCount) {
    throw new Error("snapshot.surface-nav-mismatch");
  }
  if (snap.surfaces !== snap.compiled.surfaces) throw new Error("snapshot.surface-alias");
  if (snap.graph !== snap.compiled.graph) throw new Error("snapshot.nav-alias");
  if (snap.uv !== snap.compiled.uv) throw new Error("snapshot.uv-alias");
  if (snap.town !== snap.compiled.town) throw new Error("snapshot.module-alias");
  assertNoMixedSources(snap.sources);
  return true;
}

export function pathOnSnapshot(snapshot, a, b) {
  return snapshot.graph.findPath(a, b, snapshot.surfaces);
}

export function projectOnSnapshot(snapshot, pos) {
  return snapshot.surfaces.sample(pos) || snapshot.surfaces.nearest(pos);
}

export function propsOnSnapshot(snapshot) {
  return snapshot.layers.prop;
}

export function migrateOccupants(prev, next, occupants, dirtyIds = null) {
  const dirty = dirtyIds ? new Set(dirtyIds) : next.dirtyRegion ? new Set(next.dirtyRegion) : null;
  const provider = next.surfaces;
  return (occupants || []).map((o) => {
    const inDirty = dirty && (dirty.has(o.surfaceId) || dirty.has(o.cellId) || dirty.has(o.id));
    const surfaceGone = o.surfaceId && !provider.get(o.surfaceId);
    if (!inDirty && !surfaceGone && prev && o.snapshotVersion === next.version) return { ...o, ok: true };
    const hit = projectOnSnapshot(next, o.pos || { x: 0, y: 0, z: 0 });
    if (!hit) return { ...o, ok: false, snapshotVersion: next.version };
    return {
      ...o,
      ok: true,
      pos: { ...hit.point },
      surfaceId: hit.surfaceId,
      terraceId: hit.terraceId,
      snapshotVersion: next.version,
      migratedFrom: prev?.version ?? o.snapshotVersion ?? 0,
    };
  });
}

/** 场景图计数（不依赖 Three 类型，只看 name / visible / isLight）。 */
export function censusCitadelGraph(root) {
  const counts = {
    v4Town: 0,
    legacyTerraceVisible: 0,
    legacyTerraceHidden: 0,
    lights: 0,
    meshes: 0,
    mixedOverlay: 0,
  };
  function walk(o) {
    if (!o) return;
    if (o.name === "citadel-v4-town") counts.v4Town += 1;
    if (o.name === "citadel-mixed-state") counts.mixedOverlay += 1;
    if (typeof o.name === "string" && o.name.startsWith("town-terrace-")) {
      if (o.visible === false) counts.legacyTerraceHidden += 1;
      else counts.legacyTerraceVisible += 1;
    }
    if (o.isLight || o.userData?.isLight) counts.lights += 1;
    if (o.isMesh) counts.meshes += 1;
    const kids = o.children || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  }
  walk(root);
  return counts;
}

export function detectMixedState({ sources, census }) {
  const issues = [];
  if (sources.visual === "v6" && sources.walk === "legacy") issues.push("v6-visual-legacy-walk");
  if (sources.visual === "v6" && census && census.v4Town < 1) issues.push("v6-visual-missing-mesh");
  if (sources.visual === "legacy" && census && census.v4Town > 0) issues.push("legacy-visual-with-v4-mesh");
  if (sources.visual === "legacy" && census && census.legacyTerraceHidden > 0 && census.legacyTerraceVisible === 0) {
    issues.push("legacy-visual-hidden-terraces");
  }
  return issues;
}

export function snapshotVisualOracle(snapshot, census = null) {
  return {
    hash: snapshot.hash,
    visual: snapshot.sources.visual,
    walk: snapshot.sources.walk,
    meshKind: snapshot.layers.mesh.kind,
    cells: snapshot.layers.mesh.cellCount,
    lights: census?.lights ?? null,
    v4Town: census?.v4Town ?? null,
    legacyVisible: census?.legacyTerraceVisible ?? null,
  };
}
