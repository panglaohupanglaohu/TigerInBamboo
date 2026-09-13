import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/camp-ocean-conformance/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const reports={};
 for(const variant of ['default','common-frame']) for(const before of [true,false]) {
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  if(before)await page.route('**/src/scenes/messengerIsland.js',async route=>{const response=await route.fetch();const body=(await response.text()).replace('conformCampShallowsToOcean(camp.group, worldOcean, R)','void 0');await route.fulfill({response,body});});
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(variant==='common-frame'?'&citadelCommonFrame=1':''),{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
  const data=await page.evaluate(()=>{
   const t=window.__tm,T=t.THREE,camp=t.scene.getObjectByName('starting-camp'),ocean=t.scene.getObjectByName('planet-v8-curved-ocean'),castle=t.scene.getObjectByName('castleContainer');
   t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
   const ray=new T.Raycaster();ray.layers.enableAll();let minimum=Infinity,samples=0,missing=0;const patches=[],sand=[];
   for(const mesh of camp.children){
    if(mesh.name!=='camp-flat-patch')continue;
    const g=mesh.geometry,p=g.attributes.position;
    if(!mesh.userData.shallowWaterDecoration){sand.push(Array.from(p.array));continue;}
    for(let k=0;k<g.index.count;k+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,g.index.getX(k+j)).applyMatrix4(mesh.matrixWorld));
     for(let i=0;i<=10;i++)for(let j=0;j<=10-i;j++){
      const v=points[0].clone().multiplyScalar(i/10).addScaledVector(points[1],j/10).addScaledVector(points[2],1-(i+j)/10),dir=v.clone().normalize();
      ray.set(dir.clone().multiplyScalar(220),dir.clone().negate());ray.far=220;const hit=ray.intersectObject(ocean,false)[0];if(!hit){missing++;continue;}minimum=Math.min(minimum,hit.point.length()-v.length()-.067);samples++;
     }
    }
    patches.push({suffix:'camp-flat-patch['+camp.children.indexOf(mesh)+']',positions:Array.from(p.array),normals:Array.from(g.attributes.normal.array),indices:Array.from(g.index.array),matrix:mesh.matrixWorld.toArray()});
   }
   t.camera.position.copy(castle.localToWorld(new T.Vector3(0,34,170)));t.camera.up.set(0,1,0).transformDirection(castle.matrixWorld);t.camera.lookAt(castle.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
   return {source:'original-game-final-ocean-shallow-patches-v1',minimumWaveClearance:minimum,samples,missing,patches,sand,conformance:camp.userData.shallowOceanConformance,image:t.renderer.domElement.toDataURL('image/png')};
  });
  const label=variant+(before?'-before':'-after');await writeFile(new URL(label+'.png',out),Buffer.from(data.image.split(',')[1],'base64'));delete data.image;data.errors=errors;reports[label]=data;
  if(!before){assert.equal(data.patches.length,11);assert.equal(data.missing,0);assert.ok(data.minimumWaveClearance>.1,JSON.stringify(data.minimumWaveClearance));assert.deepEqual(data.sand,reports[variant+'-before'].sand);assert.equal(errors.length,0);
   const file=(variant==='common-frame'?'common-frame-':'')+'camp-shallows.json';await writeFile(new URL('../../godot/data/'+file,import.meta.url),JSON.stringify({source:data.source,patches:data.patches}));}
  await page.close();
 }
 await writeFile(new URL('report.json',out),JSON.stringify(reports,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{clearance:v.minimumWaveClearance,samples:v.samples,missing:v.missing,errors:v.errors}]))));
}finally{await browser.close();}
