// =====================================================================
//  V6-G8 调试层导出：JSON / SVG / PNG（接口预留）
//  SVG 纯字符串拼接（模式同 citadel/solverDebug.js），不 import three/DOM。
//  有几何语义的层绘制图元（网格热图 / 传播边 / 流向量 / shadow rect），
//  其余层降级为文本摘要——所有 20 层都能导出合法 SVG。
// =====================================================================

import { cellXZ } from "./v6G8Layers.js";

const valueColor = (t) => {
  const k = Math.max(0, Math.min(1, t));
  const c = (a, b) => Math.round(a + (b - a) * k);
  return `rgb(${c(0xd5, 0xa9)},${c(0xdb, 0x28)},${c(0xdb, 0x3c)})`; // 灰 → 红 热力
};

/** 层数据 → 可绘制图元（cells/vectors/links/rects/notes）；无几何语义的层降级为文本 */
function toDrawable(layer) {
  const d = layer.data || {};
  const out = { cells: [], vectors: [], links: [], rects: [], notes: [] };
  const note = (k, v) =>
    out.notes.push(`${k}: ${v == null ? "null" : typeof v === "object" ? JSON.stringify(v) : v}`);
  if (layer.id === "wfc-domain" || layer.id === "wfc-entropy") {
    const vals = (d.cells || []).map((c) => c.domainSize ?? c.entropy ?? 0);
    const max = Math.max(1, ...vals);
    (d.cells || []).forEach((c, i) => {
      const p = cellXZ(c.id);
      if (p) out.cells.push({ x: p.x, y: p.y, fill: valueColor(vals[i] / max) });
    });
    if (!out.cells.length) note("cells", d.cells ? d.cells.length : null);
  } else if (layer.id === "wfc-propagation") {
    for (const e of d.edges || []) {
      const a = cellXZ(e.from);
      const b = cellXZ(e.to);
      if (a && b) out.links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    note("propagationBans", d.propagationBans);
  } else if (layer.id === "terrain-flow") {
    for (const v of d.vectors || []) {
      if (v.x != null && (v.dx || v.dz)) out.vectors.push({ x: v.x, y: v.z, dx: v.dx, dy: v.dz });
    }
    note("total", d.total);
  } else if (layer.id === "ao-slice" && d.slice) {
    for (let j = 0; j < d.slice.height; j++) {
      for (let i = 0; i < d.slice.width; i++) {
        out.cells.push({ x: i, y: j, fill: valueColor(d.slice.ao[j * d.slice.width + i] / 255) });
      }
    }
  } else if (layer.id === "shadow-frustum" && d.camera) {
    out.rects.push({
      x: d.camera.left,
      y: d.camera.bottom,
      w: d.camera.right - d.camera.left,
      h: d.camera.top - d.camera.bottom,
    });
    note("fitReason", d.lastFitReason);
    note("texel", d.fit?.texel);
  } else {
    for (const k of Object.keys(d).slice(0, 12)) note(k, d[k]);
  }
  return out;
}

/** 层 → SVG 字符串（不 import three/DOM，纯拼接） */
export function layerToSvg(layer, opts = {}) {
  const w = opts.width ?? 900;
  const h = opts.height ?? 640;
  const g = toDrawable(layer);
  const pts = [
    ...g.cells.map((c) => [c.x, c.y]),
    ...g.vectors.map((v) => [v.x, v.y]),
    ...g.links.flatMap((l) => [
      [l.x1, l.y1],
      [l.x2, l.y2],
    ]),
    ...g.rects.map((r) => [r.x, r.y]),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const pad = 40;
  const top = 48; // 标题区
  const s = Math.min((w - pad * 2) / Math.max(1e-6, maxX - minX || 1), (h - top - pad) / Math.max(1e-6, maxY - minY || 1));
  const px = (x) => pad + (x - minX) * s;
  const py = (y) => top + (y - minY) * s;
  const cell = Math.max(3, Math.min(28, s * 0.82));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="#f4f1ea"/>`,
    `<text x="16" y="22" font-size="13" fill="#2d353b">${layer.id} v${layer.version} hash=${layer.hash}</text>`,
  ];
  g.notes.slice(0, 2).forEach((n, i) =>
    parts.push(`<text x="16" y="${h - 28 + i * 14}" font-size="11" fill="#46545d">${String(n).replace(/[<>&]/g, "?")}</text>`)
  );
  for (const l of g.links.slice(0, 2000)) {
    parts.push(
      `<line x1="${px(l.x1).toFixed(1)}" y1="${py(l.y1).toFixed(1)}" x2="${px(l.x2).toFixed(1)}" y2="${py(l.y2).toFixed(1)}" stroke="#c98778" stroke-width="1.2" opacity="0.6"/>`
    );
  }
  for (const r of g.rects) {
    parts.push(
      `<rect x="${px(r.x).toFixed(1)}" y="${py(r.y + r.h).toFixed(1)}" width="${(r.w * s).toFixed(1)}" height="${(r.h * s).toFixed(1)}" fill="none" stroke="#46545d" stroke-width="1.4"/>`
    );
  }
  for (const c of g.cells.slice(0, 20000)) {
    parts.push(
      `<rect x="${(px(c.x) - cell / 2).toFixed(1)}" y="${(py(c.y) - cell / 2).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${c.fill}" stroke="#46545d" stroke-width="0.4"/>`
    );
  }
  for (const v of g.vectors.slice(0, 4000)) {
    parts.push(
      `<line x1="${px(v.x).toFixed(1)}" y1="${py(v.y).toFixed(1)}" x2="${px(v.x + v.dx).toFixed(1)}" y2="${py(v.y + v.dy).toFixed(1)}" stroke="#7fa6ac" stroke-width="1.1"/>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}

/**
 * 统一导出接口。
 * @param format "json" | "svg" | "png"
 *   png：无 DOM/canvas 环境不实现，返回 data:null + reason（接口预留，由渲染接线层栅格化）。
 */
export function exportLayer(layer, format = "json", opts = {}) {
  if (format === "json") return { format, text: JSON.stringify(layer, null, 2) };
  if (format === "svg") return { format, text: layerToSvg(layer, opts) };
  if (format === "png") {
    return { format, data: null, reason: "PNG 导出需要 canvas/DOM 栅格化，纯逻辑环境不可用；接口预留" };
  }
  throw new Error(`未知导出格式: ${format}`);
}
