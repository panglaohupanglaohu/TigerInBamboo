// =====================================================================
//  Family builders：不规则 frame + sockets → 结构固体 / 语义面 / prop slot
//  纯数据，禁止 import Three.js。窗门用内凹 opening，不是深色贴片。
// =====================================================================

import { classifyFootprint, edgeUv, exposedDirs, frameToWorld } from "./moduleFrame.js";

let seq = 0;
function nid(p) {
  seq += 1;
  return `${p}:${seq}`;
}

function solid(partial) {
  return {
    id: partial.id || nid("s"),
    kind: partial.kind || "box",
    u0: partial.u0 ?? 0,
    u1: partial.u1 ?? 1,
    v0: partial.v0 ?? 0,
    v1: partial.v1 ?? 1,
    h0: partial.h0 ?? 0,
    h1: partial.h1 ?? 1,
    semantic: partial.semantic,
    material: partial.material,
    walkSurface: partial.walkSurface || null,
    inset: partial.inset || 0,
    opening: partial.opening || null,
    exposed: partial.exposed || null,
    variant: partial.variant || null,
    cutout: !!partial.cutout,
  };
}

function slot(kind, tags, extra = {}) {
  return {
    id: extra.id || nid("slot"),
    kind,
    tags: tags.slice(),
    u: extra.u ?? 0.5,
    v: extra.v ?? 0.5,
    h: extra.h ?? 0.5,
    dir: extra.dir || null,
    normal: extra.normal || { x: 0, y: 1, z: 0 },
    slope: extra.slope ?? 0,
    clearance: extra.clearance ?? 0.4,
    occluded: extra.occluded === true,
    cellId: extra.cellId || null,
    walkSurface: extra.walkSurface || null,
  };
}

function themeMat(theme, key) {
  if (key === "tile.accent") return theme.tileAccent || "#C89082";
  if (key === "roof") return theme.roof || "#C98778";
  if (key === "trim") return theme.trim || "#46545D";
  if (key === "window") return "#294452";
  return theme.wallMain || "#F2F4F4";
}

function pack(solids, slots, surfaces) {
  return { solids, slots, semanticSurfaces: surfaces };
}

function wallCore(theme, variant, h0 = 0, h1 = 1) {
  return solid({ semantic: "wall", material: themeMat(theme, "wall.main"), variant, h0, h1, u0: 0.04, u1: 0.96, v0: 0.04, v1: 0.96 });
}

function insetOpening(dir, opts) {
  const depth = opts.depth ?? 0.16;
  const uv = edgeUv(dir);
  const u0 = opts.u0 ?? 0.28;
  const u1 = opts.u1 ?? 0.72;
  const h0 = opts.h0 ?? 0.18;
  const h1 = opts.h1 ?? 0.78;
  const jamb = 0.06;
  const solids = [
    solid({
      kind: "inset-opening",
      semantic: opts.semantic || "window-opening",
      material: themeMat(opts.theme, "trim"),
      inset: depth,
      cutout: true,
      opening: { dir, u0, u1, h0, h1, depth },
      u0,
      u1,
      h0,
      h1,
      v0: uv.v0,
      v1: uv.v1,
    }),
    solid({ semantic: "jamb", material: themeMat(opts.theme, "trim"), u0: u0 - jamb, u1: u0, h0, h1, ...uv, inset: depth }),
    solid({ semantic: "jamb", material: themeMat(opts.theme, "trim"), u0: u1, u1: u1 + jamb, h0, h1, ...uv, inset: depth }),
    solid({ semantic: "jamb", material: themeMat(opts.theme, "trim"), u0, u1, h0: h1, h1: Math.min(1, h1 + jamb), ...uv, inset: depth }),
  ];
  if (opts.sill !== false) {
    solids.push(solid({ semantic: "sill", material: themeMat(opts.theme, "trim"), u0, u1, h0: Math.max(0, h0 - 0.05), h1: h0, ...uv, inset: depth }));
  }
  if (opts.glass) {
    solids.push(
      solid({
        kind: "slab",
        semantic: "window-glass",
        material: themeMat(opts.theme, "window"),
        inset: depth * 0.55,
        u0: u0 + 0.02,
        u1: u1 - 0.02,
        h0: h0 + 0.02,
        h1: h1 - 0.02,
        ...uv,
      })
    );
  }
  return solids;
}

