/**
 * traffic.js — 窄道里的"左侧通行"，以及给窄道画点线。
 *
 * 原文两条（同一段 Bad North 开发期，2017-06/07）：
 *
 * 880853661936734211（2017-06-30）
 *   "Units got stuck when meeting in narrow passages. I fixed it by introducing
 *    left handed traffic. Never felt so clever."
 * 886199305522085890（2017-07-15）
 *   "Dotted lines to mark narrow passages. Helps you understand what path the
 *    enemies might chose"
 *
 * 画面 880853661936734211（24 帧，460×460，俯视微斜）：
 *   · 紫色岩壁夹出一条 L 形走廊，地面浅黄沙地；
 *   · 两队蓝色小人：一队从左上往右下，一队从右下往左上，**各走各的一侧**；
 *     第 5~7 帧能看到两队擦肩而过时中间留出一条缝，谁也没停；
 *   · 交汇处地面有一块浅黄高亮方块（第 6~11 帧），像在标"这里就是冲突点"。
 *
 * 画面 886199305522085890（24 帧，420×420，等距俯视）：
 *   · 台的边缘一圈**白色小圆点**，等距排列；点线沿着崖顶窄边绕过去，
 *     在两块台地之间的窄脊上特别密（f010 最清楚）；
 *   · 点不是连续的线，是独立的圆点，直径约 5px、间距约 16~20px。
 *     台地宽约 380px 跨 24 格左右 → 一格 ≈ 16px，**所以点距≈1 格**（估计值，
 *     不能再准了：透视让远处的格缩得厉害）。
 *   · 点只画在"窄"的地方，宽广场地上没有 —— 这就是它在解决的问题：
 *     玩家（和寻路）要能一眼看出哪里是瓶颈。
 *
 * 为什么这样做（不是"随手加个偏移"）：
 *   两条片子讲的是同一件事的两半 —— 第一条是**规则**（窄道里靠左走，避免对冲），
 *   第二条是**可视化**（把"窄"这件事本身画出来，让玩家预判敌人会走哪）。
 *   两者都依赖同一个前提：先知道哪条链路是"窄道"。
 *
 *   本项目里"窄"的定义不靠关卡名/手工标注，靠**几何度数**：
 *   在可行走图上，一条格子链若每个格子的可行走邻居数 == 2（前一个、后一个），
 *   它就在一条走廊里；连续 ≥3 个这样的格子就是一段窄道（passage）。
 *   这和 795010582239997952 那条"从网格里抽邻接、别用命名约定"是同一个思路。
 *
 * 左侧通行在数学上就是把"横向目标偏移"从 0 改成 ±lane：
 *   沿走廊方向 +s 走的单位把横向目标钉在 +lane，沿 -s 走的钉在 -lane。
 *   注意两边都是"各自的左侧"，落到世界坐标就是**相反的两侧**，于是让开了。
 *   如果两边都钉在 0（=没规则），对冲时互相挡死 —— 这就是原文说的 "got stuck"。
 *
 * 这个文件不 import three，纯几何 + 一个确定性的 1D 走廊模拟，
 * 方便在 node 里量：卡死事件数、平均通过时间、点线间距。
 */

/**
 * 从可行走图里抽窄道（走廊）。
 *
 * @param {object} opts
 * @param {(i:number)=>number[]} opts.neighbors 返回格子 i 的可行走邻居 id 列表
 * @param {number} opts.n 格子数
 * @param {number} [opts.minLen] 连续度-2 格子至少多少个才算一段窄道
 * @returns {{passages:Array<{cells:number[], entry:number, exit:number, len:number}>, narrowCell:Uint8Array, degree:Uint8Array}}
 */
