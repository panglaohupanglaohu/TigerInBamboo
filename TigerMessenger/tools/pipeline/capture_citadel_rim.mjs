import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const variant=process.argv.includes('--before')?'before':'after';
const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city'),terrain=c.getObjectByName('citadel-oskar-grid-mountain-surface'),rim=c.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface');
  t.P.timeOfDay=.7;t.P.daySpeed=0;t.cameraRig.update=()=>{};
  t.camera.position.copy(city.localToWorld(new T.Vector3(104,0,102)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(72,9,66)));t.camera.updateProjectionMatrix();
  for(let i=0;i<70;i++)await new Promise(r=>requestAnimationFrame(r));
  t.renderer.render(t.scene,t.camera);
  const pick=new T.Raycaster();pick.layers.enableAll();const meshes=[];c.traverseVisible(o=>{if(o.isMesh&&!o.userData.backlitHighlight)meshes.push(o);});
  const facadeProbes=[[.55,.76],[.65,.70],[.50,.5]].map(([x,y])=>{
   pick.setFromCamera(new T.Vector2(x*2-1,1-y*2),t.camera);
   const hit=pick.intersectObjects(meshes,false)[0];
   return {screen:[x,y],name:hit?.object.name,parent:hit?.object.parent.name,point:hit?city.worldToLocal(hit.point.clone()).toArray():null};
  });
  const pos=terrain.geometry.attributes.position;let digest=2166136261;
  for(const v of pos.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;
  return {image:t.renderer.domElement.toDataURL('image/png'),facadeProbes,rim:rim?{scale:rim.scale.toArray(),depthTest:rim.material.depthTest,transparent:rim.material.transparent}:null,terrainVertices:pos.count,terrainDigest:digest};
 });
 await writeFile(new URL('rim-'+variant+'.png',out),Buffer.from(data.image.split(',')[1],'base64'));delete data.image;
 data.errors=errors;await writeFile(new URL('rim-'+variant+'.json',out),JSON.stringify(data,null,2));console.log(JSON.stringify(data));
 if(errors.length||(variant==='after'&&data.rim))process.exitCode=1;
}finally{await b.close();}
