import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const out='TigerMessenger/artifacts/restore-edit-button-20261113',report={errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://localhost:8931/TigerMessenger/index.html');
 await page.waitForFunction(()=>window.__tmUiLayers&&window.__tm,{},{timeout:240000});
 const start=page.locator('#start-btn');if(await start.isVisible())await start.click();
 const edit=page.locator('#tm-ui-dock>button');await edit.waitFor({state:'visible'});report.initial=await page.evaluate(()=>__tmUiLayers.state());if(!report.initial.dev)throw Error('local editor is hidden');
 await edit.click();await page.locator('#tm-ui-dock .item').filter({hasText:/^构建/}).click();await page.locator('#morris-town-target').selectOption('editor:map');
 await page.waitForFunction(()=>document.documentElement.dataset.editGroup==='build'&&getComputedStyle(document.querySelector('#map-editor')).display!=='none');
 report.build=await page.evaluate(()=>({state:__tmUiLayers.state(),panels:[...document.querySelectorAll('[data-ui-group="build"]')].filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0).map(n=>n.id)}));if(!report.build.panels.length)throw Error('build panel unavailable');
 await page.screenshot({path:out+'/desktop-edit.png'});
 await edit.click();await page.locator('#tm-ui-dock .item').filter({hasText:/^关闭编辑器/}).click();
 if(await page.evaluate(()=>__tm.mapEditor.isOpen()))throw Error('map picking remained active after closing editor');
 await page.setViewportSize({width:390,height:844});await edit.waitFor({state:'visible'});report.mobile=await edit.boundingBox();if(report.mobile.x<0||report.mobile.x+report.mobile.width>390||report.mobile.y+report.mobile.height>844)throw Error('mobile edit button out of bounds');
 await page.screenshot({path:out+'/mobile-edit.png'});await edit.click();await page.locator('#tm-ui-dock .item').filter({hasText:/^构建/}).click();await page.locator('#morris-town-target').selectOption('editor:map');await page.waitForFunction(()=>__tmUiLayers.state().group==='build');
 report.touchActions=await page.locator('.touch-btn').evaluateAll(nodes=>nodes.map(n=>n.dataset.action));if(report.touchActions.join(',')!=='jump,interact,tram,driver,fire,summon')throw Error('existing touch controls changed');
 if(report.errors.length)throw Error(report.errors.join(';'));report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;throw error;}finally{fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));await browser.close();}
