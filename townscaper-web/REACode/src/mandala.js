/**
 * mandala.js — 极坐标花纹：同心环 + 角度成簇 + 4 重对称。
 *
 * 原文：x.com/OskSta/status/1490068909042642944 (2022-02-05)
 *       "Late night cryptic graph tweet"
 *
 * 画面（最后一帧，640×640）量到的：
 *   · 节点是**小圆环**（描边圆），半径各不相同，约 0.8~4px（直径 1.6~8px）；
 *   · 它们落在 **7 个同心环**上，环间距由内到外 26 / 31 / 34 / 38 / 41 / 45 px ——
 *     **越往外越疏**（比值 1.73）；
 *   · 同一环上的节点**成簇**：每簇 4~9 个挤在一起，簇与簇之间空出 20°~40°；
 *   · 每个节点还有 ±3px 的**径向抖动**，所以环看起来是"手绘的圈"而不是几何圆；
 *   · 背景另有**很淡的引导圆**（同一个半径，alpha ≈ 0.06），一共 7 条；
 *   · 整体 4 重对称（每 90° 重复一次），但**不完全精确** —— 每份的抖动不同，
 *     所以看起来是"一朵花"而不是"一块瓷砖"。
 *
 * 生长方式（第 0→15 帧）：半径随时间增大、新节点出现在外圈，已有节点不动。
 * 注意是**从中心往外长**，不是旋转、也不是淡入一个完整的花。
 */

export function makeRng(seed) {
  let s = (seed * 22695477 + 1) | 0;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
}

/** 近似正态：12 个均匀数求和（够用，而且没有拒绝采样的分支）。 */
function gauss(rnd) {
  let v = 0;
  for (let i = 0; i < 6; i++) v += rnd();
  return (v - 3) / 1.4;
}

/**
 * 生成花纹。
 *
 * 关键参数（都对得上参考帧）：
 *   rings      7      同心环数
 *   growth     1.73   外/内 环间距比（pow 曲线让外圈变疏）
 *   clusters   3~5    每个象限每环的簇数
 *   perCluster 4~9    每簇节点数
 *   jitterR    0.035  径向抖动（相对最大半径）
 */
export function buildMandala({
  seed = 7,
  symmetry = 4,
  rings = 7,
  rMin = 0.075,
  rMax = 0.98,
  growth = 1.73,
  clusters = 4,
  perCluster = 7,
  jitterR = 0.035,
} = {}) {
  const rnd = makeRng(seed);
  const sector = (Math.PI * 2) / symmetry;

  // 环半径：r_i = rMin * (growth)^(i/(rings-1)) 归一化到 rMax
  const rawR = [];
  for (let i = 0; i < rings; i++) rawR.push(Math.pow(growth, i / (rings - 1)));
  const lo = rawR[0], hi = rawR[rings - 1];
  const ringR = rawR.map((v) => rMin + ((v - lo) / (hi - lo)) * (rMax - rMin));

  const base = [];   // 一个象限内的节点（角度 0..sector）
  for (let i = 0; i < rings; i++) {
    const r = ringR[i];
    const nClusters = clusters + ((rnd() * 2) | 0) - 1;
    for (let c = 0; c < nClusters; c++) {
      // 簇心角度：均匀铺在象限里，再加抖动（否则会出现整齐的放射线）
      const aC = (c + 0.5) / nClusters * sector + (rnd() - 0.5) * sector * 0.22;
      const spread = sector * (0.055 + rnd() * 0.055);
      const n = Math.max(2, Math.round(perCluster * (0.5 + rnd())));
      for (let k = 0; k < n; k++) {
        base.push({
          r: r + gauss(rnd) * jitterR,
          a: aC + gauss(rnd) * spread,
          // 节点半径：多数小、少数大（参考帧里点的大小差 4 倍）
          size: 0.55 + Math.pow(rnd(), 2.2) * 1.9,
          ring: i,
        });
      }
    }
  }

  // 对称复制（每份的抖动重新抽一次 → "一朵花"而不是"一块瓷砖"）
  const nodes = [];
  for (let s = 0; s < symmetry; s++) {
    const rot = s * sector;
    for (const p of base) {
      nodes.push({
        r: p.r + (rnd() - 0.5) * jitterR * 0.6,
        a: p.a + rot + (rnd() - 0.5) * 0.012,
        size: p.size * (0.9 + rnd() * 0.2),
        ring: p.ring,
      });
    }
  }

  const spacings = [];
  for (let i = 1; i < rings; i++) spacings.push(+(ringR[i] - ringR[i - 1]).toFixed(3));

  return {
    nodes,
    ringR,
    stats: {
      symmetry,
      rings,
      baseNodes: base.length,
      totalNodes: nodes.length,
      rMin: +rMin.toFixed(3),
      rMax: +rMax.toFixed(3),
      ringSpacing: spacings,
      ringRatio: +(spacings[spacings.length - 1] / spacings[0]).toFixed(2),
      sizeRange: [+Math.min(...nodes.map((n) => n.size)).toFixed(2),
        +Math.max(...nodes.map((n) => n.size)).toFixed(2)],
    },
  };
}

/**
 * 画一帧。`progress` 0..1 = 半径长到 rMax*progress。
 * 引导圆（faint guide circles）只有在 progress 覆盖到该环时才画。
 */
export function drawMandala(ctx, {
  w, h, mandala, progress = 1,
  nodeColor = 'rgba(232,240,242,0.95)',
  guideColor = 'rgba(210,226,230,0.085)',
} = {}) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.46;
  const cut = mandala.stats.rMax * progress;

  // 引导圆
  ctx.strokeStyle = guideColor;
  ctx.lineWidth = 1;
  for (const r of mandala.ringR) {
    if (r > cut) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, r * R, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 节点：小圆环（描边），少数填充
  const px = Math.max(0.55, Math.min(w, h) * 0.0011);
  ctx.strokeStyle = nodeColor;
  ctx.fillStyle = nodeColor;
  for (const n of mandala.nodes) {
    if (n.r > cut) continue;
    const fade = Math.min(1, (cut - n.r) / (mandala.stats.rMax * 0.08));
    const x = cx + Math.cos(n.a) * n.r * R;
    const y = cy + Math.sin(n.a) * n.r * R;
    const rad = n.size * px * 3.4;
    ctx.globalAlpha = fade * 0.95;
    ctx.lineWidth = Math.max(0.7, rad * 0.42);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    if (n.size > 2.0) ctx.fill(); else ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
