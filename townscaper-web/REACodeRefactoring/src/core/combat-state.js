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
