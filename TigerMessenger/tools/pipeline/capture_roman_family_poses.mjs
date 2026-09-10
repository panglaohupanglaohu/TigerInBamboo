// Source capture only: actual factories and updateLongbowShot, no new equipment adapter.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.ROMAN_TEST_BASE_URL||'http://127.0.0.1:8765/TigerMessenger';
const output=path.join(root,'artifacts/pipeline/roman-family-blender-validation');await mkdir(output,{recursive:true});
const sourcePath='src/assets/harbor.js',sha=async()=>createHash('sha256').update(await readFile(path.join(root,sourcePath))).digest('hex'),before=await sha();
const browser=await chromium.launch({channel:'chrome',headless:true});let report;
try{
 const page=await browser.newPage();await page.route('**/roman-pose-source.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));await page.goto(base+'/roman-pose-source.html');
 report=await page.evaluate(async base=>{
  const T=await import('three'),H=await import(base+'/src/assets/harbor.js');
  const records=[],bowSamples=[];
  const point=(node,p)=>node.localToWorld(new T.Vector3(...p)).toArray();
  const material=m=>({type:m.type,color:m.color?.toArray(),side:m.side,opacity:m.opacity,transparent:m.transparent});
  for(const role of ['spear','gladius','longbow'])for(const side of ['red','blue']){
   const actor=role==='spear'?H.createHarborPatrolSoldier():role==='gladius'?H.createGladiusSoldier():H.createLongbowSoldier({rand:()=>.5});H.paintSoldierHelm(actor,side);actor.updateMatrixWorld(true);
   const nodes=[];actor.traverse(n=>nodes.push(n));const ids=new Map(nodes.map((n,i)=>[n,'n'+i]));
   const refs=group=>Object.fromEntries(Object.entries(group).filter(([,v])=>v?.isObject3D).map(([k,v])=>[k,ids.get(v)]));
   const parts=refs(actor.userData.parts),equipment=refs(actor.userData.equipment);
   const contracts={handLocal:[0,-.138,0],swordGripLocal:[0,.04,0],shieldHandleLocal:[-.055,0,0],spearGripLocal:[0,0,0],spearGripStatus:'reference shaft origin only; source does not constrain hand contact',bowGripLocal:[0,0,0],bowStringEndpointsLocal:[[0,-.11,0],[0,.11,0]],arrowNockLocal:[-.17,0,0],bowTipLength:.235,frontAxis:'+X',upAxis:'+Y',figureScale:actor.children[0].scale.toArray()};
   function contacts(){actor.updateMatrixWorld(true);const p=actor.userData.parts,e=actor.userData.equipment;return {handL:point(p.armL,contracts.handLocal),handR:point(p.armR,contracts.handLocal),...(e.shield?{shieldHandle:point(e.shield,contracts.shieldHandleLocal)}:{}),...(e.gladius?{swordGrip:point(e.gladius,contracts.swordGripLocal)}:{}),...(e.spear?{spearShaftOrigin:point(e.spear,[0,0,0])}:{}),...(e.bow?{bowGrip:point(e.bow,[0,0,0]),bowTipTop:point(e.limbTop,[0,.235,0]),bowTipBottom:point(e.limbBot,[0,-.235,0]),stringTopEnds:contracts.bowStringEndpointsLocal.map(p=>point(e.stringTop,p)),stringBottomEnds:contracts.bowStringEndpointsLocal.map(p=>point(e.stringBot,p)),arrowNock:point(e.nockedArrow,contracts.arrowNockLocal),arrowVisible:e.nockedArrow.visible}:{} )};}
   records.push({assetId:`romanSoldier_${role}_${side}`,role,side,parts,equipment,contracts,restContacts:contacts(),nodes:nodes.map(n=>({id:ids.get(n),parentId:ids.get(n.parent)||null,name:n.name,type:n.type,visible:n.visible,isOutline:!!n.userData.isOutline,matrix:n.matrix.toArray(),actorMatrix:n.matrixWorld.toArray(),...(n.isMesh?{materials:(Array.isArray(n.material)?n.material:[n.material]).map(material),geometryVertexCount:n.geometry.attributes.position.count,geometryIndexCount:n.geometry.index?.count||0}:{} )}))});
   if(role==='longbow'&&side==='red'){
    const dynamic=new Set([...Object.values(parts),...Object.values(equipment)]);
    for(let frame=0;frame<480;frame++){
     const phaseBefore=actor.userData.bowCycle.phase,released=H.updateLongbowShot(actor,1/120,()=>.5);actor.updateMatrixWorld(true);
     bowSamples.push({frame,seconds:(frame+1)/120,phaseBefore,...actor.userData.bowCycle,phaseTime:actor.userData.bowCycle.t,released,contacts:contacts(),transforms:nodes.filter(n=>dynamic.has(ids.get(n))).map(n=>({id:ids.get(n),matrix:n.matrix.toArray(),actorMatrix:n.matrixWorld.toArray(),visible:n.visible}))});
    }
   }
  }
  return {version:1,coordinateConvention:{handedness:'right',up:'+Y',front:'+X',matrixStorage:'column-major 4x4',matrixMeaning:'matrix=node-local; actorMatrix=actor-root world with identity root',units:'original Web actor units; figure has source scale, do not normalize twice',blenderConversion:'C: (x,y,z)->(x,-z,y). Blender local matrix = C * M * inverse(C). Export glTF Y-up reverses C.'},sourceFactories:['createHarborPatrolSoldier','createGladiusSoldier','createLongbowSoldier'],sampling:{random:.5,hz:120,frames:480,adapterApplied:false},variants:records,longbowSamples:bowSamples,phaseCoverage:[...new Set(bowSamples.map(s=>s.phase))],releases:bowSamples.filter(s=>s.released).length};
 },base);
}finally{await browser.close();}
report.source={path:sourcePath,sha256:before};report.sourceSnapshotStillCurrent=before===await sha();report.passed=report.sourceSnapshotStillCurrent&&report.phaseCoverage.length===7&&report.releases>=2&&report.variants.length===6;
report.concepts=Object.fromEntries(await Promise.all(['roman-soldier-target-v2.png','roman-spearman-target-v1.png','roman-archer-target-v1.png'].map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,'assets/concepts',name))).digest('hex')])));
await writeFile(path.join(output,'source-poses.json'),JSON.stringify(report)+'\n');console.log(JSON.stringify({passed:report.passed,path:path.join(output,'source-poses.json'),variants:report.variants.map(v=>({id:v.assetId,nodes:v.nodes.length,parts:v.parts,equipment:v.equipment})),phases:report.phaseCoverage,releases:report.releases},null,2));if(!report.passed)process.exitCode=1;
