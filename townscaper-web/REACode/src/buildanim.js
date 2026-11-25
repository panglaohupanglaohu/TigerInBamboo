/**
 * buildanim.js — 「岛是怎么一块一块长出来的」：两条建造路径 + 加盖前的敞口黑洞。
 *
 * 三条片子放一起看，因为它们是同一件事的不同阶段（原文都只有闲话，没讲实现）：
 *   818857408848130048  "Excerpts from this weeks episode of Lets Redo All Environment Art"（2017-01-10）
 *                        → 零件一片片出现 → 合拢 → 最后才出现白岸线
 *   802496920790777856  （无文字，2016-11-26）                              → 中途出现**纯黑的敞口盒子**
 *   806856212260278272  "Maybe my game should be set on an island?"（2016-12-08）
 *                        → 底板先长出，再往上长，最后换色板
 *
 * ── 实测（tools/pixprobe.mjs area：数"与背景色差 >22 的像素占比"）──────────
 *   818（372×372, 34.8s）1.287s 0.09% → 2.186 2.03 → 3.487 4.81 → 3.986 15.43
 *                        → 4.087 21.81 → 4.186 **40.20** → 4.285 50.47（到底）
 *   806（506×508, 33.4s）3.289 15.47 → 3.789 26.08 → 3.889 26.10（停一帧）
 *                        → 4.189 39.01 → 4.589 59.12 → 4.689 **72.71** → 4.789 73.95（到底）
 *
 * 两条曲线形状**不一样**，这是本模块最重要的结论：
 *   · 818 归一化后是"斜坡 → 三级台阶"：0→18% 慢慢长，然后 30.6 / 43.2 / 79.7 / 100 一步一跳，
 *     最后 0.1s 里面积翻近一倍。单块模块不可能一次占掉四成画面，所以那只能是**整趟 pass 一次性提交**。
 *   · 806 归一化后基本是**直线**（0/1.8/6.5/13.5/18.1/20.6/32.4/40.3/54.5/61.5/74.6/100），
 *     没有台阶 —— 这是玩家拖拽建造的路径：逐格加，加多少看手速。
 * 所以模块化出两种模式：'drag'（连续逐格）和 'rebuild'（分趟，趟与趟之间 flush）。
 * 把这两条片子当成同一种动画去做，必然有一半对不上。
 *
 * ── 那个纯黑的盒子（802 的慢镜给的证据，帧间隔 0.1s）───────────────────
 * f004(1.488s) 与 f012(2.988s)：砖墙贴好、门洞窗洞都在，顶上却是一整片纯黑，
 * 量化到 #232222 / #1c1c1b（v≈0.12–0.14，饱和度 0.03），占画面 4.36%。
 * 它不是"另一种材质"：边界严格跟着楼层平面走，还能看到远处内墙的轮廓。
 * 也就是说**屋顶/盖板是后一趟才生成的**，在那之前建筑是个敞口盒子，
 * 你看到的是内表面在阴影里的颜色。所以这里不去模拟"半透明幽灵材质"，
 * 而是真的不画盖板、用实测的 #232222 填内部 —— 画面上无法区分，但后者才是真实成因，
 * 而且敞口态本身就是免费的"重建中"提示。
 *
 * ── 白岸线（818）──────────────────────────────────────────────────────
 * f014(4.285s) 白色像素仍是 0，f015(4.386s) 才有 —— 比最后一块盖板晚 0.1s，是**最后一趟**。
 * 带厚：水平游程中位数 7px / 岛宽 299px（bbox 32→331）= 2.3%，近白（L>0.94）且几乎无彩（sat<0.10）。
 * 所以它是"沿岛 footprint 外扩 2.3% 的一条描边"，不是水面的浪。
 */

/** 构建趟。at = 该趟结束时累计体量（占最终 100），mode = 该趟怎么提交。 */
export const PASSES = [
  { key: 'plate', label: '底板', at: 10, mode: 'stream', t0: 0 },
  { key: 'walls', label: '墙 / 门洞', at: 18, mode: 'stream', t0: 0.03 },
  // 后面三趟的**内容**片子分辨不出来（802 只证明"盖板晚于墙"），只知道是整批提交，
  // 所以标签只写它排在墙之后，不硬安名字。
  { key: 'decks', label: '盖板 / 屋顶', at: 43, mode: 'flush', t0: 0.933 },
  { key: 'batch', label: '第二批（线脚 / 台阶 / 门廊）', at: 80, mode: 'flush', t0: 0.966 },
  { key: 'foam', label: '岸线泡沫', at: 100, mode: 'flush', t0: 1.0 },
];

