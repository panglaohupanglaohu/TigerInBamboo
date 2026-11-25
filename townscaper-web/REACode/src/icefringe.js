/**
 * icefringe.js — 崖脚一整排"冰帘/水帘"：从崖顶边垂下来的竖向条带
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1007587825024425984（2018-06-15）**帖子无文字**，又是屏录。
 *   这一条和 1007587828992266240 是同一天同一台机位的同一座岛 ——
 *   那条是白色石灰岩 + 小瀑布（见 cascades.js），这条换成了深色玄武岩 + 崖脚垂帘。
 *   所以别指望有"做法说明"，下面全部是逐像素量出来的。
 *
 * ── 帧实测（420×420，f009；f004/f014 复算一致）────────────────────────────
 *   画面分块占比   水 63.9% / 泡沫 4.4% / 崖 16.0% / 草 少量
 *   岩石          #4C434F (76,67,79) —— 带紫的深褐，**不是黑**，B 通道比 R 高 3
 *   草            #A6AE7A (166,174,122)
 *   水（崖脚）    #6B8089 (107,128,137)
 *   泡沫          #F5F7F6
 *   冰帘占比      岛体包围盒内 **7.2%** 的像素（190–350 行、40–400 列）
 *   单条宽        **11–13px**（9 条干净的条带：11,11,11,12,13,14,13,9,11；
 *                另有 19 / 28 两条是相邻两条粘连，去掉）
 *   条间空隙      3–20px，中位 12px，**没有等间距** —— 等间距一眼就假
 *   长度          只有约 1/3 落地（长 60–81px，贯穿整个崖面），
 *                其余在 10–45px 之间随机收尾
 *   色标（x=336 那一列，从上往下）
 *                y=248 (172,217,218) → y=254 (194,233,233) → y=260 (220,250,251)
 *                → y=272 (246,252,254) → y=290 (255,255,255)
 *                也就是 **40px 内从青到纯白**，且前 30% 就走完了七成变化
 *   端头          圆头（半径 = 半宽），不是平切；平切会立刻变成"贴纸条"
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **条带比缝隙亮得多，但不能纯白。** 一开始全画 255 白，结果整排像塑料栅栏；
 *      实测顶端是 (172,217,218) —— 它其实是被天空染青的冰，只有下端才融成白。
 *   ② **端点必须圆、长短必须乱。** 端头圆 + 长度乱 = "垂下来"; 端头平 + 长度齐 = "栏杆"。
 *      片中 2/3 的条带在半空收尾，所以短条是常态、长条是点缀，比例别反。
 *   ③ **条带之间要能看见岩石。** 岩石占比 16%，冰帘只占 7.2% —— 冰帘是"缝里长出来的"，
 *      不是一整面墙。第一版我把间距压到 4px，岛直接变成白色冰墙，崖的轮廓没了。
 */

