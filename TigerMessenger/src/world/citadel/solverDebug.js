// =====================================================================
//  约束求解 debug：domain / entropy / 传播边 / 回溯 SVG（V6-G2）
//  纯数据，不 import Three.js。
// =====================================================================

export function solverDebugModel(solved, cells) {
  const list = cells || solved.cells || [];
  const entropy = {};
  const byId = solved.byId || {};
  for (const c of list) {
    const id = c.id || c.cellId;
    entropy[id] = c.candidateCount ?? (byId[id]?.candidateCount ?? 1);
  }
  return {
    ok: solved.ok,
    backtracks: solved.backtracks || 0,
    fallbackCount: solved.fallbackCount || 0,
    contradiction: solved.contradiction || 0,
    steps: solved.steps || 0,
    ms: solved.ms || 0,
    hash: solved.hash || null,
    emptyCells: solved.emptyCells || [],
    lockedRoutes: solved.lockedRoutes || [],
    suggestions: solved.suggestions || [],
    log: (solved.log || []).slice(0, 400),
    entropy,
  };
}

function cellPos(id) {
  const m = /cell:(\d+):(\d+):(\d+):(\d+)/.exec(id || "");
  if (!m) return null;
  return { t: +m[1], ix: +m[2], iy: +m[3], iz: +m[4] };
}

export function solverToSvg(solved, opts = {}) {
  const w = opts.width ?? 900;
  const h = opts.height ?? 720;
  const cells = solved.cells || [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const pts = [];
  for (const c of cells) {
    const p = cellPos(c.cellId);
    if (!p || p.t !== (opts.terrace ?? p.t)) continue;
    if (p.iy !== (opts.iy ?? p.iy) && opts.iy != null) continue;
    minX = Math.min(minX, p.ix);
    maxX = Math.max(maxX, p.ix);
    minZ = Math.min(minZ, p.iz);
    maxZ = Math.max(maxZ, p.iz);
    pts.push({ c, p });
  }
  const pad = 36;
  const sx = (w - pad * 2) / Math.max(1, maxX - minX + 1);
  const sz = (h - pad * 2) / Math.max(1, maxZ - minZ + 1);
  const s = Math.min(sx, sz, 28);
  const px = (ix) => pad + (ix - minX) * s;
  const pz = (iz) => pad + (iz - minZ) * s;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="#f4f1ea"/>`,
    `<text x="16" y="22" font-size="13" fill="#2d353b">WFC domain/entropy backtracks=${solved.backtracks || 0} ok=${solved.ok}</text>`,
  ];
  const prop = (solved.log || []).filter((e) => e.type === "propagate").slice(0, 80);
  for (const e of prop) {
    const a = cellPos(e.from);
    const b = cellPos(e.to);
    if (!a || !b) continue;
    parts.push(
      `<line x1="${(px(a.ix) + s * 0.4).toFixed(1)}" y1="${(pz(a.iz) + s * 0.4).toFixed(1)}" x2="${(px(b.ix) + s * 0.4).toFixed(1)}" y2="${(pz(b.iz) + s * 0.4).toFixed(1)}" stroke="#c98778" stroke-width="1.2" opacity="0.55"/>`
    );
  }
  for (const { c, p } of pts) {
    const n = c.candidateCount || 1;
    const fill = c.contradiction ? "#a9283c" : c.semantic === "gate" ? "#eee2cb" : n <= 1 ? "#a7be9c" : n < 6 ? "#7fa6ac" : "#d5dbdb";
    parts.push(
      `<rect x="${px(p.ix).toFixed(1)}" y="${pz(p.iz).toFixed(1)}" width="${(s * 0.82).toFixed(1)}" height="${(s * 0.82).toFixed(1)}" fill="${fill}" stroke="#46545d" stroke-width="0.6"/>`
    );
  }
  const backs = (solved.log || []).filter((e) => e.type === "backtrack").slice(0, 12);
  for (const e of backs) {
    const a = cellPos(e.cellId);
    if (!a) continue;
    parts.push(
      `<circle cx="${(px(a.ix) + s * 0.4).toFixed(1)}" cy="${(pz(a.iz) + s * 0.4).toFixed(1)}" r="3.2" fill="#593b47"/>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}
