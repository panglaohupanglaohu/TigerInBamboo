const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await browser.newPage();await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
 const T=await import('three'),scene=window.__tm.scene;let castle;scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
 const horse=scene.getObjectByName('citadel-trojan-horse'),night=horse.userData.nightInfiltration;castle.updateWorldMatrix(true,true);
 const meshes=[];castle.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.material?.transparent&&!/water|cloud|mist|light|grass|shrub|tree/i.test(o.name))meshes.push(o);});
 const up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();
 const groups=[];
 for(const group of night.userData.groups)for(const record of group.userData.records){
  const points=record.path.points,missing=[],blocked=[];let samples=0;
  for(let j=1;j<points.length;j++){
   const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(a.distanceTo(b)/.35));
   for(let i=0;i<=n;i++){
    const q=a.clone().lerp(b,i/n);ray.set(q.clone().addScaledVector(up,.35),up.clone().negate());ray.far=1.0;
    const hit=ray.intersectObjects(meshes,false)[0];samples++;
    if(!hit)missing.push({segment:j,point:castle.worldToLocal(q.clone()).toArray()});
    const d=b.clone().sub(q),length=Math.min(.35,d.length());
    if(length>.001){ray.set(q.clone().addScaledVector(up,.65),d.normalize());ray.far=length;const wall=ray.intersectObjects(meshes,false)[0];if(wall)blocked.push({segment:j,point:castle.worldToLocal(q.clone()).toArray(),mesh:wall.object.name});}
   }
  }
  groups.push({name:group.name,soldier:record.index,speed:record.path.total/record.moveDuration,pointCount:points.length,samples,missingCount:missing.length,missing:missing.slice(0,80),blockedCount:blocked.length,blocked:blocked.slice(0,40)});
 }
 return {horsePosition:castle.worldToLocal(horse.position.clone()).toArray(),groups,scope:'actual paths of all eight soldiers; support and torso clearance; not full combat',passed:groups.every(g=>g.missingCount===0&&g.blockedCount===0&&g.speed<=2.40001)};
 });
 const out=path.resolve(__dirname,'../../artifacts/pipeline/citadel-plaza-horse');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/web-approach.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
