import assert from 'node:assert/strict';
import {traceShoreLoops} from '../src/core/shore-loops.js';
function grid(reverse=false){const cells=[];for(let z=0;z<3;z++)for(let x=0;x<3;x++){let pts=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]].map(([x,z])=>({id:z*4+x,x,z})),neighbors=[z>0?(z-1)*3+x:-1,x<2?z*3+x+1:-1,z<2?(z+1)*3+x:-1,x>0?z*3+x-1:-1];if(reverse){pts=pts.slice().reverse();neighbors=[neighbors[2],neighbors[1],neighbors[0],neighbors[3]]}cells.push({id:z*3+x,pts,edgeNeighbors:neighbors})}return cells}
for(const reversed of [false,true])for(let mask=0;mask<512;mask++){
 const cells=grid(reversed),land=c=>!!(mask&(1<<c.id)),loops=traceShoreLoops(cells,land);let expected=0;
 for(const c of cells)if(land(c))for(const n of c.edgeNeighbors)if(n<0||!land(cells[n]))expected++;
 const area=loops.flat().reduce((n,e)=>n+e.a.x*e.b.z-e.b.x*e.a.z,0)/2;assert.equal(area,cells.filter(land).length);
 assert.equal(loops.reduce((n,l)=>n+l.length,0),expected);
 const used=new Set();for(const l of loops){const verts=new Set();for(let i=0;i<l.length;i++){const e=l[i],next=l[(i+1)%l.length],key=e.a.id+':'+e.b.id;assert.equal(e.b.id,next.a.id);assert.ok(!used.has(key));used.add(key);assert.ok(!verts.has(e.a.id),'point-touch contours must split mask='+mask+' reverse='+reversed+' loop='+l.map(e=>e.a.id));verts.add(e.a.id);assert.ok(Math.abs(Math.hypot(e.nx,e.nz)-1)<1e-12)}}
 const again=traceShoreLoops(cells.slice().reverse(),land);const signature=ls=>ls.map(l=>l.map(e=>e.a.id+':'+e.b.id).sort().join('|')).sort();assert.deepEqual(signature(loops),signature(again));
}
const cells=grid(),diagonal=traceShoreLoops(cells,c=>c.id===0||c.id===4);assert.equal(diagonal.length,2);assert.ok(diagonal.every(l=>l.length===4));const ring=traceShoreLoops(cells,c=>c.id!==4);assert.equal(ring.length,2);
console.log('PASS 1024 occupancy/winding cases: exact edges, no repeated vertices, deterministic order, point-touch split and hole');