export function extractPassages({ neighbors, n, minLen = 3 }) {
  const degree = new Uint8Array(n);
  for (let i = 0; i < n; i++) degree[i] = neighbors(i).length;

  const narrowCell = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (degree[i] === 2) narrowCell[i] = 1;

  // 把度-2 的格子按"链"连起来：从每个度-2 格子出发，向两个方向各走到底。
  const seen = new Uint8Array(n);
  const passages = [];
  for (let i = 0; i < n; i++) {
    if (!narrowCell[i] || seen[i]) continue;
    // 只从"链的一头"起走：邻居里如果也有度-2 且没走过，说明 i 不是头。
    const chain = [i];
    seen[i] = 1;
    for (const dirStart of [0, 1]) {
      let cur = i, prev = -1;
      // dirStart=0 往"第一个非窄邻居"那侧走？不需要：两个方向都试着延伸即可，
      // 但每次只沿一个分支走，避免分叉（度-2 保证不会分叉）。
      void dirStart;
      for (;;) {
        const nb = neighbors(cur).filter((j) => j !== prev);
        const nxt = nb.find((j) => narrowCell[j] && !seen[j]);
        if (nxt === undefined) break;
        seen[nxt] = 1;
        if (dirStart === 0) chain.unshift(nxt); else chain.push(nxt);
        prev = cur; cur = nxt;
      }
    }
    if (chain.length >= minLen) {
      passages.push({
        cells: chain,
        entry: chain[0],
        exit: chain[chain.length - 1],
        len: chain.length,
      });
    }
  }
  return { passages, narrowCell, degree };
}

/**
 * 点线：沿折线按固定弧长撒点。
 *
 * 原文片子量出来的间距 ≈ 1 格（点径 ≈ 0.3 格）。这里给 spacing 显式参数，
 * 默认取 1.0，方便和"一格"对齐（像片子那样每格一颗）。
 *
 * @param {Array<{x:number,z:number}>} polyline
 * @param {number} spacing 弧长间距（世界单位）
 * @param {number} [phase] 起始相位，用来让多段窄道的点不对齐
 * @returns {Array<{x:number,z:number,t:number}>}
 */
