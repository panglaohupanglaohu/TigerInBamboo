/**
 * wfc-bitset.js — 三维 WFC 的「位运算」传播与「少用位掩码」的支持计数传播 + 逐步事件记录（第 56 批 C05）。
 *
 * 片子原文（REA-agent/gifs/README.md）：
 *   794993371261665280 [2016-11-05]「It's getting faster (mostly due to bitwise operations). Actual speed depicted below」
 *   797844857821732864 [2016-11-13]「@ExUtumno , I came up with an unrelated optimization where I actually use bitmasks less.
 *                                    Maybe 20 ~30% faster.」
 * 逐帧（原尺寸 794:0021 / 797:0020 回看）：按 Go! 后，体积里每一格都有一个小线框字形（= 尚未坍缩的格，
 *   线框越大可选越少），刚被传播改写的格变**黄**，坍缩完的格换成实体构件；构件跳着出现（最少可能数优先），
 *   797 先竖起一根细柱再向两侧长。两条片子讲的是同一个 3D WFC 解算器**变快了**，录屏是实速。
 *   第 1 轮把它学成「体素化幽灵预览」（src/world/voxel-ghost.js，保留不动），本轮按原文纠正为 WFC 解算可视化。
 *
 * 本文件不重写规则：部件 / 面标签 / 承托规则全部来自 multitile-wfc.js（buildParts / facesCompatible），
 * 三种传播引擎在同一套选格 / 随机 / 回溯骨架下运行，AC 不动点唯一 → 三者逐格同解：
 *   · 'array'   基线：Uint8Array 域，三重循环逐个找支持（= solveMultitile 的写法，用来证明同解）；
 *   · 'bitwise' 794：域是 Uint32 位集，支持表 sup[d][p] 也是位集；邻格新域 = dj & OR_{p∈di} sup[d][p]，
 *               一次 AND 删掉整字的候选；计数用 popcount；
 *   · 'support' 797：AC-4 支持计数。每个 (格, 方向, 候选) 记还剩几个支持者；删一个候选只沿它的兼容表把计数减一，
 *               归零才删——传播时不再按方向整域重算掩码（"use bitmasks less"），域本身仍是位集。
 * record=true 时每一步写事件：{type:'assign', cell, part, changed:[[格,新可能数]...], ms}，回溯写 {type:'restore', counts}；
 * 页面 wfc-bitset.html 用它回放「黄点 = 本步被传播改写的格 / 线框大小 = 剩余可能数 / 实体 = 已定格」。
 */
import { buildParts, facesCompatible, MULTITILE_DIRS as DIRS } from './multitile-wfc.js';

const OPP = [1, 0, 3, 2, 5, 4];
export const WFC_ENGINES = Object.freeze(['array', 'bitwise', 'cached', 'support']);

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }
export function popcount32(v) { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24); }

/** 规则编译：兼容表（布尔 / 位集 / 列表）与边界。 */
export function compileRules(parts = buildParts()) {
  const P = parts.length, words = (P + 31) >>> 5;
  const compat = DIRS.map((_, d) => parts.map((a) => Uint8Array.from(parts, (b) => (facesCompatible(a.faces[d], b.faces[OPP[d]], d) ? 1 : 0))));
  const sup = DIRS.map((_, d) => parts.map((_, p) => { const m = new Uint32Array(words); for (let q = 0; q < P; q++) if (compat[d][p][q]) m[q >>> 5] |= 1 << (q & 31); return m; }));
  const list = DIRS.map((_, d) => parts.map((_, p) => { const a = []; for (let q = 0; q < P; q++) if (compat[d][p][q]) a.push(q); return Int16Array.from(a); }));
  // 边界（与 multitile-wfc 同义）：地面 = T 的顶面；顶外 = A 的底面；侧外 = A
  const boundaryOk = (p, d, y) => { const f = parts[p].faces[d]; if (d === 3) return y === 0 ? facesCompatible('T', f, 2) : true; if (d === 2) return facesCompatible(f, 'A', 2); return facesCompatible(f, 'A', 0); };
  return { parts, P, words, compat, sup, list, boundaryOk };
}