/** 片中实测的两条进度曲线（秒 → 面积 %）。 */
export const MEASURED = {
  818857408848130048: [[1.287, 0.09], [1.686, 0.84], [2.186, 2.03], [2.787, 3.02], [3.487, 4.81],
    [3.587, 5.12], [3.687, 7.05], [3.787, 8.96], [3.986, 15.43], [4.087, 21.81],
    [4.186, 40.2], [4.285, 50.47]],
  806856212260278272: [[3.289, 15.47], [3.489, 16.55], [3.589, 19.29], [3.689, 23.35], [3.789, 26.08],
    [3.889, 26.1], [3.989, 27.53], [4.089, 34.42], [4.189, 39.01], [4.288, 40.57],
    [4.389, 47.37], [4.489, 51.41], [4.589, 59.12], [4.689, 72.71], [4.789, 73.95]],
};

/** 敞口内部色：802 帧里量化到的两簇黑。 */
export const INTERIOR = '#232222';
export const INTERIOR_DARK = '#1c1c1b';

/** 岸线泡沫：带厚 / 岛宽 = 2.3%（818 量到 7px / 299px）。 */
export const FOAM = { widthRatio: 0.023, color: '#eef3f4', delayAfterDeck: 0.1 };

/**
 * 806 里同一栋建筑换了三套色板（f018/f019/f020）。
 * 关键不是三个颜色，而是**明度几乎不动、动的是色相和饱和**：
 *   陶土 #c46f58 h13 s0.55 v0.77 ／ 丁香 #b9acd5 h259 s0.19 v0.84 ／ 薄荷 #81dfba h156 s0.42 v0.87
 * 所以换色板 = 保 v、最短弧转 h、重映射 s。这也解释了片子里换色时"体块感不变、只是变了色"。
 */
export const PALETTES = {
  terracotta: { wall: '#c46f58', h: 13, s: 0.55, v: 0.77 },
  lilac: { wall: '#b9acd5', h: 259, s: 0.19, v: 0.84 },
  mint: { wall: '#81dfba', h: 156, s: 0.42, v: 0.87 },
};

/**
 * 体量权重。**这组是按实测曲线反解的，不是物理面积**（每趟一个参数，5 个参数对 11 个采样点）。
 * 反解的理由：真实像素面积由相机决定，换机位全变；而"每趟占最终体量的多少"是构建器的属性。
 * 既然拟合了，就必须给不拟合的基线做对照 —— lab 里同时算 'equal'（每块一样重）和
 * 'linear'（不分趟、匀速铺）两条基线的 RMS，模型的解释力 = 基线 RMS / 本模型 RMS。
 */
// 键是模块的 kind（不是 pass 名），线脚那趟的 kind 叫 trim —— 名字对不上就会静默退化成 1.0，
// 一开始就是这么错的：batch 那趟算出来只有 15.0，把台阶位置整体拖低了 5 个点。
export const WEIGHT = { plate: 0.16, wall: 0.17, deck: 0.5, trim: 1.45, foam: 0.29 };

/**
 * 造一个可建的小镇：footprint 是一块 10×10 的有机团（818 的岛就是这种轮廓），
 * 上面十几栋楼，每栋 1–5 层。模块按五趟分好。
 */
