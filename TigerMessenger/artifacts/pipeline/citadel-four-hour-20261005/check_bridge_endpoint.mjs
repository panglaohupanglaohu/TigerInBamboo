import fs from 'node:fs';
import path from 'node:path';
const input=process.argv[2]||new URL('./r26-wide-arches-target-front-plants-terrain.json',import.meta.url).pathname;
const data=JSON.parse(fs.readFileSync(input,'utf8')).cityDetail;
const origin=data.newCity.position,angle=data.newCity.yawDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
const world=([x,z])=>[origin[0]+c*x+s*z,origin[2]-s*x+c*z];
const area=p=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
const ccw=p=>area(p)<0?[...p].reverse():p;
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clip(poly,boundary){
 let out=ccw(poly);
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length],source=out;out=[];
  for(let j=0;j<source.length;j++){
   const p=source[j],q=source[(j+1)%source.length],dp=cross(a,b,p),dq=cross(a,b,q),ip=dp>=-1e-9,iq=dq>=-1e-9;
   if(ip)out.push(p);
   if(ip!==iq){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  if(out.length<3)return[];
 }
 return out;
}
function yAt(p,t){const xy=t.map(v=>[v[0],v[2]]),D=cross(xy[0],xy[1],xy[2]);return(cross(xy[1],xy[2],p)*t[0][1]+cross(xy[2],xy[0],p)*t[1][1]+cross(xy[0],xy[1],p)*t[2][1])/D;}
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
function triangles(w){const[a,b,c,d]=w.corners,A=midpoint(a,d),B=midpoint(b,c);return[[a,A,B],[a,B,b],[A,d,c],[A,c,B]];}
const houseFP=data.newCityStairs.authored.footprints.filter(f=>f.role==='stair-flank-house');
const obstacles=[...houseFP.map(f=>({...f,kind:'house-envelope'})),...data.newCity.geometry.footprints.map(f=>({...f,kind:f.walkable||f.support?'main-support':f.opening?'main-open-hall-envelope':'main-envelope'}))].map(f=>({...f,polygon:ccw(f.polygon.map(world)),floorY:f.floorY+origin[1],roofY:f.roofY+origin[1]}));
const walls=data.newCityStairs.authored.houses.map(h=>{
 const[x,y,z]=h.position,[w,height,d]=h.size;
 return{id:h.id,kind:'house-solid-wall-volume',polygon:ccw([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>world([x+a,z+b]))),floorY:y+origin[1],roofY:y+height+origin[1]};
});
function compare(surfaces,objects){
 const hits=[];
 for(const w of surfaces)for(const o of objects){
  let overlapArea=0,minY=Infinity,maxY=-Infinity;const intersections=[];
  for(const tri of triangles(w)){
   const p=clip(tri.map(v=>[v[0],v[2]]),o.polygon),a=Math.abs(area(p));if(a<1e-7)continue;
   overlapArea+=a;const ys=p.map(v=>yAt(v,tri));minY=Math.min(minY,...ys);maxY=Math.max(maxY,...ys);intersections.push(p);
  }
  if(overlapArea>1e-6)hits.push({deck:w.id,object:o.id,kind:o.kind,overlapArea,deckY:[minY,maxY],objectY:[o.floorY,o.roofY],bridgeSolidVerticalOverlap:o.floorY<maxY&&o.roofY>minY-.42,pedestrianVerticalOverlap:o.floorY<maxY+2.4&&o.roofY>minY+.05,openingRequiresNarrowPhase:o.kind==='main-open-hall-envelope',intersections});
 }
 return hits;
}
// Independent strip construction: no import of the bridge or stair factory.
function strip(points,width=4.4){
 const sections=points.map((p,i)=>{
  const ts=[];for(const j of[i-1,i])if(j>=0&&j<points.length-1){const a=points[j],b=points[j+1],l=Math.hypot(b[0]-a[0],b[2]-a[2]);ts.push([(b[0]-a[0])/l,(b[2]-a[2])/l]);}
  const ns=ts.map(t=>[-t[1],t[0]]),nx=ns.reduce((a,n)=>a+n[0],0),nz=ns.reduce((a,n)=>a+n[1],0),l=Math.hypot(nx,nz),n=[nx/l,nz/l],d=n[0]*ns[0][0]+n[1]*ns[0][1],half=width/2/d;
  return{left:[p[0]+n[0]*half,p[1],p[2]+n[1]*half],right:[p[0]-n[0]*half,p[1],p[2]-n[1]*half]};
 });
 return sections.slice(1).map((b,i)=>({id:`proposed-deck-${i}`,corners:[sections[i].right,b.right,b.left,sections[i].left]}));
}
const treads=data.newCityStairs.surveyed.selected.treads;
const endpointIndex=14,t=treads[endpointIndex],endpoint=[t.x,t.top,t.z];
const dock=[51,12,39],proposed=[...data.bridge.path.slice(0,3),dock],connector=[dock,endpoint];
const surfaces=[...strip(proposed),...strip(connector,2.4).map(w=>({...w,id:'short-side-connector'}))];
function stairSurface(t,i){const dx=Math.sin(t.yaw)*t.ds/2,dz=Math.cos(t.yaw)*t.ds/2,nx=Math.cos(t.yaw)*2.2,nz=-Math.sin(t.yaw)*2.2;return{id:`surveyed-tread-${i}`,corners:[[t.x-dx-nx,t.top,t.z-dz-nz],[t.x+dx-nx,t.top,t.z+dz-nz],[t.x+dx+nx,t.top,t.z+dz+nz],[t.x-dx+nx,t.top,t.z-dz+nz]]};}
const upperRoute=treads.slice(0,endpointIndex+1).map(stairSurface);
const allStairs=treads.map((t,i)=>({id:`surveyed-tread-${i}`,kind:'stair-walk-envelope',polygon:ccw(stairSurface(t,i).corners.map(p=>[p[0],p[2]])),floorY:t.top,roofY:t.top+2.4}));
function pd(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
function separation(a,b){if(clip(a,ccw(b)).length)return 0;return Math.min(...a.flatMap(p=>b.map((q,i)=>pd(p,q,b[(i+1)%b.length]))),...b.flatMap(p=>a.map((q,i)=>pd(p,q,a[(i+1)%a.length]))));}
const stairHits=compare(surfaces,allStairs);
const result={source:path.basename(input),method:'independent convex polygon clipping per actual deck triangle plus vertical intervals; no runtime factory imports',
 actual:{archCount:data.bridge.spans.length,footprintIntersections:compare(data.bridge.walkSurfaces,obstacles),solidWallIntersections:compare(data.bridge.walkSurfaces,walls)},
 proposal:{path:proposed,width:4.4,connector,connectorWidth:2.4,connectorLength:Math.hypot(t.x-dock[0],t.z-dock[2]),connectorSlope:Math.abs(t.top-dock[1])/Math.hypot(t.x-dock[0],t.z-dock[2]),endpointTreadIndex:endpointIndex,footprintIntersections:compare(surfaces,obstacles),solidWallIntersections:compare(surfaces,walls),upperRouteWallIntersections:compare(upperRoute,walls),bridgeToMainApproachHorizontalDistance:t.distance,maximumBridgeSlope:Math.max(...proposed.slice(1).map((b,i)=>Math.abs(b[1]-proposed[i][1])/Math.hypot(b[0]-proposed[i][0],b[2]-proposed[i][2]))),minimumHouseEnvelopeClearance:Math.min(...surfaces.flatMap(w=>obstacles.filter(o=>o.kind==='house-envelope').map(o=>separation(w.corners.map(p=>[p[0],p[2]]),o.polygon)))),stairJoinIntersections:stairHits,lowerStairOverheadConflicts:stairHits.filter(h=>h.deckY[1]>h.objectY[0]+.3&&h.deckY[0]-.42<h.objectY[1])},
 transformedHouses:obstacles.filter(o=>o.kind==='house-envelope').map(o=>({id:o.id,polygon:o.polygon,height:[o.floorY,o.roofY]})),
 limits:['House envelope footprints include eaves; solid wall tests separately use actual authored body sizes.','Main hall footprint contains a known real entrance; envelope intersection alone cannot prove a hall wall collision.','New route has no fresh terrain/pier/ocean/ship/GPU sampling in this read-only review.','Polygon clearance excludes facade ornaments and railing thickness. Stair join tolerates <0.3 m elevation difference only as a candidate landing to be meshed continuously, not an already seamless surface.']};
if(result.actual.solidWallIntersections.length!==1)throw Error('Expected one actual house wall collision; inspect changed input.');
if(result.proposal.footprintIntersections.length||result.proposal.solidWallIntersections.length||result.proposal.lowerStairOverheadConflicts.length)throw Error('Proposed full-width envelope check failed.');
console.log(JSON.stringify(result,null,2));
