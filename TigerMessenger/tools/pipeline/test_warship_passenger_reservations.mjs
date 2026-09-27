import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {bindWarshipCohort} from '../../src/world/warshipCrewContinuity.js';
const scene = new THREE.Scene();
let serial = 0;
function actor(flags = {}) {
  const s = new THREE.Group();
  const weapon = new THREE.Group(); s.add(weapon);
  s.userData = {uid:++serial, phalanxRole:'spear', hp:63, equipment:{spear:weapon}, ...flags};
  scene.add(s); return s;
}
function fixture(count, name) {
  const boat = new THREE.Group(); boat.name = name; scene.add(boat);
  const cohort = new THREE.Group(); scene.add(cohort);
  const seats = new Map(), identities = new Map();
  boat.userData.warshipV6 = {bindCrewIdentity(i,v) {assert(v); identities.set(i,v);},
    setCrewEmbarked:(i,v) => seats.set(i,v), setCrewWeaponStored() {}, render() {}};
  const soldiers = Array.from({length:count}, () => actor()); soldiers.forEach(s => cohort.attach(s));
  const controller = bindWarshipCohort(boat,soldiers,cohort);
  return {boat,cohort,soldiers,controller,seats,identities};
}
const a = fixture(9,'nine-person-ship'), b = fixture(0,'empty-ship');
const oldActors = [...a.soldiers], oldEntries = a.controller.manifest.slice(0,9);
const keeper = a.controller.manifest[25];
assert.equal(keeper.role,'shipkeeper'); assert.equal(keeper.seat,25);
assert.equal(a.controller.manifest[9],undefined);
assert.equal(bindWarshipCohort(a.boat, [], a.cohort),a.controller,'repeated bind does not reset roster');
const patient = actor({downed:true, arrowHits:2}), escort = actor();
const originalPatientPose = patient.matrix.clone();
const p = a.controller.reservePassenger(patient), e = a.controller.reservePassenger(escort);
assert(p.ok && p.created); assert.equal(p.seat,9); assert.equal(e.seat,10);
assert.equal(a.controller.reservePassenger(patient).created,false);
assert.equal(b.controller.reservePassenger(patient).reason,'already-reserved');
const duplicateUid = actor({uid:patient.userData.uid});
assert.equal(b.controller.reservePassenger(duplicateUid).reason,'already-reserved');
assert.equal(patient.visible,true); assert.equal(patient.userData.embarked,undefined);
assert(patient.matrix.equals(originalPatientPose));
assert.equal(a.controller.getPassenger(patient.userData.uid).actor,patient);
a.controller.embark();
assert.equal(patient.userData.embarked,undefined,'legacy bulk embark cannot submit reserved passengers');
assert.equal(a.controller.setStage(e.seat,'seated'),false,'legacy stage API cannot bypass physical proof');
assert.equal(a.controller.releaseReservation(a.soldiers[0].userData.uid).ok,false);
a.soldiers[0].userData.dead=true;
assert.equal(a.controller.releaseReservation(a.soldiers[0].userData.uid).ok,false,'original roster never released by reservation rollback');
a.soldiers[0].userData.dead=false;
function proof(s, reservation, extra = {}) {
  return {boat:a.boat, uid:s.userData.uid, seat:reservation.seat,
    routeValidated:true, gangplankCrossed:true, deckSupported:true, seatSupported:true,
    seatWorldPosition:s.getWorldPosition(new THREE.Vector3()), ...extra};
}
assert.equal(a.controller.commitBoarding(patient.userData.uid,{}).ok,false);
assert.equal(a.controller.commitBoarding(patient.userData.uid,proof(patient,p,{seatWorldPosition:new THREE.Vector3(9,0,0)})).reason,'seat-not-reached');
assert.equal(a.controller.commitBoarding(patient.userData.uid,proof(patient,p)).reason,'missing-escort');
assert.equal(a.controller.commitBoarding(patient.userData.uid,proof(patient,p,{assisted:true,escortUid:escort.userData.uid,escortActor:patient})).reason,'missing-escort');
escort.userData.dead=true;
assert.equal(a.controller.commitBoarding(patient.userData.uid,proof(patient,p,{assisted:true,escortUid:escort.userData.uid,escortActor:escort})).reason,'missing-escort');
escort.userData.dead=false;
patient.position.set(1,2,3); patient.rotation.z=.95;
const before = patient.getWorldPosition(new THREE.Vector3()), beforeQ = patient.getWorldQuaternion(new THREE.Quaternion());
assert(a.controller.commitBoarding(patient.userData.uid,proof(patient,p,{assisted:true,escortUid:escort.userData.uid,escortActor:escort})).ok);
assert.equal(patient.parent,a.boat); assert.equal(patient.visible,true);
assert.equal(patient.userData.downed,true); assert.equal(patient.userData.arrowHits,2); assert.equal(patient.userData.hp,63);
assert(patient.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-9);
assert(patient.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeQ)<1e-7);
assert.equal(a.seats.get(p.seat),false,'wounded actor never duplicates a healthy rower');
assert.equal(a.controller.manifest[p.seat].embarked,true);
a.controller.embark(); a.controller.disembark();
assert.equal(patient.userData.embarked,true,'legacy calls do not undo assisted boarding');
assert.equal(patient.visible,true);
assert.equal(a.controller.releaseReservation(patient.userData.uid).ok,false);
assert(a.controller.commitBoarding(escort.userData.uid,proof(escort,e)).ok);
assert.equal(escort.visible,false); assert.equal(a.seats.get(e.seat),true);
const extras=[];
while (a.controller.manifest.filter(entry => entry?.combatant).length < 25) {
  const s=actor(); assert(a.controller.reservePassenger(s).ok); extras.push(s);
}
assert.equal(a.controller.reservePassenger(actor()).reason,'capacity');
assert.equal(a.controller.manifest[25],keeper); assert.equal(a.seats.get(25),true);
assert.deepEqual(a.soldiers,oldActors,'original caller roster is not extended/rebound');
assert(oldEntries.every((entry,i)=>a.controller.manifest[i]===entry));
const cancelled=extras.pop(); const oldSeat=a.controller.getPassenger(cancelled.userData.uid).entry.seat;
assert(a.controller.releaseReservation(cancelled.userData.uid).ok);
assert.equal(a.controller.getPassenger(cancelled.userData.uid),null);
assert.equal(cancelled.visible,true); assert.equal(cancelled.userData.hp,63);
assert(b.controller.reservePassenger(cancelled).ok,'rollback releases cross-ship ownership');
assert.equal(a.controller.reservePassenger(actor()).seat,oldSeat);
assert.equal(a.controller.reservePassenger(actor({dead:true})).reason,'dead-passenger');
const disposable=fixture(0,'disposable'); const transferable=actor();
assert(disposable.controller.reservePassenger(transferable).ok);
disposable.controller.dispose(); disposable.controller.dispose();
assert.equal(disposable.controller.reservePassenger(actor()).reason,'disposed');
assert.equal(disposable.controller.commitBoarding(transferable.userData.uid,{}).reason,'disposed');
assert(b.controller.reservePassenger(transferable).ok,'mission disposal frees UID ownership');
const rebound=bindWarshipCohort(disposable.boat,[],disposable.cohort);
const reboundPassenger=actor(); assert(rebound.reservePassenger(reboundPassenger).ok);
disposable.controller.dispose();
assert.equal(bindWarshipCohort(disposable.boat,[],disposable.cohort),rebound,'old dispose cannot remove new binding');
assert.equal(disposable.controller.reservePassenger(reboundPassenger).reason,'disposed');
assert.equal(disposable.controller.releaseReservation(reboundPassenger.userData.uid).reason,'disposed');
assert.equal(disposable.controller.getPassenger(reboundPassenger.userData.uid),null);
assert.equal(disposable.controller.setStage(0,'ashore'),false);
assert.equal(disposable.controller.embark(),false);
assert.equal(disposable.controller.disembark(),false);
assert.equal(b.controller.reservePassenger(reboundPassenger).reason,'already-reserved','old controller cannot steal new claim');
console.log('PASS: fixed 25+keeper seats, preserved original roster, capacity, created/rollback, cross-ship UID exclusion, physical proof rejection, real assisted actor follows boat without healing or healthy-rower replacement');
