import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../vendor/three.module.js';
const source = readFileSync(new URL('../../src/world/saihojiPhalanx.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function soldier(flags = {}) {
  const s = new THREE.Group(); s.position.set(0, 20, 0);
  Object.assign(s.userData, flags); return s;
}
for (const phase of ['fight', 'return', 'siege', 'siegeNight', 'done']) {
  const wave = soldier(), garrisonActor = soldier(), reinforcement = soldier(), red = soldier(), patrol = soldier();
  const downed = soldier(), alive = soldier();
  const actors = [wave, garrisonActor, reinforcement, red, patrol];
  const root = new THREE.Group(); root.add(...actors, downed, alive);
  const presentationOrder = [];
  const context = vm.createContext({root, phase,
    redSoldiers: [red, wave], // duplicate references must not double-speed a corpse
    waves: [{soldiers: [wave, downed, alive]}], garrison: [{soldiers: [garrisonActor]}],
    castleReinforceShip: {soldiers: [reinforcement]}, trojanPatrol: [{s: patrol}],
    _tmp: new THREE.Vector3(), KILL_ARROW: 4, KILL_MELEE: 2, STAGGER_ARROW: 2, STAGGER_MELEE: 1,
    logEvent() {}, shipCarry: new Map(),
    updateSimulation() {presentationOrder.push('simulation'); return;},
    romanPresentation: {update() {presentationOrder.push('equipment');}},
    ambush: {applyConcealmentPose() {presentationOrder.push('concealment');}},
    refreshCampaignStatus() {presentationOrder.push('status');},
  });
  vm.runInContext(`${productionFunction('applySoldierDamage')}\n${productionFunction('updateCasualtyPresentation')}\n${productionFunction('update')}`, context);
  for (const s of actors) context.applySoldierDamage(s, 'pike');
  context.applySoldierDamage(downed, 'melee');
  context.update(.14, 0);
  assert(Math.abs(wave.userData._dieT - 3.56) < 1e-9, `${phase}: one timer tick per actor`);
  assert(actors.every(s => s.visible && s.rotation.z > 0), `${phase}: visible falling bodies`);
  context.update(.14, .14);
  assert(actors.every(s => Math.abs(s.rotation.z - 1.45) < 1e-9));
  assert(Math.abs(downed.rotation.z - .95) < 1e-9);
  for (let i = 0; i < 23; i++) context.update(.1, .28 + i * .1);
  assert(actors.every(s => s.visible && s.position.y === 20), `${phase}: bodies remain for 2.6-second hold`);
  context.update(.1, 2.58);
  assert(actors.every(s => s.visible && s.position.y < 20), `${phase}: sink before hiding`);
  for (let i = 0; i < 11; i++) context.update(.1, 2.68 + i * .1);
  assert(actors.every(s => !s.visible), `${phase}: every roster hides after 3.7 seconds`);
  assert.equal(downed.visible, true, `${phase}: living casualty is never hidden`);
  assert.equal(downed.userData.dead, undefined);
  assert.equal(downed.position.y, 20);
  assert.equal(alive.visible, true); assert.equal(alive.position.y, 20);
  assert.deepEqual(presentationOrder.slice(0, 4), ['simulation', 'equipment', 'concealment', 'status']);
  // A post-attack casualty restored from an older snapshot still finishes its timer.
  const recovered = soldier({dead: true, downed: true}); root.add(recovered);
  context.waves[0].soldiers.push(recovered);
  for (let i = 0; i < 38; i++) context.update(.1, 4 + i * .1);
  assert.equal(recovered.visible, false);
}
console.log('PASS: real damage and update wrapper progress casualties through fall/hold/sink/hide in all five phases; waves, garrison, reinforcement, red and patrol covered; duplicates tick once; living wounded preserved');
