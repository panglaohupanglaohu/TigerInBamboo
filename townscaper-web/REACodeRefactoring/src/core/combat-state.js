/** A short action interruption. Duration is a local gameplay choice, not measured
 * from the reference video. Falling, boarding and death take precedence.
 */
export function stunUnit(unit, duration = unit.stunDuration ?? 0.7) {
  if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Invalid stun duration');
  if (unit.dead || unit.fall || unit.onBoat) return false;
  unit.stunRemaining = Math.max(unit.stunRemaining || 0, duration);
  return unit.stunRemaining > 0;
}

/** Returns whether this tick is interrupted, even on the expiry tick. */
export function stepStun(unit, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid stun delta');
  if (unit.dead || unit.fall || unit.onBoat) { unit.stunRemaining = 0; return false; }
  const remaining = unit.stunRemaining || 0;
  unit.stunRemaining = Math.max(0, remaining - dt);
  return remaining > 0;
}

/** 870296307889573889「Units can now get knocked off ledges」（REACode combatfx 的 AIR/FALL → LAND / DROWN）。
 * 落地结算：落进海里（脚下没有陆地格）= 溺水；落差 ≥3 层摔死；=2 层掉一点血；≥1 层落地硬直（落差越大越久，原版 LAND 0.35s 档）。
 * 只返回结论，扣血/僵直由调用方按自己的状态机执行。 */
export function resolveFallLanding({ drop, water = false, landStunPerLevel = .18 } = {}) {
  if (!Number.isFinite(drop) || !Number.isFinite(landStunPerLevel) || landStunPerLevel < 0) throw new RangeError('Invalid fall landing');
  if (water) return { outcome: 'drown', stun: 0 };
  if (drop >= 3) return { outcome: 'dead', stun: 0 };
  if (drop >= 2) return { outcome: 'hurt', stun: landStunPerLevel * drop };
  return { outcome: 'land', stun: drop >= 1 ? landStunPerLevel * drop : 0 };
}
