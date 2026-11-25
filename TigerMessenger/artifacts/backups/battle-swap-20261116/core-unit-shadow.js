/** 820977247083528192 shows a soft foot disc during an animation cycle.
 * Height fade/footprint clipping below are local engineering choices, not
 * parameters recoverable from that clip. Horizontal convex footprints only.
 */
export function unitShadow({x,z,footY,groundY,footprint,radius=.12,maxHeight=.8,alpha=.3}={}){
 if(![x,z,footY,groundY,radius,maxHeight,alpha].every(Number.isFinite)||radius<=0||maxHeight<=0||alpha<0||alpha>1||!Array.isArray(footprint)||footprint.length<3)throw new RangeError('Invalid unit shadow');
 let area=0;for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length];if(![a.x,a.z].every(Number.isFinite))throw new RangeError('Invalid footprint');area+=a.x*b.z-b.x*a.z;}
 if(!area)throw new RangeError('Degenerate footprint');const sign=Math.sign(area);
 for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length],c=footprint[(i+2)%footprint.length];if(sign*((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<-1e-10)throw new RangeError('Nonconvex footprint');}
 const height=footY-groundY,fade=Math.max(0,1-Math.max(0,height)/maxHeight),r=radius*(1+.35*Math.max(0,height)/maxHeight);
 const result={position:[],local:[],alpha:alpha*fade,height,radius:r,triangles:0};if(height<-.03||!fade)return result;
 let poly=Array.from({length:16},(_,i)=>[x+Math.cos(-i*Math.PI/8)*r,z+Math.sin(-i*Math.PI/8)*r]);
 for(let e=0;e<footprint.length;e++){
  const a=footprint[e],b=footprint[(e+1)%footprint.length],side=p=>sign*((b.x-a.x)*(p[1]-a.z)-(b.z-a.z)*(p[0]-a.x)),out=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q),inside=dp>=0,nextInside=dq>=0;if(inside)out.push(p);if(inside!==nextInside){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}poly=out;
 }
 for(let i=1;i+1<poly.length;i++)for(const p of [poly[0],poly[i],poly[i+1]]){result.position.push(p[0],groundY+.008,p[1]);result.local.push((p[0]-x)/r,(p[1]-z)/r);}
 result.triangles=result.position.length/9;return result;
}
