// V7-G3：WFC Solver 测试（Shannon 熵 / tie-break / 加权选择 / 传播双模式 /
// Trail 回溯完全恢复 / 限界回溯 / 结构化冲突 / 慢速 oracle / 确定性 hash）
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
const im = (p) => import(new URL(p, "file://" + BASE).href);

const { BitSet, bitSetOf } = await im("src/procgen/core/bitSet.js");
const { StableRng, createStableRng } = await im("src/procgen/core/stableRng.js");
const { Trail } = await im("src/procgen/core/trail.js");
const { hashHex } = await im("src/core/rng.js");
const { createRectGrid2D } = await im("src/procgen/graph/rectGrid2d.js");
const { createVoxelGrid3D } = await im("src/procgen/graph/voxelGrid3d.js");
const { createHalfEdgeGraph } = await im("src/procgen/graph/halfEdgeGraph.js");
const { compileVariants } = await im("src/procgen/wfc/socketCompiler.js");
const { compileCompatibilityTable } = await im("src/procgen/wfc/compatibilityTable.js");
const { shannonEntropy, tieNoise, cellPriority, weightedChoiceFromDomain, TIE_NOISE_SCALE } = await im(
  "src/procgen/wfc/entropy.js"
);
const { WaveState } = await im("src/procgen/wfc/waveState.js");
const { createPropagator, createPropagateStats, SupportCountState } = await im(
  "src/procgen/wfc/propagator.js"
);
const { Backtracker, resolveMaxBacktrack, DEFAULT_MAX_BACKTRACK } = await im(
  "src/procgen/wfc/backtracker.js"
);
const { CONFLICT_CHAIN_CAP } = await im("src/procgen/wfc/conflictExplain.js");
const { solveWfc, selectPropagateMode, SUPPORT_COUNT_VARIANT_THRESHOLD } = await im(
  "src/procgen/wfc/solver.js"
);
const { referenceArcClosure, referenceEnumerate, fullDomains } = await im(
  "src/procgen/wfc/referenceSolver.js"
);

// 固定 seed=42 加权选择序列（16 次）的锁定 hash
const EXPECTED_PICK_HASH = "d9814569";

let passed = 0;
const ok = (msg) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

// ---------- fixtures ----------
const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });
const all4 = (c, extra) => ({ N: F(c, extra), E: F(c, extra), S: F(c, extra), W: F(c, extra) });
const proto = (id, faces, weight = 1) => ({
  id,
  family: "fixture",
  weight,
  orientationGroup: "NONE",
  faces,
});
/** 三个全互通模块（权重 1/2/3），任何网格自由解 */
const OPEN3 = [proto("p.open.1", all4("a"), 1), proto("p.open.2", all4("a"), 2), proto("p.open.3", all4("a"), 3)];
/** 奇偶交替：X(normal) 只能贴 Y(flipped)（二分图 2-着色语义） */
const ALT2 = [
  proto("p.alt.x", { N: F("c", { parity: "normal" }), E: F("c", { parity: "normal" }), S: F("c", { parity: "normal" }), W: F("c", { parity: "normal" }) }),
  proto("p.alt.y", { N: F("c", { parity: "flipped" }), E: F("c", { parity: "flipped" }), S: F("c", { parity: "flipped" }), W: F("c", { parity: "flipped" }) }),
];
/** 互不兼容两模块（pin 冲突 fixture） */
const AB2 = [proto("p.iso.a", all4("a")), proto("p.iso.b", all4("b"))];
/** 竖直堆叠（voxel U/D 方向） */
const VD2 = [
  proto("p.vox.p", { U: F("s"), D: F("g") }),
  proto("p.vox.q", { U: F("s"), D: F("s") }),
];

const compile = (protos) => {
  const compiled = compileVariants(protos);
  const table = compileCompatibilityTable(compiled);
  return { compiled, table };
};
const makeWave = (graph, compiled) => {
  const variants = compiled.variants;
  const weights = new Float64Array(variants.length);
  const wlw = new Float64Array(variants.length);
  variants.forEach((v, i) => {
    weights[i] = v.weight;
    wlw[i] = v.weight * Math.log(v.weight);
  });
  return new WaveState({
    cellCount: graph.cellCount,
    variantCount: variants.length,
    weights,
    weightLogWeights: wlw,
    cellIds: graph.cells().map((c) => c.id),
  });
};

