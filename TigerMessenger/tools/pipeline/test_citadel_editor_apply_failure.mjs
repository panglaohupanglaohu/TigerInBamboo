import assert from 'node:assert/strict';
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/editor-apply-contract.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/editor-apply-contract.html');
 const report=await page.evaluate(async()=>{
  const {createCitadelEditorPanel}=await import('/TigerMessenger/src/ui/citadelEditorPanel.js');
  let targetId='canal-junction',reject=true;const calls=[],toasts=[];
  const target={userData:{}};
  const editor=createCitadelEditorPanel({getInstanceId:()=>targetId,getCitadelTarget:()=>target,getLatestDesign:()=>targetId==='other-test',getTargets:()=>[{id:'canal-junction',name:'First',floors:3},{id:'other-test',name:'Second',floors:3}],getSupportLevel:()=>0,toast:t=>toasts.push(t),onApply:layout=>{
   calls.push(structuredClone(layout));
   return reject?{ok:false,error:'wfc-unsatisfied',preservedPreviousGeometry:true}:{cellCount:1,domeCount:0,towerCount:0,roofCount:0,archCount:0,windowCount:0,crenelCount:0,fenceCount:0,shrubCount:0,canalCount:0,waterGateCount:0};
  }});
  editor.open();const beforeStorage=JSON.stringify({...localStorage});
  const firstEdit=editor.applySceneEdit({ix:0,iy:0,iz:0},'place');
  const failedDraft=JSON.stringify(calls.at(-1));
  const failure={editAcceptedAsDraft:firstEdit,applyFailed:editor.getState().applyFailed,message:editor.element.querySelector('#ce-stats').textContent,saveDisabled:editor.element.querySelector('#ce-save').disabled,terrainSaveDisabled:editor.element.querySelector('#ce-terrain-save').disabled};
  // Invoke both the handler and real keyboard shortcut: disabled buttons alone
  // would not protect Ctrl+S or a programmatic invocation of the shared handler.
  editor.element.querySelector('#ce-save').onclick();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}));
  failure.storageUnchanged=JSON.stringify({...localStorage})===beforeStorage;
  editor.switchTarget(()=>{targetId='other-test';return true;});
  const switchedClean=!editor.getState().applyFailed&&!editor.element.querySelector('#ce-save').disabled;
  editor.switchTarget(()=>{targetId='canal-junction';return true;});
  const restoredFailure=editor.getState().applyFailed&&editor.element.querySelector('#ce-save').disabled;
  reject=false;editor.element.querySelector('#ce-undo').click();
  const undo={applySucceeded:!editor.getState().applyFailed,saveEnabled:!editor.element.querySelector('#ce-save').disabled,draftChanged:JSON.stringify(calls.at(-1))!==failedDraft};
  editor.element.querySelector('#ce-redo').click();
  const redoRestoredDraft=JSON.stringify(calls.at(-1))===failedDraft;
  editor.element.querySelector('#ce-save').click();
  const saved=JSON.stringify({...localStorage})!==beforeStorage;
  editor.switchTarget(()=>{targetId='other-test';return true;});reject=true;
  editor.applySceneEdit({ix:0,iy:0,iz:0},'place');
  const highlandBefore=JSON.stringify({...localStorage});
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}));
  const highlandBlocked=editor.getState().applyFailed&&highlandBefore===JSON.stringify({...localStorage});
  reject=false;window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));
  const highlandUndoRecovered=!editor.getState().applyFailed;
  return {failure,switchedClean,restoredFailure,undo,redoRestoredDraft,saved,highlandBlocked,highlandUndoRecovered,toasts};
 });
 assert.equal(report.failure.editAcceptedAsDraft,true);assert.equal(report.failure.applyFailed,true);assert.equal(report.failure.saveDisabled,true);assert.equal(report.failure.terrainSaveDisabled,true);assert.equal(report.failure.storageUnchanged,true);
 assert.match(report.failure.message,/未应用.*旧场景已保留/);assert.doesNotMatch(report.failure.message,/undefined/);
 assert.equal(report.switchedClean,true);assert.equal(report.restoredFailure,true);
 assert.deepEqual(report.undo,{applySucceeded:true,saveEnabled:true,draftChanged:true});assert.equal(report.redoRestoredDraft,true);assert.equal(report.saved,true);
 assert.equal(report.highlandBlocked,true);assert.equal(report.highlandUndoRecovered,true);
 console.log('CITADEL_EDITOR_APPLY_FAILURE_OK '+JSON.stringify(report));
}finally{await browser.close();}
