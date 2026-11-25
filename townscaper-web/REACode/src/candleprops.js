/**
 * candleprops.js — 细高发光道具（生日蛋糕上的蜡烛）+ 杆底线性渐隐
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1022855252574437376（2018-07-27）**帖子无文字**，正文只有 "it's my birthday!"
 *   画面是把一座 Townscaper 岛做成多层蛋糕：台面改成粉/红色糖霜，岛上插了
 *   11 根蜡烛，岛的外缘压着一圈白线（见 rimline.js）。
 *
 * ── 帧实测（400×400·f016；f004/f010 复算一致）───────────────────────────
 *   蜡烛根数      11（含 1 根在近侧台面下沿只露半截）
 *   杆            宽 **7px**（x168..177 里 8 列含 1 列 AA）、高 **31px**
 *                 → 占画幅 1.75% × 7.75%，高宽比 **4.4:1**
 *   杆的颜色      顶段**纯白 (255,255,255)**，往下逐像素掉：
 *                 y140 255 → y152 242 → y158 209 → y164 166 → y171 = 底色 (92,119,108)
 *                 反解 alpha（按底色 92,119,108 混合）：1.00 / 0.92 / 0.72 / 0.45 / 0.00
 *                 → **上半截 40% 是实心，下半截 60% 线性渐隐到 0**，
 *                   杆子不是"插进地里"，是**化进地里**——所以看不到杆与台面的交线。
 *   火焰          总包围盒 **10w × 21h**（含粉色的辉光），实心焰体 9w × 17h
 *                 焰心 **5w × 9h**，颜色 (255,253,230) 暖白不是纯白
 *                 焰体外缘 (255,213,205)/(255,224,212) —— 是**粉橙**，不是黄
 *   辉光          半径约 22px（≈1.4× 焰高），峰值 (230,150,150) 左右。
 *                 ⚠ 这个粉色不是调出来的：暖橙 (255,150,60) 用**叠加**混到
 *                 青灰底 (122,131,135) 上就是 (255,161,145) 的粉。
 *                 第一版用 alpha 混合画辉光，出来是脏的灰橙，跟片子对不上。
 *   灯芯          焰底 y136..139 有 2px 暗红 (176,150,146) —— 焰和杆之间的分离线
 *   倾角          11 根里有 3 根歪 3–6°，方向随机；杆底不在格心，偏 ±0.3 格
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **杆底必须渐隐**（见上，60% 线性）。硬切会得到一圈"杆插在糖霜里"的
 *      交线，而片子里那根杆是化开的；这也是所有插地细道具（旗杆、火把、
 *      芦苇）通用的做法。
 *   ② **辉光要叠加，不要 alpha 混合。** 见上面的粉色推导：叠加才会在冷底
 *      上出粉，alpha 混合只会把底色往橙里拉、变脏。
 *   ③ **焰体不能是单一色。** 实心焰心 5×9 + 外缘粉橙 + 叠加辉光，三层缺一层
 *      就变成"蜡烛图标"。反测里"焰心占比"掉了就从 34% 变 12%。
 *   ④ 尺寸按**画幅百分比**给，不按世界单位：片中蜡烛是后期贴的 billboard，
 *      岛拉远拉近时它跟着变，但**不会**跟着格子缩放（同 rimline 的白线）。
 */

export const MEASURED = {
  ref: 400,
  shaftW: 7,            // px @400
  shaftH: 31,
  solidTop: 0.30,       // 上 30% 实心（片中读数 12/31；用 240 阈值会多算 2–3px）
  fadeFrom: 0.30,       // 从 30% 高度开始线性渐隐到 0
  flameW: 9,
  flameH: 17,
  coreW: 5,
  coreH: 9,
  haloR: 12,          // 焰外那圈粉只比焰体宽 1–3px（暖色 bbox 10–13 宽 / 焰心 5）
  wickH: 2,
  count: 11,
  tiltMax: 6,           // 度
  shaftCol: [255, 255, 255],
  // 焰的三层色标（沿半径）：芯 (255,250,235) → 中 (255,200,180) → 边 (255,140,115)
  // 反解自 f016 那根蜡烛 y=155 的横扫：
  //   x230 (255,249,233) → x234 (255,198,190) → x236 (202,142,148) → 底 (110,135,140)
  // 最后那格是**红**占优（R+92 / G+7 / B+8），不是橙 —— 所以边色要往红里偏。
  coreCol: [255, 250, 235],
  flameCol: [255, 200, 180],
  flameHot: [255, 140, 115],
  haloCol: [255, 80, 70],    // 叠加用的红（出来的粉是它叠在青灰底上的结果）
  wickCol: [176, 150, 146],
};

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * 生成一组蜡烛。
 *
 * @param {object} o
 * @param {Array<[number,number]>} o.spots  每根蜡烛的屏幕落点（杆底）
 * @param {number} [o.scale]                片中px → 画布px
 * @param {number} [o.seed]
 */
