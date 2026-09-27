import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(process.argv[3]==='baseline'?'&swampV2=0':''),{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
 const {updateAircraftHover}=await import('/TigerMessenger/src/assets/moebiusAircraft.js');
 const tm=window.__tm,swamp=tm.messenger.landmarks.moebiusSwamp,inner=swamp.userData.inner||swamp;
 let squad;tm.scene.traverse(o=>{if(o.userData.members?.some(m=>m.userData.kind==='moebius-aircraft'))squad=o;});
 if(!squad)return {passed:false,reason:'Aircraft squad not found'};
 const modes={},feedsBefore=squad.userData._forageDuty?.feeds||0;let nectarFrames=0,nonfinite=0,minScanDistance=Infinity;
 for(let i=0;i<18000;i++){
  const t=i/30;inner.update(1/30,t,{});updateAircraftHover(squad,t,1/30,{swamp});
  minScanDistance=Math.min(minScanDistance,squad.userData._swampScan?.dist??Infinity);
  if(inner.userData.nectarTargets.length)nectarFrames++;
  for(const m of squad.userData.members){const mode=m.userData._forage?.mode||'none';modes[mode]=(modes[mode]||0)+1;if(!m.position.toArray().every(Number.isFinite))nonfinite++;}
 }
 const feedsAfter=squad.userData._forageDuty?.feeds||0;
 return {simulationSeconds:600,modes,feedsBefore,feedsAfter,nectarFrames,nonfinite,minScanDistance,whaleLockActive:!!squad.userData.whaleLock?.active,scan:squad.userData._swampScan,patrol:squad.userData._patrolCenter?.toArray(),passed:feedsAfter>feedsBefore&&!!modes.hover&&!!modes.depart&&nonfinite===0,limits:['Isolated actual factory updates, not realtime player session','No forced discovery or nectar injected','Geometry collision not covered']};
 });
 report.pageErrors=errors;report.passed&&=errors.length===0;
 await writeFile('TigerMessenger/artifacts/pipeline/swamp-v2-fifty-rounds/'+(process.argv[2]||'r02')+'/feeding-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
