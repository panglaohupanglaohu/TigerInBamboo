/**
 * terrace-ladder.js — 薄台与攀爬（R45，补学队列 #7「109 帧黄色薄平台，仅学习：原薄台 / 攀爬仍缺」；嫁接自 REACode/src/terraceladder.js，原版只读不改）。
 *
 * 来源帖子：781957658597269506（黄色浮岛：4 级台面、竖直崖壁、两处木梯跨层；梯脚都踩在下层台面、梯顶都搭在上层台沿）。
 * 原版做的事（行为照搬，默认参数下与原版逐值一致）：
 *   ladder(spec)：梯脚 = (崖面 x − run, 下层台面高)，梯顶 = (崖面 x, 上层台面高)，梯长 L = √(H² + run²)（不是层高 H），
 *   沿梯梁等距踏棍；三条验收量 footErr（梯脚离台面）、lipDist（台沿到梯梁的垂距）、shortGap（把层高当梯长差多少够不着）。
 * 重构版已有的相关落点：badnorth/battle-g3.js、world/battle-navigation.js（寻路避薄平台 + 按横档的攀爬动画），但那是战斗里的单位行为，
 * 不能在地形上「放梯子」，也没有原版 ladder / ladders / measure 这几个导出。
 *
 * 新增（原版没有）：
 *   fieldLadders：在任意方格高度场上，陡崖省里落差 minDrop..maxDrop 米、两侧不连通的崖边放梯子（同一套 ladder 几何，H = 落差）；
 *   thinLedges：overhang-terrain.js cliffLips 出来的岩檐里，厚度 ≤ maxThick 米的就是「薄台」，可站、要梯子上去；
 *   walkComponents：能走的邻边（坡度 ≤ walkSlope）+ 梯子连成的连通片；climbShare：崖边对里 6 步以内能上去的比例——梯子有没有用，看这个数涨没涨。
 * 和原版不同（登记在 catalog/parity/relief.ledge.json）：ladder(spec, cfg) 多一个可选 cfg（原版只读模块 CFG）；不传时一致。
 */
import { hash } from './overhang-terrain.js';

export const CFG = Object.freeze({
  H: 1.0,
  RAIL: 0.09,
  RUNG: 0.26,
  OVER: 0.12,
  TERRACES: Object.freeze([
    { k: 0, x0: 0.00, x1: 2.40 },
    { k: 1, x0: 2.40, x1: 4.50 },
    { k: 2, x0: 4.50, x1: 6.40 },
    { k: 3, x0: 6.40, x1: 8.00 },
  ]),
  LADDERS: Object.freeze([
    { id: 'A', face: 1, run: 0.22 },
    { id: 'B', face: 2, run: 0.40 },
    { id: 'C', face: 3, run: 0.62 },
  ]),
});

export const topZ = (k, cfg = CFG) => k * cfg.H;

export function ladder(spec, cfg = CFG) {
  const H = cfg.H;
  const upper = cfg.TERRACES[spec.face];
  const lower = cfg.TERRACES[spec.face - 1];
  const edgeX = upper.x0;
  const zLow = topZ(lower.k, cfg);
  const zHigh = topZ(upper.k, cfg);
  const foot = { x: edgeX - spec.run, z: zLow };
  const lip = { x: edgeX, z: zHigh };
  const dx = lip.x - foot.x, dz = lip.z - foot.z;
  const L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const head = { x: lip.x + ux * cfg.OVER, z: lip.z + uz * cfg.OVER };
  const n = Math.max(2, Math.floor((L + cfg.OVER) / cfg.RUNG));
  const rungs = [];
  for (let i = 1; i <= n; i++) {
    const t = (i * cfg.RUNG) / (L + cfg.OVER);
    rungs.push({ x: foot.x + (head.x - foot.x) * t, z: foot.z + (head.z - foot.z) * t });
  }
  const short = { x: foot.x + ux * H, z: foot.z + uz * H };
  return {
    ...spec,
    edgeX, zLow, zHigh, foot, lip, head, L, ux, uz, rungs,
    angle: Math.atan2(dx, dz) * 180 / Math.PI,
    footErr: Math.abs(foot.z - zLow),
    lipDist: Math.abs((lip.x - foot.x) * uz - (lip.z - foot.z) * ux),
    shortGap: L - H,
    short, rungCount: rungs.length,
  };
}

