// lighting.js remainder: voxel soft-normal write-back + layered field texture for vertex-shader sampling.
import assert from 'node:assert/strict';
import {generateModulePatch} from '../src/core/module-patch.js';import {World} from '../src/core/world.js';
import {bakeLighting} from '../src/light/bake.js';
import {bakeVoxelSoftNormals,packLayeredField,sampleLayeredTexture,LAYERED_FIELD_GLSL} from '../src/light/voxel-field.js';
const vertices=[],faces=[];for(let x=0;x<=8;x++)for(let z=0;z<=8;z++)vertices.push([x,z]);for(let x=0;x<8;x++)for(let z=0;z<8;z++){const a=x*9+z;faces.push([a,a+9,a+10,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g);world.cells.forEach(c=>world.fill(c,c.cx<4?3:1,{rock:true}));
const L=.5,colorOf=(c,lv)=>lv>1?{r:.9,g:.3,b:.2}:{r:.3,g:.7,b:.3};
// mesh: a vertex on the cliff top edge (x=4,y=1.5) with an up normal, one on the open plateau, one on the cliff wall facing +x
const pos=[4,1.5,4, 2,1.5,4, 4,1,4, 6,.5,4],nrm=[0,1,0, 0,1,0, 1,0,0, 0,1,0];
const r=bakeLighting({pos:[...pos],col:new Array(12).fill(1)},world,{L,colorOf,keepField:true});
const m={pos,nrm:[...nrm]};const s=bakeVoxelSoftNormals(m,r.field,{blend:.55});
assert.ok(s.touched>=1);
assert.ok(m.nrm[0]>.15&&m.nrm[1]<1,'edge normal leans outward (+x) over the cliff lip: '+m.nrm.slice(0,3).map(v=>v.toFixed(2)));
assert.ok(Math.abs(m.nrm[3])<1e-6&&Math.abs(m.nrm[4]-1)<1e-6,'flat plateau interior untouched');
for(let i=0;i<m.nrm.length;i+=3)assert.ok(Math.abs(Math.hypot(m.nrm[i],m.nrm[i+1],m.nrm[i+2])-1)<1e-6);
assert.deepEqual(m.pos,pos,'positions never move');
// blend 0 = no change
const m0={pos,nrm:[...nrm]};bakeVoxelSoftNormals(m0,r.field,{blend:0});assert.deepEqual(m0.nrm,nrm);
// GPU path: packed texture + shader-mirror sampling == CPU sampler used by bakeLighting
const pack=packLayeredField(r.field);assert.equal(pack.height,r.field.H*r.field.layers);assert.equal(pack.data.length,pack.width*pack.height*4);
let maxErr=0;for(const p of [[4.1,1.3,4.2],[3.3,.7,2.2],[5.05,.6,6.6],[1,2.6,1],[4,1.6,4]]){const a=r.field.sampleOcc(...p),b=sampleLayeredTexture(pack,...p)[0];maxErr=Math.max(maxErr,Math.abs(a-b))}
assert.ok(maxErr<1e-6,'shader mirror matches CPU sampler '+maxErr);
assert.ok(sampleLayeredTexture(pack,3.9,.9,4)[1]>0,'bounce colour channel carried');
assert.ok(/vec4 sampleField\(vec3 p\)/.test(LAYERED_FIELD_GLSL));
assert.throws(()=>bakeVoxelSoftNormals(m,{}));
console.log('PASS voxel soft normals write-back (edge',m.nrm.slice(0,3).map(v=>v.toFixed(2)).join(','),') and layered texture parity',maxErr);
