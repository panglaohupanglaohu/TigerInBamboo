import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-target-castle-silhouette'),null,{timeout:180000});
 const report=await p.evaluate(()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);
  t.camera.position.copy(city.localToWorld(new T.Vector3(100,30,68)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(61,19,24)));t.camera.fov=55;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
  const ray=new T.Raycaster(),meshes=[];t.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&o.layers.test(t.camera.layers))meshes.push(o);});
  const rays=[[.14,.18],[.18,.26],[.21,.34],[.26,.44],[.17,.60]].map(uv=>{
   ray.setFromCamera(new T.Vector2(uv[0]*2-1,1-uv[1]*2),t.camera);
   const hits=ray.intersectObjects(meshes,false).slice(0,5).map(h=>{const parents=[];for(let n=h.object;n;n=n.parent)parents.push(n.name);return {name:h.object.name,parents,distance:h.distance,cityPoint:city.worldToLocal(h.point.clone()).toArray()};});return {uv,hits};
  });
  const forests=['citadel-mountain-cypress-groves','highland-canopy-groves'].map(name=>{
   const objects=[];t.scene.traverseVisible(o=>{if(o.name===name)objects.push(o);});
   let meshes=0,vertices=0,instances=0;
   for(const o of objects)o.traverseVisible(m=>{if(!m.isMesh||m.userData.isOutline)return;const n=m.isInstancedMesh?m.count:1;if(n===0)return;meshes++;instances+=n;vertices+=m.geometry.attributes.position.count*n;});
   return {name,groups:objects.length,meshes,vertices,instances,trees:objects[0]?.userData.planting?.cypress?.length??null};
  });return {rays,forests};
 });await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/mountain-parity-web-rays.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