/**
 * 解。opts：size, seed, engine('array'|'bitwise'|'support'), pick('entropy'|'spine'), record, maxBacktracks, airBias, rules
 * pick='spine'：先把中轴那一列自下而上定下来（候选里 pillar 细柱优先，无解时回溯到其余候选），再回到最少可能数
 *   （797 先竖一根细柱的出现序；默认 entropy）。
 */
export function solveBitset({ size = [5, 6, 5], seed = 1, engine = 'bitwise', pick = 'entropy', undo = 'snapshot', record = false, maxBacktracks = 2000, rules = null, airBias = (y, H) => 1.1 + 1.8 * (y / Math.max(1, H - 1)) ** 2 } = {}) {
  if (!WFC_ENGINES.includes(engine)) throw new RangeError('Invalid WFC engine');
  if (pick !== 'entropy' && pick !== 'spine') throw new RangeError('Invalid pick mode');
  if (undo !== 'snapshot' && undo !== 'trail') throw new RangeError('Invalid undo mode');
  const [W, H, D] = size;
  if (![W, H, D].every((v) => Number.isInteger(v) && v >= 1 && v <= 24)) throw new RangeError('Invalid size');
  const R = rules ?? compileRules(), { parts, P, words, compat, sup, list } = R;
  const N = W * H * D, idx = (x, y, z) => x + W * (y + H * z), xyz = (i) => [i % W, Math.floor(i / W) % H, Math.floor(i / (W * H))];
  const NB = new Int32Array(N * 6);
  for (let i = 0; i < N; i++) { const [x, y, z] = xyz(i); for (let d = 0; d < 6; d++) { const q = [x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]]; NB[i * 6 + d] = q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H || q[2] < 0 || q[2] >= D ? -1 : idx(q[0], q[1], q[2]); } }
  const rand = rng(seed), t0 = now();
  const events = record ? [] : null;
  let touched = null;                                       // record：本次传播改写过的格
  const touch = (j) => { if (touched) touched.add(j); };

  // —— 域存储与引擎 ——
  const bitDom = engine !== 'array';
  let dom = bitDom ? new Uint32Array(N * words) : new Uint8Array(N * P);
  let cnt = new Int16Array(N);                              // 每格可能数（三引擎都维护，选格用）
  let sc = engine === 'support' ? new Int16Array(N * 6 * P) : null;   // 支持计数 [i][d][q]
  let trail = null;                                         // undo='trail'：只记被改写的字 / 计数，回溯时倒放（不再整份复制位掩码数组）
  const wD = (k, v) => { if (trail) trail.push(0, k, dom[k]); dom[k] = v; };
  const wC = (i, v) => { if (trail) trail.push(1, i, cnt[i]); cnt[i] = v; };
  const decS = (k) => { if (trail) trail.push(2, k, sc[k]); return --sc[k]; };
  const has = bitDom ? (i, p) => (dom[i * words + (p >>> 5)] >>> (p & 31)) & 1 : (i, p) => dom[i * P + p];
  const drop = bitDom ? (i, p) => { const k = i * words + (p >>> 5); wD(k, dom[k] & ~(1 << (p & 31))); wC(i, cnt[i] - 1); } : (i, p) => { wD(i * P + p, 0); wC(i, cnt[i] - 1); };
  for (let i = 0; i < N; i++) {
    const y = xyz(i)[1];
    for (let p = 0; p < P; p++) {
      let ok = true;
      for (let d = 0; d < 6 && ok; d++) if (NB[i * 6 + d] < 0) ok = R.boundaryOk(p, d, y);
      if (ok) { if (bitDom) dom[i * words + (p >>> 5)] |= 1 << (p & 31); else dom[i * P + p] = 1; cnt[i]++; }
    }
  }
  const stats = { revisions: 0, maskOps: 0, counterOps: 0, copiedBytes: 0 };

  // array：逐候选找支持（基线）
  function propArray(start) {
    const queue = [...start], inq = new Uint8Array(N); for (const i of queue) inq[i] = 1;
    while (queue.length) {
      const i = queue.shift(); inq[i] = 0;
      for (let d = 0; d < 6; d++) {
        const j = NB[i * 6 + d]; if (j < 0) continue; stats.revisions++;
        let changed = false;
        for (let q = 0; q < P; q++) {
          if (!dom[j * P + q]) continue;
          let s = false; for (let p = 0; p < P && !s; p++) if (dom[i * P + p] && compat[d][p][q]) s = true;
          if (!s) { wD(j * P + q, 0); wC(j, cnt[j] - 1); changed = true; }
        }
        if (changed) { touch(j); if (!cnt[j]) return false; if (!inq[j]) { inq[j] = 1; queue.push(j); } }
      }
    }
    return true;
  }
  // bitwise：dj &= OR sup[d][p]
  const mask = new Uint32Array(words);
  const cache = engine === 'cached' && words === 1 ? DIRS.map(() => new Map()) : null;   // P>32 时退回 bitwise
  function propBits(start) {
    const queue = [...start], inq = new Uint8Array(N); for (const i of queue) inq[i] = 1;
    while (queue.length) {
      const i = queue.shift(); inq[i] = 0;
      for (let d = 0; d < 6; d++) {
        const j = NB[i * 6 + d]; if (j < 0) continue; stats.revisions++;
        let mk = mask;
        if (cache) {                                          // cached：同一个域值的支持并集只算一次（少做位或）
          const key = dom[i], C = cache[d]; mk = C.get(key);
          if (!mk) { mk = new Uint32Array(1); let bits = key; while (bits) { const b = 31 - Math.clz32(bits & -bits); bits &= bits - 1; mk[0] |= sup[d][b][0]; stats.maskOps++; } C.set(key, mk); }
          const o = dom[j], v = o & mk[0];
          if (v !== o) { wD(j, v); const n = popcount32(v); wC(j, n); touch(j); if (!n) return false; if (!inq[j]) { inq[j] = 1; queue.push(j); } }
          continue;
        }
        mask.fill(0);
        for (let w = 0; w < words; w++) {
          let bits = dom[i * words + w];
          while (bits) { const b = 31 - Math.clz32(bits & -bits); bits &= bits - 1; const m = sup[d][(w << 5) + b]; for (let k = 0; k < words; k++) mask[k] |= m[k]; stats.maskOps++; }
        }
        let changed = false, n = 0;
        for (let k = 0; k < words; k++) { const o = dom[j * words + k], v = o & mk[k]; if (v !== o) { wD(j * words + k, v); changed = true; } n += popcount32(v); }
        if (changed) { wC(j, n); touch(j); if (!n) return false; if (!inq[j]) { inq[j] = 1; queue.push(j); } }
      }
    }
    return true;
  }
  // support：AC-4 计数（删除驱动）
  function initSupport() {
    for (let j = 0; j < N; j++) for (let d = 0; d < 6; d++) {
      const i = NB[j * 6 + d]; if (i < 0) continue;            // 邻格 i 在 j 的 d 方向；i 的 p 支持 j 的 q ⇔ compat[OPP[d]][p][q]
      const base = (j * 6 + d) * P, od = OPP[d];
      for (let p = 0; p < P; p++) if (has(i, p)) { const L = list[od][p]; for (let k = 0; k < L.length; k++) sc[base + L[k]]++; }
    }
    const kill = [];
    for (let j = 0; j < N; j++) for (let d = 0; d < 6; d++) { if (NB[j * 6 + d] < 0) continue; for (let q = 0; q < P; q++) if (has(j, q) && sc[(j * 6 + d) * P + q] === 0) { drop(j, q); kill.push(j, q); } }
    return drainSupport(kill);
  }
  function drainSupport(kill) {
    while (kill.length) {
      const p = kill.pop(), i = kill.pop();
      if (!cnt[i]) return false;
      for (let e = 0; e < 6; e++) {
        const j = NB[i * 6 + e]; if (j < 0) continue;
        const base = (j * 6 + OPP[e]) * P, L = list[e][p];
        for (let k = 0; k < L.length; k++) {
          const q = L[k]; stats.counterOps++;
          if (decS(base + q) === 0 && has(j, q)) { drop(j, q); touch(j); if (!cnt[j]) return false; kill.push(j, q); }
        }
      }
    }
    return true;
  }
  function assignSupport(i, p) {
    const kill = [];
    for (let q = 0; q < P; q++) if (q !== p && has(i, q)) { drop(i, q); kill.push(i, q); }
    touch(i);
    return drainSupport(kill);
  }
  function assign(i, p) {
    if (engine === 'support') return assignSupport(i, p);
    if (bitDom) for (let w = 0; w < words; w++) wD(i * words + w, w === p >>> 5 ? 1 << (p & 31) : 0);
    else for (let q = 0; q < P; q++) wD(i * P + q, q === p ? 1 : 0);
    wC(i, 1); touch(i);
    return bitDom ? propBits([i]) : propArray([i]);
  }
  const single = (j) => { if (cnt[j] !== 1) return -1; for (let p = 0; p < P; p++) if (has(j, p)) return p; return -1; };
  const snap = () => { if (trail) return { mark: trail.length }; stats.copiedBytes += dom.byteLength + cnt.byteLength + (sc ? sc.byteLength : 0); return { dom: dom.slice(), cnt: cnt.slice(), sc: sc && sc.slice() }; };
  const unwind = (mark) => { for (let t = trail.length - 3; t >= mark; t -= 3) { const k = trail[t + 1], v = trail[t + 2]; if (trail[t] === 0) dom[k] = v; else if (trail[t] === 1) cnt[k] = v; else sc[k] = v; } trail.length = mark; };
  const restore = (s) => { if (trail) unwind(s.mark); else { dom = s.dom; cnt = s.cnt; sc = s.sc; } if (events) events.push({ type: 'restore', counts: Int16Array.from(cnt), singles: Int16Array.from({ length: N }, (_, j) => single(j)), ms: now() - t0 }); };

  const initOk = engine === 'support' ? initSupport() : bitDom ? propBits([...Array(N).keys()]) : propArray([...Array(N).keys()]);
  if (!initOk) return { ok: false, reason: 'initial contradiction', engine };
  const initialCounts = Int16Array.from(cnt), initialSingles = Int16Array.from({ length: N }, (_, j) => single(j));
  if (undo === 'trail') trail = [];
  const spine = []; if (pick === 'spine') { const cx = W >> 1, cz = D >> 1; for (let y = 0; y < H; y++) spine.push(idx(cx, y, cz)); }

  const stack = [], trace = [];
  let backtracks = 0, decisions = 0, trailPeak = 0;
  const tryAssign = (cell, p) => {
    if (events) touched = new Set();
    const ok = assign(cell, p);
    if (trail && trail.length > trailPeak) trailPeak = trail.length;
    if (events && ok) events.push({ type: 'assign', cell, part: p, changed: [...touched].map((j) => [j, cnt[j], single(j)]), ms: now() - t0 });
    touched = null; return ok;
  };
  for (;;) {
    let best = -1, bestN = 1e9, bestT = 0;
    let onSpine = false;
    if (spine.length) { while (spine.length && cnt[spine[0]] <= 1) spine.shift(); if (spine.length) { best = spine[0]; onSpine = true; } }
    if (best < 0) for (let i = 0; i < N; i++) { const n = cnt[i]; if (n > 1) { const tie = rand(); if (n < bestN || (n === bestN && tie < bestT)) { best = i; bestN = n; bestT = tie; } } }
    if (best < 0) break;
    const y = xyz(best)[1], cands = [];
    for (let p = 0; p < P; p++) if (has(best, p)) cands.push(p);
    const pool = cands.map((p) => ({ p, w: p === 0 ? airBias(y, H) : parts[p].weight })), order = [];
    while (pool.length) { let s = 0; for (const e of pool) s += e.w; let r = rand() * s, k = 0; for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; } order.push(pool.splice(k, 1)[0].p); }
    if (onSpine) order.sort((a, b) => (parts[b].kind === 'pillar') - (parts[a].kind === 'pillar'));   // 中轴先立细柱（797），其余候选保持随机序作回溯后备
    let placed = false;
    while (order.length) {
      const p = order.shift(), s = snap(); decisions++;
      if (tryAssign(best, p)) { stack.push({ snap: s, cell: best, rest: order.slice(), traceLen: trace.length }); trace.push({ cell: best, part: p, step: decisions }); placed = true; break; }
      restore(s); backtracks++;
      if (backtracks > maxBacktracks) return { ok: false, reason: 'backtrack budget', backtracks, engine };
    }
    if (!placed) {
      let resumed = false;
      while (stack.length && !resumed) {
        const fr = stack.pop(); restore(fr.snap); trace.length = fr.traceLen;
        while (fr.rest.length) {
          const p = fr.rest.shift(), s = snap(); backtracks++;
          if (tryAssign(fr.cell, p)) { stack.push({ snap: s, cell: fr.cell, rest: fr.rest, traceLen: trace.length }); trace.push({ cell: fr.cell, part: p, step: ++decisions }); resumed = true; break; }
          restore(s);
        }
        if (backtracks > maxBacktracks) return { ok: false, reason: 'backtrack budget', backtracks, engine };
      }
      if (!resumed) return { ok: false, reason: 'unsatisfiable', backtracks, engine };
    }
  }
  const grid = new Int16Array(N);
  for (let i = 0; i < N; i++) { let k = -1; for (let p = 0; p < P; p++) if (has(i, p)) { k = p; break; } grid[i] = k; }
  const solid = new Uint8Array(N); for (let i = 0; i < N; i++) solid[i] = parts[grid[i]].solid ? 1 : 0;
  const placements = [];
  for (let i = 0; i < N; i++) { const pt = parts[grid[i]]; if (pt.anchor && pt.tile !== 'air') placements.push({ tile: pt.tile, at: xyz(i), size: pt.size, kind: pt.kind }); }
  return { ok: true, engine, pick, undo, size, grid, solid, parts, placements, trace, events, initialCounts, initialSingles, P, ms: now() - t0,
    stats: { decisions, backtracks, ...stats, trailPeak, trailBytes: trailPeak * 8, solid: solid.reduce((a, b) => a + b, 0) }, idx, xyz };
}
function now() { return globalThis.performance ? performance.now() : Date.now(); }

