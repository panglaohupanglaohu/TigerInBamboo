import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {installEditableJunction} from '../../src/world/canalJunctionEditable.js';
import {buildCitadelTownAssembly} from '../../src/world/odysseyCitadel.js';
const created=new Map(),disposed=new Set(),sharedTextures=new Set();let sharedTextureDisposals=0;
function watch(x,type){if(!x||created.has(x.uuid))return;created.set(x.uuid,type);x.addEventListener('dispose',()=>disposed.add(x.uuid));}
const city=new THREE.Group();installEditableJunction(city,{storage:{getItem:()=>null},build:(...args)=>{
 const town=buildCitadelTownAssembly(...args);watch(town.gradientMap,'owned-gradient');watch(town.ctx.townWaterMat,'owned-water');
 town.group.traverse(o=>{if(o.geometry)watch(o.geometry,'geometry');for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){if(!m.userData?.shared)watch(m,'material');for(const value of Object.values(m))if(value?.isTexture&&value!==town.gradientMap&&!sharedTextures.has(value)){sharedTextures.add(value);value.addEventListener('dispose',()=>sharedTextureDisposals++);}}});return town;
}});
const api=city.userData.junctionEditor,cell={regionId:'left-front-coral',ix:1,iy:2,iz:0};
function liveCounts(){const by={};for(const [id,type]of created)if(!disposed.has(id))by[type]=(by[type]||0)+1;return by;}
const baseline=liveCounts(),meshCount=()=>{let n=0;api.root.traverse(o=>n+=!!o.isMesh);return n;},initialMeshes=meshCount();
for(let i=0;i<30;i++){assert(api.edit(cell,'erase').ok);assert(api.undo());assert.equal(meshCount(),initialMeshes);assert.deepEqual(liveCounts(),baseline,`retained resource count changed on cycle ${i}`);}
assert.equal(sharedTextureDisposals,0);api.dispose();assert.deepEqual(liveCounts(),{});assert.equal(sharedTextureDisposals,0);
console.log(JSON.stringify({ok:true,cycles:30,rebuilds:60,initialMeshes,baseline,resourcesCreated:created.size,resourcesDisposed:disposed.size,sharedTextures:sharedTextures.size,sharedTextureDisposals,limitation:'CPU resource/dispose event audit, not rendered GPU memory or frame-time benchmark'}));
