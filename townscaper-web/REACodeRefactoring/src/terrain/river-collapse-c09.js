/**
 * river-collapse-c09.js — 第 56 批 C09-B：「河道先深度优先坍缩，其余广度优先坍缩」的河网生成。
 *
 * 1769691526924292506 "Mega river system! ... I've sort of special cased the rivers by collapsing them
 * depth-first to let them wiggle real far, and then the rest is collapsed breadth-first, making nice
 * gentle slopes that only occasionally meet steep cliffs."
 *
 * 与 r55 的 carveRivers + relaxRiverSlopes（先有地形 → 挖河 → 事后削坡）不同，这里按配文的顺序：
 *   1) 河道先坍缩：从入海口出发做深度优先生长（显式栈 + 回溯）。每一步只往“未定、不贴别的河、不贴海”的
 *      陆地格走，候选随机挑（wiggle 偏好拐弯），走不动就回溯到栈里上一格继续长 —— 回溯点长出来的就是支流，
 *      所以河网天然是树（汇流处 = 回溯分叉点）。河格高度沿树从河口往上游单调不降（每 run 格升一层）。
 *   2) 其余陆地广度优先坍缩：以全部河格和海为种子做 FIFO。每个新格取“父格高度 + 步长”，步长按目标高度
 *      （原星球噪声高度）决定 0 或 +1，并被已坍缩邻居夹在 [max−1, min+1] 里 → 缓坡；只有小概率 cliffChance
 *      允许 +2/+3 = 偶尔的陡崖。高度从不低于 BFS 父格，所以每个陆地格都有一条不升的链通到河/海：零局部洼地。
 *   3) 写回共享 World：rock 列、river 标志，World.riverFlow = { flowTo, paths, mouths, version }，
 *      navgraph.buildNav 会据此判断顺流/逆流（复杂汇流也按树方向）。
 *
 * 纯数据（不依赖 three）。任何带 edgeNeighbors 的 World 都能跑（星球 planetWorld / 平面网格）。
 * 位置向量：cell.dir（星球单位向量）或 [cx, 0, cz]。
 */
import { makeRng } from '../core/noise.js';
import { MAX_LEVEL } from '../core/world.js';

const pos = (c) => c.dir ?? [c.cx, 0, c.cz];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

/**
 * @param world World（会被改写）
 * @param opts.land  Uint8Array 陆地掩码（默认 world.ground>0）
 * @param opts.target 每格目标高度（默认当前 ground）
 */
