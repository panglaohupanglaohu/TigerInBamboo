/**
 * partsprites.js — 一张图集、一个身体、可替换部件：所有变体都不新增贴图。
 *
 * 原文（x.com/OskSta/status/847717312912211970, 2017-03-31）：
 *
 *   "Phew.. I wanted interchangeable parts AND only 1 sprite per character.
 *    This is what I came up with. Don't try this at home kids"
 *
 * 画面（24 帧，200px 见方，深灰编辑器底）：同一个维京小人被换了十几次装备 ——
 *   · 棕绿身子 + 蓝盾 + 红剑（0/1 帧、8~12 帧、18~21 帧）
 *   · 红剑举过头顶 / 红披风张开盖住半个身子（2/3 帧、13 帧）
 *   · 蓝袍 + 白法杖 + 尖帽（22 帧）
 *   · 一整片白色飘带飞出去（23 帧）
 * 但**身子几乎不动**，动的都是"挂上去的部件"；且每次只变一两个部件。
 * 这就是原文的两个约束同时成立的样子：可换部件（interchangeable）+
 * 每个角色只有一张贴图（1 sprite per character）。
 *
 * 怎么做到"一张图里装下所有部件"：
 *   ① 一张图集，按格子切出 body / shield / axe / banner / cape / hat 六块；
 *   ② 每个部件记一个**插槽**：贴图索引 + 相对身体的锚点 + 绘制顺序 + 是否镜像；
 *   ③ 组合时只按顺序 drawImage 六次（缺的部件跳过），**不生成新贴图**。
 * 于是 2^6=64 种外观共用一张 128×96 的图集，内存是常数。
 *
 * "Don't try this at home" 的坑，我在下面都标了：
 *   · 绘制顺序（披风必须在身体**后**画、盾**前**画、帽**最前**画），
 *     顺序错了就是"盾在背后飘""帽子被剑穿"；
 *   · 锚点必须相对**身体包围盒**而不是图集绝对坐标，否则换身体尺寸全错；
 *   · 部件不能各自铺满格子，得留出**溢出空间**（剑举过头顶会画出身体框外）。
 */

const ATLAS_W = 128;
const ATLAS_H = 96;

/**
 * 一张图集，六个格子。整个模块只有这一个 canvas —— 所有变体都从它身上切。
 * 用 module 级常量，任何一批单位共享同一张，不随实例增长。
 */
let ATLAS = null;

export const CELL = {
  body:   { x: 0,  y: 0,  w: 32, h: 48 },
  shield: { x: 32, y: 0,  w: 24, h: 24 },
  axe:    { x: 56, y: 0,  w: 24, h: 32 },
  banner: { x: 80, y: 0,  w: 24, h: 48 },
  cape:   { x: 0,  y: 48, w: 40, h: 32 },
  hat:    { x: 40, y: 48, w: 28, h: 20 },
};

/**
 * 插槽表。锚点是**相对身体框左下角**的像素偏移（身体框 = CELL.body 的 w×h），
 * 单位已经在图集分辨率里。order 决定绘制顺序，fits 决定是否镜像。
 *
 * 为什么锚点相对身体：不同身材（比如"大块头"）只要换 CELL.body 的尺寸，
 * 所有部件自动跟着走；如果锚点是图集绝对坐标，换身材就得手改六个数字。
 */
export const SLOTS = {
  body:   { cell: 'body',   ax: 0,   ay: 0,   order: 0, flip: false },
  cape:   { cell: 'cape',   ax: -4,  ay: 0,   order: 1, flip: false },  // 身体之后
  weapon: { cell: 'axe',    ax: 18,  ay: 22,  order: 2, flip: false },
  shield: { cell: 'shield', ax: -8,  ay: 14,  order: 3, flip: false },  // 身体之前
  banner: { cell: 'banner', ax: 22,  ay: 30,  order: 3, flip: false },
  hat:    { cell: 'hat',    ax: 4,   ay: 44,  order: 4, flip: false },  // 最后
};

export const VARIANTS = ['body', 'shield', 'weapon', 'banner', 'cape', 'hat'];

