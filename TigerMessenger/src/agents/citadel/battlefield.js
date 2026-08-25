// =====================================================================
//  战场公平性：登陆路线、撤退点、门可达、瓶颈/高地（V6-G5）
//  纯数据，禁止 import Three.js。
// =====================================================================

import { hashHex } from "../../core/rng.js";
import { TROJAN_RULES } from "./siegeDirector.js";

export const LEGAL_CROSS = Object.freeze(["stairs", "bridge", "ladder", "waterfall-climb"]);
export const FAIRNESS_SEEDS = Object.freeze([7, 42, 884]);

export function isLegalCrossing(edgeType) {
  return LEGAL_CROSS.includes(edgeType);
}

export function pathCrossings(points = []) {
  const rows = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.terraceId == null || b.terraceId == null || a.terraceId === b.terraceId) continue;
    const edgeType = b.edgeType || "walk";
    rows.push({
      edgeType,
      surfaceId: b.surfaceId || null,
      from: a.terraceId,
      to: b.terraceId,
    });
    if (!isLegalCrossing(edgeType)) return { ok: false, rows };
  }
  return { ok: true, rows };
}

export function nodesBy(graph, pred) {
  return [...graph.nodes.values()].filter(pred);
}

export function findHarbor(graph) {
  return nodesBy(graph, (n) => n.flags?.harbor)[0] || nodesBy(graph, (n) => n.terrace === 4)[0] || [...graph.nodes.values()][0];
}

export function findKeep(graph, terrace = 0) {
  return nodesBy(graph, (n) => n.terrace === terrace && n.kind === "surface")[0] || nodesBy(graph, (n) => n.terrace === terrace)[0];
}

export function doorNodes(graph, town) {
  const fromGraph = nodesBy(graph, (n) => n.kind === "door" || n.semantic === "cell");
  if (fromGraph.length) return fromGraph;
  return (town?.cells || [])
    .filter((c) => c.semantic === "gate")
    .map((c) => ({ id: c.cellId, pos: { x: 0, y: 0, z: 0 } }));
}

export function countDisjointRoutes(graph, provider, start, goals) {
  if (!start || !goals?.length) return { count: 0, paths: [] };
  const paths = [];
  const seen = new Set();
  for (const g of goals) {
    const path = graph.findPath(start.pos, g.pos, provider);
    if (!path?.points?.length) continue;
    const cross = pathCrossings(path.points);
    if (!cross.ok) continue;
    const key = cross.rows.map((r) => `${r.edgeType}:${r.from}->${r.to}`).join("|") || path.ids?.join(",") || path.points.length;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push({ goal: g.id, crossings: cross.rows, points: path.points, ids: path.ids });
  }
  return { count: paths.length, paths };
}

export function countSafeFallbacks(graph, provider, fromTerrace = 1, toTerrace = 0) {
  const from = findKeep(graph, fromTerrace);
  const to = findKeep(graph, toTerrace);
  if (!from || !to) return 0;
  const path = graph.findPath(from.pos, to.pos, provider);
  if (!path) return 0;
  return pathCrossings(path.points).ok ? 1 : 0;
}

export function allDoorsReachable(graph, provider, start, doors) {
  if (!start || !doors.length) return true;
  return doors.every((d) => {
    const path = graph.findPath(start.pos, d.pos, provider);
    return !!path?.points?.length;
  });
}

export function measureChokeDominance(paths) {
  let minC = Infinity;
  let maxC = 0;
  for (const p of paths || []) {
    const caps = (p.points || []).map((pt) => pt.capacity || 2);
    const m = Math.min(...caps);
    minC = Math.min(minC, m);
    maxC = Math.max(maxC, Math.max(...caps));
  }
  if (!Number.isFinite(minC) || maxC <= 0) return 0;
  return 1 - minC / maxC;
}

export function highlandAdvantage(defenders, attackers) {
  const avg = (arr) => (arr.length ? arr.reduce((s, n) => s + (n.terrace ?? n.terraceId ?? 0), 0) / arr.length : 0);
  return avg(attackers) - avg(defenders);
}

export function torchVisibleZone(graph, torches, radius = 8) {
  const nodes = [...graph.nodes.values()];
  const visible = [];
  for (const n of nodes) {
    const ok = torches.some((t) => Math.hypot(n.pos.x - t.x, n.pos.y - t.y, n.pos.z - t.z) <= radius);
    if (ok) visible.push(n.id);
  }
  return visible;
}

export function evaluateBattlefield(v4, seed = 7) {
  const graph = v4.graph;
  const provider = v4.surfaces;
  const harbor = findHarbor(graph);
  const t0 = nodesBy(graph, (n) => n.terrace === 0 && n.kind === "surface").slice(0, 4);
  const goals = [...t0].sort((a, b) => (hashHex(`${seed}|${a.id}`) < hashHex(`${seed}|${b.id}`) ? -1 : 1));
  const landing = countDisjointRoutes(graph, provider, harbor, goals);
  const doors = doorNodes(graph, v4.town)
    .map((d) => ({ d, dist: Math.hypot((d.pos?.x || 0) - harbor.pos.x, (d.pos?.z || 0) - harbor.pos.z) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map((x) => x.d);
  const fallbacks = 0; // 顶层是最终防区，不再回退到已拆除的中间台地。
  const doorsOk = !doors.length || allDoorsReachable(graph, provider, harbor, doors);
  const choke = measureChokeDominance(landing.paths);
  const high = highlandAdvantage(t0, [harbor].filter(Boolean));
  const torches = [{ ...(harbor?.pos || { x: 0, y: 0, z: 0 }) }];
  const torchZone = torchVisibleZone(graph, torches, 10);
  const air = landing.paths.some((p) => !pathCrossings(p.points).ok) ? 1 : 0;
  const report = {
    seed,
    landingRoutes: landing.count,
    defenderFallbacks: fallbacks,
    civilianAccess: doorsOk,
    chokeDominance: choke,
    highlandAdvantage: high,
    torchVisible: torchZone.length,
    buildingProtection: (v4.town?.cells || []).length,
    airSegments: air,
    trojan: {
      ropes: TROJAN_RULES.ropes,
      dropsPerRope: TROJAN_RULES.dropsPerRope,
      captureTarget: TROJAN_RULES.captureTarget,
      ladderTerraces: [...TROJAN_RULES.ladderTerraces],
      stairTerraces: [...TROJAN_RULES.stairTerraces],
    },
    strategy: landing.paths.map((p) => p.crossings.map((c) => c.edgeType).join("+")).sort(),
  };
  report.hash = hashHex(JSON.stringify({ seed, landing: report.landingRoutes, strategy: report.strategy, choke: report.chokeDominance.toFixed(3) }));
  return report;
}