export function passageDots(polyline, spacing = 1.0, phase = 0) {
  const out = [];
  if (polyline.length < 2 || spacing <= 0) return out;
  let carry = phase * spacing;   // 距离下一个点还差多少
  for (let i = 0; i + 1 < polyline.length; i++) {
    const a = polyline[i], b = polyline[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const seg = Math.hypot(dx, dz);
    if (seg < 1e-9) continue;
    let s = carry;
    while (s <= seg) {
      const t = s / seg;
      out.push({ x: a.x + dx * t, z: a.z + dz * t, t: (i + t) / (polyline.length - 1) });
      s += spacing;
    }
    carry = s - seg;
  }
  return out;
}

/**
 * 走廊模拟：一条宽 2 的走廊，两队人相向而行。
 *
 * 模型刻意做得能被手算复核：
 *   · 走廊长 L（沿 s 轴），宽 2（横向 t ∈ [-1, 1]）；
 *   · 每个单位有 s（前进量）和 t（横向偏移），t 向目标值收敛（每步 0.25）；
 *   · 前方 1.0 以内、横向差 < 0.55 的单位算"占同一条车道"；若对方是迎面
 *     （方向点积 < 0），两边都停 —— 这就是 "stuck"；
 *   · 开了左侧通行后，t 的目标是 ±lane，两队分处两侧，横向差 0.9 > 0.55，不再挡。
 *
 * @returns {{deadlocks:number, meanTime:number, throughput:number, stuckPairs:number, passes:number}}
 */
export function createCorridor({
  lane = 0.45,
  lateralBlock = 0.55,
  lookAhead = 1.0,
  speed = 0.08,
  length = 40,
  nAgents = 12,
  useLanes = true,
  spacing = 1.5,
} = {}) {
  const agents = [];
  for (let i = 0; i < nAgents; i++) {
    const forward = i % 2 === 0;
    agents.push({
      s: forward ? 2 + (i >> 1) * spacing : length - 2 - (i >> 1) * spacing,
      t: 0,
      dir: forward ? 1 : -1,
      goal: forward ? length : 0,
      done: false,
      enter: 0,
      exit: -1,
      stuckSteps: 0,
      team: forward ? 0 : 1,
    });
  }

  // 左侧通行：沿 +s 走的靠 +t 侧；沿 -s 走的靠 -t 侧（各自的"左"）。
  // 两边都这么钉，落到世界坐标就是相反的两侧 —— 这就是让开的原因。
  const laneTarget = (a) => (useLanes ? a.dir * lane : 0);

  // 开局就站到自己那一侧（而不是从中间慢慢挪过去）。
  // 坑：初版 t 全从 0 起步，前两步所有人都在中线附近，于是"还没让开"的瞬间
  // 也被记成一次对冲 —— 页面 HUD 上 lanes=LEFT 却显示 deadlocks=6，把结论带偏了。
  // 片子里的单位一开始就已经在各自车道上走，所以初值就应该是车道位置。
  for (const a of agents) a.t = laneTarget(a);

  const state = { step: 0, deadlocks: 0, stuckPairs: 0, set: new Set(), lane, lateralBlock, lookAhead, speed, length };

  /** 推进一个时间步（dt 以"一步"为单位，默认 1）。返回 {moved, blocked}。 */
  function step(dt = 1) {
    let moved = 0, blocked = 0;
    for (const a of agents) {
      if (a.done) continue;
      const target = laneTarget(a);
      a.t += Math.max(-0.25 * dt, Math.min(0.25 * dt, target - a.t));

      // 前方 lookAhead 内、同车道的迎面单位
      let blockedBy = null;
      for (const b of agents) {
        if (b === a || b.done) continue;
        const ds = (b.s - a.s) * a.dir;
        if (ds <= 0 || ds > lookAhead) continue;
        if (Math.abs(b.t - a.t) >= lateralBlock) continue;
        if (b.dir === a.dir) continue;              // 同向只是跟车，不算对冲
        blockedBy = b; break;
      }
      if (blockedBy) {
        blocked++; a.stuckSteps++;
        const ia = agents.indexOf(a), ib = agents.indexOf(blockedBy);
        const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`;
        if (!state.set.has(key)) { state.set.add(key); state.deadlocks++; state.stuckPairs++; }
        continue;
      }
      a.s += speed * dt * a.dir;
      moved++;
      if (!a.done && ((a.dir > 0 && a.s >= a.goal) || (a.dir < 0 && a.s <= a.goal))) {
        a.done = true; a.exit = state.step;
      }
    }
    state.step++;
    return { moved, blocked };
  }

  return { agents, state, step, laneTarget };
}

/**
 * 跑到所有人通过为止，出统计。
 * @returns {{deadlocks:number, meanTime:number, throughput:number, stuckPairs:number, passes:number, steps:number, lanes:string}}
 */
export function corridorSim(opts = {}) {
  const { maxSteps = 4000, useLanes = true, nAgents = 12 } = opts;
  const sim = createCorridor({ ...opts, useLanes, nAgents });
  let step = 0;
  for (; step < maxSteps; step++) {
    const { moved, blocked } = sim.step();
    if (sim.agents.every((a) => a.done)) break;
    // 全卡住：提前收工（否则会空转到 maxSteps）
    if (moved === 0 && blocked > 0) break;
  }
  const done = sim.agents.filter((a) => a.done);
  const times = done.map((a) => a.exit - a.enter);
  return {
    deadlocks: sim.state.deadlocks,
    stuckPairs: sim.state.stuckPairs,
    passes: done.length,
    meanTime: times.length ? times.reduce((s, v) => s + v, 0) / times.length : NaN,
    steps: step,
    throughput: done.length / (step || 1),
    lanes: useLanes ? 'left' : 'none',
  };
}

/**
 * 自检：把"有没有左侧通行"当成 A/B，量卡死对数和平均通过时间。
 */
export function selfCheck() {
  const off = corridorSim({ useLanes: false });
  const on = corridorSim({ useLanes: true });
  return {
    off, on,
    deadlockDrop: off.deadlocks ? 1 - on.deadlocks / off.deadlocks : 0,
    timeDrop: Number.isFinite(off.meanTime) && Number.isFinite(on.meanTime)
      ? 1 - on.meanTime / off.meanTime : NaN,
  };
}