// ---------- 1/2/18. 熵：加权 Shannon 公式，与手算一致（≤1e-12），不把 count 当熵 ----------
{
  const w = [2, 3];
  const sumW = 5;
  const sumWLogW = 2 * Math.log(2) + 3 * Math.log(3);
  const expected = Math.log(5) - sumWLogW / 5;
  assert.ok(Math.abs(shannonEntropy(2, sumW, sumWLogW) - expected) <= 1e-12);
  // 等权 3 候选：H = ln3 ≈ 1.0986，绝不是 count=3（命名诚实：熵就是 Shannon 熵）
  const h3 = shannonEntropy(3, 3, 0);
  assert.ok(Math.abs(h3 - Math.log(3)) <= 1e-12);
  assert.notEqual(h3, 3);
  // 单候选/空域 = Infinity（不参与最低熵竞争）
  assert.equal(shannonEntropy(1, 2, 2 * Math.log(2)), Infinity);
  assert.equal(shannonEntropy(0, 0, 0), Infinity);
  ok("加权 Shannon 熵 H=log(sumW)-sumWLogW/sumW 与手算误差 ≤1e-12；非 candidate count");
}

// ---------- 3. tie-break 稳定噪声：只由 seed+cellId 决定，不消耗随机流 ----------
{
  const n1 = tieNoise(7, "r:0:0");
  assert.equal(n1, tieNoise(7, "r:0:0")); // 稳定
  assert.ok(n1 >= 0 && n1 < TIE_NOISE_SCALE, "噪声 ∈ [0,1e-9)");
  assert.notEqual(tieNoise(7, "r:0:0"), tieNoise(7, "r:1:0")); // cellId 参与
  assert.notEqual(tieNoise(7, "r:0:0"), tieNoise(8, "r:0:0")); // seed 参与
  // 同熵 tie：两 cell 优先级差 < 1e-9，且整个扫描不动 RNG state
  const rng = createStableRng(7, "wfc");
  const stateBefore = rng.state;
  const p1 = cellPriority(2, 5, 2 * Math.log(2) + 3 * Math.log(3), 7, "r:0:0");
  const p2 = cellPriority(2, 5, 2 * Math.log(2) + 3 * Math.log(3), 7, "r:1:0");
  assert.ok(Math.abs(p1 - p2) < TIE_NOISE_SCALE);
  assert.equal(rng.state, stateBefore, "优先级扫描不得消耗随机流");
  // 熵不同（ln2 vs ln3）时差值远大于噪声
  const pA = cellPriority(2, 2, 0, 7, "r:0:0"); // ln2
  const pB = cellPriority(3, 3, 0, 7, "r:1:0"); // ln3
  assert.ok(pB - pA > 0.4, "真实熵差主导，噪声只做 tie-break");
  ok("同熵 tie 仅加 hash(seed,cellId)×1e-9 稳定噪声；扫描零随机流消耗");
}

// ---------- 4. weighted choice from BitSet：统计分布 + 固定 seed 序列 hash ----------
{
  const domain = bitSetOf(4, [0, 1, 3]); // 非连续位
  const weights = [1, 2, 9, 1]; // 有效 1:2:1
  const rng = createStableRng(20260822, "wfc");
  const N = 20000;
  const freq = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) freq[weightedChoiceFromDomain(domain, weights, 4, rng.next())]++;
  assert.ok(Math.abs(freq[0] / N - 0.25) < 0.02, `freq0=${freq[0] / N}`);
  assert.ok(Math.abs(freq[1] / N - 0.5) < 0.02, `freq1=${freq[1] / N}`);
  assert.ok(Math.abs(freq[3] / N - 0.25) < 0.02, `freq3=${freq[3] / N}`);
  assert.equal(freq[2], 0, "域外 variant 永不被选中");
  // 固定 seed 序列 hash 锁定（防回归）
  const picks = (s) => {
    const r = createStableRng(s, "wfc");
    const out = [];
    for (let i = 0; i < 16; i++) out.push(weightedChoiceFromDomain(domain, weights, 4, r.next()));
    return hashHex(out.join(","));
  };
  const h1 = picks(42);
  assert.equal(h1, picks(42));
  assert.equal(h1, EXPECTED_PICK_HASH, "固定 seed 的加权选择序列 hash 锁定");
  ok("weightedChoiceFromDomain 分布≈1:2:1（统计容差内）且固定 seed 序列 hash 固定");
}

