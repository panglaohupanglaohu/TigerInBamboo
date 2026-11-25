/** 1015142746372366336: "z-depth and draw order ... 2 passes".
 * Two passes retain their own far-to-near instance order. Intersecting sprites
 * still approximate volumetric transparency; this is not order-independent blending.
 */
export function smokeDepthOrder(particles,viewMatrix){
 if(!viewMatrix||viewMatrix.length!==16||![...viewMatrix].every(Number.isFinite))throw new TypeError('Invalid camera matrix');
 const depth=p=>viewMatrix[2]*p.x+viewMatrix[6]*p.y+viewMatrix[10]*p.z+viewMatrix[14];
 return [...particles].sort((a,b)=>depth(a)-depth(b)||(a.serial??0)-(b.serial??0));
}

/** REACode smokefx.js makeFlame, 1056990611738451968 / 1015149712469524480 / 1015142746372366336:
 * each flame card samples one tiling noise value (UV rolled forward/backward along the flow), a
 * capsule mask narrows toward the tip, and the cutoff is pulled in so a brighter rim remains.
 * The GLSL and JS twins share constants; the exact original texture/curves are unknown.
 */
export const FIRE_CARD={edge:.5,cut:.055,pull:.07};
const F=FIRE_CARD,f4=v=>v.toFixed(4);
export const fireCardGLSL=`
vec2 fireCard(vec2 pc,float age,float n){
  vec2 c=pc-.5;c.x*=mix(1.,1.55,age);float r=length(c);
  float outer=1.-smoothstep(${f4(F.edge-F.cut)},${f4(F.edge)},r);
  float innerMask=1.-smoothstep(${f4(F.edge-F.cut-F.pull)},${f4(F.edge-F.pull)},r);
  float rim=clamp(outer-innerMask,0.,1.);
  float body=smoothstep(${f4(.02+F.cut*1.6)},${f4(.10+F.cut*1.6)},innerMask*mix(.35,n,.8));
  return vec2(max(body,rim),rim);
}`;
export function fireCard(px,py,age,n){
 if(![px,py,age,n].every(Number.isFinite))throw new RangeError('Invalid fire card sample');
 const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const cx=(px-.5)*(1+.55*age),cy=py-.5,r=Math.hypot(cx,cy);
 const outer=1-sm(F.edge-F.cut,F.edge,r),innerMask=1-sm(F.edge-F.cut-F.pull,F.edge-F.pull,r),rim=Math.max(0,Math.min(1,outer-innerMask));
 const body=sm(.02+F.cut*1.6,.10+F.cut*1.6,innerMask*(.35+(n-.35)*.8));
 return{alpha:Math.max(body,rim),rim};
}
/** Firelight follows the live flame mass (sum of card areas) with a bounded flicker. */
export function fireLightLevel(sizes,ages,time,{gain=.5,max=2.5}={}){
 if(sizes.length!==ages.length||!Number.isFinite(time))throw new RangeError('Invalid fire light sample');
 let mass=0;for(let i=0;i<sizes.length;i++)if(ages[i]<1&&sizes[i]>0)mass+=sizes[i]*sizes[i];
 const flicker=.85+.1*Math.sin(time*17.3)+.05*Math.sin(time*31.7+1.3);
 return Math.min(max,mass*gain)*flicker;
}
