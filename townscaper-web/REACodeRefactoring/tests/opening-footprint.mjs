import assert from'node:assert/strict';import{openingFootprint as fit,OPENING_FRAME as frame,WINDOW_SILL_SCALE as scale}from'../src/core/opening-footprint.js';
// Old half-width .0695 accepted this wall, while the actual sill leaves only .0273, below .035.
const a={x:0,z:0},b={x:.22,z:0};assert.ok(.22/2-(.095/2+.022)>.035);assert.equal(fit(a,b,.5,.095),null);assert.ok(fit(a,b,.5,.095,{door:true}));
let count=0;for(let i=0;i<1000;i++){const angle=i*.123,len=.1+i/800,B={x:len*Math.cos(angle),z:len*Math.sin(angle)};for(const door of[false,true]){const f=fit(a,B,.5,.095,{door});if(f){assert.ok(f.length/2-f.halfWidth>=.035-1e-12);assert.equal(f.halfWidth,.095/2+frame*(door?1:scale));}count++;}}
assert.equal(fit(a,a,.5,.1),null);for(const x of[NaN,-1,Infinity])assert.throws(()=>fit(a,b,.5,x));console.log('PASS',count,'rotated wall bounds plus real sill overrun regression');
