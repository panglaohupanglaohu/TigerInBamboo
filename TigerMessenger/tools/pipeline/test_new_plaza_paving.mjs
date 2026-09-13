import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-new-plaza-paving/',import.meta.url);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const report={};
try{for(const version of ['before','after']){
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 if(version==='before'){const backlit=await readFile(new URL('before-backlit.js',out),'utf8');await p.route('**/src/world/backlitHighlight.js*',r=>r.fulfill({contentType:'text/javascript',body:backlit}));const body=await readFile(new URL('before.js',out),'utf8');await p.route('**/src/world/citadel/plazaPaving.js*',r=>r.fulfill({contentType:'text/javascript',body}));}
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('west-city-plaza-paving-ring'),null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city'),mesh=c.getObjectByName('west-city-plaza-paving-ring');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);
  const pictures={};
  for(const [name,eye,look,fov]of [['new-city',[9,32,124],[57,15,62],53],['plaza',[35,26,109],[61,5,74],48]]){
   t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=fov;t.camera.updateProjectionMatrix();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.renderer.render(t.scene,t.camera);pictures[name]=t.renderer.domElement.toDataURL('image/png');
  }
  const a=mesh.geometry.attributes;let downward=0;for(let i=0;i<a.normal.count;i++)if(a.normal.getY(i)<.99)downward++;
  return {paving:mesh.userData,triangles:a.position.count/3,downward,walkRoute:c.userData.walkRoute,horseRoute:c.userData.boardingRoute,pictures};
 });
 for(const [name,image]of Object.entries(data.pictures))await writeFile(new URL(version+'-'+name+'.png',out),Buffer.from(image.split(',')[1],'base64'));delete data.pictures;data.errors=errors;assert.equal(errors.length,0);report[version]=data;await p.close();
}
assert.equal(report.after.downward,0);assert.ok(report.after.paving.fieldStones>500);assert.deepEqual(report.before.walkRoute,report.after.walkRoute);assert.deepEqual(report.before.horseRoute,report.after.horseRoute);
await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,paving:report.after.paving,triangles:report.after.triangles}));
}finally{await b.close();}
