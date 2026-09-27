import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RobotLogistics} from '../../src/gameplay/robotOps/logistics.js';
import {RobotCombat} from '../../src/gameplay/robotOps/combat.js';
import {validateRobotOperationsSave} from '../../src/gameplay/robotOps/saveState.js';
function fixture(){const logistics=new RobotLogistics(),combat=new RobotCombat();logistics.update(270);logistics.dock('red','locust');logistics.update(24);logistics.dock('red','frontline');logistics.update(24);for(const u of logistics.units.filter(u=>u.status==='deployed'))combat.add({id:u.id,kind:u.kind,x:0,z:0});return{version:1,logistics:logistics.snapshot(),combat:combat.snapshot(),shipment:14,exerciseNumber:0,trains:[{variant:'red',progress:.4,lastStop:'frontline',dwell:3},{variant:'blue',progress:.5,lastStop:null,dwell:0}]};}
test('whole save preserves ownership, live trains and shipment together',()=>{const data=fixture(),validated=validateRobotOperationsSave(data);assert.equal(validated.combat.units.length,3);assert.equal(validated.shipment,14);assert.equal(validated.trains[0].progress,.4);});
test('reject broken train and cross-system references before touching a live scene',()=>{const data=fixture();for(const mutate of [s=>s.shipment=-1,s=>s.trains[0].progress=Infinity,s=>s.trains[0].lastStop='unknown',s=>s.trains[1].variant='red',s=>s.combat.units[0].id='LOC-9999',s=>s.combat.units[0].kind='ant']){const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateRobotOperationsSave(bad));}assert.equal(validateRobotOperationsSave(data).combat.units.length,3);});
test('reject missing or resurrected deployed identities and malformed repair orders',()=>{
 const data=fixture();
 for(const mutate of [s=>s.combat.units.shift(),s=>s.logistics.units.find(u=>u.id===s.combat.units[0].id).status='lost',s=>s.combat.units[0].hp=0,s=>s.combat.units[0].team='enemy',s=>s.combat.units[0].order={type:'retreat',x:null,z:12},s=>s.combat.units[0].order={type:'attack',id:null}]){
  const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateRobotOperationsSave(bad));
 }
 const damaged=structuredClone(data),u=damaged.combat.units[0];u.hp=500;damaged.logistics.units.find(l=>l.id===u.id).health=.5;
 assert.equal(validateRobotOperationsSave(damaged).combat.units[0].hp,500);
});
