/** Local tuning inspired by 984813819280191488; not original game statistics. */
const PROFILES = Object.freeze({
  small: Object.freeze({bodyScale:1, radius:.055, stunDuration:.7}),
  big: Object.freeze({bodyScale:1.5, radius:.0825, stunDuration:0})
});
export function configureCombatUnit(unit, {kind='small', maxHealth=kind==='big'?6:2} = {}) {
  if (!Object.hasOwn(PROFILES, kind) || !Number.isInteger(maxHealth) || maxHealth<1 || maxHealth>1000)
    throw new RangeError('Invalid combat profile');
  Object.assign(unit, PROFILES[kind], {kind, max:maxHealth, hp:maxHealth, soak:0, stunRemaining:0});
  return unit;
}

export function damageCombatUnit(unit, amount=1) {
  if (!Number.isFinite(amount) || amount<0 || !Number.isFinite(unit.hp) || !Number.isFinite(unit.max) || unit.max<=0)
    throw new RangeError('Invalid health damage');
  unit.hp = Math.max(0, Math.min(unit.max, unit.hp-amount));
  unit.soak = 1-unit.hp/unit.max;
  return unit.hp;
}
