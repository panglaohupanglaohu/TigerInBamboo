import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>!!window.__tm?.scene.getObjectByName('castleContainer')?.userData.releasedLighting,null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city'),lights=city.getObjectByName('citadel-new-city-lighting').children.filter(o=>o.isPointLight);
  const saved=lights.slice(0,2).map(l=>({p:l.position.clone(),range:l.distance}));
  t.P.timeOfDay=.85;t.P.daySpeed=0;t.cameraRig.update=()=>{};
  const eye=city.localToWorld(new T.Vector3(32,40,102)),look=city.localToWorld(new T.Vector3(60,16,36));
  t.camera.position.copy(eye);t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(look);t.camera.far=3000;t.camera.updateProjectionMatrix();
  const result={camera:{eye:c.worldToLocal(eye.clone()).toArray(),look:c.worldToLocal(look.clone()).toArray(),fov:t.camera.fov},images:{},states:{}};
  for(const variant of ['before','after']){
   lights[0].position.copy(variant==='before'?new T.Vector3(60,23,33):saved[0].p);
   lights[0].distance=variant==='before'?24:saved[0].range;lights[0].shadow.camera.far=lights[0].distance;
   lights[1].position.copy(variant==='before'?new T.Vector3(65,9,80):saved[1].p);
   for(const name of ['citadel-new-main-gate','citadel-court-structure'])c.getObjectByName(name).traverse(o=>{if(o.isMesh){if(variant==='before')o.layers.disable(3);else o.layers.enable(3);}});
   c.userData.invalidateCitadelShadowMaps();
   const desired=lights[0].getWorldPosition(new T.Vector3());let ready=false;
   for(let i=0;i<180;i++){
    await new Promise(r=>requestAnimationFrame(r));
    t.scene.traverse(o=>{if(o.userData.isLightPool&&o.userData.sourceLightName==='new-city-light-main-gate'&&o.intensity>0&&o.position.distanceTo(desired)<.001&&Math.abs(o.distance-lights[0].distance)<.001)ready=true;});
    if(ready)break;
   }
   if(!ready)throw new Error('Pool did not apply '+variant);
   await new Promise(r=>requestAnimationFrame(r));t.renderer.render(t.scene,t.camera);
   result.images[variant]=t.renderer.domElement.toDataURL('image/png');
   result.states[variant]=lights.slice(0,2).map(l=>({position:l.position.toArray(),intensity:l.intensity,range:l.distance}));
  }
  return result;
 });
 for(const [name,image] of Object.entries(data.images))await writeFile(new URL('lighting-'+name+'.png',out),Buffer.from(image.split(',')[1],'base64'));
 delete data.images;await writeFile(new URL('lighting-alignment.json',out),JSON.stringify(data,null,2));
 console.log(JSON.stringify(data.states));
}finally{await b.close();}
