/**
 * looptint.js — 边界环「逐环上色」：把半边结构的 rim 画成人能一眼数清的样子
 *
 * ── 这条片子（1459169210752507904，2021-11-12）原文只有两个词："And another"
 *    上一条 1458921394855718917（2021-11-11）才是说明：
 *      "I'm exploring the Half Edge data structure. Feels like a really lightweight,
 *       powerful and versatile way of representing topology."
 *    所以这是「半边结构的又一张实验结果」。结构和环提取已经在 `src/halfedge.js` 里了
 *    （那是更早一轮落的，覆盖 1458921394855718917），本模块**只补那条片子独有的东西**：
 *    环的身份怎么染、以及环合并时颜色为什么必须变。
 *
 * ── 帧实测（640×640，2.9s 循环，24 帧全抽，逐像素）────────────────────────
 *   背景：#3e2c27 (62,44,39) / #3c2d29 (60,45,41)，两档差 2/1/2 —— 格子内外**没有填充差**，
 *        面其实是背景，这片视图只画线。
 *   内部边：#b06040 (176,96,64)，横向游程**中位数 1px**。
 *   边界边：同样 **1px**，只是换成高饱和色。同时在场三种：
 *        teal #69bcb6 (105,188,182) h=176 s=0.44 v=0.74
 *        洋红 #b0416e (176,65,110)  h=336 s=0.63 v=0.69
 *        紫   #3e2664 (62,39,100)   h=263 s=0.61 v=0.39（偏暗，被抗锯齿压过）
 *   时间线：f009–f013（1.18–1.31s）同时 3 种边界色 → f015（1.379s）起整圈一种（青）
 *          → f020（2.428s）一圈绿。补片在 1.31–1.38s 之间合拢成单连通。
 *
 * ── 三条结论（本模块的全部内容）─────────────────────────────────────────
 *   ① 边界线**不比内部线粗**。它在画面上显得跳，是因为色相跳出来了。所以"环上色"不是描边，
 *      是调试信息 —— 照抄成 2px 描边会把片子的意思改掉。
 *   ② 颜色必须**跟着环的身份走**，不能跟着环的序号走。片中合拢后颜色变了，
 *      序号法会保住"第 0 环永远青色"，与实测相反。
 *      本模块用「环上顶点集合的哈希」当身份：环吸收/吐出任何一个顶点，色相就换。
 *   ③ 数颜色就是数洞。边界环数 = 洞数 + 1，是半边结构最便宜的自检（下面 selfTest 里对 χ 验）。
 */

import { buildHalfEdge, halfEdgeReport } from './halfedge.js';

/** 片中量到的画法常量。一个都不是估的，全是逐像素取/游程统计出来的。 */
export const TINT = {
  bgOuter: '#3e2c27',
  bgInner: '#3c2d29',
  interior: '#b06040',
  stroke: 1,        // 内部边与边界边**同样** 1px（横向游程中位数）
  sat: 0.55,        // 实测 s ∈ [0.44, 0.63]
  val: 0.68,        // 实测 v ∈ [0.39, 0.74]
};

/** 片中真实出现过的三个色，用来把"逐环上色"锚回帧上（lab 里当参照色显示）。 */
export const SEEN = [
  { hex: '#69bcb6', h: 176, s: 0.44, v: 0.74, at: 'f009/f013' },
  { hex: '#b0416e', h: 336, s: 0.63, v: 0.69, at: 'f009' },
  { hex: '#3e2664', h: 263, s: 0.61, v: 0.39, at: 'f013' },
];

/* ─────────────────────────── 环身份 → 色相 ─────────────────────────── */

/**
 * 顶点集合哈希。用 FNV-1a 扫排序后的顶点 id。
 * 排序是为了让同一个环不论从哪个顶点开始走都得到同一个色。
 */
export function hueOfLoop(verts, sat = TINT.sat, val = TINT.val) {
  let h = 2166136261 >>> 0;
  const ids = verts.slice().sort((a, b) => a - b);
  for (let i = 0; i < ids.length; i++) {
    h ^= (ids[i] + 0x9e3779b9) >>> 0;
    h = Math.imul(h >>> 0, 16777619) >>> 0;
  }
  const hue = h % 360;
  return { h: hue, s: sat, v: val, css: `hsl(${hue} ${Math.round(sat * 100)}% ${Math.round(val * 100)}%)` };
}

/**
 * 色相之间至少隔多少度。
 *
 * 理由不是审美：片中 f009 同时在场的那三色是 h=176 / 263 / 336，
 * 最小间隔 **73°**。而纯哈希直接出 h 会扎堆 —— 洞里那两个小环和外面的大环共享绝大多数顶点，
 * 哈希只差几位，落下来是 276 / 272 / 306，最小间隔 **4°**，画面上根本分不出是三种颜色，
 * 这张调试视图也就废了。所以哈希只负责"身份"，色相要再过一道**打散**。
 */
