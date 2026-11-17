import {test} from 'node:test';import assert from 'node:assert/strict';
test('editor dock ships on local and published pages; ?dev=0 / ?release=1 opt out',async()=>{
 const oldLocation=globalThis.location,oldStorage=globalThis.localStorage;
 try{globalThis.localStorage={getItem:()=>JSON.stringify({group:'build',monitor:true})};let index=0;
 for(const [path,search,expected]of [['/TigerMessenger/','',true],['/TigerMessenger/index.html','',true],['/TigerMessenger/index.html','?dev=1&authoringEmbed=1',true],['/TigerMessenger/index.html','?release=1',false],['/TigerMessenger/index.html','?dev=0',false]]){
 globalThis.location={hostname:'localhost',pathname:path,search};const ui=await import('../src/ui/uiLayers.js?entry-case='+index++);assert.equal(ui.UI_DEV,expected);assert.equal(ui.uiLayersState().dev,expected);}
 // Published Pages host: editor dock is expected too (owner reviews the live site); opt-outs still work.
 globalThis.location={hostname:'example.com',pathname:'/TigerMessenger/index.html',search:''};assert.equal((await import('../src/ui/uiLayers.js?entry-public')).UI_DEV,true);
 globalThis.location={hostname:'example.com',pathname:'/TigerMessenger/index.html',search:'?dev=0'};assert.equal((await import('../src/ui/uiLayers.js?entry-public-optout')).UI_DEV,false);
 globalThis.location={hostname:'example.com',pathname:'/TigerMessenger/index.html',search:'?release=1'};assert.equal((await import('../src/ui/uiLayers.js?entry-public-release')).UI_DEV,false);
 }finally{globalThis.location=oldLocation;globalThis.localStorage=oldStorage;}
});
