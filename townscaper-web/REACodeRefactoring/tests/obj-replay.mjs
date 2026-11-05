import assert from 'node:assert/strict';import {geometryToOBJ} from '../src/tools/objexport.js';import {World} from '../src/core/world.js';import {replaySnapshots,replayDelay} from '../src/core/snapshot-replay.js';
const attr=a=>({itemSize:3,count:a.length/3,getX:i=>a[i*3],getY:i=>a[i*3+1],getZ:i=>a[i*3+2]});
const attrs={position:attr([0,0,0,1e-6,0,0,0,1e-6,0])};const g={getAttribute:n=>attrs[n],getIndex:()=>null};
let r=geometryToOBJ(g,{name:'name\nf 1 2 3'});assert.equal(r.faces,1);assert.ok(!r.text.includes('vn '));assert.ok(r.text.includes('f 1 2 3'));assert.ok(r.text.includes('o name_f_1_2_3'));
assert.equal(geometryToOBJ(g,{precision:4}).droppedFaces,1);attrs.normal=attr([0,0,1,0,0,1,0,0,1]);assert.ok(geometryToOBJ(g).text.includes('f 1//1 2//2 3//3'));attrs.color=attr([1,0,0,0,1,0,0,0,1]);assert.ok(geometryToOBJ(g).text.includes('v 0 0 0 1 0 0'));attrs.position=attr([NaN,0,0]);assert.throws(()=>geometryToOBJ(g));
const w=new World({cells:[{id:0}],radius:1}),base=w.snapshot(),f={...base,solid:new Uint16Array([1])};let n=0;await assert.rejects(()=>replaySnapshots(w,[f],{apply:()=>{},wait:()=>{throw Error('failure')}}));assert.deepEqual(w.snapshot(),base);
const abort=new AbortController();const outcome=await replaySnapshots(w,[f,f],{apply:()=>{n++;},wait:async()=>abort.abort(),signal:abort.signal});assert.equal(outcome.shown,1);assert.ok(outcome.cancelled);assert.deepEqual(w.snapshot(),base);await replayDelay(1000,abort.signal);assert.equal(n,2);
console.log('PASS exact tiny OBJ faces, optional normals/colors, bad data, replay failure/cancel restoration');
