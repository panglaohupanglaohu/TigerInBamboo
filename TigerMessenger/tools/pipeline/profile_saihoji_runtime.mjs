import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const label=process.argv[2]||'before';
const out=new URL('../../artifacts/pipeline/saihoji-runtime-performance/',import.meta.url);
await mkdir(out,{recursive:true});
const hardware=process.env.TM_PROFILE_GPU==='hardware';
const browser=await chromium.launch({channel:'chrome',headless:true,args:hardware?[]:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:120000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.saihojiPhalanx,null,{timeout:180000});
 const setup=await page.evaluate(async()=>{
  const t=__tm,T=t.THREE,b=t.messenger.landmarks.saihojiPhalanx,g=t.sceneHandles.find(h=>h.id==='saihoji');
  const {saihoujiHubDir}=await import('/TigerMessenger/src/world/saihojiPhalanx.js');
  const hub=saihoujiHubDir(),fleet=t.scene.getObjectByName('moebius-aircraft-squad');
  b.reset();b.setCampaignProgress({chapter:2,started:true});
  fleet.userData._patrolCenter=hub.clone().negate().multiplyScalar(185);
  let clock=0;
  for(let i=0;i<3000&&b.root.userData.saihojiAmbush.state.stage!=='concealed';i++){clock+=.1;g.update(.1,clock);b.update(.1,clock);}
  b.setCampaignProgress({chapter:3,started:true});fleet.userData._patrolCenter.copy(hub).multiplyScalar(185);
  (fleet.userData.members||[]).forEach(m=>{const p=hub.clone().multiplyScalar(185);m.parent.worldToLocal(p);m.position.copy(p);});
  for(let i=0;i<450&&b.root.userData.saihojiAmbush.state.stage!=='ambush';i++){clock+=.1;g.update(.1,clock);b.update(.1,clock);}
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.35;
  const kun=t.scene.getObjectByName('leviathanGroup');kun.updateWorldMatrix(true,true);
  const target=kun.localToWorld(new T.Vector3(0,2,0)),up=hub;
  const east=new T.Vector3().crossVectors(up,new T.Vector3(0,1,0)).normalize();
  t.camera.position.copy(target).addScaledVector(up,16).addScaledVector(east,28);
  t.camera.up.copy(up);t.camera.lookAt(target);t.camera.updateMatrixWorld(true);
  t.player.position.copy(target);t.player.velocity.set(0,0,0);
  return {stage:b.root.userData.saihojiAmbush.state.stage,clock,scope:'Real 8931 scene and running game loop, diagnostic campaign/fleet placement; software GPU timings are not hardware FPS.'};
 });
 await page.waitForTimeout(4000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 const data=await page.evaluate(async()=>{
  const t=__tm,rows=new Map(),saved=[];
  t.scene.traverse(o=>{if(!o.isMesh)return;let p=o,path=[];while(p&&p!==t.scene){path.unshift(p.name||p.type);p=p.parent;}const key=path.slice(0,2).join('/');const r=rows.get(key)||{path:key,draws:0};rows.set(key,r);const f=o.onBeforeRender;saved.push([o,f]);o.onBeforeRender=function(...a){r.draws++;f?.apply(this,a)};});
  const times=[],calls=[],triangles=[];let last=performance.now();
  for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;calls.push(t.renderer.info.render.calls);triangles.push(t.renderer.info.render.triangles);}
  saved.forEach(([o,f])=>o.onBeforeRender=f);
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  return {frames:times.length,frameMs:mean(times),calls:mean(calls),triangles:mean(triangles),rows:[...rows.values()].filter(r=>r.draws).sort((a,b)=>b.draws-a.draws).slice(0,25),perf:t.perfProbe.snapshot(),phase:t.messenger.landmarks.saihojiPhalanx.root.userData.phase};
 });
 const {profile}=await cdp.send('Profiler.stop');
 const culling=await page.evaluate(()=>{
  const t=__tm,meshes=[];t.scene.traverse(o=>{if(o.userData.rigidFrustumCulling)meshes.push(o);});
  if(!meshes.length)return null;
  const canvas=document.createElement('canvas');canvas.width=t.renderer.domElement.width;canvas.height=t.renderer.domElement.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const render=(enabled)=>{meshes.forEach(o=>o.frustumCulled=enabled);t.renderer.info.reset();t.renderer.render(t.scene,t.camera);ctx.drawImage(t.renderer.domElement,0,0);return {calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data,image:canvas.toDataURL()};};
  const before=render(false),after=render(true);let changedPixels=0,maxChannelDelta=0;
  for(let i=0;i<before.pixels.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(before.pixels[i+c]-after.pixels[i+c]);maxChannelDelta=Math.max(maxChannelDelta,d);changed ||= d>1;}if(changed)changedPixels++;}
  delete before.pixels;delete after.pixels;return {meshes:meshes.length,before,after,changedPixels,maxChannelDelta,scope:'Same frozen production frame, raw scene render (no postprocessing), culling only'};
 });
 if(culling)for(const variant of ['before','after']){await writeFile(new URL(label+'-culling-'+variant+'.png',out),Buffer.from(culling[variant].image.split(',')[1],'base64'));delete culling[variant].image;}
 const samples=new Map();profile.samples?.forEach((id,i)=>samples.set(id,(samples.get(id)||0)+(profile.timeDeltas?.[i]||0)));
 const cpu=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,ms:(samples.get(n.id)||0)/1000})).filter(n=>n.ms).sort((a,b)=>b.ms-a.ms).slice(0,35);
 await page.screenshot({path:new URL(label+'.png',out).pathname});
 const gpu=await page.evaluate(()=>{const gl=__tm.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};});
 const report={label,setup,...data,culling,gpu,cpu,errors};await writeFile(new URL(label+'.json',out),JSON.stringify(report,null,2));await writeFile(new URL(label+'.cpuprofile',out),JSON.stringify(profile));console.log(JSON.stringify(report));
}finally{await browser.close();}
