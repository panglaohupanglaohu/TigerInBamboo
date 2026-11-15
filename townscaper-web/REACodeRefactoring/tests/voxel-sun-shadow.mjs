// 1190191289922465793 per-vertex voxel sun shadow on bakeLighting's shared layered occupancy.
import assert from 'node:assert/strict';
import {generateModulePatch} from '../src/core/module-patch.js';
import {World} from '../src/core/world.js';
import {bakeLighting, normalizeSunShadow} from '../src/light/bake.js';
const vertices=[],faces=[];for(let x=0;x<=8;x++)for(let z=0;z<=8;z++)vertices.push([x,z]);for(let x=0;x<8;x++)for(let z=0;z<8;z++){const a=x*9+z;faces.push([a,a+9,a+10,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g);world.cells.forEach(c=>world.fill(c,1,{rock:true}));
const tower=world.cells.find(c=>c.cx>4&&c.cx<5&&c.cz>4&&c.cz<5);world.fill(tower,4);
const L=.5,colorOf=()=>({r:.8,g:.8,b:.8});
// upward floor triangles at y=L (top of level 1): west of tower (sun side is +x), east of tower, and far away
const tri=(x,z)=>[x,L,z,x,L,z+.1,x+.1,L,z];
const mesh=()=>({pos:[...tri(3.5,4.45),...tri(5.4,4.45),...tri(1,1)],col:new Array(27).fill(1)});
const sun={dir:[1,1.1,0]};
const base=mesh(),r0=bakeLighting(base,world,{L,colorOf,strength:0,bounce:0});
const m=mesh(),r=bakeLighting(m,world,{L,colorOf,strength:0,bounce:0,sunShadow:sun,keepField:true});
const v=i=>m.col[i*3];
assert.equal(r0.sunShadowed,undefined===r0.sunShadowed?undefined:0);
assert.ok(v(0)<.9&&v(0)>=.76,'west vertices darkened by at most strength 0.24: '+v(0));
assert.ok(Math.abs(v(3)-1)<1e-9&&Math.abs(v(6)-1)<1e-9,'east of tower (away from sun) stays lit');
assert.ok(v(1)<1,'tower casts toward -x');
for(let i=6;i<9;i++)assert.equal(m.col[i*3],1,'far vertex lit');
assert.ok(r.sunShadowed>=3&&r.sunShadowed<=4);
// distance falloff: hit farther along the ray → lighter (1-0.55 d^2)
const near=mesh(),far=mesh();near.pos=tri(3.9,4.45);near.col=new Array(9).fill(1);far.pos=tri(2.9,4.45);far.col=new Array(9).fill(1);
const rn=bakeLighting(near,world,{L,colorOf,strength:0,bounce:0,sunShadow:sun,keepField:true}),rf=bakeLighting(far,world,{L,colorOf,strength:0,bounce:0,sunShadow:sun,keepField:true});
assert.ok(rn.field.sunShade[0]>rf.field.sunShade[0]&&rf.field.sunShade[0]>0,'nearer hit is darker '+rn.field.sunShade[0]+' '+rf.field.sunShade[0]);
// blocky per-vertex: the result is a vertex attribute only; the field exposes the same 0/1 occupancy used for AO
assert.equal(r.field.solidAt(4.5,1.2,4.5),1);assert.equal(r.field.solidAt(2,1.2,2),0);
// region (chunk) bake reaches the caster even when it sits outside the chunk box
const chunk=mesh();bakeLighting(chunk,world,{L,colorOf,strength:0,bounce:0,sunShadow:sun,region:{minX:3,maxX:3.9,minZ:4,maxZ:4.9}});
assert.ok(chunk.col[0]<.9,'chunk grid padded by sun reach');
// default bake unchanged by the new code path
const a=mesh(),b=mesh();bakeLighting(a,world,{L,colorOf});bakeLighting(b,world,{L,colorOf,aoMode:'vertex'});assert.deepEqual(a.col,b.col);
// edit → re-bake follows the World
world.fill(tower,1);const m2=mesh();bakeLighting(m2,world,{L,colorOf,strength:0,bounce:0,sunShadow:sun});assert.equal(m2.col[0],1,'tower removed → no shadow');
assert.throws(()=>normalizeSunShadow({dir:[1,-1,0]}));assert.throws(()=>normalizeSunShadow({dir:[0,1,0],steps:0}));
console.log('PASS per-vertex voxel sun shadow: directional, ≤0.24 dark, distance falloff',rn.field.sunShade[0].toFixed(3),rf.field.sunShade[0].toFixed(3),'chunk reach, default path unchanged, follows edits');
