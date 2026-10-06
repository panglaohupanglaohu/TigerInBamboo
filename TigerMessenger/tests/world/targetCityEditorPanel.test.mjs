import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
import {createTargetOldCityRoofSession} from '../../src/world/citadel/targetOldCityRoofSession.js';
import {installTargetCityEditorPanel} from '../../tools/pipeline/target_city_editor_panel.js';

// A small event/DOM harness checks wiring and ownership, not browser rendering.
class Element extends EventTarget{
 constructor(tag,doc){super();this.tag=tag;this.ownerDocument=doc;this.children=[];this.style={};this.attributes={};this._value='';this.checked=false;this.disabled=false;}
 append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 replaceChildren(...items){this.children=[];this._value='';this.append(...items);}
 set value(v){this._value=String(v);}get value(){return this._value||(this.tag==='select'?this.children[0]?.value??'':'');}
 setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
 click(){this.dispatchEvent(new Event('click'));}change(){this.dispatchEvent(new Event('change'));}
 getBoundingClientRect(){return{left:0,top:0,width:400,height:300};}
}
function fixture({legacy=false}={}){
 const doc={defaultView:new EventTarget(),createElement(tag){return new Element(tag,doc);},createTextNode(text){return{textContent:text};}},host=doc.createElement('div'),canvas=doc.createElement('canvas'),root=new THREE.Group(),scene=new THREE.Scene();scene.add(root);
 const initial=createTargetOldCity(),meta={targetId:'approved-target-v3',terrainVersion:'r17',factoryVersion:initial.report.version};root.add(initial.group);let session=null,refreshes=0;
 if(!legacy)root.userData.candidateHandle={openRoofSession(opts){assert.deepEqual(opts,meta);return session??=createTargetOldCityRoofSession({initialAsset:initial,editorOptions:opts,createAsset:({roofRoles})=>createTargetOldCity({roofRoles}),commitAsset(next,previous){root.remove(previous.group);root.add(next.group);return true;}});}};
 const panel=installTargetCityEditorPanel({root,scene,camera:new THREE.PerspectiveCamera(),canvas,THREE,host,refresh(){refreshes++;},...meta});
 const all=()=>host.children.flatMap(e=>[e,...e.children,...e.children.flatMap(c=>c.children??[])]),label=name=>all().find(e=>e.attributes?.['aria-label']===name),button=name=>all().find(e=>e.tag==='button'&&e.textContent===name);
 return{root,scene,canvas,host,doc,panel,initial,label,button,get session(){return session;},get refreshes(){return refreshes;},close(){panel.dispose();session?session.close():initial.dispose();}};
}

test('session panel preserves entity editing, exposes finite roof controls and exports complete versioned state',()=>{
 const f=fixture(),s=f.session,select=f.label('候选住宅'),id=select.value,colour=f.label('住宅墙色'),roles=f.label('所选住宅屋顶锁定'),recompute=f.label('增删后重算屋顶');
 assert.equal(f.panel.editor,s);assert.equal(f.panel.report().wfc,false);assert.equal(recompute.checked,false);assert.equal(recompute.disabled,true);assert.equal(roles.children.length,6);
 colour.value='#123456';f.button('应用墙色').click();assert.equal(s.list()[0].wallColor,'#123456');assert.equal(s.currentAsset,f.initial);
 roles.value='setback-upper-room';roles.change();f.label('屋顶求解种子').value='7';f.button('求解并应用屋顶').click();assert.equal(f.panel.report().lastResult.ok,true);assert.equal(f.panel.report().wfc,true);assert.equal(recompute.disabled,false);assert.equal(recompute.checked,false);assert.equal(s.solverProvenance.locks[id],'setback-upper-room');assert.equal(f.panel.report().snapshot.schema,'target-old-city-roof-session-v1');assert.equal(f.panel.report().solverReport.ok,true);
 recompute.checked=true;recompute.change();f.button('删除所选住宅').click();assert.equal(s.list()[0].occupied,false);assert.equal(Object.hasOwn(s.solverProvenance.locks,id),false);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,true);f.button('住宅撤销').click();assert.equal(s.list()[0].occupied,true);assert.equal(s.roofConstraintStatus.occupancyMatchesSolve,false);
 const saved=s.exportJSON();f.label('候选编辑JSON').value=saved;f.button('载入候选编辑JSON').click();assert.equal(s.exportJSON(),saved);f.close();
});

test('shadow diagnostics use current meshes after rebuild and panel cleanup never closes root-owned session',()=>{
 const f=fixture(),s=f.session,first=s.currentAsset.group.getObjectByName('tower-shaft'),original=first.receiveShadow;
 f.button('候选受影开关诊断').click();assert.equal(first.receiveShadow,false);assert.equal(f.panel.report().diagnosticShadowReceptionDisabled,true);
 f.button('求解并应用屋顶').click();assert.equal(f.panel.report().lastResult.ok,true);assert.equal(f.panel.report().diagnosticShadowReceptionDisabled,false);assert.equal(first.receiveShadow,original);
 const next=s.currentAsset.group.getObjectByName('tower-shaft'),nextOriginal=next.receiveShadow;assert.notEqual(next,first);f.button('候选受影开关诊断').click();assert.equal(next.receiveShadow,false);f.panel.dispose();assert.equal(next.receiveShadow,nextOriginal);assert.equal(s.closed,false);assert.ok(s.currentAsset.group.parent);assert.equal(f.host.children.length,0);f.close();
});

test('right click uses live session picker and atomic occupancy route; protected hit and drag cannot delete',()=>{
 const f=fixture(),s=f.session,id=s.list()[0].id;f.button('求解并应用屋顶').click();f.label('增删后重算屋顶').checked=true;
 const active=f.host.children[0].children.flatMap(e=>[e,...(e.children??[])]).find(e=>e.id==='entity-pointer-active');active.checked=true;active.change();let hit={kind:'protected'},atomic=0;const apply=s.editAndSolve;s.editAndSolve=(...args)=>{atomic++;return apply(...args);};s.intersectClosestVisible=()=>hit;
 function pointer(type,x=20){const e=new Event(type,{cancelable:true});Object.defineProperties(e,{target:{value:f.canvas},clientX:{value:x},clientY:{value:20},button:{value:2},pointerId:{value:1}});f.doc.defaultView.dispatchEvent(e);}
 pointer('pointerdown');pointer('pointerup');assert.equal(atomic,0);hit={kind:'entity',id,entity:s.list()[0]};pointer('pointerdown');pointer('pointerup',40);assert.equal(atomic,0);pointer('pointerdown');pointer('pointerup');assert.equal(atomic,1);assert.equal(s.list()[0].occupied,false);f.close();
});

test('legacy fallback remains entity-only and its panel owns editor disposal',()=>{
 const f=fixture({legacy:true}),id=f.panel.editor.list()[0].id;assert.equal(f.panel.session,null);assert.equal(f.button('求解并应用屋顶'),undefined);f.button('删除所选住宅').click();assert.equal(f.initial.group.getObjectByName(id).visible,false);f.panel.dispose();assert.equal(f.initial.group.getObjectByName(id).visible,true);assert.equal(f.panel.editor.edit({id,occupied:false}).ok,false);f.initial.dispose();
});
