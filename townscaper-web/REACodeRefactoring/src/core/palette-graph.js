/**
 * palette-graph.js — 第 56 批 C11：1712088611934371876「Another take on a palette authoring tool」的节点式调色图。
 *
 * 片子里看到的（624 帧，sheet-00..06 + 原尺寸 200/305/550）：
 *   · 四个角节点围成矩形，内部离散成小三角面片、每片一个平色（不是连续渐变）；节点可自由拖动（矩形被拉歪）；
 *   · 右键菜单 New node / New gradient / New triangle；新三角共用矩形底边两个角节点 + 新白节点 → 白色收束三角；
 *   · 选中节点左上出现 RGB / LAB / HSL 三种滑条取色；
 *   · 底部两个节点之间的色带（New gradient），色带的插值空间菜单 OkHsl / OkLab / Srgb。
 * 这里把这些做成共享数据结构：节点共享（拖一个角，矩形和三角一起变），每个图元有自己的细分数和插值空间，
 * facets() 给出离散面片（画布和实景取样共用同一份），swatches() 给出去重后的调色板，exportGraph/importGraph 往返。
 * 原工具内部公式未知：细分方式（矩形 n×n 格每格两三角、三角 n² 个子三角、面片取质心色）是本地实现。
 */
import { srgbToOklab, oklabToSrgb } from './oklab.js';
import { okhslToSrgb, srgbToOkhsl, mixOkhsl } from './okhsl.js';

export const SPACES = Object.freeze(['okhsl', 'oklab', 'srgb']);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const isRgb = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const checkSpace = (s) => { if (!SPACES.includes(s)) throw new RangeError('palette-graph: space ' + s); return s; };
const checkDiv = (n, max = 32) => { if (!Number.isInteger(n) || n < 1 || n > max) throw new RangeError('palette-graph: subdivisions'); return n; };

/** 在指定空间里混两个 sRGB 颜色。 */
export function mixColor(a, b, t, space = 'srgb') {
  if (!isRgb(a) || !isRgb(b) || !Number.isFinite(t)) throw new RangeError('palette-graph: mix');
  t = clamp01(t);
  if (space === 'srgb') return a.map((v, i) => v + (b[i] - v) * t);
  if (space === 'oklab') { const p = srgbToOklab(...a), q = srgbToOklab(...b); return oklabToSrgb(...p.map((v, i) => v + (q[i] - v) * t)).map(clamp01); }
  if (space === 'okhsl') return okhslToSrgb(...mixOkhsl(srgbToOkhsl(...a), srgbToOkhsl(...b), t));
  throw new RangeError('palette-graph: space ' + space);
}
/** 矩形双线性（先左右后上下，各段在同一空间）。角序 [左上, 右上, 左下, 右下]。 */
export const bilinear = (c, u, v, space) => mixColor(mixColor(c[0], c[1], u, space), mixColor(c[2], c[3], u, space), v, space);
/** 三角重心插值：先 a→b 按 wb/(wa+wb)，再向 c 按 wc。 */
export function barycentric(c, wa, wb, wc, space) {
  const s = wa + wb; const ab = s > 1e-9 ? mixColor(c[0], c[1], wb / s, space) : c[0];
  return mixColor(ab, c[2], wc, space);
}

