import vm from 'node:vm';
import {validateTargetOldCityRoofRoles,solveTargetOldCityRoofWfc} from '../../src/world/citadel/targetOldCityRoofWfc.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
import {createTargetOldCityRoofSession,TARGET_OLD_CITY_ROOF_SESSION_SCHEMA} from '../../src/world/citadel/targetOldCityRoofSession.js';

const targetId='approved-target-v3',terrainVersion='frozen-r17';
function fixture({validate}={}){
 const scene=new THREE.Group(),before=new THREE.Group(),after=new THREE.Group(),assets=[],counts=new Map(),control={commit:'ok',create:'ok',validate:true};let commits=0,creates=0,session;
 function factory(roofRoles){const a=createTargetOldCity({seed:20261005,roofRoles});a.group.position.set(-55,17,9);a.group.rotation.y=Math.PI/4;const dispose=a.dispose;counts.set(a,0);a.dispose=()=>{counts.set(a,counts.get(a)+1);dispose();};assets.push(a);return a;}
 const initialAsset=factory();scene.add(before,initialAsset.group,after);const editorOptions={targetId,terrainVersion,factoryVersion:initialAsset.report.version,validate(next,previous,context){if(!control.validate)return{ok:false,error:'geometry clearance rejected'};return validate?validate(next,previous,context):true;}};
 session=createTargetOldCityRoofSession({initialAsset,editorOptions,createAsset({roofRoles}){creates++;if(control.create==='throw')throw new Error('factory failed');if(control.create==='reuse')return initialAsset;const a=factory(roofRoles);if(control.create==='wrong-role')a.report.houses[0].roofRole='not-a-role';if(control.create==='wrong-placement')a.group.position.x++;if(control.create==='wrong-version')a.report.version='wrong';if(control.create==='attached')scene.add(a.group);return a;},commitAsset(next,previous){commits++;if(control.commit==='reject')return{ok:false,error:'publish rejected'};if(control.commit==='throw'){previous.group.removeFromParent();scene.add(next.group);throw new Error('publish failed');}if(control.commit==='no-publish')return true;const index=scene.children.indexOf(previous.group);previous.group.removeFromParent();scene.add(next.group);scene.children.splice(scene.children.indexOf(next.group),1);scene.children.splice(index,0,next.group);return{ok:true};}});
 return{session,scene,before,after,initialAsset,assets,counts,control,get commits(){return commits;},get creates(){return creates;},close(){return session.close();}};
}
const states=e=>JSON.stringify(e.list());

test('default session does not solve; exposes ordinary protected picking and edits without rebuilding',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,asset=s.currentAsset,roof=asset.group.getObjectByName(id+'-roof'),tower=asset.group.getObjectByName('tower-shaft');assert.equal(f.creates,0);assert.equal(s.roofHistory.undo,0);assert.equal(s.solverProvenance,null);assert.equal(s.size,15);
 assert.equal(s.pick([{object:roof,distance:2},{object:tower,distance:1}]).kind,'protected');assert.equal(s.pick([{object:roof,distance:2}]).id,id);assert.equal(s.edit({id,occupied:false,wallColor:'#226688'}).ok,true);assert.equal(s.currentAsset,asset);assert.equal(f.creates,0);assert.equal(asset.group.getObjectByName(id).visible,false);assert.equal(asset.group.getObjectByName(id+'-base').visible,true);assert.equal(s.undo().ok,true);assert.equal(s.redo().ok,true);assert.equal(s.historyDomain,undefined);f.close();
});

