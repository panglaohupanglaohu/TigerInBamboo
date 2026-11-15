import assert from 'node:assert/strict';import {SpriteAtlas,radialPack} from '../src/core/sprite-atlas.js';
import {radialPack as originalRadial} from '../../REACode/engine/spritepack.js';
const a=new SpriteAtlas(32,{maxSize:256});for(let i=0;i<25;i++)a.insert('s'+i,8+i%5,8+i%3,2);assert.ok(a.size>32);assert.equal(a.slots.size,25);
const check=()=>{const all=[...a.slots];for(let i=0;i<all.length;i++){const [key,r]=all[i],pad=a.items.get(key).pad;assert.ok(r.x>=pad&&r.y>=pad&&r.x+r.w+pad<=a.size&&r.y+r.h+pad<=a.size);for(let j=0;j<i;j++){const [k,s]=all[j],p=a.items.get(k).pad;assert.ok(r.x+r.w+pad<=s.x-p||s.x+s.w+p<=r.x-pad||r.y+r.h+pad<=s.y-p||s.y+s.h+p<=r.y-pad);}}};check();
a.insert('s0',20,25,3);assert.equal(a.slots.size,25);check();a.free('s3');assert.equal(a.slots.size,24);assert.ok(!a.slots.has('s3'));check();
const before=JSON.stringify([...a.slots]);assert.throws(()=>a.insert('bad',99999,1));assert.equal(JSON.stringify([...a.slots]),before);assert.ok(!a.items.has('bad'));
const small=new SpriteAtlas(8,{maxSize:8});small.insert('one',8,8,0);assert.throws(()=>small.insert('two',1,1,0));assert.equal(small.items.size,1);assert.ok(!small.items.has('two'));
// Differential source test: the shared collision tree preserves source radial placements on supported inputs.
for(let seed=1;seed<=15;seed++){let s=seed;const items=Array.from({length:20},(_,id)=>{s=(s*16807)%2147483647;return{key:String(id),w:4+s%16,h:4+(s>>5)%18};});const want=originalRadial(items,{size:128,gap:2}),got=radialPack(items,{size:128,gap:2});for(const k of ['placed','skipped','occupancy','bigOffset'])assert.deepEqual(got[k],want[k],k);}
assert.ok(radialPack([{w:4,h:4},{w:4,h:4}],{size:8,gap:0,maxCandidates:1}).budgetExhausted);assert.throws(()=>radialPack([{w:NaN,h:3}]));
console.log('PASS SpriteAtlas bounded grow/update/free/padding/rollback; 15 differential radial layouts match original');