// ---------- 1. WaveState 增量维护 count/sumW/sumWLogW/entropyVersion ----------
{
  const { compiled } = compile(OPEN3);
  const graph = createRectGrid2D({ width: 2, height: 2 });
  const wave = makeWave(graph, compiled);
  const trail = new Trail();
  const V = compiled.variants.length;
  const totalW = compiled.variants.reduce((s, v) => s + v.weight, 0);
  const totalWLW = compiled.variants.reduce((s, v) => s + v.weight * Math.log(v.weight), 0);
  assert.equal(wave.count(0), V);
  assert.equal(wave.sumW[0], totalW);
  assert.equal(wave.cellVersion(0), 0);
  // 逐次 ban：与从零重算对比（浮点容差 1e-12）
  wave.ban(0, 2, trail, "observation:chosen=0");
  wave.ban(0, 0, trail, "backtrack");
  assert.equal(wave.count(0), 1);
  assert.ok(Math.abs(wave.sumW[0] - 2) <= 1e-12);
  assert.ok(Math.abs(wave.sumWLogW[0] - 2 * Math.log(2)) <= 1e-12);
  assert.equal(wave.cellVersion(0), 2, "每次 ban 版本戳 +1");
  // 幂等：重复 ban 已移除 variant 不改状态、不写 trail
  assert.equal(wave.ban(0, 2, trail, "x"), false);
  assert.equal(trail.length, 2);
  ok("WaveState：ban 增量维护 count/sumW/sumWLogW/cellVersion，重复 ban 幂等");
}

// ---------- 5/6. 传播：方向来自 graph edge（rect N/E/S/W + voxel U/D + half-edge token） ----------
{
  // voxel 六向：U/D 方向传播（不写死平面四向）
  const { compiled, table } = compile(VD2);
  const graph = createVoxelGrid3D({ width: 1, height: 2, depth: 1 });
  assert.deepEqual(graph.neighborsOf(0).map((e) => e.direction), ["U"]);
  const r = solveWfc({
    graph, compiled, table, seed: 7,
    pins: [{ cell: "v:0:0:0", variant: "p.vox.p@r0" }],
  });
  assert.ok(r.ok, r.ok ? "" : JSON.stringify(r));
  assert.equal(r.assignmentByCellId["v:0:1:0"], "p.vox.q@r0", "U 方向传播强制顶层=Q");
  // half-edge 方向 token（"e:a:b" 形式）：三角形 3 面两两相邻
  const tri = createHalfEdgeGraph({ faces: [["a", "b", "c"], ["a", "b", "d"], ["a", "c", "d"]] });
  assert.ok(tri.neighborsOf(0).every((e) => e.direction.startsWith("e:")), "方向 token 来自共享边");
  assert.equal(tri.neighborsOf(0).length, 2);
  assert.equal(tri.neighborsOf(1).length, 2);
  assert.equal(tri.neighborsOf(2).length, 2);
  ok("传播方向全部来自 graph edge：rect 四向 / voxel U/D / half-edge 共享边 token");
}

