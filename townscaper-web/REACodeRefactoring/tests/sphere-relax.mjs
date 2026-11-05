import assert from 'node:assert/strict';
import {buildSphere,buildPlanet,cornerPositions,moduleSizeReport,planetMesh} from '../src/sphere/planet.js';
for(const n of [120,240]){
 const p=buildPlanet(buildSphere({n,spacing:5,relax:5}),{R:2,L:.4}),before=JSON.stringify(p),off=cornerPositions(p,{relax:false}),empty=cornerPositions(p,{moduleCells:[]});
 for(let l=0;l<=Math.max(...p.H);l++)for(let k=0;k<p.corners.length;k++){assert.deepEqual(empty(k,l),off(k,l));assert.ok(Math.abs(Math.hypot(...off(k,l))-(p.R+l*p.L))<1e-10);}
 const legacy=cornerPositions(p),all=cornerPositions(p,{moduleCells:p.cells.map(c=>c.id)});for(let k=0;k<p.corners.length;k++)for(let l=0;l<=Math.max(...p.H);l++)assert.deepEqual(legacy(k,l),all(k,l));
 const id=p.H.indexOf(Math.max(...p.H)),on=cornerPositions(p,{moduleCells:[id]}),touch=new Set(p.cells[id].ring),a=moduleSizeReport(p,off,{moduleCells:[id]}),b=moduleSizeReport(p,on,{moduleCells:[id]});
 assert.ok(b.maxEdgeError<a.maxEdgeError);assert.ok(Math.abs(b.cells[0].areaRatio-1)<Math.abs(a.cells[0].areaRatio-1));
 for(let l=0;l<=Math.max(...p.H);l++)for(let k=0;k<p.corners.length;k++){assert.ok(on(k,l).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...on(k,l))-(p.R+l*p.L))<1e-10);if(!touch.has(k))assert.deepEqual(on(k,l),off(k,l));}
 assert.equal(before,JSON.stringify(p));assert.deepEqual(on(id,0),off(id,0));
 const mesh=planetMesh(p,on);assert.ok(mesh.position.every(Number.isFinite)&&mesh.normal.every(Number.isFinite));
 for(const opts of [{moduleCells:[-1]},{moduleCells:[.5]},{moduleCells:[p.cells.length]},{moduleCells:'all'},{iters:-1},{iters:Infinity}])assert.throws(()=>cornerPositions(p,opts));
 for(const args of [[-1,0],[0,-1],[0,.5],[0,Infinity]])assert.throws(()=>on(...args));
 console.log({n,selected:id,before:a,after:b});
}
console.log('PASS explicit module constraints, untouched corners, radius, size improvement, empty selection identity, validation, pure input');
