import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?swampV2=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const {applySwampV2Art}=await import('../../src/world/swampV2Art.js');
const root=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=root.userData.inner;
const palms=inner.userData.towerTrees.filter(t=>t.name==='swamp-rim-palm');
const leaves=palms.flatMap(t=>t.children.filter(n=>n.userData.swampTreePart==='palm-leaf')).map(n=>({n,type:n.geometry.type,position:n.geometry.attributes.position.array.slice(),matrix:(n.updateMatrix(),n.matrix.clone())}));
// Deliberately change child order: semantic conversion must not depend on index.
for(const tree of inner.userData.towerTrees)tree.children.reverse();
const actors=[inner.userData.tiger,inner.userData.shipyard.dock,inner.userData.shipyard.escort].map(n=>({n,p:n.position.clone(),update:n.userData.update}));
globalThis.location.search='';applySwampV2Art(inner);

test('actual factory palms retain every leaf and transform through V2 even if children reorder',()=>{
 assert.equal(palms.length,2);assert.equal(leaves.length,14);
 for(const {n,type,position,matrix}of leaves){assert.equal(n.geometry.type,type);assert.deepEqual(n.geometry.attributes.position.array,position);n.updateMatrix();assert.ok(n.matrix.equals(matrix));assert.ok(n.children.filter(o=>o.userData.isOutline).every(o=>!o.visible));}
 for(const palm of palms){assert.equal(palm.children.filter(n=>n.userData.swampTreePart==='palm-trunk').length,1);assert.equal(palm.children.filter(n=>n.name==='v2-rim-bowed-root').length,0);assert.equal(palm.children.filter(n=>n.isInstancedMesh).length,0);}
});
test('true towering trees retain six semantic trunk and root parts without converting branches by index',()=>{
 for(const tree of inner.userData.towerTrees.filter(t=>t.name==='swamp-towering-tree')){
  const trunks=tree.children.filter(n=>n.userData.swampTreePart==='trunk'),roots=tree.children.filter(n=>n.userData.swampTreePart==='root');
  assert.equal(trunks.length,6);assert.equal(roots.length,6);
  assert.ok(trunks.every(n=>n.geometry.type==='CylinderGeometry'&&n.material.name==='greg-lake-bark'));
  assert.ok(roots.every(n=>n.name==='v2-rim-bowed-root'&&n.geometry.type==='TubeGeometry'));
  assert.ok(tree.children.filter(n=>n.userData.swampTreePart==='branch').every(n=>n.name==='v2-curved-rim-branch'));
 }
});
test('palette and tree reconstruction preserve tiger, dock and escort identity',()=>{
 for(const {n,p,update}of actors){assert.ok(n.position.equals(p));assert.equal(n.userData.update,update);}
 assert.equal(inner.userData.gregEcology.records.length,66);
 assert.equal(inner.userData.gregLakeVisuals.version,3);
 assert.ok(inner.userData.gregLakeVisuals.planeValueMeshes>0);
 const water=inner.getObjectByName('swamp-underground-waterline');assert.ok(water.children.filter(n=>n.userData.isOutline).every(n=>!n.visible));
});
