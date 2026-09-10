import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out='artifacts/pipeline/bgm-scene-web/'+new Date().toISOString().replaceAll(':','-');await mkdir(out,{recursive:true});
const sources=['src/audio/bgmOwnership.js','src/audio/sfx.js','src/main.js','src/world/vanguardAssault.js','src/world/saihojiPhalanx.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));const before=await hashes();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];let report;
try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
 // Hold only the world animation loop. Real audio fades and native media clocks run.
 await p.addInitScript(()=>{const NativeAudio=window.Audio;window.__bgmTestMedia=[];window.Audio=function(...args){const el=new NativeAudio(...args);window.__bgmTestMedia.push(el);return el;};window.Audio.prototype=NativeAudio.prototype;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb.name==='animate'){window.__bgmHeldMain=cb;return 0;}return raf(cb);};});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>!!window.__tm?.bgm,null,{timeout:180000});
 report=await p.evaluate(async()=>{
  const {scene,player,tramRide,messenger,THREE:T}=window.__tm,S=await import('/TigerMessenger/src/audio/sfx.js');const checks=[],states=[];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));const snap=label=>{const s=S.getBgmOwnershipSnapshot();states.push({label,...s});return s;};
  const check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail?{detail}: {})});const audible=s=>s.elements.filter(e=>!e.paused&&e.volume>.005);
  const until=async fn=>{for(let i=0;i<100;i++){if(fn())return true;await sleep(100);}return false;};
  const whale=scene.getObjectByName('leviathanGroup'),near=whale.getWorldPosition(new T.Vector3()),far=near.clone().applyAxisAngle(new T.Vector3(0,1,0),1.5);const tram=messenger.landmarks.tramSystem.tram;
  const context=()=>S.updateBgmListenerContext({listener:player.position,saihoji:whale.getWorldPosition(new T.Vector3())});
  player.position.copy(near);context();S.ensureAudio();S.setLeviathanStormBgm(true,{fade:.12});
  await until(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='storm'));let a=snap('walking-near-battle');check('local walking battle uses original storm track',a.owner==='storm'&&audible(a).length===1);
  const start=a.elements.find(e=>e.key==='storm')?.currentTime;await sleep(700);a=snap('native-storm-progress');check('native HTMLAudio media clock advances',a.elements.find(e=>e.key==='storm')?.currentTime>start+.2,{start,end:a.elements.find(e=>e.key==='storm')?.currentTime});
  tram.position.copy(near);player.position.copy(near);window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',bubbles:true}));for(let i=0;i<90;i++)tramRide.update(1/60);context();
  await until(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='tram'));a=snap('actual-keyF-board');check('actual tram ride callback owns music',tramRide.isRiding()&&a.owner==='tram'&&audible(a).length===1&&audible(a)[0].key==='tram');
  const tramStart=a.elements.find(e=>e.key==='tram'&&!e.paused)?.currentTime;
  for(let i=0;i<60;i++){S.setLeviathanStormBgm(true);S.setFleetAssaultBgm(true,{source:near});S.cueLeviathanStormOnce();await sleep(16);}
  a=snap('remote-sources-keep-requesting');check('battle and cue requests cannot interrupt tram',a.owner==='tram'&&audible(a).length===1&&audible(a)[0].key==='tram');check('native tram clock continues despite combat requests',a.elements.find(e=>e.key==='tram'&&!e.paused)?.currentTime>tramStart+.2);
  tram.position.copy(far);tramRide.update(1/60);context();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',bubbles:true}));context();
  await sleep(1600);a=snap('alight-away-from-battle');check('distant alighting does not restore old battle',!tramRide.isRiding()&&a.owner===null&&audible(a).length===0);
  for(let i=0;i<30;i++){S.setLeviathanStormBgm(true);S.setFleetAssaultBgm(true,{source:near});await sleep(16);}
  a=snap('far-with-live-battle-intent');check('battle can remain active elsewhere without audible music',a.owner===null&&audible(a).length===0&&a.requests.some(r=>r.key==='storm'&&r.active));
  player.position.copy(near);context();await until(()=>audible(S.getBgmOwnershipSnapshot()).some(e=>e.key==='storm'));a=snap('walk-back-near-battle');check('return restores only currently eligible battle',a.owner==='storm'&&audible(a).length===1&&audible(a)[0].key==='storm');
  S.setLeviathanStormBgm(false,{fade:.8});S.setFleetAssaultBgm(false,{fade:.8});await sleep(1200);a=snap('actual-battle-request-ended');check('battle end cancels music and pending fades',a.owner===null&&audible(a).length===0);
  S.toggleMusicBox();await until(()=>S.getBgmOwnershipSnapshot().owner==='musicBox'&&audible(S.getBgmOwnershipSnapshot()).length===1);const music=window.__bgmTestMedia.find(e=>e.src.includes('Balmorhea'));if(music){music.currentTime=349.1;music.dispatchEvent(new Event('timeupdate'));}await sleep(100);a=snap('music-box-segment-finish');check('music box timer finish releases its request',a.owner===null&&!a.requests.some(r=>r.key==='musicBox'&&r.active));
  // One real main update must source listener context from actual player position.
  player.position.copy(far);window.__bgmHeldMain?.();a=snap('one-production-main-frame');check('production main publishes actual player position',Math.hypot(...['x','y','z'].map(k=>a.listener[k]-player.position[k]))<1e-8);
  return {checks,states,passed:checks.every(c=>c.passed),scope:'Actual 8931 page, native HTMLAudio files and media clocks, real KeyF tram callbacks/update. Diagnostic player/tram positioning and direct battle audio intents; world RAF held while audio RAF runs. Not a natural full ride or acoustic listening comparison.'};
 });
}catch(e){report={passed:false,error:String(e),checks:[]};}finally{await browser.close();}
report.errors=errors;report.sourceBefore=before;report.sourceAfter=await hashes();report.sourceStable=JSON.stringify(before)===JSON.stringify(report.sourceAfter);report.passed&&=errors.length===0&&report.sourceStable;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.checks.filter(c=>!c.passed),errors,output:out,error:report.error}));if(!report.passed)process.exitCode=1;
