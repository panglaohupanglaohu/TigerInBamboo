// =====================================================================
//  局部约束求解：domain → 最小熵 → 邻域传播 → 上限回溯（V6-G2）
//  纯数据，禁止 import Three.js。无解时解释冲突，禁止静默塞 floor/base。
// =====================================================================

import { hashHex } from "../../core/rng.js";

export const MAX_BACKTRACK = 32;
export const GOLDEN_SEEDS = Object.freeze([7, 1, 42, 884]);
export const DIRS = Object.freeze(["N", "E", "S", "W"]);
export const OPP = Object.freeze({ N: "S", S: "N", E: "W", W: "E", U: "D", D: "U" });
export const DELTA = Object.freeze({
  N: [0, 0, -1],
  S: [0, 0, 1],
  W: [-1, 0, 0],
  E: [1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
});
const CORRIDOR = new Set(["gate", "hole", "stairs"]);
const ASYM = new Set(["balcony", "flowerTile", "stairs", "hole", "gate", "bridge"]);

export function parseTownCellId(id) {
  const raw = String(id || "");
  const m = /^(?:cell:)?(\d+):(\d+):(\d+):(\d+)$/.exec(raw);
  if (!m) return null;
  return { t: +m[1], ix: +m[2], iy: +m[3], iz: +m[4], id: `cell:${m[1]}:${m[2]}:${m[3]}:${m[4]}` };
}

export function normalizeCellId(id) {
  return parseTownCellId(id)?.id || id;
}

export function rotateSockets(sock, rot = "r0") {
  const k = { r0: 0, r90: 1, r180: 2, r270: 3 }[rot] || 0;
  const out = { U: sock.U, D: sock.D };
  for (let i = 0; i < 4; i++) out[DIRS[(i + k) % 4]] = sock[DIRS[i]];
  return out;
}

export function mirrorSockets(sock) {
  return { ...sock, E: sock.W, W: sock.E };
}

export function uniqueTransforms(module) {
  const seen = new Set();
  const out = [];
  const push = (rot, mirror, sockets) => {
    const sig = `${sockets.N}${sockets.E}${sockets.S}${sockets.W}|${sockets.U}|${sockets.D}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push({
      key: `${module.id}@${rot}${mirror ? "m" : ""}`,
      module,
      rot,
      mirror,
      sockets,
      weight: module.weight || 1,
    });
  };
  const rots = module.transforms || ["r0"];
  for (const rot of rots) push(rot, false, rotateSockets(module.sockets, rot));
  if (ASYM.has(module.family)) {
    for (const rot of rots) push(rot, true, rotateSockets(mirrorSockets(module.sockets), rot));
  }
  return out;
}

function occupancyAllows(entry, cell) {
  const sock = entry.sockets;
  const occ = cell.occupancy || {};
  for (const dir of DIRS) {
    const has = !!occ[dir];
    const want = sock[dir];
    if (has && want === "open" && !CORRIDOR.has(entry.module.family)) return false;
  }
  if (entry.module.requires?.includes("support-below") && !occ.D) return false;
  if (cell.semantic === "gate" && entry.module.family !== "gate" && entry.module.family !== "hole") return false;
  if (entry.module.forbids?.includes("water-intersection") && cell.semantic === "canal") return false;
  if (entry.module.walkSurface === "flower-tile" && cell.semantic === "grass") return false;
  return true;
}

function candidateModules(cell, catalog) {
  if (cell.lockModuleId && catalog.byId[cell.lockModuleId]) return [catalog.byId[cell.lockModuleId]];
  if (cell.semantic === "gate") return catalog.byFamily.gate || [];
  if (cell.semantic === "stairs-run") return catalog.byFamily.stairs || [];
  if (cell.semantic === "canal") return [...(catalog.byFamily.bridge || []), ...(catalog.byFamily.floor || [])];
  const add = (out, fam) => {
    for (const m of catalog.byFamily[fam] || []) out.push(m);
  };
  const out = [];
  add(out, "floor");
  add(out, "foundation");
  if (!cell.occupancy?.U) add(out, "roof");
  const exposed = DIRS.filter((d) => !cell.occupancy?.[d]).length;
  if (exposed > 0) add(out, "fence");
  if (exposed === 1 && !cell.occupancy?.U) add(out, "balcony");
  if (cell.routeClearance) {
    add(out, "stairs");
    add(out, "hole");
  }
  add(out, "decor");
  return out;
}

export function initializeDomain(cell, catalog) {
  const entries = [];
  for (const module of candidateModules(cell, catalog)) {
    for (const tr of uniqueTransforms(module)) {
      if (occupancyAllows(tr, cell)) entries.push(tr);
    }
  }
  entries.sort((a, b) => (a.key < b.key ? -1 : 1));
  return entries;
}

export function expandByTopology(dirtyIds, ring = 2) {
  const extra = new Set();
  for (const raw of dirtyIds || []) {
    const p = parseTownCellId(raw);
    if (!p) continue;
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dz = -ring; dz <= ring; dz++) {
          extra.add(`cell:${p.t}:${p.ix + dx}:${p.iy + dy}:${p.iz + dz}`);
        }
      }
    }
  }
  return [...extra].sort();
}

export function buildNeighborMap(cells) {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const nmap = new Map();
  for (const c of cells) {
    const p = parseTownCellId(c.id);
    const nb = {};
    if (p) {
      for (const dir of [...DIRS, "U", "D"]) {
        const d = DELTA[dir];
        const oid = `cell:${p.t}:${p.ix + d[0]}:${p.iy + d[1]}:${p.iz + d[2]}`;
        if (byId.has(oid)) nb[dir] = oid;
      }
    }
    nmap.set(c.id, nb);
  }
  return nmap;
}

function verticalOk(belowU, aboveD) {
  if (aboveD === "support") return belowU === "roof" || belowU === "wall" || belowU === "support";
  return belowU === aboveD;
}

export function socketsCompatible(a, b, dir) {
  if (dir === "U") return verticalOk(a.sockets.U, b.sockets.D);
  if (dir === "D") return verticalOk(b.sockets.U, a.sockets.D);
  const sa = a.sockets[dir];
  const sb = b.sockets[OPP[dir]];
  if (sa === sb) return true;
  if ((sa === "open" || sb === "open") && (CORRIDOR.has(a.module.family) || CORRIDOR.has(b.module.family))) return true;
  return false;
}

function weightedPick(list, seedStr) {
  if (!list.length) return null;
  const u = (parseInt(hashHex(seedStr), 16) >>> 0) / 0x100000000;
  const total = list.reduce((s, m) => s + (m.weight || 1), 0) || 1;
  let x = u * total;
  for (const m of list) {
    x -= m.weight || 1;
    if (x <= 0) return m;
  }
  return list[list.length - 1];
}

export function minEntropyCell(domains, seed) {
  let best = null;
  let bestN = Infinity;
  let bestTie = Infinity;
  for (const id of Object.keys(domains).sort()) {
    const n = domains[id].length;
    if (n <= 1) continue;
    const tie = parseInt(hashHex(`${seed}|tie|${id}`), 16) >>> 0;
    if (n < bestN || (n === bestN && tie < bestTie)) {
      best = id;
      bestN = n;
      bestTie = tie;
    }
  }
  return best;
}

function propagate(domains, neighbors, startId, log, regionSet) {
  const q = [startId];
  const backups = [];
  const seen = new Set();
  while (q.length) {
    const id = q.shift();
    const mine = domains[id];
    if (!mine?.length) return { conflict: { cellId: id, kind: "empty-domain" }, backups };
    const nb = neighbors.get(id) || {};
    for (const dir of Object.keys(nb)) {
      const oid = nb[dir];
      const theirs = domains[oid];
      if (!theirs) continue;
      if (regionSet && !regionSet.has(oid)) {
        const ok = theirs.some((b) => mine.some((a) => socketsCompatible(a, b, dir)));
        if (!ok) return { conflict: { cellId: id, kind: "frozen-neighbor", from: oid, dir }, backups };
        continue;
      }
      const next = theirs.filter((b) => mine.some((a) => socketsCompatible(a, b, dir)));
      if (next.length === theirs.length) continue;
      backups.push([oid, theirs]);
      domains[oid] = next;
      log.push({ type: "propagate", from: id, to: oid, dir, before: theirs.length, after: next.length });
      if (!next.length) return { conflict: { cellId: oid, kind: "empty-domain", from: id, dir }, backups };
      if (!seen.has(oid)) {
        seen.add(oid);
        q.push(oid);
      }
    }
  }
  return { conflict: null, backups };
}

function restore(domains, backups) {
  for (let i = backups.length - 1; i >= 0; i--) domains[backups[i][0]] = backups[i][1];
}

export function explainConflict(conflict, world, region) {
  const empty = [];
  const domains = world.domains || {};
  for (const id of region || Object.keys(domains)) {
    if (!domains[id] || domains[id].length === 0) empty.push(id);
  }
  const lockedRoutes = (world.cells || []).filter((c) => c.routeClearance || c.semantic === "gate").map((c) => c.id);
  const suggestions = [];
  if (conflict?.dir) suggestions.push(`relax socket ${conflict.from} ${conflict.dir} → ${conflict.cellId}`);
  if (empty.length) suggestions.push(`open domain of ${empty[0]} (remove lock or add matching family)`);
  if (!suggestions.length) suggestions.push("unlock a hard route or add a corridor module");
  return {
    ok: false,
    conflict,
    emptyCells: empty,
    lockedRoutes,
    suggestions,
    region: [...(region || [])].sort(),
  };
}

export function appearanceHash(cells, skip = null) {
  const rows = (cells || [])
    .filter((c) => !skip || !skip.has(c.cellId || c.id))
    .map((c) => `${c.cellId || c.id}:${c.module?.id || "none"}@${c.rot || "r0"}`)
    .sort();
  return hashHex(rows.join("|"));
}

export function solveDirtyRegion(world, dirtyIds, seed, opts = {}) {
  const maxBack = opts.maxBacktrack ?? MAX_BACKTRACK;
  const catalog = world.catalog;
  const cells = world.cells;
  const byId = new Map(cells.map((c) => [c.id, c]));
  const regionSet = new Set((expandByTopology(dirtyIds, opts.ring ?? 2) || []).filter((id) => byId.has(id)));
  if (!regionSet.size) for (const c of cells) regionSet.add(c.id);
  const neighbors = world.neighbors || buildNeighborMap(cells);
  const previous = opts.previous || null;
  const domains = {};
  const log = [];
  const t0 = nowMs();

  for (const c of cells) {
    if (opts.fast && !regionSet.has(c.id) && previous?.byId?.[c.id]?.module) {
      const prev = previous.byId[c.id];
      domains[c.id] = [
        {
          key: prev.key || `${prev.module.id}@${prev.rot || "r0"}${prev.mirror ? "m" : ""}`,
          module: prev.module,
          rot: prev.rot || "r0",
          mirror: !!prev.mirror,
          sockets: prev.sockets || prev.module.sockets,
          weight: 1,
        },
      ];
      continue;
    }
    const domain = initializeDomain(c, catalog);
    if (!regionSet.has(c.id) && previous?.byId?.[c.id]) {
      const prev = previous.byId[c.id];
      const keep = domain.filter(
        (e) => e.key === prev.key || (prev.module && e.module.id === prev.module.id && e.rot === prev.rot && !!e.mirror === !!prev.mirror)
      );
      domains[c.id] = keep.length ? [keep[0]] : domain.slice(0, 1);
    } else {
      domains[c.id] = domain;
    }
  }

  const emptyInit = Object.keys(domains).filter((id) => regionSet.has(id) && !domains[id].length);
  if (emptyInit.length) {
    world.domains = domains;
    return {
      ok: false,
      ...explainConflict({ cellId: emptyInit[0], kind: "empty-domain" }, { ...world, domains }, [...regionSet]),
      cells: materialize(cells, domains),
      backtracks: 0,
      fallbackCount: 0,
      ms: nowMs() - t0,
      log,
    };
  }

  const stack = [];
  let backtracks = 0;
  let steps = 0;
  const fail = (conflict) => {
    world.domains = domains;
    return {
      ok: false,
      ...explainConflict(conflict, { ...world, domains }, [...regionSet]),
      cells: materialize(cells, domains),
      backtracks,
      fallbackCount: 0,
      contradiction: 1,
      ms: nowMs() - t0,
      log,
    };
  };
  while (true) {
    const emptyId = [...regionSet].find((id) => !domains[id]?.length);
    if (emptyId) {
      if (!stack.length || backtracks >= maxBack) return fail({ cellId: emptyId, kind: "empty-domain" });
      const top = stack.pop();
      restore(domains, top.backups);
      domains[top.cellId] = top.remaining;
      backtracks += 1;
      log.push({ type: "backtrack", cellId: top.cellId, left: top.remaining.length, n: backtracks });
      continue;
    }
    const cellId = minEntropyCell(pickRegion(domains, regionSet), seed);
    if (!cellId) break;
    const remaining = domains[cellId];
    const choice = weightedPick(remaining, `${seed}|${cellId}|${stack.length}|${backtracks}`);
    const rest = remaining.filter((e) => e.key !== choice.key);
    domains[cellId] = [choice];
    log.push({ type: "collapse", cellId, key: choice.key, entropy: remaining.length });
    const prop = propagate(domains, neighbors, cellId, log, regionSet);
    if (!prop.conflict) {
      stack.push({ cellId, remaining: rest, backups: prop.backups });
      steps += 1;
      continue;
    }
    restore(domains, prop.backups);
    domains[cellId] = rest;
    backtracks += 1;
    log.push({ type: "backtrack", cellId, failed: choice.key, left: rest.length, n: backtracks });
    if (backtracks > maxBack) return fail(prop.conflict);
  }

  const unresolved = Object.keys(domains).filter((id) => domains[id].length !== 1);
  const materialized = materialize(cells, domains);
  const contradiction = unresolved.length;
  world.domains = domains;
  return {
    ok: contradiction === 0,
    cells: materialized,
    backtracks,
    fallbackCount: 0,
    contradiction,
    ms: nowMs() - t0,
    log,
    steps,
    region: [...regionSet].sort(),
    hash: appearanceHash(materialized),
    byId: Object.fromEntries(materialized.map((c) => [c.cellId, c])),
  };
}

function pickRegion(domains, regionSet) {
  const o = {};
  for (const id of regionSet) o[id] = domains[id] || [];
  return o;
}

function materialize(cells, domains) {
  return cells.map((c) => {
    const domain = domains[c.id] || [];
    const pick = domain.length === 1 ? domain[0] : null;
    return {
      cellId: c.id,
      occupancy: c.occupancy,
      semantic: c.semantic,
      module: pick?.module || null,
      rot: pick?.rot || "r0",
      mirror: !!pick?.mirror,
      key: pick?.key || null,
      sockets: pick?.sockets || pick?.module?.sockets || null,
      signature: pick?.key || "",
      reason: pick ? (c.lockModuleId ? "locked-route" : "wfc") : "unsolved-conflict",
      fallback: false,
      contradiction: !pick,
      candidateCount: domain.length,
    };
  });
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
