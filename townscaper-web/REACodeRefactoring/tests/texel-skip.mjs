import assert from 'node:assert/strict';
import {skipTexel} from '../src/core/texel-skip.js';
// Integral of a dark odd texel under linear filtering: one screen pixel at
// magnification; test negative UVs, phase continuity and many footprint sizes.
for(const w of [.03,.07,.125,.25,.5,1]){
 let area=0; const N=20000;
 for(let i=0;i<N;i++){
  const t=(i+.5)*2/N, s=skipTexel(t,w), f=s-Math.floor(s);
  // Distance to the content texel centre, where 0 is white and 1 is black.
  const dark=Math.abs(s-.5);area+=dark*2/N;
  assert.ok(Number.isFinite(f));assert.ok(Math.abs(skipTexel(t-4,w)-(s-4))<1e-10);
 }
 assert.ok(Math.abs(area/w-1)<1e-4,`line mass ${area/w}`);
 assert.ok(Math.abs(skipTexel(2-1e-9,w)-skipTexel(2+1e-9,w))<1e-6);
}
for(const pair of [[NaN,1],[1,0],[1,-1],[1,Infinity]])assert.throws(()=>skipTexel(...pair),RangeError);
console.log('PASS UV continuity, negative wrapping and line integral at 6 scales');
