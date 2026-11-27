/**
 * distcontour.js — 距离场等值线：把"到边界多远"画成一圈圈发光线
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   902103473365417984（2017-08-28）
 *   "Ok, one more visualization. Distances this time. I really should get back
 *    to proper work now"
 *   → 只说明这是"距离可视化"，是调试屏，不是游戏画面。2017 年那批 Bad North
 *     可视化截图之一（同批还有 913407568730615808 / 978194866520944641）。
 *
 * ── 帧实测（420×420 · 902103473365417984 f007，4× 放大复核）──────────────
 *   ① 线是**等距等值线**，不是描边。沿垂直方向切过岸线外侧那组平行线：
 *        y=187–188 峰 (232,254,240)/(234,255,250)
 *        y=193–194 峰 (217,233,234)/(236,248,248)
 *      两条线**中心距 6px**，也就是说 1 个等值步长在屏幕上是 6px。
 *   ② 开阔地那组线间距 22px（x=130 竖切：峰在 207 与 229）。同一个距离场，
 *      间距随地势/透视从 6px 张开到 22px —— 说明等值线是**世界空间定间隔**，
 *      不是屏幕空间等距，写死 6px 只在岸边对。
 *   ③ 核心 1px，色 (234,255,250) 偏绿白（和这条片子水线白 239,255,246 同族，
 *      说明这套调试线复用了同一个白）。核心两侧各 1px 降到 ~(198,220,218)，
 *      再外还有约 3px 的**叠加晕**（相邻像素抬 10–20 灰阶）→ 是 additive 叠的。
 *   ④ 底色地面 (151,173,177)，线核心比地面亮 +83 灰阶，靠"亮"而不是"色"读出来。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   · 距离场用 **3-4 chamfer 两趟扫描**，不用 BFS/EDT：等值线要的是"整格量化"，
 *     欧氏 EDT 会让 45° 方向的线在整数级上抖成台阶（第一版就是这样，
 *     斜边上的线宽在 1px / 3px 之间跳）。
 *   · 等值线用 **marching squares 按 4 个格角组合查表**，而不是逐像素判断
 *     `round(d) == level`：后者在等值线斜过格子时会出现"点状虚线"。
 *   · 每级等值线**先画晕再画芯**，晕用 `lighter` 合成，芯用 source-over。
 *     顺序反了（先芯后晕）会把芯冲淡到 (200,220,218) 那一档，实测峰就没了。
 *   · 等值步长按**格**计（默认 1 格），像素步长 = 间隔 × 格子尺寸，
 *     这样地势一压缩就自动从 6px 张到 22px，和 ② 的观察一致。
 */

export const MEASURED = {
  ref: [420, 420],
  pitchNear: 6,        // 岸边那组的相邻等值线间距（px；两线峰在 y=187.5 / 193.5）
  pitchOpen: 22,       // 开阔地那组（px）
  core: [234, 255, 250],
  coreW: 2,        // 实测核心 2px（y=187,188 两行都在 +76）
  aa: [198, 220, 218],
  haloW: 2,
  haloGain: 0.28,      // 晕的相对亮度（叠加；实测线间那档只抬 +18 灰阶）
  base: [151, 173, 177],
  lift: 83,            // 核心相对地面的灰阶提升
  intervalCells: 1,
};

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * 3-4 chamfer 距离变换。occ 里 1 = 实心（距离 0），0 = 空。
 * 距离单位 = 格；对角步长取 1.4142（不用 3/4 的近似，等值线会看出来）。
 */
export function chamfer(occ, w, h) {
  const D = new Float32Array(w * h);
  const BIG = 1e9;
  for (let i = 0; i < w * h; i++) D[i] = occ[i] ? 0 : BIG;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + a);
      if (y > 0) d = Math.min(d, D[i - w] + a);
      if (x > 0 && y > 0) d = Math.min(d, D[i - w - 1] + b);
      if (x < w - 1 && y > 0) d = Math.min(d, D[i - w + 1] + b);
      D[i] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = D[i];
      if (x < w - 1) d = Math.min(d, D[i + 1] + a);
      if (y < h - 1) d = Math.min(d, D[i + w] + a);
      if (x < w - 1 && y < h - 1) d = Math.min(d, D[i + w + 1] + b);
      if (x > 0 && y < h - 1) d = Math.min(d, D[i + w - 1] + b);
      D[i] = d;
    }
  }
  return D;
}

