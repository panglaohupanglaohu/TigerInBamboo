/**
 * tideflat.js — 岛脚的沙滩裙（退潮后露出的湿沙平台）+ 断断续续的白泡沫边
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1007587817021636609（2018-06-15）**帖子无文字**。
 *   同一天他连发四条，都是同一座小岛的转台屏录，只是海陆交界处的处理各试了一种：
 *     1007587817021636609  岛脚一圈宽沙滩 + 泡沫边        ← 本条
 *     1007587821220229120  一条伸出去的沙嘴 + 云影扫过水面
 *     1007587825024425984  换成玄武岩崖 + 崖脚冰帘        （icefringe.js）
 *     1007587828992266240  换成白石灰岩 + 崖上小瀑布      （cascades.js）
 *   四条拼起来才是完整的一套"岸线怎么画"。本条负责**沙**那一段。
 *
 * ── 帧实测（420×420，f010；f004/f016 复算一致）───────────────────────────
 *   画面分块占比   水 59.1% / 沙 12.2% / 泡沫 2.1% / 崖 12.9%
 *   沙（内侧，离水 ≥11px）  (184,152,139) #B8988B
 *   沙（贴水 4–6px）        (188,164,155) #BCA49B
 *        → 湿边是 **R 几乎不动、G +12、B +16** 的一层"发白"，不是"变深"。
 *          第一版按"湿了会变暗"处理，画出来像一圈泥，跟片子完全相反。
 *   湿边宽度     约 **7px**（d=4 到 d=11 之间洗完）
 *   水（远）     #9AB0B3 (154,176,179)；水（贴岸）#6B8089 (107,128,137)
 *   泡沫         #F5F7F6 (245,247,246)，饱和度 1.6 —— 是"白"，不是"淡蓝"
 *   泡沫边宽度   按行取游程 **683 段**，中位 **5px**、均值 5.5、p90 10px
 *        → 它不是一条等宽描边：是 3–5px 的软边 + 若干 4–10px 的亮块，
 *          而且**断得很多**（420px 的画面里只有 223 行带泡沫）
 *   沙滩裙宽度   按方向 16–35px（朝上 27/27/35，朝下只有 4–7）
 *        → 也就是**内侧（靠镜头那侧）几乎没有沙**，沙集中在外侧与左右
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **沙裙是等距椭圆，不是圆。** 它铺在水面上，所以纵向压 0.5（跟 paintIsoBox 的
 *      P() 同一个投影）。第一版用圆画，沙裙变成"岛上套了个泳圈"。
 *   ② **泡沫边不能 `stroke()`。** 实测每 420px 只有 223 行有泡沫、宽度中位 5px 且断成
 *      683 段 —— 一条 stroke 会让整座岛像贴了张白贴纸。所以画成：软底边 + 亮块 + 碎点。
 *   ③ **湿边是提亮不是压暗**（见上面的通道差），而且只有 7px，再宽就成雾了。
 */

export const MEASURED = {
  frame: 420,
  sandIn: [184, 152, 139],
  sandWet: [188, 164, 155],
  wetBand: 7,          // px
  foam: [245, 247, 246],
  foamW: 5,            // 中位宽度
  foamWMax: 10,        // p90
  rimRows: 223 / 420,  // 有泡沫的行占比 → 断裂程度
  waterFar: [154, 176, 179],
  waterNear: [107, 128, 137],
  rock: [76, 67, 79],
  lobeMin: 0.5,        // 沙裙半径的最小/最大比（16..35px）
  lobeMax: 1.0,
  // 等距投影下，地面上的圆 R 投成一个椭圆：x 半轴 1.2247R、y 半轴 0.7071R。
  // 注意比例是 **0.577 不是 0.5** —— 0.5 是"斜视图直接压一半"的常见误用，
  // 用它画出来的沙裙会跟岛体的 P() 不对齐（边缘在四角处露馅）。
  isoX: 1.2247,
  isoY: 0.7071,
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * 一片沙滩裙。
 *
 * ⚠ 单位：`r` 是**片中像素**，`scale` 是"片中px → 画布px"的倍率，两者都乘进 pts 和泡沫尺寸。
 *    早一版 lab 传了 `r: 280, scale: 1`（把画布尺寸当成了片中尺寸），
 *    结果沙裙位置对了、泡沫却只有一半大（泡沫按 1 倍画、沙裙按 280 画）——
 *    反测里"泡沫游程中位 3px"就是这么来的。
 *
 * @param {object} o
 * @param {number} o.cx,o.cy  岛体底面的中心（画布 px）
 * @param {number} o.r        平均半径（片中 px）
 * @param {number} [o.seed]
 * @param {number} [o.scale]
 * @param {number} [o.lobes]  瓣数，9–14
 */
export function makeApron({ cx, cy, r, scale = 1, seed = 11, lobes = 11 }) {
  const rnd = lcg(seed);
  const M = MEASURED;
  const pts = [];
  // 每个瓣一个半径系数；相邻瓣之间用余弦插值 → 边缘是"圆滑的鼓包"而不是折线
  const k = [];
  for (let i = 0; i < lobes; i++) k.push(M.lobeMin + rnd() * (M.lobeMax - M.lobeMin));
  const N = 220;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const f = (a / (Math.PI * 2)) * lobes;
    const i0 = Math.floor(f) % lobes, i1 = (i0 + 1) % lobes;
    const t = f - Math.floor(f);
    const w = (1 - Math.cos(t * Math.PI)) / 2;          // 余弦插值
    const rr = (k[i0] * (1 - w) + k[i1] * w) * r * scale;
    pts.push([cx + Math.cos(a) * rr * M.isoX, cy + Math.sin(a) * rr * M.isoY]);
  }
  return { cx, cy, r: r * scale, pts, scale, seed };
}

