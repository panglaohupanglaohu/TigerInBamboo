const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const page=await b.newPage();await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__freezeGround&&cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 await page.evaluate(()=>window.__freezeGround=true);await page.waitForTimeout(100);
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{createCitadelPlayerGround}=await import('/TigerMessenger/src/world/citadel/playerGround.js'),{resolveCollisions}=await import('/TigerMessenger/src/world/collision.js');
  const tm=window.__tm,city=tm.scene.getObjectByName('highland-west-city');let castle;tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  const {createCitadelPlayerWalls}=await import('/TigerMessenger/src/world/citadel/playerWalls.js');
  const walls=createCitadelPlayerWalls(city);
  const ground=createCitadelPlayerGround(city),failures=[];let samples=0,maxError=0;
  for(const route of [city.userData.walkRoute,city.userData.harborRoute])for(const p of route){
   const expected=castle.localToWorld(new T.Vector3(...p)),position=expected.clone().addScaledVector(expected.clone().normalize(),-.04),velocity=new T.Vector3();
   const body={onGround:true};resolveCollisions(position,velocity,1/120,tm.platforms,body,()=>{},tm.hills,ground);
   const error=position.distanceTo(expected);maxError=Math.max(maxError,error);samples++;
   if(error>.12)failures.push({point:p,error});
  }
  const under=castle.localToWorld(new T.Vector3(8,16,8)),underHeight=ground(under);
  const noUpperSnap=underHeight!==null&&Math.abs(underHeight-under.length())<.12;
  const wallCases=[];
  for(const [name,a,b,expect] of [
   ['gate-front',[3,16,15],[3,16,9],true],['gate-back',[3,16,7],[3,16,14],true],
   ['doorway',[8,16,15],[8,16,8],false],['court-guard',[11,17.5,5.5],[13,17.5,5.5],true]
  ]){
   const prev=castle.localToWorld(new T.Vector3(...a)),next=castle.localToWorld(new T.Vector3(...b)),v=next.clone().sub(prev);
   const blocked=walls(prev,next,v);wallCases.push({name,blocked,expect,passed:blocked===expect});
  }
  let routeBlocked=0;
  for(const route of [city.userData.walkRoute])for(let i=1;i<route.length;i++){
   const a=new T.Vector3(...route[i-1]),b=new T.Vector3(...route[i]),n=Math.ceil(a.distanceTo(b)/.08);
   for(let j=0;j<n;j++){
    const prev=castle.localToWorld(a.clone().lerp(b,j/n)),next=castle.localToWorld(a.clone().lerp(b,(j+1)/n));
    if(walls(prev,next,new T.Vector3()))routeBlocked++;
   }
  }
  return {wallCases,routeBlocked,samples,maxError,noUpperSnap,failures:failures.slice(0,10),passed:!failures.length&&noUpperSnap&&wallCases.every(r=>r.passed)&&routeBlocked===0,scope:'Production resolveCollisions using mounted scene platforms and hills at route samples; ground contact plus authored wall/guard swept samples and clear route; not real keyboard traversal or exact capsule contact.'};
 });fs.writeFileSync('TigerMessenger/artifacts/pipeline/citadel-plaza-horse/web-player-ground.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
