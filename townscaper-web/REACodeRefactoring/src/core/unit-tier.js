/** Render-only tier cues from 827215002448846848; local palette, not original assets/stats. */
const TIERS = Object.freeze([
  Object.freeze({ tier: 1, helmet: '#7f9098', shield: '#507e97' }),
  Object.freeze({ tier: 2, helmet: '#edf0df', shield: '#d5e4df' }),
  Object.freeze({ tier: 3, helmet: '#e9d37b', shield: '#d3bc61' }),
]);
export function unitTierAppearance(tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new RangeError('tier must be 1, 2 or 3');
  return TIERS[tier - 1];
}
// Deliberately independent of configureCombatUnit: changing appearance must never heal a unit.
export function setUnitAppearanceTier(unit, tier = null) {
  if (!unit || typeof unit !== 'object') throw new TypeError('unit required');
  if (tier === null) delete unit.appearanceTier;
  else { unitTierAppearance(tier); unit.appearanceTier = tier; }
  return unit;
}

/* 827215002448846848 残差·升级机制：本地最小真实机制「击杀数 → 等级 → 装备档位」。
 * 非原作复现 —— 片里只见三档装束并列展示，升级经济 / XP / 触发时机均未公开；
 * 上游 REACode 裁判也没有等级/XP 字段可对齐（squadbanner/combatfx 通读无对应概念），
 * 故字段取直白语义 u.kills（击杀计数）/ u.level（当前档位）。
 * 阈值 [2,5] 是本地解释：片内没有升级过程可量化，取「一场小战能看到升档」的最小刻度。
 * 等级只升不降；spawnSquad tier=N 预置档位的单位以 appearanceTier 为起始档，不会被打回低档。 */
export const PROMOTION_THRESHOLDS = Object.freeze([2, 5]);
export function unitLevelForKills(kills, thresholds = PROMOTION_THRESHOLDS) {
  if (!Number.isInteger(kills) || kills < 0) throw new RangeError('kills must be a non-negative integer');
  if (!Array.isArray(thresholds) || !thresholds.length || thresholds.some((t) => !Number.isInteger(t) || t < 1)) throw new RangeError('invalid promotion thresholds');
  let level = 1;
  for (const t of thresholds) if (kills >= t) level++;
  return Math.min(level, TIERS.length);
}
/** 记一次击杀并刷新 u.level；返回 {kills, level, earned, promoted}。
 * earned = 仅按击杀数该得的档位；level = max(原档, earned)（升级不降档）；
 * promoted = 本次真的升档（调用方应同步外观档位）。 */
export function creditUnitKill(u, { thresholds = PROMOTION_THRESHOLDS } = {}) {
  if (!u || typeof u !== 'object') throw new TypeError('unit required');
  const kills = u.kills ?? 0;
  if (!Number.isInteger(kills) || kills < 0) throw new RangeError('u.kills must be a non-negative integer');
  const before = u.level ?? u.appearanceTier ?? 1;
  const earned = unitLevelForKills(kills + 1, thresholds);
  const level = Math.max(before, earned);
  u.kills = kills + 1; u.level = level;
  return { kills: u.kills, level, earned, promoted: level > before };
}
