import assert from 'node:assert/strict';
import {unitTierAppearance,setUnitAppearanceTier} from '../src/core/unit-tier.js';
const u={hp:1,max:6,soak:5/6,stunRemaining:.4,kind:'big',bodyScale:1.5,radius:.0825,x:4,navFloor:2},before={...u};
for(const t of [1,2,3,1,3]){setUnitAppearanceTier(u,t);const {appearanceTier,...state}=u;assert.deepEqual(state,before);assert.equal(appearanceTier,t);assert.ok(Object.isFrozen(unitTierAppearance(t)));}
for(const t of [0,4,1.5,NaN,'2']){const prev={...u};assert.throws(()=>setUnitAppearanceTier(u,t),RangeError);assert.deepEqual(u,prev);}
setUnitAppearanceTier(u);assert.deepEqual(u,before);assert.equal(new Set([1,2,3].map(t=>unitTierAppearance(t).shield)).size,3);
console.log('PASS cosmetic tiers: no healing/state reset, atomic invalid input, default restore');
