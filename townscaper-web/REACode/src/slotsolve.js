/**
 * slotsolve.js — "SLOTS" 面板背后该是什么：每个槽位放的是**候选集**，不是一块砖。
 *
 * 帖子 ID：865200072685912064（2017-05-18，无原文字，仅有视频）
 *   画面（6 帧，640×480，深灰紫底）：标题 "SLOTS"，下面一张 10 列 × 8 行的槽位表，
 *   每格是一张等大的小缩略图（天蓝底 + 赭红拱形 + 沙色台基），80 格**长得一模一样**；
 *   底部三个按钮 RESET / SOLVE /（第三个是暗的、不可点）。
 *   六帧内容完全相同 —— 这是一个**静态的求解器调试视图**，不是动画。
 *
 * 为什么从这个 UI 形状反推出"候选集 + 弧相容"：
 *   · 一个槽位画一张缩略图，而不是画一格地形 —— 说明它显示的是"这一格**可以**是什么"；
 *     80 格全同，正是"还没做任何决定"的状态（候选集未收缩）。
 *   · 只有 RESET 和 SOLVE 两个可点按钮：RESET 复原候选集、SOLVE 跑求解，
 *     中间没有"手动填一格"的按钮 —— 决定权在求解器手上。
 *   · 第三个按钮是暗的 —— 求解还没跑，依赖它的下一步没解锁。
 *   这三条是**推断**，不是原文结论；所以在下面把机制写成可测的形式，让数字说话：
 *   未求解时每格候选数 = 池子大小，求解后 = 1，且相邻格的共享边必须相等。
 *
 * 机制（可测）：
 *   1. 边缘值 = 两个角点的值之和 mod K —— 这样"相邻格共享边相等"是**构造保证**的，
 *      而不是碰运气。真实地形里同一条棱本来就只有一份数据，两边各自读它。
 *   2. 一部分槽位是给定的（已经长出来的房子 / 岸线格），其余 24 个变体全开。
 *   3. SOLVE = AC-3 弧相容传播 + 最小熵优先决定 + 回溯。
 *      并列时按**槽位下标**决定，不按遍历顺序 —— 否则实现细节（数组顺序）会泄进结果，
 *      RESET 再 SOLVE 会长出另一个镇子（gridwfc.js 那条帖子踩过的同一个坑）。
 */

export const K = 3; // 每条边的取值档数：平 / 凸 / 凹

/** 角点四元组 → 四个边值。n=(v00+v10), e=(v10+v11), s=(v01+v11), w=(v00+v01)，全 mod K。 */
function quad(v00, v10, v11, v01) {
  return [(v00 + v10) % K, (v10 + v11) % K, (v01 + v11) % K, (v00 + v01) % K];
}

/** 全部可实现的变体（去重）。边序固定为 [N, E, S, W]。 */
export function variants() {
  const seen = new Map();
  for (let a = 0; a < K; a++)
    for (let b = 0; b < K; b++)
      for (let c = 0; c < K; c++)
        for (let d = 0; d < K; d++) {
          const e = quad(a, b, c, d);
          const key = e.join('');
          if (!seen.has(key)) seen.set(key, { id: seen.size, edges: e, corners: [a, b, c, d] });
        }
  return [...seen.values()];
}

/** 确定性伪随机（xorshift32），seed 相同 → 网格相同。 */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * 造一张槽位表。cols×rows。
 * 先在角点上撒一套值（真值），再按真值切出每格变体 —— 所以真值本身一定自洽。
 * 然后把 nGiven 个槽位"给定"（就是游戏里已经长出来的那几格）。
 */
export function makeGrid(cols, rows, seed = 7, givenRatio = 0.18) {
  const V = variants();
  const rand = rng(seed);
  const corner = []; // (cols+1) × (rows+1)
  for (let y = 0; y <= rows; y++) {
    corner[y] = [];
    for (let x = 0; x <= cols; x++) corner[y][x] = Math.floor(rand() * K);
  }
  const truth = [];
  for (let y = 0; y < rows; y++) {
    truth[y] = [];
    for (let x = 0; x < cols; x++) {
      const e = quad(corner[y][x], corner[y][x + 1], corner[y + 1][x + 1], corner[y + 1][x]);
      truth[y][x] = V.findIndex((v) => v.edges.join('') === e.join(''));
    }
  }
  // 给定：确定性挑 (givenRatio) 的槽位，避开四角各留一个自由格，保证传播范围看得见
  const slots = [];
  for (let y = 0; y < rows; y++) {
    slots[y] = [];
    for (let x = 0; x < cols; x++) {
      const given = rand() < givenRatio;
      slots[y][x] = {
        x, y,
        given,
        truth: truth[y][x],
        cand: given ? [truth[y][x]] : V.map((v) => v.id),
      };
    }
  }
  return { cols, rows, slots, variants: V, seed };
}

/** 两个相邻槽位的候选能不能并排：共享边相等。dir: 0=E,1=S */
function edgeOk(va, vb, dir) {
  if (dir === 0) return va.edges[1] === vb.edges[3]; // a.E == b.W
  return va.edges[2] === vb.edges[0];                // a.S == b.N
}

