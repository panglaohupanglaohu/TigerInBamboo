import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/socco-web-berth/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:120000});
 const report=await page.evaluate(async(testFrames)=>{
   const T=window.__tm.THREE;
   const {createSoccoBerthSolver}=await import('/TigerMessenger/src/world/soccoBerth.js');
   const {createSoccoCraft,setSoccoRamp,soccoRampReady,soccoRampFootWorld,soccoBoardingPoint,updateSoccoSeaSkim}=await import('/TigerMessenger/src/world/gateHaulerCraft.js');
   const checks=[],check=(name,passed,detail)=>checks.push({name,passed,...(detail===undefined?{}:{detail})});
   const sea=160.5,scene=new T.Scene(),terrain=new T.Mesh(new T.BoxGeometry(50,.4,50),new T.MeshBasicMaterial());
   terrain.name='mossy-terrain';terrain.position.y=160.9;scene.add(terrain);
   const craft=createSoccoCraft();scene.add(craft);
   const solver=createSoccoBerthSolver(scene,sea),up=new T.Vector3(0,1,0),inland=new T.Vector3(0,161,-9).normalize();
   const result=solver.solve(craft,up,inland);
   check('dry terrain berth found',result.valid,{attempts:result.attempts});
   if(result.valid){
     craft.position.copy(result.position);craft.quaternion.copy(result.quaternion);
     setSoccoRamp(craft,1,result.groundLocalY);scene.updateMatrixWorld(true);
     const tip=soccoRampFootWorld(craft),hit=solver.sample(tip);
     check('actual tip meets terrain',hit&&tip.distanceTo(hit)<.04,{error:hit?tip.distanceTo(hit):null});
     check('proper handedness',new T.Matrix4().makeRotationFromQuaternion(craft.quaternion).determinant()>.999);
     const position=craft.position.clone();updateSoccoSeaSkim(craft,{t:10,speed:0});
     check('moored effects do not lower craft',craft.position.distanceTo(position)===0);
     check('ground resolved and ramp ready',soccoRampReady(craft)&&craft.userData.soccoRampGroundStatus==='resolved-local-ground');
     setSoccoRamp(craft,.9,result.groundLocalY);check('partially open board cannot unload',!soccoRampReady(craft));setSoccoRamp(craft,1,result.groundLocalY);
     let maxGap=0,minGap=Infinity,misses=0;
     const down=new T.Vector3(0,-1,0).applyQuaternion(craft.quaternion),ray=new T.Raycaster();
     for(let seat=0;seat<14;seat++)for(let step=0;step<=30;step++){
       const point=soccoBoardingPoint(craft,seat,step/30),origin=point.clone().addScaledVector(down,-.3);
       ray.set(origin,down);ray.far=1;
       const hit=ray.intersectObject(craft,true).find(h=>{for(let n=h.object;n&&n!==craft;n=n.parent)if(!n.visible)return false;return true;});
       if(!hit)misses++;else {maxGap=Math.max(maxGap,Math.abs(hit.distance-.3));minGap=Math.min(minGap,hit.distance-.3);}
     }
     check('14 seat routes supported by actual candidate surfaces',misses===0&&maxGap<.3&&minGap>=-.001,{samples:14*31,misses,maxGap,minGap,scope:'Root path support, not full body or foot IK'});
   }
   const rock=new T.Mesh(new T.BoxGeometry(5,5,5),new T.MeshBasicMaterial());
   rock.userData.kind='gardenStone:standing';
   rock.position.copy(new T.Vector3(0,-1,-5).applyMatrix4(new T.Matrix4().compose(result.position,result.quaternion,craft.scale)));
   scene.add(rock);const rockPosition=rock.position.toArray();
   const avoided=solver.solve(craft,up,inland);
   check('blocked rear exit selects another position or heading',avoided.valid&&(avoided.position.distanceTo(result.position)>1||avoided.quaternion.angleTo(result.quaternion)>.1),{attempts:avoided.attempts});
   check('authored obstacle remains unchanged',JSON.stringify(rock.position.toArray())===JSON.stringify(rockPosition));
   scene.remove(rock);
   terrain.geometry.dispose();terrain.geometry=new T.SphereGeometry(159,32,16);terrain.position.set(0,0,0);const water=solver.solve(craft,up,inland);
   check('submerged terrain rejected',!water.valid);
   scene.remove(terrain);check('missing terrain rejected',!solver.solve(craft,up,inland).valid);
   // Run the real mission state machine in a separately launched test browser.
   // begin is a diagnostic start, not evidence of natural fleet-hit triggering.
   const assault=window.__tm.messenger.vanguardAssault;
   const {saihoujiHubDir}=await import('/TigerMessenger/src/world/saihojiPhalanx.js');
   const {PLANET_RADIUS}=await import('/TigerMessenger/src/world/planet.js');
   const {OFFICIAL_OCEAN_SEA_LEVEL}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
   const realSolver=createSoccoBerthSolver(window.__tm.scene,PLANET_RADIUS+OFFICIAL_OCEAN_SEA_LEVEL);
   window.__tm.scene.updateMatrixWorld(true);
   const groundDiagnostic={radius:PLANET_RADIUS,sea:OFFICIAL_OCEAN_SEA_LEVEL,terrainCount:realSolver.terrainCount,hub:saihoujiHubDir().toArray(),hit:realSolver.sample(saihoujiHubDir())?.toArray()};
   const began=assault.begin(saihoujiHubDir());
   const troops=[];window.__tm.scene.traverse(o=>{if(Number.isFinite(o.userData.uid)&&o.userData.parts?.legL)troops.push(o);});
   const byUid=new Map(troops.map(tr=>[tr.userData.uid,tr]));
   let capture=null,returnCapture=null,maxOutbound=0,maxInbound=0,maxRotationError=0,minReturnSpacing=Infinity;
   for(let i=0;i<testFrames;i++){
     assault.update(1/60,i/60);
     for(const tr of troops)if(tr.visible&&!tr.userData.aboard)maxRotationError=Math.max(maxRotationError,Math.abs(1-tr.quaternion.lengthSq()));
     for(const h of assault.stats().transport||[]){
       maxOutbound=Math.max(maxOutbound,h.roster.filter(e=>e.state==='walk'&&!e.dead).length);
       maxInbound=Math.max(maxInbound,h.roster.filter(e=>e.returningOnRamp&&!e.dead).length);
       if(i%10===0){
         const returning=h.roster.filter(e=>e.returning&&!e.dead);
         for(let a=0;a<returning.length;a++)for(let b=a+1;b<returning.length;b++){
           const first=byUid.get(returning[a].uid),second=byUid.get(returning[b].uid);
           if(first&&second)minReturnSpacing=Math.min(minReturnSpacing,first.position.distanceTo(second.position));
         }
       }
     }
     const c=window.__tm.scene.getObjectByName('vanguard-hauler-0');
     if(!returnCapture&&assault.phase()==='withdraw'&&assault.stats().transport?.[0]?.roster.some(e=>e.returningOnRamp)){
       c.updateWorldMatrix(true,true);const {camera,renderer,scene}=window.__tm;
       camera.position.copy(c.localToWorld(new T.Vector3(0,5,-8)));
       camera.up.set(0,1,0).applyQuaternion(c.quaternion);
       camera.lookAt(c.localToWorld(new T.Vector3(0,-1,-3)));camera.updateMatrixWorld(true);
       renderer.render(scene,camera);returnCapture=renderer.domElement.toDataURL('image/png');
     }
     const outboundOnRamp=assault.phase()==='insert'&&c&&assault.stats().transport?.[0]?.roster.some(e=>{
       if(e.state!=='walk')return false;
       const tr=byUid.get(e.uid);if(!tr)return false;
       const local=c.worldToLocal(tr.getWorldPosition(new T.Vector3()));
       return local.z< -3.2&&local.z> -5.2;
     });
     if(!capture&&outboundOnRamp&&c?.userData.soccoBerth?.valid&&c.userData.soccoRampOpen>=.99){
       c.updateWorldMatrix(true,true);const {camera,renderer,scene}=window.__tm;
       camera.position.copy(c.localToWorld(new T.Vector3(0,7,-6.5)));
       camera.up.set(0,1,0).applyQuaternion(c.quaternion);
       camera.lookAt(c.localToWorld(new T.Vector3(0,-1,-3)));camera.updateMatrixWorld(true);
       renderer.render(scene,camera);capture=renderer.domElement.toDataURL('image/png');
     }
   }
   const ships=[];window.__tm.scene.traverse(o=>{if(/^vanguard-hauler-/.test(o.name))ships.push({name:o.name,berth:o.userData.soccoBerth,groundStatus:o.userData.soccoRampGroundStatus,finite:o.matrixWorld.elements.every(Number.isFinite)});});
   check('production mission updated finite craft',ships.length===3&&ships.every(s=>s.finite));
   check('all three actual berths resolved',ships.length===3&&ships.every(s=>s.berth?.valid&&s.groundStatus==='resolved-local-ground'));
   check('actual unloading frame rendered',!!capture);
   check('actual return through ramp frame rendered',!!returnCapture);
   check('one outbound and inbound soldier per ramp',maxOutbound===1&&maxInbound===1,{maxOutbound,maxInbound});
   check('live troop orientations stay valid rotations',troops.length===27&&maxRotationError<1e-6,{troops:troops.length,maxRotationError});
   check('same-carrier returning roots retain clearance',Number.isFinite(minReturnSpacing)&&minReturnSpacing>=.75,{minReturnSpacing,scope:'Root centers during boarding return, not full-body or all battlefield crowds'});
   const transport=assault.stats().transport;
   const roster=transport.flatMap(h=>h.roster);
   const accounting={assigned:roster.length,departed:roster.filter(e=>e.departed).length,returned:roster.filter(e=>e.returned).length,forced:roster.filter(e=>e.forcedReturn).length,dead:roster.filter(e=>e.dead).length,unresolved:roster.filter(e=>!e.returned&&!e.forcedReturn&&!e.dead).length};
   check('each transport identity accounted without duplicate seats',new Set(roster.map(e=>e.uid)).size===roster.length&&transport.every(h=>new Set(h.roster.map(e=>e.seat)).size===h.roster.length),accounting);
   check('normal diagnostic recovers all 21 through ramps without timeout fallback',accounting.assigned===21&&accounting.departed===21&&accounting.returned===21&&accounting.forced===0&&accounting.unresolved===0,accounting);
   check('all shore routes integrated and bounded',transport.every(h=>!h.cancelled&&h.groundRoutes==='resolved'&&h.roster.every(e=>e.routeLength>0&&e.routeLength<=12)));
   check('all exact return paths resolve without vertical relocation',roster.every(e=>e.returnPathStatus==='resolved'&&e.returnPathStartCorrection<.08),{maxStartCorrection:Math.max(...roster.map(e=>e.returnPathStartCorrection||0))});
   return {checks,ships,began,capture,returnCapture,groundDiagnostic,transport,accounting,phase:assault.phase(),scope:'Synthetic dry/submerged terrain plus real mission diagnostic begin; not natural combat acceptance'};
 },Number(process.env.BERTH_TEST_FRAMES||12000));
 report.errors=errors;report.passed=errors.length===0&&report.checks.every(c=>c.passed);
 if(report.capture){await writeFile(new URL('actual-unloading.png',output),Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;}
 if(report.returnCapture){await writeFile(new URL('actual-return.png',output),Buffer.from(report.returnCapture.split(',')[1],'base64'));delete report.returnCapture;}
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),accounting:report.accounting,phase:report.phase,errors}));if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
