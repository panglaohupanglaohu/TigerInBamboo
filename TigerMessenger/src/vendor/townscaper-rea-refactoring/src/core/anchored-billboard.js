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

/** REACode shrubcard.js (1191990107785572352 "Adding an anchored center vert to the billboards makes
 * them a bit less flat and gives them directionality without messing with the rotation").
 * A camera-facing card whose centre vertex is pushed toward the camera by `depth`: 5 vertices,
 * 4 triangles. Local frame: x = card right, y = up, z = toward camera.
 */
export function foldedCard({width=1,height=1,depth=.28}={}){
 if(![width,height,depth].every(Number.isFinite)||width<=0||height<=0||depth<0)throw new RangeError('Invalid folded card');
 const w=width/2,h=height/2;
 const positions=[-w,-h,0, w,-h,0, w,h,0, -w,h,0, 0,0,depth];
 const index=[0,1,4, 1,2,4, 2,3,4, 3,0,4];
 const uv=[0,0,1,0,1,1,0,1,.5,.5];
 return{positions,index,uv,triangles:4,vertices:5};
}
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit3=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
/** Left/right half normals (both facing the camera side, +z). */
export function foldedHalfNormals({width=1,height=1,depth=.28}={}){
 const w=width/2,h=height/2,A=[0,0,depth];
 const left=unit3(cross3(sub3([-w,-h,0],A),sub3([-w,h,0],A))),right=unit3(cross3(sub3([w,h,0],A),sub3([w,-h,0],A)));
 return{left:left[2]<0?left.map(v=>-v):left,right:right[2]<0?right.map(v=>-v):right};
}
export function foldAngle(opts){const{left,right}=foldedHalfNormals(opts);return Math.acos(Math.max(-1,Math.min(1,left[0]*right[0]+left[1]*right[1]+left[2]*right[2])))*180/Math.PI;}
/** Projected width seen from a camera rotated by `yaw` around the card (0 = face-on, 90° = edge-on). */
export function foldedSideWidth(yaw,{width=1,depth=.28}={}){
 if(!Number.isFinite(yaw))throw new RangeError('Invalid yaw');
 const c=Math.cos(yaw),s=Math.sin(yaw),xs=[-width/2*c,width/2*c,depth*s];return Math.max(...xs)-Math.min(...xs);
}
/** Lambert contrast between the two halves under one light: the "directionality". */
export function foldedContrast(light=[.45,.35,.82],opts){const{left,right}=foldedHalfNormals(opts),L=unit3(light),sh=n=>.55+.45*Math.max(0,n[0]*L[0]+n[1]*L[1]+n[2]*L[2]);return Math.abs(sh(left)-sh(right));}
