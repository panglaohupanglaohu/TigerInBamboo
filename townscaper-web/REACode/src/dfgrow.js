/**
 * dfgrow.js — 距离场让装饰**逐件生长 / 擦除**（不是整体缩放、不是淡入淡出）。
 *
 * 原文（x.com/OskSta/status/1105131621391495176, 2019-03-11）：
 *
 *   "Squiggly distance fields, now with animation! Versatile, flexible, but quite
 *    laborious"
 *
 * 同一族的另一条（x.com/OskSta/status/1104771432440049664, 2019-03-10）：
 *
 *   "...Distance field cutoff can be tweaked separately for borders and center.
 *    All one texture, just flipped around a bit."
 *
 * 画面实测（20 帧、520×320，逐帧量"暗像素占比"= 墨量）：
 *   · 14.8% → 0.0%：第 1–8 帧（≈0.22s）。**一边淡一边收缩**，先碎掉细节、
 *     最后连底板一起没 —— 不是整体缩放到 0（那样外轮廓会一直等比缩小）。
 *   · 0.3% → 15.5%：第 9–18 帧（≈0.9s）。**一件一件**出现：先底板、再中间
 *     圆章、再两侧小圆点、再文字条、最后那圈卷草。
 *   · **擦除比生长快 4 倍**（0.22s vs 0.9s）—— 这是最容易被忽略的一条：
 *     如果不是同一份距离场改阈值、只是两段补间，很难正好做成这个比例。
 *
 * 为什么必须是距离场：`alpha = step(threshold, sdf)` 这一个式子就能同时给出
 *   "从中心长出来"（threshold 从负到正）、"从边缘往里蚀"（反过来）、
 *   "描边变粗"（threshold 在 0 附近扫）三种效果，而且**形状内部永远实心**。
 *   换成缩放 / 遮罩擦除，中间过程会露出被拉伸的图形或露出底下的方形。
 *
 * 本文件不 import three，纯 CPU + 一个位图输出；`audit()` 复刻参考片的节奏，
 * 打印每一件的起止时间与墨量曲线，用来和上面那三个数对。
 */

/** 圆角矩形 SDF（负 = 内部）。 */
export function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** 圆 SDF。 */
export function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** 胶囊（两端圆的线段）SDF —— 卷草的基本笔触。 */
export function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t) - r;
}

/**
 * 造一面"Victory 横幅"式的装饰：底板 / 中间圆章 / 两侧圆点 / 文字条 / 卷草。
 * 每件都带 id、layer（出现顺序）和一个 sdf 函数。
 */
export function buildOrnament({ w = 520, h = 320 } = {}) {
  const cx = w / 2, cy = h / 2;
  const S = Math.min(w, h) / 320;      // 缩放
  const pieces = [];
  const add = (id, layer, sdf, radius) => pieces.push({ id, layer, sdf, radius: radius * S });

  // layer 0：底板（最大的那圈圆章底）
  add('plate', 0, (x, y) => sdRoundRect(x, y, cx, cy, 118 * S, 46 * S, 22 * S), 118 * S);
  // layer 1：中间圆章 + 上下两个小凸起
  add('medallion', 1, (x, y) => Math.min(
    sdCircle(x, y, cx, cy, 34 * S),
    sdCapsule(x, y, cx, cy - 34 * S, cx, cy - 58 * S, 12 * S),
    sdCapsule(x, y, cx, cy + 34 * S, cx, cy + 58 * S, 12 * S),
  ), 58 * S);
  // layer 2：两侧三个圆点
  add('dotsL', 2, (x, y) => Math.min(
    sdCircle(x, y, cx - 152 * S, cy, 11 * S),
    sdCircle(x, y, cx - 176 * S, cy, 8 * S),
  ), 11 * S);
  add('dotsR', 2, (x, y) => Math.min(
    sdCircle(x, y, cx + 152 * S, cy, 11 * S),
    sdCircle(x, y, cx + 176 * S, cy, 8 * S),
  ), 11 * S);
  // layer 3：文字条（一条细长胶囊，参考片里"Victory"落在这一条上）
  add('textbar', 3, (x, y) => sdRoundRect(x, y, cx, cy, 92 * S, 20 * S, 3 * S), 92 * S);
  // layer 4：四角卷草（每角两笔）
  for (const [sx, sy, tag] of [[-1, -1, 'tl'], [1, -1, 'tr'], [-1, 1, 'bl'], [1, 1, 'br']]) {
    const ox = cx + sx * 150 * S, oy = cy + sy * 62 * S;
    add('curl-' + tag, 4, (x, y) => Math.min(
      sdCapsule(x, y, ox, oy, ox + sx * 26 * S, oy - sy * 20 * S, 5 * S),
      sdCapsule(x, y, ox + sx * 26 * S, oy - sy * 20 * S, ox + sx * 44 * S, oy - sy * 2 * S, 4 * S),
    ), 26 * S);
  }
  return { w, h, pieces, cx, cy };
}

/**
 * 每件的阈值：**从 −radius 走到 0**。
 *
 * 第一次写反了（从 +radius 走到 0），结果 a 很小时 `sdf <= +radius` 是"把形状
 * 向外膨胀 radius"，开局是一大团糊（墨量 61.6%，而参考片满格只有 15.5%）。
 * 距离场里负才是内部，所以生长必须从负往 0 走：−R 时只剩中心一个点，0 时正好
 * 是自己的轮廓。再往下（正数）就是描边变粗，本轮用不到。
 */