// ---------- 三角形奇环：交替模块不可解 → 有限回溯 + 结构化失败 + provenance 链 ----------
let triangleFailure;
{
  const tri = createHalfEdgeGraph({ faces: [["a", "b", "c"], ["a", "b", "d"], ["a", "c", "d"]] });
  // X(0) 只贴 Y(1)，Y 只贴 X（自定义方向 token → 兼容表映射）
  const compiled = {
    variants: [{ key: "X", weight: 1 }, { key: "Y", weight: 1 }],
    variantIndex: new Map([["X", 0], ["Y", 1]]),
  };
  const compatibleFor = () => [bitSetOf(2, [1]), bitSetOf(2, [0])];
  const r = solveWfc({ graph: tri, compiled, table: null, seed: 7, compatibleFor, exposeInternals: true });
  triangleFailure = r;
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unsatisfiable", "决策栈耗尽 = 不可满足");
  assert.ok(r.stats.backtracks >= 1, "至少回溯一次（贪心选择撞上奇环）");
  assert.ok(r.stats.propagations < 32, `有限步骤结束（propagations=${r.stats.propagations}）`);
  // 9. choice point 记录完备
  const cp = r.internals.backtracker.history[0];
  assert.ok(cp.cellId && cp.failedVariant >= 0);
  assert.ok(cp.remainingDomain instanceof BitSet && cp.remainingCount === 2);
  assert.ok(Number.isInteger(cp.trailOffset));
  assert.ok(cp.rngState && Number.isFinite(cp.rngState.seed) && Number.isFinite(cp.rngState.state));
  // 12/13. 结构化 failure + provenance 链（不只报第一个空 cell）
  assert.ok(r.cell, "报告冲突 cell");
  assert.ok(Array.isArray(r.decisionPath) && r.decisionPath.length >= 1);
  assert.equal(r.decisionPath[0].status, "backtracked");
  assert.ok(r.conflict.banChain.length >= 2, "ban 链含成因记录");
  assert.ok(r.conflict.involvedCells.length >= 2, "冲突涉及 ≥2 个 cell（含成因 cell）");
  assert.ok(r.conflict.banChain.length <= CONFLICT_CHAIN_CAP);
  assert.ok(r.banReasons.length >= 1 && r.banReasons[0].reason.includes("neighbor-support"));
  assert.ok(r.suggestedRelaxations.length >= 1);
  ok("三角形奇环：有限步骤 unsatisfiable + choice point 完备 + provenance 链多 cell");
}

// ---------- 12/14. pin 冲突不可解 fixture：有限终止 + hard locks + ban reasons + 建议 ----------
{
  const { compiled, table } = compile(AB2);
  const graph = createRectGrid2D({ width: 2, height: 1 });
  const t0 = Date.now();
  const r = solveWfc({
    graph, compiled, table, seed: 1,
    pins: [
      { cell: "r:0:0", variant: "p.iso.a@r0" },
      { cell: "r:1:0", variant: "p.iso.b@r0" },
    ],
  });
  assert.ok(Date.now() - t0 < 1000, "有限步骤结束，无 while-restart 死循环");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unsatisfiable");
  assert.equal(r.cell, "r:1:0", "冲突 cell = 被 pin 到 B 的格子");
  assert.equal(r.hardLocks.length, 2, "hard locks 全记录");
  assert.ok(r.banReasons.some((b) => b.reason === "hard-lock"), "banReasons 含 pin 的 hard-lock 记录");
  assert.ok(
    r.banReasons.some((b) => b.reason === "neighbor-support:from=r:0:0:dir=E"),
    "banReasons 含来自成因 cell 的传播记录"
  );
  assert.ok(r.conflict.involvedCells.includes("r:0:0"), "provenance 追溯到成因 cell，而非只报空 cell");
  assert.ok(r.suggestedRelaxations.some((s) => s.includes("hard lock")), "建议释放/检查 hard lock");
  assert.ok(r.suggestedRelaxations.some((s) => s.includes("socket")), "建议检查方向 connector");
  // invalid pin 结构化拒绝
  const bad = solveWfc({ graph, compiled, table, seed: 1, pins: [{ cell: "r:9:9", variant: "p.iso.a@r0" }] });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "invalid-pin");
  ok("pin 冲突：有限终止 + 结构化 failure（cell/决策路径/hard locks/ban reasons/建议）");
}

