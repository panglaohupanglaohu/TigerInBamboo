import * as T from 'three';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.updateMatrixWorld(true);


const b=inner.userData.lotuses[2],inv=b.matrixWorld.clone().invert();b.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld));console.log(o.name,box.min.toArray(),box.max.toArray());});
