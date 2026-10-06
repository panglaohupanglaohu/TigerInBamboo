import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const round=process.argv[2]||'0',out=new URL('../../artifacts/pipeline/citadel-mountain-two-hour/',import.meta.url).pathname;
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']}),p=await b.newPage({viewport:{width:1200,height:800}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMountain='+round);
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});await p.waitForTimeout(7000);
const report=await p.evaluate(async()=>{
 const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
 const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),sys=t.messenger.landmarks.tramSystem;
 c.updateWorldMatrix(true,true);const meshes=[],walk=[];c.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position&&!o.userData.isOutline){
  if(/^citadel-oskar-grid-mountain-surface|^highland-ravine-wall|^citadel-backdrop-ridge|^new-city-rock-shoulder|^citadel-coastal-cliff-seal|^citadel-study-rock-crags|^old-shore-blender-rock-support|^citadel-study-cypress|^citadel-study-understory/.test(o.name))meshes.push(o);
  if(o.userData.westCityWalkable)walk.push(o);
 }});
 const boxes=meshes.map(o=>({o,box:new T.Box3().setFromObject(o)})),ray=new T.Raycaster();ray.layers.enableAll();ray.far=2;
 const inv=c.matrixWorld.clone().invert(),hits=[];let tests=0,minSeaClearance=Infinity,wetTrackSamples=0;
 for(const [lane,curve]of Object.entries(sys.curves))for(let i=0;i<3600;i++){
  const q=curve.getPointAt(i/3600),local=q.clone().applyMatrix4(inv);if(local.x< -180||local.x>180||local.z< -100||local.z>180||local.y< -75)continue;
  if(local.y< -28&&Math.abs(local.x)<160&&Math.abs(local.z+5)<90){const clearance=q.length()-160-officialOceanLevelAt(q);minSeaClearance=Math.min(minSeaClearance,clearance);if(clearance<.35)wetTrackSamples++;}
  const up=q.clone().normalize(),f=curve.getTangentAt(i/3600).normalize(),side=new T.Vector3().crossVectors(up,f).normalize(),near=boxes.filter(m=>m.box.distanceToPoint(q)<15).map(m=>m.o);
  for(const lateral of[-2.6,0,2.6])for(const height of[.5,3,10]){
   ray.set(q.clone().addScaledVector(up,height).addScaledVector(side,lateral).addScaledVector(f,-1),f);tests++;
   const h=ray.intersectObjects(near,false);if(h.length)hits.push({lane,i,height,lateral,name:h[0].object.name,distance:h[0].distance});
  }
 }
 // Hash every existing walkable mesh in world space: ground/stairs must not
 // move when applying rock finishes and decorative fractured buttresses.
 let hash=2166136261,vertices=0;for(const o of walk){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);for(const n of v.toArray()){hash=Math.imul(hash^Math.round(n*1e4),16777619)>>>0;}vertices++;}}
 return {round:c.userData.mountainStudy?.round??0,tests,hits,minSeaClearance,wetTrackSamples,walk:{meshes:walk.length,vertices,hash},rocks:meshes.length};
});writeFileSync(out+'clearance-r'+round+'.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({tests:report.tests,totalHits:report.hits.length,minSeaClearance:report.minSeaClearance,wetTrackSamples:report.wetTrackSamples,hits:report.hits.slice(0,8),walk:report.walk,errors}));await b.close();
