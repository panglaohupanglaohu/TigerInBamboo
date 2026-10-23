import * as T from 'three';
import {isAircraftKnocked} from '../tranquilizer.js';
import {applyFleetHullDamage} from '../fleetHullDamage.js';
import {createCitadelGuardianStorm} from './citadelGuardianStorm.js';

const V=a=>new T.Vector3(...a),clamp=T.MathUtils.clamp;
const live=o=>{if(!o?.parent||o.userData.dead||o.userData.downed||isAircraftKnocked(o))return false;for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
function localBounds(root){const b=new T.Box3(),inv=root.matrixWorld.clone().invert();root.traverse(o=>{if(o.isMesh&&!o.userData.isOutline){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));}});return b;}
function isUnder(o,parent){for(let p=o;p;p=p.parent)if(p===parent)return true;return false;}
/** Same original statue, horse and fleet. No substitute actors or arbitrary global weather writes. */
export function createCitadelPlazaGuardian({scene,castle,statue,horse,nightInfiltration=null,getFleet,getAssault=()=>null,getPlayerAircraft=()=>null,getListenerPosition,sampleSupport,thunder,stormFactory=createCitadelGuardianStorm,damage=1200,strikeInterval=3.2,triggerRadius=70,releaseRadius=88}={}){
 const rig=statue?.userData.heroRig,riderSeat=horse?.userData.ridingAnchors?.seat;
 if(!scene||!castle||!rig?.bodyRoot||!riderSeat||typeof getFleet!=='function')throw new TypeError('Guardian requires installed original statue rig, horse seat and fleet provider');
 scene.updateMatrixWorld(true);const body=rig.bodyRoot,horseRest={position:horse.position.clone(),quaternion:horse.quaternion.clone(),scale:horse.scale.clone()},bodyRestWorld=body.getWorldPosition(new T.Vector3()),bodyRestQ=body.getWorldQuaternion(new T.Quaternion()),bodyRestScale=body.getWorldScale(new T.Vector3());
 const horseHome=horse.getWorldPosition(new T.Vector3()),horseQ=horse.getWorldQuaternion(new T.Quaternion()),up=V([0,1,0]).applyQuaternion(horseQ).normalize(),center=statue.getWorldPosition(new T.Vector3()).add(horseHome).multiplyScalar(.5),radial=center.clone().normalize(),horseBounds=localBounds(horse);
 const owner='citadel-guardian-'+statue.uuid,storm=stormFactory({scene,origin:center,quaternion:horseQ,getListenerPosition,thunder});
 const report={version:'citadel-plaza-guardian-2-metal-awakening',phase:'idle',awakenings:0,strikes:0,damage:0,disabled:0,moves:0,blockedMoves:0,leaseWaits:0,restorations:0,events:[],movement:'four-wheel supported, bounded plaza arc',actualSceneVerified:false};
 let phase='idle',phaseTime=0,time=0,lastEnemyTime=0,nextStrike=0,cooldown=0,lease=false,disposed=false,fromBody=null,fromQ=null,fromHorse=null,fromHorseQ=null,target=null;
 const ray=new T.Raycaster(),supports=[];castle.traverse(o=>{if(o.isMesh&&/^(target-plaza-paving-surface|target-horse-paving)$/.test(o.name))supports.push(o);});
 const obstacles=[];
 castle.traverse(o=>{if(!o.isMesh||isUnder(o,body)||isUnder(o,horse))return;const plinth=isUnder(o,statue);if(!plinth&&!/plaza-sea-perimeter-(railings|stone-curb)/.test(o.name))return;o.geometry.computeBoundingBox();if(o.isInstancedMesh){const im=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);obstacles.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(im)).expandByScalar(.08));}}else obstacles.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).expandByScalar(.08));});
 function emit(type,data={}){report.events.push({time,type,...data});if(report.events.length>40)report.events.shift();}
 function setPhase(p){phase=p;phaseTime=0;report.phase=p;const awake=!['idle','waiting'].includes(p);statue.userData.guardianAppearance?.setAwake(awake);report.appearance=awake?'metal':'stone';emit('phase',{phase:p,appearance:report.appearance});}
 function findTargets(radius){const fleet=getFleet(),playerAircraft=getPlayerAircraft();return(fleet?.parent?fleet.userData.members||[]:[]).filter(m=>{
  if(!live(m)||m.userData.kind!=='moebius-aircraft'||m===playerAircraft||m.userData.playerControlled||m.userData.pilotedByPlayer||m.userData.team==='friendly'||m.userData.team==='player')return false;
  const p=m.getWorldPosition(new T.Vector3()),d=p.clone().sub(center),height=Math.abs(d.dot(radial)),horizontal=d.addScaledVector(radial,-d.dot(radial)).length();return height<90&&horizontal<radius&&p.clone().normalize().dot(radial)>.8;
 }).sort((a,b)=>(a.userData.formationIndex===0?-1:0)-(b.userData.formationIndex===0?-1:0)||a.getWorldPosition(new T.Vector3()).distanceToSquared(center)-b.getWorldPosition(new T.Vector3()).distanceToSquared(center));}
 function acquire(){if(lease)return true;if(!nightInfiltration){lease=true;return true;}if(typeof nightInfiltration.requestGuardianLease!=='function'){report.leaseReason='night-controller-lease-unavailable';return false;}const r=nightInfiltration.requestGuardianLease(owner);lease=r===true||r?.ok===true;if(!lease)report.leaseReason=r?.reason||'soldiers-returning';return lease;}
 function release(){nightInfiltration?.releaseGuardianLease?.(owner);lease=false;}
 function worldBody(p,q){body.position.copy(body.parent.worldToLocal(p.clone()));body.quaternion.copy(body.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));body.updateWorldMatrix(true,true);}
 function mountTarget(){riderSeat.updateWorldMatrix(true,true);const seatWorld=riderSeat.getWorldPosition(new T.Vector3()),q=horse.getWorldQuaternion(new T.Quaternion());const offset=rig.anchors.seat.position.clone().multiply(bodyRestScale).applyQuaternion(q);return{p:seatWorld.sub(offset),q};}
 function attachRider(){rig.detachTo(riderSeat);const parentScale=riderSeat.getWorldScale(new T.Vector3());body.scale.copy(bodyRestScale).divide(parentScale);body.quaternion.identity();body.position.copy(rig.anchors.seat.position).multiply(body.scale).negate();rig.setPose({mounted:1,raiseSpear:1});}
 function sample(point){if(sampleSupport){const h=sampleSupport(point.clone());return h?.isVector3?h:h?.point?.isVector3?h.point:Array.isArray(h?.point)?V(h.point):null;}ray.set(point.clone().addScaledVector(up,.7),up.clone().negate());ray.far=1.4;return ray.intersectObjects(supports,false)[0]?.point||null;}
 function safeHorsePose(position,quaternion){
  const beforeP=horse.position.clone(),beforeQ=horse.quaternion.clone();horse.position.copy(position);horse.quaternion.copy(quaternion);horse.updateWorldMatrix(true,true);
  let ok=true;const gaps=[];
  for(const x of[-2.55,2.55])for(const z of[-2.7,2.7]){const foot=horse.localToWorld(V([x,0,z])),hit=sample(foot);if(!hit){ok=false;break;}const gap=foot.clone().sub(hit).dot(up);gaps.push(gap);if(Math.abs(gap)>.14)ok=false;}
  const bounds=horseBounds.clone().applyMatrix4(horse.matrixWorld);if(obstacles.some(b=>b.intersectsBox(bounds)))ok=false;
  horse.position.copy(beforeP);horse.quaternion.copy(beforeQ);horse.updateWorldMatrix(true,true);report.lastSupport={samples:gaps.length,gaps,ok};return ok;
 }
 function animateHorse(){
  // Under half a metre from the accepted original footprint, inside its paved disk.
  const worldOffset=V([Math.sin(time*.45)*.26,0,Math.sin(time*.90)*.14]).applyQuaternion(horseQ),world=horseHome.clone().add(worldOffset),p=horse.parent.worldToLocal(world),q=horseRest.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(V([0,1,0]),Math.sin(time*.45)*.035));
  if(safeHorsePose(p,q)){horse.position.copy(p);horse.quaternion.copy(q);report.moves++;}else report.blockedMoves++;
  // Wheel-supported chassis stays planted; articulated forelegs make a small living motion.
  for(const name of['foreLeft','foreRight'])horse.userData.articulation?.setJoint?.(name,'elbow',Math.sin(time*1.4)*.06);
  horse.updateWorldMatrix(true,true);
 }
 function restoreHorse(){horse.position.copy(horseRest.position);horse.quaternion.copy(horseRest.quaternion);horse.scale.copy(horseRest.scale);horse.userData.articulation?.reset?.();horse.updateWorldMatrix(true,true);}
 function beginReturn(){fromHorse=horse.position.clone();fromHorseQ=horse.quaternion.clone();setPhase('returning-horse');}
 function finish(){restoreHorse();rig.restoreToPedestal();release();report.restorations++;cooldown=10;target=null;setPhase('idle');}
 function update(dt){
  if(disposed||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);time+=dt;phaseTime+=dt;cooldown=Math.max(0,cooldown-dt);
  if(!statue.parent||!horse.parent){dispose();return;}
  const enemies=findTargets(phase==='idle'||phase==='waiting'?triggerRadius:releaseRadius);target=enemies[0]||null;if(target)lastEnemyTime=time;
  if(phase==='idle'&&target&&cooldown===0){emit('invasion-detected',{uuid:target.uuid,formationIndex:target.userData.formationIndex,world:target.getWorldPosition(new T.Vector3()).toArray()});setPhase('waiting');}
  if(phase==='waiting'){
   if(!target){release();setPhase('idle');}else if(safeHorsePose(horseRest.position,horseRest.quaternion)&&acquire()){
    report.blockedReason=null;report.awakenings++;fromBody=body.getWorldPosition(new T.Vector3());fromQ=body.getWorldQuaternion(new T.Quaternion());rig.detachTo(scene);setPhase('awakening');
   }else {report.leaseWaits++;report.blockedReason=report.lastSupport?.ok?'night-soldiers-returning':'horse-paving-support-or-obstacle';}
  }else if(phase==='awakening'){
   const k=clamp(phaseTime/2,0,1),e=k*k*(3-2*k),dest=mountTarget(),p=fromBody.clone().lerp(dest.p,e).addScaledVector(up,Math.sin(k*Math.PI)*1.5);rig.setPose({mounted:e,raiseSpear:e});worldBody(p,fromQ.clone().slerp(dest.q,e));if(k===1){attachRider();nextStrike=time+.6;setPhase('mounted');}
  }else if(phase==='mounted'){
   animateHorse();rig.setPose({mounted:1,raiseSpear:1});
   if(target&&time>=nextStrike){nextStrike=time+Math.max(1,strikeInterval);const result=applyFleetHullDamage(target,damage);if(result.accepted){const hit=target.getWorldPosition(new T.Vector3());storm.strike(rig.getSpearTipWorld(),hit);getAssault()?.onFleetUnderAttack?.(body);getAssault()?.designateTarget?.(body);report.strikes++;report.damage+=result.damage;if(result.disabled)report.disabled++;report.lastTarget={uuid:target.uuid,formationIndex:target.userData.formationIndex};emit('lightning-hit',{uuid:target.uuid,...result});}}
   if(time-lastEnemyTime>4)beginReturn();
  }else if(phase==='returning-horse'){
   const k=clamp(phaseTime/1.5,0,1),p=fromHorse.clone().lerp(horseRest.position,k),q=fromHorseQ.clone().slerp(horseRest.quaternion,k);
   if(safeHorsePose(p,q)){horse.position.copy(p);horse.quaternion.copy(q);}if(k===1){restoreHorse();fromBody=body.getWorldPosition(new T.Vector3());fromQ=body.getWorldQuaternion(new T.Quaternion());rig.detachTo(scene);setPhase('returning-statue');}
  }else if(phase==='returning-statue'){
   const k=clamp(phaseTime/2,0,1),e=k*k*(3-2*k),p=fromBody.clone().lerp(bodyRestWorld,e).addScaledVector(up,Math.sin(k*Math.PI)*1.5);rig.setPose({mounted:1-e,raiseSpear:1-e});worldBody(p,fromQ.clone().slerp(bodyRestQ,e));if(k===1)finish();
  }
  storm.update(dt,!['idle','waiting'].includes(phase));report.targetCount=enemies.length;report.lease=lease;
 }
 function dispose(){if(disposed)return;finish();storm.dispose();disposed=true;report.phase='disposed';}
 return{update,report,stormState:storm.state,storm,dispose};
}