/** 只做弧相容（AC-3），不改真值 —— 用来量"光靠给定格能推出多少"。 */
export function propagate(grid, budget = 400000) {
  const { cols, rows, slots, variants: V } = grid;
  const domain = slots.map((r) => r.map((s) => s.cand.slice()));
  let checks = 0, killed = 0;
  const queue = [];
  const push = (x, y) => { if (x >= 0 && y >= 0 && x < cols && y < rows) queue.push([x, y]); };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) push(x, y);
  while (queue.length && checks < budget) {
    const [x, y] = queue.shift();
    const d = domain[y][x];
    const keep = [];
    for (const id of d) {
      const va = V[id];
      let ok = true;
      // 四个邻居都得有至少一个候选能对上
      for (const [dx, dy, dir, flip] of [[1, 0, 0, 0], [-1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        let any = false;
        for (const nid of domain[ny][nx]) {
          checks++;
          const vb = V[nid];
          const good = flip ? edgeOk(vb, va, dir) : edgeOk(va, vb, dir);
          if (good) { any = true; break; }
        }
        if (!any) {
          // 邻居本身已经空了 → 死路，这块也别留
          ok = false; break;
        }
      }
      if (ok) keep.push(id);
    }
    if (keep.length !== d.length) {
      killed += d.length - keep.length;
      domain[y][x] = keep;
      if (keep.length === 0) return { domain, checks, killed, ok: false, reason: '空域' };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(x + dx, y + dy);
    }
  }
  return { domain, checks, killed, ok: true };
}

/** 回溯求解：最小熵优先，并列按下标；返回解 + 搜索统计。 */
export function solve(grid, opt = {}) {
  const { cols, rows, slots, variants: V } = grid;
  const dom0 = slots.map((r) => r.map((s) => s.cand.slice()));
  const stats = { decisions: 0, backtracks: 0, checks: 0, nodes: 0 };
  const maxNodes = opt.maxNodes || 20000;

  const consistent = (dom, x, y, id) => {
    const va = V[id];
    for (const [dx, dy, dir, flip] of [[1, 0, 0, 0], [-1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      let any = false;
      for (const nid of dom[ny][nx]) {
        stats.checks++;
        const vb = V[nid];
        if (flip ? edgeOk(vb, va, dir) : edgeOk(va, vb, dir)) { any = true; break; }
      }
      if (!any) return false;
    }
    return true;
  };

  const rec = (dom, depth) => {
    stats.nodes++;
    if (stats.nodes > maxNodes) return null;
    // 先传播到不动点，再挑熵最小的格子
    let best = null;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const n = dom[y][x].length;
        if (n === 0) return null;
        if (n > 1 && (!best || n < best.n)) best = { x, y, n }; // 严格小于 → 并列取最靠前（下标序）
      }
    if (!best) return dom;
    stats.decisions++;
    for (const id of dom[best.y][best.x].slice()) {
      const next = dom.map((r) => r.map((c) => c.slice()));
      next[best.y][best.x] = [id];
      if (!consistent(next, best.x, best.y, id)) continue;
      const r = rec(next, depth + 1);
      if (r) return r;
      stats.backtracks++;
    }
    return null;
  };
  const y0 = (b) => b.y;

  const sol = rec(dom0, 0);
  return { solution: sol, stats, ok: !!sol };
}

/** 一批可读的数字。lab 与 node 都用它，避免两套口径。 */
export function measure(grid) {
  const { cols, rows, slots, variants: V } = grid;
  const total = cols * rows;
  const given = slots.flat().filter((s) => s.given).length;
  const before = slots.flat().filter((s) => !s.given).reduce((a, s) => a + s.cand.length, 0);
  const p = propagate(grid);
  const afterProp = p.domain.flat().reduce((a, d) => a + d.length, 0);
  const solved = p.ok ? solve(grid) : { ok: false };
  let singles = 0, wrong = 0, broken = 0, candSum = 0;
  if (solved.ok) {
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const d = solved.solution[y][x];
        candSum += d.length;
        if (d.length === 1) singles++;
        if (d.length === 1 && d[0] !== slots[y][x].truth) wrong++;
      }
    // 边相容复核：所有内部棱两边值相等
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const a = V[solved.solution[y][x][0]];
        if (x + 1 < cols) {
          const b = V[solved.solution[y][x + 1][0]];
          if (a.edges[1] !== b.edges[3]) broken++;
        }
        if (y + 1 < rows) {
          const b = V[solved.solution[y + 1][x][0]];
          if (a.edges[2] !== b.edges[0]) broken++;
        }
      }
  }
  // 确定性：同 seed 同参数再跑一遍，逐格比对
  const g2 = makeGrid(cols, rows, grid.seed, 0.18);
  const p2 = propagate(g2);
  const s2 = p2.ok ? solve(g2) : { ok: false };
  let same = 0, diff = 0;
  if (solved.ok && s2.ok) {
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (solved.solution[y][x][0] === s2.solution[y][x][0]) same++; else diff++;
      }
  }
  return {
    total, given, free: total - given,
    pool: V.length,
    beforeAvg: +(before / Math.max(1, total - given)).toFixed(2),
    afterPropAvg: +(afterProp / total).toFixed(2),
    solvedAvg: solved.ok ? +(candSum / total).toFixed(2) : null,
    singles, wrong, broken,
    checks: p.checks, killed: p.killed,
    decisions: solved.ok ? solved.stats.decisions : 0,
    backtracks: solved.ok ? solved.stats.backtracks : 0,
    deterministic: solved.ok && s2.ok ? diff === 0 : null,
    same, diff,
    solved, propagation: p,
  };
}
