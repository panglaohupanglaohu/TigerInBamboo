import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='TigerMessenger/artifacts/workshop-tests/learning-roadmap-20261112';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 // Exercise actual parent application/API, keep heavyweight game isolated from this UI contract test.
 await page.route('**/TigerMessenger/index.html?*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>isolated game</title>'}));
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#learning');
 await page.locator('.learning-demand').first().waitFor({timeout:30000});
 assert.equal(await page.locator('.learning-demand').count(),4);
 await page.screenshot({path:out+'/roadmap.png',fullPage:true});
 await page.getByRole('button',{name:'源码归类与差距',exact:true}).click();
 const count=await page.locator('.learning-content .learning-module').count();assert.ok(count>=170);
 await page.getByRole('button',{name:'需求与能力组合',exact:true}).click();
 await page.locator('[data-demand=natural] button').click();
 await page.waitForFunction(()=>location.hash==='#object');
 await page.waitForTimeout(2000);
 const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('object'))));
 assert.ok(JSON.stringify(saved).includes('object.spacing-relax'));
 await page.getByRole('button',{name:'需求组合与源码缺口 → 学习工坊',exact:true}).click();
 assert.equal(await page.locator('.learning-demand').count(),4);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/browser.json',JSON.stringify({passed:true,moduleCount:count,saved,errors,scope:'Isolated parent UI and live snapshot API; no game geometry execution'},null,2));
}finally{await browser.close();}
