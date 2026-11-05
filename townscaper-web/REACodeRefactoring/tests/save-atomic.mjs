import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {encodeWorld,decodeWorld,peekGridRadius} from '../src/world/save.js';
const make=n=>{const w=new World({radius:1,cells:Array.from({length:n},(_,id)=>({id}))});w.palette={colors:Array(15).fill('#ffffff')};return w;};
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
function pack(parts){const b=parts.map(([v,n])=>v.toString(2).padStart(n,'0')).join('');return b.match(/.{1,6}/g).map(x=>alphabet[parseInt(x.padEnd(6,'0'),2)]).join('');}
// Independent legacy v5 record: one occupied cell, color slot 2, no river.
const legacy=pack([[5,3],[0,2],[1,6],[1,1],[1,12],[0,12],[3,5],[0,1],[0,5],[0,1]]);
const w=make(1);assert.equal(decodeWorld(legacy,w),'town');assert.equal(w.solid[0],1);assert.equal(w.color[0],2);assert.equal(encodeWorld(w,'town'),legacy);
const bad=[legacy.slice(0,-1),legacy+'0','!',pack([[5,3],[0,2],[1,6],[0,1],[1,5],[0,1]]),pack([[5,3],[0,2],[1,6],[1,1],[1,12],[2,12],[1,5],[0,1],[0,5],[0,1]]),pack([[5,3],[0,2],[1,6],[1,1],[1,12],[0,12],[31,5],[0,1],[0,5],[0,1]])];
for(const input of bad){const before=w.snapshot(),v=w.version;assert.throws(()=>decodeWorld(input,w));assert.deepEqual(w.snapshot(),before);assert.equal(w.version,v);}
assert.throws(()=>peekGridRadius('!'));assert.throws(()=>peekGridRadius('00'));assert.equal(peekGridRadius(legacy),1);assert.throws(()=>encodeWorld(w,'invalid'));
let seed=7;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let t=0;t<100;t++){const a=make(t+1),b=make(t+1);for(let i=0;i<=t;i++){a.solid[i]=rnd()%4096;a.rock[i]=a.solid[i]&(rnd()%4096);a.color[i]=rnd()%16-1;a.river[i]=rnd()%2;}for(const scene of ['town','terrain','fusion','badnorth']){const code=encodeWorld(a,scene);assert.equal(decodeWorld(code,b),scene);assert.deepEqual(b.snapshot(),a.snapshot());}}
const empty=make(100);empty.color[55]=3;empty.river[60]=1;const target=make(100);decodeWorld(encodeWorld(empty,'town'),target);assert.deepEqual(target.snapshot(),empty.snapshot());
w.rock[0]=2;assert.throws(()=>encodeWorld(w,'town'));
console.log('PASS legacy v5 byte equivalence, 400 roundtrips, empty metadata, badnorth identity and atomic rejection');
