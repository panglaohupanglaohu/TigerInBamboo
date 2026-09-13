import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const revision=process.argv.find(a=>/^--revision=\d+$/.test(a))?.split('=')[1]||'5';
const source=JSON.parse(await readFile(new URL('../../artifacts/pipeline/citadel-master-terrain/source.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const report={};
 for(const candidate of [false,true]){
  const p=await browser.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(candidate?'&citadelMasterTerrain='+revision:''));
  await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('new-city-rock-shoulder'),null,{timeout:180000});
  if(candidate)await p.waitForFunction(()=>window.__tm.scene.getObjectByName('castleContainer').userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
  report[candidate?'candidate':'baseline']=await p.evaluate(({oldLots,oldFrame})=>{
   const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer');c.updateWorldMatrix(true,true);
   const frame=new T.Matrix4().multiplyMatrices(c.matrixWorld,new T.Matrix4().fromArray(oldFrame)),inv=frame.clone().invert();
   const surfaces=['citadel-oskar-grid-mountain-surface','highland-town-foundation-platform','highland-ravine-wall-west'].map(n=>c.getObjectByName(n)).filter(Boolean);
   const ray=new T.Raycaster();ray.layers.enableAll();ray.far=100;const down=new T.Vector3(0,-1,0).transformDirection(frame),result=[];
   for(const [lotIndex,l]of oldLots.entries())for(const [dx,dz]of [[0,0],[-1.5,-1.5],[1.5,-1.5],[1.5,1.5],[-1.5,1.5]]){
    ray.set(new T.Vector3(l.x+dx,l.base+.5,l.z+dz).applyMatrix4(frame),down);
    const hit=ray.intersectObjects(surfaces,false)[0];result.push({lotIndex,dx,dz,base:l.base,y:hit?hit.point.clone().applyMatrix4(inv).y:null});
   }return result;
  },{oldLots:source.oldLots,oldFrame:source.oldFrame});await p.close();
 }
 const changed=[];for(let i=0;i<report.baseline.length;i++){const a=report.baseline[i],b=report.candidate[i];if((a.y===null)!==(b.y===null)||a.y!==null&&Math.abs(a.y-b.y)>.002)changed.push({before:a,after:b});}
 report.comparison={samples:report.baseline.length,changedSupports:changed,baselineMissing:report.baseline.filter(p=>p.y===null).length,scope:'centre plus four corners of WFC lot rectangles; compares support heights, not full structural or character validation'};
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/r'+revision.padStart(2,'0')+'-lot-support.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report.comparison,changedSupports:changed.length}));
}finally{await browser.close();}
