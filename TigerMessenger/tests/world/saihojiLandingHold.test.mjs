import test from 'node:test';
import assert from 'node:assert/strict';
import {saihojiLandingHold,suspendSaihojiBombApproach} from '../../src/world/saihojiLandingHold.js';
const attack={target:{id:'moss'},phase:'blockade',shots:2,age:10};
test('only a real flagship opening strike can hold for physical landing',()=>{
 assert.equal(saihojiLandingHold({...attack,shots:1},1,{ambush:{stage:'landing'}}),false);
 assert.equal(saihojiLandingHold(attack,1,{ambush:{stage:'landing'}}),true);
 assert.equal(saihojiLandingHold(attack,1,{ambush:{stage:'concealed'}}),false);
 assert.equal(saihojiLandingHold(attack,1,{ambush:{stage:'ambush'}}),false);
});
test('other regions, withdrawal and timeout never acquire landing hold',()=>{
 assert.equal(saihojiLandingHold({...attack,target:{id:'bookshop'}},1,null),false);
 assert.equal(saihojiLandingHold({...attack,phase:'withdraw'},1,null),false);
 assert.equal(saihojiLandingHold({...attack,age:60},1,null),false);
 assert.equal(saihojiLandingHold(attack,1,null),true);
});

test('low-energy guard conserves reserve during actual landing and first physical insertion, without restoring energy',()=>{const guard={...attack,phase:'guard'};assert.equal(saihojiLandingHold(guard,1,{ambush:{stage:'landing'}}),true);const d={ambush:{stage:'ambush'}};assert.equal(saihojiLandingHold(guard,1,d,{active:true,stage:'insertion',ready:18,deployed:0}),true);assert.equal(saihojiLandingHold(guard,1,d,{active:true,stage:'sweep',ready:18,deployed:1}),false);});

test('combined assault preserves the ground engagement: first actual strike then suppression/insertion cover before bombs',()=>{const d={ambush:{stage:'ambush'}},op={active:true,stage:'suppression',ready:18,deployed:0};for(const phase of ['blockade','pincer','cannon','guard'])assert.equal(saihojiLandingHold({...attack,phase},1,d,op),true);assert.equal(saihojiLandingHold(attack,1,d,{...op,stage:'sweep',deployed:1}),false);assert.equal(saihojiLandingHold({...attack,shots:1},1,d,op),false);});

test('cover cancels only an unfired prepared straight leg, preserving real queued and released ordnance',()=>{assert.equal(suspendSaihojiBombApproach(true,{releasedAt:null},null),true);assert.equal(suspendSaihojiBombApproach(false,{releasedAt:null},null),false);assert.equal(suspendSaihojiBombApproach(true,{releasedAt:12},null),false);assert.equal(suspendSaihojiBombApproach(true,{releasedAt:null},{type:'rain'}),false);assert.equal(suspendSaihojiBombApproach(true,null,null),false);});
