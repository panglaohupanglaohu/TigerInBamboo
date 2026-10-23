import * as THREE from 'three';

// Existing plaza engine and two wagons. Patients retain identity throughout
// collection, transport, treatment and their walk back to the plaza.
export function createBookshopMedicalTrain({base,actors,routeWorld,chart,seatActor}) {
 let stage='idle',path=[],patients=[],timer=0,returnPath=[],lastTangent=new THREE.Vector3(0,0,1);
 let savedCargo=[],homePoint=null;const stats={collected:0,delivered:0,recovered:0,trips:0};
 const position=o=>o.getWorldPosition(new THREE.Vector3());
 const scene=()=>{let o=base;while(o.parent)o=o.parent;return o;};
 function destination(){
  const ramp=base.userData.bookshopMedicalRoute;
  if(ramp?.length)return ramp.map(p=>p.clone());
  const shop=scene().getObjectByName('hard-to-find-bookshop');
  return shop?[shop.localToWorld(new THREE.Vector3(0,.12,3.1))]:null;
 }
 function pose(train,p,toward){
  const up=p.clone().normalize(),f=toward.clone().sub(p).addScaledVector(up,-toward.clone().sub(p).dot(up));
  if(f.lengthSq()>.00001)lastTangent.copy(f.normalize());else f.copy(lastTangent);
  const right=new THREE.Vector3().crossVectors(up,f).normalize(),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,f));
  train.position.copy(train.parent.worldToLocal(p.clone()));train.quaternion.copy(train.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));train.updateWorldMatrix(true,true);
 }
 function move(train,dt){
  let distance=dt*2.4;
  while(path.length&&distance>0){const from=position(train),v=path[0].clone().sub(from),d=v.length();
   if(d<=distance){pose(train,path[0],path[1]||path[0].clone().add(lastTangent));path.shift();distance-=d;}
   else{pose(train,from.addScaledVector(v.normalize(),distance),path[0]);distance=0;}}
  return !path.length;
 }
 function carried(train){for(const [i,a]of patients.entries()){
  const p=train.localToWorld(new THREE.Vector3(0,.72,-2.3-i*2));a.m.position.copy(a.m.parent.worldToLocal(p));
  a.m.quaternion.copy(a.m.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(train.getWorldQuaternion(new THREE.Quaternion())));a.m.rotateZ(Math.PI/2);a.m.visible=true;
 }}
 function release(train){const q=chart(position(train));train.userData.plazaAngle=Math.atan2(q.x,q.z-32);train.userData.medicalOwned=false;savedCargo.forEach(([o,v])=>o.visible=v);savedCargo=[];patients=[];stage='idle';}
 function update(dt){
  const train=base.userData.plazaRescueTrain;if(!train)return;dt=Math.min(dt,.2);
  // Injured actors are excluded from pedestrian and combat controllers until healed.
  if(stage==='idle'){
   const dest=destination();if(!dest)return;
   const wounded=actors.filter(a=>a.m.userData.bookshopDowned&&!a.m.userData.bookshopMedical);
   wounded.sort((a,b)=>position(a.m).distanceToSquared(position(train))-position(b.m).distanceToSquared(position(train)));
   if(!wounded.length)return;const target=position(wounded[0].m);path=routeWorld(position(train),target);if(!path.length&&position(train).distanceTo(target)>3)return;
   patients=[wounded[0]];patients.forEach(a=>{a.m.userData.bookshopMedical='awaiting-pickup';a.path=[];if(a.gun)a.gun.visible=false;if(a.gunArm)a.gunArm.rotation.x=0;delete a.m.userData.bookshopDefending;});
   homePoint=position(train);train.userData.medicalOwned=true;savedCargo=(train.userData.freightCrates||[]).map(o=>[o,o.visible]);savedCargo.forEach(([o])=>o.visible=false);stage='pickup';timer=0;
  }
  if(stage==='pickup'){
   if(!move(train,dt))return;timer+=dt;if(timer<2)return;
   // Second wagon accepts only a nearby casualty, never teleports across town.
   const extra=actors.find(a=>a!==patients[0]&&a.m.userData.bookshopDowned&&!a.m.userData.bookshopMedical&&position(a.m).distanceTo(position(train))<4);
   if(extra)patients.push(extra);patients.forEach(a=>a.m.userData.bookshopMedical='in-transit');stats.collected+=patients.length;
   const dest=destination();path=[...routeWorld(position(train),dest[0]),...dest];returnPath=dest.slice().reverse();stage='transport';timer=0;stats.trips++;
  }
  if(stage==='transport'){
   const arrived=move(train,dt);carried(train);if(!arrived)return;
   patients.forEach((a,i)=>{a.m.userData.bookshopMedical='treating';const p=train.localToWorld(new THREE.Vector3((i?1:-1)*1.05,0,.4));a.m.position.copy(a.m.parent.worldToLocal(p));});
   stats.delivered+=patients.length;stage='treatment';timer=0;
  }
  if(stage==='treatment'){
   timer+=dt;if(timer<18)return;
   for(const a of patients){a.m.userData.bookshopHealth=100;a.m.userData.bookshopDowned=false;delete a.m.userData.bookshopThreatened;delete a.m.userData.bookshopDefending;a.m.userData.bookshopMedical='returning';stats.recovered++;}
   path=[...returnPath.map(p=>p.clone()),...routeWorld(returnPath.at(-1),homePoint),homePoint.clone()];stage='return';
  }
  if(stage==='return'){
   const arrived=move(train,dt);for(const [i,a]of patients.entries()){const p=train.localToWorld(new THREE.Vector3((i?1:-1)*1.2,0,-1));a.m.position.copy(a.m.parent.worldToLocal(p));a.m.quaternion.copy(a.m.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(train.getWorldQuaternion(new THREE.Quaternion())));}
   if(!arrived)return;for(const a of patients){const p=chart(position(a.m));a.x=p.x;a.z=p.z;a.path=[];a.wait=3;delete a.m.userData.bookshopMedical;seatActor(a);}release(train);
  }
 }
 return {update,snapshot:()=>({stage,patients:patients.map(a=>a.id),waiting:actors.filter(a=>a.m.userData.bookshopDowned&&!a.m.userData.bookshopMedical).length,...stats}),dispose(){const train=base.userData.plazaRescueTrain;if(train){for(const a of patients)delete a.m.userData.bookshopMedical;release(train);}}};
}
