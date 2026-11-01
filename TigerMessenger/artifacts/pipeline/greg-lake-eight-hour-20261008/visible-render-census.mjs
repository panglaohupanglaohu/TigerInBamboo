import * as THREE from 'three';
// CPU geometry tests still await the real anatomy + target integration. The
// image shim completes texture readiness; it is not a rendered-image assertion.
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');

import fs from 'node:fs';
const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;
await inner.userData.tiger.userData.swampTigerV2Ready;
const stats=[];let total=0;
for(const child of inner.children){let draws=0,triangles=0,meshes=0;
child.traverseVisible(n=>{if(!(n.isMesh||n.isLine||n.isSprite)||!n.geometry)return;meshes++;const g=n.geometry,mats=Array.isArray(n.material)?n.material:[n.material];draws+=Array.isArray(n.material)?g.groups.filter(x=>mats[x.materialIndex]?.visible!==false).length:(n.material?.visible===false?0:1);if(n.isMesh)triangles+=(g.index?.count||g.attributes.position?.count||0)/3*(n.isInstancedMesh?n.count:1);});
if(draws){total+=draws;stats.push({name:child.name||child.type,draws,meshes,triangles:Math.round(triangles)});}}
const report={note:'CPU visible source render-batch census, no camera frustum or GPU performance assertion',totalBatches:total,branches:stats.sort((a,b)=>b.draws-a.draws)};
fs.writeFileSync(new URL('./visible-render-census.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({total,largest:report.branches.slice(0,14)}));