// ---------- 11. maxBacktrack：局部编辑默认 32；profile 指定有限；超上限结构化失败 ----------
{
  assert.equal(DEFAULT_MAX_BACKTRACK, 32, "局部编辑默认 maxBacktrack=32");
  assert.equal(resolveMaxBacktrack({}), 32);
  assert.equal(resolveMaxBacktrack({ profile: { maxBacktrack: 512 } }), 512, "完整生成由 profile 指定");
  assert.equal(resolveMaxBacktrack({ maxBacktrack: 7, profile: { maxBacktrack: 512 } }), 7);
  assert.throws(() => resolveMaxBacktrack({ maxBacktrack: Infinity }), /有限/);
  assert.throws(() => resolveMaxBacktrack({ maxBacktrack: 0 }), /有限/);
  // 三角形奇环 + maxBacktrack=1：第一次回溯后仍冲突 → 超上限
  const tri = createHalfEdgeGraph({ faces: [["a", "b", "c"], ["a", "b", "d"], ["a", "c", "d"]] });
  const compiled = {
    variants: [{ key: "X", weight: 1 }, { key: "Y", weight: 1 }],
    variantIndex: new Map([["X", 0], ["Y", 1]]),
  };
  const compatibleFor = () => [bitSetOf(2, [1]), bitSetOf(2, [0])];
  const r = solveWfc({ graph: tri, compiled, table: null, seed: 7, compatibleFor, maxBacktrack: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "max-backtrack", "超上限返回 max-backtrack 而非死循环");
  assert.ok(r.suggestedRelaxations.some((s) => s.includes("maxBacktrack")));
  ok("maxBacktrack：默认 32 / profile 覆盖 / 必须有限 / 超上限结构化失败");
}

// ---------- 10. 回溯只回放 trail：回滚后 domain/sum/版本戳/hash 完全恢复 ----------
{
  const { compiled, table } = compile(ALT2);
  const graph = createRectGrid2D({ width: 3, height: 3 });
  const compatibleFor = (d) => table.compatible[d];
  const wave = makeWave(graph, compiled);
  const trail = new Trail();
  const stats = createPropagateStats();
  const prop = createPropagator({ graph, compatibleFor });
  prop.propagateBitset(wave, [0, 1, 2, 3, 4, 5, 6, 7, 8], trail, { stats, changedCells: [] });
  const hash0 = wave.waveHash();
  const versions0 = [...wave.cellVersions];
  const sums0 = [...wave.sumW];
  const wlw0 = [...wave.sumWLogW];
  // 决策 + 观察 + 传播（产生大量 ban）
  const rng = createStableRng(42, "wfc");
  const bt = new Backtracker(32);
  const cp = bt.beginChoice(wave, 4, trail, rng);
  const chosen = weightedChoiceFromDomain(wave.domain(4), wave.weights, wave.sumW[4], rng.next());
  cp.chosenVariant = chosen;
  wave.domain(4).toArray().forEach((v) => {
    if (v !== chosen) wave.ban(4, v, trail, "observation");
  });
  const r1 = prop.propagateBitset(wave, [4], trail, { stats, changedCells: [] });
  assert.equal(r1, null, "3x3 交替格传播无矛盾");
  assert.ok(trail.length > 2, "传播确实产生了级联 ban");
  assert.notEqual(wave.waveHash(), hash0);
  // 只回放 trail 回滚到 choice point
  trail.undoTo(cp.trailOffset, (id, v, u) => wave.restoreFromTrail(id, v, u));
  assert.equal(wave.waveHash(), hash0, "wave hash 完全恢复");
  assert.deepEqual([...wave.cellVersions], versions0, "heap 版本戳完全恢复");
  assert.deepEqual([...wave.sumW], sums0, "sumW 完全恢复（快照还原，非浮点重加）");
  assert.deepEqual([...wave.sumWLogW], wlw0, "sumWLogW 完全恢复");
  for (let i = 0; i < 9; i++) assert.equal(wave.count(i), 2, "domain 完全恢复");
  ok("回溯只回放 trail：domain/sum/heap version/hash 全部完全恢复");
}

// ---------- 7/8. support-count 模式：与 bitset 模式同解语义；无 O(A×B) 对象比较 ----------
{
  assert.equal(selectPropagateMode(SUPPORT_COUNT_VARIANT_THRESHOLD), "support-count");
  assert.equal(selectPropagateMode(SUPPORT_COUNT_VARIANT_THRESHOLD - 1), "bitset");
  assert.equal(selectPropagateMode(1, "support-count"), "support-count", "显式指定优先");
  const { compiled, table } = compile(ALT2);
  const graph = createRectGrid2D({ width: 3, height: 3 });
  const compatibleFor = (d) => table.compatible[d];
  const V = compiled.variants.length;
  const xIdx = compiled.variantIndex.get("p.alt.x@r0");
  // 三份闭包对比：bitset / support-count / 朴素参考
  const runBitset = () => {
    const wave = makeWave(graph, compiled);
    const trail = new Trail();
    const stats = createPropagateStats();
    const prop = createPropagator({ graph, compatibleFor });
    wave.domain(0).toArray().forEach((v) => {
      if (v !== xIdx) wave.ban(0, v, trail, "hard-lock");
    });
    prop.propagateBitset(wave, [0, 1, 2, 3, 4, 5, 6, 7, 8], trail, { stats, changedCells: [] });
    return { wave, stats };
  };
  const runSupport = () => {
    const wave = makeWave(graph, compiled);
    const trail = new Trail();
    const stats = createPropagateStats();
    const sc = new SupportCountState(graph, compatibleFor, V);
    assert.ok(sc.counters instanceof Int32Array, "支持计数用整数数组，非对象两两比较");
    wave.domain(0).toArray().forEach((v) => {
      if (v !== xIdx) wave.ban(0, v, trail, "hard-lock");
    });
    sc.propagate(wave, [0, 1, 2, 3, 4, 5, 6, 7, 8], trail, { stats, changedCells: [] });
    return { wave, stats };
  };
  const refDomains = fullDomains(9, V);
  refDomains[0] = [xIdx];
  const ref = referenceArcClosure(graph, compatibleFor, V, refDomains);
  assert.ok(ref.ok);
  const b = runBitset();
  const s = runSupport();
  for (let i = 0; i < 9; i++) {
    assert.deepEqual(b.wave.domain(i).toArray(), ref.domains[i], `bitset==reference @cell${i}`);
    assert.deepEqual(s.wave.domain(i).toArray(), ref.domains[i], `support-count==reference @cell${i}`);
  }
  // 棋盘模式验证：(x+y)%2==0 → X
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const expect = (x + y) % 2 === 0 ? [xIdx] : [compiled.variantIndex.get("p.alt.y@r0")];
      assert.deepEqual(b.wave.domain(y * 3 + x).toArray(), expect);
    }
  }
  // 完整求解两模式同 hash（传播等价 ⇒ 轨迹等价）
  const r1 = solveWfc({ graph, compiled, table, seed: 42, mode: "bitset" });
  const r2 = solveWfc({ graph, compiled, table, seed: 42, mode: "support-count" });
  assert.ok(r1.ok && r2.ok);
  assert.equal(r1.mode, "bitset");
  assert.equal(r2.mode, "support-count");
  assert.equal(r1.solutionHash, r2.solutionHash, "两种传播模式完整求解同解同 hash");
  ok("support-count 模式：与 bitset 模式最终可行域逐 cell 一致、完整求解同 hash");
}

