/** Local anchored-center experiment: ring follows camera, center follows instance axis.
 * Constants/shape are local choices, not a recovered shader from 1191990107785572352. */
export const anchoredBillboardGLSL = /* glsl */ `
vec3 anchoredCard(vec3 origin, vec3 fwd, vec3 right, vec3 axis, vec2 pt,
                  float scale, float center, float anchorMix, float sway) {
  vec3 ring = origin + right * (pt.x * TW * scale + sway)
             + vec3(0.0, pt.y * TH * scale, 0.0)
             + fwd * (0.02 + 0.05 * center) * scale;
  vec3 fixedCenter = origin + axis * 0.07 * scale + vec3(0.0, pt.y * TH * scale, 0.0);
  return mix(ring, fixedCenter, center * anchorMix);
}`;
export function billboardPoint({origin,camera,axis=[0,0,1],point=[0,.45],center=1,anchorMix=1,scale=1,width=.14,height=.165,sway=0}) {
  if(![...origin,...camera,...axis,...point,center,anchorMix,scale,width,height,sway].every(Number.isFinite)||origin.length!==3||camera.length!==3||axis.length!==3||point.length!==2||anchorMix<0||anchorMix>1||center<0||center>1||scale<0)throw new RangeError('Invalid billboard sample');
  const dx=camera[0]-origin[0],dz=camera[2]-origin[2],n=Math.hypot(dx,dz),fwd=n>1e-4?[dx/n,0,dz/n]:[0,0,1],right=[fwd[2],0,-fwd[0]],an=Math.hypot(...axis),a=an>1e-4?axis.map(v=>v/an):[0,0,1],t=center*anchorMix;
  return origin.map((v,i)=>{
    const ring=v+right[i]*(point[0]*width*scale+sway)+(i===1?point[1]*height*scale:0)+fwd[i]*(.02+.05*center)*scale;
    const fixed=v+a[i]*.07*scale+(i===1?point[1]*height*scale:0);
    return ring+(fixed-ring)*t;
  });
}