export function ladders(cfg = CFG) { return cfg.LADDERS.map((s) => ladder(s, cfg)); }

export function measure(cfg = CFG) {
  const ls = ladders(cfg);
  const gaps = ls.map((l) => l.shortGap);
  return {
    n: ls.length,
    footOn: ls.filter((l) => l.footErr < 1e-9).length,
    lipOn: ls.filter((l) => l.lipDist < 1e-9).length,
    angMin: +Math.min(...ls.map((l) => l.angle)).toFixed(1),
    angMax: +Math.max(...ls.map((l) => l.angle)).toFixed(1),
    gapMax: +Math.max(...gaps).toFixed(3),
    gapMin: +Math.min(...gaps).toFixed(3),
    lenMin: +Math.min(...ls.map((l) => l.L)).toFixed(3),
    lenMax: +Math.max(...ls.map((l) => l.L)).toFixed(3),
    rungs: ls.map((l) => l.rungCount),
    footInside: ls.filter((l) => {
      const lower = cfg.TERRACES[l.face - 1];
      return l.foot.x > lower.x0 + 0.02 && l.foot.x < lower.x1 - 0.02;
    }).length,
  };
}

/* ======================================================================
 * 推广到方格高度场（地貌管线用）。h 行优先米制（海 = NaN / ≤ 0），cell = 格宽米。
 * ====================================================================== */
const land = (v) => Number.isFinite(v) && v > 0;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 能走的邻边：两格都是陆地、都不是 blocked、坡度 ≤ walkSlope（度）。links = 额外的连接（梯子）[[a,b]]。 */
export function walkComponents(h, n, { cell = 3, walkSlope = 35, blocked = null, links = [] } = {}) {
  const maxStep = cell * Math.tan(walkSlope * Math.PI / 180), parent = new Int32Array(n * n).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const ok = (k) => land(h[k]) && !(blocked && blocked[k]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i; if (!ok(a)) continue;
    if (i + 1 < n && ok(a + 1) && Math.abs(h[a] - h[a + 1]) <= maxStep) join(a, a + 1);
    if (j + 1 < n && ok(a + n) && Math.abs(h[a] - h[a + n]) <= maxStep) join(a, a + n);
  }
  for (const [a, b] of links) if (ok(a) && ok(b)) join(a, b);
  const size = new Map(); let total = 0;
  for (let k = 0; k < n * n; k++) if (ok(k)) { total++; const r = find(k); size.set(r, (size.get(r) || 0) + 1); }
  const sizes = [...size.values()].sort((a, b) => b - a);
  return { land: total, components: sizes.length, largest: sizes[0] || 0, share: total ? (sizes[0] || 0) / total : 0, sizes: sizes.slice(0, 8), root: (k) => find(k) };
}

/** 可走邻接表（坡 ≤ walkSlope 的四邻 + links 梯子），给限深 BFS 用 */
function walkGraph(h, n, { cell = 3, walkSlope = 35, blocked = null, links = [] } = {}) {
  const maxStep = cell * Math.tan(walkSlope * Math.PI / 180), ok = (k) => land(h[k]) && !(blocked && blocked[k]), adj = Array.from({ length: n * n }, () => []);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i; if (!ok(a)) continue;
    if (i + 1 < n && ok(a + 1) && Math.abs(h[a] - h[a + 1]) <= maxStep) { adj[a].push(a + 1); adj[a + 1].push(a); }
    if (j + 1 < n && ok(a + n) && Math.abs(h[a] - h[a + n]) <= maxStep) { adj[a].push(a + n); adj[a + n].push(a); }
  }
  for (const [a, b] of links) if (ok(a) && ok(b)) { adj[a].push(b); adj[b].push(a); }
  return { adj, ok };
}
/** a 到 b 在 within 步（走一格或爬一把梯子算一步）以内走得到吗 */
function within(adj, a, b, steps) {
  if (a === b) return true;
  let front = [a]; const seen = new Set([a]);
  for (let d = 0; d < steps && front.length; d++) { const next = []; for (const x of front) for (const y of adj[x]) { if (seen.has(y)) continue; if (y === b) return true; seen.add(y); next.push(y); } front = next; }
  return false;
}
/** 崖边对：相邻两格（都是可走陆地），高差 minDrop..maxDrop 米。b = 高的那格 */
function cliffPairs(h, n, { minDrop = 2, maxDrop = 9, blocked = null, sharp = null, sharpMin = 0 } = {}) {
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const b = j * n + i; if (!land(h[b]) || (blocked && blocked[b]) || (sharp && sharp[b] < sharpMin)) continue;
    for (const [di, dj] of D4) {
      const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const a = y * n + x; if (!land(h[a]) || (blocked && blocked[a])) continue;
      const drop = h[b] - h[a]; if (drop >= minDrop && drop <= maxDrop) out.push({ a, b, i, j, di, dj, drop });
    }
  }
  return out;
}

