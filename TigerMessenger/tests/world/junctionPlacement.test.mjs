import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {installEditableJunction,junctionRegionDefaults,JUNCTION_EDIT_KEY} from '../../src/world/canalJunctionEditable.js';
import {createCitadelSceneEdit} from '../../src/ui/citadelSceneEdit.js';

function fixture(saved){const memory=new Map(saved?[[JUNCTION_EDIT_KEY,JSON.stringify(saved)]]:[]),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},city=new T.Group();installEditableJunction(city,{storage});city.updateMatrixWorld(true);return{city,e:city.userData.junctionEditor,memory,storage};}
const down=(city,x,z)=>new T.Raycaster(city.localToWorld(new T.Vector3(x,65,z)),new T.Vector3(0,-1,0).transformDirection(city.matrixWorld));

test('actual empty court and quay become buildable, real steps and unsupported sea stay excluded',()=>{
 const{city,e,memory}=fixture();
 for(const[x,z,id]of[[4,0,'build-court'],[6,10,'build-quay'],[-6,10,'build-quay']]){const hit=e.pick(down(city,x,z));assert.equal(hit?.regionId,id);assert.equal(hit.empty,true);const target=e.placementTarget(hit,'place','3');assert.ok(e.edit(target,'place','3').ok);assert.equal(e.pick(down(city,x,z)).char,'3');assert.ok(e.audit().regions.find(r=>r.regionId===id).ok);}
 assert.equal(e.pick(down(city,0,6)),null,'public staircase is not an empty building pad');assert.equal(e.pick(down(city,25,25)),null);assert.equal(memory.size,0);e.dispose();
});
test('same-colour side grows past original plot without shifting old cells; new roof remains pickable',()=>{
 const{city,e}=fixture(),r=junctionRegionDefaults()[0],before=e.cellWorld({regionId:r.id,ix:1,iy:0,iz:1});
 const hit={regionId:r.id,ix:2,iy:0,iz:1,char:'D',side:[1,0],top:false};const target=e.placementTarget(hit,'place','D');assert.equal(target.ix,3);assert.ok(e.edit(target,'place','D').ok);
 assert.ok(before.equals(e.cellWorld({regionId:r.id,ix:1,iy:0,iz:1})));const p=e.cellWorld(target),picked=e.pick(down(city,p.x,p.z));assert.equal(picked.ix,3);assert.equal(picked.char,'D');assert.ok(picked.top);
 const above=e.placementTarget(picked,'place','D');assert.equal(above.iy,1);assert.ok(e.edit(above,'place','D').ok);assert.ok(e.audit().regions.find(r=>r.regionId===hit.regionId).ok);
 const paint=e.placementTarget(hit,'place','3');assert.equal(paint.ix,2);assert.ok(e.edit(paint,'place','3').ok);e.dispose();
});
test('erasing last new unit still picks its real floor, and undo redo save preserve old and new edits',()=>{
 const f=fixture(),{city,e}=f,hit=e.pick(down(city,4,0));assert.ok(e.edit(hit,'place','3').ok);const built=e.snapshot();assert.ok(e.edit(hit,'erase').ok);assert.ok(e.pick(down(city,4,0)).empty);
 assert.ok(e.undo());assert.deepEqual(e.snapshot(),built);assert.ok(e.redo());assert.ok(e.pick(down(city,4,0)).empty);assert.ok(e.edit(hit,'place','C').ok);
 const r=junctionRegionDefaults()[0],ext={regionId:r.id,ix:3,iy:0,iz:1};assert.ok(e.edit(ext,'place','D').ok);e.save();const c2=new T.Group();installEditableJunction(c2,{storage:f.storage});assert.deepEqual(c2.userData.junctionEditor.snapshot(),e.snapshot());c2.userData.junctionEditor.dispose();e.dispose();
});
test('existing eleven-region save migrates without resetting deleted cells or writing storage',()=>{
 const original=junctionRegionDefaults().map(({id,levels})=>({id,levels}));original[0].levels[0][1]='...';const saved={schema:'junction-regions-v1',regions:original};const{e,memory}=fixture(saved);
 assert.deepEqual(e.snapshot().regions.filter(r=>!r.id.startsWith('build-')),original);assert.equal(memory.get(JUNCTION_EDIT_KEY),JSON.stringify(saved));e.dispose();
});
test('spherical city transform preserves actual foundation admission and roof picking',()=>{
 const{city,e}=fixture();city.position.set(23,147,-18);city.rotation.set(.4,.8,-.6);city.updateMatrixWorld(true);const hit=e.pick(down(city,4,0));assert.ok(hit?.empty);assert.ok(e.edit(hit,'place','3').ok);assert.equal(e.pick(down(city,4,0)).char,'3');e.dispose();
});
test('real pointer handlers show a placement ghost, add, stack, erase, and rebuild after last deletion',()=>{
 // Aim at the snapped cell centre. x=4 lies on its left grid boundary:
 // the first roof fence covers it, but the rebuilt pitched roof does not.
 const{city,e}=fixture(),scene=new T.Scene();scene.add(city);const camera=new T.OrthographicCamera(-10,10,10,-10,.1,150);camera.position.set(4.8,65,0);camera.up.set(0,0,-1);camera.lookAt(4.8,0,0);camera.updateMatrixWorld(true);
 const handlers=new Map(),dom={addEventListener:(name,fn)=>handlers.set(name,fn),getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};const edits=[];
 const panel={isOpen:()=>true,getState:()=>({activeChar:'3'}),applyJunctionEdit:(c,m)=>{const result=e.edit(c,m,'3');edits.push({c,m,result});return result;}};
 createCitadelSceneEdit({dom,camera,scene,getCitadel:()=>city,panel,canEdit:()=>true,isUiEvent:()=>false});
 const event={clientX:50,clientY:50,button:0};handlers.get('pointermove')(event);assert.equal(scene.getObjectByName('citadel-edit-ghost').visible,true);
 const click=button=>{const ev={...event,button};handlers.get('pointerdown')(ev);handlers.get('pointerup')(ev);};
 click(0);click(0);assert.equal(edits[1].c.iy,1);click(2);click(2);click(0);assert.ok(edits.every(e=>e.result.ok));assert.equal(edits.at(-1).c.iy,0,JSON.stringify(edits));e.dispose();
});
