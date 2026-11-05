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
