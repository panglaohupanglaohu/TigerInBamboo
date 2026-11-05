import {test} from 'node:test';import assert from 'node:assert/strict';
test('game URL defaults clean despite remembered editor state; workshop explicitly opts in',async()=>{
 const oldLocation=globalThis.location,oldStorage=globalThis.localStorage;
 try{globalThis.localStorage={getItem:()=>JSON.stringify({group:'build',monitor:true})};let index=0;
 for(const [path,search,expected]of [['/TigerMessenger/','',false],['/TigerMessenger/index.html','',false],['/TigerMessenger/index.html','?dev=1&authoringEmbed=1',true],['/TigerMessenger/index.html','?release=1',false]]){
 globalThis.location={hostname:'localhost',pathname:path,search};const ui=await import('../src/ui/uiLayers.js?entry-case='+index++);assert.equal(ui.UI_DEV,expected);assert.equal(ui.uiLayersState().dev,expected);}
 }finally{globalThis.location=oldLocation;globalThis.localStorage=oldStorage;}
});