export function createPaletteGraph() { return { nodes: [], quads: [], tris: [], gradients: [], nextId: 1 }; }
export function addNode(g, { x, y, rgb }) {
  if (![x, y].every(Number.isFinite) || !isRgb(rgb)) throw new RangeError('palette-graph: node');
  const n = { id: g.nextId++, x, y, rgb: [...rgb] }; g.nodes.push(n); return n.id;
}
export const nodeById = (g, id) => { const n = g.nodes.find((k) => k.id === id); if (!n) throw new RangeError('palette-graph: node ' + id); return n; };
export function moveNode(g, id, x, y) { if (![x, y].every(Number.isFinite)) throw new RangeError('palette-graph: move'); const n = nodeById(g, id); n.x = x; n.y = y; }
export function setNodeColor(g, id, rgb) { if (!isRgb(rgb)) throw new RangeError('palette-graph: colour'); nodeById(g, id).rgb = [...rgb]; }
export function addQuad(g, nodes, { div = 8, space = 'okhsl' } = {}) {
  if (!Array.isArray(nodes) || nodes.length !== 4 || new Set(nodes).size !== 4) throw new RangeError('palette-graph: quad needs 4 nodes');
  nodes.forEach((id) => nodeById(g, id)); const q = { id: g.nextId++, nodes: [...nodes], div: checkDiv(div), space: checkSpace(space) }; g.quads.push(q); return q.id;
}
export function addTriangle(g, nodes, { div = 4, space = 'okhsl' } = {}) {
  if (!Array.isArray(nodes) || nodes.length !== 3 || new Set(nodes).size !== 3) throw new RangeError('palette-graph: triangle needs 3 nodes');
  nodes.forEach((id) => nodeById(g, id)); const t = { id: g.nextId++, nodes: [...nodes], div: checkDiv(div), space: checkSpace(space) }; g.tris.push(t); return t.id;
}
export function addGradient(g, a, b, { steps = 12, space = 'okhsl' } = {}) {
  if (a === b) throw new RangeError('palette-graph: gradient needs 2 nodes'); nodeById(g, a); nodeById(g, b);
  const r = { id: g.nextId++, nodes: [a, b], steps: checkDiv(steps, 256), space: checkSpace(space) }; g.gradients.push(r); return r.id;
}
export function setSpace(g, primId, space) {
  checkSpace(space); const p = [...g.quads, ...g.tris, ...g.gradients].find((k) => k.id === primId); if (!p) throw new RangeError('palette-graph: primitive ' + primId); p.space = space;
}

/** 矩形 (u,v) → 所在离散面片的颜色（与 facets 同一规则：格 (i,j)，对角线分两片，面片质心取色）。 */
export function quadFacetAt(g, quad, u, v) {
  const n = quad.div, c = quad.nodes.map((id) => nodeById(g, id).rgb);
  const i = Math.min(n - 1, Math.floor(clamp01(u) * n)), j = Math.min(n - 1, Math.floor(clamp01(v) * n)), fu = clamp01(u) * n - i, fv = clamp01(v) * n - j;
  const flip = (i + j) % 2 === 1, upper = flip ? fu + fv < 1 : fu > fv;
  const cu = flip ? (upper ? (i + 1 / 3) : (i + 2 / 3)) : (upper ? (i + 2 / 3) : (i + 1 / 3));
  const cv = flip ? (upper ? (j + 1 / 3) : (j + 2 / 3)) : (upper ? (j + 1 / 3) : (j + 2 / 3));
  return { rgb: bilinear(c, cu / n, cv / n, quad.space), facet: (j * n + i) * 2 + (upper ? 0 : 1) };
}
/** 三角重心 (wb,wc)（wa=1−wb−wc）→ 所在子三角颜色。 */
export function triFacetAt(g, tri, wb, wc) {
  const n = tri.div, c = tri.nodes.map((id) => nodeById(g, id).rgb);
  wb = clamp01(wb); wc = clamp01(wc); if (wb + wc > 1) { const s = wb + wc; wb /= s; wc /= s; }
  const B = wb * n, C = wc * n, i = Math.min(n - 1, Math.floor(B)), j = Math.min(n - 1 - i, Math.floor(C)), up = (B - i) + (C - j) <= 1 || i + j === n - 1;
  const cb = up ? (i + 1 / 3) : (i + 2 / 3), cc = up ? (j + 1 / 3) : (j + 2 / 3);
  return { rgb: barycentric(c, 1 - (cb + cc) / n, cb / n, cc / n, tri.space), facet: `${i},${j},${up ? 'u' : 'd'}` };
}

