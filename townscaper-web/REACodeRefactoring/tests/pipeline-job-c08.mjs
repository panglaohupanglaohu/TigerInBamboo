// r56 C08 · 1670064751181791233 job + shared-clock sleep: rhythm, stage order, shared control semantics
import assert from 'node:assert/strict';
import { runJob, CLIP_RHYTHM, JOB_STAGES, createJobControl, makeJobSleep, CTL } from '../src/terrain/pipeline-job-c08.js';
// 1) the clip's per-round rhythm (22.83 s, triangulate ≈ 31%)
const total = Object.values(CLIP_RHYTHM).reduce((a, b) => a + b, 0);
assert.ok(Math.abs(total - 22830) < 200, 'round = ' + total);
assert.ok(Math.abs(CLIP_RHYTHM.triangulate / total - 7.07 / 22.83) < .01);
// 2) runJob with a virtual clock: stage order, 4 rounds, sleep total = 4 rounds
let vt = 0; const log = [];
runJob({ post: (m) => log.push({ ...m, t: vt }), sleep: (ms) => { vt += ms; }, rounds: 4, count: 120 });
assert.ok(Math.abs(vt - 4 * total) < 1e-6, 'virtual time ' + vt);
const seq = log.filter((m, i) => i === 0 || m.stage !== log[i - 1].stage).map((m) => m.stage);
assert.deepEqual(seq, [...Array(4)].flatMap(() => JOB_STAGES).concat('done'));
const tri = log.filter((m) => m.stage === 'triangulate' && m.round === 0);
assert.ok(tri.length >= 100 && tri.at(-1).tris.length > tri[0].tris.length, 'mesh grows insertion by insertion');
assert.ok(tri.every((m, i) => !i || m.tris.length >= tri[i - 1].tris.length));
const lift = log.find((m) => m.stage === 'lift' && m.round === 0); assert.ok(Array.isArray(lift.H) && lift.H.some((h) => h > 0));
// 3) the shared control block: main writes, job sleep reads (here a non-shared buffer with a fake clock)
const c = createJobControl({ scale: .5 });
assert.equal(c.scale, .5); c.setScale(2); assert.equal(Atomics.load(c.ctl, CTL.SCALE), 2000);
assert.throws(() => c.setScale(-1));
let now = 0; const spin = makeJobSleep(c.ctl, { shared: false, now: () => (now += 1) });
const before = now; spin(10); assert.ok(now - before >= 20, 'scale 2 -> ~20 fake ms spent');
c.setScale(0); const b2 = now; spin(100); assert.equal(now, b2, 'scale 0 = no wait');
assert.throws(() => runJob({ post: () => {}, sleep: () => {}, rhythm: { ...CLIP_RHYTHM, clay: -1 } }));
console.log({ roundMs: total, posts: log.length, mode: c.mode });
console.log('PASS pipeline-job-c08');
