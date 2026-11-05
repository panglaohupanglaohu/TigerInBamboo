import assert from 'node:assert/strict';
import {bakeWaveMotion,waveCrest} from '../src/core/wave-cycle.js';
for(let i=0;i<720;i++){
 const angle=i*Math.PI/360,n={nx:Math.cos(angle),nz:Math.sin(angle)};
 const tx=-n.nz,tz=n.nx,dx=.8*n.nx+.3*tx,dz=.8*n.nz+.3*tz;
 const m=bakeWaveMotion({x:0,z:0},{x:dx,z:dz},n);
 assert.ok(Math.abs(Math.hypot(...m.incoming)-Math.hypot(...m.outgoing))<1e-12);
 assert.ok(m.outgoing[0]*n.nx+m.outgoing[1]*n.nz>0);
 assert.ok(Math.abs(m.outgoing[0]*tx+m.outgoing[1]*tz+.3)<1e-12);
}
assert.deepEqual(bakeWaveMotion({x:1,z:1},{x:1,z:1},{nx:0,nz:0}),{incoming:[0,0],outgoing:[0,0]});
assert.throws(()=>bakeWaveMotion({x:NaN,z:0},{x:0,z:0},{nx:1,nz:0}));
console.log('PASS 720 reflected directions: magnitude, seaward normal, reversed tangent, zero span, finite guard');

for(let i=0;i<1000;i++){const s=i*.07,a=waveCrest(s,.7),b=waveCrest(s+Math.PI*2,.7);assert.ok(a.coverage>=0&&a.coverage<=1);assert.ok(a.width>=.65&&a.width<=1);assert.ok(Math.abs(a.coverage-b.coverage)<1e-12);assert.ok(Math.abs(a.width-b.width)<1e-12)}
assert.throws(()=>waveCrest(NaN));console.log("PASS 1000 crest ranges and closed-loop periodic seams");
