import * as T from 'three';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.updateMatrixWorld(true);

const inverse=inner.matrixWorld.clone().invert();
inner.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;const mat=inverse.clone().multiply(o.matrixWorld);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(mat);if(b.min.y<35&&b.max.y>25&&b.max.x>0&&b.max.z>0)console.log(o.name,`PARENT=${o.parent?.name}/${o.parent?.parent?.name}`,JSON.stringify(o.userData).slice(0,120),b.min.toArray(),b.max.toArray());});