function buildWall(ctx) {
  const { frame, theme, occupancy, variant } = ctx;
  const solids = [wallCore(theme, variant)];
  const slots = [];
  const surfaces = [{ semantic: "wall", id: "wall" }];
  for (const dir of exposedDirs(occupancy)) {
    solids.push(...insetOpening(dir, { theme, glass: true, semantic: "window-opening", depth: 0.14, h0: 0.38, h1: 0.72, u0: 0.32, u1: 0.68 }));
    slots.push(slot("facade", ["window", "lamp", "flag", "mailbox"], { dir, cellId: frame.cellId, u: 0.5, h: 0.55, slope: 0.05, clearance: 0.35 }));
  }
  if (!occupancy.U) {
    solids.push(solid({ kind: "slab", semantic: "cornice", material: themeMat(theme, "trim"), h0: 0.92, h1: 1, u0: 0, u1: 1, v0: 0, v1: 1 }));
    slots.push(slot("roof", ["pot", "chimney"], { h: 1.05, cellId: frame.cellId, slope: 0.08, clearance: 0.5 }));
  }
  return pack(solids, slots, surfaces);
}

function buildCornerConvex(ctx) {
  const out = buildWall(ctx);
  out.solids.push(solid({ semantic: "corner-convex", material: themeMat(ctx.theme, "trim"), u0: 0, u1: 0.12, v0: 0, v1: 0.12, h0: 0, h1: 1 }));
  out.semanticSurfaces.push({ semantic: "corner-convex" });
  return out;
}

function buildCornerConcave(ctx) {
  const out = buildWall(ctx);
  out.solids.push(solid({ semantic: "corner-concave", material: themeMat(ctx.theme, "wall.main"), u0: 0.08, u1: 0.5, v0: 0.08, v1: 0.5, h0: 0, h1: 1 }));
  out.semanticSurfaces.push({ semantic: "corner-concave" });
  return out;
}

function buildGable(ctx) {
  const out = buildWall(ctx);
  out.solids.push(solid({ kind: "wedge", semantic: "gable", material: themeMat(ctx.theme, "wall.main"), h0: 0.72, h1: 1.18, u0: 0, u1: 1, v0: 0.35, v1: 0.65 }));
  out.semanticSurfaces.push({ semantic: "gable" });
  return out;
}

function buildFloor(ctx) {
  const foot = classifyFootprint(ctx.occupancy, ctx.diagonals);
  if (foot === "convex") return buildCornerConvex(ctx);
  if (foot === "concave") return buildCornerConcave(ctx);
  if (ctx.variant === "tower") return buildTower(ctx);
  if (ctx.variant === "top-band" || ctx.variant === "cornice") return buildGable(ctx);
  return buildWall(ctx);
}

function buildFoundation(ctx) {
  const solids = [
    solid({ semantic: "foundation", material: themeMat(ctx.theme, "trim"), h0: -0.22, h1: 0.22, u0: -0.04, u1: 1.04, v0: -0.04, v1: 1.04 }),
    solid({ semantic: "waterside", material: themeMat(ctx.theme, "trim"), h0: -0.32, h1: 0.02, u0: 0, u1: 1, v0: -0.12, v1: 0.2, walkSurface: "stone" }),
  ];
  const slots = [slot("waterside", ["crate", "rope", "pot", "tree"], { v: -0.05, h: 0.05, cellId: ctx.frame.cellId, clearance: 0.45 })];
  return pack(solids, slots, [{ semantic: "foundation" }, { semantic: "waterside" }]);
}

