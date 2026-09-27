// Citadel coastal tram iteration: renders target-matched views and measures the
// candidate rail against real terrain/sea and visible scene geometry.
// Usage: node citadel_tram_iter.mjs <label> [--survey]
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'probe';
const survey=process.argv.includes('--survey');
const useDefault=process.argv.includes('--default');
const clean=process.argv.includes('--clean');
const out='TigerMessenger/artifacts/pipeline/citadel-tram-iterations/';
await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(useDefault?'':'&citadelCoastalTram=1'),{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city')&&window.__tm?.messenger?.landmarks?.tramSystem,null,{timeout:240000});
 await p.waitForTimeout(1500);
 const report=await p.evaluate((survey)=>{
  const t=window.__tm,T=t.THREE;let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.42;t.scene.updateMatrixWorld(true);
  const R=160,sys=t.messenger.landmarks.tramSystem,up0=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld);
  const L=v=>castle.localToWorld(new T.Vector3(...v));
  // Solid scene for height probes (skip rail, ocean, weather, clouds, outlines).
  const solids=[],water=[];
  t.scene.traverse(o=>{if(!o.isMesh||o.userData.isOutline||o.userData.backlitHighlight)return;let a=o;while(a){if(a===sys.group||/cloud|^sky|^snow|^rain|bird/i.test(a.name))return;a=a.parent;}
   const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>m.visible===false))return;
   let w=false;a=o;while(a){if(/ocean|water|sea/i.test(a.name))w=true;a=a.parent;} (w?water:solids).push(o);});
  const ray=new T.Raycaster();ray.layers.enableAll();
  const probe=(w)=>{const up=w.clone().normalize();ray.set(up.clone().multiplyScalar(R+140),up.clone().negate());ray.near=0;ray.far=200;
   const h=ray.intersectObjects(solids,false)[0];return h?{alt:h.point.length()-R,name:h.object.name}:null;};
  const res={errors:[]};
  if(survey){
   const grid=[];for(let x=-200;x<=200;x+=10)for(let z=-200;z<=200;z+=10){const w=L([x,0,z]);const g=probe(w);grid.push([x,z,g?Math.round(g.alt*10)/10:null]);}
   res.grid=grid;
   const named=[];t.scene.traverse(o=>{if(/^(highland-west-city|old-harbor-scene|west-city-plaza-deck|citadel-front-harbor|citadel-new-city-backdrop-range)$/.test(o.name)||/statue|berth|footbridge|walkway-bridge|pier|dock/i.test(o.name)){const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const c=castle.worldToLocal(box.getCenter(new T.Vector3()));named.push({name:o.name,local:c.toArray().map(v=>Math.round(v*10)/10),size:Math.round(box.getSize(new T.Vector3()).length())});}});
   res.named=named.slice(0,80);
  }
  // Rail samples in castle-local frame with ground clearance.
  const curve=sys.curve,N=900,rail=[];
  for(let i=0;i<=N;i++){const w=curve.getPointAt(i/N),l=castle.worldToLocal(w.clone());if(Math.hypot(l.x,l.z)>230||l.y<-45)continue;const g=probe(w);rail.push({t:i/N,local:l.toArray().map(v=>Math.round(v*10)/10),alt:Math.round((w.length()-R)*100)/100,ground:g?Math.round(g.alt*100)/100:null,over:g?.name||null});}
  res.rail=rail;
  res.minDeckAboveGround=Math.min(...rail.filter(r=>r.ground!==null).map(r=>r.alt-r.ground));
  // Swept tram-volume rays (both lanes) inside the citadel window.
  const hits=[];
  for(const [lane,cv] of Object.entries(sys.curves||{c:curve})){const LL=cv.getLength(),NN=Math.ceil(LL/1.2);
   for(let i=1;i<NN;i++){const p0=cv.getPointAt(i/NN),l=castle.worldToLocal(p0.clone());if(l.y<-45||l.x<-140||l.x>100||l.z<20||l.z>135)continue;
    const up=p0.clone().normalize(),dir=cv.getPointAt((i+1)/NN).sub(cv.getPointAt((i-1)/NN)).normalize(),right=new T.Vector3().crossVectors(up,dir).normalize();
    for(const side of [-.75,0,.75])for(const h of [.4,1.5,2.8,3.6]){const st=p0.clone().addScaledVector(right,side).addScaledVector(up,h).addScaledVector(dir,-1.3);ray.set(st,dir);ray.near=0;ray.far=2.6;const hh=ray.intersectObjects(solids,false)[0];if(hh){hits.push({lane,local:l.toArray().map(v=>Math.round(v*10)/10),h,side,obj:hh.object.name,parent:hh.object.parent?.name});break;}}
   }}
  res.sweepHits=hits.slice(0,60);res.sweepHitCount=hits.length;
  res.buried=rail.filter(r=>r.ground!==null&&r.alt-r.ground<.4).map(r=>({t:r.t,local:r.local,alt:r.alt,ground:r.ground,over:r.over})).slice(0,30);
  // Views: top-down plan and target-like oblique from the harbour.
  const cams={
   plan:{pos:[0,330,40],look:[0,0,40],fov:55},
   target:{pos:[-20,70,215],look:[-5,5,40],fov:52},
   stationNew:{pos:[30,32,150],look:[18,6,100],fov:45},
   stationOld:{pos:[-44,6,52],look:[-27,6,30],fov:60},
   portalEast:{pos:[112,22,92],look:[78,5,50],fov:55},
   portalWest:{pos:[-30,26,78],look:[-8,4,32],fov:58},
  };
  res.cams=cams;
  window.__camsSet=(k)=>{const c=cams[k];t.camera.position.copy(L(c.pos));t.camera.up.copy(k==='plan'?new T.Vector3(0,0,-1).transformDirection(castle.matrixWorld):up0);t.camera.lookAt(L(c.look));t.camera.fov=c.fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling?.update(3);};
  window.__project=(v)=>{const s=L(v).project(t.camera);return [(s.x+1)/2*innerWidth,(1-s.y)/2*innerHeight,s.z];};
  return res;
 },survey);
 const shoot=async(k,marks)=>{
  await p.evaluate(k=>window.__camsSet(k),k);await p.waitForTimeout(900);
  const overlay=await p.evaluate(({marks})=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);
   const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;const g=c.getContext('2d');g.drawImage(t.renderer.domElement,0,0,c.width,c.height);
   g.font='bold 15px sans-serif';g.lineWidth=3;
   for(const m of marks){const [x,y,z]=window.__project(m.p);if(z>1)continue;g.fillStyle=m.c||'#ff0';g.strokeStyle='#000';g.beginPath();g.arc(x,y,m.r||4,0,7);g.fill();if(m.t){g.strokeText(m.t,x+6,y-6);g.fillText(m.t,x+6,y-6);}}
   return c.toDataURL('image/png');},{marks});
  await writeFile(`${out}${label}-${k}.png`,Buffer.from(overlay.split(',')[1],'base64'));
 };
 const marks=[];
 if(survey){for(let x=-200;x<=200;x+=40)for(let z=-200;z<=200;z+=40)marks.push({p:[x,0,z],t:`${x},${z}`,c:'#fff',r:2});}
 for(const [i,r] of report.rail.entries())if(i%6===0)marks.push({p:r.local,c:r.ground!==null&&r.alt-r.ground<.4?'#f33':'#3cf',r:3});
 marks.push({p:[-60,-8,52],t:'old-harbor',c:'#fa0'},{p:[13.6,3.9,77.6],t:'plaza-deck',c:'#fa0'},{p:[-22.2,5,5.9],t:'foot-bridge A',c:'#f0f'},{p:[6.3,5,45.7],t:'foot-bridge B',c:'#f0f'});
 await shoot('plan',clean?[]:marks);
 await shoot('target',survey||clean?[]:marks.filter(m=>m.t));
 if(process.argv.includes('--stations')){await shoot('stationNew',[]);await shoot('stationOld',[]);await shoot('portalEast',[]);await shoot('portalWest',[]);}
 report.errors=errors;
 await writeFile(`${out}${label}.json`,JSON.stringify(report,null,1));
 console.log(JSON.stringify({label,railSamples:report.rail.length,minDeckAboveGround:report.minDeckAboveGround,buried:report.buried.length,sweepHits:report.sweepHitCount,named:report.named?.length,errors}));
}finally{await b.close();}
