// =====================================================================
// 地理季相：季节是星球上的「地方」，不是日历上的「时候」。
// 从北极到南极单调走完一年 —— 玩家纵穿一次星球 = 走过一个轮回。
//
// 铁律：
//   1. 本文件绝对不允许出现 new Date() / Date.now() / getMonth()。
//      日历驱动季节正是 2026-09-01 卡顿事故的成因。
//   2. 季相只允许影响【颜色 / 天气偏置 / 粒子】。
//      绝对不允许影响 FEATURES、worldVersion、几何生成。
// =====================================================================

export const SEASON_BANDS_SCHEMA_VERSION = 1;

/**
 * 季相带表 —— 美术决策集中在这一张表，改顺序不用碰下面任何逻辑。
 * minLat 从高到低排列，第一条命中即返回。blendDeg = 与下一带的过渡宽度。
 */
export const SEASON_BANDS = Object.freeze([
  Object.freeze({ name: "winter", minLat: 45, blendDeg: 12 }), // 三重门 +62、苔庭 +56
  Object.freeze({ name: "autumn", minLat: 5, blendDeg: 12 }), // 高山圣城 +24.1
  Object.freeze({ name: "summer", minLat: -35, blendDeg: 12 }), // 水晶城 / 白鲸海湖 −24
  Object.freeze({ name: "spring", minLat: -Infinity, blendDeg: 12 }), // 叹息之门峡谷 −50
]);

/** 世界坐标 → 纬度（度）。与半径无关，只看方向。 */
export function latitudeOf(pos) {
  if (!pos) return 90;
  const x = pos.x ?? 0;
  const y = pos.y ?? 0;
  const z = pos.z ?? 0;
  const len = Math.hypot(x, y, z);
  if (!(len > 1e-6)) return 90;
  // clamp 防浮点越界让 asin 出 NaN
  const s = Math.max(-1, Math.min(1, y / len));
  return (Math.asin(s) * 180) / Math.PI;
}

function smoothstep(edge0, edge1, x) {
  const span = edge1 - edge0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (Math.abs(span) > 1e-6 ? span : 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * 纬度 → 季相。
 * @returns {{ name: string, next: string, blend: number, index: number }}
 *   blend = 0 完全是 name；blend → 1 正在过渡到 next（更低纬那一带）。
 */
export function seasonAtLatitude(latDeg) {
  const lat = Number.isFinite(latDeg) ? latDeg : 90;
  let index = SEASON_BANDS.findIndex((band) => lat >= band.minLat);
  if (index < 0) index = SEASON_BANDS.length - 1;
  const band = SEASON_BANDS[index];
  const nextBand = SEASON_BANDS[Math.min(index + 1, SEASON_BANDS.length - 1)];
  const lower = band.minLat;
  const blend = Number.isFinite(lower) ? 1 - smoothstep(lower, lower + band.blendDeg, lat) : 0;
  return { name: band.name, next: nextBand.name, blend, index };
}

/** 便捷：世界坐标 → 季相 */
export function seasonAt(pos) {
  return seasonAtLatitude(latitudeOf(pos));
}
