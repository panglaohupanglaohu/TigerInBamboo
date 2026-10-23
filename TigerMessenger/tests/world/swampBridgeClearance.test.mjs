import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampBridgeClearance} from '../../src/world/swampBridgeClearance.js';
function fixture(){
 const scene=new T.Scene(),swamp=new T.Group(),inner=new T.Group();swamp.add(inner);swamp.userData.inner=inner;swamp.scale.setScalar(.5);swamp.position.set(20,150,-40);swamp.rotation.set(.2,.8,-.3);scene.add(swamp);scene.updateMatrixWorld(true);
 const batch=(centres,gate=false)=>{const p=[],n=[],c=[];for(const [x,z] of centres){const g=new T.BoxGeometry(gate?5:1.1,84,gate?2.6:1.1).toNonIndexed();g.translate(x,47,z);g.applyMatrix4(inner.matrixWorld);p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);for(let i=0;i<36;i++)c.push(.25,.22,.20);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));return g;};
 const trams=new T.Group();trams.name='tram-static-sector';scene.add(trams);const piers=new T.Mesh(batch(Array.from({length:27},(_,i)=>[-52+i*4,-10])),new T.MeshBasicMaterial());piers.userData.materialSourceNames=['tram-static-pier'];trams.add(piers);
 const ink=new T.Mesh(piers.geometry.clone(),new T.MeshBasicMaterial({side:T.BackSide}));ink.userData.isOutline=true;trams.add(ink);
 const gate=new T.Mesh(batch([[20,-10],[0,-10],[48,-10]],true),new T.MeshStandardMaterial({vertexColors:true}));gate.name='gate-site-GateSite_stone-solid';scene.add(gate);
 const deck=new T.Mesh(new T.BoxGeometry(100,1,9),new T.MeshBasicMaterial());deck.name='unchanged-bridge-deck';scene.add(deck);
 return{scene,swamp,inner,piers,ink,gate,deck};
}
test('only intruding pier components change; high arch joins retained banks and rollback is exact',()=>{
 const f=fixture(),nodes=[f.piers,f.ink,f.gate,f.deck],original=nodes.map(o=>o.geometry),report=installSwampBridgeClearance(f.scene,f.swamp);
 assert.equal(report.ok,true);assert.equal(report.removedGatePiers,2);assert.ok(report.removedGenericPiers>10);assert.ok(report.retainedPiers>=4);assert.ok(report.spanWorld>30&&report.spanWorld<45);assert.ok(report.bankClearanceWorld>15);assert.equal(report.deckAndRoutesChanged,false);assert.equal(f.deck.geometry,original[3]);
 assert.equal(f.piers.geometry.attributes.position.count,f.ink.geometry.attributes.position.count);assert.equal(f.gate.geometry.attributes.position.count,36);assert.equal(installSwampBridgeClearance(f.scene,f.swamp),report);
 const arch=f.inner.getObjectByName('greg-lake-high-bridge-bearing-arches'),p=arch.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));for(let i=0;i<p.count;i+=3)assert.ok(new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j))).getArea()>1e-8);
 report.dispose();nodes.forEach((o,i)=>assert.equal(o.geometry,original[i]));assert.equal(f.inner.getObjectByName(arch.name),undefined);
});
test('disabled patch and an unproven one-sided support span leave all geometry unchanged',()=>{
 const f=fixture(),original=f.piers.geometry;assert.equal(installSwampBridgeClearance(f.scene,f.swamp,{enabled:false}),null);assert.equal(f.piers.geometry,original);
 f.piers.userData.materialSourceNames=['story-tower'];const report=installSwampBridgeClearance(f.scene,f.swamp);assert.equal(report.ok,false);assert.equal(f.piers.geometry,original);assert.equal(f.inner.children.length,0);
});
