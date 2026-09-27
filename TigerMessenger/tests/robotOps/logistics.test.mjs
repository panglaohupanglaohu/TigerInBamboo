import{test}from'node:test';import assert from'node:assert/strict';import{RobotLogistics}from'../../src/gameplay/robotOps/logistics.js';
test('three same-type completed units, continuous cargo slots, capacity and no duplication',()=>{const m=new RobotLogistics();m.update(180);assert.equal(m.dock('red','locust'),false);m.update(90);assert.equal(m.factoryStock('locust').length,3);assert.equal(m.dock('red','locust'),true);assert.equal(m.dock('blue','locust'),false);m.update(24);assert.equal(m.isHolding('red'),false);assert.equal(m.trains.red.slots.filter(Boolean).length,3);assert.equal(m.dock('red','ant'),true);m.update(24);assert.equal(m.dock('red','beetle'),true);assert.equal(m.dock('blue','beetle'),false);m.update(24);m.assertInvariants();assert.equal(m.dock('red','frontline'),true);m.update(72);assert.equal(m.units.filter(u=>u.status==='deployed').length,9);assert.equal(m.trains.red.slots.filter(Boolean).length,0);assert.equal(m.units.length,9);m.assertInvariants();});
test('save during吊装 recovers same identities and no duplicate load',()=>{const m=new RobotLogistics();m.update(270);m.dock('red','ant');m.update(12);const ids=m.units.map(u=>u.id);const restored=new RobotLogistics(m.snapshot());assert.deepEqual(restored.units.map(u=>u.id),ids);restored.update(16);assert.equal(restored.units.filter(u=>u.status==='transit').length,3);restored.assertInvariants();});
test('cancellation retains loaded cargo, frees reserved cargo, invalid dt ignored',()=>{const m=new RobotLogistics();m.update(270);m.dock('red','beetle');m.update(9);m.cancelJob('red');assert.equal(m.factoryStock('beetle').length,2);assert.equal(m.trains.red.slots.filter(Boolean).length,1);const t=m.time;m.update(NaN);m.update(-1);assert.equal(m.time,t);m.assertInvariants();});
test('three sequential batches survive round trip and replenish',()=>{const m=new RobotLogistics();for(let i=0;i<3;i++){if(i)m.receive('locust',3);m.update(270);assert.equal(m.dock('red','locust'),true);m.update(24);m.dock('red','frontline');m.update(24);m.assertInvariants();}assert.equal(m.units.filter(u=>u.kind==='locust'&&u.status==='deployed').length,9);assert.equal(new Set(m.units.map(u=>u.id)).size,m.units.length);});

test('shared crane serializes two trains without duplication or concurrent吊装',()=>{
 const l=new RobotLogistics();l.receive('locust',3);l.update(541);assert(l.dock('red','locust'));assert(l.dock('blue','locust'));l.update(1);assert.equal(l.units.filter(u=>u.status==='loading').length,1);l.update(48);assert.equal(l.units.filter(u=>u.kind==='locust'&&u.status==='transit').length,6);assert(l.assertInvariants());
});

test('corrupt save is rejected atomically without changing current production',()=>{
 const m=new RobotLogistics();m.update(270);const baseline=m.snapshot();
 for(const mutate of [s=>s.units[0].status='invented',s=>s.serial=0,s=>s.factories.locust.kits=-1,s=>s.trains.red.slots[0]='LOC-0001',s=>s.factories.locust.active='ANT-0002']){
  const bad=structuredClone(baseline);mutate(bad);assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),baseline);
 }
 m.dock('red','locust');m.update(24);m.dock('red','frontline');m.update(10);const mid=m.snapshot(),n=new RobotLogistics(mid);n.update(24);assert.equal(n.units.filter(u=>u.status==='deployed').length,3);assert(n.assertInvariants());
});

test('tall receiving gantry uses its slower unloading duration without releasing a moving robot',()=>{
 const l=new RobotLogistics();l.handlingSeconds=12;l.unloadingSeconds=20;l.update(270);l.dock('red','locust');l.update(36);assert.equal(l.units.filter(u=>u.status==='transit').length,3);l.dock('red','frontline');l.update(19);assert.equal(l.units.filter(u=>u.status==='deployed').length,0);assert(l.isHolding('red'));l.update(41);assert.equal(l.units.filter(u=>u.status==='deployed').length,3);assert.equal(l.isHolding('red'),false);l.assertInvariants();
});

test('parallel factories reach the 24-unit cap only in complete shippable batches',()=>{
 let l=new RobotLogistics();for(const kind of ['locust','ant','beetle'])l.receive(kind,9);
 for(let pass=0;pass<4;pass++){
  l.update(270);
  if(pass===1)l=new RobotLogistics(l.snapshot());
  for(const kind of ['locust','ant','beetle'])while(l.dock('red',kind)){l.update(24);assert(l.dock('red','frontline'));l.update(24);l.assertInvariants();}
 }
 assert.equal(l.units.length,24);assert.equal(l.units.filter(u=>u.status==='deployed').length,24);
 for(const kind of ['locust','ant','beetle'])assert.equal(l.units.filter(u=>u.kind===kind).length%3,0);
 assert.equal(l.units.filter(u=>['ready','assembly'].includes(u.status)).length,0);
 const lost=l.units.slice(0,3);for(const u of lost)assert(l.markLost(u.id));l.update(270);
 assert.equal(l.units.filter(u=>u.status!=='lost').length,24);assert.equal(l.units.filter(u=>u.status==='ready').length,3);l.assertInvariants();
});

 test('six-slot saves expand without changing existing cargo identities',()=>{const l=new RobotLogistics();l.update(270);l.dock('red','ant');l.update(24);const s=l.snapshot();for(const t of Object.values(s.trains))t.slots.length=6;const loaded=new RobotLogistics(s);assert.equal(loaded.trains.red.slots.length,9);assert.deepEqual(loaded.trains.red.slots.slice(0,6),s.trains.red.slots);loaded.assertInvariants();});
