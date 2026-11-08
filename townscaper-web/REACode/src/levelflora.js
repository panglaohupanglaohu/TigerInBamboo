/**
 * levelflora.js — 草木不是"一张图撒满全岛"，是**每层台地一套草型**。
 *
 * 帖子 ID：959530111187013632（2017-11-16，Bad North）
 *   "I've been tweaking the foliage system today. It now supports multiple grass
 *    types per level."
 *   画面（6 帧，512²）：灰白台地岛，能数出 3~4 级台面。低位是**大片白色小花**
 *   铺成的草甸；往上第二级换成一丛丛更深的圆叶灌木；再一级是细高的草和树；
 *   最高那块台面上立着松树和一栋白墙绿顶小屋。同一块台面内部，草型是成丛的
 *   （一丛灌木直径大约 2~3 格），不是逐格换色。玩家小队举着粉/青/黄/紫四面
 *   徽记旗站在不同级的台面上。
 *
 * 为什么这么做（而不是"全岛一个 palette 随机撒"）：
 *   等距视角里地形的高度信息本来就很弱（上移 8px 可能就是高一级），
 *   一眼读不出高差。当"草型"和"台地层"绑定时，草型就成了**高度图例**：
 *   看到白花就知道是最低的湿草地，看到松树就知道是最高的岩台。
 *   反过来，全套草型在每一层都出现，草型就不再携带任何高度信息。
 *
 * 本文件把两种做法摆在一起，用四个数说话（见 measure）：
 *   跨层共用的草型数 / 仅凭草型反推层高的准确率 / 成丛直径 / 植被覆盖率。
 *   注意"反推准确率"的基线不是 0：4 层时瞎猜也有 25%。
 */

export const CELL = 1.0;
export const LEVEL_H = 0.9;        // 一级台面的高度（与 unitsnap 的 STEP 同量级）

/** 草型：shape 决定怎么画，不引入贴图。 */
export const SPECIES = {
  meadow:  { name: '白花草甸', shape: 'dots',    col: '#f4f6ee', hi: '#ffffff', base: '#dfe8d2' },
  clover:  { name: '三叶矮草', shape: 'tuft',    col: '#9cc48a', hi: '#b8d9a6', base: '#8ab473' },
  tallgrass:{ name: '高草',    shape: 'blade',   col: '#7fae6a', hi: '#a6c98c', base: '#6b9a58' },
  fern:    { name: '蕨',       shape: 'fan',     col: '#5f9a63', hi: '#82bd83', base: '#4c8352' },
  shrub:   { name: '圆叶灌木', shape: 'puff',    col: '#3f7a52', hi: '#61a06f', base: '#325f40' },
  heather: { name: '石南',     shape: 'dots',    col: '#b6a0d8', hi: '#cdbdea', base: '#9a83bd' },
  pine:    { name: '松',       shape: 'conifer', col: '#2e6248', hi: '#3f7a5c', base: '#244d38' },
  rock:    { name: '裸岩苔',   shape: 'tuft',    col: '#a8b0a4', hi: '#c4cbc0', base: '#8f978c' },
};

/** 每层一套 palette（这是帖子说的 "multiple grass types per level"）。 */
export const PALETTES = [
  ['meadow', 'clover'],                 // 0 最低：湿草甸
  ['tallgrass', 'fern'],                // 1
  ['shrub', 'heather'],                 // 2
  ['pine', 'rock'],                     // 3 最高：岩台
];

/** 对照：全岛共用一套（前一轮 grasscards/edgeplant 的做法）。 */
export const GLOBAL_PALETTE = ['meadow', 'fern', 'shrub'];

const mulberry = (s) => () => {
  s |= 0; s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** 台地：以岛心为圆心的同心台阶 + 低频噪声，保证台面成片、层界是硬折线。 */
export function buildTerrain(n = 22, seed = 7) {
  const cells = [];
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const r = Math.hypot(dx, dy);
      const wob = 0.16 * Math.sin(x * 0.55 + 1.3) + 0.13 * Math.cos(y * 0.48 - 0.7);
      const land = r + wob < 0.98;
      const raw = (0.98 - r - wob) / 0.24;         // 外低内高：0.24 一格台地，四圈台面
      const level = Math.max(0, Math.min(3, Math.floor(raw)));
      cells.push({ x, y, land, level: land ? level : -1, height: land ? level * LEVEL_H : 0 });
    }
  }
  return { n, cells, byKey: new Map(cells.map((c2) => [c2.y * n + c2.x, c2])) };
}

export function levelAt(terr, x, y) {
  const c = terr.byKey.get(((y | 0) + terr.n * 0) + (x | 0));
  return c ? c.level : -1;
}

/**
 * 撒草：先按层选 palette，再在层内**成丛**落点。
 * 丛心用格坐标 hash 定，丛内个体数 4~9 —— 这就是截图里"一丛 2~3 格宽"的来源。
 */
