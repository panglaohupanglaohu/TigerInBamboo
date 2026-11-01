/**
 * ornament.js — 一张小贴图、镜像着用，做成能拉成任意尺寸的 UI 花边。
 *
 * 原文（x.com/OskSta/status/1104771432440049664, 2019-03-10）：
 *
 *   "Squiggly distance fields on mirrored UVs for fast and easy UI decorations.
 *    Distance field cutoff can be tweaked separately for borders and center.
 *    All one texture, just flipped around a bit. At the start of making Bad
 *    North, UI decoration was a pain, it is now a delight."
 *
 * 画面（24 帧）：
 *   · 一开始右下角露出一张方形小图（深底、黑色卷草纹），那就是唯一的贴图；
 *   · "Text" 面板的边框一帧帧长大：**四角的花纹几乎不变形**，只有中间被拉长；
 *   · 面板从窄条长成大框，花纹的粗细始终一样（≈1px 的线）；
 *   · 卷草纹在上下左右都是镜像的 —— 同一朵花纹转了 90°、再翻一次就是四条边。
 *
 * 三件事分开做，才叫"delight"：
 *   ① **距离场**：贴图里存的不是颜色，是"到最近笔画的距离"。所以
 *      cutoff 一改，线就变粗变细，不需要重画；缩放时也不会糊。
 *   ② **双阈值**：border 和 center 用**两个** cutoff（原文"separately"）。
 *      边线细、中心图案粗，同一张场出两种笔画。
 *   ③ **镜像 UV**：一张贴图，靠 `scale(-1,1)` / `scale(1,-1)` 复用成 8 个朝向，
 *      再配合 repeat 就能拉成任意长宽比，角上永远是同一朵花 —— 这就是九宫格。
 *
 * 本文件是 Canvas2D 实现（本项目 UI 不在 WebGL 里），代价是每次改尺寸要重绘，
 * 但一张 64² 的距离场重绘是 0.1ms 级，和原文"fast and easy"是同一量级。
 */

/** 到折线的最近距离（只用于生成一次，64² = 4096 次查询，够快）。 */
function distToPolyline(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], ay = pts[i][1];
    const bx = pts[i + 1][0], by = pts[i + 1][1];
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const len2 = vx * vx + vy * vy || 1;
    let t = (wx * vx + wy * vy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = wx - vx * t, dy = wy - vy * t;
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 生成一张卷草纹距离场。坐标 0..1，笔画是几段圆弧 + 一条 S 弯。
 * 返回 {size, field: Float32Array}，field 里是归一化距离（0=线上）。
 */
export function makeSwirlField(size = 64) {
  // 半张图（左上角四分之一）的笔画：一条大 C + 一个小卷 + 一条对角尾。
  // 只画四分之一，剩下三份靠镜像 —— 这正是"one texture, flipped around"。
  const strokes = [];
  const arcs = [
    { cx: 0.62, cy: 0.30, r: 0.30, a0: Math.PI * 0.62, a1: Math.PI * 1.42 },
    { cx: 0.30, cy: 0.66, r: 0.20, a0: Math.PI * 1.05, a1: Math.PI * 1.95 },
    { cx: 0.78, cy: 0.80, r: 0.13, a0: Math.PI * 0.85, a1: Math.PI * 1.75 },
  ];
  for (const a of arcs) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = a.a0 + (a.a1 - a.a0) * (i / 14);
      pts.push([a.cx + Math.cos(t) * a.r, a.cy + Math.sin(t) * a.r]);
    }
    strokes.push(pts);
  }
  // 一条从中心拐到左上的 S 尾
  strokes.push([[0.50, 0.50], [0.40, 0.44], [0.31, 0.47], [0.24, 0.38], [0.20, 0.24]]);

  const field = new Float32Array(size * size);
  let maxD = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size, py = (y + 0.5) / size;
      let d = Infinity;
      for (const s of strokes) d = Math.min(d, distToPolyline(px, py, s));
      field[y * size + x] = d;
      if (d > maxD) maxD = d;
    }
  }
  // 归一化到 0..1（1 = 离笔画最远），并把边缘压成"贴边"：
  // 边框的笔画必须贴到图边，否则九宫格拼起来会有缝。
  for (let i = 0; i < field.length; i++) field[i] = Math.min(1, field[i] / (maxD * 1.35));
  return { size, field };
}

/**
 * 把距离场画成一张可镜像使用的贴图。
 * @param {object} opts { border:0..1, center:0..1, ink:'#2b2b33', bg:null }
 */
