import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='TigerMessenger/artifacts/code-library-rebuild-20261113',browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),report={errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://localhost:8769/index.html?scene=fusion');await page.waitForFunction(()=>window.reaView?.worldMesh?.geometry);await page.waitForFunction(()=>document.querySelector('#scene-enhancement-status')?.dataset.enabled!==undefined);
 await page.evaluate(async()=>{window.indexModules=await import('/src/ui/view-combinations.js');window.encodeIndex=(await import('/src/world/save.js')).encodeWorld;});
 report.before=await page.evaluate(()=>({world:encodeIndex(reaView.town,'fusion'),flags:Object.fromEntries([...new Set(indexModules.VIEW_COMBINATIONS.flatMap(r=>Object.keys(r.toggles)))].map(k=>[k,indexModules.readViewToggle(reaView,k)]))}));
 await page.getByRole('button',{name:'能力库',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#library-counts').dataset.sourceModules);
 report.sourceModules=await page.locator('#library-counts').getAttribute('data-source-modules');report.combinations=await page.locator('#library-combinations>details').count();if(Number(report.sourceModules)<359||report.combinations!==7)throw Error('source index catalog missing');
 await page.getByRole('searchbox',{name:'搜索源码路径或导出接口'}).fill('path-samples');if(await page.locator('[data-library-module]').count()!==1)throw Error('source index search');await page.getByRole('searchbox',{name:'搜索源码路径或导出接口'}).fill('');
 await page.screenshot({path:out+'/source-index-library.png'});report.previews=[];
 for(const id of ['coastal-life','wind-clouds','lighting-review']){
  await page.locator('[data-view-combination="'+id+'"]').click();const actual=await page.evaluate(id=>{const recipe=indexModules.VIEW_COMBINATIONS.find(r=>r.id===id);return{expected:recipe.toggles,actual:Object.fromEntries(Object.keys(recipe.toggles).map(k=>[k,indexModules.readViewToggle(reaView,k)]))};},id);if(JSON.stringify(actual.expected)!==JSON.stringify(actual.actual))throw Error('View flags mismatch '+id);report.previews.push({id,...actual});
  await page.getByRole('button',{name:'恢复试用前',exact:true}).click();
 }
 report.after=await page.evaluate(()=>({world:encodeIndex(reaView.town,'fusion'),flags:Object.fromEntries([...new Set(indexModules.VIEW_COMBINATIONS.flatMap(r=>Object.keys(r.toggles)))].map(k=>[k,indexModules.readViewToggle(reaView,k)]))}));
 if(JSON.stringify(report.before)!==JSON.stringify(report.after))throw Error('source index restore or world preservation failed');
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.screenshot({path:out+'/source-index-scene.png'});
 if(report.errors.length)throw Error(report.errors.join(';'));report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;throw error;}finally{fs.writeFileSync(out+'/source-index-browser.json',JSON.stringify(report,null,2));await browser.close();}
