import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-plaza-frame/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  const sea=createOceanHeightSampler(city,radius);
  const profiles=[71.5,63.5,55.5,51.5].map(z=>({centerZ:z,corners:[44.85,76].flatMap(x=>[z-12,z+12].map(zz=>({x,z:zz,sea:sea(x,zz),clearanceAtY4:4-sea(x,zz)})))}));
  const center=new T.Vector3(60,sea(60,71.5)+6,71.5),world=city.localToWorld(center.clone());
  const up=world.clone().normalize().transformDirection(city.matrixWorld.clone().invert());
  const side=new T.Vector3(1,0,0).addScaledVector(up,-up.x).normalize();const forward=new T.Vector3().crossVectors(side,up).normalize();
  const frame=new T.Matrix4().makeBasis(side,up,forward);frame.setPosition(center);
  const corners=[-15.15,16].flatMap(x=>[-12,12].map(z=>{const v=new T.Vector3(x,0,z).applyMatrix4(frame);return {point:v.toArray(),sea:sea(v.x,v.z),verticalClearance:v.y-sea(v.x,v.z)};}));
  const childRows=city.children.map(o=>({name:o.name,position:o.position.toArray(),isGroup:o.isGroup,sourceId:o.userData.sourceId}));
  return {radius,profiles,candidate:{type:'independent tangent plaza only; main castle untouched',center:center.toArray(),up:up.toArray(),frame:frame.toArray(),corners},childRows};
 });await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({profiles:report.profiles,candidate:report.candidate,frontChildren:report.childRows.filter(r=>r.position[2]>55||/plaza|garden|horse|paving/.test(r.name))}));
}finally{await b.close();}