export function makeTown(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 10;
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - (N - 1) / 2, dy = y - (N - 1) / 2;
    const r = Math.hypot(dx, dy) + (rnd() - 0.5) * 1.6;   // 有机边界：半径带抖动
    if (r < 4.4) cells.push({ x, y });
  }
  const isCell = new Set(cells.map((c) => c.x + ',' + c.y));
  const modules = [];

  for (const c of cells) modules.push({ pass: 'plate', kind: 'plate', x: c.x, y: c.y, z: 0 });

  // 楼：越靠里越高（片子里的塔都在中间）
  const builds = [];
  for (const c of cells) {
    const d = Math.hypot(c.x - (N - 1) / 2, c.y - (N - 1) / 2);
    if (d > 3.1 || rnd() < 0.55) continue;
    builds.push({ ...c, floors: Math.max(1, Math.round(4.6 - d + rnd() * 1.2)) });
  }
  for (const b of builds) {
    for (let f = 0; f < b.floors; f++) {
      modules.push({ pass: 'walls', kind: 'wall', x: b.x, y: b.y, z: f, floors: b.floors });
    }
  }
  for (const b of builds) modules.push({ pass: 'decks', kind: 'deck', x: b.x, y: b.y, z: b.floors, floors: b.floors });
  for (const b of builds) modules.push({ pass: 'batch', kind: 'trim', x: b.x, y: b.y, z: b.floors, floors: b.floors });
  // 泡沫：只沿"有格子但邻居不是格子"的边，每条边一段
  for (const c of cells) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isCell.has((c.x + dx) + ',' + (c.y + dy))) {
        modules.push({ pass: 'foam', kind: 'foam', x: c.x, y: c.y, z: 0, dx, dy });
      }
    }
  }
  for (const m of modules) m.area = WEIGHT[m.kind] ?? 1;
  return { cells, builds, modules, N };
}

/** 把模块分趟；趟内按体量从小到大（818 的画面就是小碎片先落、大面后落）。 */
export function planBuild(modules) {
  const byPass = new Map(PASSES.map((p) => [p.key, []]));
  for (const m of modules) byPass.get(m.pass)?.push(m);
  const order = [];
  for (let i = 0; i < PASSES.length; i++) {
    const list = byPass.get(PASSES[i].key) || [];
    list.sort((a, b) => a.area - b.area);
    for (const m of list) order.push({ ...m, passIndex: i });
  }
  const total = order.reduce((s, m) => s + m.area, 0) || 1;
  return { order, total, counts: PASSES.map((p) => (byPass.get(p.key) || []).length) };
}

/** stream 趟的模块数 / (时长 × fps) —— 反解出的每帧配额。 */
export function calibrate(plan, durationSec, mode = 'rebuild', fps = 60) {
  if (mode === 'drag') return Math.max(0.001, plan.order.length / (durationSec * fps));
  // rebuild 模式：stream 只占前面一段，剩下的时间是几趟 flush 的落点。
  // 818 里 stream 段是 0→0.933（= 第一趟 flush 的 t0），所以分母要乘这个比例。
  const stream = plan.order.filter((m) => PASSES[m.passIndex].mode === 'stream').length;
  const firstFlush = PASSES.find((p) => p.mode === 'flush')?.t0 ?? 1;
  return Math.max(0.001, stream / (durationSec * firstFlush * fps));
}

/**
 * 构建状态机。mode：
 *   'rebuild' —— 818/802：stream 趟逐块弹，flush 趟按 PASSES[i].t0 到点整批提交
 *   'drag'    —— 806：全部逐块，没有 flush
 */
export function createBuild(plan, opts = {}) {
  return {
    plan,
    mode: opts.mode || 'rebuild',
    duration: opts.duration ?? 3,
    perFrame: opts.perFrame ?? calibrate(plan, opts.duration ?? 3, opts.mode || 'rebuild'),
    popped: 0,
    cursor: 0,
    acc: 0,
    t: 0,
    passAt: {},
  };
}

export function passIndexOf(st) {
  if (!st.popped) return -1;
  return st.plan.order[st.popped - 1].passIndex;
}

/** 盖板还没画 → 敞口盒，内部填 INTERIOR。802 的纯黑就是这么来的。 */
export function isOpenTop(st) {
  const pi = passIndexOf(st);
  return pi >= 0 && pi < PASSES.findIndex((p) => p.key === 'decks');
}

/** 泡沫只在最后一趟（818：比最后一块盖板晚 0.1s）。 */
export function foamVisible(st) {
  return passIndexOf(st) >= PASSES.findIndex((p) => p.key === 'foam');
}

