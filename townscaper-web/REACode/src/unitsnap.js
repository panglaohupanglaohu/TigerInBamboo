/**
 * unitsnap.js — 站在多级台地上的队伍，高度必须**逐人取**，不能整队用一个平均高度。
 *
 * 帖子 ID：828984794407170048（2017-02-07，无原文字，仅有视频）
 *   画面（6 帧，540×448，灰白无贴图）：一座灰白岛，顶上一栋小屋和几丛草；
 *   蓝队的盾兵聚在小屋前的坡上，队形是个不规则的团；棕队从画面左下角
 *   沿着一条坡道**排成一列**往上爬 —— 这一列在坡上的每一格都贴着地面走，
 *   人和人之间的高度是**一级一级**抬上去的，没有谁悬着。
 *   地面上另有一些暗红斑（血/脚印拖痕，是另一条机制，本文件不碰）。
 *   帖子 ID：890611046435627008（2017-07-27）同一现象的另一半 —— 蓝队分成两拨，
 *   分别站在上下两层断崖台面上，两拨人的脚底高差就是两级台面的高差。
 *
 * 为什么这个值得单独写：
 *   等距视角里"整队共用一个人"是最省事的写法 —— 队伍中心算一次 heightAt，
 *   全队用同一个 z。在平地上完全看不出问题，一上百 North 这种阶梯地形就露馅：
 *   站在高一级台面上的人被埋进土里，站在低一级上的人悬在半空。
 *   地形是一级一级的（台面平、立面陡），所以正确的高度不是插值出来的，
 *   是**每个人各自落在哪一级台面**。
 *
 * 本文件把两种做法摆在一起，用四个数说话（见 measure）：
 *   悬空人 / 埋入人 / 队伍脚底出现的层数 / 相邻两人之间最大落差。
 */

export const STEP = 0.9;      // 一级台面的高度（世界单位）
export const CELL = 1.0;      // 台地格边长

/** 连续起伏 → 量化成台地。台面顶 = round(raw/STEP)*STEP，和画出来的台阶方块严格一致。 */
function raw(x, y) {
  // 只用低频项：台面才会是成片的台地，而不是碎成一片噪点
  return 1.35
    + 1.55 * Math.sin(x * 0.20) * Math.cos(y * 0.17)
    + 0.85 * Math.sin((x - y) * 0.11);
}

export function heightAt(x, y) {
  return Math.round(raw(x, y) / STEP) * STEP;
}

/**
 * 单位站在**它占的那一格**上，取的是那一格的台面高度，不是它脚下那个浮点位置的高度。
 * 地形是格子做的，格子只有一份高度；按浮点位置取会在台沿两侧算出两个值 ——
 * 那才会真的出现"半只脚悬空"。
 */
export function standHeight(x, y) {
  return heightAt(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
}

/** 台地格：每格一个方块（顶面 = heightAt(格心)），供 iso 渲染用。 */
export function makeTerrain(n = 26) {
  const g = [];
  for (let y = 0; y < n; y++) {
    g[y] = [];
    for (let x = 0; x < n; x++) g[y][x] = { x, y, z: heightAt(x + 0.5, y + 0.5) };
  }
  return { n, g };
}

/** 队伍：确定性抖动的一个圆盘（撒在坡上，跨好几级台面）。 */
export function makeSquad(cx, cy, count = 22, radius = 3.1, seed = 3) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 4000) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (out.some((u) => Math.hypot(u.x - x, u.y - y) < 0.62)) continue; // 不叠人
    out.push({ x, y, foot: 0 });
  }
  return out;
}

/**
 * 两种高度策略。mode='flat' 整队共用中心高度；mode='snap' 逐人取脚下台面。
 * 返回带 foot 的单位数组（不改入参）。
 */
export function place(squad, mode, center) {
  const hc = standHeight(center.x, center.y);
  return squad.map((u) => ({ x: u.x, y: u.y, foot: mode === 'flat' ? hc : standHeight(u.x, u.y) }));
}

/** 四个数：悬空 / 埋入 / 层数 / 最大相邻落差。eps 用于判"贴面"。 */
export function measure(units, eps = 0.02) {
  let floating = 0, buried = 0;
  const levels = new Set();
  let maxGap = 0;
  for (const u of units) {
    const t = standHeight(u.x, u.y);
    const d = u.foot - t;
    if (d > eps) floating++;
    if (d < -eps) buried++;
    levels.add(+t.toFixed(3));
  }
  // 相邻两人按"离队心距离"排序后的高度落差（近似队形上的相邻）
  const cx = units.reduce((a, u) => a + u.x, 0) / units.length;
  const cy = units.reduce((a, u) => a + u.y, 0) / units.length;
  const ring = units
    .map((u) => ({ u, d: Math.hypot(u.x - cx, u.y - cy), a: Math.atan2(u.y - cy, u.x - cx) }))
    .sort((p, q) => p.a - q.a);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    maxGap = Math.max(maxGap, Math.abs(standHeight(ring[i].u.x, ring[i].u.y) - standHeight(ring[j].u.x, ring[j].u.y)));
  }
  return {
    floating, buried,
    levels: levels.size,
    maxGap: +maxGap.toFixed(2),
    groundSpread: +(Math.max(...units.map((u) => standHeight(u.x, u.y))) -
      Math.min(...units.map((u) => standHeight(u.x, u.y)))).toFixed(2),
  };
}