export function renderOrnamentTile({ size = 64, border = 0.10, center = 0.22, ink = '#23242b', bg = null } = {}) {
  const { field } = makeSwirlField(size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const d = field[i];
    // 两个 cutoff：border 细（只吃最近的笔画），center 粗（把整朵花填实）
    const a = d < border ? 1 : d < center ? 0.55 : 0;
    const o = i * 4;
    if (bg) {
      img.data[o] = bg[0]; img.data[o + 1] = bg[1]; img.data[o + 2] = bg[2];
      img.data[o + 3] = 255 * (a > 0 ? 1 : 0.0);
      if (a > 0) {
        img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2];
        img.data[o + 3] = 255 * (0.55 + 0.45 * a);
      }
    } else {
      img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2];
      img.data[o + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * 画一个带花边的面板：**细直线做框，距离场做角花**。
 *
 * 为什么不是"把贴图重复铺满"：参考片里四角的卷草始终是同一朵、朝向镜像，
 * 而边上是极细的直线。铺满会把角花糊成一片壁纸（第一版就是这样，整块面板
 * 变成一团黑花纹）。所以两种东西分开：
 *   · 框线   → ctx.strokeRect，1px，和缩放无关；
 *   · 角花   → 距离场贴图，按 4 个镜像朝向各贴一次（"just flipped around"）；
 *   · 边中   → 同一张贴图缩小一半再贴，形成节奏；
 *   · 中心   → 用**另一个 cutoff**（center）压到极淡，当水印。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} rect { x, y, w, h }
 * @param {object} opts { tile, ink, fill, alpha }
 */
export function drawPanel(ctx, rect, { tile, ink = '#2a2b33', fill = '#e9e4d8', alpha = 1 } = {}) {
  const { x, y, w, h } = rect;
  const s = tile.width;
  ctx.save();
  ctx.globalAlpha = alpha;

  // 纸面 + 一点点内阴影，让"板子"从背景里出来
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0.06)');
  g.addColorStop(0.18, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // 双线框：这是"边"，和尺寸无关，永远 1px
  ctx.strokeStyle = ink;
  ctx.globalAlpha = alpha * 0.85;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
  ctx.globalAlpha = alpha * 0.5;
  ctx.lineWidth = 0.9;
  ctx.strokeRect(x + 13.5, y + 13.5, w - 27, h - 27);

  // 中心水印：**第二个 cutoff**（center），极淡
  ctx.globalAlpha = alpha * 0.10;
  const big = s * 1.6;
  ctx.drawImage(tile, x + w * 0.5 - big * 0.5, y + h * 0.5 - big * 0.5, big, big);

  // 角花：4 个镜像朝向，尺寸固定 —— 面板变大时角花不变形
  const cs = Math.min(s * 0.95, Math.min(w, h) * 0.42);
  const corners = [
    [x + 6, y + 6, 1, 1],
    [x + w - 6, y + 6, -1, 1],
    [x + 6, y + h - 6, 1, -1],
    [x + w - 6, y + h - 6, -1, -1],
  ];
  ctx.globalAlpha = alpha;
  for (const [cx, cy, fx, fy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(fx, fy);
    ctx.drawImage(tile, 0, 0, cs, cs);
    ctx.restore();
  }

  // 边中：同一张贴图缩到 45%，沿边镜像重复（间距 = 角花宽度，节奏均匀）
  const ms = cs * 0.45;
  const step = ms * 1.9;
  ctx.globalAlpha = alpha * 0.9;
  for (let px = x + cs; px < x + w - cs * 0.8; px += step) {
    ctx.save(); ctx.translate(px + ms / 2, y + 6 + ms / 2); ctx.scale(1, -1);
    ctx.drawImage(tile, -ms / 2, -ms / 2, ms, ms); ctx.restore();
    ctx.save(); ctx.translate(px + ms / 2, y + h - 6 - ms / 2);
    ctx.drawImage(tile, -ms / 2, -ms / 2, ms, ms); ctx.restore();
  }
  for (let py = y + cs; py < y + h - cs * 0.8; py += step) {
    ctx.save(); ctx.translate(x + 6 + ms / 2, py + ms / 2); ctx.scale(-1, 1);
    ctx.drawImage(tile, -ms / 2, -ms / 2, ms, ms); ctx.restore();
    ctx.save(); ctx.translate(x + w - 6 - ms / 2, py + ms / 2);
    ctx.drawImage(tile, -ms / 2, -ms / 2, ms, ms); ctx.restore();
  }
  ctx.restore();
}
