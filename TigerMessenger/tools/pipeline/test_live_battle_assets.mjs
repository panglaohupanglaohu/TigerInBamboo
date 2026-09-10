import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'artifacts/pipeline/web-battle-assets');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://localhost:8931/TigerMessenger/';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__tm?.messenger,{timeout:120000});
  const report=await page.evaluate(()=>{
    const assets=[],missing=[];
    window.__tm.scene.traverse(o=>{
      const meta=o.userData.battleOptimization;
      if(meta) assets.push({name:o.name,...meta,finite:o.matrixWorld.elements.every(Number.isFinite)});
      if((o.userData.unitClass==='vanguard-trooper'||/^vanguard-hauler-/.test(o.name))&&!meta)missing.push(o.name);
    });
    return {assets,missing,title:document.title,scope:'Unmodified production URL and actual scene instances; no injected battle events or fake asset factories'};
  });
  report.url=url;report.pageErrors=errors;
  report.counts={heavy:report.assets.filter(a=>a.asset==='vanguard-color-v2').length,socco:report.assets.filter(a=>a.asset==='socco-color-v2').length};
  report.passed=report.counts.heavy>=27&&report.counts.socco>=3&&report.missing.length===0&&errors.length===0&&report.assets.every(a=>a.active&&a.geometryApplied&&a.finite);
  await page.screenshot({path:path.join(output,'production-page.png')});
  await writeFile(path.join(output,'production-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,counts:report.counts,missing:report.missing,errors}));
  if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
