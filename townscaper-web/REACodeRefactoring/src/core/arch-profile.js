/** Elliptical inner profile, adapted from REACode/archvoid archInner/clearance.
 * Preserve the existing building curve; choose angular samples by world-space
 * chord-error bound instead of ten equal horizontal intervals. No wedge ring.
 */
export function archProfile(span,rise,{tolerance=.0025,maxSegments=128}={}){
 if(![span,rise,tolerance].every(Number.isFinite)||span<=0||rise<=0||tolerance<=0||!Number.isInteger(maxSegments)||maxSegments<8||maxSegments>4096)throw new RangeError('invalid arch dimensions or sampling budget');
 const radius=Math.max(span/2,rise),angle=2*Math.acos(Math.max(-1,1-Math.min(tolerance/radius,2)));
 let segments=Math.max(8,Math.ceil(Math.PI/angle));if(segments%2)segments++;
 if(!Number.isFinite(segments)||segments>maxSegments)throw new RangeError('arch tolerance exceeds sampling budget');
 const points=Array.from({length:segments+1},(_,i)=>{const t=i*Math.PI/segments;return{u:i===0?0:i===segments?1:(1-Math.cos(t))/2,height:i===0||i===segments?0:rise*Math.sin(t)};});
 return{points,segments,errorBound:radius*(1-Math.cos(Math.PI/(2*segments)))};
}
export function archClearance(span,rise,x){
 if(![span,rise,x].every(Number.isFinite)||span<=0||rise<=0)throw new RangeError('invalid arch clearance input');
 return Math.abs(x)>span/2?0:rise*Math.sqrt(Math.max(0,1-(2*x/span)**2));
}

/** 806904557502464000 / 802496920790777856 (video only): a ring of wedges laid at
 * equal ellipse parameter angles, joints along the inner-ellipse normal, keystone
 * at the crown when count is odd. Adapted from REACode/archvoid makeArch/measure.
 * u is the 0..1 span coordinate used by buildings.js; y is relative to springing.
 * Note: REACode archOuter used +cos(t)/a for the normal x while archInner uses
 * -cos(t)*a, pushing the feet inward; the outward normal is fixed here.
 */
export function archVoussoirs(span,rise,{thickness=.05,count=9}={}){
 if(![span,rise,thickness].every(Number.isFinite)||span<=0||rise<=0||thickness<=0||!Number.isInteger(count)||count<3||count>63)throw new RangeError('invalid voussoir ring');
 const a=span/2,inner=t=>[-Math.cos(t)*a,Math.sin(t)*rise],outer=t=>{const p=inner(t),nx=-Math.cos(t)/a,ny=Math.sin(t)/rise,l=Math.hypot(nx,ny)||1;return[p[0]+thickness*nx/l,p[1]+thickness*ny/l];};
 const toU=p=>({u:(p[0]+a)/span,x:p[0],y:p[1]}),wedges=[];
 for(let i=0;i<count;i++){const t0=i*Math.PI/count,t1=(i+1)*Math.PI/count,quad=[inner(t0),outer(t0),outer(t1),inner(t1)];
  let area=0;for(let k=0;k<4;k++){const p=quad[k],q=quad[(k+1)%4];area+=p[0]*q[1]-q[0]*p[1];}
  wedges.push({index:i,t0,t1,quad:quad.map(toU),area:Math.abs(area)/2,radial:Math.hypot(quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]),outerArc:Math.hypot(quad[2][0]-quad[1][0],quad[2][1]-quad[1][1])});}
 const keystone=count%2?wedges[(count-1)/2]:null;
 return{span,rise,thickness,count,wedges,keystone,crownInner:rise,crownOuter:rise+thickness};
}
/** archvoid.measure: shared joints (gap 0), no wedge overlap, aspect spread, clearance. */
export function measureArch(ring){
 const{wedges,span,rise}=ring;let jointGapMax=0,overlapPairs=0;
 for(let i=0;i+1<wedges.length;i++){const a=wedges[i].quad,b=wedges[i+1].quad;jointGapMax=Math.max(jointGapMax,Math.hypot(a[2].x-b[1].x,a[2].y-b[1].y),Math.hypot(a[3].x-b[0].x,a[3].y-b[0].y));}
 const inside=(p,q)=>{let s=0;for(let k=0;k<4;k++){const a=q[k],b=q[(k+1)%4],c=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(c)<1e-12)continue;if(!s)s=Math.sign(c);else if(Math.sign(c)!==s)return false;}return true;};
 for(const a of wedges){const c={x:a.quad.reduce((s,p)=>s+p.x,0)/4,y:a.quad.reduce((s,p)=>s+p.y,0)/4};for(const b of wedges)if(a!==b&&inside(c,b.quad))overlapPairs++;}
 const aspects=wedges.map(w=>w.outerArc/w.radial);
 return{count:ring.count,jointAngleDeg:180/ring.count,jointGapMax,overlapPairs,aspectMin:Math.min(...aspects),aspectMax:Math.max(...aspects),aspectSpread:Math.max(...aspects)/Math.min(...aspects),clearCenter:archClearance(span,rise,0),clearQuarter:archClearance(span,rise,span/4),keystone:ring.keystone?.index??null};
}
/** World-space chord error after the bilinear cage map: dense samples of the
 * true curve versus the drawn polyline, both pushed through the same map(u,y).
 */
export function deformedArchError(profile,rise,map,{samples=24}={}){
 if(typeof map!=='function'||!Number.isInteger(samples)||samples<2)throw new RangeError('invalid deformed error query');
 let max=0;const pts=profile.points;
 for(let s=0;s+1<pts.length;s++){const p0=pts[s],p1=pts[s+1],t0=Math.acos(Math.max(-1,Math.min(1,1-2*p0.u))),t1=Math.acos(Math.max(-1,Math.min(1,1-2*p1.u)));
  for(let k=1;k<samples;k++){const f=k/samples,t=t0+(t1-t0)*f,u=(1-Math.cos(t))/2,y=rise*Math.sin(t);
   // distance from the true sample to the drawn chord, both mapped by the same cage function
   const A=map(p0.u,p0.height),B=map(p1.u,p1.height),P=map(u,y),dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2],L2=dx*dx+dy*dy+dz*dz||1,tt=Math.max(0,Math.min(1,((P[0]-A[0])*dx+(P[1]-A[1])*dy+(P[2]-A[2])*dz)/L2));
   max=Math.max(max,Math.hypot(P[0]-A[0]-dx*tt,P[1]-A[1]-dy*tt,P[2]-A[2]-dz*tt));}}
 return max;
}
