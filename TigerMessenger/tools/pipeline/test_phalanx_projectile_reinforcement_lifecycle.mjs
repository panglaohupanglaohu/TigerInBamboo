import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../vendor/three.module.js';

// Run production closure bodies against real Three.js objects; no browser required.
const source = readFileSync(new URL('../../src/world/saihojiPhalanx.js', import.meta.url), 'utf8');
function productionFunction(name, indent = '  ') {
  const start = source.indexOf(`${indent}function ${name}(`);
  assert.ok(start >= 0, name);
  const ending = `\n${indent}}`;
  const end = source.indexOf(ending, start) + ending.length;
  return source.slice(start, end);
}
const root = new THREE.Group(), scene = new THREE.Scene(); scene.add(root);
const target = new THREE.Group(); target.position.x = 10; scene.add(target);
const archer = new THREE.Group(); root.add(archer);
const context = vm.createContext({THREE, root, scene, target, archer,
  isCitadelPaletteV3: () => false, clearCitadelShot: () => true,
  logEvent() {}, rand: () => .5, spawnSpark() {}, spawnSmoke() {},
  hubDir: () => new THREE.Vector3(0, 1, 0), vanguardAssault: null,
  newCityAssault: null, phase: 'fight', simT: 0, sparkPool: [], smokePool: [],
  _tmp: new THREE.Vector3(), _tmpB: new THREE.Vector3(), _sparkTmp: new THREE.Vector3(),
  _q: new THREE.Quaternion(), _axisX: new THREE.Vector3(1, 0, 0)});
vm.runInContext(`let _arrowShared = null;
${productionFunction('arrowShared', '')}
${productionFunction('makeArrow', '')}
const arrows = [makeArrow()]; let arrowI = 0; root.add(arrows[0]);
globalThis.arrow = arrows[0];
${productionFunction('fireArrow')}
${productionFunction('updateArrows')}`, context);
const arrow = context.arrow;
const physical = [];
arrow.traverse(o => {if (o.isMesh && !arrow.userData.tracers.includes(o)) physical.push(o);});
assert.equal(physical.length, 6);
assert.equal(arrow.userData.tracers.length, 5);
const originalChildren = arrow.children.slice();
for (let cycle = 0; cycle < 25; cycle++) {
  context.fireArrow(archer, target);
  assert.equal(arrow.parent, root, 'reused arrow returns to flight root');
  assert.equal(arrow.userData.stuck, false);
  assert(arrow.userData.tracers.every(o => o.visible), 'relaunch restores flight trails');
  context.updateArrows(1.2);
  assert.equal(arrow.parent, target, 'physical arrow stays embedded in target');
  assert.equal(arrow.userData.stuck, true);
  assert.equal(arrow.visible, true);
  assert(physical.every(o => o.visible), 'all six physical meshes survive impact');
  assert(arrow.userData.tracers.every(o => !o.visible), 'all five trails stop on impact');
  assert.equal(target.userData.arrowHits, cycle + 1, 'damage accounting survives pooling');
  context.updateArrows(.1);
  assert(arrow.userData.tracers.every(o => !o.visible), 'embedded arrow does not reignite');
  assert.deepEqual(arrow.children, originalChildren, 'reuse does not create geometry or objects');
}

// Repeated real raid entry calls marchGarrisonTo, which must retain the same mission.
const boat = new THREE.Group(), cohort = new THREE.Group(); root.add(boat, cohort);
const injured = {userData: {dead: false, downed: true, arrowHits: 3}};
const dead = {userData: {dead: true, arrowHits: 4}};
const ship = {boat, cohort, soldiers: [injured, dead], arrived: false, u: .4, attackTimer: .7};
const originalRoster = JSON.stringify(ship.soldiers);
const allocationAttempt = new Error('new mission allocation');
let allocations = 0;
const mission = vm.createContext({root, ship, garrison: [], logEvent() {},
  createFisherBoat() {allocations++; throw allocationAttempt;}});
const marchStart = source.indexOf('  root.userData.marchGarrisonTo = function (dir) {');
const marchEnd = source.indexOf('\n  };', marchStart) + 5;
vm.runInContext(`let castleReinforceShip = ship; let reinforceWaveCounter = 1;
${productionFunction('spawnCastleReinforcementWarship')}
${source.slice(marchStart, marchEnd)}`, mission);
const beforeChildren = root.children.slice();
for (const arrived of [false, true]) {
  ship.arrived = arrived;
  for (let i = 0; i < 100; i++) assert.equal(root.userData.marchGarrisonTo(new THREE.Vector3(0, 1, 0)), ship);
}
assert.equal(allocations, 0, 'arrived mission is not overwritten by raid re-entry');
assert.deepEqual(root.children, beforeChildren, 'no abandoned boats/cohorts accumulate');
assert.equal(JSON.stringify(ship.soldiers), originalRoster, 'injuries and deaths are preserved');
assert.equal(ship.u, .4); assert.equal(ship.attackTimer, .7);
vm.runInContext('castleReinforceShip = null', mission);
assert.throws(() => root.userData.marchGarrisonTo(new THREE.Vector3()), error => error === allocationAttempt);
assert.equal(allocations, 1, 'allocation remains reachable when no mission exists');
console.log('PASS: 25 real arrow hit/relaunch cycles retain physical arrows and damage, stop/restart five trails; 200 raid alarms retain one reinforcement mission and wounded/dead roster; absent mission still allocates');
