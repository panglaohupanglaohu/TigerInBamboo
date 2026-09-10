import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/socco-battlefield-return/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
   const T=window.__tm.THREE,{scene}=window.__tm,assault=window.__tm.messenger.vanguardAssault;
   const {saihoujiHubDir}=await import('/TigerMessenger/src/world/saihojiPhalanx.js');
   const {createSoccoBerthSolver}=await import('/TigerMessenger/src/world/soccoBerth.js');
   const {createSoccoGroundRoutes}=await import('/TigerMessenger/src/world/soccoGroundRoutes.js');
   const checks=[],check=(name,passed,detail)=>checks.push({name,passed,detail});
   assault.begin(saihoujiHubDir());let frame=0;
   for(;frame<9000&&assault.phase()!=='combat';frame++)assault.update(1/60,frame/60);
   check('actual mission reaches combat before return',assault.phase()==='combat');
   let troop=null;scene.traverse(o=>{if(o.userData.uid===6&&o.userData.parts?.legL)troop=o;});
   const craft=scene.getObjectByName('vanguard-hauler-0'),goal=troop.position.clone();
   const terrain=createSoccoBerthSolver(scene,160.5),nav=createSoccoGroundRoutes(scene,terrain,craft);
   const up=goal.clone().normalize(),east=new T.Vector3(0,1,0).cross(up).normalize(),north=up.clone().cross(east).normalize();
   let selected=null;
   for(const distance of [5,7,9,11]){
     for(let heading=0;heading<12;heading++){
       const angle=heading*Math.PI/6,candidate=terrain.sample(goal.clone().addScaledVector(east,Math.cos(angle)*distance).addScaledVector(north,Math.sin(angle)*distance));
       if(!candidate)continue;candidate.addScaledVector(candidate.clone().normalize(),.06);
       if(!nav.clear(candidate,candidate)||nav.clear(candidate,goal))continue;
       const route=nav.planReturn(candidate,goal,{maxDistance:18,maxVisits:600});
       if(route.valid&&route.length>candidate.distanceTo(goal)+.6&&route.length<=12){selected={start:candidate,route};break;}
     }
     if(selected)break;
   }
   check('real garden offers a blocked direct line with a safe detour',!!selected);
   if(!selected)return {checks,scope:'Diagnostic combat entry; no suitable displaced start found'};
   // Deliberate test setup only: position one living soldier at a verified dry
   // battlefield point. The production return updater must do every later step.
   troop.position.copy(selected.start);assault.triggerWithdraw();
   let inspected=0,blocked=0,maxStep=0,maxStepDetail=null,last=null,arrivalError=null,capture=null;
   for(let i=0;i<12000;i++,frame++){
     assault.update(1/60,frame/60);
     const entry=assault.stats().transport.flatMap(h=>h.roster).find(e=>e.uid===6);
     if(assault.phase()==='withdraw'&&entry?.returnPathStatus==='resolved'&&!entry.returning&&!entry.returned&&!entry.forcedReturn){
       inspected++;if(!nav.clear(troop.position,troop.position))blocked++;
       if(last){const step=troop.position.distanceTo(last);if(step>maxStep){maxStep=step;maxStepDetail={from:last.toArray(),to:troop.position.toArray(),heightChange:troop.position.length()-last.length()};}}last=troop.position.clone();
       arrivalError=troop.position.distanceTo(goal);
       if(!capture&&inspected>35){
         const {camera,renderer}=window.__tm;
         camera.position.copy(troop.position).addScaledVector(up,7).addScaledVector(north,6);
         camera.up.copy(up);camera.lookAt(troop.position);camera.updateMatrixWorld(true);
         renderer.render(scene,camera);capture=renderer.domElement.toDataURL('image/png');
       }
     }
     if(assault.phase()==='done')break;
   }
   const transport=assault.stats().transport,roster=transport.flatMap(h=>h.roster),entry=roster.find(e=>e.uid===6);
   check('production updater uses a nonzero exact return path',entry?.returnPathStatus==='resolved'&&entry.returnPathLength>5,entry);
   check('actual return avoids solids with continuous movement',inspected>100&&blocked===0&&maxStep<.08,{inspected,blocked,maxStep,maxStepDetail});
   check('reserved assembly point reached before boarding',arrivalError!==null&&arrivalError<.08,{arrivalError});
   check('all 21 recover without timeout after the detour',roster.length===21&&roster.every(e=>e.departed&&e.returned&&!e.forcedReturn));
   check('actual battlefield return frame captured',!!capture);
   return {checks,entry,capture,transport,selected:{start:selected.start.toArray(),goal:goal.toArray(),directDistance:selected.start.distanceTo(goal),routeLength:selected.route.length,points:selected.route.points.map(p=>p.toArray())},scope:'Actual garden and mission updater with one deliberately displaced living soldier; not natural combat or whole-world dynamic avoidance'};
 });
 if(report.capture){await writeFile(new URL('actual-detour.png',output),Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;}
 report.errors=errors;report.passed=errors.length===0&&report.checks.every(c=>c.passed);
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors}));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
