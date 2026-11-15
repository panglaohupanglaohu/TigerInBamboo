/**
 * icon-ink.js — 纯描边图标「看起来一样重」+ 徽记同心层的折数闭合（1201179450668441600「Icons!」/ 1024679338292256769「Some UI flair」）
 * 第 50 轮，迁自 REACode src/uidecor.js（原版只读，图标路径照抄其按原片 6 帧手描的近似）。
 * 原版量出来的结论：墨量 = 路径长 × 线宽；只把图标缩进同一光学框，叉号最短、笔刷最长，墨量离散度仍大；
 * 线宽按 1 / 路径长反解（再夹到上下限，不然短图标会粗成黑块）才能压平。徽记是同心层叠加，每层角向重复数要能被折数整除，转 90° 才对得上。
 * 重构：做成任意图标集都能用的函数，并接进共享工具栏 src/ui/icon-toolbar.js（item.paths → 内联 SVG，线宽按整组墨量统一）。
 */
const P = (x, y) => [x, y];
export const DEFAULT_ICONS = {
  cursor: [[P(-0.52, -0.80), P(0.30, 0.60), P(0.36, 0.10), P(0.80, 0.00), P(-0.52, -0.80)]],
  brush: [
    [P(-0.66, 0.66), P(-0.16, 0.16)],
    [P(-0.16, 0.16), P(0.10, 0.44), P(0.48, 0.06), P(0.20, -0.22), P(-0.16, 0.16)],
    [P(0.48, 0.06), P(0.70, -0.16)],
  ],
  bucket: [
    [P(-0.52, -0.42), P(0.40, -0.66), P(0.62, 0.10), P(-0.30, 0.34), P(-0.52, -0.42)],
    [P(-0.48, -0.18), P(0.55, 0.02)],
    [P(0.64, 0.44), P(0.72, 0.52)],
  ],
  blob: [[P(-0.62, 0.06), P(-0.40, -0.44), P(0.06, -0.60), P(0.52, -0.36),
          P(0.64, 0.10), P(0.30, 0.52), P(-0.20, 0.54), P(-0.62, 0.06)]],
  undo: [
    [P(0.56, 0.34), P(0.44, -0.04), P(0.10, -0.30), P(-0.34, -0.32)],
    [P(-0.34, -0.32), P(-0.12, -0.60)],
    [P(-0.34, -0.32), P(-0.14, 0.00)],
  ],
  redo: [
    [P(-0.56, 0.34), P(-0.44, -0.04), P(-0.10, -0.30), P(0.34, -0.32)],
    [P(0.34, -0.32), P(0.12, -0.60)],
    [P(0.34, -0.32), P(0.14, 0.00)],
  ],
  close: [
    [P(-0.46, -0.46), P(0.46, 0.46)],
    [P(0.46, -0.46), P(-0.46, 0.46)],
  ],
  eye: [
    [P(-0.68, 0.00), P(-0.34, -0.34), P(0.00, -0.44), P(0.34, -0.34), P(0.68, 0.00),
     P(0.34, 0.34), P(0.00, 0.44), P(-0.34, 0.34), P(-0.68, 0.00)],
    [P(-0.14, 0.00), P(-0.06, -0.12), P(0.06, -0.12), P(0.14, 0.00), P(0.06, 0.12), P(-0.06, 0.12), P(-0.14, 0.00)],
  ],
};

export function pathLen(paths) { let L = 0; for (const p of paths) for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
export function bbox(paths) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of paths) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
const cv = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m; };

/**
 * 一组图标的「等墨量」线宽：box = 统一光学框（最长边占单位框比例），w0 = 基准线宽，clamp = 线宽上下限。
 * 返回 { rows: [{name, scale, width, inkRaw, inkFit, inkEq, clamped}], cvRaw, cvFit, cvEq }。
 */
export function inkBalance(icons = DEFAULT_ICONS, { box = 1.55, w0 = 2, clamp = [1.55, 2.45] } = {}) {
  const names = Object.keys(icons); if (!names.length) throw new RangeError('empty icon set');
  const rows = names.map((name) => { const paths = icons[name], b = bbox(paths), L = pathLen(paths); if (!(L > 0) || !(Math.max(b.w, b.h) > 0)) throw new RangeError('degenerate icon ' + name); return { name, L, scale: box / Math.max(b.w, b.h), bb: b }; });
  const target = rows.reduce((a, r) => a + r.L * r.scale * w0, 0) / rows.length;   // 墨量目标 = 统一光学框那档的均值
  for (const r of rows) { const ideal = target / (r.L * r.scale); r.width = Math.max(clamp[0], Math.min(clamp[1], ideal)); r.clamped = ideal < clamp[0] || ideal > clamp[1]; r.inkRaw = r.L * w0; r.inkFit = r.L * r.scale * w0; r.inkEq = r.L * r.scale * r.width; }
  return { rows, cvRaw: cv(rows.map((r) => r.inkRaw)), cvFit: cv(rows.map((r) => r.inkFit)), cvEq: cv(rows.map((r) => r.inkEq)), target };
}

/** 单个图标 → 内联 SVG 字符串（viewBox 以光学框居中，线宽已按整组墨量算好，单位 = viewBox 单位 × 0.01）。 */
export function iconSvg(paths, { scale = 1, width = 2, size = 24, color = 'currentColor' } = {}) {
  const b = bbox(paths), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, k = 50 * scale;
  const d = paths.map((p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${((x - cx) * k + 50).toFixed(2)} ${((y - cy) * k + 50).toFixed(2)}`).join('')).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(width * 3).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** 徽记同心层：layers = [{name, rep（角向重复数，0 = 旋转不变的环）, r}]，fold = 折数。由外到内半径须单调减。 */
export function foldClosure(layers, fold = 4) {
  if (!Number.isInteger(fold) || fold < 1) throw new RangeError('fold must be a positive integer');
  const radii = layers.map((l) => l.r); let mono = true; for (let i = 1; i < radii.length; i++) if (radii[i] >= radii[i - 1]) mono = false;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a), reps = layers.filter((l) => l.rep > 0).map((l) => l.rep);
  return { closed: layers.filter((l) => l.rep > 0 && l.rep % fold === 0).map((l) => l.name), open: layers.filter((l) => l.rep > 0 && l.rep % fold !== 0).map((l) => l.name), mono, order: reps.length ? reps.reduce(gcd) : 0, minGap: Math.min(...radii.slice(1).map((r, i) => radii[i] - r)) };
}