test('roof rebuild preserves entity colours, deleted IDs and ordinary undo history; roof undo/redo is separate',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,baseline=s.exportSnapshot().roofRoles;s.edit({id,wallColor:'#112233'});s.edit({id,occupied:false});const beforeEntities=states(s),entityHistory={...s.history},old=s.currentAsset;
 const result=s.solve({seed:7,locks:{[id]:null}});assert.equal(result.ok,true);assert.notEqual(s.currentAsset,old);assert.equal(f.counts.get(old),1);assert.equal(f.scene.children[1],s.currentAsset.group);assert.equal(states(s),beforeEntities);assert.deepEqual(s.history,entityHistory);assert.equal(s.roofHistory.undo,1);assert.equal(s.exportSnapshot().roofRoles[id],baseline[id]);assert.equal(result.solver.assignments[id],null);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,true);
 const solved=s.exportSnapshot().roofRoles;s.edit({id,wallColor:'#abcdef'});assert.equal(s.undoRoof().ok,true);assert.deepEqual(s.exportSnapshot().roofRoles,baseline);assert.equal(s.list().find(e=>e.id===id).wallColor,'#abcdef');assert.equal(s.list().find(e=>e.id===id).occupied,false);assert.equal(s.redoRoof().ok,true);assert.deepEqual(s.exportSnapshot().roofRoles,solved);assert.equal(s.undo().ok,true);assert.equal(s.list().find(e=>e.id===id).wallColor,'#112233');assert.equal(s.undo().ok,true);assert.equal(s.list().find(e=>e.id===id).occupied,true);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,false);assert.deepEqual(s.exportSnapshot().roofRoles,solved);f.close();
});

test('constraint contradictions and malformed solves have zero factory/scene changes',()=>{
 const f=fixture(),s=f.session,before=s.exportJSON(),scene=f.scene.children.slice(),old=s.currentAsset;
 for(const input of[{locks:{'house-0--1-0':'upper-street-cupola','house-0--1-1':'outer-edge-short-tower'}},{locks:{tower:'hip-roof'}},{seed:NaN},{occupied:{'house-0--1-0':false}}]){assert.equal(s.solve(input).ok,false);assert.equal(s.currentAsset,old);assert.equal(s.exportJSON(),before);assert.deepEqual(f.scene.children,scene);}
 assert.equal(f.creates,0);assert.equal(f.commits,0);assert.equal(f.counts.get(old),0);f.close();
});

test('staged geometry is validated even with unchanged entity snapshot, and failed validation releases only staged resources',()=>{
 let calls=0,contexts=[];const f=fixture({validate(next,previous,context){calls++;contexts.push(context);assert.equal(next.schema,previous.schema);assert.ok(Object.isFrozen(next.entities[0]));return true;}}),s=f.session,old=s.currentAsset,before=s.exportJSON();
 assert.equal(s.solve({seed:8}).ok,true);assert.ok(calls>0);assert.ok(contexts.some(c=>c.reason==='roof-solve'&&c.asset!==c.previousAsset));const current=s.currentAsset,state=s.exportJSON(),hist=s.roofHistory;f.control.validate=false;assert.equal(s.solve({seed:9}).ok,false);assert.equal(s.currentAsset,current);assert.equal(s.exportJSON(),state);assert.deepEqual(s.roofHistory,hist);assert.equal(f.counts.get(f.assets.at(-1)),1);assert.equal(f.counts.get(current),0);assert.equal(f.counts.get(old),1);f.close();
});

test('factory and commit failures restore old scene/editor and preserve both histories atomically',()=>{
 for(const [kind,value]of[['create','throw'],['create','reuse'],['create','wrong-version'],['create','wrong-role'],['create','wrong-placement'],['create','attached'],['commit','reject'],['commit','throw'],['commit','no-publish']]){
  const f=fixture(),s=f.session,id=s.list()[0].id;s.edit({id,wallColor:'#102030'});const old=s.currentAsset,oldEditor=s.currentEditor,before=s.exportJSON(),entityHistory=s.history,roofHistory=s.roofHistory,children=f.scene.children.slice();f.control[kind]=value;const result=s.solve({seed:15});assert.equal(result.ok,false,kind+value);assert.equal(s.currentAsset,old);assert.equal(s.currentEditor,oldEditor);assert.equal(s.exportJSON(),before);assert.deepEqual(f.scene.children,children);assert.deepEqual(s.history,entityHistory);assert.deepEqual(s.roofHistory,roofHistory);assert.equal(f.counts.get(old),0);if(f.assets.length>1)assert.equal(f.counts.get(f.assets.at(-1)),1);f.close();
 }
});

test('full JSON roundtrip preserves roof roles, occupancy, colours and replayable solver provenance',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id;s.edit({id,wallColor:'#778899'});assert.equal(s.solve({seed:32,locks:{[id]:'setback-upper-room'}}).ok,true);s.edit({id,occupied:false});const saved=s.exportJSON();assert.equal(JSON.parse(saved).schema,TARGET_OLD_CITY_ROOF_SESSION_SCHEMA);
 s.edit({id,wallColor:'#aabbcc'});s.solve({seed:11});const result=s.importSnapshot(saved);assert.equal(result.ok,true);assert.equal(result.historyReset,true);assert.equal(s.exportJSON(),saved);assert.equal(s.history.undo,0);assert.equal(s.roofHistory.undo,0);assert.ok(s.solverProvenance.solutionHash);assert.deepEqual(s.currentAsset.report.roofSolverProvenance,s.solverProvenance);f.close();
});

