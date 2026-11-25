/* 906207980802252801 · 雾片模拟的口径：流速档（0 冻结 / 2 双倍）、回卷、绕行、只读账 */
import assert from 'node:assert/strict';
import { makeFogWisps, wispStats } from '../src/core/fog-envelope.js';

// 均匀风（+x），无遮挡：位移 == speed × rate × dt
const wind = () => [1, 0, 0];
const free = makeFogWisps({ count: 3, radius: 40, inner: 4, seed: 7 });
const home = free.wisps.map((m) => [m.x, m.z]);
for (let i = 0; i < 20; i++) free.step(.05, wind, () => false, 0, 0);
assert.deepEqual(free.wisps.map((m) => [m.x, m.z]), home, 'rate 0 must freeze every sheet');

const one = makeFogWisps({ count: 3, radius: 40, inner: 4, seed: 7 });
const org = one.wisps.map((m) => [m.x, m.z]);
for (let i = 0; i < 20; i++) one.step(.05, wind, () => false, 0, 1);
const d1 = one.wisps.map((m, k) => m.x - org[k][0]);
assert.ok(d1.every((d) => d > 0), 'sheets must move downwind');

const two = makeFogWisps({ count: 3, radius: 40, inner: 4, seed: 7 });
for (let i = 0; i < 20; i++) two.step(.05, wind, () => false, 0, 2);
const d2 = two.wisps.map((m, k) => m.x - org[k][0]);
for (let k = 0; k < 3; k++) assert.ok(Math.abs(d2[k] / d1[k] - 2) < 1e-9, 'rate 2 must be exactly 2x');

assert.throws(() => free.step(.05, wind, () => false, 0, -1), /fog rate/);
assert.throws(() => free.step(.05, wind, () => false, 0, 3), /fog rate/);
assert.throws(() => free.step(-1, wind, () => false, 0, 1), /fog step/);

// 正前方（+x）实心、侧向空 → 应侧向绕行（detours），而不是硬顶进去
const blocked = makeFogWisps({ count: 1, radius: 30, inner: 4, seed: 2 });
const b0 = [blocked.wisps[0].x, blocked.wisps[0].z];
const wall = (x, y, z) => x > blocked.wisps[0].x + 1e-6;
for (let i = 0; i < 10; i++) blocked.step(.1, wind, wall, 0, 1);
assert.ok(blocked.wisps[0].detours > 0, 'blocked sheet must detour');
assert.ok(blocked.wisps[0].x <= b0[0] + 1e-9, 'detour must not push into the wall');
assert.ok(Math.hypot(blocked.wisps[0].x - b0[0], blocked.wisps[0].z - b0[1]) > 0, 'detour moves on screen');

// 四面八方都实心 → 停等（blocked）计数，位置不动
const stuck = makeFogWisps({ count: 1, radius: 30, inner: 4, seed: 2 });
const s0 = [stuck.wisps[0].x, stuck.wisps[0].z];
for (let i = 0; i < 5; i++) stuck.step(.1, wind, () => true, 0, 1);
assert.equal(stuck.wisps[0].blocked, 5, 'fully blocked sheet waits (no silent teleport)');
assert.deepEqual([stuck.wisps[0].x, stuck.wisps[0].z], s0);

// 一路吹出环带 → 回卷计数并回到内圈
const wrap = makeFogWisps({ count: 2, radius: 8, inner: 2, seed: 3 });
for (let i = 0; i < 400; i++) wrap.step(.2, wind, () => false, 1, 1);
assert.ok(wrap.wisps.every((m) => m.wraps > 0), 'sheets must wrap inside the ring');
assert.ok(wrap.wisps.every((m) => Math.hypot(m.x - 0, m.z) <= wrap.radius + 1e-9), 'wrap keeps radius');

const st = wispStats(wrap);
assert.equal(st.count, 2);
assert.ok(st.aspect > 0 && st.aspect < .5, 'sheets are flat cards');
assert.ok(st.maxY >= st.minY && st.meanY >= st.minY && st.meanY <= st.maxY);
assert.ok(st.wraps >= 2 && Number.isFinite(st.meanSize));
assert.throws(() => wispStats({ wisps: [] }), /fog wisps/);
console.log('PASS fog wisps: rate 0 freezes, rate 2 doubles, detour + wrap counted, flat-card census');
