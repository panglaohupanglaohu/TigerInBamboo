import test from 'node:test';
import assert from 'node:assert/strict';
import {finishStartupSteps, runStartupSteps, createStartupProgress} from '../../src/core/startupTasks.js';

test('incremental construction preserves sync ordering and result while servicing queued tasks', async () => {
  const make = events => (function* () {
    yield 'terrain'; events.push('terrain');
    yield 'buildings'; events.push('buildings');
    yield 'routes'; events.push('routes');
    return {order: [...events]};
  })();
  const syncEvents = [], asyncEvents = [], ticks = [];
  const expected = finishStartupSteps(make(syncEvents));
  let ticksRun = 0;
  const timer = setInterval(() => ticksRun++, 1);
  try {
    const actual = await runStartupSteps(make(asyncEvents), async label => {
      ticks.push([label, asyncEvents.length]);
      await new Promise(resolve => setTimeout(resolve, 16));
    });
    assert.deepEqual(actual, expected);
    assert.deepEqual(ticks, [['terrain', 0], ['buildings', 1], ['routes', 2]]);
    assert.ok(ticksRun >= 3, 'event loop must run while the world is being constructed');
  } finally { clearInterval(timer); }
});

test('failure stays fatal and cannot publish later stages or a partial handle', async () => {
  const events = [];
  function* fail() {
    try { yield 'terrain'; events.push('terrain'); throw new Error('bad support'); }
    finally { events.push('cleanup'); }
  }
  await assert.rejects(runStartupSteps(fail(), async () => {}), /bad support/);
  assert.deepEqual(events, ['terrain', 'cleanup']);
  let closed = false;
  function* interrupted() { try { yield 'prepare'; } finally { closed = true; } }
  await assert.rejects(runStartupSteps(interrupted(), async () => { throw new Error('cancelled'); }), /cancelled/);
  assert.equal(closed, true);
});

test('startup progress persists active stage before work, records durations and completes once ready', async () => {
  let t = 0, saved, yielded = 0;
  const label = {}, panel = {hidden: false};
  const startup = createStartupProgress({
    document: {getElementById: id => id === 'startup-progress' ? panel : label},
    storage: {setItem: (_, value) => { saved = JSON.parse(value); }}, now: () => t,
    yieldTask: async () => { yielded++; t += 16; },
  });
  await startup.checkpoint('terrain'); t += 52;
  assert.equal(saved.current, 'terrain');
  await startup.checkpoint('city'); t += 71;
  assert.equal(saved.current, 'city');
  assert.equal(panel.hidden, false);
  startup.finish();
  assert.equal(yielded, 2);
  assert.deepEqual(saved.stages, [{label:'terrain', milliseconds:52}, {label:'city', milliseconds:71}]);
  assert.equal(saved.status, 'ready'); assert.equal(panel.hidden, true);
});