/** 全部离散面片：{prim, pts:[[x,y]×3], rgb}，画布与实景取样共用。 */
export function facets(g) {
  const out = [];
  for (const q of g.quads) {
    const P = q.nodes.map((id) => nodeById(g, id)), n = q.div, c = P.map((p) => p.rgb);
    const at = (u, v) => [(1 - u) * (1 - v) * P[0].x + u * (1 - v) * P[1].x + (1 - u) * v * P[2].x + u * v * P[3].x, (1 - u) * (1 - v) * P[0].y + u * (1 - v) * P[1].y + (1 - u) * v * P[2].y + u * v * P[3].y];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = at(i / n, j / n), b = at((i + 1) / n, j / n), d = at(i / n, (j + 1) / n), e = at((i + 1) / n, (j + 1) / n), flip = (i + j) % 2 === 1;
      const tris = flip ? [[a, b, d, i + 1 / 3, j + 1 / 3], [b, e, d, i + 2 / 3, j + 2 / 3]] : [[a, b, e, i + 2 / 3, j + 1 / 3], [a, e, d, i + 1 / 3, j + 2 / 3]];
      for (const [p0, p1, p2, cu, cv] of tris) out.push({ prim: q.id, pts: [p0, p1, p2], rgb: bilinear(c, cu / n, cv / n, q.space) });
    }
  }
  for (const t of g.tris) {
    const P = t.nodes.map((id) => nodeById(g, id)), n = t.div, c = P.map((p) => p.rgb);
    const at = (i, j) => { const wb = i / n, wc = j / n, wa = 1 - wb - wc; return [wa * P[0].x + wb * P[1].x + wc * P[2].x, wa * P[0].y + wb * P[1].y + wc * P[2].y]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      out.push({ prim: t.id, pts: [at(i, j), at(i + 1, j), at(i, j + 1)], rgb: barycentric(c, 1 - (i + j + 2 / 3) / n, (i + 1 / 3) / n, (j + 1 / 3) / n, t.space) });
      if (i + j < n - 1) out.push({ prim: t.id, pts: [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], rgb: barycentric(c, 1 - (i + j + 4 / 3) / n, (i + 2 / 3) / n, (j + 2 / 3) / n, t.space) });
    }
  }
  return out;
}
/** 色带：两节点之间 steps 个色块（端点含两节点本色）。 */
export function gradientColors(g, grad) {
  const [a, b] = grad.nodes.map((id) => nodeById(g, id).rgb), n = grad.steps;
  return Array.from({ length: n }, (_, k) => mixColor(a, b, n === 1 ? 0.5 : k / (n - 1), grad.space));
}
const hex = (c) => '#' + c.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
/** 去重后的调色板（面片 + 色带，按出现顺序）。 */
export function swatches(g) {
  const seen = new Set(), out = [];
  for (const c of [...facets(g).map((f) => f.rgb), ...g.gradients.flatMap((r) => gradientColors(g, r))]) { const h = hex(c); if (!seen.has(h)) { seen.add(h); out.push(h); } }
  return out;
}
/** 调色板条带像素（RGBA，w=色数，h=1）。 */
export function paletteStrip(g) { const list = swatches(g), data = new Uint8ClampedArray(list.length * 4); list.forEach((h, i) => data.set([1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).concat(255), i * 4)); return { width: list.length, height: 1, data, hex: list }; }

export function exportGraph(g) {
  // color 是给人看的 8bit hex；rgb 是浮点原值（6 位），导入优先取它 —— 只留 hex 会让调色板往返漂 ~9%（实测 142/156 命中）
  return JSON.stringify({ format: 'rea-palette-graph', version: 1, nodes: g.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, color: hex(n.rgb), rgb: n.rgb.map((v) => +v.toFixed(6)) })), quads: g.quads.map((p) => ({ id: p.id, nodes: p.nodes, div: p.div, space: p.space })), tris: g.tris.map((p) => ({ id: p.id, nodes: p.nodes, div: p.div, space: p.space })), gradients: g.gradients.map((p) => ({ id: p.id, nodes: p.nodes, steps: p.steps, space: p.space })), palette: swatches(g) });
}
export function importGraph(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.format !== 'rea-palette-graph' || o.version !== 1) throw new RangeError('palette-graph: format');
  const g = createPaletteGraph(), ids = new Set();
  for (const n of o.nodes ?? []) {
    if (!Number.isInteger(n.id) || ids.has(n.id) || !/^#[0-9a-f]{6}$/i.test(n.color)) throw new RangeError('palette-graph: node'); ids.add(n.id);
    const exact = Array.isArray(n.rgb) && n.rgb.length === 3 && n.rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    g.nodes.push({ id: n.id, x: +n.x, y: +n.y, rgb: exact ? n.rgb.map(Number) : [1, 3, 5].map((k) => parseInt(n.color.slice(k, k + 2), 16) / 255) });
  }
  if (g.nodes.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y))) throw new RangeError('palette-graph: node position');
  g.nextId = Math.max(0, ...ids) + 1;
  const prim = (p, k) => { if (!Number.isInteger(p.id) || ids.has(p.id) || !Array.isArray(p.nodes) || p.nodes.length !== k || !p.nodes.every((id) => ids.has(id) && g.nodes.find((n) => n.id === id))) throw new RangeError('palette-graph: primitive'); checkSpace(p.space); ids.add(p.id); g.nextId = Math.max(g.nextId, p.id + 1); return { id: p.id, nodes: [...p.nodes], space: p.space }; };
  for (const q of o.quads ?? []) g.quads.push({ ...prim(q, 4), div: checkDiv(q.div) });
  for (const t of o.tris ?? []) g.tris.push({ ...prim(t, 3), div: checkDiv(t.div) });
  for (const r of o.gradients ?? []) g.gradients.push({ ...prim(r, 2), steps: checkDiv(r.steps, 256) });
  return g;
}

