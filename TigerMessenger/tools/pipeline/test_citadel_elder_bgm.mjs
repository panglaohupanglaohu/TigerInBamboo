import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--autoplay-policy=no-user-gesture-required']});
let report;const errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,S=await import('/TigerMessenger/src/audio/sfx.js');
  const city=t.scene.getObjectByName('highland-west-city'),center=city.localToWorld(new T.Vector3(60,4,71.5));
  const checks=[],states=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const audible=s=>s.elements.filter(e=>!e.paused&&e.volume>.001);
  let listener;
  const update=d=>{listener=center.clone().add(new T.Vector3(d,0,0));S.updateBgmListenerContext({listener,newCity:center,gameStarted:true});};
  const snap=label=>{const s=S.getBgmOwnershipSnapshot();states.push({label,...s});return s;};
  const check=(name,passed)=>checks.push({name,passed:!!passed});
  const wait=async fn=>{for(let i=0;i<50;i++){if(fn())return true;await pause(100);}return false;};
  S.ensureAudio();update(31);check('outside 30 m does not claim elder music',snap('31 m').owner!=='citadelElder');
  update(20);await wait(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='citadelElder'));
  let s=snap('20 m');check('inside region plays existing elder recording exclusively',s.owner==='citadelElder'&&audible(s).length===1&&audible(s)[0].key==='citadelElder');
  const start=s.elements.find(e=>e.key==='citadelElder')?.currentTime;const clockAdvanced=await wait(()=>S.getBgmOwnershipSnapshot().elements.find(e=>e.key==='citadelElder')?.currentTime>start+.2);s=snap('native clock');check('real media time advances',clockAdvanced);
  S.setSiegeAssaultBgm(true,{source:center.clone().add(new T.Vector3(-500,0,0))});update(20);s=snap('remote battle');check('distant siege cannot replace elder',s.owner==='citadelElder'&&audible(s).length===1);
  S.setTramRideBgm(true);await wait(()=>S.getBgmOwnershipSnapshot().owner==='tram');s=snap('tram priority');check('tram silences elder',s.owner==='tram'&&audible(s).every(e=>e.key==='tram'));
  S.setTramRideBgm(false);update(20);await pause(3200);update(20);await wait(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='citadelElder'));s=snap('return to elder');check('elder resumes after transport releases music',s.owner==='citadelElder'&&audible(s).length===1&&audible(s)[0].key==='citadelElder');
  S.setSiegeAssaultBgm(true,{source:center});update(20);await wait(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='siege'));s=snap('local siege');check('local event replaces regional music exclusively',s.owner==='siege'&&audible(s).length===1&&audible(s)[0].key==='siege');
  S.setSiegeAssaultBgm(false);await pause(3200);update(20);await wait(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='citadelElder'));s=snap('event ended');check('regional music resumes after event ends',s.owner==='citadelElder'&&audible(s).length===1&&audible(s)[0].key==='citadelElder');
  update(30);check('30 m boundary is silent',snap('30 m').owner!=='citadelElder');
  update(31);s=snap('leave region');check('leaving pauses elder without remote battle takeover',s.owner===null&&audible(s).length===0);
  return {checks,states,passed:checks.every(c=>c.passed),scope:'Actual 8931 audio module and native HTMLAudio clocks, diagnostic listener distances and transport intent. Not a complete walking/boarding journey or subjective listening review.'};
 });
}finally{await browser.close();}
report.errors=errors;report.passed&&=!errors.length;
await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/elder-bgm-audit.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors}));if(!report.passed)process.exitCode=1;
