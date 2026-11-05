/** Generation-time incoming displacement and reflected outgoing displacement.
 * Local geometric reflection, not a fluid simulation or a reconstruction of source code.
 */
export function bakeWaveMotion(shore, sea, normal) {
  const dx=sea.x-shore.x,dz=sea.z-shore.z;
  if (![dx,dz,normal.nx,normal.nz].every(Number.isFinite)) throw new RangeError('wave motion');
  const length=Math.hypot(dx,dz),nl=Math.hypot(normal.nx,normal.nz);
  let nx=nl>1e-9?normal.nx/nl:(length>1e-9?dx/length:1);
  let nz=nl>1e-9?normal.nz/nl:(length>1e-9?dz/length:0);
  // A smoothed endpoint can cross behind a concave corner. Fall back to the
  // water-side displacement rather than bake a landward return direction.
  if(dx*nx+dz*nz<=0&&length>1e-9){nx=dx/length;nz=dz/length;}
  const dot=dx*nx+dz*nz;
  return {incoming:[dx,dz],outgoing:[-dx+2*dot*nx,-dz+2*dot*nz]};
}

// Same cycle function is injected in the production vertex shader. Inbound
// and outbound meet at the shore with equal opacity; both wrap endpoints fade.
export const waveCycleGLSL = `
vec3 shoreCycle(float t) {
  const float hit = 0.68;
  if (t < hit) {
    float u=t/hit;
    float f=1.0-u*u*(3.0-2.0*u);
    float a=smoothstep(0.05,0.55,u)*(0.12+0.78*u*u);
    return vec3(f,0.0,a);
  }
  float u=(t-hit)/(1.0-hit);
  return vec3(0.0,0.22*sin(u*1.57079632679),0.90*(1.0-u)*(1.0-u));
}`;

/** Periodic crest coverage and width along a closed shoreline.
 * Integer harmonics keep the seam continuous. Authored breakup, not source physics.
 */
export function waveCrest(s, seed = 0) {
  if (![s,seed].every(Number.isFinite)) throw new RangeError('wave crest');
  const n=.65*Math.sin(7*s+seed)+.35*Math.sin(13*s+seed*1.7);
  const t=Math.max(0,Math.min(1,(n+.15)/.55));
  return {coverage:t*t*(3-2*t),width:.65+.35*(.5+.5*Math.sin(5*s+seed*.8))};
}
