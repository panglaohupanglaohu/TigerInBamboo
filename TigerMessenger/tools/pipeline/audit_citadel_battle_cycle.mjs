import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
  await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});
  await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
  await page.evaluate(()=>{const t=window.__tm;t.P.timeOfDay=.6;t.P.daySpeed=0;t.messenger.landmarks.saihojiPhalanx.root.userData.debugSiege();});
  const samples=[];
  for(let interval=0;interval<12;interval++){
    const wallStart=performance.now();
    samples.push(await page.evaluate(interval=>{
      const t=window.__tm,b=t.messenger.landmarks.saihojiPhalanx;
      // Advance the existing day/night input at minute one. No victory or
      // death flags are injected; all attacks and casualties remain enabled.
      t.P.timeOfDay=interval>=6?.9:.6;
      for(let frame=0;frame<600;frame++)b.update(1/60,interval*10+frame/60);
      const counts={},invalidRotations=[],blue=[];
      b.root.traverse(s=>{
        if(!s.userData.phalanxRole)return;
        const key=`${s.userData.helmSide}-${s.userData.dead?'dead':s.userData.downed?'downed':s.userData.siegeStage||'guard'}`;
        counts[key]=(counts[key]||0)+1;
        if(s.visible&&!s.userData.dead&&Math.abs(s.quaternion.length()-1)>.0001)invalidRotations.push(s.userData.uid);
        if(s.userData.siegeEntryRoute)blue.push({uid:s.userData.uid,index:s.userData.stairPointIndex||0,stage:s.userData.siegeStage,dead:!!s.userData.dead});
      });
      return {seconds:(interval+1)*10,status:b.root.userData.campaignStatus,blockedShots:b.root.userData.blockedCitadelShots||0,wallHits:b.root.userData.citadelArrowWallHits||0,marchWaits:b.root.userData.citadelMarchWaits||0,counts,invalidRotations,maxRouteIndex:Math.max(0,...blue.map(s=>s.index)),blue};
    },interval));
    samples.at(-1).processingMs=performance.now()-wallStart;
    console.log(JSON.stringify({processingMs:Math.round(samples.at(-1).processingMs),seconds:samples.at(-1).seconds,status:samples.at(-1).status,maxRouteIndex:samples.at(-1).maxRouteIndex}));
  }
  await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/battle-cycle-audit.json',import.meta.url),JSON.stringify({scope:'120s of actual Web combat at 60Hz, debug entry and explicit day/night input. Not normal campaign arrival, full playthrough or Godot combat.',samples,errors,passed:!errors.length&&samples.every(s=>!s.invalidRotations.length)&&samples.at(-1).status.phase==='done'},null,2));
  if(errors.length||samples.some(s=>s.invalidRotations.length)||samples.at(-1).status.phase!=='done')process.exitCode=1;
}finally{await browser.close();}
