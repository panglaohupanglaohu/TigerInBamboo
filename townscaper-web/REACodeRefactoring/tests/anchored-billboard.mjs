import assert from 'node:assert/strict';import {billboardPoint} from '../src/core/anchored-billboard.js';
const base={origin:[1,2,3],axis:[1,0,0],center:1,scale:2};const points=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,camera=[1+Math.cos(a)*10,8,3+Math.sin(a)*10];points.push(billboardPoint({...base,camera}));}
for(const p of points)assert.deepEqual(p,[1.1400000000000001,2+.45*.165*2,3]);
const legacy=[0,Math.PI].map(a=>billboardPoint({...base,camera:[1+10*Math.cos(a),8,3+10*Math.sin(a)],anchorMix:0}));assert.ok(Math.hypot(...legacy[0].map((v,i)=>v-legacy[1][i]))>.2);
const corner={...base,point:[-1,0],center:0,camera:[11,8,3]};assert.deepEqual(billboardPoint({...corner,anchorMix:0}),billboardPoint({...corner,anchorMix:1}));
assert.ok(billboardPoint({...base,camera:[1,8,3]}).every(Number.isFinite));assert.throws(()=>billboardPoint({...base,camera:[NaN,0,0]}));console.log('PASS fixed centers around 16 directions, legacy motion, overhead fallback and invalid input');
