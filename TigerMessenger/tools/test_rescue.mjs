import assert from 'node:assert/strict';
import { RESCUE_CHAPTERS, restoreRescueState, advanceRescue } from '../src/story/rescueState.js';
const state = restoreRescueState(null);
assert.equal(advanceRescue(state, { target: 'tiger', distance: 0 }), false, 'cannot skip ahead');
assert.equal(advanceRescue(state, { target: 'bookshop', distance: NaN }), false);
assert.equal(advanceRescue(state, { target: 'bookshop', distance: 9.1 }), false);
assert.equal(advanceRescue(state, { target: 'bookshop', distance: 1, riding: true }), false);
for (const chapter of RESCUE_CHAPTERS) {
  assert.equal(advanceRescue(state, { target: chapter.target, distance: 2 }), true);
  assert.deepEqual(restoreRescueState(JSON.parse(JSON.stringify(state))), state);
}
assert.equal(state.rescuedFox && state.rescuedTiger, true);
assert.equal(advanceRescue(state, { target: 'citadel', distance: 0 }), false);
assert.equal(restoreRescueState({ chapter: -4 }).chapter, 0);
assert.equal(restoreRescueState({ chapter: Infinity }).chapter, 0);
console.log('RESCUE_RULES_OK: ordered progression, range, vehicle gate, persistence, completion');
