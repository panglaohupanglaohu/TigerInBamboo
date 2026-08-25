// =====================================================================
//  真实表面战术图（G5）：节点来自 SurfaceProvider，环采样仅作回退
// =====================================================================

const WALK_DY = 0.22;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function compileSurfaceGraph(topo, provider) {
  const mesh = topo.halfEdge;
  const nodes = new Map();
  const edges = new Map();
  const adj = new Map();

  function addNode(id, pos, meta) {
    nodes.set(id, { id, pos: { ...pos }, ...meta });
    if (!adj.has(id)) adj.set(id, []);
    return nodes.get(id);
  }
  function addEdge(a, b, type, meta = {}) {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const id = `${type}:${a < b ? a + "→" + b : b + "→" + a}`;
    if (edges.has(id) && type === "walk") return;
    const pa = nodes.get(a).pos;
    const pb = nodes.get(b).pos;
    const length = dist(pa, pb);
    const rise = Math.abs(pa.y - pb.y);
    if (type === "walk" && rise > WALK_DY) return;
    const e = {
      id,
      a,
      b,
      type,
      length,
      rise,
      width: meta.width ?? 2,
      slope: length > 1e-6 ? rise / length : 0,
      capacity: meta.capacity ?? 2,
      danger: meta.danger ?? 0,
      bidirectional: meta.bidirectional !== false,
      surfaceId: meta.surfaceId,
    };
    edges.set(id + (type !== "walk" ? `:${a}` : ""), e);
    adj.get(a).push({ to: b, edge: e });
    if (e.bidirectional) adj.get(b).push({ to: a, edge: e });
  }

  for (const s of provider.walkable()) {
    addNode(s.id, s.centroid, {
      kind: s.semantic === "cell" ? "door" : "surface",
      terrace: s.terraceId,
      region: `terrace:${s.terraceId}`,
      surfaceId: s.id,
      semantic: s.semantic,
      flags: s.flags,
    });
  }

  const faceOf = new Map(mesh.faces.map((f) => [f.id, f]));
  for (let i = 0; i < mesh.halfEdges.length; i++) {
    const he = mesh.halfEdges[i];
    if (he.twin < 0 || i > he.twin) continue;
    const a = he.face;
    const b = mesh.halfEdges[he.twin].face;
    const fa = faceOf.get(a);
    const fb = faceOf.get(b);
    if (!fa || !fb) continue;
    if (fa.terraceId === fb.terraceId) addEdge(a, b, "walk", { surfaceId: a });
  }

  const byTerrace = new Map();
  for (const n of nodes.values()) {
    if (!byTerrace.has(n.terrace)) byTerrace.set(n.terrace, []);
    byTerrace.get(n.terrace).push(n);
  }
  const terraces = [...byTerrace.keys()].sort((a, b) => a - b);
  for (let i = 0; i < terraces.length - 1; i++) {
    const lo = byTerrace.get(terraces[i]) || [];
    const hi = byTerrace.get(terraces[i + 1]) || [];
    for (const a of lo) {
      for (const b of hi) {
        const d = dist(a.pos, b.pos);
        if (d > 8) continue;
        const type = a.flags?.nearNotch && b.flags?.nearNotch ? "waterfall-climb" : "stairs";
        if (type === "stairs" && (a.flags?.nearNotch || b.flags?.nearNotch)) continue;
        addEdge(a.id, b.id, type, { width: type === "stairs" ? 1.6 : 1.2, capacity: 1, bidirectional: true });
      }
    }
  }

  function aStar(startId, goalId) {
    if (!nodes.has(startId) || !nodes.has(goalId)) return null;
    const open = [{ id: startId, g: 0, f: 0 }];
    const came = new Map();
    const gScore = new Map([[startId, 0]]);
    const seen = new Set();
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      if (cur.id === goalId) {
        const path = [cur.id];
        while (came.has(path[0])) path.unshift(came.get(path[0]));
        return path;
      }
      for (const { to, edge } of adj.get(cur.id) || []) {
        const g = (gScore.get(cur.id) || 0) + edge.length + edge.danger;
        if (g >= (gScore.get(to) ?? Infinity)) continue;
        came.set(to, cur.id);
        gScore.set(to, g);
        const h = dist(nodes.get(to).pos, nodes.get(goalId).pos);
        open.push({ id: to, g, f: g + h });
      }
    }
    return null;
  }

  function pathPoints(ids) {
    const pts = [];
    for (let i = 0; i < ids.length; i++) {
      const n = nodes.get(ids[i]);
      const prev = i ? nodes.get(ids[i - 1]) : n;
      let edgeType = "walk";
      if (i) {
        const link = (adj.get(prev.id) || []).find((x) => x.to === n.id);
        edgeType = link?.edge.type || "walk";
      }
      pts.push({
        ...n.pos,
        surfaceId: n.surfaceId,
        terraceId: n.terrace,
        edgeType,
        normal: { x: 0, y: 1, z: 0 },
      });
    }
    return pts;
  }

  function findPath(aPos, bPos, providerRef) {
    const sa = providerRef.sample(aPos);
    const sb = providerRef.sample(bPos);
    if (!sa || !sb) return null;
    const ids = aStar(sa.surfaceId, sb.surfaceId);
    if (!ids) return null;
    const points = pathPoints(ids);
    for (const p of points) {
      const hit = providerRef.projectTo(p.surfaceId, p);
      if (hit) {
        p.y = hit.point.y;
        p.normal = hit.normal;
      }
    }
    return { ids, points };
  }

  return {
    nodes,
    edges,
    adj,
    aStar,
    pathPoints,
    findPath,
    nearest(pos) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes.values()) {
        const d = dist(n.pos, pos);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    },
  };
}
