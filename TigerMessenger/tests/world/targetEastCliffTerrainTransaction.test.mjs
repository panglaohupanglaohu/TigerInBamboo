import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {prepareEastCliffTerrainTransaction} from '../../src/world/citadel/targetEastCliffTerrainTransaction.js';
import {inspectEastCliffSourceEpoch} from '../../src/world/citadel/targetEastCliffRemeshPreview.js';
function fixture(extra=false){
 const castle=new T.Group(),source=new T.Mesh(new T.BoxGeometry(4,2,4),new T.MeshBasicMaterial({side:T.DoubleSide}));source.name='citadel-oskar-grid-mountain-surface';source.position.x=-52;castle.add(source);castle.updateMatrixWorld(true);
 const next=new T.BufferGeometry().copy(new T.BoxGeometry(4,6,4)),artifact={sourceHash:inspectEastCliffSourceEpoch({castle,sourceMesh:source}),castleMatrix:castle.matrixWorld.toArray(),origin:[-52,0,0],geometry:next.toJSON()};next.dispose();
 const neighbour=extra?new T.Mesh(new T.BoxGeometry(2,2,2),source.material):null;if(neighbour){neighbour.position.x=20;castle.add(neighbour);castle.updateMatrixWorld(true);}
 const tx=prepareEastCliffTerrainTransaction({enabled:true,castle,sourceMesh:source,surfaces:[source,neighbour].filter(Boolean),artifact});return{castle,source,neighbour,tx};
}
function bindings(events,fail){return Object.fromEntries(['navigation','vegetation','foundations','clouds'].map(id=>[id,()=>({commit(){events.push('commit:'+id);if(id===fail)throw new Error('consumer rejected');},rollback(){events.push('rollback:'+id);}})]));}
test('disabled preparation never reads the scene',()=>{assert.equal(prepareEastCliffTerrainTransaction({get castle(){throw Error('read');}}).report.applied,false);});
test('keeps source identity and material; fresh index hits the prepared surface, rollback releases only owned geometry',()=>{
 const {source,tx}=fixture(),old=source.geometry,material=source.material,events=[];let oldDisposed=0,materialDisposed=0,newDisposed=0;old.addEventListener('dispose',()=>oldDisposed++);material.addEventListener('dispose',()=>materialDisposed++);tx.geometry.addEventListener('dispose',()=>newDisposed++);
 assert.equal(source.geometry,old);assert.throws(()=>tx.apply(),/bindings required/);
 const hit=tx.surfaceIndex.sample(new T.Ray(new T.Vector3(-52,10,0),new T.Vector3(0,-1,0)),0,30);assert.equal(hit.object,source);assert.ok(Math.abs(hit.point.y-3)<1e-6);
 assert.equal(tx.surfaceIndex.sample(new T.Ray(new T.Vector3(-52,10,0),new T.Vector3(0,-1,0)),0,30,h=>h.object===source)?.object,source);
 tx.apply({consumers:bindings(events)});assert.equal(source.geometry,tx.geometry);assert.equal(source.material,material);assert.equal(source.visible,true);assert.deepEqual(events,['commit:foundations','commit:clouds','commit:vegetation','commit:navigation']);
 tx.dispose();assert.equal(source.geometry,old);assert.equal(newDisposed,1);assert.equal(oldDisposed,0);assert.equal(materialDisposed,0);assert.throws(()=>tx.surfaceIndex.sample(new T.Ray()),/disposed/);assert.equal(events.filter(x=>x.startsWith('rollback')).length,4);
 old.dispose();material.dispose();
});
test('consumer failure atomically restores geometry and all prepared bindings',()=>{
 const {source,tx}=fixture(),old=source.geometry,events=[];assert.throws(()=>tx.apply({consumers:bindings(events,'foundations')}),/consumer rejected/);assert.equal(source.geometry,old);assert.equal(tx.report.applied,false);assert.deepEqual(events.filter(x=>x.startsWith('rollback')),['rollback:navigation','rollback:vegetation','rollback:clouds','rollback:foundations']);tx.dispose();old.dispose();source.material.dispose();
});
test('source edits after prepare reject installation instead of certifying stale geometry',()=>{
 const {source,tx}=fixture(),old=source.geometry;old.attributes.position.needsUpdate=true;assert.throws(()=>tx.apply({consumers:bindings([])}),/changed after preparation/);assert.equal(source.geometry,old);tx.dispose();old.dispose();source.material.dispose();
});
test('editing a different indexed support surface invalidates the shared installed index',()=>{
 const {source,neighbour,tx}=fixture(true);tx.apply({consumers:bindings([])});neighbour.geometry.index.needsUpdate=true;assert.throws(()=>tx.surfaceIndex.sample(new T.Ray()),/rebuild dependent index/);tx.dispose();source.geometry.dispose();neighbour.geometry.dispose();source.material.dispose();
});
