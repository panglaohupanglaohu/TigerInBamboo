/**
 * waterline.js — 2023 版岸边线：**没有浅水带的硬水线**（暗缝 1px + 白沫 2px）
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1666429884208381953（2023-06-07）
 *   "I've been banging my head against various shore line rendering options for
 *    a good week now. Gonna stick with this for now I think, which is basically
 *    just a refined version of what I did for Bad North and Townscaper."
 *   → 只说"精修版 Bad North / Townscaper 做法"，没给任何参数。全部要靠逐像素。
 *
 * ── 帧实测（640×602 · 1666429884208381953 f004，画幅放大 4× 复核）──────────
 *   ① **没有浅水带。** 这是本轮最值钱的一条：索引里挂了三轮的"浅水带宽度"欠账，
 *      实测是 **0px**。从岸边往里推 30 / 100 / 190px 各点采样，水面**完全同一个值**
 *      rgb(91,123,129)，一个通道都不动（`hscan 430→620 @y470` 全等，`rect` 30×30 的
 *      min == max == mean）。片子里看着"浅"的那圈其实是**岛自己的浅色沙坡**（陆地），
 *      不是水。所以这里不写任何"浅水渐变"，写了就是过度实现。
 *   ② **水线是两层，不是一层。** 由陆往水依次是：
 *        陆地沙坡 (253,227,139)
 *        → 暗缝 (95,111,116)  1–3px，比水**更暗更暖**（R 高于水、G/B 低于水）
 *        → 白沫 (239,255,246) 2px 核心 + 各 1px AA（峰值不在 255，偏一点绿）
 *        → 水 (91,123,129)
 *      只画白线会显得"贴上去"，暗缝是让白线有落点的那个东西。
 *   ③ **岛影是平涂。** 水里那块影 rgb(51,85,86)，**平色**，无渐变；
 *      边界 582→583→584 三像素从影色过到水色（49,81,87 / 63,95,101 / 91,123,129），
 *      即 1–2px AA、**没有半影**。这一条正好和 1305948413872267265 那条"要 soft"
 *      的帖子相反 —— 远景岛影是硬的，近景接触影才要软。
 *   ④ 白沫**碎屑**：水里零散小白条，长 4–10px、宽 1–2px，随机朝向，密度很低
 *      （这片水面 1000px² 里约 1 条），离开岸 10–80px 都有，越远越少。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   · 水面用**一个纯色**填，不做 distance-to-shore 混合。实测已经证明没有梯度，
 *     任何梯度都会把"干净"的观感做脏（A/B 里灰度差会从 0 涨到 2% 以上）。
 *   · 白线**屏幕定宽 2px**，不随地块大小缩放：片子相机在推，线宽始终 2px。
 *   · 白线相对陆地轮廓**外扩 2px**（先在外侧落白，暗缝压在陆地那一侧），
 *     这就是 ①→② 的取样顺序；同一条轮廓上直接画白线会吃进陆地半个像素。
 *   · 影用平涂多边形（不是 canvas 的 blur shadow），因为实测边界只有 1–2px。
 *     canvas shadowBlur 最小也得 4px 起跳，做出来立刻变成"雾"。
 */

export const MEASURED = {
  ref: [640, 602],           // 主量测片画幅
  water: [91, 123, 129],     // 水面平色（30×30 rect：min==max==mean）
  shadow: [51, 85, 86],      // 水里岛影平色
  shadowEdgeAA: 2,           // 影→水过渡像素数（实测 2）
  seam: [95, 111, 116],      // 岸内侧暗缝色
  seamWidth: [1, 3],         // 暗缝宽（含 AA）
  foam: [239, 255, 246],     // 白沫峰值色（不是纯白）
  foamCore: 2,               // 白沫核心宽
  foamAA: 1,                 // 白沫两侧 AA
  foamOffset: 2,             // 白沫相对陆地轮廓的外扩距离
  shelfWidth: 0,             // **浅水带 0px**（负面结论，见 ① ）
  fleck: { min: 4, max: 10, width: [1, 2], per1000: 1 },
};

/** 水面在任何距离上的颜色：实测是常数。留成函数是为了让 lab 能画"剖面"。 */
export function waterAt(_distPx) {
  return MEASURED.water.slice();
}