function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

/** 造图集（只跑一次）。每个格子画一个部件，留够溢出空间。 */
export function buildAtlas() {
  if (ATLAS) return ATLAS;
  const c = document.createElement('canvas');
  c.width = ATLAS_W; c.height = ATLAS_H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, ATLAS_W, ATLAS_H);
  const OUT = '#eef4f8';

  // --- body：棕绿身子 + 蓝盔，朝右 ---
  {
    const { x, y, w, h } = CELL.body;
    g.save(); g.translate(x, y);
    g.fillStyle = OUT; g.beginPath();
    g.moveTo(w * 0.22, h); g.lineTo(w * 0.30, h * 0.42);
    g.lineTo(w * 0.70, h * 0.42); g.lineTo(w * 0.78, h); g.closePath(); g.fill();
    g.fillStyle = '#6b5a2e'; g.beginPath();
    g.moveTo(w * 0.27, h - 1); g.lineTo(w * 0.34, h * 0.44);
    g.lineTo(w * 0.66, h * 0.44); g.lineTo(w * 0.73, h - 1); g.closePath(); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.arc(w * 0.5, h * 0.26, w * 0.24, 0, 7); g.fill();
    g.fillStyle = '#57c24a'; g.beginPath();
    g.moveTo(w * 0.26, h * 0.28); g.lineTo(w * 0.5, h * 0.04);
    g.lineTo(w * 0.74, h * 0.28); g.closePath(); g.fill();
    g.restore();
  }
  // --- shield：蓝盾，白边 ---
  {
    const { x, y, w, h } = CELL.shield;
    g.save(); g.translate(x, y);
    g.fillStyle = OUT; g.beginPath();
    g.moveTo(w * 0.5, 0); g.lineTo(w, h * 0.25); g.lineTo(w * 0.5, h);
    g.lineTo(0, h * 0.25); g.closePath(); g.fill();
    g.fillStyle = '#5a9fd6'; g.beginPath();
    g.moveTo(w * 0.5, 2); g.lineTo(w - 2, h * 0.27); g.lineTo(w * 0.5, h - 2);
    g.lineTo(2, h * 0.27); g.closePath(); g.fill();
    px(g, w * 0.44, h * 0.18, w * 0.12, h * 0.5, '#eef4f8');
    g.restore();
  }
  // --- axe：红杆 + 钢刃（刃朝右，就是原文说的"翻转会露馅"的那种） ---
  {
    const { x, y, w, h } = CELL.axe;
    g.save(); g.translate(x, y);
    px(g, w * 0.30, h * 0.10, w * 0.14, h * 0.9, OUT);
    px(g, w * 0.33, h * 0.10, w * 0.08, h * 0.9, '#c0392b');
    g.fillStyle = OUT; g.beginPath();
    g.moveTo(w * 0.42, h * 0.10); g.quadraticCurveTo(w * 0.95, h * 0.06, w * 0.86, h * 0.42);
    g.quadraticCurveTo(w * 0.60, h * 0.30, w * 0.42, h * 0.34); g.closePath(); g.fill();
    g.fillStyle = '#b9c7d2'; g.beginPath();
    g.moveTo(w * 0.44, h * 0.13); g.quadraticCurveTo(w * 0.88, h * 0.10, w * 0.80, h * 0.38);
    g.quadraticCurveTo(w * 0.58, h * 0.29, w * 0.44, h * 0.32); g.closePath(); g.fill();
    g.restore();
  }
  // --- banner：红旗 + 白徽记 ---
  {
    const { x, y, w, h } = CELL.banner;
    g.save(); g.translate(x, y);
    px(g, w * 0.10, 0, 3, h, '#eef4f8');
    g.fillStyle = '#d8453c'; g.beginPath();
    g.moveTo(w * 0.16, h * 0.06); g.lineTo(w, h * 0.06);
    g.lineTo(w * 0.86, h * 0.30); g.lineTo(w, h * 0.54);
    g.lineTo(w * 0.16, h * 0.54); g.closePath(); g.fill();
    px(g, w * 0.42, h * 0.20, w * 0.14, h * 0.16, '#f7f2ea');
    px(g, w * 0.52, h * 0.20, w * 0.10, h * 0.22, '#f7f2ea');
    g.restore();
  }
  // --- cape：白披风，右缘飘出身体外 ---
  {
    const { x, y, w, h } = CELL.cape;
    g.save(); g.translate(x, y);
    g.fillStyle = '#dfe6ec'; g.beginPath();
    g.moveTo(w * 0.30, 0);
    g.quadraticCurveTo(w * 1.0, h * 0.25, w * 0.92, h);
    g.quadraticCurveTo(w * 0.55, h * 0.86, w * 0.26, h * 0.92);
    g.closePath(); g.fill();
    g.strokeStyle = '#b9c7d2'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  // --- hat：尖顶蓝帽 ---
  {
    const { x, y, w, h } = CELL.hat;
    g.save(); g.translate(x, y);
    g.fillStyle = OUT; g.beginPath();
    g.moveTo(w * 0.10, h); g.lineTo(w * 0.52, h * 0.06); g.lineTo(w * 0.92, h);
    g.closePath(); g.fill();
    g.fillStyle = '#2f6ea8'; g.beginPath();
    g.moveTo(w * 0.16, h - 2); g.lineTo(w * 0.52, h * 0.14); g.lineTo(w * 0.86, h - 2);
    g.closePath(); g.fill();
    g.restore();
  }

  ATLAS = { canvas: c, cells: CELL, w: ATLAS_W, h: ATLAS_H };
  return ATLAS;
}

