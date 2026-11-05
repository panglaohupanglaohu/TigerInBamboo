/** Subdivide the actual waterline, without rounding it into the land.
 * Normals must already be in the deformed water-plane coordinates.
 */
export function sampleShoreline(vertices, spacing = 0.18) {
  if (!(spacing > 0) || !Number.isFinite(spacing)) throw new RangeError('shore spacing');
  const result = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (!Number.isFinite(length)) throw new RangeError('shore coordinates');
    if (length < 1e-9) continue;
    const count = Math.ceil(length / spacing);
    if (count + result.length > 200000) throw new RangeError('shore sample budget');
    for (let j = 0; j < count; j++) {
      const t = j / count;
      let nx = a.nx * (1-t) + b.nx*t, nz = a.nz*(1-t) + b.nz*t;
      const n = Math.hypot(nx,nz);
      if (n > 1e-9) { nx /= n; nz /= n; }
      else { nx = a.nx; nz = a.nz; }
      result.push({x:a.x*(1-t)+b.x*t,z:a.z*(1-t)+b.z*t,nx,nz});
    }
  }
  return result;
}

/** Return a bounded first threshold crossing, never step beyond max.
 * A failed crossing returns max; this is not a proof of a nonfolding ribbon.
 */
export function marchShore(sample, x, z, nx, nz, target, max, step) {
  if (![x,z,nx,nz,target,max,step].every(Number.isFinite) || max < 0 || step <= 0) throw new RangeError('shore march');
  if (sample(x,z) >= target) return 0;
  for (let lo = 0; lo < max;) {
    const hi = Math.min(max,lo+step);
    if (sample(x+nx*hi,z+nz*hi) >= target) {
      let a=lo,b=hi;
      for(let k=0;k<10;k++){const m=(a+b)/2;if(sample(x+nx*m,z+nz*m)<target)a=m;else b=m;}
      return (a+b)/2;
    }
    lo=hi;
  }
  return max;
}
