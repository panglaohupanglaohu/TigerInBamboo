import assert from 'node:assert/strict';
import {makeTestTexture,renderGround,compareFilters,shimmerReport} from '../src/light/mip-ground.js';
import {makeTestTexture as sourceTexture} from '../../REACode/src/mipfilter.js';
import {buildMips} from '../src/light/mip-chain.js';
for(const seed of [1,7,19]){const src=sourceTexture(32,32,{seed}),ref=makeTestTexture(32,32,{seed});for(let i=0;i<32*32;i++)for(let k=0;k<3;k++)assert.equal(Math.round(ref.data[i*3+k]*255),src.data[i*4+k],'source test pattern preserved');}
const img=makeTestTexture(64,64),before=img.data.slice(),result=compareFilters({size:64,W:120,H:80});
assert.equal(result.rows.length,9);for(const r of result.rows){assert.equal(r.image.data.length,120*80*4);assert.ok(r.image.lodRange[1]>r.image.lodRange[0]+2);assert.ok(r.image.data.every(Number.isFinite));assert.ok(Number.isFinite(r.farEnergy));}
const linear=result.rows.filter(r=>r.filter==='linear');assert.ok(linear[1].farEnergy<linear[0].farEnergy,'mip actually reduces distant high-frequency energy');
const chain=buildMips(img);const a=renderGround(chain,120,80,{offsetU:0}),b=renderGround(chain,120,80,{offsetU:1});assert.deepEqual(a.data,b.data,'repeat addressing');assert.deepEqual(img.data,before,'input immutable');
const shimmer=shimmerReport({size:64,W:80,H:60,steps:3,filters:['linear']});assert.equal(shimmer.rows.length,3);assert.ok(shimmer.rows.every(x=>Number.isFinite(x.meanAbsDelta)));assert.ok(shimmer.rows.find(x=>x.mode==='trilinear').meanAbsDelta<shimmer.rows.find(x=>x.mode==='none').meanAbsDelta,'subtexel distant stability improves');
assert.throws(()=>makeTestTexture(0,3));assert.throws(()=>renderGround(chain,120,80,{horizon:1}));assert.throws(()=>renderGround(chain,120,80,{maxAniso:Infinity}));assert.throws(()=>shimmerReport({steps:1}));
console.log('PASS migrated ground consumer: LOD active, reduced far energy/shimmer, repeat addressing, immutable source, bounded inputs',JSON.stringify(shimmer.rows));