test('invalid snapshots are completely rejected before asset creation: missing maps, versions, roles, IDs and fabricated provenance',()=>{
 const f=fixture(),s=f.session;assert.equal(s.solve({seed:7}).ok,true);const saved=s.exportSnapshot(),before=s.exportJSON(),creates=f.creates,commits=f.commits,old=s.currentAsset,invalid=[];
 for(const key of['schema','targetId','terrainVersion','factoryVersion','assetFactoryVersion','solverVersion']){const x=structuredClone(saved);x[key]='wrong';invalid.push(x);}for(const key of['roofRoles','entitySnapshot','solverProvenance']){const x=structuredClone(saved);delete x[key];invalid.push(x);}
 {const x=structuredClone(saved);delete x.roofRoles['house-0--1-0'];invalid.push(x);}{const x=structuredClone(saved);x.roofRoles['house-0--1-0']='unknown';invalid.push(x);}{const x=structuredClone(saved);x.roofRoles.tower='hip-roof';invalid.push(x);}{const x=structuredClone(saved);x.entitySnapshot.entities[1].id=x.entitySnapshot.entities[0].id;invalid.push(x);}{const x=structuredClone(saved);x.entitySnapshot.entities[0].wallColor='red';invalid.push(x);}{const x=structuredClone(saved);x.solverProvenance.solutionHash='forged';invalid.push(x);}{const x=structuredClone(saved);x.solverProvenance.locks={'house-0--1-0':'outer-edge-short-tower','house-0--1-1':'upper-street-cupola'};invalid.push(x);}
 for(const x of invalid){assert.equal(s.importSnapshot(x).ok,false);assert.equal(s.exportJSON(),before);assert.equal(s.currentAsset,old);}assert.equal(f.creates,creates);assert.equal(f.commits,commits);f.close();
});

test('rejected full import and roof undo do not consume history or alter active entity colours',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,initial=s.exportSnapshot();s.edit({id,wallColor:'#554433'});s.solve({seed:4});const before=s.exportJSON(),a=s.currentAsset,h=s.roofHistory;f.control.commit='reject';assert.equal(s.importSnapshot(initial).ok,false);assert.equal(s.undoRoof().ok,false);assert.equal(s.exportJSON(),before);assert.equal(s.currentAsset,a);assert.deepEqual(s.roofHistory,h);f.control.commit='ok';assert.equal(s.undoRoof().ok,true);assert.equal(s.list().find(e=>e.id===id).wallColor,'#554433');f.close();
});

test('close owns current asset exactly once; replaced source materials and editor clones are each released once',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,old=s.currentAsset,wall=old.group.getObjectByName(id+'-walls'),source=wall.material;let sourceDisposed=0;source.addEventListener('dispose',()=>sourceDisposed++);s.edit({id,wallColor:'#114477'});const clone=wall.material;let cloneDisposed=0;clone.addEventListener('dispose',()=>cloneDisposed++);s.solve({seed:8});assert.equal(sourceDisposed,1);assert.equal(cloneDisposed,1);const current=s.currentAsset;assert.equal(f.close().ok,true);assert.equal(f.close().changed,false);assert.equal(f.counts.get(current),1);assert.equal(f.counts.get(old),1);assert.equal(s.currentAsset,null);assert.equal(s.currentEditor,null);assert.equal(s.edit({id,occupied:false}).ok,false);assert.equal(s.solve().ok,false);assert.equal(s.pick([]),null);assert.deepEqual(f.scene.children,[f.before,f.after]);
});

test('entity history remains capped at 100 and async callback contracts are rejected',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id;for(let i=0;i<105;i++)s.edit({id,occupied:i%2===1});assert.equal(s.history.undo,100);f.close();const a=createTargetOldCity();assert.throws(()=>createTargetOldCityRoofSession({initialAsset:a,createAsset:async()=>a,commitAsset:()=>true}),/synchronous/);a.dispose();
});

