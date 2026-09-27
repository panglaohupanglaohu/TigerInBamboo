import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/crystal-v10-thirty-rounds';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.messenger?.landmarks?.crystalMotherPort,null,{timeout:180000});
 const result=await p.evaluate(()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,port=l.crystalMotherPort;
  t.cameraRig.update=()=>{};t.scene.updateMatrixWorld(true);
  const rocks=[];l.moebius.grand.group.traverse(o=>{if(o.isMesh&&o.name==='v12-crystal-bedrock')rocks.push(o)});
  const samples=[],ray=new T.Raycaster();
  for(const mesh of port.surfaces.filter(o=>/upper-walk|tower-landing/.test(o.name))){
   mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
   for(let i=0;i<=20;i++)for(const lane of[-.7,0,.7]){
    const local=new T.Vector3(lane,box.max.y+.1,T.MathUtils.lerp(box.min.z,box.max.z,i/20)),world=mesh.localToWorld(local),up=world.clone().normalize();ray.set(world,up);ray.far=2;
    const hit=ray.intersectObjects(rocks,false)[0];samples.push({surface:mesh.name,i,lane,blocked:!!hit,hit:hit?.object.name});
   }
  }
  t.camera.position.copy(port.root.localToWorld(new T.Vector3(24,port.high+16,28)));t.camera.up.set(0,1,0).transformDirection(port.root.matrixWorld);t.camera.lookAt(port.root.localToWorld(new T.Vector3(3,port.high/2,5)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);
  return {samples,blocked:samples.filter(x=>x.blocked),scope:'Static upward headroom rays over upper port walk and landing against added crystal basal rocks; not full boarding or movement test',round:l.moebius.grand.group.userData.v10Round};
 });
 await p.waitForTimeout(1200);const png=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL()});await writeFile(`${out}/r14-port.png`,Buffer.from(png.split(',')[1],'base64'));
 result.errors=errors;result.passed=!result.blocked.length&&!errors.length;await writeFile(`${out}/r14-port-check.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,samples:result.samples.length,blocked:result.blocked.length,errors}));
}finally{await browser.close()}
