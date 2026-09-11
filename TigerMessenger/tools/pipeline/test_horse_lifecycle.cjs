const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await browser.newPage();await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
 const api=window.__tm.messenger.landmarks.citadelRange.nightInfiltration;
 const records=api.root.userData.groups.flatMap(g=>g.userData.records);
 const cycles=[];
 for(const duration of [1,35,180]){
  api.reset();api.update(0,0,.5);
  for(let t=0;t<duration;t+=1/30)api.update(1/30,t,.9);
  const deployed=records.filter(r=>r.soldier.visible).length;
  const before=records.map(r=>r.soldier.position.clone());
  api.update(1/30,duration,.5);
  const paths=records.filter(r=>!r.returnSkip).map(r=>({points:r.returnPath.points.length,length:r.returnPath.total,duration:r.returnWalkDuration}));
  let peakStep=0,frames=0;
  const last=records.map(r=>r.soldier.position.clone());
  for(let i=0;i<records.length;i++)if(records[i].soldier.visible)peakStep=Math.max(peakStep,before[i].distanceTo(last[i]));
  while(api.getState().returning&&frames<30000){
   api.update(1/30,duration+frames/30,.5);frames++;
   for(let i=0;i<records.length;i++){
    if(records[i].soldier.visible)peakStep=Math.max(peakStep,last[i].distanceTo(records[i].soldier.position));
    last[i].copy(records[i].soldier.position);
   }
  }
  const state=api.getState();
  cycles.push({nightDuration:duration,deployed,paths,peakStep,returnSeconds:frames/30,insideHorse:state.insideHorse,active:state.active,returning:state.returning,passed:deployed>0&&!state.active&&!state.returning&&state.insideHorse===8&&peakStep<.15});
 }
 return {cycles,passed:cycles.every(c=>c.passed),scope:'Actual mounted Web controller: partial descent, mid-approach, patrol, dawn return and repeated next night. Position continuity and reset only; not full combat or capsule collision.'};
 });
 const out=path.resolve(__dirname,'../../artifacts/pipeline/citadel-plaza-horse');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/web-night-lifecycle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
