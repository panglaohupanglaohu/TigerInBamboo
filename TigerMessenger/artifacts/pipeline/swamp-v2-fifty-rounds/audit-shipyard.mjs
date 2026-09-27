import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000});
 const report=await page.evaluate(()=>{
 const wrap=window.__tm.messenger.landmarks.moebiusSwamp,s=wrap.userData.inner||wrap,y=s.userData.shipyard;
 const drops=y.dock.children.filter(n=>n.isSprite&&Number.isInteger(n.userData.seed));let dropSamples=0,nonfiniteDrops=0,nearRecipientFrames=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<7200;i++){s.update(1/60,i/60,{});for(const d of drops)if(d.visible){dropSamples++;if(d.userData.deliveryTarget&&d.position.distanceTo(d.userData.deliveryTarget)<.06)nearRecipientFrames++;if(!d.position.toArray().every(Number.isFinite))nonfiniteDrops++;}const v=[y.mastPivot.rotation.z,y.workers[0].userData.armL.rotation.x,y.waterLizard.position.x];v.forEach((n,k)=>{min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);});}
 const range=max.map((n,k)=>n-min[k]);return {waterDropCount:drops.length,nearRecipientFrames,dropSamples,nonfiniteDrops,simulationSeconds:120,min,max,range,visible:y.dock.visible,attached:!!y.dock.parent,oceanOccluded:!!y.dock.userData.officialOceanOccluded,passed:dropSamples>0&&nonfiniteDrops===0&&nearRecipientFrames>0&&range[0]>1&&range[1]>1&&range[2]>2&&!!y.dock.parent&&!y.dock.userData.officialOceanOccluded,limits:['Tracks actual mast, monkey arm, lizard movement; water delivery contact and visual occlusion are separate checks.']};
 });
 report.pageErrors=errors;report.passed&&=errors.length===0;
 await writeFile('TigerMessenger/artifacts/pipeline/swamp-v2-fifty-rounds/'+(process.argv[2]||'r02')+'/shipyard-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
