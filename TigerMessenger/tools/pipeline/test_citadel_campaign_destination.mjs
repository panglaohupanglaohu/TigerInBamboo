import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});const errors=[];let report;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:5}));const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/',{timeout:180000});await page.waitForFunction(()=>!!window.__tm?.rescueCampaign,null,{timeout:180000});await page.locator('#start-btn').click();
 report=await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE,campaign=t.rescueCampaign,castle=t.messenger.landmarks.odysseyCitadel,city=castle.getObjectByName('highland-west-city');
  const expected=city.localToWorld(new T.Vector3().fromArray(city.userData.plazaAnchor));
  campaign.update(.2);const target=campaign.getTargetPosition().clone(),old=castle.getWorldPosition(new T.Vector3());
  const checks=[];const check=(name,passed)=>checks.push({name,passed:!!passed});
  check('final target shares authored new plaza anchor',target.distanceTo(expected)<1e-8);
  t.player.position.copy(old);campaign.update(.2);window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));check('old castle root cannot finish new-city arrival',campaign.snapshot().chapter===5);
  const text=document.querySelector('.rescue-battle-status').textContent;
  check('battle context remains visible in final chapter',!document.querySelector('.rescue-battle-status').hidden);
  t.player.position.copy(target);campaign.update(.2);window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));check('actual R at new plaza completes arrival',campaign.snapshot().chapter===6);
  return {passed:checks.every(c=>c.passed),checks,target:target.toArray(),oldRootDistance:old.distanceTo(target),panel:text,scope:'Restored final chapter, real R interactions with diagnostic positioning; not a full rescue/boat journey or native Godot story.'};
 });
}finally{await browser.close();}
report.errors=errors;report.passed&&=!errors.length;await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/campaign-destination-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