// ---------- 6. 传播取消与统计 ----------
{
  const { compiled, table } = compile(OPEN3);
  const graph = createRectGrid2D({ width: 40, height: 40 });
  // 每 256 ops 检查一次：1600 个 cell 的初始传播应恰好在 op 256/512/.../1536 检查
  let cancelCalls = 0;
  const counting = () => {
    cancelCalls++;
    return false;
  };
  const r1 = solveWfc({ graph, compiled, table, seed: 1, shouldCancel: counting });
  assert.ok(r1.ok);
  assert.ok(cancelCalls >= 6, `取消检查次数 ${cancelCalls} ≥ 6（每 256 ops 一次）`);
  // 恒真取消 → cancelled（传播热循环内触发）
  const r2 = solveWfc({ graph, compiled, table, seed: 1, shouldCancel: () => true });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "cancelled");
  // 统计字段：用有真实邻域删候选的交替 fixture 验证 queue pushes；OPEN3
  // 是全互通模块，合法地不会产生传播级联，不能拿它断言 queue>0。
  const { compiled: statsCompiled, table: statsTable } = compile(ALT2);
  const small = solveWfc({ graph: createRectGrid2D({ width: 3, height: 3 }), compiled: statsCompiled, table: statsTable, seed: 7 });
  assert.ok(small.ok);
  assert.ok(small.stats.bans > 0, "bans 统计");
  assert.ok(small.stats.queuePushes > 0, "queue pushes 统计");
  assert.ok(small.stats.bitsetWords > 0, "bitset words 统计");
  assert.ok(small.stats.peakQueue >= 1, "峰值 queue 统计");
  assert.ok(small.stats.observations >= 1);
  ok("传播每 256 ops 检查取消 + bans/pushes/words/峰值 queue 统计齐全");
}

