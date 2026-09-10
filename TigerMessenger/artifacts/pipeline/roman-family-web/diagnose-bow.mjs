// Bounded same-actor geometry diagnostic; never substitutes for full body acceptance.
import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),base='http://127.0.0.1:8765/TigerMessenger';
const output=path.join(here,'bow-contact-'+new Date().toISOString().replaceAll(':','-'));await mkdir(output);
const sourcePath=path.resolve(here,'../../../src/assets/romanSoldierEquipment.js');
const hash=async()=>createHash('sha256').update(await readFile(sourcePath)).digest('hex');const sourceBefore=await hash();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let report;
try{
 const page=await browser.newPage();await page.route('**/bow-diagnostic.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));await page.goto(base+'/bow-diagnostic.html');
 report=await page.evaluate(async base=>{
  const T=await import('three'),H=await import(base+'/src/assets/harbor.js'),{bindRomanSoldierEquipment:bind}=await import(base+'/src/assets/romanSoldierEquipment.js');
  const scene=new T.Scene();scene.background=new T.Color('#d5dfd5');scene.add(new T.HemisphereLight(0xffffff,0x536950,2.2));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(3,4,2);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,800);const camera=new T.PerspectiveCamera(33,900/800,.01,40);camera.position.set(2.8,1.55,2.7);camera.lookAt(0,.52,0);
  const actor=H.createLongbowSoldier({rand:()=>.5});H.paintSoldierHelm(actor,'red');scene.add(actor);const controller=bind(actor);
  const eq=actor.userData.equipment,crests=['soldier-crest','soldier-crest-feathers','soldier-crest-stems'].map(n=>actor.getObjectByName(n));
  function meshes(root){const a=[];function visit(n){if(!n.visible||n.userData.isOutline)return;if(n.isMesh)a.push(n);n.children.forEach(visit);}visit(root);return a;}
  function triangles(mesh){const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,n=idx?idx.count:p.count,result=[];for(let i=0;i<n;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));const t=new T.Triangle(...v);result.push({t,box:new T.Box3().setFromPoints(v),localMaxY:Math.max(...[0,1,2].map(k=>p.getY(idx?idx.getX(i+k):i+k)))});}return result;}
  function edgesHit(a,b){const plane=b.getPlane(new T.Plane()),v=[a.a,a.b,a.c];for(let i=0;i<3;i++){const start=v[i],end=v[(i+1)%3],d0=plane.distanceToPoint(start),d1=plane.distanceToPoint(end);if(d0*d1>=0||Math.abs(d0-d1)<1e-10)continue;const hit=start.clone().lerp(end,d0/(d0-d1));if(b.containsPoint(hit))return hit.toArray();}return null;}
  function contacts(){actor.updateMatrixWorld(true);const weapons=[...meshes(eq.bow),...meshes(eq.nockedArrow)],heads=[...crests.flatMap(meshes),...meshes(actor.getObjectByName('soldier-helm')),...meshes(actor.userData.parts.body.children[1]),...meshes(controller.armor)];const result=[];for(const weapon of weapons){const wa=triangles(weapon);for(const head of heads){const ha=triangles(head);let count=0,point;const regions=new Set();for(const a of wa)for(const b of ha){if(!a.box.intersectsBox(b.box))continue;const hit=edgesHit(a.t,b.t)||edgesHit(b.t,a.t);if(hit){count++;point??=hit;regions.add(head.name.includes('crest')||head.name==='soldier-helm'||(head.name.startsWith('Helmet_Galea')&&b.localMaxY>.1)?'headwear':'lowerArmor');}}if(count)result.push({weapon:weapon.name||weapon.parent.name,weaponUuid:weapon.uuid,head:head.name,count,point,regions:[...regions]});}}return result;}
  function separation(){actor.updateMatrixWorld(true);const inverse=actor.matrixWorld.clone().invert();function range(roots){let min=Infinity,max=-Infinity;for(const root of roots)for(const mesh of meshes(root)){const transform=inverse.clone().multiply(mesh.matrixWorld),p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const z=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform).z;min=Math.min(min,z);max=Math.max(max,z);}}return {min,max};}const weapon=range([eq.bow,eq.nockedArrow]),armor=range([...crests,actor.getObjectByName('soldier-helm'),actor.userData.parts.body.children[1],controller.armor]);return {weaponMinZ:weapon.min,armorMaxZ:armor.max,gap:weapon.min-armor.max};}
  const samples=[],captures={};
  for(let frame=0;frame<180;frame++){
   H.updateLongbowShot(actor,1/60,()=>.5);controller.update();const cycle=actor.userData.bowCycle;
   const sample={frame,phase:cycle.phase,t:cycle.t,draw:cycle.draw};
   for(const active of [false,true]){controller.setEnabled(active);sample[active?'candidate':'original']=contacts();sample[active?'candidateLateralSeparation':'originalLateralSeparation']=separation();if(cycle.phase==='hold'&&!captures[active?'hold-candidate':'hold-original']){renderer.render(scene,camera);captures[active?'hold-candidate':'hold-original']=renderer.domElement.toDataURL('image/png');}}
   samples.push(sample);
  }
  renderer.dispose();controller.dispose();return {samples,captures,scope:'Same actor, same actual shot state, only equipment toggle. Triangle-edge/face crossing of visible non-outline bow/arrow against crest, helmet and approved armor; coplanar/containment not tested.'};
 },base);
}finally{await browser.close();}
for(const [name,url]of Object.entries(report.captures))await writeFile(path.join(output,name+'.png'),Buffer.from(url.split(',')[1],'base64'));delete report.captures;
report.adapterSha256=sourceBefore;report.sourceSnapshotStillCurrent=sourceBefore===await hash();
report.headwearRegressionPassed=report.samples.every(s=>s.candidate.every(c=>!c.regions.includes('headwear')))&&report.sourceSnapshotStillCurrent;
report.candidateCrossingFrames=report.samples.filter(s=>s.candidate.length).length;
report.originalCrossingFrames=report.samples.filter(s=>s.original.length).length;
report.fullArmorContactPassed=report.candidateCrossingFrames===0&&report.sourceSnapshotStillCurrent;
// Distinct acceptance flags: there is deliberately no overall pass declaration.
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,frames:report.samples.length,originalCrossingFrames:report.samples.filter(s=>s.original.length).length,candidateCrossingFrames:report.samples.filter(s=>s.candidate.length).length,firstCandidateCrossing:report.samples.find(s=>s.candidate.length)},null,2));
