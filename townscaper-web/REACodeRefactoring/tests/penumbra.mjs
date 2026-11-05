import assert from 'node:assert/strict';
import {coarsenHeights,castHeightShadow,threeShadow} from '../src/core/penumbra.js';
const field={nx:30,nz:18,res:.2,heights:new Float32Array(540)};for(let z=6;z<12;z++)for(let x=14;x<17;x++)field.heights[z*30+x]=2;
const S=[.8,.6,.2],r=threeShadow(field,S),scaled=threeShadow({...field,res:2,heights:Float32Array.from(field.heights,h=>h*10)},S,{pull:1.8});
let band=0,hard=0;for(let k=0;k<540;k++){assert.ok(r.pulled[k]<=r.normal[k]);assert.ok(r.alpha[k]>=0&&r.alpha[k]<=1);assert.ok(Math.abs(r.alpha[k]-scaled.alpha[k])<1e-7);if(field.heights[k])assert.equal(r.alpha[k],0);if(r.alpha[k]>0&&r.alpha[k]<.5)band++;hard+=r.normal[k]}
assert.ok(band>0&&hard>0);const coarse=coarsenHeights(field);assert.equal(Math.max(...coarse.heights),2);assert.ok(Math.abs(coarse.res-.6)<1e-12); // 0.2*3
const empty=threeShadow({...field,heights:new Float32Array(540)},S);assert.ok(empty.alpha.every(v=>v===0));assert.ok(castHeightShadow(field,[0,1,0]).every(v=>v===0));
assert.throws(()=>castHeightShadow(field,[1,0,0]));assert.throws(()=>coarsenHeights(field,0));assert.throws(()=>castHeightShadow({...field,res:0},S));
console.log('PASS three masks, pulled subset, world-unit scale invariance, max pooling, water mask, empty/vertical sun; band',band);
