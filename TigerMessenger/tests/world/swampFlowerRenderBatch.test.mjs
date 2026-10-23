import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
test('production petal batches keep all original vertex attributes and follow original animated flower transforms',()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,report=inner.userData.flowerRenderBatch;
 assert.equal(report.records.length,5);assert.equal(report.drawsSaved,30);
 for(const r of report.records){let offset=0;for(const petal of r.petals){assert.equal(petal.visible,false);const source=petal.geometry.toNonIndexed();
 for(const [key,a] of Object.entries(source.attributes)){const merged=r.mesh.geometry.attributes[key];assert.deepEqual(Array.from(merged.array.slice(offset*a.itemSize,(offset+a.count)*a.itemSize)),Array.from(a.array));}offset+=source.attributes.position.count;source.dispose();}
 assert.equal(r.mesh.material,r.petals[0].material);assert.equal(r.mesh.parent,r.flower);assert.ok(r.flower.userData.core.visible);}
 for(const t of [0,8,20,30,60]){root.userData.update(.02,t,{});root.updateMatrixWorld(true);for(const r of report.records){assert.deepEqual(r.mesh.matrixWorld.elements,r.flower.matrixWorld.elements);assert.equal(r.flower.userData.core.parent,r.flower);}}
});
