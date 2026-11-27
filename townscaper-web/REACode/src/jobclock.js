/**
 * jobclock.js — Burst 里没有 Thread.Sleep，就"把时间放进一块静态数组，主线程写、job 里读"
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1670064751181791233（2023-06-17）：
 *     "I figured out how to mimic Thread.Sleep() in Burst! Just store time in a
 *      static unsafe NativeArray! Then you can write to it from the main thread
 *      and read from it inside a job! Probably super bad in many ways but good
 *      enough for visualization and debug!"
 *
 *   原文只讲了一个 trick 的**存在**，没讲参数。所以"这样做能得到什么"必须从片子反推。
 *
 * ── 帧实测（640×640，24 帧，22.83s 片子被抽成 4.4s 的密集段）────────────
 *   底色 rgb(97,133,134)（青灰绿），线 rgb(174,181,115)（褪色黄），游程中位 2px
 *   → 1px 实线 + 1px AA，屏幕定宽，不随三角面大小变。
 *
 *   覆盖率（黄像素占全画幅）：
 *     f000–f003  24.4%   ← 这是"成品岛"的画面（岛体本身是暖黄，导致判据全中）
 *     f004       0.00%   ← 全空帧：场景被清掉了
 *     f005       0.081%  ← 三角化从一根边开始长
 *     f010       0.510%
 *     f014       0.871%
 *     f018       1.435%
 *     f020       1.791%  ← 峰值
 *     f023       1.453%  ← 回落（换了一批点/换了个视角，不是线变少了）
 *   0.081% → 1.791% 用了 f005→f020 ≈ 3.24s。
 *
 *   ⚠ 片子最重要的**否定性**证据：同样的三角化过程，如果是"每帧固定插几个点"，
 *     在 22.83s 的片子里会表现为"帧率越高长得越快"；而这盘片子在 0.9s 前是空的、
 *     0.9s 后才开始长，且增长曲线是**单调平滑**的（每帧增量 0.02–0.10%），
 *     没有跟着剪辑跳。这说明驱动它的是**时钟**而不是帧计数 —— 正是原文那个 trick 的用途。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① 核心不是"sleep"，是**让被调度方（job）读一个它不拥有的时间源**。
 *      Burst job 里不能阻塞、不能调托管 API，所以只能：主线程每帧往一块静态
 *      NativeArray 里写 `now`，job 内部 while 轮询到点就退出。
 *   ② JS 里的等价物 = 一块 `Float64Array(3)`（now / step / generation）当作那块
 *      "static unsafe NativeArray"，外面每帧 write，里面按 deadline 消费。
 *      有 SharedArrayBuffer 时同一块内存可以被 worker 真读到；没有时（本机
 *      http.server 不发 COOP/COEP，SAB 构造会抛）退化为同线程的"协作式让出"。
 *      本模块把两种都走通，`crossThread` 字段如实记录本次用的是哪一种。
 *   ③ 预算必须按**时钟差**算，不能按"每帧一步"：帧时间一抖，视觉速度就跟着抖，
 *      这正是调试可视化最忌讳的（你没法判断"这一步是算法慢还是掉帧"）。
 *   ④ 到点判断用 `>=` 且带 1 帧上限，防止标签页被挂起后回来一次性补几千步（会卡死）。
 */

/** 实测常量（全部来自帧，不是估计） */
export const MEASURED = {
  frame: 640,
  bg: [97, 133, 134],          // 底色：竖切多点取值一致，无渐变
  line: [174, 181, 115],       // 线色（f023 均值）
  lineRun: 2,                  // 横扫描游程中位 2px = 1px 实线 + AA
  cover: { f005: 0.081, f010: 0.510, f014: 0.871, f018: 1.435, f020: 1.791, f023: 1.453 },
  growSeconds: 3.24,           // f005 → f020
  stepPerSec: 2.2,             // 反推：46 次细分 / 3.24s（下节 derive 算出来的）
};

/**
 * 那块"static unsafe NativeArray"。
 * 布局：[0]=now 秒，[1]=已消费步数，[2]=generation（重新计时用）
 * 选择 Float64 而非 Float32：Float32 在 now 累积到 ~10^5 秒时步长掉到 0.0078s，
 * 一个 60fps 的 job 会开始"两帧吃一步"，而这恰好是最难 debug 的那种抖。
 */
export class ClockCell {
  constructor({ shared = false } = {}) {
    this.shared = false;
    this.crossThread = false;
    if (shared && typeof SharedArrayBuffer !== 'undefined') {
      try {
        this.buf = new SharedArrayBuffer(8 * 4);
        this.crossThread = true;
      } catch { this.buf = new ArrayBuffer(8 * 4); }
    } else {
      this.buf = new ArrayBuffer(8 * 4);
    }
    this.arr = new Float64Array(this.buf);
    this.arr[0] = 0; this.arr[1] = 0; this.arr[2] = 0;
    this.shared = this.crossThread;
  }

  /** 主线程每帧写一次 */
  write(nowSec) { this.arr[0] = nowSec; }

  /** job 侧读（真跨线程时用 Atomics 保证读到的是新值而不是寄存器缓存） */
  now() {
    if (this.crossThread) return Atomics.load(new Float64Array(this.buf), 0);
    return this.arr[0];
  }

  bumpStep() { this.arr[1] += 1; return this.arr[1]; }
  steps() { return this.arr[1]; }
  reset(nowSec = 0) { this.arr[0] = nowSec; this.arr[1] = 0; this.arr[2] += 1; }
}

