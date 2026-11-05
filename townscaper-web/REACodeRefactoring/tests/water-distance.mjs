import assert from 'node:assert/strict';
import {waterDistance} from '../src/water/land-distance.js';
const c={minX:0,maxX:12,minZ:0,maxZ:1},world={cells:[c],version:3,isSolid:()=>true},index={cellAt:(x,z)=>x>=0&&x<=12&&z>=0&&z<=1?c:null};
const f=waterDistance(world,index,{resolution:32});assert.notEqual(f.sx,f.sz);const sources=[];for(let z=0;z<32;z++)for(let x=0;x<32;x++)if(f.land[z*32+x])sources.push([x,z]);
for(let z=0;z<32;z++)for(let x=0;x<32;x++){let d=4;for(const [a,b] of sources)d=Math.min(d,Math.hypot((x-a)*f.sx,(z-b)*f.sz));assert.ok(Math.abs(d-f.distance[z*32+x])<1e-6)}
assert.equal(waterDistance({...world,isSolid:()=>false},index),null);assert.equal(world.version,3);assert.throws(()=>waterDistance(world,index,{resolution:1}));
console.log('PASS 1024 anisotropic world-distance samples vs brute reference, level1-only land, no World mutation/budget');
