import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {bindWarshipCohort} from '../../src/world/warshipCrewContinuity.js';
import {createWarshipEvacuationPlan} from '../../src/world/warshipEvacuationPlan.js';
const unit=(uid,downed=false)=>({userData:{uid,downed},visible:true});
function fleet(capacities) {
  const owners=new Map();
  return capacities.map((free,index)=>{
    const reservations=new Map(),name=`ship-${index}`;
    return {boat:{name},reservations,crewContinuity:{
      reservePassenger(actor){
        const uid=actor.userData.uid;
        if(owners.has(uid)&&owners.get(uid)!==name)return {ok:false,reason:'another-ship'};
        if(reservations.has(uid))return {ok:true,uid,seat:reservations.get(uid),created:false};
        if(reservations.size>=free)return {ok:false,reason:'full'};
        const seat=25-free+reservations.size;
        reservations.set(uid,seat);owners.set(uid,name);return {ok:true,uid,seat,created:true};
      },
      releaseReservation(uid){owners.delete(uid);return {ok:reservations.delete(uid)};},
    }};
  });
}
const actors=Array.from({length:15},(_,i)=>unit(i,i===0));
actors[0].userData.garrisonRetreat={escortedBy:1};
const before=JSON.stringify(actors),boats=fleet([0,0,16]);
const plan=createWarshipEvacuationPlan({boats,actors});
assert.equal(plan.entries.size,15);assert.equal(plan.snapshot().waiting.length,0);
assert.equal(plan.entries.get(0).ship,plan.entries.get(1).ship);
assert([...plan.entries.values()].every(e=>e.seat<25));
assert.equal(JSON.stringify(actors),before);assert.equal(plan.snapshot().boardingComplete,false);
const again=createWarshipEvacuationPlan({boats,actors});
again.releaseUnboarded();assert.equal(boats[2].reservations.size,15,'retry cannot release original reservations');
plan.releaseUnboarded();assert.equal(boats[2].reservations.size,0);
const split=fleet([1,1]),pair=actors.slice(0,2);
const short=createWarshipEvacuationPlan({boats:split,actors:pair});
assert.equal(short.entries.size,0);assert(split.every(b=>b.reservations.size===0),'pair failure must roll back only new reservations');
assert.equal(short.snapshot().waiting[0].reason,'awaiting-available-transport');
const deadEscort=unit(99);deadEscort.userData.dead=true;
const patient=unit(98,true);patient.userData.garrisonRetreat={escortedBy:99};
const rejected=createWarshipEvacuationPlan({boats:fleet([25]),actors:[patient,deadEscort]});
assert.equal(rejected.entries.size,0);assert.equal(rejected.snapshot().waiting[0].reason,'needs-escort');
const p2=unit(2,true);p2.userData.garrisonRetreat={escortedBy:1};
const shared=createWarshipEvacuationPlan({boats:fleet([25]),actors:[...pair,p2]});
assert.equal(shared.entries.size,2);assert.equal(shared.snapshot().waiting[0].reason,'needs-escort');
assert.throws(()=>createWarshipEvacuationPlan({boats:[],actors:[unit(1),unit(1)]}),/Conflicting/);
console.log(JSON.stringify({passed:true,cases:['15 passengers on 16 free seats','patient-escort same boat','no actor state mutation','captain protected','idempotent retry','pair capacity rollback','dead escort rejected','shared escort rejected','duplicate UID rejected'],scope:'Reservation planner only; no physical route or actual boarding claim'}));

// Integration against the production identity module (real Object3D actors).
const scene=new THREE.Scene();let serial=1000;
function actualActor(downed=false){const a=new THREE.Group();a.userData={uid:serial++,phalanxRole:'spear',downed};scene.add(a);return a;}
const realBoats=[25,25,9].map((count,index)=>{
 const boat=new THREE.Group();boat.name=`actual-${index}`;scene.add(boat);
 const cohort=new THREE.Group();scene.add(cohort);
 const soldiers=Array.from({length:count},()=>actualActor());soldiers.forEach(a=>cohort.attach(a));
 return {boat,soldiers,crewContinuity:bindWarshipCohort(boat,soldiers,cohort)};
});
const extras=Array.from({length:15},(_,i)=>actualActor(i===0));
extras[0].userData.garrisonRetreat={escortedBy:extras[1].userData.uid};
const actual=createWarshipEvacuationPlan({boats:realBoats,actors:extras});
assert.equal(actual.entries.size,15);assert.equal(actual.snapshot().waiting.length,0);
assert([...actual.entries.values()].every(e=>e.ship===realBoats[2]));
assert.equal(realBoats[2].soldiers.length,9);assert.equal(realBoats[2].crewContinuity.manifest[25].role,'shipkeeper');
assert(extras.every(a=>a.visible&&!a.userData.embarked&&a.parent===scene));
const retry=createWarshipEvacuationPlan({boats:realBoats,actors:extras});retry.releaseUnboarded();
assert(extras.every(a=>realBoats[2].crewContinuity.getPassenger(a.userData.uid)));
actual.releaseUnboarded();assert(extras.every(a=>!realBoats[2].crewContinuity.getPassenger(a.userData.uid)));
const paired=createWarshipEvacuationPlan({boats:realBoats,actors:extras.slice(0,2)});
const passenger=paired.entries.get(extras[0].userData.uid),continuity=realBoats[2].crewContinuity;
assert(continuity.commitBoarding(extras[0].userData.uid,{
 boat:realBoats[2].boat,uid:extras[0].userData.uid,seat:passenger.seat,routeValidated:true,
 gangplankCrossed:true,deckSupported:true,seatSupported:true,seatWorldPosition:extras[0].getWorldPosition(new THREE.Vector3()),
 assisted:true,escortUid:extras[1].userData.uid,escortActor:extras[1]
}).ok);
paired.releaseUnboarded();
assert(continuity.getPassenger(extras[1].userData.uid),'cannot cancel escort seat after patient is aboard');
assert.equal(paired.entries.size,2);
realBoats.forEach(b=>b.crewContinuity.dispose());
console.log(JSON.stringify({passed:true,scope:'Production identity API + allocator integration',originalPassengers:59,extraPassengers:15,actorsMoved:0,boardingClaim:false}));
