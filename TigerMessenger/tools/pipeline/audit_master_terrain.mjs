import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const report={};
 for(const candidate of [false,true]){
  const page=await browser.newPage();
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(candidate?'&citadelMasterTerrain=5':''));
  await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('new-city-rock-shoulder'),null,{timeout:180000});
  if(candidate)await page.waitForFunction(()=>window.__tm.scene.getObjectByName('castleContainer').userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
  report[candidate?'candidate':'baseline']=await page.evaluate(()=>{
   const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');c.updateWorldMatrix(true,true);
   const rocks=['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal','new-city-rock-shoulder'].map(n=>c.getObjectByName(n)),ray=new T.Raycaster();ray.layers.enableAll();
   const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),hits=[];let samples=0;
   for(const route of [city.userData.frontHarborRoute,city.userData.plazaToKeepRoute])for(let j=1;j<route.length;j++){
    const a=new T.Vector3(...route[j-1]),b=new T.Vector3(...route[j]),n=Math.max(1,Math.ceil(a.distanceTo(b)/.15));
    for(let i=0;i<n;i++){
     const p=a.clone().lerp(b,i/n),world=c.localToWorld(p.clone());
     for(const height of [.4,1.4]){
      const end=c.localToWorld(b.clone()).addScaledVector(up,height),start=world.clone().addScaledVector(up,height),d=end.sub(start);ray.far=Math.min(.15,d.length());
      if(ray.far<.001)continue;ray.set(start,d.normalize());const hit=ray.intersectObjects(rocks,false)[0];if(hit)hits.push({p:p.toArray(),height,mesh:hit.object.name});
     }
     samples++;
    }
   }
   return {samples,rockHits:hits,scope:'centreline forward rock rays at 0.4/1.4m on actual front-harbor and plaza-to-keep routes; not a full character/vegetation/building test'};
  });await page.close();
 }
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/r05-route-audit.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([k,v])=>[k,{samples:v.samples,rockHits:v.rockHits.length}]))));
}finally{await browser.close();}
