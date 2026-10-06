import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAutomaticShoreUV as build} from './AUTO_UV_PROTOTYPE.mjs';
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);
const stripTriangles=n=>Array.from({length:n-1},(_,i)=>[[2*i,2*i+2,2*i+1],[2*i+2,2*i+3,2*i+1]]).flat();

test('curved ordered bank follows cumulative arc length and signed distance, not longitude',()=>{
 const r=build({shoreline:[[0,0,0],[4,0,0],[4,0,4]],bandVertices:[[0,0,-.2],[0,0,.2],[3,0,-.2],[3,0,.2],[4.2,0,2],[3.8,0,2],[4.2,0,4],[3.8,0,4]],bandTriangles:stripTriangles(4),repeatLength:1,repeatWidth:1});
 close(r.report.totalLength,8);close(r.uv[0][1],.2);close(r.uv[1][1],-.2);close(r.uv[4][0],6);close(r.uv[6][0],8);
});
test('closed circular band duplicates physical seam vertices and preserves interpolation',()=>{
 const n=12,shoreline=[],bandVertices=[];
 for(let i=0;i<n;i++){const a=2*Math.PI*i/n;shoreline.push([10*Math.cos(a),0,10*Math.sin(a)]);const b=a+Math.PI/n;for(const r of [10*Math.cos(Math.PI/n)-.2,10*Math.cos(Math.PI/n)+.2])bandVertices.push([r*Math.cos(b),0,r*Math.sin(b)]);}
 const bandTriangles=[];for(let i=0;i<n;i++){const j=(i+1)%n;bandTriangles.push([2*i,2*j,2*i+1],[2*j,2*j+1,2*i+1]);}
 const r=build({shoreline,bandVertices,bandTriangles,closed:true});
 assert.ok(r.report.duplicateSeamVertices>=2);assert.equal(r.report.seamTriangles,2);
 for(let i=bandVertices.length;i<r.vertices.length;i++){assert.deepEqual(r.vertices[i],bandVertices[r.sourceVertex[i]]);close(r.uv[i][0]-r.uv[r.sourceVertex[i]][0],r.report.totalLength/4);}
 for(const f of r.triangles){const us=f.map(i=>r.uv[i][0]);assert.ok(Math.max(...us)-Math.min(...us)<r.report.totalLength/8);}
});
test('sphere uses 3D great-circle distance and radial bank frame away from global XZ',()=>{
 const R=10,p=(a,lat)=>[R*Math.cos(lat)*Math.cos(a),R*Math.sin(lat),R*Math.cos(lat)*Math.sin(a)];
 const r=build({shoreline:[p(0,0),p(Math.PI/4,0),p(Math.PI/2,0)],bandVertices:[p(0,-.05),p(0,.05),p(Math.PI/4,-.05),p(Math.PI/4,.05),p(Math.PI/2,-.05),p(Math.PI/2,.05)],bandTriangles:stripTriangles(3),surface:'sphere',sphereRadius:R,repeatLength:1,repeatWidth:1});
 close(r.report.totalLength,Math.PI*R/2);close(r.uv[2][0],Math.PI*R/4);close(Math.abs(r.uv[2][1]),.5);assert.notEqual(Math.sign(r.uv[2][1]),Math.sign(r.uv[3][1]));
});
test('invalid, branching, ambiguous and degenerate charts fail explicitly',()=>{
 const base={shoreline:[[0,0,0],[2,0,0]],bandVertices:[[0,0,-.1],[0,0,.1],[1,0,-.1],[1,0,.1]],bandTriangles:stripTriangles(2)};
 assert.throws(()=>build({...base,branches:[[0,1,2]]}),/branching/);
 assert.throws(()=>build({...base,shoreline:[[0,0,0],[0,0,0]]}),/degenerate/);
 assert.throws(()=>build({...base,repeatLength:0}),/scale/);
 assert.throws(()=>build({...base,bandVertices:[[NaN,0,0]]}),/vertices/);
 assert.throws(()=>build({...base,bandVertices:[[0,1,0],...base.bandVertices.slice(1)]}),/nonplanar/);
 assert.throws(()=>build({...base,bandTriangles:[[0,0,1]]}),/degenerate band/);
 assert.throws(()=>build({...base,shoreline:[[0,0,0],[2,0,0],[2,0,2],[0,0,2]],bandVertices:[[1,0,1],...base.bandVertices.slice(1)]}),/ambiguous/);
 assert.throws(()=>build({...base,surface:'sphere',sphereRadius:10}),/off sphere/);
});
