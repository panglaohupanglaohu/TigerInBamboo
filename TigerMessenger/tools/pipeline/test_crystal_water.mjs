import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.citySeaLake,null,{timeout:180000});
 const result=await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE,sea=t.messenger.landmarks.citySeaLake;
  t.scene.updateMatrixWorld(true);
  const layers=sea.group.children.slice(0,2).map((mesh,index)=>({index,positions:Array.from(mesh.geometry.attributes.position.array),normals:Array.from(mesh.geometry.attributes.normal.array),uv:Array.from(mesh.geometry.attributes.uv.array),indices:Array.from(mesh.geometry.index.array),parameters:mesh.geometry.userData.sphericalWater}));
  const mesh=sea.group.children[0],p=mesh.geometry.attributes.position,ix=mesh.geometry.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let maxError=0,badNormals=0;
  for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i)).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,ix.getX(i+1)).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,ix.getX(i+2)).applyMatrix4(mesh.matrixWorld);const center=a.clone().add(b).add(c).multiplyScalar(1/3);maxError=Math.max(maxError,Math.abs(center.length()-sea.surfaceHeightAt(center)));const normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.lengthSq()>1e-12&&normal.dot(center)<0)badNormals++;}
  const u=sea.centerDir.clone(),east=new T.Vector3(0,1,0).cross(u).normalize(),north=u.clone().cross(east).normalize();
  t.camera.position.copy(u.clone().multiplyScalar(sea.surfaceR+105).addScaledVector(north,-125).addScaledVector(east,65));t.camera.up.copy(u);t.camera.lookAt(u.clone().multiplyScalar(sea.surfaceR+10));t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
  const bridgeU=.293212890625,trackPoint=t.messenger.landmarks.tramSystem.curve.getPointAt(bridgeU);
  return {layers,source:'src/world/citySeaLake.js',maxTriangleCenterWaterlineError:maxError,badNormals,waterTriangles:ix.count/3,surfaceR:sea.surfaceR,
   previouslyLowBridge:{u:bridgeU,railRadius:trackPoint.length(),railAboveLakeDatum:trackPoint.length()-sea.surfaceR,note:'Nominal lake datum comparison; no boat clearance approval'},
   passed:maxError<.08&&badNormals===0};
 });
 await page.screenshot({path:new URL('../../artifacts/pipeline/moebius-crystal-city-target/water-fixed.png',import.meta.url).pathname});
 await writeFile(new URL('../../godot/data/crystal-lake-surfaces.json',import.meta.url),JSON.stringify({source:result.source,layers:result.layers}));
 delete result.layers;result.errors=errors;result.passed&&=errors.length===0;
 await writeFile(new URL('../../artifacts/pipeline/moebius-crystal-city-target/water-fix-check.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}finally{await browser.close();}
