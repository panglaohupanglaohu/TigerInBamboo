import {chromium} from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const phase='site-test',dir='TigerMessenger/artifacts/pipeline/crystal-performance/gate-check';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&gateSiteReview=1'+(phase==='release'?'&gateReview=1':''));
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData?.seatRoot,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
 const t=window.__tm,T=t.THREE,seat=t.messenger.landmarks.abandonedGate.userData.seatRoot,site=seat.userData.siteRoot;
 const {createGatePlayerGround,createGatePlayerWalls}=await import('/TigerMessenger/src/world/gateTarget.js');const sample=createGatePlayerGround(seat);const misses=[];site.updateWorldMatrix(true,true);
 for(const [i,point] of site.userData.approachRoute.entries()){const p=site.localToWorld(new T.Vector3(...point));p.addScaledVector(p.clone().normalize(),.04);const r=sample(p);if(!Number.isFinite(r)||Math.abs(r-p.length())>.2)misses.push({i,point,ground:r,error:r-p.length()});}
 const {resolveCollisions}=await import('/TigerMessenger/src/world/collision.js');
 const points=[...site.userData.approachRoute].reverse();points.push([-23,-3.78,-39],[-23,-3.76,-36.8],[-23,3.24,-21.8]);
 const pos=site.localToWorld(new T.Vector3(...points[0])),velocity=new T.Vector3(),prev=new T.Vector3(),up=new T.Vector3(),actor={onGround:true},walls=createGatePlayerWalls(seat);let seconds=0,stalled=false;
 for(const point of points.slice(1)){
  const target=site.localToWorld(new T.Vector3(...point));let ticks=0;
  while(pos.distanceTo(target)>.55&&ticks++<2400){prev.copy(pos);up.copy(pos).normalize();velocity.copy(target).sub(pos);velocity.addScaledVector(up,-velocity.dot(up)).normalize().multiplyScalar(2);velocity.addScaledVector(up,-.18);resolveCollisions(pos,velocity,1/60,[],actor,()=>{},null,sample);walls(prev,pos,velocity);seconds+=1/60;}
  if(ticks>=2400){stalled=true;break;}
 }
 const galleryMisses=[];for(const side of[-1,1])for(let z=-21;z<=21;z+=3){const p=seat.localToWorld(new T.Vector3(side*5.1,.05,z)),ground=sample(p);if(!Number.isFinite(ground)||Math.abs(ground-p.length())>.18)galleryMisses.push({side,z,ground,expected:p.length()});}
 return {galleryMisses,approachSteps:site.userData.approachRoute.length,misses,walk:{stalled,seconds,endpoint:site.worldToLocal(pos).toArray()},passed:misses.length===0&&galleryMisses.length===0&&!stalled,scope:'Original movement/collision solver, synthetic waypoint input, not manual playthrough'};
 });
 await writeFile('TigerMessenger/artifacts/pipeline/crystal-performance/gate-check/site-ground-check.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify(result));if(!result.passed||errors.length)process.exitCode=1;
}finally{await browser.close();}