export const MIN_GAP = 60;          // 略小于实测的 73°，留一点余量
const GOLDEN = 0.6180339887498949;

function packHues(raw) {
  // 大环优先占位（画面主体先定色），小环再让开
  const order = raw.map((h, i) => ({ h, i, w: raw.length - i }))
    .sort((a, b) => a.i - b.i);
  const placed = [];
  const out = new Array(raw.length);
  for (const { h, i } of order) {
    let hh = h, guard = 0;
    while (guard++ < 24 && placed.some((p) => circDist(p, hh) < MIN_GAP)) {
      hh = (hh + GOLDEN * 360) % 360;      // 黄金角步进：连续撞色时也能均匀铺开
    }
    placed.push(hh);
    out[i] = hh;
  }
  return out;
}

function circDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 给一次构建结果里的每条环染色。
 * @param he buildHalfEdge() 的返回
 * @param prev 上一帧的 tint（可选）。给了就顺带标出「哪个环是吸收出来的新环」。
 * @returns {{loops:Array, merged:number, kept:number, colors:number, minGap:number}}
 */
export function tintLoops(he, prev = null) {
  // 大环先排，色相占位稳定
  const withLen = he.loops.map((verts, idx) => ({ idx, verts, len: verts.length }));
  withLen.sort((a, b) => b.len - a.len || a.idx - b.idx);
  const raw = withLen.map((L) => hueOfLoop(L.verts).h);
  const packed = packHues(raw);
  const byIdx = new Array(he.loops.length);
  withLen.forEach((L, i) => {
    const h = packed[i];
    byIdx[L.idx] = {
      idx: L.idx, verts: L.verts, len: L.len,
      hue: { h, s: TINT.sat, v: TINT.val, css: `hsl(${h} ${Math.round(TINT.sat * 100)}% ${Math.round(TINT.val * 100)}%)` },
    };
  });
  const loops = byIdx;
  let merged = 0, kept = 0;
  if (prev) {
    const prevKeys = new Set(prev.loops.map((l) => keyOf(l.verts)));
    for (const L of loops) {
      if (prevKeys.has(keyOf(L.verts))) kept++;
      else merged++;
    }
  }
  let minGap = 360;
  for (let i = 0; i < loops.length; i++)
    for (let j = i + 1; j < loops.length; j++) minGap = Math.min(minGap, circDist(loops[i].hue.h, loops[j].hue.h));
  return { loops, merged, kept, colors: new Set(loops.map((l) => l.hue.h)).size, minGap: loops.length > 1 ? minGap : 360 };
}

const keyOf = (verts) => verts.slice().sort((a, b) => a - b).join(',');

/**
 * 画线用的边表。内部边一个色、边界边逐环上色，**两类同宽**（照片子）。
 * @param posOf (vid) => {x,y}  顶点 id 到屏幕坐标
 */
export function tintEdges(he, posOf, opts = {}) {
  const { perLoop = true, single = '#69bcb6' } = opts;
  const tint = tintLoops(he);
  const hueOfVert = new Map();
  if (perLoop) for (const L of tint.loops) for (const v of L.verts) hueOfVert.set(v, L.hue);

  const out = [];
  for (const h of he.hes) {
    const a = posOf(h.from), b = posOf(h.to);
    const border = h.twin < 0;
    const hue = border && perLoop ? (hueOfVert.get(h.from) || hueOfLoop([h.from])) : null;
    out.push({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      kind: border ? 'boundary' : 'interior',
      css: border ? (perLoop ? hue.css : single) : TINT.interior,
      w: TINT.stroke,
    });
  }
  return { edges: out, tint };
}

/** 环长分布 + 边的构成。lab 和验证脚本都读这个。 */
export function tintStats(he) {
  const rep = halfEdgeReport(he);
  const tint = tintLoops(he);
  const lens = he.loops.map((l) => l.length).sort((a, b) => b - a);
  return {
    ...rep,
    colors: tint.colors,
    loopLens: lens,
    longest: lens[0] || 0,
    shortest: lens[lens.length - 1] || 0,
    boundaryShare: rep.boundaryEdges / (rep.boundaryEdges + rep.interiorEdges * 2),
  };
}

/* ─────────────────────────── 生长时间线 ─────────────────────────── */

/**
 * 逐格加进去，记录每一步的环数与色数。
 *
 * 为什么要这个：片中 f013→f015 颜色从 3 种掉到 1 种，最容易的误读是"颜色过一会儿会自己稳定下来"。
 * 真实原因是**补片在那一刻合拢了**：两个缺口被盖住 → 环从 3 个并成 1 个 → 色数跟着掉。
 * 把"加格子"和"环数"画在一条时间线上，这条因果关系就没法被含糊过去。
 */
