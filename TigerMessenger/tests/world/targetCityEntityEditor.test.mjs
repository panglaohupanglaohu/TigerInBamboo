import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
import {createTargetCityEntityEditor,TARGET_CITY_ENTITY_SCHEMA} from '../../src/world/citadel/targetCityEntityEditor.js';
const options={targetId:'target-city-detail',terrainVersion:'r17',factoryVersion:'old-city-4'};
function fixture(extra={}){const city=createTargetOldCity(),editor=createTargetCityEntityEditor({root:city.group,...options,...extra});return{city,editor,dispose(){editor.dispose();city.dispose();}};}

test('15 stable old-city entities hide only residential groups and restore at the identical transform',()=>{
 const f=fixture(),e=f.editor;assert.equal(e.size,15);assert.equal(e.wfc,false);const id=e.list()[0].id,house=f.city.group.getObjectByName(id),matrix=house.matrix.clone(),support=f.city.group.getObjectByName(id+'-base');
 assert.equal(e.edit({id,occupied:false}).ok,true);assert.equal(house.visible,false);assert.equal(support.visible,true);assert.equal(f.city.group.getObjectByName('tower-shaft').visible,true);assert.equal(e.undo().ok,true);assert.equal(house.visible,true);assert.deepEqual(house.matrix.elements,matrix.elements);assert.equal(e.redo().ok,true);assert.equal(house.visible,false);assert.equal(e.edit({id,occupied:true}).ok,true);assert.equal(house.visible,true);assert.equal(e.history.redo,0);
 for(const patch of[{id:'tower-shaft',occupied:false},{id,scale:2},{id,occupied:'false'},{id,wallColor:'#abc'},{id,wallColor:'red'},{id,wallColor:'#12345678'}])assert.equal(e.edit(patch).ok,false);f.dispose();
});

test('wall colour is clone-on-write and never mutates or disposes shared source materials',()=>{
 const f=fixture(),id=f.editor.list()[0].id,house=f.city.group.getObjectByName(id),wall=house.getObjectByName(id+'-walls'),original=wall.material,originalColor=original.color.getHexString(),roof=house.getObjectByName(id+'-roof'),roofMaterial=roof.material;let sourceDisposals=0;original.addEventListener('dispose',()=>sourceDisposals++);
 assert.equal(f.editor.edit({id,wallColor:'#A1B2C3'}).ok,true);const clone=wall.material;let cloneDisposals=0;clone.addEventListener('dispose',()=>cloneDisposals++);assert.notEqual(clone,original);assert.equal(clone.color.getHexString(),'a1b2c3');assert.equal(original.color.getHexString(),originalColor);assert.equal(roof.material,roofMaterial);
 f.city.group.traverse(m=>{if(m.isMesh&&m!==wall&&m.material===original)assert.equal(m.material.color.getHexString(),originalColor);});f.editor.undo();assert.equal(wall.material,original);assert.equal(cloneDisposals,1);assert.equal(sourceDisposals,0);f.editor.redo();const finalClone=wall.material;let finalDisposals=0;finalClone.addEventListener('dispose',()=>finalDisposals++);f.editor.dispose();f.editor.dispose();assert.equal(finalDisposals,1);assert.equal(wall.material,original);assert.equal(sourceDisposals,0);f.city.dispose();
});

test('snapshot import validates the complete schema, identity set and versions before atomic application',()=>{
 const f=fixture(),e=f.editor,before=e.exportJSON(),good=e.exportSnapshot();assert.equal(good.schema,TARGET_CITY_ENTITY_SCHEMA);good.entities[0].occupied=false;good.entities[1].wallColor='#112233';
 for(const key of['schema','terrainVersion','targetId','factoryVersion']){const bad=structuredClone(good);bad[key]='wrong';assert.equal(e.importSnapshot(bad).ok,false);assert.equal(e.exportJSON(),before);}
 const unknown=structuredClone(good);unknown.entities.at(-1).id='unknown';assert.equal(e.importSnapshot(unknown).ok,false);assert.equal(e.exportJSON(),before);
 const duplicate=structuredClone(good);duplicate.entities[1].id=duplicate.entities[0].id;assert.equal(e.importSnapshot(duplicate).ok,false);assert.equal(e.history.undo,0);
 assert.equal(e.importSnapshot(JSON.stringify(good)).ok,true);assert.equal(e.history.undo,1);assert.deepEqual(e.exportSnapshot(),good);assert.equal(e.undo().ok,true);assert.equal(e.exportJSON(),before);f.dispose();
});

