import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='TigerMessenger/artifacts/pipeline/canal-junction-target';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalJunctionCitadel?.userData?.junctionTarget && window.__tm.scene.getObjectByName('gate-canyon-site-blender'),null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE,root=t.messenger.landmarks.canalJunctionCitadel,box=t.messenger.landmarks.canalJunctionBox;
  t.scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),parts=[];
  root.traverse(o=>{if(o.isMesh)parts.push({name:o.name,instanced:!!o.isInstancedMesh,count:o.count??1,vertices:o.geometry?.attributes.position?.count??0});});
  t.camera.position.copy(root.localToWorld(new T.Vector3(33,30,39)));t.camera.up.set(0,1,0).transformDirection(root.matrixWorld);t.camera.lookAt(root.localToWorld(new T.Vector3(0,8,0)));t.camera.updateProjectionMatrix();
  t.P.timeOfDay=.68;t.dayNight.update(0);t.lightingDirector.update(0,{timeOfDay:.68,weather:0});t.distanceCulling?.update?.(1);t.renderer.render(t.scene,t.camera);
  const image=t.renderer.domElement.toDataURL('image/png');
  t.camera.position.copy(root.localToWorld(new T.Vector3(10,10,27)));t.camera.lookAt(root.localToWorld(new T.Vector3(0,4,8)));t.renderer.render(t.scene,t.camera);const frontImage=t.renderer.domElement.toDataURL('image/png');
  return {image,frontImage,renderer:{calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,geometries:t.renderer.info.memory.geometries,textures:t.renderer.info.memory.textures},origin:root.position.toArray(),quaternion:root.quaternion.toArray(),waterLift:box?.userData.waterLift,halfLength:box?.userData.halfLength,halfWidth:box?.userData.halfWidth,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},parts,scope:'Fresh browser default layout; no saved user layout replaced'};
 });
 await writeFile(dir+'/'+(process.argv[2]||'before')+'.png',Buffer.from(report.image.split(',')[1],'base64'));await writeFile(dir+'/'+(process.argv[2]||'before')+'-front.png',Buffer.from(report.frontImage.split(',')[1],'base64'));delete report.image;delete report.frontImage;await writeFile(dir+'/'+(process.argv[2]||'before')+'-report.json',JSON.stringify(report,null,2));await writeFile(dir+'/baseline.json',JSON.stringify(report,null,2));console.log(JSON.stringify({meshes:report.parts.length,origin:report.origin}));
}finally{await browser.close();}
