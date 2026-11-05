/** 1786014232594485497: mountains need lighting/normals but blending is costly.
 * A local vertex-normal bake hypothesis, NOT an inferred original texture bake.
 * No image/height-map sampling or device performance claim.
 */
export const MOUNTAIN_LIGHT=Object.freeze([-.62,.62,-.48]);
export function bakeNormalLight(normals,{light=MOUNTAIN_LIGHT,base=.66,strength=.42}={}) {
  if(!normals||!Number.isInteger(normals.length)||normals.length%3||!Array.from(normals).every(Number.isFinite)||!Array.isArray(light)||light.length!==3||!light.every(Number.isFinite)||!Number.isFinite(base)||!Number.isFinite(strength)||base<0||base>1||strength<0||strength>1)throw new RangeError('normal bake inputs');
  const length=Math.hypot(...light);if(length===0)throw new RangeError('nonzero bake light required');
  const L=light.map(x=>x/length),tone=new Float32Array(normals.length/3);
  for(let i=0;i<tone.length;i++) {
    const x=normals[i*3],y=normals[i*3+1],z=normals[i*3+2],n=Math.hypot(x,y,z);
    tone[i]=base+strength*(n?Math.max(0,(x*L[0]+y*L[1]+z*L[2])/n):0);
  }
  return tone;
}
