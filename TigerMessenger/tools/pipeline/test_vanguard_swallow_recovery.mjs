import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the production closure bodies with transport/render dependencies stubbed.
const source = readFileSync(new URL('../../src/world/vanguardAssault.js', import.meta.url), 'utf8');
function body(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }', start) + 4;
  return source.slice(start, end);
}
const actor = (flags = {}) => ({visible: true, userData: {...flags}});
function fixture(troopers, pods = []) {
  const squad = {visible: true, userData: {troopers}};
  const st = {phase: 'withdraw', withdrawT: 0, sawFleet: false, pods, haulers: [], hub: {lengthSq: () => 0}};
  const context = vm.createContext({squad, st, VANGUARD_ASSAULT: {withdrawTimeout: 45, withdrawChaseTimeout: 12},
    releasePods() {}, markSwept() {}, setSoccoRamp() {}, fleetAlive: () => false, fleetLeftStation: () => false});
  const helpers = source.slice(source.indexOf('  const troopersOf ='), source.indexOf('  const vanguardAlive ='));
  vm.runInContext(`${helpers}\n${body('updateWithdraw')}\n${body('finishMission')}\n${body('triggerWithdraw')}`, context);
  return {squad, st, withdraw: (dt) => context.updateWithdraw(dt), finish: () => context.finishMission(), triggerWithdraw: () => context.triggerWithdraw()};
}

// A swallowed transport passenger must keep extraction blocked, even while hidden.
{
  const swallowed = actor({swallowed: true}); swallowed.visible = false;
  const f = fixture([swallowed]);
  f.withdraw(60);
  assert.equal(f.st.phase, 'withdraw');
  assert.equal(swallowed.userData.aboard, undefined);
  assert.equal(f.st.withdrawT, 0);
  f.finish(); // watchdog path cannot abandon the whale-owned passenger
  assert.equal(f.st.phase, 'withdraw');
  assert.equal(f.squad.visible, true);
  swallowed.userData.swallowed = false; swallowed.visible = true; // whale finishExpel
  f.withdraw(1);
  assert.equal(f.st.phase, 'withdraw'); // receives the normal recovery window
  f.withdraw(45); // no transport in fixture: existing forced pickup fallback
  assert.equal(f.st.phase, 'extract');
  assert.equal(swallowed.userData.aboard, true);
  f.finish();
  assert.equal(f.st.phase, 'done');
  assert.equal(swallowed.visible, false);
}

// Pod ropes must not animate an actor whose position is owned by swallowing.
{
  const swallowed = actor({swallowed: true, vehicleSlot: {kind: 'pod'}});
  const rope = {visible: true};
  const pod = {state: 'recover', pod: {parent: {}}, troopers: [swallowed], ropes: [rope]};
  const f = fixture([swallowed], [pod]);
  f.withdraw(60);
  assert.equal(pod.state, 'waiting-for-whale');
  assert.equal(rope.visible, false);
  assert.equal(swallowed.userData.aboard, undefined);
  assert.equal(f.st.phase, 'withdraw');
}

// Visibility is not a roster: hidden living actors still need a boarded identity.
{
  const hidden = actor(); hidden.visible = false;
  const dead = actor({dead: true});
  const f = fixture([hidden, dead]);
  f.finish();
  assert.equal(hidden.userData.aboard, true);
  assert.equal(dead.userData.aboard, undefined);
  assert.equal(f.squad.visible, false);
  assert.equal(f.st.phase, 'done');
}
{
  const hidden = actor(); hidden.visible = false;
  const f = fixture([hidden]);
  f.withdraw(46);
  assert.equal(hidden.userData.aboard, true);
  assert.equal(f.st.phase, 'extract');
}
for (const phase of ['idle', 'approach', 'insert', 'combat', 'withdraw', 'extract', 'done']) {
  const f = fixture([]);
  f.st.phase = phase;
  f.triggerWithdraw();
  assert.equal(f.st.phase, ['approach', 'insert', 'combat'].includes(phase) ? 'withdraw' : phase);
}
console.log('PASS: swallowed passengers block extraction and watchdog completion, resume recovery after expulsion, pod ropes respect whale ownership, hidden survivors get boarded identity');
