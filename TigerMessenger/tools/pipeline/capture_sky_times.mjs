// Sky before/after captures: holy-city overview and a sea-facing plaza view at dawn/noon/dusk.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'probe';const out='TigerMessenger/artifacts/pipeline/sky-glow/';await mkdir(out,{recursive:true});
const times={dawn:.28,noon:.5,dusk:.76,afterglow:.8};
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1280,height:800}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
for(const [tn,tv] of Object.entries(times))for(const view of ['overview','south','east','west']){
 const png=await p.evaluate(async([tv,view])=>{const t=window.__tm,T=t.THREE;let c;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)c=o;});
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=tv;t.dayNight?.update?.(0.0001);t.P.timeOfDay=tv;t.dayNight?.update?.(0.0001);
  const L=v=>c.localToWorld(new T.Vector3(...v));const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld);
  const cams={overview:[[-20,70,215],[-5,5,40]],sea:[[15,14,96],[-15,-2,150]],open:[[-60,16,120],[-130,-4,150]]};
  if(view==='overview'){const [a,l]=cams[view];t.camera.position.copy(L(a));t.camera.up.copy(up);t.camera.lookAt(L(l));}
  else{const pos=L([15,12.5,92]);const u=pos.clone().normalize();const h={south:[0,0,1],east:[1,0,0],west:[-1,0,0]}[view];const d=new T.Vector3(...h).transformDirection(c.matrixWorld);d.addScaledVector(u,-d.dot(u)).normalize();const pitch=12*Math.PI/180;const look=pos.clone().addScaledVector(d,Math.cos(pitch)*50).addScaledVector(u,Math.sin(pitch)*50);t.camera.position.copy(pos);t.camera.up.copy(u);t.camera.lookAt(look);}t.camera.fov=55;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);
  await new Promise(r=>requestAnimationFrame(()=>r()));t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/jpeg',.85);},[tv,view]);
 await writeFile(`${out}${label}-${tn}-${view}.jpg`,Buffer.from(png.split(',')[1],'base64'));}
console.log(JSON.stringify({label,errs}));}finally{await b.close();}