/**
 * 崖边攀爬率：崖边对（高差 minDrop..maxDrop 米的相邻两格）里，steps 步以内能从下面走 / 爬到上面的比例。
 * 只看产出的高度场 + 梯子，与能力参数无关——擂台的「薄台与攀爬」指标。
 */
export function climbShare(h, n, { cell = 3, walkSlope = 35, blocked = null, links = [], minDrop = 2, maxDrop = 9, steps = 6 } = {}) {
  const { adj } = walkGraph(h, n, { cell, walkSlope, blocked, links }), pairs = cliffPairs(h, n, { minDrop, maxDrop, blocked });
  if (!pairs.length) return { pairs: 0, ok: 0, share: 1 };
  let ok = 0; for (const p of pairs) if (within(adj, p.a, p.b, steps)) ok++;
  return { pairs: pairs.length, ok, share: ok / pairs.length };
}

/**
 * 在崖边放梯子：崖边对（高差 minDrop..maxDrop 米）里，下面那格 steps 步以内走不到上面那格（要绕很远或根本上不去），就在这条崖边放一把梯子。
 * 梯子几何用原版 ladder()：一级台面高 = 落差，run = runFrac × 落差（倾角固定），所以梯长 = 落差 × √(1 + runFrac²)。
 * 候选按落差小 + 哈希排序（先放短梯）；每放一把就把它加进可走图，附近同一段崖就不用再放。最多 maxLadders 把。
 * 返回 [{ a, b, i, j, di, dj, low, high, drop, run, L, angle, rungs, footErr, lipDist, shortGap }]（a = 梯脚格，b = 梯顶格）。
 */
export function fieldLadders(h, n, { cell = 3, walkSlope = 35, minDrop = 2, maxDrop = 9, runFrac = 0.35, maxLadders = 24, blocked = null, sharp = null, sharpMin = 0.38, seed = 7, steps = 6 } = {}) {
  const g = walkGraph(h, n, { cell, walkSlope, blocked });
  const cand = cliffPairs(h, n, { minDrop, maxDrop, blocked, sharp, sharpMin }).map((c) => ({ ...c, r: hash(c.i * 7 + c.di + 3, c.j * 13 + c.dj + 5, seed) }));
  cand.sort((p, q) => p.drop - q.drop || p.r - q.r || p.b - q.b || p.a - q.a);
  const out = [];
  for (const c of cand) {
    if (out.length >= maxLadders) break;
    if (within(g.adj, c.a, c.b, steps)) continue;
    g.adj[c.a].push(c.b); g.adj[c.b].push(c.a);
    const cfg = { ...CFG, H: c.drop, TERRACES: [{ k: 0, x0: 0, x1: cell }, { k: 1, x0: cell, x1: 2 * cell }] };
    const L = ladder({ id: 'f' + out.length, face: 1, run: runFrac * c.drop }, cfg);
    out.push({ a: c.a, b: c.b, i: c.i, j: c.j, di: c.di, dj: c.dj, low: h[c.a], high: h[c.b], drop: +c.drop.toFixed(3), run: +(runFrac * c.drop).toFixed(3), L: +L.L.toFixed(3), angle: +L.angle.toFixed(1), rungs: L.rungCount, footErr: L.footErr, lipDist: L.lipDist, shortGap: +L.shortGap.toFixed(3) });
  }
  return out;
}

/** 薄台：岩檐里厚度 ≤ maxThick 米的（可站、要梯子上去）；返回 [{ i, j, di, dj, top, thick, clear }] */
export function thinLedges(lips = [], { maxThick = 2 } = {}) {
  return lips.filter((l) => l.top - l.bottom <= maxThick).map((l) => ({ i: l.i, j: l.j, di: l.di, dj: l.dj, top: l.top, thick: +(l.top - l.bottom).toFixed(3), clear: +(l.bottom - l.under).toFixed(3) }));
}
