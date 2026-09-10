import assert from 'node:assert/strict';
import {bindWarshipCohort} from '../../src/world/warshipCrewContinuity.js';
function fixture(offset) {
 const seated = new Map(), stored = new Map(), identity = new Map();
 const boat = {name: `ship-${offset}`, visible: true, userData:{warshipV6:{
  bindCrewIdentity:(i,v)=>identity.set(i,v), setCrewEmbarked:(i,v)=>seated.set(i,v),
  setCrewWeaponStored:(i,v)=>stored.set(i,v), render:()=>{},
 }}};
 const soldiers = Array.from({length:25},(_,i)=>({visible:true,userData:{uid:offset+i,phalanxRole:['spear','gladius','longbow'][i%3],hp:100-i}}));
 const cohort={visible:false};
 const state=bindWarshipCohort(boat,soldiers,cohort);
 return {boat,soldiers,cohort,state,seated,stored,identity};
}
const a=fixture(1),b=fixture(26),uids=[...a.soldiers,...b.soldiers].map(s=>s.userData.uid);
assert.equal(new Set(uids).size,50);
for(const f of [a,b]) {
 const refs=[...f.soldiers], hp=f.soldiers.map(s=>s.userData.hp);
 assert.equal(f.state.manifest.filter(s=>s.combatant).length,25);
 assert.equal(f.identity.get(25).combatant,false);
 assert(f.soldiers.every((s,i)=>!s.visible&&f.seated.get(i)&&f.stored.get(i)));
 f.state.disembark();
 assert(f.soldiers.every((s,i)=>s.visible&&!f.seated.get(i)&&!f.stored.get(i)));
 assert.equal(f.seated.get(25),true);
 f.state.embark();
 assert(f.soldiers.every((s,i)=>s===refs[i]&&!s.visible&&f.seated.get(i)&&f.stored.get(i)));
 assert.deepEqual(f.soldiers.map(s=>s.userData.hp),hp);
 f.state.disembark();
 f.soldiers[0].userData.dead=true;f.soldiers[0].visible=false;
 f.soldiers[1].userData.downed=true;
 f.state.embark();
 assert(!f.seated.get(0)&&!f.seated.get(1));
 assert.equal(f.soldiers[0].visible,false);assert.equal(f.soldiers[1].visible,true);
 assert.equal(f.cohort.visible,true);
 assert.equal(f.state.manifest[0].uid,refs[0].userData.uid);
 assert.equal(f.seated.get(25),true);
}
console.log('PASS: two ships, 50 unique persistent actors, seat/weapon ownership both directions, retained shipkeepers, no casualty resurrection. Hook contract fixture; physical boarding paths and actual model visuals are not asserted.');