export function makeCandles({ spots, scale = 1, seed = 23 }) {
  const rnd = lcg(seed);
  const M = MEASURED;
  return spots.map(([x, y], i) => ({
    i,
    x: x + (rnd() - 0.5) * 2 * scale,
    y,
    // 高矮差：片中最高那根比最矮的高 ~18%
    h: M.shaftH * scale * (0.90 + rnd() * 0.20),
    w: M.shaftW * scale * (0.92 + rnd() * 0.16),
    tilt: (rnd() - 0.5) * 2 * M.tiltMax,
    // 每根自己的闪烁相位 —— 片子里 11 根不是同步呼吸的
    phase: rnd() * Math.PI * 2,
  }));
}

/**
 * 画一根蜡烛。顺序：辉光（叠加）→ 焰体 → 焰心 → 灯芯 → 杆。
 * 杆最后画，因为它要压在焰底（片子里的焰是"坐在"杆顶上的）。
 *
 * @param {object} o
 * @param {number} [o.t]          秒，用于闪烁相位
 * @param {boolean} [o.ghostBase] 杆底渐隐（默认 true；false 仅供反测"硬底"错法）
 * @param {'add'|'alpha'} [o.haloMode] 辉光混合方式（'alpha' 仅供反测错法）
 * @param {boolean} [o.flatFlame] 焰只画一层（仅供反测错法）
 * @param {[number,number]} [o.flameScale] 焰宽高倍率（仅供反测错法）
 */
