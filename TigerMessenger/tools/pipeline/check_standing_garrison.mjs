import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.saihojiPhalanx?.root.getObjectByName('citadel-red-garrison'),null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const t=window.__tm,b=t.messenger.landmarks.saihojiPhalanx;
  const actors=()=>b.root.getObjectByName('citadel-red-garrison').children.map(s=>s.uuid);
  const before=actors(),phase=b.root.userData.phase;
  b.root.userData.debugSiege();const after=actors();
  b.root.userData.debugSiege();const repeated=actors();
  b.reset();b.update(0,0);const reset=actors();
  const roots=b.root.children.filter(s=>s.name==='citadel-red-garrison').length;
  return {phase,before,after,repeated,reset,roots,passed:before.length===28&&JSON.stringify(before)===JSON.stringify(after)&&JSON.stringify(after)===JSON.stringify(repeated)&&reset.length===28&&reset.every(id=>!before.includes(id))&&roots===1};
 });
 report.errors=errors;report.passed&&=!errors.length;
 report.scope='Normal Web startup has 28 stationed originals; two debug siege entries preserve UUIDs; reset recreates one garrison. Not natural full campaign verification.';
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/standing-garrison.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
