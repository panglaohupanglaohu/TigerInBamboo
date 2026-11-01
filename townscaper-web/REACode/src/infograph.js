/**
 * infograph.js — 动态节点图：让一个小队"知道彼此知道什么"。
 *
 * 原文（x.com/OskSta/status/883447205176238083, 2017-07-07）：
 *
 *   "A dynamic node graph help the fellas keep track of their mates and share
 *    local info. Makes for somewhat more cohesive groups"
 *
 * 画面（24 帧）：一队蓝色小人在起伏的地形上走，前后拉成一条；
 * 个体头顶偶尔冒出小气泡图标（惊叹/问号那种），气泡是在**个体之间传递**的：
 * 前面的人先有，隔几帧后面的人也有了，然后整队转弯的动作变得一致。
 * 队形没有指挥者 —— 是相邻个体互看，信息沿相邻边扩散。
 *
 * 三个词拆开看：
 *   ① **dynamic graph**：边不是预建的，是每帧按距离重建。人走散了边就断，
 *      走一起了边就接上；所以叫"动态"。
 *   ② **local info**：信息只有"我看到了什么"，没有全局真相。个体只知道自己 + 邻居告诉它的。
 *   ③ **cohesive groups**：结果是队形更紧。原文用 "somewhat"，说明它在原项目里
 *      也只是辅助手段，不是主力寻路 —— 这里也照这个定位做：不替代 flow field，
 *      只负责"往哪边偏一点"。
 *
 * 我加的量化（原文没有）：同一批单位、同一个目标，只切换"有没有信息共享"这一项，
 * 比 10 秒后的平均两两距离与离群个体数。这样才能证明 "somewhat cohesive" 到底是多少。
 */

const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 单位：位置 + 速度 + 自己掌握的信息（信心 0..1）+ 邻居快照。 */
export function makeUnit(i, x, z, speed = 1.6) {
  const a = (i / 12) * TAU;
  return {
    id: i, x, z, vx: Math.cos(a) * 0.2, vz: Math.sin(a) * 0.2,
    speed, info: 0, neighbors: [], born: 0,
  };
}

/**
 * 每帧重建邻接（O(n²)，几十个单位足够；原文那个年代 Bad North 一队也就几十人）。
 * 半径 R 之外不连边 —— 这就是"local"。
 */
export function buildGraph(units, radius = 1.9) {
  for (const u of units) u.neighbors.length = 0;
  const r2 = radius * radius;
  let edges = 0;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz <= r2) {
        a.neighbors.push(j);
        b.neighbors.push(i);
        edges++;
      }
    }
  }
  let deg = 0, maxDeg = 0, isolated = 0;
  for (const u of units) {
    deg += u.neighbors.length;
    if (u.neighbors.length > maxDeg) maxDeg = u.neighbors.length;
    if (!u.neighbors.length) isolated++;
  }
  return {
    edges,
    avgDeg: +(deg / Math.max(1, units.length)).toFixed(2),
    maxDeg,
    isolated,
    components: componentCount(units),
  };
}

