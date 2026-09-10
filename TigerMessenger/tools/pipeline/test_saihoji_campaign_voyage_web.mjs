import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';import{createHash}from'node:crypto';
const out='artifacts/pipeline/saihoji-campaign-voyage/'+new Date().toISOString().replaceAll(':','-');await mkdir(out,{recursive:true});
const files=['src/world/saihojiPhalanx.js','src/world/saihojiAmbush.js','src/scenes/saihojiGarden.js','src/scenes/messenger/loadCitadel.js','src/story/rescueCampaign.js'];const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));const before=await hashes();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const cases=[];
try{for(const restored of [false,true]){
 const errors=[],p=await browser.newPage({viewport:{width:1200,height:850}});p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(({restored})=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);if(restored)localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:2}));else localStorage.removeItem('tm.rescue.campaign.v1');},{restored});
 await p.goto('http://localhost:8931/TigerMessenger/?citadelCombatV3=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.rescueCampaign,null,{timeout:180000});await p.locator('#start-btn').click();
 const r=await p.evaluate(async({restored})=>{
  const {THREE:T,scene,sceneHandles,messenger,rescueCampaign:campaign,player,camera,renderer}=window.__tm;
  const battle=messenger.landmarks.saihojiPhalanx,garden=sceneHandles.find(h=>h.id==='saihoji'),whale=scene.getObjectByName('leviathanGroup'),fleet=scene.getObjectByName('moebius-aircraft-squad');
  const {FEATURES}=await import('/TigerMessenger/src/core/params.js'),S=await import('/TigerMessenger/src/audio/sfx.js');const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail?{detail:JSON.parse(JSON.stringify(detail))}: {})});
  check('full story has live voyage even with optional V3 flag',!!battle?.setCampaignProgress,{flag:FEATURES.citadelCombatV3});if(!battle)return {passed:false,checks};
  const ambush=battle.root.userData.saihojiAmbush;let time=0;campaign.update(.01);
  const near=whale.position.clone().normalize().multiplyScalar(185);fleet.userData._patrolCenter=near;
  const step=()=>{time+=1/60;campaign.update(1/60);garden.update(1/60,time);battle.update(1/60,time);};
  if(!restored){for(let i=0;i<180;i++)step();check('new game cannot launch before pact',battle.root.userData.campaignStatus.shipCount===0&&battle.root.userData.campaignStatus.phase==='atCastle'&&garden.whaleLift01()===0);
   for(let chapter=0;chapter<2;chapter++){player.position.copy(campaign.getTargetPosition());campaign.update(.2);window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));}
   check('real R letter and pact authorize chapter 2',campaign.snapshot().chapter===2);
  }else check('old chapter 2 restores without replaying prior chapters',campaign.snapshot().chapter===2&&battle.root.userData.campaignStatus.launchAllowed);
  // Diagnostic concurrent night-mission flag: it must not cancel the authorized voyage.
  S.setInfiltrationBgm(true);let concealedFrame=null,maxLift=0;
  for(let frame=0;frame<12000;frame++){step();maxLift=Math.max(maxLift,garden.whaleLift01());if(ambush.state.stage==='concealed'){concealedFrame=frame;break;}}
  const units=[];battle.root.traverse(o=>{if(o.userData.ambushConcealed)units.push(o);});const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
  check('original scheduled voyage brings 50 visible blue troops to cover',units.length===50&&units.every(o=>visible(o)&&o.userData.helmSide==='blue')&&battle.root.userData.campaignStatus.shipCount===2,{concealedFrame,seconds:(concealedFrame+1)/60,campaign:battle.root.userData.campaignStatus});
  check('chapter 2 blocks actual nearby fleet revelation until signal',maxLift===0&&ambush.state.stage==='concealed',{maxLift,gate:whale.userData.saihojiDiscoveryGate});
  const ids=units.map(o=>o.uuid);for(let i=0;i<300;i++)step();check('repeated campaign sync never respawns completed voyage',battle.root.userData.campaignStatus.shipCount===2&&ids.every(id=>battle.root.getObjectByProperty('uuid',id))&&ambush.state.stage==='concealed');
  player.position.copy(campaign.getTargetPosition());campaign.update(.2);scene.updateMatrixWorld(true);const center=units.reduce((v,o)=>v.add(o.getWorldPosition(new T.Vector3())),new T.Vector3()).multiplyScalar(1/Math.max(1,units.length)),up=whale.position.clone().normalize(),east=new T.Vector3().crossVectors(up,new T.Vector3(0,1,0)).normalize();camera.position.copy(center).addScaledVector(up,9).addScaledVector(east,12);camera.up.copy(up);camera.lookAt(center);renderer.render(scene,camera);const capture=renderer.domElement.toDataURL('image/png');
  const panel=document.querySelector('.rescue-battle-status').textContent;check('actual campaign panel explains hidden troops and R signal',panel.includes('松林下埋伏')&&panel.includes('按 R'),{panel});
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));check('real nearby R signal advances chapter 3',campaign.snapshot().chapter===3);
  let discovered=null,attack=null;for(let frame=0;frame<3000;frame++){step();if(ambush.state.stage==='discovered'&&discovered===null)discovered=frame;if(ambush.state.stage==='ambush'){attack=frame;break;}}
  check('signal still requires actual fleet lock and whale rise',discovered!==null&&attack>discovered&&garden.whaleLift01()>0&&fleet.userData.whaleLock?.active,{discovered,attack,lift:garden.whaleLift01()});
  const phase=battle.root.userData.campaignStatus.phase;for(let i=0;i<30;i++)campaign.update(1/60);check('later synchronization preserves an active battle',phase==='fight'&&battle.root.userData.campaignStatus.phase===phase&&ids.every(id=>battle.root.getObjectByProperty('uuid',id)));
  check('pact signal does not start heavy assault',messenger.vanguardAssault.phase()==='idle');S.setInfiltrationBgm(false);
  return {passed:checks.every(c=>c.passed),checks,capture,events:ambush.events,scope:'Fresh actual 8931 page with world RAF held; real R chapter interaction and original garden/battle updates. No reset/debug/spawn/phase writes. Player positions and fleet proximity diagnostic; concurrent night flag injected. Does not validate full original post-ambush terrain transition.'};
 },{restored});
 if(r.capture){await writeFile(out+'/'+(restored?'restored-chapter2':'new-game')+'.png',Buffer.from(r.capture.split(',')[1],'base64'));delete r.capture;}
 r.scenario=restored?'restored-chapter2':'new-game';r.errors=errors;r.passed&&=errors.length===0;cases.push(r);console.log(JSON.stringify({scenario:r.scenario,passed:r.passed,failed:r.checks.filter(c=>!c.passed)}));await p.close();
}}finally{await browser.close();}
const after=await hashes(),report={passed:cases.length===2&&cases.every(c=>c.passed)&&JSON.stringify(before)===JSON.stringify(after),sourceStable:JSON.stringify(before)===JSON.stringify(after),sourceBefore:before,sourceAfter:after,cases};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,output:out}));if(!report.passed)process.exitCode=1;
