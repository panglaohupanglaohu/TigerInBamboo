import assert from 'node:assert/strict';import{playfulJitter}from'../src/core/playful-layout.js';
for(let seed=0;seed<1000;seed++)for(const width of [44,115,240,1000])for(const gap of [0,2,10]){const opt={seed,width,height:44,gap},j=playfulJitter('menu-'+seed,opt);assert.deepEqual(j,playfulJitter('menu-'+seed,opt));assert.ok(j.overhang<=gap*.45+1e-9);assert.ok(Object.values(j.bounds).every(Number.isFinite));}
assert.notDeepEqual(playfulJitter('a'),playfulJitter('b'));assert.notDeepEqual(playfulJitter('a',{seed:1}),playfulJitter('a',{seed:2}));
for(const opt of [{seed:NaN},{width:0},{height:-1},{gap:-1},{maxRot:11},{maxDx:Infinity}])assert.throws(()=>playfulJitter('a',opt));assert.throws(()=>playfulJitter(''));
console.log('PASS 12000 deterministic layout/clearance cases and invalid options');