/** 片子对应的三档配置：基线 / 794 位运算 / 797 少用位掩码（缓存支持并集 + 回溯走改写记录而不整份复制位掩码数组）。 */
export const WFC_CONFIGS = Object.freeze({
  baseline: { engine: 'array', undo: 'snapshot' },
  bitwise794: { engine: 'bitwise', undo: 'snapshot' },
  fewerMasks797: { engine: 'cached', undo: 'trail' },
});

/** 计时：同一批种子各跑 reps 次取中位求和；返回每档毫秒、相对 baseline 倍数、797 相对 794 提速比例、是否逐格同解。 */
export function benchEngines({ size = [6, 10, 6], seeds = [1, 2, 3], reps = 3, pick = 'entropy', configs = WFC_CONFIGS } = {}) {
  const rules = compileRules(), out = {}, grids = {};
  for (const [name, cfg] of Object.entries(configs)) {
    let total = 0; grids[name] = [];
    for (const seed of seeds) {
      const times = [];
      for (let r = 0; r < reps; r++) { const res = solveBitset({ size, seed, pick, rules, ...cfg }); times.push(res.ms); if (r === 0) grids[name].push(res.ok ? Array.from(res.grid).join(',') : 'fail:' + res.reason); }
      times.sort((a, b) => a - b); total += times[times.length >> 1];
    }
    out[name] = { ...cfg, ms: +total.toFixed(2) };
  }
  const names = Object.keys(configs), base = out[names[0]].ms;
  for (const n of names) out[n].speedup = +(base / out[n].ms).toFixed(2);
  const same = names.every((n) => grids[n].every((g, k) => g === grids[names[0]][k] && !g.startsWith('fail')));
  const gain797 = out.bitwise794 && out.fewerMasks797 ? +(out.bitwise794.ms / out.fewerMasks797.ms - 1).toFixed(3) : null;
  return { size, seeds, reps, configs: out, same, gain797 };
}

/**
 * 回放：把事件序列折算成第 k 步的画面状态。
 * 返回 { counts(Int16 每格可能数), parts(Int16 已定格的部件，未定 -1), hot(本步被改写的格), step, done }。
 */
export function replayState(res, k) {
  const counts = Int16Array.from(res.initialCounts), parts = Int16Array.from(res.initialSingles), ev = res.events ?? [];
  const K = Math.max(0, Math.min(ev.length, k | 0));
  let hot = [];
  for (let s = 0; s < K; s++) {
    const e = ev[s];
    if (e.type === 'assign') { for (const [j, n, p] of e.changed) { counts[j] = n; parts[j] = p; } hot = e.changed.map((c) => c[0]); }
    else { counts.set(e.counts); parts.set(e.singles); hot = []; }
  }
  return { counts, parts, hot, step: K, done: K >= ev.length };
}
