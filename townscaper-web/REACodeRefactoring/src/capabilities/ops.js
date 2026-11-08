/**
 * ops.js — 能力代码共用的体素小工具（纯数据，不依赖 three，可在 Web Worker / Node 里跑）。
 *
 * 只用 World 最基本的字段（solid / rock / color / river 位掩码 + grid.cells），
 * 这样游戏里的 World 副本（src/vendor/...）和库里的 World 都能直接用，不依赖新加的方法。
 */

export const bit = (lv) => 1 << (lv - 1);
export const isSolid = (w, id, lv) => lv >= 1 && ((w.solid[id] >> (lv - 1)) & 1) === 1;
export const isRock = (w, id, lv) => lv >= 1 && ((w.rock[id] >> (lv - 1)) & 1) === 1;
export const top = (w, id) => { const m = w.solid[id]; return m === 0 ? 0 : 32 - Math.clz32(m); };
export const ground = (w, id) => { const m = w.rock[id]; return m === 0 ? 0 : 32 - Math.clz32(m); };
/** 从第 1 层往上连续实心的最高一层；第 1 层空 → 0 */
export const floorOf = (w, id) => { const m = w.solid[id]; if (!(m & 1)) return 0; const inv = ~m; return 31 - Math.clz32(inv & -inv); };
/** 顶上是建筑（不是裸露岩石） */
export const topIsBuilt = (w, id) => { const t = top(w, id); return t > 0 && !isRock(w, id, t); };
/** 头顶有岩石的洞 / 拱下 */
export const isCave = (w, id) => { const t = top(w, id), f = floorOf(w, id); return f > 0 && f < t && !isSolid(w, id, f + 1) && isRock(w, id, t); };
export const hasBuilt = (w, id) => (w.solid[id] & ~w.rock[id]) !== 0;

export function setVoxel(w, id, lv, on, { rock = false } = {}) {
  const b = bit(lv);
  if (on) { w.solid[id] |= b; if (rock) w.rock[id] |= b; else w.rock[id] &= ~b; }
  else { w.solid[id] &= ~b; w.rock[id] &= ~b; }
}

export const nbIds = (cell) => cell.edgeNeighbors.filter((i) => i >= 0);
/** 沿第 edge 条边走到邻格；方格走"对边"保持直线（features.js 的走法） */
export function straightNext(cells, cur, edge) {
  const id = cur.edgeNeighbors[edge];
  if (id < 0) return null;
  const nx = cells[id];
  const back = nx.edgeNeighbors.indexOf(cur.id);
  const nextEdge = nx.n === 4 && back >= 0 ? (back + 2) % 4 : -1;
  return { cell: nx, edge: nextEdge };
}

export function cloneWorldData(w) { return { solid: w.solid.slice(), rock: w.rock.slice(), color: w.color.slice(), river: w.river.slice() }; }

/** 种子随机数（mulberry32） */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 可编辑掩码：ctx.allowed（Uint8Array，1 = 允许改）缺省时全部允许 */
export const editable = (ctx, id) => !ctx?.allowed || ctx.allowed[id] === 1;

/** 目标按分数排序后取前 n 个，且彼此至少隔 minGap 格中心距离 */
export function pickSpread(cands, cells, n, minGap = 2.5) {
  const out = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    const f = cells[c.focus];
    if (out.some((o) => Math.hypot(cells[o.focus].cx - f.cx, cells[o.focus].cz - f.cz) < minGap)) continue;
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}
