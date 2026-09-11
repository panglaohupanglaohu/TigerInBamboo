import assert from 'node:assert/strict';
import {buildContinuousStairSpec} from '../../src/world/citadel/continuousStairs.js';
const s=buildContinuousStairSpec();
assert.equal(s.floorRoutes.length,5);
let tested=0;
for(const [i,f] of s.floorRoutes.entries()) {
 if(i) assert(f.points[0].every((v,k)=>Math.abs(v-s.floorRoutes[i-1].points.at(-1)[k])<1e-9));
 for(let j=1;j<f.points.length;j++) {
  const a=f.points[j-1],b=f.points[j];
  assert(b[1]>a[1] && b[1]-a[1]<=.14+1e-9);
  assert(Math.hypot(b[0]-a[0],b[2]-a[2])<.34);
 }
 // Ray from immediately above every route point: an upward top triangle must support it.
 for(const p of f.points) {
  let hit=false;
  for(let k=0;k<s.positions.length;k+=9){
   const v=s.positions.slice(k,k+9);
   if(Math.abs(v[1]-p[1])>1e-7||Math.abs(v[4]-p[1])>1e-7||Math.abs(v[7]-p[1])>1e-7)continue;
   const ny=(v[5]-v[2])*(v[6]-v[0])-(v[3]-v[0])*(v[8]-v[2]);
   if(ny<=0)continue;
   const cross=(a,b,c,d)=>a*d-b*c;
   const den=cross(v[3]-v[0],v[5]-v[2],v[6]-v[0],v[8]-v[2]);
   const u=cross(p[0]-v[0],p[2]-v[2],v[6]-v[0],v[8]-v[2])/den;
   const w=cross(v[3]-v[0],v[5]-v[2],p[0]-v[0],p[2]-v[2])/den;
   if(u>=-1e-8&&w>=-1e-8&&u+w<=1+1e-8){hit=true;break;}
  }
  assert(hit,`Missing front-facing support at ${p}`);tested++;
 }
}
console.log(JSON.stringify({passed:true,treads:s.treadCount,supportedPoints:tested,floors:5,scope:'tread geometry only; not complete tower traversal'}));