function buildRoof(ctx) {
  const v = ctx.variant || "hip";
  const solids = [];
  const mat = themeMat(ctx.theme, "roof");
  if (v === "flat") {
    solids.push(solid({ kind: "slab", semantic: "roof-flat", material: mat, h0: 0.9, h1: 1.05, walkSurface: "stone" }));
  } else if (v === "gable") {
    solids.push(solid({ kind: "wedge", semantic: "roof-gable", material: mat, h0: 0.85, h1: 1.45, v0: 0.15, v1: 0.85 }));
    solids.push(solid({ kind: "wedge", semantic: "gable", material: themeMat(ctx.theme, "wall.main"), h0: 0.85, h1: 1.35, u0: 0, u1: 0.08 }));
  } else if (v === "dome") {
    solids.push(solid({ kind: "dome", semantic: "roof-dome", material: mat, h0: 0.88, h1: 1.55, u0: 0.15, u1: 0.85, v0: 0.15, v1: 0.85 }));
    solids.push(solid({ semantic: "tower-cap", material: mat, h0: 1.5, h1: 1.62, u0: 0.42, u1: 0.58, v0: 0.42, v1: 0.58 }));
  } else {
    solids.push(solid({ kind: "wedge", semantic: "roof-hip", material: mat, h0: 0.88, h1: 1.4, u0: 0.08, u1: 0.92, v0: 0.08, v1: 0.92 }));
  }
  const slots = [slot("roof", ["chimney", "pot", "flag"], { h: 1.2, cellId: ctx.frame.cellId, slope: v === "flat" ? 0.05 : 0.28, clearance: 0.4 })];
  return pack(solids, slots, solids.map((s) => ({ semantic: s.semantic })));
}

function buildTower(ctx) {
  const solids = [
    solid({ semantic: "wall", material: themeMat(ctx.theme, "wall.main"), h0: 0, h1: 1.35, u0: 0.12, u1: 0.88, v0: 0.12, v1: 0.88 }),
    solid({ kind: "dome", semantic: "tower-cap", material: themeMat(ctx.theme, "roof"), h0: 1.3, h1: 1.85, u0: 0.18, u1: 0.82, v0: 0.18, v1: 0.82 }),
  ];
  return pack(solids, [slot("roof", ["flag"], { h: 1.9, cellId: ctx.frame.cellId })], [{ semantic: "tower" }]);
}

function buildGate(ctx) {
  const solids = [
    solid({ semantic: "wall", material: themeMat(ctx.theme, "wall.main"), u0: 0, u1: 0.22, v0: 0.2, v1: 0.8, h0: 0, h1: 1 }),
    solid({ semantic: "wall", material: themeMat(ctx.theme, "wall.main"), u0: 0.78, u1: 1, v0: 0.2, v1: 0.8, h0: 0, h1: 1 }),
    solid({ semantic: "lintel", material: themeMat(ctx.theme, "trim"), u0: 0.18, u1: 0.82, v0: 0.25, v1: 0.75, h0: 0.78, h1: 1 }),
    ...insetOpening("S", { theme: ctx.theme, semantic: "door-opening", depth: 0.22, u0: 0.26, u1: 0.74, h0: 0, h1: 0.8, glass: false, sill: false }),
  ];
  solids.push(solid({ semantic: "drain", material: themeMat(ctx.theme, "trim"), u0: 0.02, u1: 0.1, v0: 0.9, v1: 1.05, h0: 0.7, h1: 0.78 }));
  const slots = [slot("doorway", ["lamp", "flag", "mailbox"], { dir: "S", u: 0.5, h: 0.55, cellId: ctx.frame.cellId, clearance: 0.5 })];
  return pack(solids, slots, [{ semantic: "gate" }, { semantic: "door-opening" }]);
}

function buildArch(ctx) {
  const solids = [
    solid({ semantic: "arch-post", material: themeMat(ctx.theme, "trim"), u0: 0.08, u1: 0.24, v0: 0.3, v1: 0.7, h0: 0, h1: 0.85 }),
    solid({ semantic: "arch-post", material: themeMat(ctx.theme, "trim"), u0: 0.76, u1: 0.92, v0: 0.3, v1: 0.7, h0: 0, h1: 0.85 }),
    solid({ kind: "wedge", semantic: "arch", material: themeMat(ctx.theme, "wall.main"), u0: 0.18, u1: 0.82, v0: 0.28, v1: 0.72, h0: 0.7, h1: 1.05 }),
    ...insetOpening("S", { theme: ctx.theme, semantic: "door-opening", depth: 0.2, u0: 0.28, u1: 0.72, h0: 0.02, h1: 0.72, glass: false, sill: false }),
  ];
  return pack(solids, [slot("doorway", ["lamp", "rope"], { dir: "S", cellId: ctx.frame.cellId })], [{ semantic: "arch" }]);
}