export const MEASURED = {
  frame: 420,
  iceW: 12,            // 单条宽（11–13 取中）
  gapMin: 3,
  gapMed: 12,
  gapMax: 20,
  coverFrac: 0.072,    // 冰帘占岛体包围盒比例
  fullFrac: 0.3,      // 约 1/3 落地
  ramp: [
    [172, 217, 218],   // 0.00 顶端（被天空染青）
    [194, 233, 233],   // 0.15
    [220, 250, 251],   // 0.32
    [246, 252, 254],   // 0.62
    [255, 255, 255],   // 1.00
  ],
  rock: [76, 67, 79],
  rockLit: [96, 86, 99],
  grass: [166, 174, 122],
  water: [107, 128, 137],
  foam: [245, 247, 246],
  tipGlow: [224, 246, 248],
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** 冰帘颜色。t=0 顶端、t=1 端头。指数 0.5 —— 见文件头"为什么这样写"①。 */
export function iceColor(t, measured = MEASURED) {
  const k = Math.pow(Math.max(0, Math.min(1, t)), 0.5);
  const r = measured.ramp;
  const seg = k * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = r[i], b = r[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * 在 [x0,x1] 这段崖顶上排一排冰帘。
 *
 * 排列方式刻意做成"贪心铺 + 随机留缝"，而**不是**等分：
 * 片中空隙 3–20px 且中位 12px，等分出来的整齐感是这条最容易露馅的地方。
 */
export function makeFringe({ x0, x1, topY, baseY, scale = 1, seed = 5 }) {
  const rnd = lcg(seed);
  const M = MEASURED;
  const items = [];
  // 崖顶边缘在银幕上是**斜的**（等距投影，前脸顶边从左向右往下走）。
  // 所以 topY/baseY 允许传函数：冰帘每一条都从它正上方那条边垂下来，
  // 用同一个 topY 会让整排冰帘悬空/扎进崖里。
  const yTop = typeof topY === 'function' ? topY : () => topY;
  const yBase = typeof baseY === 'function' ? baseY : () => baseY;
  let x = x0;
  while (x < x1) {
    const w = (M.iceW + (rnd() - 0.5) * 2) * scale;
    if (x + w > x1) break;
    const cx = x + w / 2;
    const top = yTop(cx) + (rnd() - 0.5) * 3 * scale;
    const base = yBase(cx);
    const faceH = base - top;
    const full = rnd() < M.fullFrac;
    // 短条是常态：片中位 16px / 崖面高约 68px ≈ 0.24，长条只有 1/3
    const len = full ? faceH * (0.9 + rnd() * 0.12) : faceH * (0.1 + rnd() * 0.3);
    items.push({
      x: cx,
      w,
      y0: top,
      y1: top + len,
      baseY: base,
      reachesWater: full,
      r: w / 2,   // 端头圆角半径 = 半宽（结论②）
    });
    x += w + (M.gapMin + rnd() * (M.gapMax - M.gapMin)) * scale * 0.72;
  }
  return { items, topY: yTop(x0), baseY: yBase(x1), x0, x1, scale };
}

/**
 * 画一排冰帘。
 * 每条 = 竖向渐变 + 圆头；落地的那些在端头点一小块泡沫（片中确有）。
 */
export function paintFringe(ctx, fringe, { opacity = 1 } = {}) {
  const { items, baseY } = fringe;
  ctx.save();
  ctx.globalAlpha = opacity;
  for (const it of items) {
    const g = ctx.createLinearGradient(0, it.y0, 0, it.y1);
    for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, rgba(iceColor(i / 4)));
    ctx.fillStyle = g;
    const r = Math.min(it.r, it.w / 2);
    const h = it.y1 - it.y0;
    ctx.beginPath();
    // 圆头竖条：两条直边 + 底部半圆（不用 roundRect，是为了端头半径能和 widths 对上）
    ctx.moveTo(it.x - r, it.y0);
    ctx.lineTo(it.x - r, it.y1 - r);
    ctx.arc(it.x, it.y1 - r, r, Math.PI, 0);
    ctx.lineTo(it.x + r, it.y0);
    ctx.closePath();
    ctx.fill();
    // 端头那一点更亮的"珠子"（片子放大能看到）。
    // **必须裁进条带轮廓**：不裁的话这个径向渐变会在深色岩面上留一个灰白色的圆盘，
    // 看起来像钉了颗铆钉 —— 第一版就是这样，端头全变成"棒棒糖"。
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(it.x - r, it.y0);
    ctx.lineTo(it.x - r, it.y1 - r);
    ctx.arc(it.x, it.y1 - r, r, Math.PI, 0);
    ctx.lineTo(it.x + r, it.y0);
    ctx.closePath();
    ctx.clip();
    const tg = ctx.createRadialGradient(it.x, it.y1 - r, 0, it.x, it.y1 - r, r * 1.6);
    tg.addColorStop(0, rgba(MEASURED.tipGlow, 0.5));
    tg.addColorStop(1, rgba(MEASURED.tipGlow, 0));
    ctx.fillStyle = tg;
    ctx.fillRect(it.x - r, it.y1 - r * 2.2, r * 2, r * 2.2);
    ctx.restore();

    // 落地的那几条：水面上一小片白（片子里有，且不连成一条线）
    if (it.reachesWater) {
      const base = it.baseY !== undefined ? it.baseY : baseY;
      if (it.y1 > base - 4 * fringe.scale) {
        ctx.fillStyle = 'rgba(248,252,252,0.9)';
        ctx.beginPath();
        ctx.ellipse(it.x, base + 1 * fringe.scale, it.w * 0.75, it.w * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ── 反测：量回条宽、条数、覆盖率 ───────────────────────────────────────── */

/**
 * 反测：在一排冰帘的中段某一行上量白色游程 —— 用来验证"宽 11–13、缝 3–20"。
 * @returns {{widths:number[], gaps:number[], runCover:number, areaCover:number}}
 */
export function probeFringe(ctx, fringe) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [img[i], img[i + 1], img[i + 2]];
  };
  const isIce = (c) => c[2] > 235 && c[1] > 225 && c[0] > 195;

  // 一、条宽：**逐条在自己 40% 高度处量**。
  // 用一条固定的水平扫描线量不行 —— 崖顶边是斜的、条带又长短不一，
  // 任何一行都会有一半条带已经收尾，量出来是"端头的 1–3px"，条宽会假性变窄。
  const widths = [];
  const rightEdges = [];
  for (const it of fringe.items) {
    const y = Math.round(it.y0 + (it.y1 - it.y0) * 0.4);
    const cx = Math.round(it.x);
    if (y < 0 || y >= height) continue;
    let s = cx, e = cx;
    while (s > 0 && isIce(at(s - 1, y))) s--;
    while (e < width - 1 && isIce(at(e + 1, y))) e++;
    if (e - s >= 2) { widths.push(e - s + 1); rightEdges.push(e); }
  }
  // 二、缝：相邻两条右边缘 → 下一条左边缘的距离
  const gaps = [];
  for (let i = 1; i < rightEdges.length; i++) {
    const g = (rightEdges[i] - widths[i] + 1) - rightEdges[i - 1];
    if (g >= 1) gaps.push(g);
  }
  // 三、面积覆盖率：**包围盒取条带自己的上下界**
  let hit = 0, tot = 0;
  const yA = Math.round(Math.min(...fringe.items.map((it) => it.y0)));
  const yB = Math.round(Math.max(...fringe.items.map((it) => it.y1)));
  const x0 = Math.max(0, Math.round(fringe.x0)), x1 = Math.min(width - 1, Math.round(fringe.x1));
  for (let yy = yA; yy < yB; yy += 3) {
    for (let xx = x0; xx <= x1; xx += 2) {
      tot++;
      if (isIce(at(xx, yy))) hit++;
    }
  }
  return { widths, gaps, areaCover: hit / Math.max(1, tot) };
}