/** 沿着沙裙边界铺泡沫 —— 软底边 + 亮块 + 碎点（见"为什么这样写"②）。 */
export function makeFoam(apron, { seed = 17 } = {}) {
  const rnd = lcg(seed);
  const M = MEASURED;
  const n = apron.pts.length;
  const blobs = [];
  for (let i = 0; i < n; i += 1) {
    // 逐点决定有没有泡沫：rimRows≈0.53 → 一半的点有块
    if (rnd() > M.rimRows + 0.02) continue;
    const [x, y] = apron.pts[i];
    blobs.push({
      x: x + (rnd() - 0.5) * 3 * apron.scale,
      y: y + (rnd() - 0.5) * 2 * apron.scale,
      // r 是"实心核"的半径；横向游程 ≈ 2r，实测中位 5px、p90 10px
      r: (M.foamW * 0.42 + rnd() * (M.foamWMax - M.foamW) * 0.4) * apron.scale,
      a: 0.6 + rnd() * 0.35,
    });
  }
  // 漂在外面的碎沫（片子里有，离岸 10–40px，很稀）
  const specks = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1.12 + rnd() * 0.5;
    specks.push({
      x: apron.cx + Math.cos(a) * apron.r * d * MEASURED.isoX,
      y: apron.cy + Math.sin(a) * apron.r * d * MEASURED.isoY,
      r: (0.6 + rnd() * 1.4) * apron.scale,
      a: 0.3 + rnd() * 0.5,
    });
  }
  return { blobs, specks };
}

/**
 * 画沙滩：先整片沙（径向渐变：内侧暖、外侧发白），再湿边，再泡沫。
 * 顺序不能反 —— 湿边必须在泡沫下面，否则泡沫会被湿边的白吃掉一半。
 */
export function paintApron(ctx, apron, foam, { opacity = 1 } = {}) {
  const M = MEASURED;
  ctx.save();
  ctx.globalAlpha = opacity;

  // ① 沙体。片中沙是**几乎纯色**的（内侧 184,152,139 / 贴水 188,164,155，只差 12），
  //    所以这里不铺大范围渐变 —— 湿边是边缘那一圈 7px，不是"整片外圈发白"。
  const g = ctx.createRadialGradient(apron.cx, apron.cy, apron.r * 0.25,
    apron.cx, apron.cy, apron.r);
  g.addColorStop(0, rgba(M.sandIn));
  g.addColorStop(1, rgba(M.sandIn));
  ctx.beginPath();
  ctx.moveTo(apron.pts[0][0], apron.pts[0][1]);
  for (const p of apron.pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // ② 湿边：裁进沙体内侧再 stroke 双倍线宽 → 只有 wetBand 那一圈落在沙上（提亮，见结论③）
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(M.sandWet, 0.92);
  ctx.lineWidth = M.wetBand * 2 * apron.scale;
  ctx.beginPath();
  ctx.moveTo(apron.pts[0][0], apron.pts[0][1]);
  for (const p of apron.pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // ③ 泡沫：软底边（低 alpha 的细描边）+ 实心亮块 + 软晕
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(M.foam, 0.72);
  ctx.lineWidth = 2.4 * apron.scale;
  ctx.beginPath();
  ctx.moveTo(apron.pts[0][0], apron.pts[0][1]);
  for (const p of apron.pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.stroke();

  for (const b of foam.blobs) {
    // 软晕在外、实心在内 —— 只画软晕的话 0.55 的 alpha 压在白沙上根本到不了"白"，
    // 反测会量成 0 段（这是我第一版踩的坑）。
    const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 1.25);
    bg.addColorStop(0, rgba(M.foam, Math.min(1, b.a + 0.3)));
    bg.addColorStop(0.55, rgba(M.foam, b.a * 0.8));
    bg.addColorStop(1, rgba(M.foam, 0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.25, 0, Math.PI * 2);
    ctx.fill();
    // 实心核要够白：片中泡沫是 (245,247,246)，不是"淡蓝的晕"
    ctx.fillStyle = rgba(M.foam, 0.97);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.68, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of foam.specks) {
    ctx.fillStyle = rgba(M.foam, s.a);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 水面：贴岸更深（#6B8089）、远处更浅（#9AB0B3）—— 以岛心为圆心的径向渐变。 */
export function paintWater(ctx, W, H, cx, cy, r) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, Math.max(W, H) * 0.95);
  g.addColorStop(0, rgba(MEASURED.waterNear));
  g.addColorStop(0.55, rgba([138, 161, 167]));
  g.addColorStop(1, rgba(MEASURED.waterFar));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ── 反测：沿若干行量泡沫游程宽度，跟实测的 5px 对 ────────────────────── */

export function probeFoam(ctx, apron) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [img[i], img[i + 1], img[i + 2]];
  };
  const isFoam = (c) => c[0] > 226 && c[1] > 230 && c[2] > 228;
  const runs = [];
  let rowsWith = 0;
  for (let y = 0; y < height; y++) {
    let x = 0, any = false;
    while (x < width) {
      if (isFoam(at(x, y))) {
        const s = x;
        while (x < width && isFoam(at(x, y))) x++;
        if (x - s <= 60) runs.push(x - s);   // 返回画布像素，调用方自己 /scale
        any = true;
      } else x++;
    }
    if (any) rowsWith++;
  }
  runs.sort((a, b) => a - b);
  return {
    n: runs.length,
    med: runs[Math.floor(runs.length / 2)] || 0,
    rows: rowsWith / height,
  };
}