/** 岛影颜色：平涂，不做距离衰减。 */
export function shadowAt(_distPx) {
  return MEASURED.shadow.slice();
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** 环 → 逐点法线（屏幕空间，外法线取"多边形绕向决定"的那侧，这里统一按逆时针外扩）。 */
export function ringNormals(ring) {
  const n = ring.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n], q = ring[(i + 1) % n];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    // 逆时针环的外法线 = 切线右转 90°
    out[i] = [dy / l, -dx / l];
  }
  return out;
}

/** 简单的斜接外扩：d 为像素。尖角处夹到 2.2d，避免长刺。 */
export function offsetRing(ring, d) {
  const nm = ringNormals(ring);
  return ring.map((p, i) => [p[0] + nm[i][0] * d, p[1] + nm[i][1] * d]);
}

function traceRing(ctx, ring) {
  ctx.beginPath();
  ctx.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
  ctx.closePath();
}

/**
 * 画一条岸线：暗缝（压在陆侧）→ 白沫（外扩 foamOffset）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<[number,number]>>} rings 屏幕空间环（逆时针）
 * @param {{scale?:number}} opt  scale 只用于"是否沿用屏幕定宽"，默认 1 = 定宽
 */
export function strokeShore(ctx, rings, opt = {}) {
  const s = opt.scale || 1;
  const fw = MEASURED.foamCore * s;
  const sw = (MEASURED.seamWidth[0] + MEASURED.seamWidth[1]) / 2 * s;
  const off = MEASURED.foamOffset * s;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ① 白沫：外扩环上画 core + 外侧 1px AA（用两条描边模拟实测剖面）
  for (const ring of rings) {
    const o = offsetRing(ring, off);
    traceRing(ctx, o);
    ctx.strokeStyle = rgb(MEASURED.foam, 0.55);   // AA 边
    ctx.lineWidth = fw + 2;
    ctx.stroke();
    traceRing(ctx, o);
    ctx.strokeStyle = rgb(MEASURED.foam, 1);
    ctx.lineWidth = fw;
    ctx.stroke();
  }

  // ② 暗缝：原轮廓上，压在陆地那一侧
  for (const ring of rings) {
    traceRing(ctx, ring);
    ctx.strokeStyle = rgb(MEASURED.seam, 1);
    ctx.lineWidth = sw;
    ctx.stroke();
  }
  ctx.restore();
}

/** 水面 + 岛影，都是平涂。shadowRings 为影子多边形（已含偏移）。 */
export function drawFlatWater(ctx, w, h, shadowRings = []) {
  ctx.save();
  ctx.fillStyle = rgb(MEASURED.water);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgb(MEASURED.shadow);
  for (const r of shadowRings) { traceRing(ctx, r); ctx.fill(); }
  ctx.restore();
}

/** 确定性 LCG：影/沫碎屑都要可复测。 */
export function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * 水上碎沫：短白条，随机朝向。密度按 1000px² 一条算（实测）。
 * @returns {Array<{x:number,y:number,len:number,ang:number,w:number}>}
 */
export function foamFlecks(ring, bbox, seed = 7) {
  const rnd = lcg(seed);
  const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
  const n = Math.round(area / 1000 * MEASURED.fleck.per1000);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: bbox[0] + rnd() * (bbox[2] - bbox[0]),
      y: bbox[1] + rnd() * (bbox[3] - bbox[1]),
      len: MEASURED.fleck.min + rnd() * (MEASURED.fleck.max - MEASURED.fleck.min),
      ang: rnd() * Math.PI,
      w: MEASURED.fleck.width[0] + rnd(),
    });
  }
  return out;
}

export function drawFlecks(ctx, flecks, alpha = 0.75) {
  ctx.save();
  ctx.strokeStyle = rgb(MEASURED.foam, alpha);
  ctx.lineCap = 'round';
  for (const f of flecks) {
    ctx.lineWidth = f.w;
    ctx.beginPath();
    ctx.moveTo(f.x - Math.cos(f.ang) * f.len / 2, f.y - Math.sin(f.ang) * f.len / 2);
    ctx.lineTo(f.x + Math.cos(f.ang) * f.len / 2, f.y + Math.sin(f.ang) * f.len / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 岛影多边形：把岛屿轮廓往光反方向平移 + 竖向压扁（片中影比岛本体窄）。 */
export function dropShadowRing(ring, dx, dy, squash = 1) {
  return ring.map(([x, y]) => [x + dx, y + dy * squash]);
}
