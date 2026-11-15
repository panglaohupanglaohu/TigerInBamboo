// 1305951750638231552 three-pass penumbra: mean big-voxel pooling, terrain receivers, width metric, and 3D voxel receivers.
import assert from 'node:assert/strict';
import {coarsenHeights,threeShadow,penumbraStats,distToMask,castHeightShadow} from '../src/core/penumbra.js';
import {generateModulePatch} from '../src/core/module-patch.js';import {World} from '../src/core/world.js';import {buildCellIndex} from '../src/core/spatial.js';
import {bakeWaterPenumbra,bakeVoxelPenumbra} from '../src/light/penumbra.js';
// mean vs max pooling: a single thin tower — max pooling inflates the big pass (REACode: "不能用 max-pool")
const field={nx:60,nz:40,res:.2,heights:new Float32Array(2400)};for(let z=18;z<21;z++)for(let x=30;x<32;x++)field.heights[z*60+x]=2;
const S=[.8,.6,.2],mx=threeShadow(field,S,{pool:'max'}),mean=threeShadow(field,S,{pool:'mean'});
const sum=a=>a.reduce((s,v)=>s+v,0);assert.ok(sum(mean.big)<sum(mx.big),'mean pooling gives a tighter big-voxel pass');
const sMax=penumbraStats(field,mx),sMean=penumbraStats(field,mean);assert.ok(sMean.band<=sMax.band,'narrower band '+sMean.band+' vs '+sMax.band);
assert.equal(Math.max(...coarsenHeights(field,3,{pool:'mean'}).heights)<2,true);assert.throws(()=>coarsenHeights(field,3,{pool:'min'}));
// width metric in world units scales with res
const d=distToMask(Uint8Array.from([1,0,0,0]),4,1);assert.deepEqual([...d],[0,1,2,3]);
const scaled=threeShadow({...field,res:2,heights:Float32Array.from(field.heights,h=>h*10)},S,{pull:1.8});
assert.ok(Math.abs(penumbraStats({...field,res:2},scaled).bandWidth-10*penumbraStats(field,threeShadow(field,S)).bandWidth)<1e-6);
// terrain receivers: low step next to a tall block is shadowed, the tall top itself is not
const terr={nx:20,nz:5,res:.5,heights:new Float32Array(100).fill(.5)};for(let z=0;z<5;z++)for(let x=10;x<14;x++)terr.heights[z*20+x]=3;
const self=castHeightShadow(terr,[1,.8,0],{receiver:terr.heights});assert.equal(self[2*20+9],1);assert.equal(self[2*20+11],0);assert.equal(self[2*20+15],0);
const onT=threeShadow(terr,[1,.8,0],{onTerrain:true});assert.ok(onT.alpha[2*20+9]>.5&&onT.alpha[2*20+12]===0);
// shared World: water layer path + voxel receivers under an overhang
const vertices=[],faces=[];for(let x=0;x<=8;x++)for(let z=0;z<=6;z++)vertices.push([x,z]);for(let x=0;x<8;x++)for(let z=0;z<6;z++){const a=x*7+z;faces.push([a,a+7,a+8,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g),index=buildCellIndex(g);world.cells.forEach(c=>world.fill(c,1,{rock:true}));
const bridge=world.cells.filter(c=>c.cx>3&&c.cx<6&&c.cz>2&&c.cz<4);for(const c of bridge)world.setSolid(c,4,true);
const sun=[.15,1,.1];
const vox=bakeVoxelPenumbra(world,index,sun,{L:.5,res:.25});
assert.ok(vox.stats.multiReceiverColumns>0,'overhang columns have two receivers');
const under=vox.sampleAt(4.5,.6,3.5),onTop=vox.sampleAt(4.5,2.2,3.5),open=vox.sampleAt(1.5,.6,1.5);
assert.ok(under>.5,'ground under the slab is in shadow '+under);assert.equal(onTop,0);assert.equal(open,0);
// the 2.5D field cannot express it: the slab column is one height (top) and its top receives no shadow
const flat=bakeWaterPenumbra(world,index,sun,{L:.5,res:.25,onTerrain:true});const k=Math.floor((3.5-flat.minZ)/flat.res)*flat.nx+Math.floor((4.5-flat.minX)/flat.res);assert.equal(flat.alpha[k],0);
// pulled/big passes produce partial values at the slab edge (penumbra), and the result follows edits
assert.ok(vox.receivers.some(r=>r.alpha>0&&r.alpha<weights0()));function weights0(){return .65}
for(const c of bridge)world.setSolid(c,4,false);const v2=bakeVoxelPenumbra(world,index,sun,{L:.5,res:.25});assert.equal(v2.sampleAt(4.5,.6,3.5),0);assert.ok(v2.version>vox.version);
assert.throws(()=>bakeVoxelPenumbra(world,index,[1,0,0]));
console.log('PASS mean pooling narrows band',sMax.band,'->',sMean.band,'width(world)',sMean.bandWidth.toFixed(3),'terrain receivers, voxel overhang receivers',vox.stats);
