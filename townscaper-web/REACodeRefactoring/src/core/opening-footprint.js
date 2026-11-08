/** 1205416648397721601: props without overlap, rectangular doors/windows on skewed cells.
 * Reserve the entire drawn sill, not only the glass/frame. Local dimensions, not original parameters.
 */
export const OPENING_FRAME = .022;
export const WINDOW_SILL_SCALE = 1.6;
export function openingFootprint(a,b,t,width,{door=false,corner=.035}={}) {
  if(!a||!b||![a.x,a.z,b.x,b.z,t,width,corner].every(Number.isFinite)||width<=0||corner<0||t<0||t>1)throw new RangeError('invalid opening footprint');
  const length=Math.hypot(b.x-a.x,b.z-a.z),halfWidth=width/2+OPENING_FRAME*(door?1:WINDOW_SILL_SCALE);
  if(!length||t*length-halfWidth<corner||(1-t)*length-halfWidth<corner)return null;
  return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,halfWidth,length};
}
