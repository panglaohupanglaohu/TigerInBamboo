import * as THREE from 'three';
import {createBatianSwampTreatment} from './batianSwampTreatment.js';

// Medical assignments outlive a fleet sortie. The same carrier and original
// soldiers remain reserved until the swamp visit and return flight finish.
export function createBatianCasualtyTransport({scene,radius=160}){
 const clinic=createBatianSwampTreatment();
 const jobs=[],stats={rescued:0,healed:0,returned:0};
 let treatmentTime=0;
 const world=o=>o.getWorldPosition(new THREE.Vector3());
 function medic(){let found=null;scene.traverse(o=>{if(o.userData.heiwaMedic)found=o;});return found;}
 function add(host,records){
  const patients=records.filter(r=>r.tr.userData.dead||r.tr.userData.downed);if(!patients.length||jobs.some(j=>j.host===host))return;
  for(const r of patients){r.tr.visible=false;r.tr.userData.batianMedical='transport';r.tr.userData.aboard=true;r.tr.userData.onGround=false;delete r.tr.userData.bookshopReceiveHit;}
  const job={host,patients,home:world(host),homeQ:host.getWorldQuaternion(new THREE.Quaternion()),stage:'transport',age:0,current:0,wasVisible:host.visible};
  jobs.push(job);host.userData.batianMedical=true;host.visible=true;stats.rescued+=patients.length;
 }
 function fly(job,target,dt){
  const host=job.host,from=world(host),a=from.clone().normalize(),b=target.clone().normalize(),angle=a.angleTo(b);
  const step=Math.min(1,dt*15/Math.max(.001,angle*Math.max(from.length(),target.length())));
  const axis=new THREE.Vector3().crossVectors(a,b);let next=a.clone();if(axis.lengthSq()>1e-12)next.applyAxisAngle(axis.normalize(),angle*step);else next.lerp(b,step).normalize();
  const altitude=THREE.MathUtils.clamp(target.length()-from.length(),-dt*5,dt*5);next.multiplyScalar(from.length()+altitude);
  host.position.copy(host.parent.worldToLocal(next.clone()));
  const up=next.clone().normalize(),f=target.clone().sub(next).addScaledVector(up,-target.clone().sub(next).dot(up));
  if(f.lengthSq()>1e-6){f.normalize();const right=new THREE.Vector3().crossVectors(up,f).normalize(),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,f));host.quaternion.slerp(host.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q),Math.min(1,dt));}
  host.updateWorldMatrix(true,true);return next.distanceTo(target)<1.5;
 }
 function update(dt){
  treatmentTime+=Math.max(0,dt);
  const healer=medic(),focused=jobs.find(j=>j.stage==='treatment');if(healer){healer.userData.healingPatients=jobs.filter(j=>j.stage==='treatment').reduce((n,j)=>n+j.patients.length-j.current,0);if(!focused){delete healer.userData.healingTargetLocal;delete healer.userData.healingOwned;}}
  for(let i=jobs.length-1;i>=0;i--){const j=jobs[i];j.host.visible=true;
   if(j.stage==='transport'){
    if(!healer)continue;const p=healer.userData.heiwaTreatmentPoint?healer.parent.localToWorld(new THREE.Vector3().fromArray(healer.userData.heiwaTreatmentPoint)):world(healer);p.setLength(Math.max(radius+25,p.length()+10));
    // Separate hovering berths for the three existing carriers.
    p.add(new THREE.Vector3((i-1)*9,0,0).applyQuaternion(healer.getWorldQuaternion(new THREE.Quaternion())));
    if(fly(j,p,dt)){j.stage='treatment';j.age=0;j.patients.forEach(r=>r.tr.userData.batianMedical='treatment');}
   }else if(j.stage==='treatment'){
    if(!healer)continue;j.focused=j===focused;const record=j.patients[j.current];clinic.show(j,healer,record,Math.min(1,j.age/24));
    const target=healer.userData.healingTargetLocal;
    // Medical ownership is independent of the ambient swim update and its order.
    // Move the original child, never a duplicate or an invisible healing timer.
    if(j.focused&&target){
     healer.userData.healingOwned=true;healer.visible=true;
     const destination=new THREE.Vector3().fromArray(target),delta=destination.sub(healer.position),distance=delta.length();
     if(distance>0)healer.position.addScaledVector(delta,Math.min(1,Math.max(0,dt)*2.4/distance));
     healer.rotation.set(0,Math.PI,0);healer.userData.swimPhase='healing';
     for(const limb of healer.userData.coralSwimLimbs||[]){limb.node.rotation.x=limb.arm?-.75+Math.sin(treatmentTime*3)*.08:0;limb.node.rotation.z=limb.arm?limb.side*-.9:0;}
     healer.updateWorldMatrix(true,true);
    }
    const close=target&&healer.position.distanceTo(new THREE.Vector3().fromArray(target))<.35;
    if(j.focused&&close)j.age+=dt;if(j.age<24)continue;
    const u=record.tr.userData;u.dead=false;u.downed=false;u.bookshopDowned=false;u.bookshopHealth=90;u.life=record.saved.life??2;u.arrowHits=0;u.javelinHits=0;u.meleeHits=0;u.batianMedical='return';stats.healed++;j.current++;j.age=0;
    if(j.current===j.patients.length){clinic.hide(j);j.stage='return';}
   }else if(fly(j,j.home,dt)){
    for(const r of j.patients){r.tr.position.copy(r.saved.position);r.tr.quaternion.copy(r.saved.quaternion);r.tr.visible=false;r.tr.userData.aboard=true;delete r.tr.userData.batianMedical;stats.returned++;}
    delete j.host.userData.batianMedical;j.host.visible=j.wasVisible;j.host.quaternion.copy(j.host.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(j.homeQ));jobs.splice(i,1);
   }
  }
 }
 return{add,update,owns:host=>jobs.some(j=>j.host===host),snapshot:()=>({...stats,medic:(()=>{const h=medic();return h?{id:h.uuid,visible:h.visible,owned:!!h.userData.healingOwned,phase:h.userData.swimPhase,position:h.position.toArray(),target:h.userData.healingTargetLocal||null,visibleMeshes:(()=>{let n=0;h.traverse(o=>{if(o.isMesh&&o.visible)n++;});return n;})()}:null;})(),patients:jobs.reduce((n,j)=>n+j.patients.length,0),carriers:jobs.map(j=>({id:j.host.uuid,stage:j.stage,patients:j.patients.length,treatment:j.age,completed:j.current}))}),dispose(){const healer=medic();if(healer)healer.userData.healingPatients=0;for(const j of jobs){delete j.host.userData.batianMedical;for(const r of j.patients){delete r.tr.userData.batianMedical;r.tr.visible=false;}}jobs.length=0;clinic.dispose();if(healer){delete healer.userData.healingTargetLocal;delete healer.userData.healingOwned;}}};
}