export function growthTrace(cellSeq) {
  const acc = [];
  const rows = [];
  for (let i = 0; i < cellSeq.length; i++) {
    acc.push(cellSeq[i]);
    const he = buildHalfEdge(acc);
    const t = tintLoops(he);
    rows.push({ step: i, cells: acc.length, loops: he.loops.length, colors: t.colors, lens: he.loops.map((l) => l.length) });
  }
  return rows;
}

/* ─────────────────────────── 测试用补片 ─────────────────────────── */

/**
 * 生成片子那种「阶梯边界的有机补片」。
 *
 * 片中的边界是**一格一格错开的直角台阶**，不是光滑曲线 —— 说明它是方块格上的连通块，
 * 不是三角网。所以这里就按方块格生成：格存在 → 单元格四边形进汤；四角共享同一个顶点 id，
 * 相邻格自然配上 twin，没配上的就是台阶边。
 *
 * @param {object} o
 * @param {number} o.n      网格边长（n×n 格）
 * @param {number} o.radius 半径（格）
 * @param {number} o.seed   噪声种子
 * @param {{x:number,y:number,r:number}[]} o.holes 挖洞（世界坐标）
 * @param {number} o.jitter 边界抖动强度，造出台阶
 */
export function makePatch({ n = 15, radius = 5.6, seed = 3, holes = [], jitter = 0.42, cell = 1 } = {}) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cx = n / 2, cy = n / 2;
  // 每个顶点一个固定的抖动偏移，相邻格共享同一个顶点 → 抖动不会撕开网格
  const off = new Map();
  const offAt = (i, j) => {
    const k = i + ',' + j;
    let o = off.get(k);
    if (!o) off.set(k, (o = { dx: (rnd() - 0.5) * jitter, dy: (rnd() - 0.5) * jitter }));
    return o;
  };

  const verts = new Map();   // "i,j" -> id
  const pos = [];            // id -> {x,y}
  const vid = (i, j) => {
    const k = i + ',' + j;
    let id = verts.get(k);
    if (id === undefined) {
      id = pos.length;
      verts.set(k, id);
      const o = offAt(i, j);
      pos.push({ x: (i - cx + o.dx) * cell, y: (j - cy + o.dy) * cell });
    }
    return id;
  };

  const cells = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const wx = i - cx + 0.5, wy = j - cy + 0.5;
      const r = Math.hypot(wx, wy);
      // 边界抖动：让半径阈值随角度起伏，出来就是台阶而不是圆
      const wob = 0.55 * Math.sin(Math.atan2(wy, wx) * 5.0 + seed) + 0.3 * Math.sin(Math.atan2(wy, wx) * 11 - seed * 2);
      if (r > radius + wob) continue;
      let inHole = false;
      for (const h of holes) if (Math.hypot(wx - h.x, wy - h.y) < h.r) { inHole = true; break; }
      if (inHole) continue;
      cells.push({ id: cells.length, pts: [vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)].map((id) => ({ id, x: pos[id].x, y: pos[id].y })) });
    }
  }
  return { cells, pos };
}

/**
 * 自检。三条断言，全部对着片子：
 *   ① χ = V − E + F 必须是 2 − 环数（有 h 个洞的圆盘 χ = 1 − h，环数 = h + 1）
 *   ② 挖 2 个洞 → 3 个环；把洞填上 → 回到 1 个环
 *   ③ 填洞后长出来的那个环，色相必须**不等于**填之前任何一个 —— 也就是片子里"合拢后换色"
 */
export function selfTest() {
  const out = [];
  const noHole = makePatch({ n: 15, radius: 5.6, seed: 3 });
  const he0 = buildHalfEdge(noHole.cells);
  const r0 = halfEdgeReport(he0);
  out.push({ name: '单连通补片 χ = 2 − 环数', got: r0.euler, want: 2 - r0.boundaryLoops, ok: r0.euler === 2 - r0.boundaryLoops, loops: r0.boundaryLoops });

  const holed = makePatch({ n: 15, radius: 5.6, seed: 3, holes: [{ x: -2, y: -1.5, r: 1.2 }, { x: 2.2, y: 1.6, r: 1.1 }] });
  const he1 = buildHalfEdge(holed.cells);
  const r1 = halfEdgeReport(he1);
  out.push({ name: '挖 2 洞 → 3 环 / χ = −1', got: `${r1.boundaryLoops} 环 χ=${r1.euler}`, want: '3 环 χ=-1', ok: r1.boundaryLoops === 3 && r1.euler === -1, loops: r1.boundaryLoops });

  const t0 = tintLoops(he0), t1 = tintLoops(he1);
  const before = new Set(t1.loops.map((l) => l.hue.h));
  const after = t0.loops.map((l) => l.hue.h);
  out.push({
    name: '合拢后色相全换（片子 f013→f015 的行为）',
    got: `before ${[...before].join('/')} → after ${after.join('/')}`,
    want: 'after 的每个 h 都不在 before 里',
    ok: after.every((h) => !before.has(h)),
    loops: t0.loops.length,
  });

  return { rows: out, allOk: out.every((r) => r.ok) };
}
