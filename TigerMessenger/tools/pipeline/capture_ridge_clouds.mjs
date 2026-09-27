// Ridge-flow cloud captures: overview + old-town ridge view, noon & dusk, and a +20 s frame.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'r1';const out='TigerMessenger/artifacts/pipeline/ridge-clouds/';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(/ridge-flow/.test(m.text()))errs.push(m.text());});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2500);
const info=await p.evaluate(()=>{const m=window.__tm.scene.getObjectByName('citadel-ridge-flow-clouds');return m?{stats:m.userData.stats,visible:m.visible}:null;});
const cams={overview:[[-20,70,215],[-5,5,40],52],ridge:[[-5,30,90],[-55,30,-25],55],back:[[-40,55,-120],[-40,15,-20],55]};
for(const [tn,tv] of [['noon',.5],['dusk',.76]])for(const [vn,[a,l,fov]] of Object.entries(cams))for(const dtAdv of [0,20]){
 const png=await p.evaluate(async([tv,a,l,fov,dtAdv])=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName('castleContainer');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=tv;t.dayNight?.update?.(1e-4);
  const m=t.scene.getObjectByName('citadel-ridge-flow-clouds');window.__ct=(window.__ct||1000);if(dtAdv){for(let k=0;k<dtAdv*10;k++){window.__ct+=.1;m?.userData.update(window.__ct);}}else{window.__ct+=.1;m?.userData.update(window.__ct);}
  const L=v=>c.localToWorld(new T.Vector3(...v));t.camera.position.copy(L(a));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(L(l));t.camera.fov=fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);
  await new Promise(r=>requestAnimationFrame(()=>r()));t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/jpeg',.86);},[tv,a,l,fov,dtAdv]);
 await writeFile(`${out}${label}-${tn}-${vn}${dtAdv?'-plus20s':''}.jpg`,Buffer.from(png.split(',')[1],'base64'));}
console.log(JSON.stringify({info,errs:errs.slice(0,5)}));}finally{await b.close();}
