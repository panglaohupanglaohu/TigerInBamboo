import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'artifacts/pipeline/saihoji-ambush-web',new Date().toISOString().replaceAll(':','-'));
await mkdir(output,{recursive:true});
const sourceFiles=['src/world/saihojiPhalanx.js','src/world/saihojiAmbush.js','src/scenes/saihojiGarden.js','src/world/vanguardAssault.js','src/world/saihojiPineLayout.js','src/assets/saihojiPineOptimized.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')])));
const before=await hashes(),errors=[];const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let report;
try {
 const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.messenger?.landmarks?.saihojiPhalanx,null,{timeout:180000});
 report=await page.evaluate(async()=>{
  const T=window.__tm.THREE,{createSaihojiAmbush}=await import('/TigerMessenger/src/world/saihojiAmbush.js');
  const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail:JSON.parse(JSON.stringify(detail))})});
  const fixtureScene=new T.Scene(),anchor=new T.Group(),unit=new T.Group();fixtureScene.add(anchor,unit);anchor.position.y=160;const body=new T.Group();unit.add(body);unit.position.set(0,160,0);unit.userData.parts={body};
  const localPoint=new T.Vector3(0,0,0),controller=createSaihojiAmbush({getCoverPoints:()=>[{id:'fixture',anchor,localPoint}]});
  for(let i=0;i<600;i++)controller.update(1/60,{units:[unit],allLanded:true,discovery:{detected:false}});
  check('time alone cannot discover whale or ambush',controller.state.stage==='concealed'&&controller.events.every(e=>e.to!=='discovered'));
  check('concealment retains visible actor and lowers body pose',unit.visible&&unit.userData.ambushConcealed&&body.position.y<0);
  anchor.position.x+=2;controller.update(1/60,{units:[unit],allLanded:true});check('concealed actor follows moving cover anchor',Math.abs(unit.position.x-2)<1e-8);
  controller.update(1/60,{units:[unit],allLanded:true,discovery:{detected:true,source:'fixture-explicit'}});check('discovery event distinct from ambush',controller.state.stage==='discovered');
  controller.update(1/60,{units:[unit],allLanded:true});check('ambush restores body pose and identity',controller.active&&body.position.y===0&&unit.visible);
  controller.reset();check('reset clears event and pose state',controller.state.stage==='landing'&&controller.events.length===0&&!unit.userData.ambushConcealed);
  const walking=new T.Group();fixtureScene.add(walking);walking.position.set(-10,160,0);const movingCover=createSaihojiAmbush({getCoverPoints:()=>[{id:'moving',anchor,localPoint}]});movingCover.update(1/60,{units:[walking]});const yBefore=walking.position.y;anchor.position.y+=4;movingCover.update(1/60,{units:[walking]});check('approaching soldier does not inherit island lift',Math.abs(walking.position.y-yBefore)<.057);
  const casualtyController=createSaihojiAmbush({getCoverPoints:()=>[{id:'casualty',point:unit.position.clone()}]});for(let i=0;i<120;i++)casualtyController.update(1/60,{units:[unit],allLanded:true});unit.userData.dead=true;body.position.y=-.25;casualtyController.applyConcealmentPose();check('concealment presentation respects casualty pose',body.position.y===-.25);unit.userData.dead=false;casualtyController.reset();
  const missing=createSaihojiAmbush({getCoverPoints:()=>[]});for(let i=0;i<200;i++)missing.update(.1,{units:[unit],allLanded:true,discovery:{detected:true}});check('insufficient real cover blocks instead of hiding or attacking',missing.state.blocked==='cover-capacity'&&!missing.active&&unit.visible);
  const {scene,messenger,sceneHandles}=window.__tm,battle=messenger.landmarks.saihojiPhalanx,garden=sceneHandles.find(h=>h.id==='saihoji'),fleet=scene.getObjectByName('moebius-aircraft-squad'),whale=scene.getObjectByName('leviathanGroup');
  const {saihoujiHubDir}=await import('/TigerMessenger/src/world/saihojiPhalanx.js');
  const hub=saihoujiHubDir(),cover=whale?.userData.saihojiCoverPoints||[];
  check('actual garden has at least 50 anchored cover slots',cover.length>=50&&cover.every(p=>p.anchor&&p.localPoint),{count:cover.length});
  if(cover.length<50)return {checks,passed:false,blocked:'actual-cover-provider-not-ready'};
  battle.reset();const assault=messenger.vanguardAssault,initialAssaultPhase=assault.phase();
  const far=hub.clone().applyAxisAngle(new T.Vector3(0,1,0),1.6).multiplyScalar(185),near=hub.clone().multiplyScalar(185);
  fleet.userData._patrolCenter=near.clone();
  const ambush=battle.root.userData.saihojiAmbush;
  let clock=0,concealedAt=null,discoveredAt=null,ambushAt=null,hiddenActors=[],concealedCapture=null,ambushCapture=null;
  let earlyLiftMax=0,earlyHeavy=false;
  for(let frame=0;frame<15000;frame++) {
   clock+=1/60;garden.update(1/60,clock);battle.update(1/60,clock);
   earlyLiftMax=Math.max(earlyLiftMax,garden.whaleLift01());earlyHeavy ||= assault.phase()!==initialAssaultPhase;
   if(ambush.state.stage==='concealed'){concealedAt=frame;break;}
  }
  check('early nearby fleet cannot reveal whale before troops hide',concealedAt!==null&&earlyLiftMax<1e-6&&!earlyHeavy,{earlyLiftMax,earlyHeavy,concealedAt});
  // Pull the diagnostic fleet away at the exact concealed transition to also
  // verify a genuine waiting interval without a current discovery condition.
  fleet.userData._patrolCenter.copy(far);
  battle.root.traverse(o=>{if(o.userData.ambushConcealed)hiddenActors.push(o);});
  const allVisible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
  check('actual traditional ship troops reach concealment',concealedAt!==null&&hiddenActors.length===50,{concealedAt,state:ambush.state,actors:hiddenActors.length});
  const clearance=hiddenActors.map(s=>{s.updateWorldMatrix(true,true);const foot=s.getWorldPosition(new T.Vector3()),slot=cover.find(c=>c.id===s.userData.ambushCoverId),up=new T.Vector3(0,1,0).applyQuaternion(slot.anchor.getWorldQuaternion(new T.Quaternion())),v=new T.Vector3();let top=0;s.traverse(o=>{if(!o.isMesh||o.userData.isOutline||!allVisible(o))return;const a=o.geometry.attributes.position;if(!a)return;for(let i=0;i<a.count;i++)top=Math.max(top,v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).sub(foot).dot(up));});const actorUp=new T.Vector3(0,1,0).applyQuaternion(s.getWorldQuaternion(new T.Quaternion()));const footOffset=.04*slot.anchor.getWorldScale(new T.Vector3()).y;return {footOffset,upDot:actorUp.dot(up),uid:s.userData.uid,role:s.userData.phalanxRole,top,clearance:slot?.clearance??null,margin:slot?.clearance==null?null:slot.clearance-footOffset-top};});
  check('concealed actors stand on island local up',clearance.length===50&&clearance.every(c=>c.upDot>.9999),{minDot:Math.min(...clearance.map(c=>c.upDot))});
  check('concealed visible equipment fits below measured canopy',clearance.length===50&&clearance.every(c=>c.margin!==null&&c.margin>=.025),clearance);
  check('all 50 initial troops are blue and genuinely present',hiddenActors.length===50&&hiddenActors.every(s=>s.userData.helmSide==='blue'&&allVisible(s)));
  const identity=hiddenActors.map(s=>s.uuid),beforeShots=battle.root.userData.arrowsFired||0;
  const capture=()=>{const {camera,renderer}=window.__tm,p=(hiddenActors.find(s=>s.userData.phalanxRole==='longbow'&&!s.userData.ropeTeam&&!s.userData.dead)||hiddenActors[0])?.getWorldPosition(new T.Vector3());if(!p)return null;const normal=p.clone().normalize(),east=new T.Vector3().crossVectors(normal,new T.Vector3(0,1,0)).normalize();camera.position.copy(p).addScaledVector(normal,5).addScaledVector(east,8);camera.up.copy(normal);camera.lookAt(p);camera.updateMatrixWorld(true);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};
  if(concealedAt!==null)concealedCapture=capture();
  for(let i=0;i<600;i++){clock+=1/60;garden.update(1/60,clock);battle.update(1/60,clock);}
  check('actual ten-second hidden wait fires no arrows and no heavy deployment',ambush.state.stage==='concealed'&&(battle.root.userData.arrowsFired||0)===beforeShots&&assault.phase()===initialAssaultPhase,{stage:ambush.state.stage,arrows: battle.root.userData.arrowsFired||0,assaultPhase:assault.phase()});
  // Diagnostic fleet positioning only: garden must physically raise whale and
  // set its real lock. No discovery flag, whale lift or battle phase is written.
  fleet.userData._patrolCenter.copy(near);
  const members=(fleet.userData.members||[]).filter(m=>m.parent);
  members.forEach((m,i)=>{const p=near.clone().add(new T.Vector3((i-1)*3,0,0));m.parent.worldToLocal(p);m.position.copy(p);});
  for(let frame=0;frame<4500;frame++) {
   clock+=1/60;garden.update(1/60,clock);battle.update(1/60,clock);
   if(ambush.state.stage==='discovered'&&discoveredAt===null)discoveredAt=frame;
   if(ambush.state.stage==='ambush'){ambushAt=frame;break;}
  }
  check('actual whale rise and fleet lock drive discovery',discoveredAt!==null&&ambushAt>discoveredAt&&garden.whaleLift01()>0&&fleet.userData.whaleLock?.active,{discoveredAt,ambushAt,lift:garden.whaleLift01(),whaleRadius:whale.position.length(),events:ambush.events});
  check('ambush itself does not start heavy drop',assault.phase()===initialAssaultPhase,{assaultPhase:assault.phase()});
  for(let frame=0;frame<900;frame++){clock+=1/60;garden.update(1/60,clock);battle.update(1/60,clock);}
  check('ambush resumes original traditional attack and preserves soldiers',identity.every(id=>battle.root.getObjectByProperty('uuid',id))&&(battle.root.userData.arrowsFired||0)>beforeShots,{arrows:battle.root.userData.arrowsFired||0,initialArrows:beforeShots});
  ambushCapture=capture();
  return {checks,passed:checks.every(c=>c.passed),state:ambush.state,events:ambush.events,concealedCapture,ambushCapture,scope:'Actual Web scene and real garden/battle updates with diagnostic fleet position. Not a naturally timed whole-game fleet tour; Godot not changed.'};
 });
}catch(error){report={checks:[],passed:false,error:String(error)};}finally{await browser.close();}
report.errors=errors;report.passed&&=errors.length===0;report.sourceBefore=before;report.sourceAfter=await hashes();report.sourceStable=JSON.stringify(before)===JSON.stringify(report.sourceAfter);report.passed&&=report.sourceStable;
for(const key of ['concealedCapture','ambushCapture'])if(report[key]){await writeFile(path.join(output,key+'.png'),Buffer.from(report[key].split(',')[1],'base64'));delete report[key];}
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.checks.filter(c=>!c.passed),sourceStable:report.sourceStable,output}));if(!report.passed)process.exitCode=1;