export function collapseRiversFirst(world, {
  seed = 1, rivers = 14, riverShare = 0.24, run = 7, wiggle = 0.7, cliffChance = 0.04,
  maxLevel = Math.min(MAX_LEVEL, 10), land = null, target = null, minMouthGap = 4,
} = {}) {
  const rng = makeRng(seed * 7919 + 17);
  const cells = world.cells, n = cells.length;
  const isLand = land ?? Uint8Array.from(cells, (c) => (world.ground(c) > 0 ? 1 : 0));
  const tgt = target ?? Int32Array.from(cells, (c) => world.ground(c));
  const nbs = (c) => c.edgeNeighbors.filter((id) => id >= 0);
  const coastal = (id) => nbs(cells[id]).some((o) => !isLand[o]);

  /* ---------- 1) 河道：深度优先坍缩 ---------- */
  const H = new Int32Array(n).fill(-1);            // -1 = 未坍缩
  for (let i = 0; i < n; i++) if (!isLand[i]) H[i] = 0;
  const river = new Uint8Array(n), flowTo = new Int32Array(n).fill(-1), depth = new Int32Array(n).fill(-1);
  const landCount = isLand.reduce((s, v) => s + v, 0), budget = Math.floor(landCount * riverShare);
  let riverCells = 0;
  // 入海口：海岸陆地格，彼此至少隔 minMouthGap 步
  const coast = []; for (let i = 0; i < n; i++) if (isLand[i] && coastal(i)) coast.push(i);
  for (let i = coast.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [coast[i], coast[j]] = [coast[j], coast[i]]; }
  const mouths = [];
  const hopDist = (from, limit) => {           // BFS 步数集合（≤limit）
    const seen = new Map([[from, 0]]), q = [from];
    for (let h = 0; h < q.length; h++) { const d = seen.get(q[h]); if (d >= limit) continue; for (const o of nbs(cells[q[h]])) if (!seen.has(o)) { seen.set(o, d + 1); q.push(o); } }
    return seen;
  };
  const blocked = new Uint8Array(n);
  for (const m of coast) {
    if (mouths.length >= rivers) break;
    if (blocked[m]) continue;
    // 河口要有一个纯内陆邻居可以往里长
    if (!nbs(cells[m]).some((o) => isLand[o] && !coastal(o))) continue;
    mouths.push(m);
    for (const id of hopDist(m, minMouthGap).keys()) blocked[id] = 1;
  }
  // 能不能把河长进 id（来自 from）：陆地、未定、不贴海、除了 from 以外不贴任何河格
  const canGrow = (id, from) => isLand[id] && H[id] < 0 && !coastal(id) && nbs(cells[id]).every((o) => o === from || !river[o]);
  const paths = [];
  // 多条河交替推进（轮转），避免第一条河吃掉全部预算
  const stacks = mouths.map((m) => { river[m] = 1; depth[m] = 0; H[m] = 1; riverCells++; return { stack: [m], heading: null, path: [m] }; });
  let active = stacks.length;
  while (active && riverCells < budget) {
    active = 0;
    for (const s of stacks) {
      if (!s.stack.length || riverCells >= budget) continue;
      active++;
      const cur = s.stack[s.stack.length - 1], c = cells[cur];
      const cand = nbs(c).filter((o) => canGrow(o, cur));
      if (!cand.length) { s.stack.pop(); s.heading = null; continue; }       // 回溯 → 之后从这里长出支流
      // wiggle：按“与上一步方向的夹角”打分，wiggle 越大越偏好拐弯；同时避免折回河口
      const p = pos(c);
      let best = cand[0], bestScore = -Infinity;
      for (const o of cand) {
        const d = sub(pos(cells[o]), p), l = len(d) || 1;
        const turn = s.heading ? 1 - dot(d, s.heading) / l : 0.5;           // 0 直行 … 2 掉头
        const score = rng() + wiggle * Math.min(turn, 1) - (turn > 1.6 ? 1 : 0);
        if (score > bestScore) { bestScore = score; best = o; }
      }
      const d = sub(pos(cells[best]), p), l = len(d) || 1;
      s.heading = [d[0] / l, d[1] / l, d[2] / l];
      river[best] = 1; flowTo[best] = cur; depth[best] = depth[cur] + 1;
      H[best] = Math.min(maxLevel - 1, 1 + Math.floor(depth[best] / run));
      riverCells++; s.stack.push(best); s.path.push(best);
    }
  }
  // 每条河的主干：从最深的格沿 flowTo 回到河口；支流：剩下的叶子
  const kids = new Int32Array(n);
  for (let i = 0; i < n; i++) if (river[i] && flowTo[i] >= 0) kids[flowTo[i]]++;
  for (let i = 0; i < n; i++) if (river[i] && kids[i] === 0) { const p = []; for (let x = i; x >= 0; x = flowTo[x]) p.push(x); paths.push(p.reverse()); }
  paths.sort((a, b) => b.length - a.length);
  let confluences = 0; for (let i = 0; i < n; i++) if (river[i] && kids[i] >= 2) confluences++;

  /* ---------- 2) 其余陆地：广度优先坍缩 ---------- */
  const q = [], parent = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (H[i] >= 0) q.push(i);   // 海 + 全部河格
  let cliffs = 0, forcedSteep = 0;
  for (let h = 0; h < q.length; h++) {
    const pid = q[h];
    for (const id of nbs(cells[pid])) {
      if (H[id] >= 0 || !isLand[id]) continue;
      // 已坍缩邻居（不含海）：缓坡约束 |Δ|≤1
      let lo = -Infinity, hi = Infinity;
      for (const o of nbs(cells[id])) if (H[o] >= 0 && isLand[o]) { lo = Math.max(lo, H[o] - 1); hi = Math.min(hi, H[o] + 1); }
      const base = Math.max(1, H[pid]);
      let step = river[pid] ? 1 : (tgt[id] > base ? (rng() < 0.55 ? 1 : 0) : 0);   // 河岸高出河床一层
      if (!river[pid] && tgt[id] > base + 1 && rng() < cliffChance) { step = 2 + (rng() < 0.4 ? 1 : 0); cliffs++; }
      let v = Math.min(maxLevel, base + step);
      if (step <= 1) { v = Math.max(v, lo); v = Math.min(v, hi); v = Math.max(v, base); if (v > hi) forcedSteep++; }
      H[id] = Math.max(1, Math.min(maxLevel, v)); parent[id] = pid; q.push(id);
    }
  }
  for (let i = 0; i < n; i++) if (H[i] < 0) H[i] = isLand[i] ? 1 : 0;   // 孤立陆地兜底

  /* ---------- 3) 写回 World ---------- */
  world.solid.fill(0); world.rock.fill(0); world.river.fill(0);
  for (const c of cells) { if (H[c.id] > 0) world.fill(c, H[c.id], { rock: true }); world.river[c.id] = river[c.id]; }
  world.touch();
  world.riverFlow = { flowTo, paths, mouths: mouths.slice(), version: world.version, source: 'collapse-c09' };
  return { heights: H, river, flowTo, depth, parent, mouths, paths, riverCells, confluences, cliffs, forcedSteep, landCount };
}

