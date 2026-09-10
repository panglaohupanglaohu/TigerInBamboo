// Independent family contract and production battle-module verification.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.ROMAN_TEST_BASE_URL||'http://127.0.0.1:8765/TigerMessenger';
const output=path.join(root,'artifacts/pipeline/roman-family-web',new Date().toISOString().replaceAll(':','-'));
await mkdir(output,{recursive:true});
const sources=['src/assets/harbor.js','src/assets/romanSoldierEquipment.js','src/assets/romanEquipmentData.js','src/world/romanSoldierCombatPose.js','src/world/saihojiPhalanx.js','src/world/romanWorldArmor.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')])));
const before=await hashes();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let report={checks:[],passed:false};const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/roman-family-test.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js","three/addons/":"${base}/vendor/jsm/"}}</script>`}));
 await page.goto(base+'/roman-family-test.html');
 report=await page.evaluate(async ({base})=>{
  const T=await import('three');
  const H=await import(base+'/src/assets/harbor.js');
  const {bindRomanSoldierEquipment:bind}=await import(base+'/src/assets/romanSoldierEquipment.js');
  const {createRomanCombatPresentation}=await import(base+'/src/world/romanSoldierCombatPose.js');
  const {createSaihojiPhalanxBattle,saihoujiHubDir}=await import(base+'/src/world/saihojiPhalanx.js');
  const {PLANET_RADIUS:R}=await import(base+'/src/world/planet.js');
  const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});
  const nodes=a=>{const result=[];a.traverse(n=>result.push(n));return result;};
  const matrix=n=>{n.updateMatrix();return [...n.matrix.elements];};
  const close=(a,b,eps=1e-8)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<eps);
  const factory=role=>role==='longbow'?H.createLongbowSoldier({rand:()=>.5}):role==='spear'?H.createHarborPatrolSoldier():H.createGladiusSoldier();
  const snapshot=a=>nodes(a).map(n=>({n,parent:n.parent,material:n.material,geometry:n.geometry,matrix:matrix(n),visible:n.visible}));
  const structure=s=>s.every(r=>r.n.parent===r.parent&&r.n.material===r.material&&r.n.geometry===r.geometry);
  const protectedBow=a=>[a.userData.parts.body,a.userData.parts.legL,a.userData.parts.legR,a.userData.parts.armL,a.userData.parts.armR,...['bow','limbTop','limbBot','stringTop','stringBot','nockedArrow','quiver'].map(k=>a.userData.equipment[k])];
  const poses=ns=>ns.map(n=>({matrix:matrix(n),visible:n.visible}));
  const equalPoses=(ns,expected)=>ns.every((n,i)=>close(matrix(n),expected[i].matrix)&&n.visible===expected[i].visible);
  const grip=(a,which)=>{a.updateWorldMatrix(true,true);const right=which!=='shield',weapon=a.userData.equipment[which],arm=a.userData.parts[right?'armR':'armL'];return arm.localToWorld(new T.Vector3(0,-.138,0)).distanceTo(weapon.localToWorld(which==='gladius'?new T.Vector3(0,.04,0):which==='shield'?new T.Vector3(-.055,0,0):new T.Vector3()));};
  const fixtureMetrics={},captures={};
  const renderScene=new T.Scene();renderScene.background=new T.Color('#d5dfd5');renderScene.add(new T.HemisphereLight(0xffffff,0x536950,2.2));
  const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(3,4,2);renderScene.add(light);
  const floor=new T.Mesh(new T.PlaneGeometry(7,7),new T.MeshToonMaterial({color:0xa8b5a0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;renderScene.add(floor);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,800);
  const camera=new T.PerspectiveCamera(33,900/800,.01,40);camera.position.set(2.8,1.55,2.7);camera.lookAt(0,.52,0);
  for(const role of ['spear','longbow','gladius'])for(const side of ['red','blue']){
   const actor=factory(role);H.paintSoldierHelm(actor,side);renderScene.add(actor);
   camera.position.set(...(role==='spear'?[4.6,2.6,5.2]:[2.8,1.55,2.7]));camera.lookAt(role==='spear'?.3:0,.52,0);
   const original=snapshot(actor),protectedNodes=role==='longbow'?protectedBow(actor):role==='spear'?[actor.userData.parts.body,actor.userData.parts.armL,actor.userData.parts.armR,actor.userData.parts.legL,actor.userData.parts.legR,actor.userData.equipment.spear,actor.userData.equipment.shield]:[],protectedBefore=poses(protectedNodes);
   const controller=bind(actor);
   check(`${role}/${side} real factory binds`,!!controller);
   if(!controller){renderScene.remove(actor);continue;}
   check(`${role}/${side} original parent/material/geometry references preserved`,structure(original));
   check(`${role}/${side} bind preserves bow arm/string/arrow pose`,equalPoses(protectedNodes,protectedBefore));
   const crests=['soldier-crest','soldier-crest-feathers','soldier-crest-stems'].map(n=>actor.getObjectByName(n));
   const crestPose=poses(crests),crestMats=crests.map(n=>n.material);
   let maxGrip=0,finite=true,phaseSafe=true,crestStable=true,releases=0;const phases={};
   const presentation=createRomanCombatPresentation();presentation.add(actor);
   for(let frame=0;frame<360;frame++){
    if(role==='longbow'){
     const released=H.updateLongbowShot(actor,1/60,()=>.5);if(released)releases++;
     const phase=actor.userData.bowCycle.phase;phases[phase]=(phases[phase]||0)+1;
     const prior=poses(protectedNodes);controller.update({swing:.15,climb:frame%2===0});
     phaseSafe&&=equalPoses(protectedNodes,prior);
     actor.position.x+=.002;actor.userData._meleeCd=frame%20===0?1.2:0;
     presentation.update(1/60,frame/60,renderScene);
     phaseSafe&&=equalPoses(protectedNodes,prior);
     if(phase==='hold'&&!captures[`${role}-${side}`]){const pos=actor.position.clone();actor.position.set(0,0,0);renderer.render(renderScene,camera);captures[`${role}-${side}`]=renderer.domElement.toDataURL('image/png');actor.position.copy(pos);}
    }else{
     actor.userData.parts.armR.rotation.z=.7+.4*Math.sin(frame*.04);
     actor.userData.equipment[role].rotation.set(.12,.1*Math.sin(frame*.05),role==='spear'?-Math.PI/2-.08:-.9);
     const spearBefore=poses(protectedNodes);controller.update({swing:.15*Math.sin(frame*.1)});
     phaseSafe&&=equalPoses(protectedNodes,spearBefore);
     if(role==='gladius')maxGrip=Math.max(maxGrip,grip(actor,role),grip(actor,'shield'));
     actor.position.x+=.002;actor.userData._meleeCd=frame%20===0?1.2:0;presentation.update(1/60,frame/60,renderScene);
     if(role==='gladius')maxGrip=Math.max(maxGrip,grip(actor,role),grip(actor,'shield'));
     phaseSafe&&=equalPoses(protectedNodes,spearBefore);
    }
    actor.updateWorldMatrix(true,true);finite&&=nodes(actor).every(n=>n.matrixWorld.elements.every(Number.isFinite));
    crestStable&&=equalPoses(crests,crestPose)&&crests.every((n,i)=>n.material===crestMats[i]);
   }
   check(`${role}/${side} 360 finite live poses and stable crests`,finite&&crestStable);
   check(`${role}/${side} retained original helm color`,actor.getObjectByName('soldier-crest').material.color.getHex()===(side==='red'?0xc62828:0x2563eb));
   if(role==='longbow')check(`${role}/${side} all seven real shot phases survive adapter and presentation`,phaseSafe&&Object.keys(phases).length===7&&releases>=2,{phases,releases});
   else if(role==='spear')check(`${role}/${side} original spear limb and weapon poses retained`,phaseSafe,{gripCorrection:'Not applied: no approved spear grip contract'});
   else check(`${role}/${side} hand contacts remain attached after both updates`,maxGrip<1e-6,{maxGrip});
   actor.position.set(0,0,0);if(!captures[`${role}-${side}`]){renderer.render(renderScene,camera);captures[`${role}-${side}`]=renderer.domElement.toDataURL('image/png');}
   const currentBow=poses(protectedNodes);
   for(let i=0;i<6;i++){controller.setEnabled(false);controller.setEnabled(true);}
   check(`${role}/${side} six toggles preserve live bow pose`,equalPoses(protectedNodes,currentBow));
   actor.visible=false;if(actor.userData.equipment.shield)actor.userData.equipment.shield.visible=false;
   controller.setEnabled(false);controller.setEnabled(true);
   check(`${role}/${side} pooling/broken shield not resurrected`,!actor.visible&&!actor.userData.equipment.shield.visible);
   controller.setEnabled(false);
   if(role==='gladius')check(`${role}/${side} optout restores original local transforms`,original.every(r=>r.n===actor||close(matrix(r.n),r.matrix)));
   check(`${role}/${side} live original structure retained`,structure(original));
   presentation.dispose();controller.dispose();
   check(`${role}/${side} dispose removes only owned additions`,nodes(actor).length===original.length&&!actor.userData.romanEquipment&&structure(original));
   const rebound=bind(actor);check(`${role}/${side} rebind after disposal succeeds`,!!rebound&&rebound!==controller);rebound?.dispose();renderScene.remove(actor);
   fixtureMetrics[`${role}-${side}`]={frames:360,maxGrip,finite,phaseSafe,crestStable,phases,releases,originalNodes:original.length};
  }
  const resourceActors=['spear','longbow','gladius','longbow'].map(factory),resourceControllers=resourceActors.map(bind);
  if(resourceControllers.every(Boolean)){
   const helmet=c=>c.armor.children.find(m=>m.name.startsWith('Helmet_Galea')).geometry;
   const source=helmet(resourceControllers[0]),archer=helmet(resourceControllers[1]);
   const sourcePos=source.attributes.position,archerPos=archer.attributes.position;let studsSame=true,studVertices=0;
   for(let i=0;i<sourcePos.count;i++)if(sourcePos.getY(i)<=.1){studVertices++;studsSame&&=sourcePos.getX(i)===archerPos.getX(i)&&sourcePos.getY(i)===archerPos.getY(i)&&sourcePos.getZ(i)===archerPos.getZ(i);}
   check('archer-specific helmet shared by archers without changing melee helmets',archer!==source&&helmet(resourceControllers[2])===source&&helmet(resourceControllers[3])===archer);
   check('archer-specific helmet preserves all low waist-stud vertices',studsSame&&studVertices>0,{studVertices});
   check('all families still share unchanged skirt and belt geometry',resourceControllers[0].armor.children.filter(m=>!m.name.startsWith('Helmet_Galea')).every(m=>resourceControllers.every(c=>c.armor.children.find(n=>n.name===m.name).geometry===m.geometry)));
   const normal=archer.attributes.normal;let normalsValid=true;for(let i=0;i<normal.count;i++){const v=new T.Vector3().fromBufferAttribute(normal,i);normalsValid&&=Number.isFinite(v.length())&&Math.abs(v.length()-1)<1e-5;}
   check('archer helmet normals remain finite and normalized',normalsValid);
   let released=0,archerReleased=0;source.addEventListener('dispose',()=>released++);archer.addEventListener('dispose',()=>archerReleased++);
   resourceControllers[0].dispose();resourceControllers[1].dispose();resourceControllers[2].dispose();check('remaining archer keeps shared and specialized geometry alive',released===0&&archerReleased===0);
   resourceControllers[3].dispose();check('last family releases both shared and archer geometry exactly once',released===1&&archerReleased===1);
  }
  const {bindOriginalWorldRomanArmor}=await import(base+'/src/world/romanWorldArmor.js');
  const originalWorldRoles=new T.Group(),worldActors=[];
  // Same source role counts: citadelRange six TIE_SPOTS and infiltration two groups of four.
  for(let i=0;i<14;i++){
   const actor=i<6?H.createTieSoldier():H.createNightInfiltrationSoldier({torchLeft:(i-6)%4===0||(i-6)%4===3});
   originalWorldRoles.add(actor);worldActors.push(actor);
  }
  const worldRefs=worldActors.map(a=>snapshot(a));
  const dynamicNodes=a=>[a.userData.parts.body,a.userData.parts.armL,a.userData.parts.armR,a.userData.parts.legL,a.userData.parts.legR,...Object.values(a.userData.equipment).filter(n=>n?.isObject3D)];
  const worldPoses=worldActors.map(a=>poses(dynamicNodes(a)));
  const originalWorldController=bindOriginalWorldRomanArmor(originalWorldRoles);
  check('world helper binds 6 original tie and 8 original night factory actors',originalWorldController.count===14&&worldActors.every(a=>a.userData.romanEquipment?.active&&a.userData.romanEquipment.armorOnly));
  check('world helper keeps original rope-pulling, torch and shield poses at binding',worldActors.every((a,i)=>equalPoses(dynamicNodes(a),worldPoses[i])&&structure(worldRefs[i])));
  let worldActionsPreserved=true;
  for(let frame=0;frame<120;frame++){
   for(const a of worldActors){
    // Explicit animation-owner writes to prove helper cannot reset current pose.
    a.userData.parts.armL.rotation.z+=.001;a.userData.parts.body.rotation.z+=.0005;
    const prior=poses(dynamicNodes(a));a.userData.setRomanEquipment(false);a.userData.setRomanEquipment(true);
    worldActionsPreserved&&=equalPoses(dynamicNodes(a),prior);
   }
   originalWorldController.update();
  }
  check('world helper leaves 120 frames of owner-written rope/torch poses untouched',worldActionsPreserved);
  const detached=worldActors[0];detached.removeFromParent();originalWorldController.update();
  check('world helper removal releases detached actor only',originalWorldController.count===13&&!detached.userData.romanEquipment&&worldActors.slice(1).every(a=>a.userData.romanEquipment?.active));
  originalWorldController.dispose();check('world helper disposal releases all retained source actors',worldActors.every(a=>!a.userData.romanEquipment&&!nodes(a).some(n=>n.userData.romanEquipmentOwned)));
  // Production battle system, bounded terrain fixture; no invented combat simulation.
  const scene=new T.Scene(),hub=saihoujiHubDir(),east=new T.Vector3().crossVectors(new T.Vector3(0,1,0),hub).normalize();
  const castle=new T.Group();castle.name='castleContainer';castle.position.copy(hub).multiplyScalar(R).addScaledVector(east,-80);castle.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),castle.position.clone().normalize());scene.add(castle);
  const planet=new T.Mesh(new T.SphereGeometry(R,32,24),new T.MeshToonMaterial({color:0x899e85}));planet.name='planet-surface';scene.add(planet);
  const battle=createSaihojiPhalanxBattle({scene,isWhaleRisen:()=>false,getSquad:()=>null,getTimeOfDay:()=>.45,seed:43});
  battle.root.userData.debugSiege();battle.update(0,0);
  const soldiers=()=>nodes(battle.root).filter(n=>n.userData.parts&&n.userData.equipment&&['spear','longbow','gladius'].includes(n.userData.phalanxRole));
  const roster=soldiers(),initial={};for(const actor of roster){const k=`${actor.userData.phalanxRole}-${actor.userData.helmSide}`;initial[k]=(initial[k]||0)+1;}
  const stable=roster.map(a=>({a,uuid:a.uuid,uid:a.userData.uid,refs:snapshot(a),crests:['soldier-crest','soldier-crest-feathers','soldier-crest-stems'].map(n=>a.getObjectByName(n))}));
  for(const s of stable)s.crest=poses(s.crests);
  const coverage={},actions={},bowPhases={};let finite=true,allAdapted=true,stableCrest=true,maxGrip=0,missing=[];
  for(let frame=0;frame<720;frame++){
   battle.update(.05,frame*.05);scene.updateMatrixWorld(true);
   for(const a of soldiers()){
    const role=a.userData.phalanxRole,key=`${role}-${a.userData.helmSide}`,meta=a.userData.romanEquipment;
    coverage[key]=(coverage[key]||0)+1;allAdapted&&=!!meta?.active;if(!meta?.active&&missing.length<12)missing.push({frame,role,name:a.name,uid:a.userData.uid});
    if(meta){const k=`${role}:${meta.action}`;actions[k]=(actions[k]||0)+1;}
    if(role==='longbow'){const p=a.userData.bowCycle?.phase;bowPhases[p]=(bowPhases[p]||0)+1;}
    else if(role==='gladius'&&meta?.active&&a.userData.siegeStage!=='climb')maxGrip=Math.max(maxGrip,grip(a,role),grip(a,'shield'));
    finite&&=nodes(a).every(n=>n.matrixWorld.elements.every(Number.isFinite));
   }
   stableCrest&&=stable.every(s=>equalPoses(s.crests,s.crest));
  }
  check('actual battle 720 frames cover all three families in both colors',Object.keys(coverage).length===6,{initial,coverage});
  check('actual battle every family receives active new assembly',allAdapted,{missing});
  check('actual battle all frames finite and original crests stable',finite&&stableCrest);
  check('actual battle melee grip contacts remain attached',maxGrip<1e-6,{maxGrip});
  check('actual battle original node parent/material/geometry and actor IDs retained',stable.every(s=>s.uuid===s.a.uuid&&s.uid===s.a.userData.uid&&structure(s.refs)));
  check('actual battle longbow cycles through original shot phases',Object.keys(bowPhases).length===7,{bowPhases});
  battle.root.userData.setRomanEquipment(false);check('battle family-wide optout deactivates all controllers',soldiers().every(a=>a.userData.romanEquipment&&!a.userData.romanEquipment.active));
  battle.root.userData.setRomanEquipment(true);check('battle family-wide re-enable reuses assemblies',soldiers().every(a=>a.userData.romanEquipment?.active));
  const retained=soldiers();battle.reset();check('battle reset releases all three families',retained.every(a=>!a.userData.romanEquipment&&!nodes(a).some(n=>n.userData.romanEquipmentOwned)));
  renderer.dispose();
  return {checks,fixtureMetrics,battle:{frames:720,initial,coverage,actions,bowPhases,finite,stableCrest,maxGrip,missing},captures,scope:'Real original factories and production phalanx battle module in a bounded sphere/castle fixture; no complete original-world playthrough claim'};
 },{base});
}catch(error){report.failure=error.stack;}
finally{await browser.close();}
for(const [name,url]of Object.entries(report.captures||{}))await writeFile(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));
report.captureFiles=Object.keys(report.captures||{}).map(n=>n+'.png');delete report.captures;
report.runtimeHashes=before;report.sourceSnapshotStillCurrent=JSON.stringify(before)===JSON.stringify(await hashes());report.errors=errors;
report.passed=!report.failure&&report.checks.every(c=>c.passed)&&!errors.length&&report.sourceSnapshotStillCurrent;
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,output,checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),failure:report.failure,errors,battle:report.battle},null,2));
if(!report.passed)process.exitCode=1;
