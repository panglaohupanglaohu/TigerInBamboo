import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');



const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=swamp.userData.inner;installSwampHarborScene({swamp,departure:'original',workerScale:1});swamp.userData.update(.05,6,{});swamp.updateMatrixWorld(true);
function stats(root){let meshes=0,outline=0,tris=0,outlineTris=0,visible=0;const mat=new Map(),geo=new Map();root.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry,n=(g.index?.count||g.attributes.position?.count||0)/3*(o.isInstancedMesh?o.count:1);const v=(()=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return Array.isArray(o.material)?o.material.some(m=>m.visible):o.material.visible;})();if(v){visible++;tris+=n;if(o.userData.isOutline){outline++;outlineTris+=n;}const key=o.material?.uuid||'array';mat.set(key,(mat.get(key)||0)+1);geo.set(g.uuid,(geo.get(g.uuid)||0)+1);}});return {name:root.name,meshes,visible,outline,tris,outlineTris,topMaterialCounts:[...mat.values()].sort((a,b)=>b-a).slice(0,12),topGeometryCounts:[...geo.values()].sort((a,b)=>b-a).slice(0,12)};}
const meshNames={};inner.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;if(!o.material?.visible)return;const name=o.name||'(unnamed)';const r=meshNames[name]||(meshNames[name]={name,count:0,tris:0});r.count++;r.tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
const {createFisherBoat}=await import('../../src/assets/harbor.js');const classic=createFisherBoat(),coral=createFisherBoat({crewStyle:'swamp-coral'});
const branchCandidates=(inner.userData.towerTrees||[]).filter(t=>t.name==='swamp-towering-tree').map(tree=>{const groups=new Map();tree.traverse(o=>{if(o.name!=='v2-curved-rim-branch'||!o.visible||!o.material.visible)return;const m=o.material,key=[m.type,m.color?.getHex(),m.side,m.transparent,m.vertexColors,m.customProgramCacheKey(),o.castShadow,o.receiveShadow,o.layers.mask,o.renderOrder].join(':');if(!groups.has(key))groups.set(key,{count:0,tris:0});const r=groups.get(key);r.count++;r.tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return {tree:tree.uuid,groups:[...groups.values()],source:[...groups.values()].reduce((a,r)=>a+r.count,0),renderGroups:groups.size};});
console.log(JSON.stringify({branchCandidates,note:'CPU scene-graph counts, not camera-visible draw calls or GPU cost; original factories, update time6s.',swamp:stats(inner),meshNames:Object.values(meshNames).sort((a,b)=>b.count-a.count).slice(0,40),topChildren:inner.children.map(stats).filter(r=>r.visible).sort((a,b)=>b.visible-a.visible).slice(0,30),classicBoat:stats(classic),coralBoat:stats(coral)},null,2));