/** 连通块个数 —— 队形散成几坨，比"平均距离"更直观。 */
export function componentCount(units) {
  const seen = new Uint8Array(units.length);
  let n = 0;
  for (let i = 0; i < units.length; i++) {
    if (seen[i]) continue;
    n++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop();
      for (const j of units[k].neighbors) if (!seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  return n;
}

/**
 * 信息扩散：每帧一次，只能沿相邻边传，且按 hops 限制次数、按 decay 衰减。
 * 这就是"share local info"的全部机制 —— 没有广播，没有全局状态。
 */
export function spreadInfo(units, { hops = 2, decay = 0.55, sources = null } = {}) {
  // 源点必须先落进这一帧的初值，否则"我刚看见"要等下一帧才传得出去，
  // 于是整条扩散链每帧都慢一拍（第一版就是这样，单帧测试里邻居恒为 0）。
  const next = units.map((u, i) => (sources ? Math.max(u.info, sources[i] || 0) : u.info));
  for (let h = 0; h < hops; h++) {
    const cur = next.slice();
    for (let i = 0; i < units.length; i++) {
      for (const j of units[i].neighbors) {
        const v = cur[j] * decay;
        if (v > next[i]) next[i] = v;
      }
    }
  }
  for (let i = 0; i < units.length; i++) units[i].info = next[i];
  return units;
}

/**
 * 一步移动。两个都要有，否则看不出差别：
 *   · seek：朝目标走（所有人一样，这是"没有共享"的基线）
 *   · coherence：朝**邻居的平均位置**偏一点，权重 = 自己掌握的信息 × 系数。
 *     信息越足越敢跟队伍走 —— 这正是原文把 "local info" 与 "cohesive" 连起来的那一步。
 */
export function stepUnits(units, { target, dt = 1 / 60, share = true, cohGain = 1.5, sepGain = 0.8, noise = 0.35, rnd = Math.random } = {}) {
  for (const u of units) {
    const dx = target.x - u.x, dz = target.z - u.z;
    const d = Math.hypot(dx, dz) || 1;
    let ax = (dx / d) * u.speed;
    let az = (dz / d) * u.speed;

    // 朝邻居平均位置（只在 share 打开时，且用邻居的"知识"加权）
    if (share && u.neighbors.length) {
      let mx = 0, mz = 0, w = 0;
      for (const j of u.neighbors) {
        const n = units[j];
        const ww = 0.4 + n.info;      // 邻居越有信息，我越信它
        mx += n.x * ww; mz += n.z * ww; w += ww;
      }
      mx /= w; mz /= w;
      const cdx = mx - u.x, cdz = mz - u.z;
      const cd = Math.hypot(cdx, cdz) || 1;
      // 离得越远拉得越用力，但封顶在 cohGain
      const k = cohGain * Math.min(1, cd / 1.6) * (0.35 + u.info);
      ax += (cdx / cd) * k;
      az += (cdz / cd) * k;
    }

    // 硬分离：任意两人不许重叠（这条不管 share 开不开，否则会糊成一坨）
    for (const j of u.neighbors) {
      const n = units[j];
      const sx = u.x - n.x, sz = u.z - n.z;
      const sd = Math.hypot(sx, sz) || 1;
      if (sd < 0.52) { ax += (sx / sd) * sepGain; az += (sz / sd) * sepGain; }
    }

    ax += (rnd() - 0.5) * noise;
    az += (rnd() - 0.5) * noise;

    const sp = Math.hypot(ax, az) || 1;
    const lim = u.speed * (share ? 1.15 : 1.0);
    u.vx += ((ax / sp) * lim - u.vx) * Math.min(1, dt * 6);
    u.vz += ((az / sp) * lim - u.vz) * Math.min(1, dt * 6);
    u.x += u.vx * dt;
    u.z += u.vz * dt;
  }
}

/** 队形紧凑度：平均两两距离 + 离质心的最远距离（离群）。 */
export function cohesion(units) {
  let sx = 0, sz = 0;
  for (const u of units) { sx += u.x; sz += u.z; }
  const cx = sx / units.length, cz = sz / units.length;
  let pairs = 0, np = 0, far = 0;
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    far = Math.max(far, Math.hypot(a.x - cx, a.z - cz));
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      pairs += Math.hypot(a.x - b.x, a.z - b.z); np++;
    }
  }
  return {
    meanPairDist: +(pairs / Math.max(1, np)).toFixed(3),
    radius: +far.toFixed(3),
    // 归一化紧凑度：1 表示全部挤在 0.5 内
    tight: +(1 / (1 + pairs / Math.max(1, np))).toFixed(3),
  };
}

/**
 * A/B：同一 seed、同一目标、同样的随机噪声序列，只切换 share。
 * 返回两条时间序列，供页面画对比线，也供测试逐项对账。
 */
export function simulateAB({ count = 24, seconds = 10, dt = 1 / 60, seed = 11, radius = 1.9, cohGain = 1.5 } = {}) {
  const run = (share) => {
    const rnd = mulberry32(seed);
    const units = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const r = 1.1 + rnd() * 0.7;
      units.push(makeUnit(i, Math.cos(a) * r, Math.sin(a) * r, 1.55 + rnd() * 0.25));
    }
    const target = { x: 9.5, z: 2.2 };
    const series = [];
    let graph = null;
    const steps = Math.round(seconds / dt);
    for (let s = 0; s < steps; s++) {
      graph = buildGraph(units, radius);
      // 信息源：最靠前的三个人"看见了路"
      if (share) {
        const front = units.slice().sort((a, b) => Math.hypot(b.x - target.x, b.z - target.z) - Math.hypot(a.x - target.x, a.z - target.z)).slice(0, 3);
        const src = units.map((u) => (front.includes(u) ? 1 : 0));
        spreadInfo(units, { hops: 2, decay: 0.55, sources: src });
      } else {
        for (const u of units) u.info = 0;
      }
      stepUnits(units, { target, dt, share, cohGain, rnd });
      if (s % 30 === 0) {
        const c = cohesion(units);
        series.push({ t: +(s * dt).toFixed(2), ...c, edges: graph.edges, comps: graph.components, isolated: graph.isolated });
      }
    }
    return { units, series, last: series[series.length - 1], graph };
  };
  const withShare = run(true);
  const without = run(false);
  const a = without.last, b = withShare.last;
  return {
    withShare, without,
    report: {
      shareMeanDist: b.meanPairDist, plainMeanDist: a.meanPairDist,
      distDropPct: +(((a.meanPairDist - b.meanPairDist) / a.meanPairDist) * 100).toFixed(1),
      shareRadius: b.radius, plainRadius: a.radius,
      radiusDropPct: +(((a.radius - b.radius) / a.radius) * 100).toFixed(1),
      shareComps: b.comps, plainComps: a.comps,
      shareEdges: b.edges, plainEdges: a.edges,
    },
  };
}
