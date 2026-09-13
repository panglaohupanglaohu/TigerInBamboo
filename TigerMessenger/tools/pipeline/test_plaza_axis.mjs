import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-plaza-axis/',import.meta.url);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const report={};
try{for(const version of ['before','after']){
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelPlazaOffset='+(version==='after'?'1':'0'),{timeout:180000});
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('west-city-plaza-paving-ring'),null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city'),mesh=c.getObjectByName('west-city-plaza-paving-ring');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);
  const pictures={};
  for(const [name,eye,look,fov]of [['new-city',[9,32,124],[57,15,62],53],['plaza',[35,26,109],[61,5,74],48]]){
   t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=fov;t.camera.updateProjectionMatrix();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.renderer.render(t.scene,t.camera);pictures[name]=t.renderer.domElement.toDataURL('image/png');
  }
  const a=mesh.geometry.attributes;let downward=0;for(let i=0;i<a.normal.count;i++)if(a.normal.getY(i)<.99)downward++;
  const statue=c.getObjectByName('citadel-plaza-hero-statue'),horse=t.scene.getObjectByName('citadel-trojan-horse');
  const ray=new T.Raycaster();ray.layers.enableAll();ray.far=.35;const floors=[];
  c.traverse(o=>{if(o.isMesh&&o.userData.westCityWalkable)floors.push(o);});
  const footTests=[];const check=(x,y,z,label)=>{ray.set(c.localToWorld(new T.Vector3(x,y+.16,z)),new T.Vector3(0,-1,0).transformDirection(c.matrixWorld));const h=ray.intersectObjects(floors,false)[0];footTests.push({x,y,z,label,supported:!!h});};
  const shift=c.userData.plazaLayout.horseShift;
  const stairCount=shift?8:12;for(const dx of [-.7,0,.7])for(let i=0;i<stairCount;i++)check(66.6+shift+(i+.5)*2.4/stairCount,4+(i+1)*1.8/stairCount,77+dx,'horse-stair');
  for(let x=47;x<=86;x+=2)for(let z=61;z<=87;z+=2){if(!shift&&x>80)continue;if(x>=69+shift&&x<=81+shift&&z<=79.5)continue;check(x,4,z,'plaza');}
  for(let i=0;i<=12;i++){const z=60+5.5*i/12;for(const dx of [-2,0,2])check(75+shift+dx,4+1.8*i/12,z,'horse-ramp');}
  const profile=t.scene.getObjectByName('castleContainer').userData.tierLighting;
  profile.expectedWorld=[];
  for(const [side,name]of [['old','highland-light-volumes'],['new','citadel-new-city-lighting']])t.scene.getObjectByName(name).traverse(o=>{if(o.isPointLight)profile.expectedWorld.push({side,name:o.name,position:o.position.toArray(),world:o.getWorldPosition(new T.Vector3()).toArray(),energy:o.intensity,color:o.color.getHex(),radius:o.distance});});
  return {profile,footTests,layout:c.userData.plazaLayout,statue:c.worldToLocal(statue.getWorldPosition(new T.Vector3())).toArray(),horse:c.worldToLocal(horse.getWorldPosition(new T.Vector3())).toArray(),support:c.getObjectByName('citadel-plaza-retaining-wall').userData.support,paving:mesh.userData,triangles:a.position.count/3,downward,walkRoute:c.userData.walkRoute,horseRoute:c.userData.horsePlazaExit.map(p=>c.worldToLocal(t.scene.getObjectByName('castleContainer').localToWorld(new T.Vector3(...p))).toArray()),pictures};
 });
 for(const [name,image]of Object.entries(data.pictures))await writeFile(new URL(version+'-'+name+'.png',out),Buffer.from(image.split(',')[1],'base64'));delete data.pictures;data.errors=errors;assert.equal(errors.length,0);report[version]=data;await p.close();
}
assert.equal(report.after.downward,0);assert.ok(report.after.paving.fieldStones>500);assert.deepEqual(report.before.walkRoute,report.after.walkRoute);assert.ok(report.after.footTests.every(p=>p.supported),JSON.stringify(report.after.footTests.filter(p=>!p.supported)));assert.equal(report.after.layout.statueX,65);assert.equal(report.after.layout.horseX,81);assert.ok(report.after.support.bays.some(b=>b.easternReturn));
await writeFile(new URL('../../godot/data/citadel-horse-plaza-exit.json',import.meta.url),JSON.stringify({frame:'highland-west-city authored local',points:report.after.horseRoute},null,2));await writeFile(new URL('../../godot/data/citadel-tier-lighting.json',import.meta.url),JSON.stringify(report.after.profile,null,2));await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,paving:report.after.paving,triangles:report.after.triangles}));
}finally{await b.close();}
