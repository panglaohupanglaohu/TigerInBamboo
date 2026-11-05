/** Fixed-axis extending capsule; not a rotating/deforming weapon sweep. */
export function beginSpearThrust(origin, direction, {length = .44, duration = .18, radius = .04, targets = []} = {}) {
  if (![origin.x, origin.z, direction.x, direction.z, length, duration, radius].every(Number.isFinite) ||
      length <= 0 || duration <= 0 || radius < 0 || Math.hypot(direction.x, direction.z) === 0)
    throw new RangeError('Invalid spear thrust');
  const norm = Math.hypot(direction.x, direction.z);
  return {x: origin.x, z: origin.z, dx: direction.x / norm, dz: direction.z / norm,
    length, duration, radius, age: 0, done: false, hit: new Set(),
    previous: new Map(Array.from(targets, t => [t, {x:t.x, z:t.z}]))};
}

// Earliest normalized time in the union of shaft rectangle and its round caps.
// A target moves linearly; the spear's fixed-axis tip extends linearly too.
function contactTime(x, z, vx, vz, reach, extension, radius) {
  const interval = [0, 1];
  const clip = (a,b) => {
    if (b === 0) return a >= 0;
    if (b > 0) interval[0] = Math.max(interval[0], -a/b);
    else interval[1] = Math.min(interval[1], -a/b);
    return interval[0] <= interval[1];
  };
  let shaft = Infinity;
  if (clip(x,vx) && clip(reach-x,extension-vx) && clip(radius-z,-vz) && clip(radius+z,vz)) shaft = interval[0];
  const circle = (cx,cz,dx,dz) => {
    const c = cx*cx + cz*cz - radius*radius;
    if (c <= 0) return 0;
    const a = dx*dx + dz*dz, b = 2*(cx*dx+cz*dz), discriminant = b*b-4*a*c;
    if (a === 0 || discriminant < 0) return Infinity;
    const t = (-b-Math.sqrt(discriminant))/(2*a);
    return t >= 0 && t <= 1 ? t : Infinity;
  };
  return Math.min(shaft, circle(x,z,vx,vz), circle(x-reach,z,vx-extension,vz));
}

export function stepSpearThrust(thrust, targets, dt, {canHit = () => true} = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid thrust delta');
  if (thrust.done || dt === 0) return [];
  const activeFraction = Math.min(1, (thrust.duration-thrust.age)/dt);
  const oldReach = thrust.length * thrust.age / thrust.duration;
  thrust.age = Math.min(thrust.duration, thrust.age + dt);
  const reach = thrust.length * thrust.age / thrust.duration, hits = [];
  for (const target of new Set(targets)) {
    const previous = thrust.previous.get(target) ?? target;
    thrust.previous.set(target, {x:target.x, z:target.z});
    const radius = target.radius ?? .055;
    if (target.dead || thrust.hit.has(target) || ![target.x, target.z, radius].every(Number.isFinite) || radius < 0) continue;
    if (![previous.x, previous.z].every(Number.isFinite)) continue;
    const rx = previous.x-thrust.x, rz = previous.z-thrust.z;
    const vx = (target.x-previous.x)*activeFraction, vz = (target.z-previous.z)*activeFraction;
    const projection = rx*thrust.dx+rz*thrust.dz;
    const time = contactTime(projection, rx*thrust.dz-rz*thrust.dx,
      vx*thrust.dx+vz*thrust.dz, vx*thrust.dz-vz*thrust.dx,
      oldReach, reach-oldReach, thrust.radius+radius);
    if (!Number.isFinite(time) || !canHit(target)) continue;
    hits.push({target, time, projection});
  }
  hits.sort((a,b) => a.time-b.time || a.projection-b.projection);
  for (const {target} of hits) thrust.hit.add(target);
  thrust.done = thrust.age >= thrust.duration;
  return hits.map(h => h.target);
}
