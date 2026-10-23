import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createWarshipV6}=await import('../../src/assets/warshipV6.js');
const old=createWarshipV6(),fresh=createWarshipV6({crewStyle:'swamp-coral'});
const oa=old.userData.warshipV6,na=fresh.userData.warshipV6;
function compareRig(){
 assert.equal(oa.nodes.size,na.nodes.size);
 for(const [id,a] of oa.nodes){const b=na.nodes.get(id);assert.ok(b,id);assert.deepEqual(b.position.toArray(),a.position.toArray(),id);assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray(),id);assert.deepEqual(b.scale.toArray(),a.scale.toArray(),id);assert.equal(b.visible,a.visible,id);}
}
test('only explicit swamp style changes rendering; both real 26-slot rigs preserve every transform through rowing and sedation',()=>{
 assert.equal(oa.crewStyle,null);assert.equal(na.crewStyle,'swamp-coral');assert.equal(fresh.userData.crew.userData.rows.length,26);
 for(let i=0;i<121;i++){oa.update(1/60,i<85?1:0);na.update(1/60,i<85?1:0);compareRig();}
 old.userData.crew.userData.rows[4].sedateT=fresh.userData.crew.userData.rows[4].sedateT=1.2;
 for(let i=0;i<40;i++){oa.update(.025,1);na.update(.025,1);compareRig();assert.equal(fresh.userData.oarImbalance,old.userData.oarImbalance);}
 for(const api of [oa,na]){api.bindCrewIdentity(8,{uid:'original-rower-8'});api.setCrewEmbarked(8,false);api.update(.025,1);}compareRig();
 assert.equal(na.crewStatus()[8].identity.uid,'original-rower-8');assert.equal(na.crewStatus()[8].embarked,false);
});
test('hands retain real grip geometry and all original ship/oar static meshes; fewer instanced batches replace feather layers',()=>{
 const before=old.getObjectByName('blender-v6-render'),after=fresh.getObjectByName('blender-v6-render');
 const statics=x=>x.children.filter(m=>!m.isInstancedMesh);
 assert.equal(statics(before).length,statics(after).length);
 for(let i=0;i<statics(before).length;i++)assert.deepEqual(statics(after)[i].geometry.attributes.position.array,statics(before)[i].geometry.attributes.position.array);
 const grip=after.children.filter(m=>m.material.name==='swamp-rower-original-grip');assert.ok(grip.length>0);
 for(const mesh of grip)assert.ok(before.children.some(m=>m.geometry===mesh.geometry),'hands and forearms must use exact original geometry cache');
 const robes=after.children.filter(m=>m.material.name==='swamp-rower-fine-cloth');assert.equal(robes.length,6);
 assert.ok(robes.every(m=>m.isInstancedMesh&&m.count>=26));assert.ok(na.batches<oa.batches);
 console.log('real boat render batches',JSON.stringify({before:oa.batches,after:na.batches,robeBatches:robes.length,gripBatches:grip.length,static:na.staticDraws}));
 for(const mesh of robes){const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;assert.ok([...p.array].every(Number.isFinite));assert.ok(c);assert.equal(mesh.material.side,THREE.FrontSide);}
});
test('real lake keeps two working boats with 52 same crew slots and no style change to unrelated ships',async()=>{
 const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
 const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5}).userData.inner;
 const boats=['swamp-warship-repair','swamp-warship-depart'].map(name=>swamp.getObjectByName(name));
 assert.equal(boats.reduce((n,b)=>n+b.userData.crew.userData.rows.length,0),52);
 for(const b of boats)assert.equal(b.userData.warshipV6.crewStyle,'swamp-coral');
 assert.equal(createWarshipV6().userData.warshipV6.crewStyle,null);
});