test('injected constraint rejection keeps scene, colour ownership, snapshots and history unchanged',()=>{
 let accept=true;const f=fixture({validate(next,previous){assert.ok(Object.isFrozen(next.entities[0]));assert.equal(previous.schema,TARGET_CITY_ENTITY_SCHEMA);return accept?{ok:true}:{ok:false,error:'route clearance'};}}),e=f.editor,id=e.list()[0].id;
 e.edit({id,occupied:false});const before=e.exportJSON(),history=e.history;accept=false;const next=e.exportSnapshot();next.entities.forEach(row=>{row.occupied=true;row.wallColor='#123456';});assert.equal(e.importSnapshot(next).error,'route clearance');assert.equal(e.exportJSON(),before);assert.deepEqual(e.history,history);assert.equal(e.undo().ok,false);assert.deepEqual(e.history,history);assert.equal(e.exportJSON(),before);f.dispose();
});

test('nearest visible protected face blocks editing; hidden ancestors and unrendered planes are ignored',()=>{
 const f=fixture(),e=f.editor,id=e.list()[0].id,house=f.city.group.getObjectByName(id),roof=house.getObjectByName(id+'-roof'),protectedMesh=f.city.group.getObjectByName('tower-shaft');
 assert.equal(e.pick([{object:roof,distance:4},{object:protectedMesh,distance:1}]).kind,'protected');assert.equal(e.pick([{object:roof,distance:4}]).id,id);
 const hidden=new T.Group(),legacy=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());hidden.visible=false;hidden.add(legacy);assert.equal(e.pick([{object:legacy,distance:.1},{object:roof,distance:4}]).id,id);
 const invisible=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({transparent:true,opacity:0}));assert.equal(e.pick([{object:invisible,distance:.01},{object:roof,distance:4}]).id,id);
 house.visible=false;assert.equal(e.pick([{object:roof,distance:1},{object:protectedMesh,distance:3}]).kind,'protected');legacy.geometry.dispose();legacy.material.dispose();invisible.geometry.dispose();invisible.material.dispose();f.dispose();
});

test('real ray picking maps a roof to its house and does not bypass a protected mesh',()=>{
 const f=fixture(),h=f.city.report.houses[0],root=f.city.group,ray=new T.Raycaster(new T.Vector3(h.position[0],40,h.position[2]),new T.Vector3(0,-1,0),0,50);
 assert.equal(f.editor.intersectClosestVisible(ray,root).id,h.id);const obstruction=new T.Mesh(new T.BoxGeometry(2,1,2),new T.MeshBasicMaterial());obstruction.position.set(h.position[0],30,h.position[2]);root.add(obstruction);assert.equal(f.editor.intersectClosestVisible(ray,root).kind,'protected');obstruction.removeFromParent();obstruction.geometry.dispose();obstruction.material.dispose();f.dispose();
});

test('history is capped at 100, disposed editor restores source state and rejects edits',()=>{
 const f=fixture(),e=f.editor,id=e.list()[0].id;for(let i=0;i<130;i++)assert.equal(e.edit({id,occupied:i%2===1}).ok,true);assert.equal(e.history.undo,100);e.dispose();assert.equal(e.history.undo,0);assert.equal(e.edit({id,occupied:false}).ok,false);assert.equal(f.city.group.getObjectByName(id).visible,true);assert.equal(e.pick([]),null);f.city.dispose();
});