// ---------- 15. 慢速参考 solver：快速 solver 的解必须是参考解集的成员 ----------
{
  const { compiled, table } = compile(ALT2);
  const graph = createRectGrid2D({ width: 2, height: 2 });
  const compatibleFor = (d) => table.compatible[d];
  const ref = referenceEnumerate({ graph, compatibleFor, variantCount: compiled.variants.length });
  assert.ok(ref.solvable);
  assert.equal(ref.solutionCount, 2, "2x2 交替格恰两个棋盘解");
  assert.ok(!ref.truncated);
  for (const seed of [1, 7, 42, 884]) {
    const r = solveWfc({ graph, compiled, table, seed });
    assert.ok(r.ok);
    const arr = [...r.assignment];
    assert.ok(
      ref.solutions.some((s) => s.every((v, i) => v === arr[i])),
      `seed=${seed} 快速 solver 的解 ∈ 参考解集（无错误删候选/无非法解）`
    );
  }
  // 逐边验证解合法性（真实兼容表）
  const r = solveWfc({ graph: createRectGrid2D({ width: 3, height: 3 }), compiled, table, seed: 42 });
  assert.ok(r.ok);
  const g3 = createRectGrid2D({ width: 3, height: 3 });
  for (let c = 0; c < 9; c++) {
    for (const e of g3.neighborsOf(c)) {
      assert.ok(table.isCompatible(r.assignment[c], e.direction, r.assignment[e.to]), `edge ${c}->${e.to}`);
    }
  }
  // 参考 solver 同样判定三角形奇环不可解（两实现结论一致）
  const tri = createHalfEdgeGraph({ faces: [["a", "b", "c"], ["a", "b", "d"], ["a", "c", "d"]] });
  const triCompat = () => [bitSetOf(2, [1]), bitSetOf(2, [0])];
  const triRef = referenceEnumerate({ graph: tri, compatibleFor: triCompat, variantCount: 2 });
  assert.equal(triRef.solvable, false);
  assert.ok(triRef.steps < 100, "参考 solver 有限步骤");
  assert.equal(triangleFailure.ok, false, "快速 solver 与参考结论一致：不可解");
  ok("慢速参考 oracle：快速 solver 解 ∈ 穷举解集；不可解结论两实现一致");
}

// ---------- 16. 确定性：同 seed 三次同 hash；模块加载顺序打乱仍同 hash ----------
{
  const graph = () => createRectGrid2D({ width: 3, height: 3 });
  const runOnce = (protos, seed) => {
    const { compiled, table } = compile(protos);
    const r = solveWfc({ graph: graph(), compiled, table, seed });
    assert.ok(r.ok);
    return r.solutionHash;
  };
  const h1 = runOnce(OPEN3, 7);
  const h2 = runOnce(OPEN3, 7);
  const h3 = runOnce(OPEN3, 7);
  assert.equal(h1, h2);
  assert.equal(h2, h3);
  // 模块加载顺序打乱（variant 编译按稳定 key 排序 → index 不变）
  const shuffled = [OPEN3[2], OPEN3[0], OPEN3[1]];
  assert.equal(runOnce(shuffled, 7), h1, "加载顺序打乱后 solutionHash 不变");
  // 不同 seed 应得到可区分结果（至少统计上：32 个 seed 出现 >1 种 hash）
  const hashes = new Set();
  for (let s = 1; s <= 32; s++) hashes.add(runOnce(OPEN3, s));
  assert.ok(hashes.size > 1, "不同 seed 产生不同解（非恒定输出）");
  ok(`同 blueprint/seed 三次 hash 一致（${h1}）；乱序加载一致；32 seed 产生 ${hashes.size} 种解`);
}

// ---------- 17. 本阶段不替换 constraintSolver.js（静态保证） ----------
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const solverSrc = fs.readFileSync(path.join(BASE, "src/world/citadel/constraintSolver.js"), "utf8");
  assert.ok(solverSrc.length > 1000, "constraintSolver.js 保持原样（薄 adapter 留给后续阶段）");
  // G3 新文件不 import 任何 V6 生产 solver
  for (const f of ["waveState.js", "entropy.js", "propagator.js", "backtracker.js", "conflictExplain.js", "solver.js", "referenceSolver.js"]) {
    const src = fs.readFileSync(path.join(BASE, "src/procgen/wfc", f), "utf8");
    assert.ok(!src.includes("constraintSolver") && !src.includes("moduleResolver"), `${f} 不触碰 V6 solver`);
  }
  ok("未替换 constraintSolver.js；G3 文件与 V6 solver 零耦合");
}

console.log(`\n全部通过：${passed} 项断言组（V7-G3 wfc solver）`);
