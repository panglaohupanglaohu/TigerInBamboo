import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-common-frame/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  c.updateMatrix();const original=c.matrix.clone();const rows=[];
  for(const [px,pz] of [[-20,35],[-15,50],[-10,55]]){
   c.matrix.copy(original);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
   const sea=createOceanHeightSampler(c,radius),center=new T.Vector3(px,sea(px,pz),pz),up=c.localToWorld(center.clone()).normalize().transformDirection(c.matrixWorld.clone().invert());
   const side=new T.Vector3(1,0,0).addScaledVector(up,-up.x).normalize(),forward=new T.Vector3().crossVectors(side,up).normalize();
   const delta=new T.Matrix4().makeBasis(side,up,forward);delta.setPosition(center);delta.multiply(new T.Matrix4().makeTranslation(-px,0,-pz));
   c.matrix.copy(original).multiply(delta);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
   const newSea=createOceanHeightSampler(city,radius),corners=[44.85,76].flatMap(x=>[59.5,83.5].map(z=>({x,z,clearance:4-newSea(x,z)})));
   const oldSea=createOceanHeightSampler(c,radius);
   rows.push({pivot:[px,pz],delta:delta.toArray(),corners,oldCoreClearance:5-oldSea(-52,0),oldHarborClearance:7.7-oldSea(-72,32)});
  }
  c.matrix.copy(original);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
  return rows;
 });await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