function buildBalcony(ctx) {
  const tile = themeMat(ctx.theme, "tile.accent");
  const dir = exposedDirs(ctx.occupancy)[0] || "S";
  const uv = edgeUv(dir);
  const solids = [
    solid({
      kind: "slab",
      semantic: "balcony-tile",
      material: tile,
      walkSurface: "flower-tile",
      u0: dir === "W" || dir === "E" ? uv.u0 - 0.12 : 0.08,
      u1: dir === "W" || dir === "E" ? uv.u1 + 0.12 : 0.92,
      v0: dir === "N" || dir === "S" ? (dir === "S" ? -0.28 : 0.92) : 0.08,
      v1: dir === "N" || dir === "S" ? (dir === "S" ? 0.12 : 1.28) : 0.92,
      h0: 0.08,
      h1: 0.16,
    }),
    solid({ semantic: "fence", material: themeMat(ctx.theme, "trim"), ...edgeAlong(dir, 0.18, 0.42), h0: 0.16, h1: 0.42 }),
  ];
  const slots = [
    slot("balcony", ["pot", "lamp"], { dir, cellId: ctx.frame.cellId, walkSurface: "flower-tile", slope: 0.04, clearance: 0.3 }),
  ];
  return pack(solids, slots, [{ semantic: "balcony-tile", walkSurface: "flower-tile" }]);
}

function edgeAlong(dir, pad0, pad1) {
  if (dir === "S") return { u0: 0.08, u1: 0.92, v0: -0.3, v1: -0.22 };
  if (dir === "N") return { u0: 0.08, u1: 0.92, v0: 1.22, v1: 1.3 };
  if (dir === "W") return { u0: -0.3, u1: -0.22, v0: 0.08, v1: 0.92 };
  return { u0: 1.22, u1: 1.3, v0: 0.08, v1: 0.92 };
}

function buildFence(ctx) {
  const solids = [];
  const slots = [];
  for (const dir of exposedDirs(ctx.occupancy)) {
    const e = edgeUv(dir);
    solids.push(solid({ semantic: "fence", material: themeMat(ctx.theme, "trim"), ...e, h0: 0.05, h1: 0.42, exposed: dir }));
    slots.push(slot("facade", ["lamp", "pot"], { dir, cellId: ctx.frame.cellId, h: 0.3 }));
  }
  if (!solids.length) solids.push(solid({ semantic: "fence", material: themeMat(ctx.theme, "trim"), h0: 0.05, h1: 0.4, v0: 0.9, v1: 1 }));
  return pack(solids, slots, [{ semantic: "fence" }]);
}

function buildStairs(ctx) {
  const solids = [];
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    solids.push(
      solid({
        kind: "slab",
        semantic: "stairs",
        material: themeMat(ctx.theme, "trim"),
        walkSurface: "stone",
        u0: 0.15,
        u1: 0.85,
        v0: t,
        v1: t + 0.28,
        h0: t * 0.85,
        h1: t * 0.85 + 0.12,
      })
    );
  }
  return pack(solids, [slot("stair", ["lamp", "pot"], { cellId: ctx.frame.cellId, slope: 0.35, clearance: 0.25 })], [{ semantic: "stairs", walkSurface: "stone" }]);
}

function buildSupport(ctx) {
  const posts = [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.12, 0.88],
    [0.88, 0.88],
  ];
  const solids = posts.map(([u, v]) =>
    solid({ kind: "post", semantic: "support", material: themeMat(ctx.theme, "trim"), u0: u - 0.06, u1: u + 0.06, v0: v - 0.06, v1: v + 0.06, h0: -0.1, h1: 1 })
  );
  solids.push(solid({ semantic: "drain", material: themeMat(ctx.theme, "trim"), u0: 0.45, u1: 0.55, v0: 0.92, v1: 1.08, h0: 0.15, h1: 0.22 }));
  return pack(solids, [slot("support", ["rope", "lamp"], { cellId: ctx.frame.cellId })], [{ semantic: "support" }]);
}

