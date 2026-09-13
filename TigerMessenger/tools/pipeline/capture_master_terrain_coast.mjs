import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{for(const candidate of [false,true]){
 const p=await b.newPage({viewport:{width:1400,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(candidate?'&citadelMasterTerrain=6':''));
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('new-city-rock-shoulder'),null,{timeout:180000});
 if(candidate)await p.waitForFunction(()=>window.__tm.scene.getObjectByName('castleContainer').userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const pictures=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');c.updateWorldMatrix(true,true);t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.35;
  const shots={};for(const [name,eye,look]of [['east-coast',[62,7,91],[38.5,-7,67]],['bay-seal',[-15,10,58],[4.4,-1,35]]]){
   t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=55;t.camera.updateProjectionMatrix();
   for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);t.renderer.render(t.scene,t.camera);shots[name]=t.renderer.domElement.toDataURL('image/png');
  }return shots;
 });for(const [name,image]of Object.entries(pictures))await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/'+(candidate?'r06-':'baseline-')+name+'.png',import.meta.url),Buffer.from(image.split(',')[1],'base64'));await p.close();
}}finally{await b.close();}