export function buildFlora(terr, { mode = 'perLevel', seed = 11, density = 0.55 } = {}) {
  const rnd = mulberry(seed);
  const clusters = [];
  for (const c of terr.cells) {
    if (!c.land) continue;
    const pal = mode === 'perLevel'
      ? PALETTES[Math.min(PALETTES.length - 1, c.level)]
      : GLOBAL_PALETTE;
    const d = density * (0.55 + 0.45 * rnd());       // 层内覆盖率抖动
    if (rnd() > d) continue;                          // 这一格没有丛
    const sp = pal[(rnd() * pal.length) | 0];         // 丛内**统一**一个草型
    const count = 4 + ((rnd() * 6) | 0);
    const items = [];
    const rad = 0.20 + rnd() * 0.26;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * rad;
      items.push({
        x: c.x + 0.5 + Math.cos(a) * rr,
        y: c.y + 0.5 + Math.sin(a) * rr,
        s: 0.55 + rnd() * 0.7,
        sp,
      });
    }
    clusters.push({ cx: c.x + 0.5, cy: c.y + 0.5, level: c.level, sp, items, rad });
  }
  return { mode, clusters };
}

/** 一个"成丛"的直径（世界单位，格宽）：2×最大落点半径 + 个体自身尺寸。 */
export function clusterSpread(cl) {
  let mx = 0;
  for (const it of cl.items) mx = Math.max(mx, Math.hypot(it.x - cl.cx, it.y - cl.cy));
  return 2 * mx + 0.35;
}

export function measure(terr, flora) {
  const landCells = terr.cells.filter((c) => c.land);
  const area = landCells.length;

  // 每层出现的草型
  const perLevel = new Map();
  for (const cl of flora.clusters) {
    if (!perLevel.has(cl.level)) perLevel.set(cl.level, new Set());
    perLevel.get(cl.level).add(cl.sp);
  }
  const levels = [...perLevel.keys()].sort();
  const sets = levels.map((l) => perLevel.get(l));

  // 跨层共用：某个草型出现在 >1 层
  const seen = new Map();
  for (const s of sets) for (const sp of s) seen.set(sp, (seen.get(sp) || 0) + 1);
  const shared = [...seen.entries()].filter(([, k]) => k > 1);

  // 仅凭草型反推层高：草型 → 它出现最多的那一层
  const vote = new Map();
  for (const [i, l] of levels.entries()) {
    for (const sp of sets[i]) {
      if (!vote.has(sp)) vote.set(sp, new Map());
      const m = vote.get(sp);
      m.set(l, (m.get(l) || 0) + 1);
    }
  }
  const guess = new Map();
  for (const [sp, m] of vote) {
    guess.set(sp, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  let hit = 0, tot = 0;
  for (const cl of flora.clusters) {
    tot++;
    if (guess.get(cl.sp) === cl.level) hit++;
  }

  // 覆盖率 & 成丛直径 & 边缘/内部密度
  const touched = new Map();
  for (const cl of flora.clusters) touched.set(cl.level, (touched.get(cl.level) || 0) + 1);
  const floraArea = [];
  for (const cl of flora.clusters) {
    const r = clusterSpread(cl) / 2;
    floraArea.push(Math.PI * r * r * 0.62);   // 丛内是散点，不是实心圆
  }
  const cover = floraArea.reduce((a, b) => a + b, 0) / area;

  let edgeCl = 0, edgeCells = 0, inCl = 0, inCells = 0;
  const clAt = new Set(flora.clusters.map((c) => (c.cy | 0) * terr.n + (c.cx | 0)));
  for (const c of landCells) {
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = terr.byKey.get((c.y + dy) * terr.n + (c.x + dx));
      if (!nb || !nb.land || nb.level !== c.level) { edge = true; break; }
    }
    const has = clAt.has(c.y * terr.n + c.x);
    if (edge) { edgeCells++; if (has) edgeCl++; } else { inCells++; if (has) inCl++; }
  }

  const spreads = flora.clusters.map(clusterSpread);
  const byLevel = levels.map((l, i) => ({
    level: l,
    cells: landCells.filter((c) => c.level === l).length,
    clusters: touched.get(l) || 0,
    species: [...sets[i]],
  }));

  return {
    mode: flora.mode,
    levels: levels.length,
    landCells: area,
    clusters: flora.clusters.length,
    speciesUsed: [...seen.keys()].length,
    sharedSpecies: shared.length,
    sharedDetail: shared.map(([sp, k]) => `${SPECIES[sp].name}×${k}`),
    levelFromSpecies: tot ? hit / tot : 0,
    baseline: 1 / levels.length,
    cover,
    meanSpread: spreads.reduce((a, b) => a + b, 0) / spreads.length,
    edgeDensity: edgeCells ? edgeCl / edgeCells : 0,
    innerDensity: inCells ? inCl / inCells : 0,
    byLevel,
  };
}
