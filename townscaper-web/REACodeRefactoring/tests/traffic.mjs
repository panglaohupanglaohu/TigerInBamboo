import assert from 'node:assert/strict';
import {leftLaneTarget,narrowCells,passageMarkers,localSeparation} from '../src/world/traffic.js';
const cell=(id,cx,cz,neighbors)=>({id,cx,cz,n:4,edgeNeighbors:neighbors,pts:[{x:cx-.5,z:cz-.5},{x:cx+.5,z:cz-.5},{x:cx+.5,z:cz+.5},{x:cx-.5,z:cz+.5}]});
const cells=Array.from({length:42},(_,id)=>cell(id,id,0,[id>0?id-1:-1,id<41?id+1:-1,-1,-1]));
const world={cells},nav={walk:new Uint8Array(42).fill(1),hgt:new Int8Array(42).fill(1),cost:()=>1,stairs:[]};
const markers=passageMarkers(world,nav,{spacing:.16});
assert.equal(markers.segments.length,41);assert.ok(markers.points.length>200);assert.equal(new Set(markers.points.map(p=>p.x.toFixed(8))).size,markers.points.length);
assert.ok(markers.points.every(p=>p.y===.535));assert.throws(()=>passageMarkers(world,nav,{spacing:0}));
const wide={cells:[cell(0,0,0,[1,2,-1,-1]),cell(1,1,0,[0,3,-1,-1]),cell(2,0,1,[0,3,-1,-1]),cell(3,1,1,[1,2,-1,-1])]};
assert.equal([...narrowCells(wide,{...nav,walk:new Uint8Array(4).fill(1)})].reduce((a,b)=>a+b,0),0,'platform corners are not false bottlenecks');
const stats=[];
for(const dt of [1/30,1/60,1/120]){
 const agents=[];for(let k=0;k<32;k++)for(const dir of [1,-1])agents.push({x:dir===1?.2+k*.18:40.8-k*.18,z:0,dir,done:false});
 let steps=0,opposingMin=Infinity;
 while(agents.some(a=>!a.done)&&steps<Math.ceil(90/dt)){
  const snap=agents.filter(a=>!a.done).map(a=>({...a}));
  for(const a of agents){if(a.done)continue;const goal=a.dir===1?41:0,here=Math.max(0,Math.min(41,Math.round(a.x)));let next=Math.max(0,Math.min(41,here+a.dir));let target=leftLaneTarget(cells[here],cells[next]);if(Math.abs(goal-a.x)<.45)target={x:goal,z:a.dir===1?-.08:.08};
   const dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz),s=d?Math.min(d,.9*dt)/d:0;const separation=localSeparation(a,snap,dt);
   a.x+=dx*s+separation.x;a.z+=dz*s+separation.z;
   assert.ok(Math.abs(a.z)<.5,'agents stay inside corridor');if(Math.abs(a.x-goal)<.025)a.done=true;
  }
  for(const a of agents)for(const b of agents)if(a.dir!==b.dir&&!a.done&&!b.done)opposingMin=Math.min(opposingMin,Math.hypot(a.x-b.x,a.z-b.z));steps++;
 }
 assert.ok(agents.every(a=>a.done),'all 64 agents finish: dt='+dt);
 assert.ok(opposingMin>.07,'opposing agents separate during passing');stats.push({dt,agents:agents.length,seconds:Number((steps*dt).toFixed(2)),opposingMin:Number(opposingMin.toFixed(4))});
}
console.log(JSON.stringify({markerDots:markers.points.length,stress:stats},null,2));
// The lane limiter must keep targets in skew triangles and quads, even if asked
// for a wider offset than the cell itself.
const {buildMixedGrid}=await import('../src/core/grid.js');
const {pointInQuad}=await import('../src/core/spatial.js');
const grid=buildMixedGrid({radius:4,mergeRate:.55,seed:19});
for(const c of grid.cells)for(const id of c.edgeNeighbors){if(id<0)continue;const target=leftLaneTarget(c,grid.cells[id],{width:10});assert.ok(pointInQuad(grid.cells[id].pts,target.x,target.z));}
console.log('PASS lane targets remain inside mixed polygons');
