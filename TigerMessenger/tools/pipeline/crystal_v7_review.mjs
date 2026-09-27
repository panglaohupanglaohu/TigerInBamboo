import {chromium} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/crystal-v7-three-rounds';
await mkdir(out,{recursive:true});
const round=process.argv[2]||'baseline';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1'+(round==='baseline'?'':'&crystalV7='+round),{waitUntil:'domcontentloaded'});
 for(let attempt=0;attempt<3;attempt++){
  await page.waitForTimeout(2500);
  if(await page.evaluate(()=>document.body.innerText.includes('游戏脚本启动失败'))){console.log('Retrying interrupted local module transfer');await page.reload({waitUntil:'domcontentloaded'});}else break;
 }
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(-2500));throw e});
 const report=await page.evaluate(async(round)=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks;
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.38;
  t.scene.updateMatrixWorld(true);
  const towers=l.moebius.crystals.map(r=>({name:r.group.name,position:r.group.position.toArray(),dir:r.dir.toArray(),root:r.root,height:r.h,radius:r.r,scale:r.group.scale.toArray(),quaternion:r.group.quaternion.toArray()}));
  const {getCityFrame}=await import('/TigerMessenger/src/world/crystalCityLayout.js');const f=getCityFrame();
  const center=f.center.clone().multiplyScalar(140),up=f.center,east=f.east,north=f.north;
  const local=v=>center.clone().addScaledVector(east,v[0]).addScaledVector(up,v[1]).addScaledVector(north,v[2]);
  const camera={position:local([110,150,160]).toArray(),up:up.toArray(),target:local([0,25,0]).toArray()};
  t.camera.position.fromArray(camera.position);t.camera.up.copy(up);t.camera.lookAt(new T.Vector3(...camera.target));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling?.update(3);
  return {round,camera,towers,swamp:{position:l.moebiusSwamp.position.toArray(),quaternion:l.moebiusSwamp.quaternion.toArray(),scale:l.moebiusSwamp.scale.toArray(),children:l.moebiusSwamp.children.length},port:!!l.crystalMotherPort};
 },round);
 await page.waitForTimeout(1000);
 const png=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL();});
 await writeFile(`${out}/${round}.png`,Buffer.from(png.split(',')[1],'base64'));
 report.errors=errors;await writeFile(`${out}/${round}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(round!=='baseline'){
  const exported=await page.evaluate(async()=>{
   const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,s=new T.Scene();
   for(const root of [l.moebius.group,l.moebiusSwamp,t.scene.getObjectByName('crystal-v7-shores')].filter(Boolean)){
    const copy=root.clone(true);copy.traverse(o=>{o.visible=true});s.add(copy);
   }
   s.updateMatrixWorld(true);
   const {exportWorldGLB}=await import('/TigerMessenger/tools/world/export_world_glb.js');const e=exportWorldGLB(s,T,{});
   let binary='';for(let i=0;i<e.bytes.length;i+=8192)binary+=String.fromCharCode(...e.bytes.subarray(i,i+8192));return {data:btoa(binary),manifest:e.manifest};
  });
  await writeFile(`${out}/round-${round}-source.glb`,Buffer.from(exported.data,'base64'));
  await writeFile(`${out}/round-${round}-export.json`,JSON.stringify(exported.manifest,null,2));
 }
} finally {await browser.close();}
