import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.releasedLighting,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;
  city.updateWorldMatrix(true,true);t.camera.position.copy(city.localToWorld(new T.Vector3(96,31,117)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(60,13,61)));t.camera.fov=59;t.camera.updateProjectionMatrix();
  const lights=city.getObjectByName('citadel-new-city-lighting').children.filter(o=>o.isPointLight).slice(0,2),samples={},images={};
  const frame=()=>new Promise(r=>requestAnimationFrame(r));
  for(const enabled of [false,true]){
   for(const l of lights){l.castShadow=enabled;l.shadow.needsUpdate=true;}
   for(let i=0;i<20;i++)await frame();t.renderer.render(t.scene,t.camera);t.renderer.getContext().finish();
   const rows=[];
   for(let i=0;i<12;i++){await frame();const start=performance.now();t.renderer.render(t.scene,t.camera);t.renderer.getContext().finish();rows.push({ms:performance.now()-start,calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles});}
   const key=enabled?'on':'off';samples[key]=rows;images[key]=t.renderer.domElement.toDataURL('image/png');
  }
  const actual=[];t.scene.traverse(o=>{if(o.isPointLight&&o.userData.isLightPool&&o.castShadow)actual.push(o);});
  return {samples,images,rendererShadowEnabled:t.renderer.shadowMap.enabled,shadows:actual.map(l=>({name:l.name,source:l.userData.sourceLightName,castShadow:l.castShadow,visible:l.visible,intensity:l.intensity,mapReady:!!l.shadow.map,size:l.shadow.mapSize.toArray(),cached:!l.shadow.autoUpdate,pending:l.shadow.needsUpdate})),scope:'1280x800 desktop headless Chrome synchronized render timings; two cached architectural shadows in existing fixed pool, not mobile FPS or dynamic battle shadows.'};
 });
 console.log(JSON.stringify({rendererShadowEnabled:result.rendererShadowEnabled,shadows:result.shadows}));
 assert.equal(result.shadows.length,2);
 for(const s of result.shadows){assert(s.mapReady);assert(s.cached);assert.equal(s.pending,false);}
 assert.equal(errors.length,0);result.errors=errors;
 for(const [name,data]of Object.entries(result.images))await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/light-r03-shadow-'+name+'.png',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
 delete result.images;
 for(const name of ['off','on']){const rows=result.samples[name];result[name]={meanMs:rows.reduce((a,b)=>a+b.ms,0)/rows.length,calls:rows[0].calls,triangles:rows[0].triangles};}
 result.passed=true;await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/light-r03-shadow-audit.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({off:result.off,on:result.on,shadows:result.shadows}));
}finally{await browser.close();}
