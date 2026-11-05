import assert from 'node:assert/strict';
import {buildCornerField,marchGrid} from '../src/core/contour.js';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
const p=[{id:0,x:0,z:0},{id:1,x:2,z:0},{id:2,x:1.5,z:1},{id:3,x:0,z:2}],quad={id:0,pts:p};
function exact(values){const cells=p.map((v,i)=>({id:i,pts:[v]}));return buildCornerField(cells,c=>values[c.id]);}
assert.equal(exact([1,2,3,4]).valueAt(p[2]),3);
const repeated=[{id:0,pts:[p[0]]},{id:1,pts:[p[0]]}];assert.equal(buildCornerField(repeated,c=>c.id?5:2,{reduce:'max'}).valueAt(p[0]),5);
assert.throws(()=>buildCornerField(repeated,()=>NaN));assert.throws(()=>buildCornerField(repeated,()=>0,{reduce:'sum'}));
for(const [kind,grid]of [['mixed',buildMixedGrid({radius:6,seed:5})],['quad',buildQuadGrid({radius:4,seed:5})]]){
 const value=c=>Math.hypot(c.cx,c.cz)<1.5?1:0,r=marchGrid(grid.cells,value),lv=r.levels[0];assert.ok(lv.segments.length);assert.equal(lv.openEndpoints.length,0);assert.equal(lv.branches.length,0);assert.ok(lv.paths.every(p=>p.closed));assert.equal(lv.paths.reduce((n,p)=>n+p.points.length-1,0),lv.segments.length);
 const reverse=marchGrid([...grid.cells].reverse(),value);assert.deepEqual(reverse.levels,r.levels);
 // Every joined endpoint is literally the same cached object, no coordinate epsilon stitching.
 const points=new Map();for(const s of lv.segments)for(const p of [s.a,s.b]){if(points.has(p.key))assert.equal(points.get(p.key),p);else points.set(p.key,p);}
 const open=marchGrid(grid.cells,c=>c.cx).levels[0];assert.ok(open.openEndpoints.length>=2);assert.equal(open.branches.length,0);
 assert.equal(marchGrid(grid.cells,()=>.5).levels[0].segments.length,0);
 console.log('PASS contours',kind,{segments:lv.segments.length,loops:lv.paths.length,openEnds:open.openEndpoints.length});
}
// Direct shared-corner fields isolate the bilinear saddle, including a case
// where the old arithmetic-center decision gives the opposite connectivity.
const connections=values=>marchGrid([quad],()=>0,{iso:0,cornerField:exact(values)}).levels[0].segments.map(s=>[s.a.key,s.b.key].sort().join('/')).sort();
assert.deepEqual(connections([2,-1,2,-1]),['e:v:0|v:1/e:v:1|v:2','e:v:0|v:3/e:v:2|v:3'].sort());
assert.deepEqual(connections([8,-4,1,-3]),['e:v:0|v:1/e:v:0|v:3','e:v:1|v:2/e:v:2|v:3'].sort());
const atVertex=marchGrid([quad],()=>0,{iso:0,cornerField:exact([0,1,-1,-1])}).levels[0];
assert.ok(atVertex.segs.flat().every(Number.isFinite));assert.ok(atVertex.segments.every(s=>s.a.key!==s.b.key));
