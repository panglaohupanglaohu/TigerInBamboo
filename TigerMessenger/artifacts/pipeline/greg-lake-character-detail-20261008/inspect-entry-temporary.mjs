import fs from 'node:fs';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');
const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.updateMatrixWorld(true);
for(const [i,step] of inner.userData.tigerWalkSurfaces.entries()) {step.updateMatrix();const p=step.geometry.attributes.position;const y=new Set();for(let j=0;j<p.count;j++)y.add((p.getY(j)+step.position.y).toFixed(3));console.log(i,step.position.toArray(),[...y].sort((a,b)=>b-a));}
for(let r=35.5;r>33;r-=.1){const o=inner.localToWorld(new THREE.Vector3(Math.cos(.5)*r,55,Math.sin(.5)*r));const hit=new THREE.Raycaster(o,new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld)).intersectObjects(inner.userData.tigerWalkSurfaces,false)[0];console.log(r.toFixed(2),hit?inner.worldToLocal(hit.point).y:null);}
