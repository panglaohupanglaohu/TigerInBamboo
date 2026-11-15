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
/** REACode/propframe build/measure in World units: greedy "as many props as it can
 * without overlap" inside a convex cell polygon. frame='std' keeps each prop a rigid
 * rectangle aligned with the cell's first edge (rotation only); frame='local' uses
 * the sheared bilinear u/v basis (the awkward contrast from the caption).
 */
const propHash=(s,i,k)=>{let h=Math.imul(s|0,374761393)^Math.imul(i|0,668265263)^Math.imul(k|0,2246822519);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
export function propOverlap(A,B){
  for(const box of[A,B])for(let n=0;n<box.length;n++){const p=box[n],q=box[(n+1)%box.length],L=Math.hypot(q.x-p.x,q.z-p.z)||1,nx=-(q.z-p.z)/L,nz=(q.x-p.x)/L;
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const t of A){const d=t.x*nx+t.z*nz;a0=Math.min(a0,d);a1=Math.max(a1,d);}for(const t of B){const d=t.x*nx+t.z*nz;b0=Math.min(b0,d);b1=Math.max(b1,d);}
    if(a1<b0-1e-12||b1<a0-1e-12)return false;}
  return true;
}
const segD=(p,a,b)=>{const ex=b.x-a.x,ez=b.z-a.z,L2=ex*ex+ez*ez||1,t=Math.max(0,Math.min(1,((p.x-a.x)*ex+(p.z-a.z)*ez)/L2));return Math.hypot(p.x-a.x-ex*t,p.z-a.z-ez*t);};
const insideConvex=(p,poly)=>{let s=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);if(Math.abs(c)<1e-14)continue;if(!s)s=Math.sign(c);else if(Math.sign(c)!==s)return false;}return true;};
export function frameDeviationDeg(q){let worst=0;for(let n=0;n<4;n++){const a=q[n],b=q[(n+1)%4],d=q[(n+3)%4],v1=[b.x-a.x,b.z-a.z],v2=[d.x-a.x,d.z-a.z],c=(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)||1);worst=Math.max(worst,Math.abs(90-Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI));}return worst;}
export function placeProps(poly,{seed=1,tries=300,pad=.02,size=[.03,.07],frame='std',obstacles=[]}={}){
  if(!Array.isArray(poly)||poly.length<3||!Number.isInteger(tries)||tries<1||!(pad>=0)||!['std','local'].includes(frame))throw new RangeError('invalid prop placement');
  const n=poly.length,cx=poly.reduce((s,p)=>s+p.x,0)/n,cz=poly.reduce((s,p)=>s+p.z,0)/n;
  const e=[poly[1].x-poly[0].x,poly[1].z-poly[0].z],el=Math.hypot(...e)||1,ux=[e[0]/el,e[1]/el],uz=[-ux[1],ux[0]];
  // local sheared basis: the cell's first and last edge directions (bilinear u/v at corner 0)
  const lu=[poly[1].x-poly[0].x,poly[1].z-poly[0].z],lv=[poly[n-1].x-poly[0].x,poly[n-1].z-poly[0].z],lul=Math.hypot(...lu)||1,lvl=Math.hypot(...lv)||1;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of poly){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
  const props=[],placedObstacles=obstacles.map(o=>o.poly);let rejectedEdge=0,rejectedOverlap=0;
  for(let t=0;t<tries;t++){
    const x=minX+(maxX-minX)*propHash(seed,t,1),z=minZ+(maxZ-minZ)*propHash(seed,t,2),hu=size[0]+(size[1]-size[0])*propHash(seed,t,3),hv=size[0]+(size[1]-size[0])*propHash(seed,t,4);
    const c={x,z},rect=frame==='std'?[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:x+ux[0]*a*hu+uz[0]*b*hv,z:z+ux[1]*a*hu+uz[1]*b*hv})):[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:x+lu[0]/lul*a*hu+lv[0]/lvl*b*hv,z:z+lu[1]/lul*a*hu+lv[1]/lvl*b*hv}));
    if(!rect.every(p=>insideConvex(p,poly))||Math.min(...rect.map(p=>Math.min(...poly.map((a,i)=>segD(p,a,poly[(i+1)%n])))))<pad||!insideConvex(c,poly)){rejectedEdge++;continue;}
    if(props.some(p=>propOverlap(p.poly,rect))||placedObstacles.some(o=>propOverlap(o,rect))){rejectedOverlap++;continue;}
    props.push({poly:rect,x,z,hu,hv,frame});
  }
  let area=0;for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n];area+=a.x*b.z-b.x*a.z;}area=Math.abs(area)/2;
  const propArea=props.reduce((s,p)=>{let a=0;for(let i=0;i<4;i++){const P=p.poly[i],Q=p.poly[(i+1)%4];a+=P.x*Q.z-Q.x*P.z;}return s+Math.abs(a)/2;},0);
  return{props,coverage:propArea/area,rejectedEdge,rejectedOverlap,centre:{x:cx,z:cz},frameDevMax:Math.max(0,...props.map(p=>frameDeviationDeg(p.poly)))};
}