/** 片子开头的布局：四角矩形（左上绿、右上黄、左下青、右下玫红）+ 白收束三角 + 底部两节点色带。
 *  面片默认 OkLab（片中矩形内部是发灰的过渡，OkHsl 会绕色相出现鲜紫）；色带默认 OkHsl（原尺寸 0550 菜单勾在 OkHsl）。 */
export function defaultPaletteGraph({ div = 8, space = 'oklab', gradientSpace = 'okhsl' } = {}) {
  const g = createPaletteGraph(), h = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16) / 255);
  const a = addNode(g, { x: 0, y: 0, rgb: h('#5f8a5b') }), b = addNode(g, { x: 1, y: 0, rgb: h('#dfa955') }), c = addNode(g, { x: 0, y: 1.5, rgb: h('#3f8597') }), d = addNode(g, { x: 1, y: 1.5, rgb: h('#a7577a') });
  addQuad(g, [a, b, c, d], { div, space });
  const w = addNode(g, { x: 0.5, y: 2.25, rgb: [1, 1, 1] }); addTriangle(g, [c, d, w], { div: Math.max(1, div >> 1), space });
  const r0 = addNode(g, { x: -0.05, y: 2.6, rgb: h('#b0605a') }), r1 = addNode(g, { x: 1.2, y: 2.6, rgb: h('#8a62c8') }); addGradient(g, r0, r1, { steps: 12, space: gradientSpace });
  return g;
}

/**
 * World 顶面取色（离散）：每格 u = 格内确定性变化（hash），v = 归一高度；
 * v<split 落在矩形 (u, v/split)，否则落进收束三角（越高越接近白节点）。返回每格 sRGB。
 */
export function colorWorldByGraph(world, g, { split = 0.8, seed = 3 } = {}) {
  const q = g.quads[0]; if (!q) throw new RangeError('palette-graph: need a quad');
  const tri = g.tris[0] ?? null, maxLevel = world.cells.reduce((m, c) => Math.max(m, world.top(c)), 1), rgb = new Float32Array(world.cells.length * 3), facetsUsed = new Set();
  for (const c of world.cells) {
    const t = world.top(c); if (!t) continue;
    let hsh = Math.imul(c.id + seed, 374761393); hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177); const u = ((hsh ^ (hsh >>> 16)) >>> 0) / 4294967296;
    const v = maxLevel > 1 ? (t - 1) / (maxLevel - 1) : 0;
    let s;
    if (!tri || v < split) s = quadFacetAt(g, q, u, Math.min(0.999, v / split)), facetsUsed.add('q' + s.facet);
    else { const k = (v - split) / Math.max(1e-6, 1 - split); s = triFacetAt(g, tri, u * (1 - k), k * 0.999); facetsUsed.add('t' + s.facet); }
    rgb.set(s.rgb, c.id * 3);
  }
  return { rgb, facetsUsed: facetsUsed.size, maxLevel };
}
