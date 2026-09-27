import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before',dir='TigerMessenger/artifacts/pipeline/gate-of-sighs-build';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(phase==='release'?'&gateReview=1':'')+(phase.startsWith('site')?'&gateSiteReview=1&gateLightingPhase='+ (phase.includes('night')?'.92':phase.includes('day')?'.5':'.75'):''));
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData?.seatRoot,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,gate=t.messenger.landmarks.abandonedGate,seat=gate.userData.seatRoot;
  t.scene.updateMatrixWorld(true);const inv=seat.matrixWorld.clone().invert(),parts=[];
  seat.traverse(o=>{if(!o.isMesh||o.material?.side===T.BackSide||o.name.includes('outline'))return;
   const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
   const matrix=inv.clone().multiply(o.matrixWorld),a=geometry.attributes.position,v=new T.Vector3(),positions=[];
   for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(matrix);positions.push(...v.toArray());}
   parts.push({name:o.name,positions,color:o.material.color?.toArray()||[.5,.3,.2]});
  });
  const curve=t.messenger.landmarks.tramSystem.curve,L=curve.getLength(),railSamples=[];
  for(let s=-140;s<=140;s+=.5){const u=((gate.userData.anchor.gateU+s/L)%1+1)%1;const worldPoint=curve.getPointAt(u),up=worldPoint.clone().normalize(),right=new T.Vector3().crossVectors(up,curve.getTangentAt(u)).normalize();railSamples.push({s,position:worldPoint.applyMatrix4(inv).toArray(),up:up.transformDirection(inv).toArray(),right:right.transformDirection(inv).toArray()});}
  const target=seat.getObjectByName('gate-target-blender-v1'),solids=[...(target?.children.filter(o=>o.isMesh&&o.userData.gateSolid)||[]),...(seat.userData.siteRoot?.children.filter(o=>o.isMesh)||[]),...(()=>{const a=[];seat.traverse(o=>{if(o.isMesh&&o.name.startsWith('gate-dressing-'))a.push(o);});return a;})()],railFailures=[];
  let collisionWalk=null;
  if(target){
   const {createGatePlayerGround,createGatePlayerWalls}=await import('/TigerMessenger/src/world/gateTarget.js');
   const {resolveCollisions}=await import('/TigerMessenger/src/world/collision.js');
   const ground=createGatePlayerGround(seat),walls=createGatePlayerWalls(seat),pos=seat.localToWorld(new T.Vector3(-23,-3.76,-36.8)),vel=new T.Vector3(),actor={onGround:true},prev=new T.Vector3(),up=new T.Vector3();let elapsed=0;
   while(elapsed<15&&seat.worldToLocal(pos.clone()).z< -21.8){
    prev.copy(pos);up.copy(pos).normalize();vel.set(0,0,2).transformDirection(seat.matrixWorld).multiplyScalar(2);vel.addScaledVector(up,-vel.dot(up)-.18);
    resolveCollisions(pos,vel,1/60,[],actor,()=>{},null,ground);walls(prev,pos,vel);elapsed+=1/60;
   }
   const local=seat.worldToLocal(pos.clone());collisionWalk={passed:local.z> -22&&local.y>3,seconds:elapsed,endpoint:local.toArray(),scope:'Original collision solver with synthetic velocity, not manual playthrough.'};
  }
  const ray=new T.Raycaster();
  for(let i=1;i<railSamples.length;i++)for(const lateral of [-1.8,0,1.8])for(const height of [.25,1.5,3.2]){
   const envelope=p=>new T.Vector3(...p.position).addScaledVector(new T.Vector3(...p.right),lateral).addScaledVector(new T.Vector3(...p.up),height);const a=envelope(railSamples[i-1]),b=envelope(railSamples[i]);seat.localToWorld(a);seat.localToWorld(b);const d=b.clone().sub(a);ray.far=d.length();ray.set(a,d.normalize());const hit=ray.intersectObjects(solids,false)[0];if(hit)railFailures.push({s:railSamples[i].s,lateral,height,object:hit.object.name});
  }
  const views={};
  if(location.search.includes('gateSiteReview')){const lightPhase=Number(new URLSearchParams(location.search).get('gateLightingPhase')||'.75');t.P.timeOfDay=lightPhase;t.dayNight.update(0);t.lightingDirector.update(0,{timeOfDay:lightPhase,weather:0});seat.userData.gateLighting?.userData.update(lightPhase);t.localLights.update(0);t.lightPool?.update(1);}
  t.renderer.info.reset();t.renderer.render(t.scene,t.camera);views['player-entry']=t.renderer.domElement.toDataURL('image/png');
  for(const [name,eye,look] of [['rear',[-65,42,110],[0,12,0]],['gate-sequence',[3.2,8,-40],[0,17,12]],['bridge-span',[110,80,10],[0,0,0]],['overview',[65,38,-85],[5,17,0]],['front',[15,22,-70],[4,18,0]],['heroes',[-27,5.3,-24],[-25,4.2,-18.5]],['terrace',[-40,14,-46],[-24,3,-21]],['target-angle',[-22,12,-80],[0,16,0]]]){
   t.camera.position.copy(seat.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(seat.matrixWorld);t.camera.lookAt(seat.localToWorld(new T.Vector3(...look)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.distanceCulling?.update(1);t.localLights.update(0);t.lightPool?.update(1);t.renderer.info.reset();t.renderer.render(t.scene,t.camera);views[name]=t.renderer.domElement.toDataURL('image/png');
  }
  return {lighting:{phase:t.P.timeOfDay,bounce:seat.getObjectByName('gate-sunset-bounce')?.intensity,lamps:seat.getObjectByName('gate-meeting-lamp-0')?.intensity},parts,views,seatMatrix:seat.matrixWorld.toArray(),metrics:gate.userData.targetMetrics||gate.userData.metrics,anchor:gate.userData.anchor,railSamples,railFailures,collisionWalk,keys:Object.keys(t),render:t.renderer.info.render};
 });
 for(const [name,data] of Object.entries(result.views))await writeFile(`${dir}/${phase}-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
 delete result.views;result.errors=errors;await writeFile(`${dir}/rail-full-span-check.json`,JSON.stringify({phase,spanMeters:280,raySegments:(result.railSamples.length-1)*9,failures:result.railFailures,passed:result.railFailures.length===0,errors},null,2));await writeFile(`${dir}/${phase}-source.json`,JSON.stringify(result));
 console.log(JSON.stringify({phase,parts:result.parts.length,metrics:result.metrics,render:result.render}));
}finally{await browser.close();}
