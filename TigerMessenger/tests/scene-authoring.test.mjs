import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVersionStore,createSceneRegistry} from '../src/scene-authoring/store.js';
test('immutable experiments and explicit validated final survive reload',()=>{
 let data=null;const storage={getItem:()=>data,setItem:(k,v)=>data=v},s=createVersionStore(storage);
 const a=s.save('morris','manual');assert.throws(()=>s.finalize(a.id));
 const b=s.save('morris','checked','goal',{passed:true});s.finalize(b.id);s.save('morris','new pipeline candidate');
 const state=createVersionStore(storage).read();assert.equal(state.finals.morris,b.id);assert.equal(state.versions[0].data,'manual');
});
test('storage failure is surfaced and duplicate plugins rejected',()=>{
 assert.throws(()=>createVersionStore({getItem:()=>null,setItem(){throw Error('quota');}}).save('morris','x'),/quota/);
 const r=createSceneRegistry();r.register({id:'morris'});assert.throws(()=>r.register({id:'morris'}));
});
import {resolveSceneVersion} from '../src/scene-authoring/store.js';
test('exact runtime version is stable after a new final; missing versions reject',()=>{
 let data;const storage={getItem:()=>data,setItem:(k,v)=>data=v},s=createVersionStore(storage);
 const a=s.save('morris','first','',{passed:true});s.finalize(a.id);
 const b=s.save('morris','second','',{passed:true});s.finalize(b.id);
 assert.equal(resolveSceneVersion(storage,'morris',a.id).data,'first');
 assert.throws(()=>resolveSceneVersion(storage,'apostles',a.id));assert.throws(()=>resolveSceneVersion(storage,'morris','missing'));
});