/** 验收量：河长/弯曲度、陡边比例、局部洼地、流向单调、断流。 */
export function riverCollapseStats(world, res) {
  const cells = world.cells, n = cells.length, H = Int32Array.from(cells, (c) => world.ground(c));
  let landEdges = 0, steep = 0, gentle = 0, minima = 0, uphill = 0, broken = 0;
  for (const c of cells) {
    if (!H[c.id]) continue;
    let lower = false;
    for (const o of c.edgeNeighbors) {
      if (o < 0) continue;
      if (H[o] <= H[c.id] && (H[o] < H[c.id] || world.river[o] || !H[o])) lower = true;
      if (o > c.id && H[o]) { landEdges++; const d = Math.abs(H[o] - H[c.id]); if (d > 1) steep++; else gentle++; }
    }
    // 局部洼地：所有邻居都严格更高（平台按 BFS 父链判定，见下）
    if (c.edgeNeighbors.every((o) => o >= 0 && H[o] > H[c.id])) minima++;
  }
  // 排水：每个陆地格沿“不升”的边能走到河或海（反向 BFS）
  const reach = new Uint8Array(n), q = [];
  for (let i = 0; i < n; i++) if (!H[i] || world.river[i]) { reach[i] = 1; q.push(i); }
  for (let h = 0; h < q.length; h++) for (const o of cells[q[h]].edgeNeighbors) if (o >= 0 && !reach[o] && H[o] >= H[q[h]]) { reach[o] = 1; q.push(o); }
  let undrained = 0; for (let i = 0; i < n; i++) if (H[i] && !reach[i]) undrained++;
  // 河：沿 flowTo 下游高度不升，最终到河口（河口贴海）
  const F = res.flowTo;
  for (let i = 0; i < n; i++) if (world.river[i]) {
    if (F[i] >= 0 && H[F[i]] > H[i]) uphill++;
    let x = i, k = 0; while (F[x] >= 0 && k++ < n) x = F[x];
    if (!cells[x].edgeNeighbors.some((o) => o >= 0 && !H[o])) broken++;
  }
  const tort = res.paths.slice(0, 5).map((p) => {
    let arc = 0; for (let k = 1; k < p.length; k++) arc += len(sub(pos(cells[p[k]]), pos(cells[p[k - 1]])));
    const chord = len(sub(pos(cells[p[p.length - 1]]), pos(cells[p[0]]))) || 1;
    return +(arc / chord).toFixed(2);
  });
  return {
    riverCells: res.riverCells, rivers: res.mouths.length, branches: res.paths.length, confluences: res.confluences,
    longest: res.paths[0]?.length ?? 0, top5: res.paths.slice(0, 5).map((p) => p.length), tortuosity: tort,
    landEdges, steepEdges: steep, steepShare: +(steep / Math.max(1, landEdges)).toFixed(3), cliffsChosen: res.cliffs,
    minima, undrained, riverUphill: uphill, riverBroken: broken, maxLevel: Math.max(...H),
  };
}
