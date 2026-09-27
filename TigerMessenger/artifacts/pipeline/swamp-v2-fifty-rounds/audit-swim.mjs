import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const wrap=window.__tm.messenger.landmarks.moebiusSwamp,s=wrap.userData.inner||wrap;
  const whales=s.userData.whales;
  const roots=[];s.traverse(o=>{if(o.name==='v2-floor-root'){o.geometry.computeBoundingBox();roots.push({min:o.geometry.boundingBox.min.toArray(),max:o.geometry.boundingBox.max.toArray()});}});
  const result=whales.map(()=>({samples:0,maxPositionError:0,finite:true,minY:Infinity,maxY:-Infinity,minTreeAxisDistance:Infinity}));
  // Run the actual factory update in this disposable browser, not a replacement trajectory.
  for(let i=0;i<=7200;i++){
   const t=i/60;s.update(1/60,t,{});
   whales.forEach((w,k)=>{
    const r=result[k],v=w.userData.swim,angle=v.phase+t*v.speed;
    r.samples++;r.maxPositionError=Math.max(r.maxPositionError,Math.hypot(w.position.x-v.cx-Math.cos(angle)*v.rx,w.position.z-v.cz-Math.sin(angle)*v.rz));
    r.finite&&=[...w.position.toArray(),...w.rotation.toArray().slice(0,3)].every(Number.isFinite);
    r.minY=Math.min(r.minY,w.position.y);r.maxY=Math.max(r.maxY,w.position.y);
    r.minTreeAxisDistance=Math.min(r.minTreeAxisDistance,Math.hypot(w.position.x+8,w.position.z+7));
   });
  }
  return {round:s.userData.swampV2Round,simulationSeconds:120,roots,whales:result,passed:result.length===2&&result.every(r=>r.finite&&r.maxPositionError<1e-6),limits:['Factory animation sampled in disposable browser; not realtime end-to-end gameplay.','Tree-axis distance measures whale origin only, not mesh clearance.','Aircraft feeding, tiger drinking, repair and delivery actions not validated here.']};
 });
 report.pageErrors=errors;report.passed&&=errors.length===0;
 await writeFile('TigerMessenger/artifacts/pipeline/swamp-v2-fifty-rounds/'+(process.argv[2]||'r02')+'/swim-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
