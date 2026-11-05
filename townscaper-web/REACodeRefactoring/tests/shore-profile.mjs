import assert from 'node:assert/strict';
import {sampleShoreline,marchShore} from '../src/core/shore-profile.js';
const ring=[{x:0,z:0,nx:-Math.SQRT1_2,nz:-Math.SQRT1_2},{x:2,z:0,nx:Math.SQRT1_2,nz:-Math.SQRT1_2},{x:2,z:1,nx:Math.SQRT1_2,nz:Math.SQRT1_2},{x:0,z:1,nx:-Math.SQRT1_2,nz:Math.SQRT1_2}];
const samples=sampleShoreline(ring);
for(const p of samples){assert.ok(p.x===0||p.x===2||p.z===0||p.z===1,'samples must stay on actual polygon boundary');assert.ok(Math.abs(Math.hypot(p.nx,p.nz)-1)<1e-12);}
for(const corner of ring)assert.ok(samples.some(p=>p.x===corner.x&&p.z===corner.z));
let greatest=0;const blocked=(x)=>{greatest=Math.max(greatest,x);return 0;};
assert.equal(marchShore(blocked,0,0,1,0,1,.1,.07),.1);assert.ok(greatest<=.1);
assert.equal(marchShore(()=>2,0,0,1,0,1,3,.07),0);
assert.ok(Math.abs(marchShore(x=>x,0,0,1,0,.33,1,.07)-.33)<.0001);
assert.equal(sampleShoreline([ring[0],ring[0],...ring.slice(1)]).length,samples.length);
assert.throws(()=>sampleShoreline(ring,0));assert.throws(()=>marchShore(()=>0,0,0,1,0,1,1,0));
console.log('PASS actual-boundary sampling, finite normals, duplicated corner, bounded/failed/initial crossing');
