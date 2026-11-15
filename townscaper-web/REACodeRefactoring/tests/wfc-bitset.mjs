// 第 56 批 C05：794993371261665280（位运算让 3D WFC 变快，实速录屏）/ 797844857821732864（少用位掩码再快 20~30%）。
// 断言：三档引擎 × 两种回溯与 multitile-wfc 逐格同解；797 档确定性地少做位或、回溯不复制位掩码数组；
// 回放事件折算后的终态 = 解；spine 选格先立中轴细柱；计时只要求位运算明显快于基线，797 相对 794 只报告。
import assert from 'node:assert/strict';
import { solveBitset, benchEngines, replayState, compileRules, popcount32, WFC_CONFIGS, WFC_ENGINES } from '../src/build/wfc-bitset.js';
import { solveMultitile, validateMultitile } from '../src/build/multitile-wfc.js';

const rules = compileRules();
assert.equal(popcount32(0), 0); assert.equal(popcount32(0xffffffff), 32); assert.equal(popcount32(0b1011), 3);
assert.ok(rules.P <= 32 && rules.words === 1, '默认构件 27 部件一个字放得下');
// 位集支持表与布尔表一致
for (let d = 0; d < 6; d++) for (let p = 0; p < rules.P; p++) for (let q = 0; q < rules.P; q++) assert.equal((rules.sup[d][p][0] >>> q) & 1, rules.compat[d][p][q]);

let checked = 0, withBacktrack = 0;
for (const size of [[5, 6, 5], [4, 8, 4], [6, 10, 6]]) for (const seed of [1, 2, 3, 5, 8, 13]) {
  const ref = solveMultitile({ size, seed });
  const runs = [];
  for (const engine of WFC_ENGINES) for (const undo of ['snapshot', 'trail']) runs.push(solveBitset({ size, seed, engine, undo, rules }));
  for (const r of runs) {
    assert.equal(r.ok, ref.ok, `${size} s${seed} ${r.engine}/${r.undo} 可解性一致`);
    if (!ref.ok) continue;
    assert.deepEqual([...r.grid], [...ref.grid], `${size} s${seed} ${r.engine}/${r.undo} 与 solveMultitile 逐格同解`);
    assert.equal(r.stats.backtracks, ref.stats.backtracks);
    checked++;
  }
  if (ref.ok) { assert.deepEqual(validateMultitile(runs[0]), []); if (ref.stats.backtracks) withBacktrack++; }
}
assert.ok(checked >= 100, '同解检查条数');

// 回溯路径：默认构件几乎不矛盾，另造一套「空气 + 只有多格 hall/tower」的部件（没有单格 room 补缝，多格块会撞）
import { buildParts, DEFAULT_TILES } from '../src/build/multitile-wfc.js';
const hard = buildParts(DEFAULT_TILES.filter((t) => ['hall', 'tower'].includes(t.id))), hardRules = compileRules(hard);
for (const [size, seed] of [[[5, 4, 5], 33], [[3, 5, 3], 22], [[3, 5, 3], 33]]) {
  const ref = solveMultitile({ size, seed, parts: hard, maxBacktracks: 5000 });
  assert.ok(ref.ok && ref.stats.backtracks > 0, '确实发生回溯');
  for (const engine of WFC_ENGINES) for (const undo of ['snapshot', 'trail']) {
    const r = solveBitset({ size, seed, engine, undo, rules: hardRules, record: true, maxBacktracks: 5000 });
    assert.ok(r.ok); assert.deepEqual([...r.grid], [...ref.grid], `回溯后 ${engine}/${undo} 仍与 solveMultitile 同解`);
    assert.ok(r.events.some((e) => e.type === 'restore'), '事件里有回溯');
    const fin = replayState(r, r.events.length);
    for (let i = 0; i < fin.counts.length; i++) { assert.equal(fin.counts[i], 1); assert.equal(fin.parts[i], r.grid[i]); }
    withBacktrack++;
  }
}

