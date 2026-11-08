/**
 * src/piercefloor.js — 穿楼门洞「只吃一层」：洞口不许越过它起步那层的楼板
 *
 * 帖子 ID：802496920790777856（Bad North 粉塔，2018，无原文只有视频）
 * 画面（tmp/cap/802496920790777856/f02·f04）：粉色塔楼四~五层，
 *   底层一道很高的券形门洞穿楼而过；**洞口上方那一层的白色挑檐仍然整条横穿**，
 *   洞口两侧的窗、楼层带、女儿墙都按常规排，只有洞口吃掉的那一层是空的。
 * 上一轮已落地的：券形本身（内椭圆 + 一圈等角楔石，src/archvoid.js）。
 * 本文件补的是当时记下的两条缺口之一：
 *   「洞口只吃楼板以下那一层」——布尔挖洞会把洞顶捅进上一层、把挑檐切成两段。
 *
 * 做法：
 *   洞口不是"从墙里减掉一个券"，而是一条**竖向预算**：洞顶 clamp 到
 *   (层号×层高 − 楼板厚)，也就是它起步那一层的楼板底面。券被截平之后
 *   在上方补一条过梁（lintel），挑檐照常整条横穿；键石留在券顶。
 *   这样"洞口贯穿层数"恒为 1，挑檐连续率恒为 1。布尔挖洞那条对照里，
 *   洞顶会捅进第二层 1.62、切掉 1/3 的挑檐、连带吞掉 2 扇二层窗。
 */

export const CFG = {
  WID: 11.0,        // 立面宽
  FLOORS: 4,        // 层数
  STOREY: 3.2,      // 层高
  SLAB: 0.42,       // 楼板厚（挑檐就挂在楼板这个高度上）
  CORN: 0.26,       // 挑檐出挑高度
  SPAN: 5.6,        // 洞口净宽
  RISE: 4.4,        // 券的矢高（故意高过层高，才会捅穿）
  TREAD: 0.55,      // 台阶每级高
};

/** 券形顶标高：以 x=0 为洞中心，椭圆券（矢高 RISE、半跨 SPAN/2） */
export function archTop(x) {
  const a = CFG.SPAN / 2;
  if (Math.abs(x) >= a) return 0;
  const t = x / a;
  return CFG.RISE * Math.sqrt(Math.max(0, 1 - t * t));
}

/** 第 k 层（0 起）楼板底标高 */
export const slabBottom = (k) => k * CFG.STOREY - CFG.SLAB;

/** 洞口在 x 处的顶标高（mode: 'raw' 布尔挖洞 / 'clipped' 只吃一层） */
export function openingTop(x, mode) {
  const t = archTop(x);
  if (t <= 0) return 0;
  if (mode === 'raw') return t;
  return Math.min(t, slabBottom(1));       // 只吃到第一道楼板底面
}

/** 洞口覆盖了哪几层（按层区间相交算） */
export function piercedFloors(mode) {
  let n = 0;
  for (let k = 0; k < CFG.FLOORS; k++) {
    const lo = k * CFG.STOREY, hi = (k + 1) * CFG.STOREY;
    let top = 0;
    for (let i = 0; i <= 40; i++) {
      const x = -CFG.SPAN / 2 + (CFG.SPAN * i) / 40;
      top = Math.max(top, openingTop(x, mode));
    }
    if (top > lo + 1e-9) n++;
  }
  return n;
}

/** 每道挑檐在洞口宽度内是不是被切断的 */
export function corniceBreaks(mode) {
  const out = [];
  for (let k = 1; k < CFG.FLOORS; k++) {
    const yb = k * CFG.STOREY - CFG.SLAB;
    let cut = false;
    for (let i = 0; i <= 60; i++) {
      const x = -CFG.SPAN / 2 + (CFG.SPAN * i) / 60;
      if (openingTop(x, mode) > yb + 1e-6) cut = true;
    }
    out.push({ storey: k, cut });
  }
  return out;
}

/** 立面上的窗：每层两侧各 2 扇；第二层中间那对正好落在洞口范围内 */
export function windows() {
  const wins = [];
  for (let k = 0; k < CFG.FLOORS; k++) {
    const y0 = k * CFG.STOREY + 0.95;
    for (const x of [-4.35, -2.95, 2.95, 4.35]) wins.push({ x, y: y0, w: 0.86, h: 1.5, storey: k });
  }
  return wins;
}

/** 某道挑檐被洞口切掉了多宽（占立面宽的比例）；没切到就是 0 */
export function cutWidth(mode, k) {
  const yb = k * CFG.STOREY - CFG.SLAB;
  const n = 200;
  let hit = 0;
  for (let i = 0; i <= n; i++) {
    const x = -CFG.SPAN / 2 + (CFG.SPAN * i) / n;
    if (openingTop(x, mode) > yb + 1e-6) hit++;
  }
  return (hit / (n + 1)) * CFG.SPAN;
}

/** 一次算完两种做法的对照数字 */
export function measure() {
  const pack = (mode, name) => {
    const breaks = corniceBreaks(mode);
    let top = 0;
    for (let i = 0; i <= 80; i++) top = Math.max(top, openingTop(-CFG.SPAN / 2 + (CFG.SPAN * i) / 80, mode));
    const lines = CFG.FLOORS - 1;
    return {
      name, mode,
      top,
      overSlab: top - slabBottom(1),        // 洞顶越过第一道楼板底多少
      pierced: piercedFloors(mode),
      breaks: breaks.filter((b) => b.cut).length,
      lines,
      continuity: 1 - breaks.filter((b) => b.cut).length / lines,
      cutW: cutWidth(mode, 1),                       // 第一道挑檐被切掉的净宽
      cutRatio: cutWidth(mode, 1) / CFG.WID,
      ratio: top / CFG.SPAN,                          // 洞口净高 / 净宽
      wallAbove: CFG.FLOORS * CFG.STOREY - top,
    };
  };
  return { raw: pack('raw', '布尔挖洞（洞顶跟着券走）'), clipped: pack('clipped', '只吃一层（洞顶 clamp 到楼板底）') };
}
