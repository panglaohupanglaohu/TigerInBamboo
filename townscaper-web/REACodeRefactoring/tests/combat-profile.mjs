import assert from 'node:assert/strict';
import {configureCombatUnit as configure,damageCombatUnit as damage} from '../src/core/combat-profile.js';
import {stunUnit} from '../src/core/combat-state.js';
const small=configure({}, {kind:'small',maxHealth:3}),big=configure({}, {kind:'big'});
assert.equal(small.radius,.055);assert.equal(big.max,6);assert.equal(big.bodyScale,1.5);assert.equal(big.radius,small.radius*1.5);assert(stunUnit(small));assert(!stunUnit(big));
for(let n=1;n<=6;n++){damage(big);assert.equal(big.hp,6-n);assert(Math.abs(big.soak-n/6)<1e-12);assert(!stunUnit(big))}damage(big,100);assert.equal(big.hp,0);assert.equal(big.soak,1);
const fresh=configure({});const before=JSON.stringify(fresh);assert.throws(()=>configure(fresh,{kind:'giant'}),RangeError);assert.equal(JSON.stringify(fresh),before);
for(const amount of [-1,NaN,Infinity])assert.throws(()=>damage(fresh,amount),RangeError);
console.log('PASS profile defaults, scaled radius, health soaking, stun distinction and validation');
