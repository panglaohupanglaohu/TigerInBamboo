import assert from 'node:assert/strict';
import {buildSquareGrid,buildMixedGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {shapeTerrain} from '../src/terrain/shape.js';
for(const radius of [0,1,5,9])for(const cellSize of [.5,1,2]){
 const g=buildSquareGrid({radius,cellSize}),s=2*radius+1;assert.equal(g.cells.length,s*s);assert.equal(g.verts.length,(s+1)**2);let boundary=0;
 for(const c of g.cells){assert.equal(c.n,4);assert.ok(c.convex);let area=0;for(let i=0;i<4;i++){const a=c.pts[i],b=c.pts[(i+1)%4],d=c.pts[(i+2)%4],ab=[b.x-a.x,b.z-a.z],bc=[d.x-b.x,d.z-b.z];assert.ok(Math.abs(Math.hypot(...ab)-cellSize)<1e-12);assert.ok(Math.abs(ab[0]*bc[0]+ab[1]*bc[1])<1e-12);area+=a.x*b.z-b.x*a.z;const id=c.edgeNeighbors[i];if(id<0)boundary++;else{const n=g.cells[id],j=c.edgeTwins[i];assert.equal(n.edgeNeighbors[j],c.id);assert.equal(c.pts[i],n.pts[(j+1)%4]);assert.equal(c.pts[(i+1)%4],n.pts[j]);}}assert.ok(area<0);}
 assert.equal(boundary,4*s);if(radius>=5){const w=new World(g);generateTerrain(w,{seed:7});const sh=shapeTerrain(w);for(const c of w.cells)for(const p of c.pts)assert.ok(sh.at(p,w.top(c)).every(Number.isFinite));}
}
const legacy=buildMixedGrid({radius:9,hexSize:1,mergeRate:1,seed:5});assert.ok(legacy.cells.some(c=>c.n===3),'legacy merge=1 is not pure quads');
for(const opts of [{radius:-1},{radius:1.5},{radius:129},{cellSize:0},{cellSize:NaN}])assert.throws(()=>buildSquareGrid(opts));
console.log('PASS 12 square sizes, equal edges/right angles/winding, reciprocal shared vertices, boundary count, actual terrain/shape and invalid options');
