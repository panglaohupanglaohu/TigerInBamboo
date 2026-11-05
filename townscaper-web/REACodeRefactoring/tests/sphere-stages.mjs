import assert from 'node:assert/strict';
import {buildSphere,sphereTopologyReport} from '../src/sphere/planet.js';
let checks=0;
for(const n of [60,120,240])for(const seed of [3,11,19]){
 const s=buildSphere({n,seed,spacing:5,relax:5});
 assert.deepEqual(s.steps.triangulated,s.steps.spaced);assert.deepEqual(s.steps.relaxed,s.pts);assert.notDeepEqual(s.steps.triangulated,s.steps.relaxed);assert.notEqual(s.steps.triangulated[0],s.steps.spaced[0]);
 for(const P of [s.steps.triangulated,s.pts]){const q=sphereTopologyReport(P,s.tris);assert.ok(q.closed,JSON.stringify(q));assert.equal(q.euler,2);assert.equal(q.faces,2*n-4);checks++;}
 const proj=s.steps.projection;assert.equal(proj.order.length,n-1);assert.equal(new Set(proj.order).size,n-1);assert.ok(!proj.order.includes(proj.pole));
 let r=-Infinity;for(const [u,v] of proj.pts){const d=u*u+v*v;assert.ok(d>=r-1e-12);r=d;}
 assert.equal(s.steps.check.full,false);assert.equal(s.steps.check.checkedTriangles,60);
 const missing=sphereTopologyReport(s.pts,s.tris.slice(1));assert.equal(missing.closed,false);assert.equal(missing.boundaryEdges,3);
 const flipped=s.tris.map(t=>t.slice());flipped[0].reverse();assert.equal(sphereTopologyReport(s.pts,flipped).windingConflicts,3);
 const twice=sphereTopologyReport(s.pts,[...s.tris,s.tris[0]]);assert.equal(twice.closed,false);assert.equal(twice.duplicateFaces,1);
 const nan=s.pts.map(p=>p.slice());nan[0][0]=NaN;assert.equal(sphereTopologyReport(nan,s.tris).finite,false);
}
for(const x of [{n:0},{n:3},{n:1.5},{n:5001},{spacing:-1},{relax:Infinity},{seed:NaN}])assert.throws(()=>buildSphere(x));
const stationary=buildSphere({n:60,spacing:0,relax:0});assert.deepEqual(stationary.steps.triangulated,stationary.steps.relaxed);
console.log('PASS '+checks+' staged closed-sphere audits, independent pre/post snapshots, radial order map, missing/reversed/duplicate faces, invalid coordinates/options');
