import {isAircraftKnocked} from './tranquilizer.js';
/** Mechanical damage is independent of arrowHits, which controls the Saihoji whale story. */
export function applyFleetHullDamage(member,amount,{source='guardian-lightning',maxHealth=1800,recoveryHealth=450}={}){
 const owner=member?.userData?.batianFleetOwner;if(owner?.active&&owner.receiveHit){const handled=owner.receiveHit(member,amount);if(handled)return handled;}
 if(!member?.parent||member.userData?.kind!=='moebius-aircraft'||member.userData.dead||!Number.isFinite(amount)||amount<=0||isAircraftKnocked(member))return{accepted:false,damage:0,disabled:false};
 for(let p=member;p;p=p.parent)if(!p.visible)return{accepted:false,damage:0,disabled:false};
 const u=member.userData,before=Math.max(0,Number.isFinite(u.robotHullHealth)?u.robotHullHealth:maxHealth),health=Math.max(0,before-amount);
 u.robotHullHealth=health;u._hitImpulse=Math.min(1.6,(u._hitImpulse||0)+.4);u.lastHullDamage={source,amount:Math.min(amount,before),remaining:health};
 const disabled=health===0;
 if(disabled){
  u.tranqFall={phase:'fall',t:0};u.robotHullHealth=recoveryHealth;u.hullKnockdowns=(u.hullKnockdowns||0)+1;
  if(source==='robot-defense')u.robotMechanicalKnockdowns=(u.robotMechanicalKnockdowns||0)+1;
  const fg=u._forage;if(fg){if(fg.flower){fg.flower.userData.feeding=false;if(fg.flower.userData._feeder===member)fg.flower.userData._feeder=null;}Object.assign(fg,{mode:'cruise',t:0,flower:null,targetPos:null});}
 }
 return{accepted:true,damage:Math.min(amount,before),health,disabled,recoveryHealth:disabled?recoveryHealth:null};
}