/** 推进一步，返回本帧新放的模块。 */
export function stepBuild(st, dt) {
  st.t += dt;
  const out = [];
  // 预算必须累加：818 反解出来是 0.62 块/帧，直接跟 1 比就一块也放不出来（踩过）。
  st.acc += st.perFrame * dt * 60;
  const u = st.duration ? st.t / st.duration : 0;
  while (st.cursor < st.plan.order.length) {
    const m = st.plan.order[st.cursor];
    const P = PASSES[m.passIndex];
    if (st.mode === 'rebuild' && P.mode === 'flush') {
      if (u + 1e-6 < P.t0) break;                // 还没到这一趟的时间点
      while (st.cursor < st.plan.order.length && st.plan.order[st.cursor].passIndex === m.passIndex) {
        out.push(st.plan.order[st.cursor]);
        st.cursor++; st.popped++;
      }
      if (st.passAt[m.passIndex] === undefined) st.passAt[m.passIndex] = st.t;
      continue;
    }
    if (st.acc < 1) break;
    out.push(m);
    st.cursor++; st.popped++; st.acc -= 1;
    if (st.passAt[m.passIndex] === undefined) st.passAt[m.passIndex] = st.t;
  }
  return out;
}

/** 当前体量占最终体量的百分比。 */
export function areaPct(st) {
  let a = 0;
  for (let i = 0; i < st.popped; i++) a += st.plan.order[i].area;
  return (100 * a) / st.plan.total;
}

/**
 * 与实测比。baseline：
 *   'pass'  （默认）本模型
 *   'equal' 每块模块一样重（其余相同）—— 检验"权重"是不是必要的
 *   'linear'不分趟、匀速铺（其余相同）—— 检验"分趟 flush"是不是必要的
 * 返回 RMS 百分点与最大偏差点。
 */
export function compareCurve(plan, measured, durationSec, opts = {}) {
  const baseline = opts.baseline || 'pass';
  let use = plan;
  if (baseline === 'equal') use = { ...plan, order: plan.order.map((m) => ({ ...m, area: 1 })), total: plan.order.length };
  const mode = baseline === 'linear' ? 'drag' : (opts.mode || 'rebuild');
  const perFrame = calibrate(use, durationSec, mode);
  const st0 = { plan: use, mode, duration: durationSec, perFrame };

  const t0 = measured[0][0];
  const finalWant = measured[measured.length - 1][1] || 1;
  // 实测口径是"占画面 %"，模型是"占最终体量 %" → 把实测归一化到它自己的终值
  const samples = measured.map(([t, v]) => [(t - t0) / durationSec, (100 * v) / finalWant]);
  let sum = 0, worst = 0, worstAt = 0;
  for (const [u, want] of samples) {
    const probe = createBuild(st0.plan, { mode: st0.mode, duration: durationSec, perFrame });
    const steps = Math.round(u * durationSec * 60);
    for (let i = 0; i < steps; i++) stepBuild(probe, 1 / 60);
    const e = areaPct(probe) - want;
    sum += e * e;
    if (Math.abs(e) > Math.abs(worst)) { worst = e; worstAt = t0 + u * durationSec; }
  }
  return { rms: Math.sqrt(sum / samples.length), worst, worstAt, perFrame };
}

/** 归一化时间 → 模型曲线（lab 画对照图用）。 */
export function curveOf(plan, durationSec, n = 60, opts = {}) {
  const md = opts.mode || 'rebuild';
  const st = createBuild(plan, { mode: md, duration: durationSec, perFrame: calibrate(plan, durationSec, md) });
  const out = [];
  for (let i = 0; i <= n; i++) {
    // 均匀推进到 u=i/n
    while (st.t < (i / n) * durationSec - 1e-9) stepBuild(st, 1 / 60);
    out.push([i / n, areaPct(st)]);
  }
  return out;
}

/** 色板插值：保 v、最短弧转 h、重映射 s（806 的换色规律）。 */
export function mixPalette(a, b, t) {
  const k = t * t * (3 - 2 * t);
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const h = a.h + dh * k, s = a.s + (b.s - a.s) * k, v = a.v + (b.v - a.v) * k;
  return { h, s, v, css: `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${((v * (1 - s / 2)) * 100).toFixed(1)}%)` };
}
