// Same-camera before/after for the holy-city style rounds: ?holyStyle=<before> vs default.
import {chromium} from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const before=process.argv[2]||'4',label=process.argv[3]||'r07';const out='TigerMessenger/artifacts/pipeline/holy-ashley-palette/';await mkdir(out,{recursive:true});
const cams={newfront:[[75,34,105],[44,17,23],52],gate:[[43,28,52],[0,9,0],50],overview:[[-20,70,215],[-5,5,40],52],oldfront:[[-20,12,62],[-40,8,24],60],oldside:[[-5,24,40],[-50,8,4],50]};
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{for(const [tag,q] of [['before','&ashleyPalette=0'],['after','']]){const p=await b.newPage({viewport:{width:1400,height:900}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+q,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(6500);
 for(const [k,[a,l,fov]] of Object.entries(cams)){const png=await p.evaluate(async([a,l,fov,k])=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName(k==='gate'?'highland-gate':'castleContainer');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.45;t.dayNight?.update?.(1e-4);
  const L=v=>c.localToWorld(new T.Vector3(...v));t.camera.position.copy(L(a));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(L(l));t.camera.fov=fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);
  await new Promise(r=>requestAnimationFrame(()=>r()));t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/jpeg',.86);},[a,l,fov,k]);
  await writeFile(`${out}${label}-${tag}-${k}.jpg`,Buffer.from(png.split(',')[1],'base64'));}
 await writeFile(`${out}${label}-${tag}-errors.json`,JSON.stringify(errors));await p.close();}}finally{await b.close();}
console.log('ok');