test('occupancy plus WFC solve commits atomically, clearing only the deleted plot lock and recording separate histories',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,other=s.list()[1].id;
 assert.equal(s.solve({seed:7,locks:{[id]:'setback-upper-room',[other]:'open-terrace-pavilion'}}).ok,true);
 const before=s.currentAsset,history=s.history.undo,roofHistory=s.roofHistory.undo;
 const result=s.editAndSolve({id,occupied:false});assert.equal(result.ok,true);assert.deepEqual(result.clearedLocks,[id]);assert.deepEqual(s.solverProvenance.locks,{[other]:'open-terrace-pavilion'});assert.equal(s.list().find(e=>e.id===id).occupied,false);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,true);assert.equal(s.history.undo,history+1);assert.equal(s.roofHistory.undo,roofHistory+1);assert.equal(f.counts.get(before),1);
 assert.equal(s.undo().ok,true);assert.equal(s.list().find(e=>e.id===id).occupied,true);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,false);f.close();
});

test('atomic occupancy/roof failures preserve scene, colour, locks and both histories',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id;s.solve({seed:7,locks:{[id]:'setback-upper-room'}});const before=s.exportJSON(),old=s.currentAsset,h=s.history,rh=s.roofHistory;
 const conflict={locks:{'house-0--1-1':'upper-street-cupola','house-0--1-2':'outer-edge-short-tower'}};
 assert.equal(s.editAndSolve({id,occupied:false,wallColor:'#112233'},conflict).ok,false);
 f.control.commit='reject';assert.equal(s.editAndSolve({id,occupied:false}).ok,false);f.control.commit='ok';f.control.validate=false;assert.equal(s.editAndSolve({id,occupied:false}).ok,false);
 assert.equal(s.exportJSON(),before);assert.equal(s.currentAsset,old);assert.deepEqual(s.history,h);assert.deepEqual(s.roofHistory,rh);assert.equal(f.scene.children[1],old.group);assert.equal(f.counts.get(old),0);
 for(const patch of[{id,occupied:'false'},{id,wallColor:'#123456'},{id,occupied:false,wallColor:'red'},{id,occupied:false,extra:true}])assert.equal(s.editAndSolve(patch).ok,false);f.close();
});


test('iframe/VM plain records work for edits, roof roles, locks and full snapshots; class and custom prototypes fail',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id,foreign=value=>vm.runInNewContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')');
 assert.equal(s.edit(foreign({id,wallColor:'#aabbcc'})).ok,true);
 assert.equal(s.currentEditor.importSnapshot(foreign(s.currentEditor.exportSnapshot())).ok,true);
 const foreignAsset=createTargetOldCity({roofRoles:foreign({[id]:'open-terrace-pavilion'})});assert.equal(foreignAsset.report.houses.find(h=>h.id===id).roofRole,'open-terrace-pavilion');foreignAsset.dispose();
 assert.deepEqual(validateTargetOldCityRoofRoles(foreign({[id]:'hip-roof'})),{[id]:'hip-roof'});
 assert.equal(s.solve(foreign({seed:7,locks:{[id]:'setback-upper-room'}})).ok,true);
 assert.equal(s.importSnapshot(foreign(s.exportSnapshot())).ok,true);
 assert.equal(s.editAndSolve(foreign({id,occupied:false}),foreign({seed:9})).ok,true);
 for(const expression of['new (class X {})()', 'Object.create({polluted:true})', 'Object.create(Object.create(null))', 'Object.create(Object.assign(Object.create(null),{constructor:Object}))']){
  const make=value=>{const o=vm.runInNewContext(expression);Object.assign(o,foreign(value));return o;},before=s.exportJSON(),creates=f.creates;
  assert.equal(s.edit(make({id,occupied:true})).ok,false);
  assert.throws(()=>validateTargetOldCityRoofRoles(make({[id]:'hip-roof'})),/plain/);
  assert.equal(s.solve(make({seed:7})).ok,false);
  assert.equal(s.solve({locks:make({})}).ok,false);
  assert.equal(s.importSnapshot(make(s.exportSnapshot())).ok,false);
  assert.equal(s.exportJSON(),before);assert.equal(f.creates,creates);
 }
 const nullPatch=Object.assign(Object.create(null),{id,occupied:true});assert.equal(s.edit(nullPatch).ok,true);f.close();
});
