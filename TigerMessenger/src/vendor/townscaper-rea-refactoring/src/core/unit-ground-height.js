/** Local per-unit height easing; 828984794407170048 shows tiered movement, not original easing constants.
 * Exponential approach composes across timesteps. Target is caller's actual navigation floor, never squad mean.
 */
export function easeUnitGroundHeight(y, floor, levelHeight, dt, rate=10){
 if(![y,floor,levelHeight,dt,rate].every(Number.isFinite)||!Number.isInteger(floor)||floor<0||levelHeight<=0||dt<0||rate<0)throw new RangeError('invalid unit ground height input');
 return y+(floor*levelHeight-y)*(-Math.expm1(-rate*dt));
}
