import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const candidate=JSON.parse(await readFile(new URL('../../assets/navigation/citadel-red-arrival-candidate.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-front-harbor'),null,{timeout:180000});
 const report=await page.evaluate(async data=>{
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {orientWarship}=await import('/TigerMessenger/src/world/warshipNavigation.js');
  const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
  const t=window.__tm,T=t.THREE,boat=createFisherBoat();boat.scale.setScalar(data.boatScale);
  const solver=createWarshipWaterRoutes(t.scene,160),check=createWarshipClearance(boat,solver.obstacles);
  const points=data.ocean.points.map(p=>new T.Vector3(...p)),frame=new T.Group();
  const poses=points.map((p,i)=>{
   const heading=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]);
   orientWarship(frame,p,heading);
   const q=i===points.length-1?data.connector.poses[0].quaternion:frame.quaternion.toArray();
   return {position:p.toArray(),quaternion:q};
  });
  const seamDistance=new T.Vector3(...poses.at(-1).position).distanceTo(new T.Vector3(...data.connector.poses[0].position));
  poses.push(...data.connector.poses.slice(1));
  let checks=0,length=0,failure=null;
  const start=performance.now(),scale=boat.scale,p=new T.Vector3(),q=new T.Quaternion();
  for(let i=1;i<poses.length&&!failure;i++){
   const a=new T.Vector3(...poses[i-1].position),b=new T.Vector3(...poses[i].position),qa=new T.Quaternion(...poses[i-1].quaternion),qb=new T.Quaternion(...poses[i].quaternion);
   const span=a.distanceTo(b);length+=span;
   const n=Math.max(1,Math.ceil(span/.01),Math.ceil(qa.angleTo(qb)/(.25*Math.PI/180)));
   for(let j=0;j<=n;j++){
    p.copy(a).lerp(b,j/n);q.copy(qa).slerp(qb,j/n);
    const hit=check.clear(p,q,scale);checks++;
    if(!hit.clear){failure={segment:i,substep:j,...hit};break;}
   }
  }
  const city=t.scene.getObjectByName('highland-west-city');city.updateWorldMatrix(true,true);
  return {passed:!failure&&seamDistance<.001,checks,length,seamDistance,failure,elapsedMs:performance.now()-start,poses,cityMatrix:city.matrixWorld.toArray(),boatScale:data.boatScale,coastSignature:t.scene.getObjectByName('castleContainer').userData.frontHarborCoast?.geometrySignature,minimumDepth:solver.stats.minimumDepth,boatSource:boat.userData.warshipV6.sha256,shorePoint:data.berth.shorePoint,boardingAngle:data.berth.angle,scope:'Static actual vessel against current terrain/buildings, all interpolated route poses at <=0.01m / <=0.25deg. Moving ships, rowing cycle and boarding remain unverified.'};
 },candidate);
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/red-arrival-sweep.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks,length:report.length,failure:report.failure,elapsedMs:report.elapsedMs}));
 if(report.passed){
  const released={...report,version:1,source:'tools/pipeline/validate_red_arrival_poses.mjs'};
  await writeFile(new URL('../../assets/navigation/citadelRedArrival.js',import.meta.url),'export default '+JSON.stringify(released)+';\n');
  await writeFile(new URL('../../godot/data/citadel-red-arrival-route.json',import.meta.url),JSON.stringify(released));
 }else process.exitCode=1;
}finally{await browser.close();}