/**
 * 组装一个变体。只做 drawImage，不新建任何 canvas —— 这是"1 sprite"的硬约束。
 * `variant` 是 { shield:true, cape:true, ... } 的子集描述。
 * 返回本次绘制的 { draws, cells } 供对账。
 */
export function assemble(g, variant, x, y, scale = 1, { flipX = false, bodyH = 48 } = {}) {
  const atlas = buildAtlas();
  const s = (scale * bodyH) / CELL.body.h;   // 让"身体高度"决定整体缩放
  const bw = CELL.body.w * s, bh = CELL.body.h * s;
  const parts = VARIANTS.filter((k) => k === 'body' || variant[k]);
  parts.sort((a, b) => SLOTS[a].order - SLOTS[b].order);

  g.save();
  g.translate(x, y);
  if (flipX) g.scale(-1, 1);           // 1 方向贴图的左右移动就靠这一下
  g.imageSmoothingEnabled = false;      // 像素风：别糊
  let draws = 0;
  for (const key of parts) {
    const slot = SLOTS[key];
    const cell = CELL[slot.cell];
    // 锚点相对身体框左下角；flipX 时 x 要相对身体中线翻过去
    const ox = slot.ax * s;
    const oy = -bh + slot.ay * s;
    const dx = flipX ? -(ox + cell.w * s) - bw * 0 : ox;
    g.drawImage(atlas.canvas,
      cell.x, cell.y, cell.w, cell.h,
      dx, oy, cell.w * s, cell.h * s);
    draws++;
  }
  g.restore();
  return { draws, cells: parts.length, scale: +s.toFixed(3), atlasW: atlas.w, atlasH: atlas.h };
}

/** 2^6 种组合（body 恒在，其余 5 个部件自由）。 */
export function allVariants() {
  const keys = VARIANTS.filter((k) => k !== 'body');
  const out = [];
  for (let m = 0; m < 1 << keys.length; m++) {
    const v = {};
    keys.forEach((k, i) => { v[k] = !!(m & (1 << i)); });
    out.push({ mask: m, variant: v });
  }
  return out;
}

/**
 * "只有一张贴图"的证明：统计全程出现过的 canvas 数量。
 * 这里返回的是模块内图集的身份 + 尺寸，页面可以自己比对多次组装前后的引用是否同一个。
 */
export function atlasIdentity() {
  const a = buildAtlas();
  return { same: true, w: a.w, h: a.h, cells: Object.keys(CELL).length, bytes: a.w * a.h * 4 };
}
