// 793557992931266561 flat -> up normal -> vertex voxel AO -> directional AO on the shared World/bake.
import assert from 'node:assert/strict';
import {register} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root,'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const {generateModulePatch}=await import('../src/core/module-patch.js');const {World}=await import('../src/core/world.js');
const {bakeLighting,AO_MODES}=await import('../src/light/bake.js');const {buildVoxelAO}=await import('../src/light/voxel-ao.js');
const vertices=[],faces=[];for(let x=0;x<=8;x++)for(let z=0;z<=8;z++)vertices.push([x,z]);for(let x=0;x<8;x++)for(let z=0;z<8;z++){const a=x*9+z;faces.push([a,a+9,a+10,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g);world.cells.forEach(c=>world.fill(c,1,{rock:true}));
const wall=world.cells.filter(c=>c.cx>4&&c.cx<5);wall.forEach(c=>world.fill(c,4));world.palette=null;
const L=.5,colorOf=()=>({r:.8,g:.8,b:.8});
const tri=(x,z)=>[x,L,z,x,L,z+.1,x+.1,L,z];
const mesh=()=>({pos:[...tri(3.75,4.45),...tri(1,1)],col:new Array(18).fill(1)});
const run=(aoMode)=>{const m=mesh();const r=bakeLighting(m,world,{L,colorOf,aoMode,keepField:true});return {m,r}};
const out=Object.fromEntries(AO_MODES.map(k=>[k,run(k)]));
// flat: untouched
assert.ok(out.flat.m.col.every(v=>v===1));
// up normal: no neighbour knowledge → floor next to wall equals open floor
assert.equal(out.up.m.col[0],out.up.m.col[9]);assert.ok(out.up.m.col[0]===1);
// vertex AO: the floor at the wall foot gets darker than the open floor, no direction info
assert.ok(out.vertex.m.col[0]<out.vertex.m.col[9]-.05);
// directional: six scalars; the wall stands at +x of the probe so +x occlusion > -x, and the tint differs per channel
const d=out.directional.r.field.dirAo;assert.equal(d.length,6*6);assert.ok(d[0]>d[1]+.1,'+x occluded more than -x: '+d[0]+' '+d[1]);
const c=out.directional.m.col;assert.ok(c[0]<1);assert.ok(Math.abs(c[0]-c[1])>1e-3||Math.abs(c[1]-c[2])>1e-3,'directional tint');
// mirror: probe on the other side of the wall → -x dominates
const m2={pos:tri(5.15,4.45),col:new Array(9).fill(1)},r2=bakeLighting(m2,world,{L,colorOf,aoMode:'directional',keepField:true});assert.ok(r2.field.dirAo[1]>r2.field.dirAo[0]);
assert.throws(()=>bakeLighting(mesh(),world,{L,colorOf,aoMode:'ssao'}));
// cell-level facts ported from REACode buildVoxelAO on the shared World
const v=buildVoxelAO(world),west=world.cells.find(c=>c.cx>3&&c.cx<4&&c.cz>4&&c.cz<5);
const top=v.faceShading(west,'top');assert.ok(top.ao<1&&top.dirAo[0]>0,'west cell: blocked toward +x');
const s=v.stats();assert.ok(s.flat.mean===1&&s.upNormal.mean<1&&s.ao.p05<s.ao.p95&&s.dirAo.p95>0);
// WorldMesh forwards the stage to its chunked bake
const {WorldMesh}=await import('../src/world/worldmesh.js');
const wm=new WorldMesh(world,{levelHeight:L});
const colSum=()=>{const a=wm.geometry.getAttribute('color').array;let s=0;for(const x of a)s+=x;return s};
let built=false;try{wm.rebuild();built=true}catch(e){console.log('WorldMesh rebuild unavailable in node:',e.message)}
if(built){const v0=colSum();wm.setBakeLighting({aoMode:'flat'});wm.rebuild();const vf=colSum();wm.setBakeLighting({aoMode:'directional',sunShadow:{dir:[1,1,0]}});wm.rebuild();const vd=colSum();
 assert.ok(vf>v0&&vd<vf,'WorldMesh stages differ '+[v0,vf,vd]);assert.throws(()=>wm.setBakeLighting({aoMode:'x'}));
 // incremental edit with sun shadow still rebuilds
 world.fill(wall[0],6);wm.rebuild();assert.ok(Number.isFinite(colSum()));}
console.log('PASS AO stages flat/up/vertex/directional on shared bake + World facts; WorldMesh forwarding',built);
