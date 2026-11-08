import assert from 'node:assert/strict';
import {cloudDrift} from '../src/core/cloud-motion.js';
for(let i=0;i<1000;i++){const t=i*.137-50,yaw=i*.002;const a=cloudDrift(t,yaw);assert.ok(a>=-20&&a<20);assert.ok(Math.abs(a-cloudDrift(t+40/.12,yaw))<1e-10)}
assert.ok(Math.abs(cloudDrift(10,0)-cloudDrift(0,0)-1.2)<1e-10);
console.log('PASS cloud shared drift 1000 wrap/negative-time cases');
