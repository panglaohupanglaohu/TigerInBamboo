import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregUnderstory=0&gregTrunkDetail=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../../src/world/moebiusSwamp.js');
const {installSwampCoralUnderstory}=await import('../../../src/world/swampCoralUnderstory.js');
const {installSwampCoralTrunkDetail}=await import('../../../src/world/swampCoralTrunkDetail.js');
const {createSwampLivingPathConstraints}=await import('../../../src/world/swampGregLivingPaths.js');
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner,route=structuredClone(inner.userData.gregSpatialPlan.route),protectedParts=[];
inner.traverse(o=>{if(/whale|monkey|tiger|flower|v2-floor-root/.test(o.name))protectedParts.push({o,geometry:o.geometry,position:o.position.toArray(),scale:o.scale.toArray()});});
const bark=installSwampCoralTrunkDetail(inner,{enabled:true}),growth=installSwampCoralUnderstory(inner,{enabled:true});

console.log('perchY',inner.userData.gregCoralPerches?.records?.map(r=>r.root[1]));console.log('trunks',bark.records.slice(0,9).map(r=>({name:r.mesh.name,h:r.height,box:r.originalGeometry.boundingBox,world:r.mesh.getWorldPosition(new T.Vector3()).toArray(),parent:r.mesh.parent.name})));
