// Isolated, nonpersistent production-scene survey. Never writes game saves.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.tramSystem,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,sea=l.citySeaLake,tram=l.tramSystem;
  t.scene.updateMatrixWorld(true);
  function envelope(root){if(!root)return null;root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),box=new T.Box3(),v=new T.Vector3();let vertices=0;
   root.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline)return;const p=o.geometry?.attributes.position;if(!p)return;const m=inv.clone().multiply(o.matrixWorld),matrices=[];if(o.isInstancedMesh){for(let j=0;j<o.count;j++){const im=new T.Matrix4();o.getMatrixAt(j,im);matrices.push(m.clone().multiply(im));}}else matrices.push(m);for(const mat of matrices)for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mat).multiply(root.scale);box.expandByPoint(v);vertices++;}});
   return {name:root.name,scale:root.scale.toArray(),min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(v).toArray(),vertices};}
  const boat=l.canalBoats?.boats?.[0],pod=l.bubblePods?.children?.find(o=>o.userData.kind==='moebius-bubble-pod');
  const {updateWarshipOars}=await import('/TigerMessenger/src/assets/harbor.js');
  const rowingBox=new T.Box3();for(let i=0;boat&&i<120;i++){if(boat.userData.warshipV6){const f=60+i*.5;boat.userData.warshipV6.pose(Math.floor(f),f>=119?60:Math.ceil(f),f%1);boat.userData.warshipV6.render();}else updateWarshipOars(boat,.025,true);const e=envelope(boat);rowingBox.expandByPoint(new T.Vector3(...e.min));rowingBox.expandByPoint(new T.Vector3(...e.max));}
  const rowing=boat?{min:rowingBox.min.toArray(),max:rowingBox.max.toArray(),size:rowingBox.getSize(new T.Vector3()).toArray(),poses:120,method:'All authored rowing frames 60..119 plus half-frame interpolation including wrap',draftAtPatrolWaterline:Math.max(0,-rowingBox.min.y-.12),heightAbovePatrolWaterline:rowingBox.max.y+.12}:null;
  const radii=[];const c=tram.curve,N=4096;
  for(let i=0;i<N;i++){const u=i/N,b=c.getPointAt(u);if(!sea?.containsWorldPos(b))continue;const a=c.getPointAt((i-1+N)%N/N),d=c.getPointAt((i+1)%N/N);const ab=b.clone().sub(a),ac=d.clone().sub(a),cross=ab.clone().cross(ac).length();if(cross>1e-9)radii.push({u,radius:ab.length()*b.distanceTo(d)*ac.length()/(2*cross),point:b.toArray()});}
  radii.sort((a,b)=>a.radius-b.radius);
  const laneRadii=[];for(const [name,curve]of Object.entries(tram.curves))for(const count of [4096,8192]){let min=Infinity,uMin=null;for(let i=0;i<count;i++){const b=curve.getPointAt(i/count);if(!sea.containsWorldPos(b))continue;const a=curve.getPointAt((i-1+count)%count/count),d=curve.getPointAt((i+1)%count/count),ab=b.clone().sub(a),ac=d.clone().sub(a),cross=ab.clone().cross(ac).length();if(cross>1e-9){const r=ab.length()*b.distanceTo(d)*ac.length()/(2*cross);if(r<min){min=r;uMin=i/count;}}}laneRadii.push({name,samples:count,radius:min,u:uMin});}
  const {createStaticMeshRaycast}=await import('/TigerMessenger/src/world/staticMeshRaycast.js');
  const ocean=t.scene.getObjectByName('planet-v8-curved-ocean'),planet=t.scene.getObjectByName('planet-surface');
  // citySeaLake's first child is the authored spherical water disc (see factory).
  // Sample both real surfaces: the official ocean descends into the canyon.
  const lakeMesh=sea.group.children[0];
  if(!lakeMesh?.isMesh||lakeMesh.material?.depthWrite!==false)throw Error('Lake water mesh contract changed');
  const oq=ocean?createStaticMeshRaycast(ocean):null,bq=planet?createStaticMeshRaycast(planet):null,lq=createStaticMeshRaycast(lakeMesh);
  const ray=new T.Raycaster();ray.layers.enableAll();const bridgeMeshes=[];
  tram.group.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&o!==tram.redTram&&o!==tram.blueTram){let p=o,vehicle=false;while(p){if(p===tram.redTram||p===tram.blueTram)vehicle=true;p=p.parent;}if(!vehicle)bridgeMeshes.push(o);}});
  // Temporarily use double-sided ray tests in this isolated survey only.
  const sides=new Map();for(const o of bridgeMeshes)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!sides.has(m)){sides.set(m,m.side);m.side=T.DoubleSide;}
  const samples=[];const sorted=[...radii].sort((a,b)=>a.u-b.u);
  for(let i=0;i<sorted.length;i+=12){const row=sorted[i],d=new T.Vector3(...row.point).normalize();const down=new T.Ray(d.clone().multiplyScalar(250),d.clone().negate());const oh=oq?.firstHit(down,250),lh=lq.firstHit(down,250),bh=bq?.firstHit(down,250);const wh=oh&&lh?(oh.distance<lh.distance?oh:lh):oh||lh;const water=wh?.point.length();
   let overhead=null;if(water){ray.set(d.clone().multiplyScalar(water+.01),d);ray.far=80;const hit=ray.intersectObjects(bridgeMeshes,false)[0];if(hit)overhead={height:hit.point.length()-water,mesh:hit.object.name||hit.object.parent?.name};}
   samples.push({u:row.u,direction:d.toArray(),waterRadius:water??null,waterSource:wh===lh?'lake-disc':'official-ocean',oceanRadius:oh?.point.length()??null,lakeMeshRadius:lh?.point.length()??null,planetBedRadius:bh?.point.length()??null,planetDepth:wh&&bh?water-bh.point.length():null,lakeDatumDifference:water?water-sea.surfaceR:null,overhead,
    mastClearAtCenterline:overhead?overhead.height>=rowing.heightAbovePatrolWaterline+.5:null});
  }
  for(const [m,side] of sides)m.side=side;
  const trace=[];if(boat&&l.canalLakeLink)for(let i=0;i<1200;i++){l.canalBoats.update(.5);const phase=boat.userData.lakeLinkState?.phase;if(phase&&phase!=='canal')trace.push({time:(i+1)*.5,phase,position:boat.position.toArray(),quaternion:boat.quaternion.toArray()});}
  const meshInventory=[];t.scene.traverseVisible(o=>{if(o.isMesh&&/planet|canyon|terrain|lake|ocean/i.test(o.name))meshInventory.push({name:o.name,vertices:o.geometry?.attributes.position?.count});});
  return {units:'game world units (not independently calibrated to real metres)',lake:sea?{center:sea.centerDir.toArray(),surfaceR:sea.surfaceR,angR:sea.angR,shoreAng:sea.shoreAng,visible:sea.group.visible,attached:!!sea.group.parent}:null,
   link:l.canalLakeLink?{ok:l.canalLakeLink.ok,attached:!!l.canalLakeLink.group?.parent}:null,
   vehicles:{tram:envelope(tram.redTram),boat:envelope(boat),pod:envelope(pod),rowingEnvelope:rowing},boatTrace:trace,
   waterAndBridgeSamples:samples,samplingLimit:'Bridge radial centerline rays and planet bed only; not full hull swept collision or piers/banks. Boat route absent in main scene; no successful lake passage claimed.',
   cityTrack:{samples:radii.length,minimumRadius:radii[0]??null,worst:radii.slice(0,8),laneRadii},meshInventory,
   boatState:boat?.userData.lakeLinkState??null};
 });
 report.createdAt=new Date().toISOString();report.errors=errors;
 const output=new URL('../../artifacts/pipeline/moebius-crystal-city-target/transport-survey.json',import.meta.url);
 await writeFile(output,JSON.stringify(report,null,2));
 const wet=report.waterAndBridgeSamples.filter(r=>r.planetDepth>=report.vehicles.rowingEnvelope.draftAtPatrolWaterline+.3);
 console.log(JSON.stringify({output:output.pathname,rowing:report.vehicles.rowingEnvelope,laneRadii:report.cityTrack.laneRadii,samples:report.waterAndBridgeSamples.length,deepEnoughOverPlanet:wet.length,wetBridgeFail:wet.filter(r=>r.mastClearAtCenterline===false),errors}));
}finally{await browser.close();}
