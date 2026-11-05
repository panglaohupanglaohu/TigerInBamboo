import assert from 'node:assert/strict';
import {stunUnit,stepStun} from '../src/core/combat-state.js';
for(const hz of [30,60,120]){const u={};assert(stunUnit(u));let n=0;while(stepStun(u,1/hz)){assert(++n<hz)}assert(Math.abs(n/hz-.7)<2/hz);assert.equal(u.stunRemaining,0)}
const u={};stunUnit(u,.4);stepStun(u,.1);stunUnit(u,.2);assert(Math.abs(u.stunRemaining-.3)<1e-9);stunUnit(u,.7);assert.equal(u.stunRemaining,.7);assert(stepStun(u,0));assert.equal(u.stunRemaining,.7);
for(const field of ['dead','fall','onBoat']){const v={[field]:true,stunRemaining:.7};assert(!stunUnit(v));assert(!stepStun(v,.1));assert.equal(v.stunRemaining,0)}
for(const v of [-1,NaN,Infinity]){assert.throws(()=>stunUnit({},v),RangeError);assert.throws(()=>stepStun({},v),RangeError)}
console.log('PASS stun timing, pause, refresh and priority');