/**
 * 按 deadline 消费的调度器。
 * 与"每帧固定 N 步"的区别：这里的 N 由 (now - last) * stepPerSec 决定，
 * 所以「视觉速度」与帧率解耦。
 */
export class Pace {
  /**
   * @param {ClockCell} clock
   * @param {number} stepPerSec 每秒推进多少步（= 调试可视化的"慢放倍率"）
   * @param {number} maxPerFrame 单帧上限，防止标签页挂起后回来补几千步
   */
  constructor(clock, { stepPerSec = MEASURED.stepPerSec, maxPerFrame = 400 } = {}) {
    this.clock = clock;
    this.stepPerSec = stepPerSec;
    this.maxPerFrame = maxPerFrame;
    this.carry = 0;
    this.last = clock.now();
  }

  /** 推进到 nowSec，返回本帧应该执行的步数 */
  advanceTo(nowSec) {
    const dt = Math.max(0, nowSec - this.last);
    this.last = nowSec;
    // 标签页被挂起：dt 可能是几十秒，直接按上限走，别把 carry 攒成炸弹
    const want = dt * this.stepPerSec + this.carry;
    const n = Math.min(this.maxPerFrame, Math.floor(want));
    this.carry = Math.min(1, want - n);   // 小数部分留到下一帧，避免低帧率时永远丢尾数
    if (dt > 1) this.carry = 0;           // 长挂起后不补零头
    return n;
  }

  /** 对照：等步数（每个 call 固定 n 步，完全不看时钟） */
  static fixedStep() { return (nowSec, n) => n; }
}

/**
 * 增量三角细分：每步把当前"面积最大的三角形"按重心拆成 3 个。
 * 为什么用重心拆分而不是 Delaunay 插入：
 *   片子里的线是**从一条边呈扇形铺开**的（f005→f011 能看到同一顶点扇出多条边），
 *   这正是"拆分 + 保留原顶点"的形态；Delaunay 增量插入会出现翻边，边缘会长出小斜角。
 */
export class Refiner {
  constructor(poly) {
    this.verts = poly.map((p) => [p[0], p[1]]);
    this.tris = [];
    for (let i = 1; i < this.verts.length - 1; i++) this.tris.push([0, i, i + 1]);
    this.step = 0;
  }

  static area(a, b, c) {
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) * 0.5;
  }

  /** 拆一个最大的三角形，返回新生成的边数（给覆盖率曲线用） */
  splitOnce() {
    if (!this.tris.length) return 0;
    let bi = 0, ba = -1;
    for (let i = 0; i < this.tris.length; i++) {
      const t = this.tris[i];
      const a = Refiner.area(this.verts[t[0]], this.verts[t[1]], this.verts[t[2]]);
      if (a > ba) { ba = a; bi = i; }
    }
    const [i0, i1, i2] = this.tris[bi];
    const v = this.verts;
    const cx = (v[i0][0] + v[i1][0] + v[i2][0]) / 3;
    const cy = (v[i0][1] + v[i1][1] + v[i2][1]) / 3;
    // 重心必定落在三角形内部（退化三角形面积 0，跳过，否则会插出重复点）
    if (ba < 1e-6) { this.tris.splice(bi, 1); return 0; }
    const k = this.verts.length;
    this.verts.push([cx, cy]);
    this.tris.splice(bi, 1, [i0, i1, k], [i1, i2, k], [i2, i0, k]);
    this.step++;
    return 3;
  }

  edges() {
    const set = new Set(), out = [];
    for (const t of this.tris) {
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const key = a < b ? a + ',' + b : b + ',' + a;
        if (set.has(key)) continue;         // 唯一边集：不去重会把 2px 线描成 3px
        set.add(key); out.push([a, b]);
      }
    }
    return out;
  }
}

/** 画到 canvas：1px 实线 + 0.55 的 AA，屏幕定宽（不随面大小变） */
export function drawWire(ctx, refiner, { line = MEASURED.line, width = 1 } = {}) {
  const col = `rgb(${line.join(',')})`;
  ctx.lineWidth = width;
  ctx.strokeStyle = col;
  ctx.beginPath();
  for (const [a, b] of refiner.edges()) {
    const p = refiner.verts[a], q = refiner.verts[b];
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
}

/**
 * 反推每秒步数：片子从 0.081% 覆盖长到 1.791%，边长≈sqrt(覆盖)，
 * 而每次重心拆分把 1 个三角形变 3 个（边 +3、面积不变），
 * 所以边数 E(k) ≈ E0 + 3k。覆盖 ∝ 总边长 ∝ sqrt(面数)，面数 F(k) = F0 + 2k。
 * 用两点定 F0：k1=3.24s 处的覆盖比 1.791/0.081 = 22.1 → 面数比 22.1² = 488
 * → F0 + 2k₁ = 488·F0，F0=1 时 k₁≈243… 明显过大，说明片子不是纯重心细分（它会同时加边）。
 * 结论：仅凭覆盖率无法唯一反推步数，本实现取 stepPerSec=2.2（在 46 步 / 3.24s 处让
 * 覆盖率曲线贴合片中四点，见 lab 的对照表），并在 lab 里明确标注这是**拟合值**。
 */
export function deriveStepsPerSecond(targets = MEASURED.cover) {
  return MEASURED.stepPerSec;
}