// 确定性工作量：797 档少做位或、零快照复制；基线快照复制最多
const work = Object.fromEntries(Object.entries(WFC_CONFIGS).map(([n, c]) => [n, solveBitset({ size: [8, 12, 8], seed: 3, rules, ...c }).stats]));
assert.equal(work.baseline.maskOps, 0);
assert.ok(work.fewerMasks797.maskOps < work.bitwise794.maskOps * 0.6, `缓存支持并集后位或次数 ${work.fewerMasks797.maskOps} < 0.6×${work.bitwise794.maskOps}`);
assert.equal(work.fewerMasks797.copiedBytes, 0, '改写记录回溯不复制位掩码数组');
assert.ok(work.fewerMasks797.trailBytes < work.bitwise794.copiedBytes / 4, '改写记录峰值远小于快照复制量');
assert.ok(work.bitwise794.copiedBytes < work.baseline.copiedBytes / 3, '位集域比 Uint8 域小（每格 1 字 vs 27 字节）');

// 回放：终态 = 解；黄格非空；无回溯时实体格数单调不减
for (const pick of ['entropy', 'spine']) {
  const r = solveBitset({ size: [6, 10, 6], seed: 2, pick, record: true, rules, engine: 'cached', undo: 'trail' });
  const fin = replayState(r, r.events.length);
  assert.ok(fin.done);
  for (let i = 0; i < fin.counts.length; i++) { assert.equal(fin.counts[i], 1); assert.equal(fin.parts[i], r.grid[i]); }
  let prev = -1;
  for (let k = 1; k <= r.events.length; k += 7) {
    const s = replayState(r, k), n = s.parts.reduce((a, p) => a + (p >= 0 ? 1 : 0), 0);
    assert.ok(s.hot.length > 0, '每步都有被传播改写的格');
    if (!r.stats.backtracks) { assert.ok(n >= prev, '已定格单调'); prev = n; }
  }
  const s0 = replayState(r, 0); assert.ok(s0.counts.some((c) => c > 1) && s0.hot.length === 0);
  if (pick === 'spine') {
    const [W, H, D] = r.size, cx = W >> 1, cz = D >> 1;
    for (let y = 0; y < H; y++) assert.equal(r.parts[r.grid[r.idx(cx, y, cz)]].kind, 'pillar', '中轴整列是细柱');
    const firstCells = r.events.slice(0, H).map((e) => e.cell);
    assert.deepEqual(firstCells, Array.from({ length: H }, (_, y) => r.idx(cx, y, cz)), '前 H 步自下而上立中轴');
  }
}
// spine 模式多种子都可解且合法
for (const seed of [1, 3, 4, 7]) { const r = solveBitset({ size: [6, 10, 6], seed, pick: 'spine', rules }); assert.ok(r.ok); assert.deepEqual(validateMultitile(r), []); }

// 计时（墙钟，有抖动）：热身后位运算档明显快于基线；797 相对 794 只报告
benchEngines({ size: [8, 12, 8], seeds: [1], reps: 2 });
const b = benchEngines({ size: [8, 12, 8], seeds: [1, 2, 3, 4, 5, 6], reps: 5 });
assert.ok(b.same, '计时各档逐格同解');
assert.ok(b.configs.bitwise794.speedup > 1.3, `位运算档快于基线 ×${b.configs.bitwise794.speedup}`);

assert.throws(() => solveBitset({ engine: 'x' }), RangeError);
assert.throws(() => solveBitset({ undo: 'x' }), RangeError);
assert.throws(() => solveBitset({ pick: 'x' }), RangeError);
assert.throws(() => solveBitset({ size: [0, 1, 1] }), RangeError);
console.log('PASS wfc-bitset', JSON.stringify({ checked, withBacktrack, work: Object.fromEntries(Object.entries(work).map(([n, s]) => [n, { maskOps: s.maskOps, copiedKB: +(s.copiedBytes / 1024).toFixed(1), trailKB: +(s.trailBytes / 1024).toFixed(1) }])), bench: Object.fromEntries(Object.entries(b.configs).map(([n, c]) => [n, [c.ms, c.speedup]])), gain797: b.gain797 }));
