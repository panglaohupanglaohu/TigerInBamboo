import * as THREE from 'three';
import {createSwampGroundRayIndex} from './swampGroundRayIndex.js';
import {installSwampOppositeLanding} from './swampOppositeLanding.js';
const smooth=x=>x*x*(3-2*x);
/** Connected authored navigation, never an arbitrary straight line across the lake wall. */
export function planTigerMeeting(swamp,playerLocal){
 const roam=swamp.userData.tiger?.userData.tigerRoam;if(!roam||!playerLocal)return null;
 const stairs=roam.steps.map(p=>p.clone()),rim=roam.rim[0],candidates=[];
 const bank=(swamp.userData.gregSpatialPlan?.route||[]).map(p=>new THREE.Vector3(...p));
 const projection=(a,b)=>{const ab=b.clone().sub(a),u=THREE.MathUtils.clamp(playerLocal.clone().sub(a).dot(ab)/Math.max(1e-8,ab.lengthSq()),0,1);return a.clone().addScaledVector(ab,u);};
 if(bank.length){let best=null;for(let i=0;i<bank.length-1;i++){const point=projection(bank[i],bank[i+1]),distance=point.distanceTo(playerLocal);if(!best||distance<best.distance)best={point,distance,index:i};}
  if(best){let join=0;for(let i=1;i<stairs.length;i++)if(stairs[i].distanceTo(bank[0])<stairs[join].distanceTo(bank[0]))join=i;
   const prefix=stairs.slice(join).reverse(),queue=prefix.concat(bank.slice(0,best.index+1),[best.point]);candidates.push({...best,kind:'bank',queue,bankStart:prefix.length});}
 }
 const radius=Math.hypot(rim.x,rim.z),angle=Math.atan2(playerLocal.z,playerLocal.x),start=Math.atan2(rim.z,rim.x),delta=Math.atan2(Math.sin(angle-start),Math.cos(angle-start)),rimPoint=new THREE.Vector3(Math.cos(angle)*radius,rim.y,Math.sin(angle)*radius),arc=[];
 for(let i=0,n=Math.max(1,Math.ceil(Math.abs(delta)*radius/.6));i<=n;i++){const a=start+delta*i/n;arc.push(new THREE.Vector3(Math.cos(a)*radius,rim.y,Math.sin(a)*radius));}
 candidates.push({point:rimPoint,distance:rimPoint.distanceTo(playerLocal),kind:'rim',queue:stairs.slice().reverse().concat(arc)});
 for(let i=0;i<stairs.length-1;i++){const point=projection(stairs[i],stairs[i+1]);candidates.push({point,distance:point.distanceTo(playerLocal),kind:'stairs',queue:stairs.slice(i+1).reverse().concat([point])});}
 const chosen=candidates.sort((a,b)=>a.distance-b.distance)[0];
 // Scale-aware physical proximity plus the player's actual supporting walk mesh is checked by controller.
 const scale=swamp.getWorldScale(new THREE.Vector3()).x||1;if(!chosen||chosen.distance*scale>7.1)return null;
 // Keep the original 3.2-local personal space along the connected path, not a chord off the bank.
 const queue=chosen.queue.map(p=>p.clone());let remaining=3.2;
 while(queue.length>1&&remaining>0){const end=queue.at(-1),before=queue.at(-2),distance=end.distanceTo(before);if(distance<=remaining){remaining-=distance;queue.pop();}else{queue[queue.length-1]=end.clone().lerp(before,remaining/distance);remaining=0;}}
 return {...chosen,point:queue.at(-1),queue};
}
/** Real existing tiger, raft and escort whale; no duplicated animal or child identity. */
export function installSwampTigerEncounter(swamp,{random=Math.random,landing=installSwampOppositeLanding(swamp)}={}){
 const tiger=swamp.userData.tiger;if(!tiger||swamp.userData.tigerEncounter)return swamp.userData.tigerEncounter;
 const water=swamp.userData.waterY??25,origin=landing.drinking.clone(),home=tiger.userData.tigerRoam.drink.clone(),boat=swamp.userData.shipyard?.barge,whale=swamp.userData.shipyard?.escort;
 const meetingGroundIndex=createSwampGroundRayIndex(),meetingRay=new THREE.Raycaster();
 const report={phase:'idle',transport:null,cycles:0,eyeContactSeconds:0,arrival:false};
 let clock=0,cooldown=0,target=null,from=null,to=null,carrier=null,saved=null,returning=false,meetQueue=[],meetIndex=0,meetPlan=null,returnQueue=[];
 const playerPoint=new THREE.Vector3(),carrierPosition=new THREE.Vector3(),carrierQuaternion=new THREE.Quaternion();
 function playerLocal(player){if(!player?.position)return null;playerPoint.copy(player.position);swamp.worldToLocal(playerPoint);return playerPoint;}
 function playerWalkSupported(pl){
  const meshes=[...(swamp.userData.tigerWalkSurfaces||[]),...(swamp.userData.gregSpatialPlan?.walkMeshes||[]),...(swamp.userData.gregCoralRim?.walkMeshes||[])];
  if(!meshes.length)return true;swamp.updateWorldMatrix(true,false);const o=swamp.localToWorld(new THREE.Vector3(pl.x,65,pl.z)),d=new THREE.Vector3(0,-1,0).transformDirection(swamp.matrixWorld);meetingRay.set(o,d);for(const mesh of meshes)mesh.updateWorldMatrix(true,false);const hit=meetingGroundIndex.intersectObjects(meetingRay,meshes)[0];if(!hit)return false;const y=swamp.worldToLocal(hit.point.clone()).y;return pl.y-y>=-.5&&pl.y-y<=5.5;
 }
 function phase(name){report.phase=name;clock=0;}
 function setY(y){tiger.userData._baseY=y;tiger.position.y=y;}
 function walkGroundY(x,z,fallback){
  const meshes=tiger.userData._bankWalking?(swamp.userData.gregSpatialPlan?.walkMeshes||[]):[...(swamp.userData.tigerWalkSurfaces||[]),...(swamp.userData.gregCoralRim?.walkMeshes||[])];
  if(!meshes.length)return fallback;swamp.updateWorldMatrix(true,false);meetingRay.set(swamp.localToWorld(new THREE.Vector3(x,65,z)),new THREE.Vector3(0,-1,0).transformDirection(swamp.matrixWorld));for(const mesh of meshes)mesh.updateWorldMatrix(true,false);const hit=meetingGroundIndex.intersectObjects(meetingRay,meshes)[0];return hit?swamp.worldToLocal(hit.point.clone()).y+.08:fallback;
 }
 function walk(p,dt,spd=2.6,backward=false){const dx=p.x-tiger.position.x,dz=p.z-tiger.position.z,d=Math.hypot(dx,dz);if(d<.08){setY(walkGroundY(tiger.position.x,tiger.position.z,p.y));return true;}const yaw=Math.atan2(dx,dz),error=Math.atan2(Math.sin(yaw-tiger.rotation.y),Math.cos(yaw-tiger.rotation.y));if(!backward)tiger.rotation.y+=THREE.MathUtils.clamp(error,-2.6*dt,2.6*dt);tiger.userData._backwalking=backward;const step=Math.min(d,spd*dt*(backward?1:Math.max(.1,Math.cos(Math.min(Math.abs(error),Math.PI/2)))));tiger.position.x+=dx/d*step;tiger.position.z+=dz/d*step;setY(walkGroundY(tiger.position.x,tiger.position.z,tiger.userData._baseY+(p.y-tiger.userData._baseY)*Math.min(1,step/d)));tiger.userData._walking=true;return false;}
 function beginVoyage(back=false){returning=back;from=tiger.position.clone();to=(back?origin:target).clone();to.y=water;phase(back?'return-voyage':'voyage');}
 function release(){if(carrier&&saved){carrier.position.copy(saved.position);carrier.quaternion.copy(saved.quaternion);}carrier=null;saved=null;tiger.userData._swimming=false;tiger.userData._transporting=false;tiger.userData._backwalking=false;tiger.userData._bankWalking=false;}
 const wake=new THREE.Group();wake.name='swamp-tiger-swim-wake';swamp.add(wake);const wakeRings=[];
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.7,.74,28),new THREE.MeshBasicMaterial({color:0xb2d9cf,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;wake.add(ring);wakeRings.push(ring);}
 const paddles=[];
 if(boat){for(const side of [-1,1]){const oar=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3.2,5),new THREE.MeshBasicMaterial({color:0x806144}));shaft.rotation.z=Math.PI/2;shaft.position.x=side*1.6;oar.add(shaft);const blade=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.3),shaft.material);blade.position.x=side*3;oar.add(blade);oar.position.set(0,.2,side*.8);oar.userData.side=side;boat.add(oar);paddles.push(oar);}}
 function syncCarrier(t){wake.visible=!!tiger.userData._swimming;wake.position.set(tiger.position.x,water+.035,tiger.position.z);for(let i=0;i<wakeRings.length;i++){const u=(t*.6+i/3)%1,r=wakeRings[i];r.scale.setScalar(.7+u*1.4);r.material.opacity=.28*(1-u);r.position.set(-Math.sin(tiger.rotation.y)*u*1.8,0,-Math.cos(tiger.rotation.y)*u*1.8);}
 if(!carrier||report.phase==='idle')return;carrier.position.copy(carrierPosition);carrier.quaternion.copy(carrierQuaternion);for(const oar of paddles)oar.rotation.y=.35*Math.sin(t*2.8+oar.userData.side*.4);}
 const api={report,random,get active(){return report.phase!=='idle';},syncCarrier,step(dt,t,player){
  cooldown=Math.max(0,cooldown-dt);const pl=playerLocal(player);
  if(report.phase==='idle'){
   tiger.userData._bankWalking=false;tiger.userData._backwalking=false;
   // Drinking before eye contact replaces the former immediate crater-wide leap.
   if(cooldown||tiger.userData._mode!=='drink'||!pl||Math.hypot(pl.x,pl.z)>44)return false;
   target=home.clone();from=tiger.position.clone();to=origin.clone();phase('patrol-swim');report.transport='swim';report.eyeContactSeconds=0;report.arrival=false;return true;
  }
  clock+=dt;tiger.userData._bankWalking=false;tiger.userData._backwalking=false;tiger.userData._walking=false;tiger.userData._drinking=false;tiger.userData._greeting=false;
  if(report.phase==='eye-contact'){
   tiger.userData._drinking=clock<1.2;
   if(pl){const yaw=Math.atan2(pl.x-tiger.position.x,pl.z-tiger.position.z),error=Math.atan2(Math.sin(yaw-tiger.rotation.y),Math.cos(yaw-tiger.rotation.y));tiger.rotation.y+=THREE.MathUtils.clamp(error,-dt*2.6,dt*2.6);if(Math.abs(error)<.2&&tiger.position.distanceTo(pl)<75)report.eyeContactSeconds+=dt;}
   if(pl&&report.eyeContactSeconds>=3){
    const choices=['swim',...(boat?['boat']:[]),...(whale?['whale']:[])];report.transport=choices[Math.min(choices.length-1,Math.floor(api.random()*choices.length))];
    carrier=report.transport==='boat'?boat:report.transport==='whale'?whale:null;
    if(carrier){saved={position:carrier.position.clone(),quaternion:carrier.quaternion.clone()};carrierPosition.copy(carrier.position);carrierQuaternion.copy(carrier.quaternion);phase('pickup');}else beginVoyage();
   }
  }else if(report.phase==='pickup'){
   // Existing carrier approaches the drinking ledge continuously, rather than appearing under the tiger.
   const destination=origin.clone().setY(water+(report.transport==='whale'?-.45:.1));const distance=carrierPosition.distanceTo(destination),step=Math.min(distance,dt*4);
   carrierPosition.lerp(destination,distance?step/distance:1);carrierQuaternion.copy(carrier.quaternion);carrier.position.copy(carrierPosition);
   if(distance<.12){from=tiger.position.clone();phase('embark');}
  }else if(report.phase==='embark'){
   const u=Math.min(1,clock/1.5);setY(THREE.MathUtils.lerp(from.y,water+(report.transport==='whale'?.2:.22),smooth(u)));if(u===1)beginVoyage();
  }else if(report.phase==='voyage'||report.phase==='return-voyage'||report.phase==='patrol-swim'){
   const length=from.distanceTo(to),u=Math.min(1,clock/Math.max(8,length/2.3)),p=new THREE.Vector3().lerpVectors(from,to,smooth(u));
   // Route bows away from the central trunk instead of cutting through it.
   const dx=to.x-from.x,dz=to.z-from.z,n=Math.hypot(dx,dz)||1;const ox=-dz/n*12,oz=dx/n*12;p.x+=Math.sin(Math.PI*u)*ox;p.z+=Math.sin(Math.PI*u)*oz;const tangent=to.clone().sub(from);tangent.x+=ox*Math.PI*Math.cos(Math.PI*u);tangent.z+=oz*Math.PI*Math.cos(Math.PI*u);tiger.rotation.y=Math.atan2(tangent.x,tangent.z);
   tiger.position.x=p.x;tiger.position.z=p.z;tiger.userData._swimming=report.transport==='swim';tiger.userData._transporting=!!carrier;
   tiger.userData._walking=report.transport==='swim';const cruisingY=water+(carrier?(report.transport==='whale'?.2:.22):-1.35);setY(THREE.MathUtils.lerp(from.y,cruisingY,smooth(Math.min(1,clock/1.5)))+Math.sin(t*2.1)*.04*Math.min(1,clock));
   if(carrier){carrierPosition.copy(p).setY(water+(report.transport==='whale'?-.45:.1));carrierQuaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),tiger.rotation.y);}
   if(u===1){from=tiger.position.clone();if(report.phase==='patrol-swim'){phase('opposite-landing');}else phase('disembark');}
  }else if(report.phase==='disembark'){
   const u=Math.min(1,clock/1.5),dest=returning?origin:target;setY(THREE.MathUtils.lerp(from.y,dest.y,smooth(u)));tiger.userData._walking=true;
   if(u===1){if(returning){if(carrier)phase('carrier-home');else{release();phase('idle');cooldown=45;report.cycles++;}}else{tiger.userData._swimming=false;tiger.userData._transporting=false;phase('opposite-drink');report.arrival=true;}}
  }else if(report.phase==='opposite-landing'){
   const u=Math.min(1,clock/1.5);setY(THREE.MathUtils.lerp(from.y,origin.y,smooth(u)));if(u===1){tiger.userData._swimming=false;phase('eye-contact');}
  }else if(report.phase==='opposite-drink'){
   tiger.userData._drinking=true;if(clock>3){meetPlan=pl&&playerWalkSupported(pl)?planTigerMeeting(swamp,pl):null;if(meetPlan){meetQueue=meetPlan.queue;returnQueue=meetQueue.slice().reverse().concat([home.clone()]);report.meetingPath=meetPlan.kind;report.meetingTarget=meetPlan.point.toArray();}else{meetQueue=[];returnQueue=[home.clone()];report.meetingPath='unreachable';}meetIndex=0;phase('meet-climb');}
  }else if(report.phase==='meet-climb'){
   tiger.userData._bankWalking=meetPlan?.kind==='bank'&&meetIndex>=meetPlan.bankStart;
   if(meetIndex>=meetQueue.length){if(meetPlan&&pl&&tiger.position.distanceTo(pl)*(swamp.getWorldScale(new THREE.Vector3()).x||1)<=7.5)phase('meeting');else{meetQueue=returnQueue;meetIndex=0;phase('meet-return');}}else if(walk(meetQueue[meetIndex],dt))meetIndex++;
  }else if(report.phase==='meeting'){
   tiger.userData._bankWalking=meetPlan?.kind==='bank';
   tiger.userData._greeting=true;
   // Remain on the authored ledge, looking across to the messenger; no water-plane chasing.
   if(pl){const yaw=Math.atan2(pl.x-tiger.position.x,pl.z-tiger.position.z),error=Math.atan2(Math.sin(yaw-tiger.rotation.y),Math.cos(yaw-tiger.rotation.y));tiger.rotation.y+=THREE.MathUtils.clamp(error,-dt*2.6,dt*2.6);}
   if(clock>10){meetQueue=returnQueue;meetIndex=0;phase('meet-return');}
  }else if(report.phase==='meet-return'){
   tiger.userData._bankWalking=meetPlan?.kind==='bank'&&meetIndex<returnQueue.length-1-meetPlan.bankStart;
   if(meetIndex<meetQueue.length){if(walk(meetQueue[meetIndex],dt,2.6,meetPlan?.kind==='stairs'||(meetPlan?.kind==='bank'&&!tiger.userData._bankWalking)))meetIndex++;}else{if(carrier)phase('carrier-home');else{release();phase('idle');cooldown=45;report.cycles++;}}
  }else if(report.phase==='carrier-home'){
   const distance=carrierPosition.distanceTo(saved.position);carrierPosition.lerp(saved.position,distance?Math.min(1,dt*4/distance):1);
   if(distance<.1){release();phase('idle');cooldown=45;report.cycles++;}
  }
  tiger.userData._mode='encounter-'+report.phase;return true;
 }};
 tiger.userData.encounterController=api;swamp.userData.tigerEncounter=api;
 // Existing scene animates escort after tiger: last-write carrier pose once per actual frame.
 const prior=swamp.update;swamp.update=function(dt,t,runtime){prior?.call(this,dt,t,runtime);syncCarrier(t);};
 return api;
}
