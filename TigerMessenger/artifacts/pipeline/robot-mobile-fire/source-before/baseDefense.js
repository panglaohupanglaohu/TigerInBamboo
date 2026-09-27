import {createWeaponEffects} from './weaponEffects.js';
import {ROBOT_RULES} from './combat.js';
import * as THREE from 'three';
import {animateArticulatedRobot} from '../../assets/robotArticulation.js';
import {applyVanguardHit} from '../../world/vanguardTrooper.js';
import {isAircraftKnocked} from '../../world/tranquilizer.js';
// Defense reacts to real fleet objects, never generates stand-in enemies.
export function createBaseDefense({scene,base,logistics,models,combat,getFleet,getAssault,R=160}){
 const weapons=createWeaponEffects(scene),states=new Map(),up=new THREE.Vector3(),point=new THREE.Vector3(),local=new THREE.Vector3(),ray=new THREE.Raycaster();let time=0;
 const api={active:false,shotsFired:0,defenders:0,intruders:0};
 function inBase(o){o.getWorldPosition(point);local.copy(point);base.worldToLocal(local);const k=(R+.9)/(local.y+R+.9);return Math.hypot(local.x*k,local.z*k+26)<102&&point.length()<R+85;}
 function living(o){return o?.parent&&o.visible&&!o.userData.dead&&!o.userData.downed&&!isAircraftKnocked(o);}
 api.update=dt=>{
  time+=dt;weapons.update(dt);
  const fleet=(getFleet()?.userData.members||[]).filter(o=>living(o)&&inBase(o));
  const ground=[];if(fleet.length||api.active)scene.getObjectByName('vanguard-squad')?.traverse(o=>{if(o.userData.unitClass==='vanguard-trooper'&&!o.userData.aboard&&living(o)&&inBase(o))ground.push(o);});
  const enemies=[...ground,...fleet];api.active=enemies.length>0;api.intruders=enemies.length;api.defenders=0;
  const display=base.userData.models||[],all=[...display,...models.values()];
  for(const m of all){const u=m.userData.robotId?logistics.get(m.userData.robotId):null;
   const usable=display.includes(m)||(u&&['ready','deployed','repair'].includes(u.status)&&u.health>0);
   if(u)u.defending=api.active&&usable;
   if(!usable||!m.visible||!inBase(m))continue;
   if(m.userData.dead){if(u){u.health=0;logistics.markLost(u.id);const c=combat.get(u.id);if(c)c.hp=0;}animateArticulatedRobot(m,{state:'disabled'});continue;}
   if(!api.active){if(display.includes(m)&&m.userData.robotType==='ant')m.userData.displaySeated=true;continue;}
   api.defenders++;m.userData.displaySeated=false;
   let state=states.get(m);if(!state){state={next:time+(states.size%5)*.2};states.set(m,state);}
   const origin=m.getWorldPosition(new THREE.Vector3());let enemy=null,dist=Infinity;for(const e of enemies){const d=e.getWorldPosition(point).distanceTo(origin);if(d<dist){dist=d;enemy=e;}}if(!enemy)continue;
   const target=enemy.getWorldPosition(new THREE.Vector3());const forward=target.clone().sub(origin);up.copy(origin).normalize();forward.addScaledVector(up,-forward.dot(up)).normalize();const right=new THREE.Vector3().crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();const worldQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));m.quaternion.copy(m.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
   animateArticulatedRobot(m,{time,state:'attack',braced:m.userData.robotType==='locust'});m.updateWorldMatrix(true,true);
   const muzzle=m.getObjectByName('robot-muzzle');const start=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):origin.clone().addScaledVector(up,2);
   if(time<state.next||dist>110)continue;const direction=target.clone().sub(start),length=direction.length();ray.set(start,direction.normalize());ray.far=length-.5;const blockers=base.userData.cameraOccludersNear?.(start,length)||[];if(ray.intersectObjects(blockers,false).length){state.next=time+.3;continue;}
   const kind=m.userData.robotType;state.next=time+ROBOT_RULES[kind].interval;weapons.burst(m,target,ROBOT_RULES[kind].shots);api.shotsFired+=ROBOT_RULES[kind].shots;
   if(enemy.userData.unitClass==='vanguard-trooper'){applyVanguardHit(enemy,kind==='ant'?'javelin':'arrow');}
   else{
    // Hull damage is separate from arrows: robot bullets must not sink Saihoji's whale.
    const h=enemy.userData;h.robotHullHealth=Math.max(0,(h.robotHullHealth??1800)-(kind==='ant'?100:kind==='locust'?72:45));h._hitImpulse=Math.min(1.6,(h._hitImpulse||0)+.4);
    if(h.robotHullHealth===0&&!isAircraftKnocked(enemy)){h.tranqFall={phase:'fall',t:0};h.robotHullHealth=450;h.robotMechanicalKnockdowns=(h.robotMechanicalKnockdowns||0)+1;}
   }
   // Retaliation only after this real hit; preserves the fleet's existing trigger rule.
   getAssault()?.onFleetUnderAttack?.(m);getAssault()?.designateTarget?.(m);
  }
 };
 api.snapshot=()=>({active:api.active,intruders:api.intruders,defenders:api.defenders,shotsFired:api.shotsFired,weaponEffects:{...weapons.stats}});return api;
}
