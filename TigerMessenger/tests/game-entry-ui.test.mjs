import {test} from 'node:test';import assert from 'node:assert/strict';
test('local game restores editor dock; explicit release/play-only URLs retain clean UI',async()=>{
 const oldLocation=globalThis.location,oldStorage=globalThis.localStorage;
 try{globalThis.localStorage={getItem:()=>JSON.stringify({group:'build',monitor:true})};let index=0;
 for(const [path,search,expected]of [['/TigerMessenger/','',true],['/TigerMessenger/index.html','',true],['/TigerMessenger/index.html','?dev=1&authoringEmbed=1',true],['/TigerMessenger/index.html','?release=1',false],['/TigerMessenger/index.html','?dev=0',false]]){
 globalThis.location={hostname:'localhost',pathname:path,search};const ui=await import('../src/ui/uiLayers.js?entry-case='+index++);assert.equal(ui.UI_DEV,expected);assert.equal(ui.uiLayersState().dev,expected);}
 globalThis.location={hostname:'example.com',pathname:'/TigerMessenger/index.html',search:''};assert.equal((await import('../src/ui/uiLayers.js?entry-public')).UI_DEV,false);
 }finally{globalThis.location=oldLocation;globalThis.localStorage=oldStorage;}
});
