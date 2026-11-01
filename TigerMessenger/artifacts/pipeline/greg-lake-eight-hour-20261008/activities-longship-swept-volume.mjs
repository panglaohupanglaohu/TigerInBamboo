import * as T from 'three';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.updateMatrixWorld(true);

import fs from 'node:fs';
import {createSwampActivitySolids} from '../../../src/world/swampActivitySolids.js';
const boat=inner.userData.shipyard.departure,bounds=new T.Box3(),escortBounds=new T.Box3(),inverse=new T.Matrix4(),matrix=new T.Matrix4(),instance=new T.Matrix4();
for(let frame=0;frame<=1560;frame++){
 root.userData.update(1/30,frame/30,{});root.updateMatrixWorld(true);inverse.copy(boat.matrixWorld).invert();
 boat.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==boat;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();matrix.multiplyMatrices(inverse,o.matrixWorld);
  if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);if(Math.abs(instance.determinant())<1e-12)continue;bounds.union(o.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(matrix,instance)));}}
  else bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));
 });
 inner.userData.shipyard.escort.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;o.geometry.computeBoundingBox();escortBounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix.multiplyMatrices(inverse,o.matrixWorld)));});
}
bounds.min.multiplyScalar(2);bounds.max.multiplyScalar(2);bounds.min.y-=.12;bounds.max.y-=.04;bounds.expandByScalar(.3);
escortBounds.min.multiplyScalar(2);escortBounds.max.multiplyScalar(2);escortBounds.min.y-=.12;escortBounds.max.y-=.04;escortBounds.expandByScalar(.3);
const solids=createSwampActivitySolids(inner,25.1+Math.min(bounds.min.y,escortBounds.min.y),25.1+Math.max(bounds.max.y,escortBounds.max.y)),contacts=[];
for(let i=0;i<720;i++){const a=i*Math.PI*2/720,x=9+1.5*Math.cos(a),z=8+2.5*Math.sin(a),yaw=Math.atan2(-2.5*Math.cos(a),-1.5*Math.sin(a));if(!solids.boxesClear(x,z,-yaw,[bounds,escortBounds]))contacts.push({i,a,x,z,yaw});}
const r={method:'All visible mesh/instance local bounds across 52s at30Hz, scaled to actual boat2, bob included; expanded .30 inner. 720 half-degree route angles against clipped real solid triangles. Expansion exceeds combined translation plus orientation displacement between samples (<.18 inner, plus pose-sampling margin). Conservative filled hull/mast/oar box plus separate real escort-whale bounds, no centre-only circles.',bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},escortBounds:{min:escortBounds.min.toArray(),max:escortBounds.max.toArray()},low:solids.low,high:solids.high,polygons:solids.polygons.length,samples:720,contacts};fs.writeFileSync(new URL('activities-longship-swept-volume.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