/** 格点周围距离场的双线性采样（格坐标）。 */
export function sampleField(F, w, h, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return 0;
  const fx = x - x0, fy = y - y0;
  const i = y0 * w + x0;
  const a = F[i], b = F[i + 1], c = F[i + w], d = F[i + w + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * marching squares 单级等值线。
 * 返回线段数组 [[x0,y0,x1,y1]]（格坐标，未乘格子尺寸）。
 * 4 个格角的 16 种组合全部覆盖，鞍点（5/10）用中心值决定走向。
 */
export function marchingSquares(F, w, h, iso) {
  const segs = [];
  const grab = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : F[y * w + x]);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = grab(x, y), b = grab(x + 1, y), c = grab(x + 1, y + 1), d = grab(x, y + 1);
      let idx = 0;
      if (a >= iso) idx |= 1;
      if (b >= iso) idx |= 2;
      if (c >= iso) idx |= 4;
      if (d >= iso) idx |= 8;
      if (idx === 0 || idx === 15) continue;
      const top = () => [x + (iso - a) / (b - a), y];
      const bot = () => [x + (iso - d) / (c - d), y + 1];
      const lef = () => [x, y + (iso - a) / (d - a)];
      const rig = () => [x + 1, y + (iso - b) / (c - b)];
      switch (idx) {
        case 1: case 14: segs.push([...lef(), ...top()]); break;
        case 2: case 13: segs.push([...top(), ...rig()]); break;
        case 3: case 12: segs.push([...lef(), ...rig()]); break;
        case 4: case 11: segs.push([...rig(), ...bot()]); break;
        case 6: case 9:  segs.push([...top(), ...bot()]); break;
        case 7: case 8:  segs.push([...lef(), ...bot()]); break;
        case 5: { // 鞍点：a,c 在内
          const mid = (a + b + c + d) / 4;
          if (mid < iso) { segs.push([...lef(), ...top()]); segs.push([...rig(), ...bot()]); }
          else { segs.push([...lef(), ...bot()]); segs.push([...top(), ...rig()]); }
          break;
        }
        case 10: { // 鞍点：b,d 在内
          const mid = (a + b + c + d) / 4;
          if (mid < iso) { segs.push([...top(), ...rig()]); segs.push([...lef(), ...bot()]); }
          else { segs.push([...lef(), ...top()]); segs.push([...rig(), ...bot()]); }
          break;
        }
        default: break;
      }
    }
  }
  return segs;
}

/** 多级：level = interval, 2*interval, ... 直到 field 最大值。 */
export function isoLines(F, w, h, opt = {}) {
  const interval = opt.interval ?? MEASURED.intervalCells;
  const max = opt.max ?? 64;
  const from = opt.from ?? interval;
  const out = [];
  for (let lv = from; lv <= max; lv += interval) {
    const segs = marchingSquares(F, w, h, lv);
    if (segs.length) out.push({ level: lv, segs });
  }
  return out;
}

/**
 * 画等值线：先叠加晕，再画核心。
 * @param {object} opt cell=格子像素尺寸, haloW/haloGain/core 可覆盖实测值
 */
export function drawContours(ctx, lines, opt = {}) {
  const cell = opt.cell ?? 6;
  const haloW = (opt.haloW ?? MEASURED.haloW);
  const coreW = (opt.coreW ?? MEASURED.coreW) * (opt.coreScale ?? 1);
  const haloAlpha = opt.haloGain ?? MEASURED.haloGain;
  const core = opt.core ?? MEASURED.core;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ① 晕（additive）
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgb(core, haloAlpha);
  ctx.lineWidth = haloW * (opt.haloScale ?? 1);
  for (const L of lines) {
    ctx.beginPath();
    for (const s of L.segs) {
      ctx.moveTo(s[0] * cell, s[1] * cell);
      ctx.lineTo(s[2] * cell, s[3] * cell);
    }
    ctx.stroke();
  }

  // ② 芯
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgb(core, 1);
  ctx.lineWidth = coreW;
  for (const L of lines) {
    ctx.beginPath();
    for (const s of L.segs) {
      ctx.moveTo(s[0] * cell, s[1] * cell);
      ctx.lineTo(s[2] * cell, s[3] * cell);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 统计等值线段总长（格为单位），用来做"线量"回归。 */
export function totalLength(lines) {
  let n = 0;
  for (const L of lines) {
    for (const s of L.segs) n += Math.hypot(s[2] - s[0], s[3] - s[1]);
  }
  return n;
}
