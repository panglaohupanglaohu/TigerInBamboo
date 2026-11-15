// REACode/islandpasses.js traceRings/interpContour (1669315384619540487) on the shared World polygon grid:
// level contours are chains of real cell edges forming closed rings; a midpoint (marching-squares)
// contour through the same edges cuts every corner and is strictly shorter.
import assert from'node:assert/strict';
import{World}from'../src/core/world.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
import{generateTerrain}from'../src/terrain/generate.js';import{terraceEdges,traceTerraceRings}from'../src/core/terrace-edges.js';
function block(nx,nz){return Array.from({length:nx*nz},(_,id)=>{const x=id%nx,z=(id/nx)|0;return{id,n:4,cx:x,cz:z,pts:[{x:x-.5,z:z-.5},{x:x+.5,z:z-.5},{x:x+.5,z:z+.5},{x:x-.5,z:z+.5}],edgeNeighbors:[z?id-nx:-1,x+1<nx?id+1:-1,z+1<nz?id+nx:-1,x?id-1:-1]}})}
{const w=new World({cells:block(5,5)});for(const c of w.cells){const x=c.id%5,z=(c.id/5)|0;if(x&&z&&x<4&&z<4)w.fill(c,x===2&&z===2?3:1,{rock:true});}
 const r=traceTerraceRings(w);assert.equal(r.rings,3);assert.equal(r.closed,3);
 const l1=r.levels[0].rings[0];assert.equal(l1.segments,12);assert.equal(l1.length,12);assert.ok(Math.abs(l1.interpLength-(8+4*Math.SQRT1_2))<1e-12);
 for(const k of[1,2])assert.equal(r.levels[k].rings[0].segments,4);// the 1x1 peak is a ring at levels 2 and 3
 assert.ok(r.lenRatio<1);}
const out={};
for(const[name,grid]of[['mixed',buildMixedGrid({radius:9,seed:7})],['quad',buildQuadGrid({radius:9,seed:7})]])for(const seed of[1,7,19])for(const softSlopes of[false,true]){
 const w=new World(grid);generateTerrain(w,{seed,softSlopes});const snap=JSON.stringify(w.snapshot()),e=terraceEdges(w),r=traceTerraceRings(w,e);
 assert.equal(JSON.stringify(w.snapshot()),snap);assert.equal(r.version,w.version);assert.ok(r.rings>0);assert.equal(r.closed,r.rings,'every terrace contour closes');
 for(const lv of r.levels){assert.equal(lv.oddVertices,0);assert.equal(lv.rings.reduce((a,x)=>a+x.segments,0),lv.segments);
  const expect=e.steps.filter(s=>s.level>=lv.level&&s.otherLevel<lv.level).reduce((a,s)=>a+Math.hypot(s.a.x-s.b.x,s.a.z-s.b.z),0);
  assert.ok(Math.abs(lv.rings.reduce((a,x)=>a+x.length,0)-expect)<1e-9);
  for(const ring of lv.rings){assert.ok(ring.interpLength<ring.length);// ring points are actual shared cell corners
   for(const p of ring.points)assert.ok(grid.cells.some(c=>c.pts.includes(p)));}}
 // Level-1 contour is the shoreline.
 const shore=e.shore.reduce((a,s)=>a+Math.hypot(s.a.x-s.b.x,s.a.z-s.b.z),0);assert.ok(Math.abs(r.levels[0].rings.reduce((a,x)=>a+x.length,0)-shore)<1e-9);
 out[name+seed+(softSlopes?'s':'')]={rings:r.rings,levels:r.levels.length,ratio:+r.lenRatio.toFixed(3)};
}
console.log('PASS terrace rings closed on real polygon edges, per-level length = step edges, shore = level-1 ring, midpoint contour shorter',JSON.stringify(out));
