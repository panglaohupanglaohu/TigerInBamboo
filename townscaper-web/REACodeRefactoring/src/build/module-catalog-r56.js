/**
 * module-catalog-r56.js — 第 56 批 C05-D：拼图块目录（1279107097108635649 "Here's a tour of the puzzle pieces that
 * make up #Townscaper. To date, there are 545 of them."）。
 *
 * 片子是把模块一块块平铺在灰网格地面上、按"邻接签名"上调试色、镜头飞过去看。本仓的模块签名（buildings.js moduleSig）：
 *   sig = ((n·4 + 上层实心·2 + 下层实心·1) 再逐边左移追加"该边外同层是否实心")
 * 这里：
 *  - signatureOf / decodeSignature：与 buildings.js 同一公式（测试逐个对照 buildBuildings 的 modules 计数）。
 *  - usedSignatures(world)：实际场景里用到的签名（= buildStats.modules）及每种的实例数。
 *  - allSignatures(grid)：该网格上理论上全部可出现的签名（每种格边数 × 上/下 × 至少一条外露边）。
 *  - buildPiece(grid, spec)：在参考格上用**真实 buildBuildings**（debugModules 调试色）只造这一块，
 *    取参考格那一层的三角形（悬空块连同钢腿、顶层连同屋顶），平移到原点 —— 不是另画一套示意几何。
 * 数量：本仓签名按"格 × 层"计，四边网格理论 60 种、三角+四边混合 88 种；原作 545 是按角点对偶模块 + 更多状态计的，
 *       口径不同，不冒充 545。
 */
import { World } from '../core/world.js';
import { MeshWriter } from '../core/meshwriter.js';
import { buildBuildings } from './buildings.js';

export function signatureOf(world, c, lv) {
  const solid = (x, l) => x !== null && world.isSolid(x, l);
  let sig = c.n * 4 + (solid(c, lv + 1) ? 2 : 0) + (solid(c, lv - 1) ? 1 : 0);
  for (let i = 0; i < c.n; i++) sig = sig * 2 + (solid(world.neighbor(c, i), lv) ? 1 : 0);
  return sig;
}
export function decodeSignature(sig, n) {
  const edges = []; for (let i = n - 1; i >= 0; i--) { edges[i] = sig & 1; sig = Math.floor(sig / 2); }
  const head = sig; return { n: Math.floor(head / 4), up: (head >> 1) & 1, down: head & 1, edges };
}
const nOf = (sig) => { for (const n of [3, 4, 5, 6]) if (decodeSignature(sig, n).n === n) return n; return -1; };

/** 实际场景里用到的签名：与 buildings.js 计 moduleSigs 的条件一致（建筑层 lv≥2 且至少一条边外露）。 */
export function usedSignatures(world) {
  const out = new Map();
  for (const c of world.cells) for (let lv = 2; lv <= 12; lv++) {
    if (!world.isBuilt(c, lv)) continue;
    let exposed = false; for (let i = 0; i < c.n; i++) { const o = world.neighbor(c, i); if (!(o && world.isSolid(o, lv))) { exposed = true; break; } }
    if (!exposed) continue;
    const sig = signatureOf(world, c, lv);
    const e = out.get(sig) ?? out.set(sig, { sig, count: 0, cell: c.id, lv, ...decodeSignature(sig, c.n) }).get(sig);
    e.count++;
  }
  return out;
}
/** 网格上的参考格：每种边数取离原点最近、所有边都有邻格的一格。 */
export function referenceCells(grid) {
  const ref = new Map();
  for (const c of grid.cells) {
    if (c.edgeNeighbors.some((e) => e < 0)) continue;
    const r = ref.get(c.n); if (!r || c.cx * c.cx + c.cz * c.cz < r.cx * r.cx + r.cz * r.cz) ref.set(c.n, c);
  }
  return ref;
}
export function allSignatures(grid) {
  const out = [];
  for (const [n, c] of [...referenceCells(grid)].sort((a, b) => b[0] - a[0])) for (const up of [0, 1]) for (const down of [0, 1]) for (let m = 0; m < (1 << n) - 1; m++) {
    const edges = Array.from({ length: n }, (_, i) => (m >> (n - 1 - i)) & 1);
    let sig = n * 4 + up * 2 + down; for (const e of edges) sig = sig * 2 + e;
    out.push({ sig, n, up, down, edges, cell: c.id, lv: 2, count: 0 });
  }
  return out;
}

/** 用真实建筑管线造一块：参考格 + 按签名放邻格，只保留参考格第 lv 层（及悬空腿 / 屋顶）的三角形。 */
export function buildPiece(grid, spec, { L = .5, palette = null, color = 0 } = {}) {
  const w = new World(grid); w.palette = palette ?? { colors: ['#efe6d4'] };
  const c = grid.cells[spec.cell], lv = 2;
  if (spec.down) { w.setSolid(c, 1, true); w.setSolid(c, 2, true); } else w.setSolid(c, 2, true);
  if (spec.up) w.setSolid(c, 3, true);
  spec.edges.forEach((on, i) => { const o = w.neighbor(c, i); if (on && o) { w.setSolid(o, 1, true); w.setSolid(o, 2, true); if (spec.up) w.setSolid(o, 3, true); w.color[o.id] = color; } });
  w.color[c.id] = color;
  const m = new MeshWriter(); let cur = -1; const own = [];
  m.at = (cell) => { cur = cell.id; };
  const tri = m.tri.bind(m), triC = m.triC.bind(m);
  m.tri = (...a) => { own.push(cur === c.id); return tri(...a); };
  m.triC = (...a) => { own.push(cur === c.id); return triC(...a); };
  const r = buildBuildings(m, w, { L, debugModules: true });
  const y0 = spec.down ? (lv - 1) * L - 1e-3 : -1, y1 = spec.up ? lv * L + 1e-3 : 99;
  const pos = [], col = [];
  for (let t = 0; t < own.length; t++) {
    if (!own[t]) continue;
    const p = m.pos.slice(t * 9, t * 9 + 9), cy = (p[1] + p[4] + p[7]) / 3;
    if (cy < y0 || cy > y1) continue;
    for (let k = 0; k < 3; k++) { pos.push(p[k * 3] - c.cx, p[k * 3 + 1], p[k * 3 + 2] - c.cz); }
    col.push(...m.col.slice(t * 9, t * 9 + 9));
  }
  const sigNow = signatureOf(w, c, lv);
  return { sig: spec.sig, sigRebuilt: sigNow, pos, col, tris: pos.length / 9, modules: r.modules };
}

/** 目录排布：按 (n, up, down) 分族成行，族内按边码排列 —— 片子里同族模块成片摆放。 */
export function catalogLayout(specs, { spacing = 1.7, perRow = 12 } = {}) {
  const fam = new Map();
  for (const s of specs) { const k = `${s.n}:${s.up}:${s.down}`; (fam.get(k) ?? fam.set(k, []).get(k)).push(s); }
  const out = []; let row = 0;
  for (const [k, list] of [...fam].sort()) {
    list.sort((a, b) => a.sig - b.sig);
    list.forEach((s, i) => out.push({ ...s, family: k, x: (i % perRow) * spacing, z: (row + Math.floor(i / perRow)) * spacing }));
    row += Math.ceil(list.length / perRow) + 0.6;
  }
  return out;
}
export { nOf };
