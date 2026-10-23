import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAirshipSummonShortcut} from '../../src/player/airshipSummonShortcut.js';
const key = overrides => ({code:'KeyQ',key:'q',target:{tagName:'CANVAS'},preventDefault(){this.defaultPrevented=true;},...overrides});

test('Q closes both editors and restores player camera before summoning',()=>{
 const calls=[];const event=key();
 const panel=name=>({isOpen:()=>true,close:()=>calls.push(name)});
 assert.equal(handleAirshipSummonShortcut(event,{panels:[panel('citadel'),panel('crystal')],restoreView:()=>calls.push('camera'),summon:()=>calls.push('summon')}),true);
 assert.deepEqual(calls,['citadel','crystal','camera','summon']);
 assert.equal(event.defaultPrevented,true);
});
test('key-only Q works; a closed panel is untouched',()=>{
 let n=0;
 handleAirshipSummonShortcut(key({code:''}),{panels:[{isOpen:()=>false,close:()=>assert.fail('closed panel')}],summon:()=>n++});
 assert.equal(n,1);
});
test('typing, IME, modifiers, held Q and unrelated keys do not summon',()=>{
 for(const change of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{code:'KeyE',key:'e'},{target:{tagName:'INPUT'}},{target:{isContentEditable:true}}]){
  assert.equal(handleAirshipSummonShortcut(key(change),{summon:()=>assert.fail('unexpected summon')}),false);
 }
 assert.equal(handleAirshipSummonShortcut(key(),{activeElement:{tagName:'TEXTAREA'},summon:()=>assert.fail('typing')}),false);
});