function buildBridge(ctx) {
  const solids = [
    solid({ kind: "slab", semantic: "bridge", material: themeMat(ctx.theme, "trim"), walkSurface: "stone", h0: 0.42, h1: 0.52, u0: -0.15, u1: 1.15, v0: 0.25, v1: 0.75 }),
    solid({ semantic: "fence", material: themeMat(ctx.theme, "trim"), h0: 0.52, h1: 0.78, u0: -0.15, u1: 1.15, v0: 0.22, v1: 0.28 }),
    solid({ semantic: "fence", material: themeMat(ctx.theme, "trim"), h0: 0.52, h1: 0.78, u0: -0.15, u1: 1.15, v0: 0.72, v1: 0.78 }),
  ];
  if (ctx.variant === "arch") {
    solids.push(solid({ kind: "wedge", semantic: "arch", material: themeMat(ctx.theme, "trim"), h0: 0.05, h1: 0.42, u0: 0.2, u1: 0.8, v0: 0.3, v1: 0.7 }));
  }
  return pack(solids, [slot("bridge", ["lamp", "flag", "rope"], { cellId: ctx.frame.cellId, h: 0.6 })], [{ semantic: "bridge", walkSurface: "stone" }]);
}

function buildDecor(ctx) {
  const v = ctx.variant || "window";
  if (v === "chimney") {
    return pack(
      [solid({ semantic: "chimney", material: themeMat(ctx.theme, "trim"), u0: 0.62, u1: 0.78, v0: 0.4, v1: 0.56, h0: 0.9, h1: 1.45 })],
      [slot("roof", ["flag"], { cellId: ctx.frame.cellId, h: 1.5 })],
      [{ semantic: "chimney" }]
    );
  }
  if (v === "lamp") {
    return pack(
      [solid({ kind: "post", semantic: "lamp", material: "#FFB347", u0: 0.46, u1: 0.54, v0: 0.82, v1: 0.9, h0: 0.4, h1: 0.72 })],
      [slot("facade", ["lamp"], { cellId: ctx.frame.cellId })],
      [{ semantic: "lamp" }]
    );
  }
  const dir = exposedDirs(ctx.occupancy)[0] || "E";
  const solids = insetOpening(dir, { theme: ctx.theme, glass: true, semantic: "window-opening", depth: 0.15 });
  return pack(solids, [slot("facade", ["window", "pot"], { dir, cellId: ctx.frame.cellId })], [{ semantic: "window-opening" }]);
}

export const FAMILY_BUILDERS = Object.freeze({
  floor: buildFloor,
  foundation: buildFoundation,
  fence: buildFence,
  balcony: buildBalcony,
  flowerTile: buildBalcony,
  stairs: buildStairs,
  support: buildSupport,
  hole: buildArch,
  gate: buildGate,
  roof: buildRoof,
  bridge: buildBridge,
  decor: buildDecor,
});

export const STRUCTURAL_SEMANTICS = Object.freeze([
  "foundation",
  "wall",
  "corner-convex",
  "corner-concave",
  "gable",
  "roof-hip",
  "roof-gable",
  "roof-dome",
  "roof-flat",
  "tower-cap",
  "arch",
  "door-opening",
  "window-opening",
  "waterside",
  "bridge",
  "stairs",
  "balcony-tile",
  "fence",
  "support",
  "chimney",
  "drain",
]);

export function buildResolvedModule(cell, solved, theme, frame) {
  const family = solved.module?.family || solved.family || "floor";
  const builder = FAMILY_BUILDERS[family] || FAMILY_BUILDERS.floor;
  const ctx = {
    frame,
    sockets: solved.sockets || solved.module?.sockets || {},
    theme,
    occupancy: cell.occupancy || frame.occupancy || {},
    diagonals: cell.diagonals || {},
    variant: solved.module?.role || solved.variant || "base",
    rot: solved.rot || "r0",
  };
  const structure = builder(ctx);
  const slots = emitPropSlots(structure, {
    facade: true,
    roof: true,
    balcony: true,
    doorway: true,
    waterside: true,
    stair: true,
    bridge: true,
    support: true,
  });
  for (const s of slots) s.cellId = s.cellId || frame.cellId;
  return { structure, slots, walkSurfaces: structure.semanticSurfaces };
}

export function emitPropSlots(structure, flags = {}) {
  const extra = [];
  const have = new Set((structure.slots || []).map((s) => s.kind));
  for (const s of structure.slots || []) extra.push(s);
  if (flags.facade && !have.has("facade")) extra.push(slot("facade", ["window", "lamp"]));
  return extra;
}

export function solidsWorldAABB(frame, s) {
  const a = frameToWorld(frame, s.u0, s.v0, s.h0);
  const b = frameToWorld(frame, s.u1, s.v1, s.h1);
  return { min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) }, max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) } };
}

export function resetBuilderIds() {
  seq = 0;
}