export function paintCandle(ctx, c, {
  t = 0, scale = 1, ghostBase = true, haloMode = 'add',
  flatFlame = false, flameScale = [1, 1],
} = {}) {
  const M = MEASURED;
  const fl = 1 + 0.07 * Math.sin(t * 7.1 + c.phase) + 0.03 * Math.sin(t * 13.7 + c.phase * 2);
  const h = c.h, w = c.w;
  const rad = (c.tilt * Math.PI) / 180;
  // 杆顶（在倾斜的杆子上）
  const topX = c.x + Math.sin(rad) * h * -1;
  const topY = c.y - h * Math.cos(rad);

  // ① 辉光：叠加。半径只比焰体宽 1–3px，色往红里偏（见 MEASURED 里的反解）
  const fr = M.haloR * scale * fl;
  ctx.save();
  ctx.globalCompositeOperation = haloMode === 'add' ? 'lighter' : 'source-over';
  const hg = ctx.createRadialGradient(topX, topY - 6 * scale, 0, topX, topY - 6 * scale, fr);
  hg.addColorStop(0, rgba(M.haloCol, 0.34));
  hg.addColorStop(0.55, rgba(M.haloCol, 0.14));
  hg.addColorStop(1, rgba(M.haloCol, 0));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(topX, topY - 6 * scale, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ② 焰体：泪滴 + 沿半径的三层色标（芯暖白 → 中粉橙 → 边红），最后一档渐隐到 0
  const fw = (M.flameW * scale * fl * flameScale[0]) / 2;
  const fh = M.flameH * scale * fl * flameScale[1];
  const fb = topY - 3 * scale;                    // 焰底（压在杆顶上）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topX, fb - fh);
  ctx.bezierCurveTo(topX + fw, fb - fh * 0.62, topX + fw, fb - fh * 0.10, topX, fb);
  ctx.bezierCurveTo(topX - fw, fb - fh * 0.10, topX - fw, fb - fh * 0.62, topX, fb - fh);
  ctx.closePath();
  if (flatFlame) {
    // 错法：一层平色 —— 焰变"贴纸"
    ctx.fillStyle = rgba(M.flameCol, 0.95);
    ctx.fill();
  } else {
    const fg = ctx.createRadialGradient(topX, fb - fh * 0.42, 0, topX, fb - fh * 0.42, fh * 0.62);
    fg.addColorStop(0, rgba(M.coreCol, 1));
    fg.addColorStop(0.45, rgba(M.flameCol, 0.97));
    fg.addColorStop(0.80, rgba(M.flameHot, 0.62));
    fg.addColorStop(1, rgba(M.flameHot, 0));
    ctx.fillStyle = fg;
    ctx.fill();
  }
  ctx.restore();

  // ④ 灯芯：2px 暗红，把焰和杆分开
  ctx.strokeStyle = rgba(M.wickCol, 0.85);
  ctx.lineWidth = Math.max(1, 1.1 * scale);
  ctx.beginPath();
  ctx.moveTo(topX, fb - M.wickH * scale);
  ctx.lineTo(topX, fb + M.wickH * scale);
  ctx.stroke();

  // ⑤ 杆：上 40% 实心、下 60% 线性渐隐（①）。用线性渐变一次画完。
  ctx.save();
  if (c.tilt) {
    ctx.translate(c.x, c.y);
    ctx.rotate(rad);
    ctx.translate(-c.x, -c.y);
  }
  const sg = ctx.createLinearGradient(0, c.y, 0, c.y - h);
  if (ghostBase) {
    // 渐变 stop 是"从杆底 0 到杆顶 1"。要的是：底 0，往上线性升到 1，
    // 到 (1 − solidTop) 处已经满，再往上一直是 1 —— 也就是上 40% 实心、下 60% 渐隐。
    // ⚠ 第一版写成 stop(0)=0 / stop(0.40)=0 / stop(1)=1，实心区只剩杆顶那一个点，
    //   整根杆都在半透，反测"杆宽 0px"。
    sg.addColorStop(0, rgba(M.shaftCol, 0));
    sg.addColorStop(1 - M.solidTop, rgba(M.shaftCol, 1));
    sg.addColorStop(1, rgba(M.shaftCol, 1));
  } else {
    sg.addColorStop(0, rgba(M.shaftCol, 1));                       // 错法：硬底
    sg.addColorStop(1, rgba(M.shaftCol, 1));
  }
  ctx.fillStyle = sg;
  ctx.fillRect(c.x - w / 2, c.y - h, w, h);
  // 杆顶那一小截椭圆盖（片子里能看见一点点厚度）
  ctx.fillStyle = rgba(M.shaftCol, 0.95);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - h, w / 2, Math.max(1, w * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function paintCandles(ctx, list, opts = {}) {
  // 由远到近：y 小的先画
  for (const c of list.slice().sort((a, b) => a.y - b.y)) paintCandle(ctx, c, opts);
}

/* ── 反测 ──────────────────────────────────────────────────────────────── */

/**
 * 量一根蜡烛：杆宽、实心段高度、渐隐段高度、焰心尺寸、辉光半径。
 * 判据与片子里的取法一致（近白 = 三通道≥240；暖白焰心 = R≥250,G≥232,B≥185）。
 */
export function probeCandle(ctx, c) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const at = (x, y) => {
    const i = ((y | 0) * width + (x | 0)) * 4;
    return [img[i], img[i + 1], img[i + 2]];
  };
  const white = (p) => p[0] >= 240 && p[1] >= 240 && p[2] >= 240;
  const core = (p) => p[0] >= 250 && p[1] >= 232 && p[2] >= 185;
  // 杆：沿 x=c.x 那一列从杆顶往下找连续近白
  let solid = 0, fade = 0;
  let y = Math.round(c.y - c.h) + 1;
  while (y < height && white(at(c.x, y))) { solid++; y++; }
  while (y < height) {
    const p = at(c.x, y);
    if (p[0] < 150 && p[1] < 170) break;   // 已经到台面
    fade++; y++;
  }
  // 杆宽：在实心段中点横扫
  const my = Math.round(c.y - c.h * 0.8);
  let w = 0;
  for (let x = Math.floor(c.x - 12); x < c.x + 12; x++) if (white(at(x, my))) w++;
  // 焰心：以杆顶为心开窗扫
  let cw = 0, chh = 0;
  for (let yy = Math.round(c.y - c.h - 30); yy < c.y - c.h + 6; yy++) {
    for (let xx = Math.round(c.x - 12); xx < c.x + 12; xx++) {
      if (core(at(xx, yy))) { cw = Math.max(cw, Math.abs(xx - c.x) * 2 + 1); chh++; }
    }
  }
  return { shaftW: w, solidH: solid, fadeH: fade, fadeShare: fade / Math.max(1, solid + fade),
    coreW: cw, corePx: chh };
}

/** 同一场景两个 canvas 的逐像素差（用于 A/B：有/无渐隐、叠加/混合）。 */
export function pixelDiff(ctxA, ctxB) {
  const a = ctxA.getImageData(0, 0, ctxA.canvas.width, ctxA.canvas.height).data;
  const b = ctxB.getImageData(0, 0, ctxB.canvas.width, ctxB.canvas.height).data;
  let n = 0, sum = 0;
  const total = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    if (d > 2) n++;
    sum += d;
  }
  return { changed: n / total, mean: sum / total };
}
