import assert from 'node:assert/strict';import {unitShadow} from '../src/core/unit-shadow.js';
const footprint=[{x:-1,z:-1},{x:-1,z:1},{x:1,z:1},{x:1,z:-1}],base={x:0,z:0,footY:2,groundY:2,footprint};
for(const x of [0,.98,1.02])for(const z of [0,.98]){const q=unitShadow({...base,x,z,radius:.2});for(let i=0;i<q.position.length;i+=3){assert.ok(Math.abs(q.position[i])<=1+1e-10&&Math.abs(q.position[i+2])<=1+1e-10);assert.equal(q.position[i+1],2.008);}assert.ok(q.position.every(Number.isFinite));}
const low=unitShadow(base),high=unitShadow({...base,footY:2.4});assert.ok(high.alpha<low.alpha&&high.radius>low.radius);assert.equal(unitShadow({...base,footY:3}).triangles,0);assert.equal(unitShadow({...base,footY:1}).triangles,0);assert.equal(JSON.stringify(footprint),JSON.stringify(base.footprint));
assert.throws(()=>unitShadow({...base,x:NaN}));assert.throws(()=>unitShadow({...base,radius:-1}));
console.log('PASS clipped footprints/edge crossing/height plane/fade/finite/rejection; local policy, not inferred original parameters');
