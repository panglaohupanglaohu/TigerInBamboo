import {sfxRobotConfirmed} from '../../audio/worldSfx.js';
import {createWeaponEffects} from './weaponEffects.js';
import {ROBOT_RULES} from './combat.js';
import * as THREE from 'three';
import {animateArticulatedRobot} from '../../assets/robotArticulation.js';
import {applyVanguardHit} from '../../world/vanguardTrooper.js';
import {applyFleetHullDamage} from '../../world/fleetHullDamage.js';
import {isAircraftKnocked} from '../../world/tranquilizer.js';
export function defenseTargetPoint(enemy){const point=enemy.getWorldPosition(new THREE.Vector3());if(enemy.userData.bookshopReceiveHit)point.addScaledVector(point.clone().normalize(),1.35);return point;}
// Defense reacts to real fleet objects, never generates stand-in enemies.
export function createBaseDefense({scene,base,logistics,models,combat,getFleet,getAssault,R=160}){
 const weapons=createWeaponEffects(scene),states=new Map(),up=new THREE.Vector3(),point=new THREE.Vector3(),local=new THREE.Vector3(),ray=new THREE.Raycaster();let time=0,salvoReset=0,salvoBudget=3;
 let trooperScanAt=0;const trooperCache=[];
 const api={active:false,shotsFired:0,defenders:0,intruders:0,movingShots:0,transportShots:0};
 function inBase(o){o.getWorldPosition(point);local.copy(point);base.worldToLocal(local);if(local.y+R+.9<=0)return false;const k=(R+.9)/(local.y+R+.9);return Math.hypot(local.x*k,local.z*k+26)<102&&point.length()<R+85;}
 function living(o){if(!o?.parent||o.userData.dead||o.userData.downed||isAircraftKnocked(o))return false;for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
 api.update=dt=>{
  time+=dt;weapons.update(dt);if(time>=salvoReset){salvoReset=time+1.8;salvoBudget=3;}
  // Every Moebius fleet unit in the town is hostile: squadron aircraft, the
  // gate-pod escort craft and (below) the heavy troopers.
  const squad=getFleet(),battle=scene.userData.batianFleet;
  // Command mode owns active sorties, but must not erase the ordinary patrol
  // intruders while the flagship is idle. Only use the existing military lists.
  const fleetSet=new Set(battle?.active?battle.units():[...(squad?.userData.members||[]),...(squad?.userData.gatePodEscort?.children||[])]);
  const fleet=[...fleetSet].filter(living);
  // Moebius heavy troopers can be re-parented (pods, ropes, rolling stock), so
  // look scene-wide (cached ~1.5 s). Anyone visible in the base is a target,
  // including soldiers sliding down ropes; only those sealed inside craft are not.
  if(time>=trooperScanAt){trooperScanAt=time+1.5;trooperCache.length=0;scene.traverse(o=>{if(o.userData.unitClass==='vanguard-trooper')trooperCache.push(o);});}
  const ground=trooperCache.filter(o=>!o.userData.aboard&&living(o));
  const enemies=[...ground,...fleet],localEnemies=enemies.filter(inBase);api.active=localEnemies.length>0;api.intruders=localEnemies.length;api.defenders=0;
  const display=base.userData.models||[],all=[...display,...models.values()];
  for(const m of all){delete m.userData.defensePose;const u=m.userData.robotId?logistics.get(m.userData.robotId):null;
   const mounted=u?.status==='transit';
   const usable=display.includes(m)||(u&&['ready','deployed','repair','transit'].includes(u.status)&&u.health>0);
   if(u)u.defending=api.active&&usable&&!mounted;
   if(!usable||!m.visible||(!mounted&&!inBase(m)))continue;
   if(m.userData.batianSlowedSeconds>0)m.userData.batianSlowedSeconds=Math.max(0,m.userData.batianSlowedSeconds-dt);
   if(m.userData.batianSuppressionSeconds>0){m.userData.batianSuppressionSeconds=Math.max(0,m.userData.batianSuppressionSeconds-dt);m.userData.defensePose={state:'disabled',time};animateArticulatedRobot(m,m.userData.defensePose);continue;}
   if(m.userData.dead){if(u){u.health=0;logistics.markLost(u.id);const c=combat.get(u.id);if(c)c.hp=0;}animateArticulatedRobot(m,{state:'disabled'});continue;}
   const candidates=mounted?enemies:localEnemies;
   if(!candidates.length){if(display.includes(m)&&m.userData.robotType==='ant')m.userData.displaySeated=true;continue;}
   api.defenders++;m.userData.displaySeated=false;
   let state=states.get(m);if(!state){state={next:time+(states.size%5)*.2,position:m.getWorldPosition(new THREE.Vector3())};states.set(m,state);}
   if(state.mounted!==mounted){state.position.copy(m.getWorldPosition(new THREE.Vector3()));state.heading=null;state.mounted=mounted;}
   if(!mounted)m.position.copy(m.parent.worldToLocal(state.position.clone()));
   let origin=m.getWorldPosition(new THREE.Vector3());let enemy=null,dist=Infinity;const closeTroops=candidates.filter(e=>e.userData.bookshopReceiveHit&&e.getWorldPosition(point).distanceTo(origin)<35),flagship=candidates.find(e=>e.userData.kind==='crystal-colossus'&&e.getWorldPosition(point).distanceTo(origin)<=110);for(const e of closeTroops.length?closeTroops:flagship?[flagship]:candidates){const d=e.getWorldPosition(point).distanceTo(origin);if(d<dist){dist=d;enemy=e;}}if(!enemy)continue;
   const target=defenseTargetPoint(enemy),kind=m.userData.robotType;
   // Command trooper roots are at the soles, below the light shield. Aim at
   // the actual torso so weapon FX, interception and damage share one ray.
   let speed=0;
   up.copy(origin).normalize();
   if(!mounted&&dist>12){
    // Tangent-plane steering with ground support, swept wall checks and separation.
    const desired=target.clone().sub(origin).addScaledVector(up,-target.clone().sub(origin).dot(up)).normalize();
    const step=ROBOT_RULES[kind].speed*(m.userData.batianSlowedSeconds>0?.25:1)*Math.min(.1,Math.max(0,dt))*.65;
    for(const angle of[0,.5,-.5,1,-1]){
     const direction=desired.clone().applyAxisAngle(up,angle),next=origin.clone().addScaledVector(direction,step).normalize();
     const height=base.userData.groundHeightAt?.(next);if(!Number.isFinite(height))continue;next.multiplyScalar(height);
     if(all.some(other=>other!==m&&other.visible&&other.getWorldPosition(point).distanceTo(next)<3.5))continue;
     ray.set(origin.clone().addScaledVector(up,1.2),direction);ray.far=step+1.5;
     if(ray.intersectObjects(base.userData.cameraOccludersNear?.(origin,5)||[],false).length)continue;
     state.position.copy(next);m.position.copy(m.parent.worldToLocal(next.clone()));origin=next;speed=step/Math.max(dt,.001);
     const right=new THREE.Vector3().crossVectors(up,direction).normalize(),forward=new THREE.Vector3().crossVectors(right,up).normalize();
     state.heading=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));break;
    }
   }
   if(!mounted){
    if(!state.heading||speed===0){const f=target.clone().sub(origin).addScaledVector(up,-target.clone().sub(origin).dot(up)).normalize(),r=new THREE.Vector3().crossVectors(up,f).normalize();state.heading=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r,up,f));}
    m.quaternion.copy(m.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(state.heading));
   }
   m.updateWorldMatrix(true,true);
   const aimDir=target.clone().sub(origin).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()).invert());
   const yaw=Math.atan2(aimDir.x,aimDir.z),pitch=Math.atan2(aimDir.y,Math.hypot(aimDir.x,aimDir.z));
   const inArc=(kind==='beetle'||Math.abs(yaw)<=1.4)&&pitch>=-.25&&pitch<=1.53;
   // Transport retains its secured lower-body pose; only the upper weapon aims.
   m.userData.defensePose={time,speed,state:mounted?'transport':speed>0?'move':'aim',fire:false,aim:yaw,pitch,aimPoint:target.clone(),braced:false};
   animateArticulatedRobot(m,m.userData.defensePose);m.updateWorldMatrix(true,true);
   const muzzle=m.getObjectByName('robot-muzzle');const start=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):origin.clone().addScaledVector(up,2);
   if(time<state.next||dist>110||!inArc||battle?.active&&salvoBudget<=0)continue;const direction=target.clone().sub(start),length=direction.length();ray.set(start,direction.normalize());ray.far=length-.5;const blockers=base.userData.cameraOccludersNear?.(start,length)||[];
   const friendlyBlocked=all.some(other=>{if(other===m||!other.visible)return false;other.getWorldPosition(point).addScaledVector(up,1.1);const v=point.clone().sub(start),along=v.dot(direction);return along>1&&along<length-.5&&v.addScaledVector(direction,-along).length()<1.2;});
   if(friendlyBlocked){state.next=time+.2;continue;}
   if(ray.intersectObjects(blockers,false).length){state.next=time+.3;continue;}
   if(battle?.active)salvoBudget--;m.userData.defensePose.fire=true;animateArticulatedRobot(m,m.userData.defensePose);m.updateWorldMatrix(true,true);
   const amount=kind==='ant'?100:kind==='locust'?72:45,shieldPoint=enemy.userData.bookshopShieldPoint?.(start,target)||(battle?.active?battle.shieldPoint?.(enemy,start,target):null),impactPoint=shieldPoint||target;
   state.next=time+ROBOT_RULES[kind].interval;
   const onImpact=enemy.userData.bookshopReceiveHit?p=>{enemy.userData.bookshopReceiveHit?.(amount/ROBOT_RULES[kind].shots,m,p);}:battle?.active&&enemy.userData.unitClass!=='vanguard-trooper'?p=>{const hit=battle.receiveHit(enemy,amount/ROBOT_RULES[kind].shots,shieldPoint?p:null);if(hit?.accepted&&!hit.intercepted)sfxRobotConfirmed(p,hit.disabled);}:null;
   weapons.burst(m,impactPoint,ROBOT_RULES[kind].shots,onImpact);api.shotsFired+=ROBOT_RULES[kind].shots;if(speed>0)api.movingShots+=ROBOT_RULES[kind].shots;if(mounted)api.transportShots+=ROBOT_RULES[kind].shots;
   if(enemy.userData.unitClass==='vanguard-trooper'&&!enemy.userData.bookshopReceiveHit){const hit=applyVanguardHit(enemy,kind==='ant'?'javelin':'arrow');sfxRobotConfirmed(target,hit.dead);}
   else if(!battle?.active&&!enemy.userData.bookshopReceiveHit){const hit=applyFleetHullDamage(enemy,amount,{source:'robot-defense'});if(hit.accepted&&!hit.intercepted)sfxRobotConfirmed(target,hit.disabled);}
   // Retaliation only after this real hit; preserves the fleet's existing trigger rule.
   if(!battle?.active&&scene.userData.batianCommandMode!==true){getAssault()?.onFleetUnderAttack?.(m);getAssault()?.designateTarget?.(m);}
  }
 };
 api.snapshot=()=>({active:api.active,intruders:api.intruders,defenders:api.defenders,shotsFired:api.shotsFired,movingShots:api.movingShots,transportShots:api.transportShots,weaponEffects:{...weapons.stats}});return api;
}