function thresholdFor(piece, localT) {
  return -piece.radius * (1 - localT);
}

/**
 * 生成一整段"出现 → 停留 → 消失"的时间线。
 *
 * @param opts.growMs   整段生长时长（参考片 ≈0.9s）
 * @param opts.eraseMs  整段擦除时长（参考片 ≈0.22s，比生长快 4 倍）
 * @param opts.stagger  每层错开的比例（0..1，按层数分配）
 */
export function makeTimeline(orn, { growMs = 900, eraseMs = 220, holdMs = 400, stagger = 0.55 } = {}) {
  const layers = [...new Set(orn.pieces.map((p) => p.layer))].sort((a, b) => a - b);
  const maxLayer = layers[layers.length - 1] || 0;
  const span = 1 + stagger * maxLayer;         // 一个"件"占 1，层错开 stagger
  const total = growMs + holdMs + eraseMs;
  return {
    growMs, eraseMs, holdMs, stagger, span, total, maxLayer,
    // 某件在整段动画里的起止（毫秒）
    pieceTiming(piece) {
      const start = (piece.layer * stagger / span) * growMs;
      const dur = (1 / span) * growMs;
      const eraseStart = growMs + holdMs + (1 - (piece.layer * stagger / span + 1 / span)) * eraseMs;
      return { growStart: start, growEnd: start + dur, eraseStart, eraseEnd: eraseStart + (1 / span) * eraseMs };
    },
  };
}

/** 某件在时间 t（毫秒）的 alpha（0..1）。 */
export function pieceAlpha(piece, tl, t) {
  const { growStart, growEnd, eraseStart, eraseEnd } = tl.pieceTiming(piece);
  if (t < growStart) return 0;
  if (t < growEnd) return (t - growStart) / (growEnd - growStart);
  if (t < eraseStart) return 1;
  if (t < eraseEnd) return 1 - (t - eraseStart) / (eraseEnd - eraseStart);
  return 0;
}

/**
 * 渲染一帧（灰度位图）。
 *
 * 每件按 threshold 取"内部"区域，再叠加 1px 描边 —— 描边也是同一份 sdf，
 * 所以生长过程中**描边始终贴着当前形状**（这正是参考片里那种"边擦边有线"）。
 */
export function renderFrame(orn, tl, t, { stroke = 1.6 } = {}) {
  const { w, h, pieces } = orn;
  const data = new Uint8ClampedArray(w * h * 4);
  // 底色：参考片是浅灰 0.83
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 212; data[i * 4 + 1] = 212; data[i * 4 + 2] = 212; data[i * 4 + 3] = 255;
  }
  for (const p of pieces) {
    const a = pieceAlpha(p, tl, t);
    if (a <= 0) continue;
    const thr = thresholdFor(p, a);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = p.sdf(x + 0.5, y + 0.5);
        if (d > thr) continue;
        const edge = d > thr - stroke;
        const o = (y * w + x) * 4;
        const v = edge ? 70 : 128;
        // 每件自己的一点点色调差，让层与层分得开（参考片里层与层深浅不同）
        const k = v * (0.86 + 0.14 * ((p.layer % 3) / 2));
        data[o] = k; data[o + 1] = k; data[o + 2] = k * 1.02;
      }
    }
  }
  return { w, h, data };
}

/** 墨量（暗像素占比 %）—— 与参考片的度量同一口径。 */
export function inkCoverage(img, { threshold = 190 } = {}) {
  const { w, h, data } = img;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4] < threshold) n++;
  }
  return n / (w * h) * 100;
}

/**
 * 验收：跑完整条时间线，采 24 个时刻，输出墨量曲线 + 每件起止。
 * 参考片实测：擦 0.22s / 长 0.9s（比 4.1:1），满格墨量 15.5%，谷底 0.0%。
 */
export function audit({ samples = 24, growMs = 900, eraseMs = 220 } = {}) {
  const orn = buildOrnament();
  const tl = makeTimeline(orn, { growMs, eraseMs });
  const curve = [];
  let peak = 0, trough = 100;
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * tl.total;
    const img = renderFrame(orn, tl, t);
    const cov = inkCoverage(img);
    peak = Math.max(peak, cov);
    if (t > growMs + tl.holdMs * 0.5 && t < growMs + tl.holdMs) trough = Math.min(trough, cov);
    curve.push({ t: Math.round(t), ink: +cov.toFixed(2) });
  }
  const timings = orn.pieces.map((p) => ({
    id: p.id,
    layer: p.layer,
    ...Object.fromEntries(Object.entries(tl.pieceTiming(p)).map(([k, v]) => [k, Math.round(v)])),
  }));
  return {
    pieces: orn.pieces.length,
    layers: tl.maxLayer + 1,
    totalMs: tl.total,
    growMs, eraseMs,
    eraseOverGrow: +(growMs / eraseMs).toFixed(2),
    peakInk: +peak.toFixed(2),
    minInkDuringHold: +trough.toFixed(2),
    curve,
    timings,
  };
}
