import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-front-port-crew/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage();
 await p.route('**/port-deck-fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js"}}</script>'}));
 await p.goto('http://localhost:8931/port-deck-fixture');
 const result=await p.evaluate(async()=>{
  const T=await import('three'),H=await import('/TigerMessenger/src/assets/harbor.js');
  const {bindRomanSoldierEquipment}=await import('/TigerMessenger/src/assets/romanSoldierEquipment.js'),{bindRomanShipCarryPose}=await import('/TigerMessenger/src/world/romanShipCarryPose.js'),{createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const boat=H.createFisherBoat();boat.scale.setScalar(1.84);boat.userData.warshipV6.setBoarding(1);boat.userData.warshipV6.update(0,0);boat.updateMatrixWorld(true);
  const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
  const meshes=[];boat.traverse(o=>{if(!o.isMesh||!visible(o))return;if(!o.name)o.name='boat-material-'+o.material?.name;o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();meshes.push({mesh:o,box:(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld)});});
  const box=new T.Box3();meshes.forEach(o=>box.union(o.box));const obstacles=[{box,meshes}],rows=[];
  for(const role of ['gladius','spear','longbow']){
   const actor=role==='gladius'?H.createGladiusSoldier():role==='spear'?H.createHarborPatrolSoldier():H.createLongbowSoldier({rand:()=>.5});bindRomanSoldierEquipment(actor);const carry=bindRomanShipCarryPose(actor);carry.setEnabled(true);carry.update();actor.updateMatrixWorld(true);
   let feet=Infinity;for(const leg of [actor.userData.parts.legL,actor.userData.parts.legR])feet=Math.min(feet,new T.Box3().setFromObject(leg).min.y);
   // Upper-body and equipment clearance is independent of deliberate sole/deck contact.
   // Record that scope explicitly; full footfalls are the next check.
   const legs=[actor.userData.parts.legL,actor.userData.parts.legR],saved=legs.map(l=>l.visible);legs.forEach(l=>l.visible=false);
   const guard=createWarshipClearance(actor,obstacles);legs.forEach((l,i)=>l.visible=saved[i]);
   const checks=[];
   for(const z of [-.29,.29])for(let i=0;i<=32;i++){
    const x=-1.5+i*.1;const position=new T.Vector3(x*1.84,.663*1.84-feet+.005,z*1.84);
    const hit=guard.clear(position,new T.Quaternion(),actor.scale);checks.push({x,z,...hit});
   }
   rows.push({role,triangles:guard.triangleCount,checks,failures:checks.filter(c=>!c.clear),gripErrors:carry.gripErrors()});
  }
  return {source:boat.userData.warshipV6.source,boatScale:1.84,rows,scope:'Three actual public-factory soldiers with approved equipment and ship carry pose; straight +X deck corridors only, legs excluded from upper-body clearance. Seated crew remains aboard. Not stand-up, turn, footfall, take-weapon or disembark certification.'};
 });await writeFile(new URL('report.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result.rows.map(r=>({role:r.role,checks:r.checks.length,failures:r.failures.length,first:r.failures.slice(0,3)})),null,2));
}finally{await browser.close();}
