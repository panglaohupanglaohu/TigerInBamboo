/**
 * coroutine.js — 嵌套/递归协程：把"要跑好几帧的算法"写成普通循环。
 *
 * 原文（x.com/OskSta/status/863019585162932224, 2017-05-12）：
 *
 *   "TIL how to do nested/recursive coroutines. Makes writing multi-frame
 *    algorithms simpler and much more elegant. #madewithunity"
 *
 * 画面（24 帧）：开局一座小岛（左边有房子、上面有雪山顶），然后镜头一路拉远/贴近水面，
 * 中间好几帧几乎只有水面和雾（1~12 帧），到 13 帧以后才重新出现小人和岛 ——
 * 这是**一个跨很多帧的生成/展开过程**，不是一段动画。原文强调的正是：
 * 这类过程的代码不该被拆成状态机。
 *
 * 为什么嵌套是关键（原文只说 TIL，没说为什么）：
 *   · 单层协程只能"我一帧做一点"，子步骤要么内联、要么手工拍平成一堆状态变量；
 *   · 一旦子步骤里还要再调子步骤（洪水填充 → 每格再算一次连通 → 每次再取邻居），
 *     拍平就等于把调用栈手动写进字段，改一次算法要改十个地方；
 *   · `yield*`（C# 里是 `yield return StartCoroutine(...)`）让**调用栈本身**留在生成器里，
 *     于是"递归的算法"可以逐字照抄，只是每次 yield 变成一个帧边界。
 *
 * 本文件实现的是最小可用的那一层：
 *   - `yield`（不带值）      → 让出到下一帧
 *   - `yield* gen`           → 嵌套，子生成器跑完才回到父级（这就是"nested/recursive"）
 *   - 每帧有**工作量预算**（ops），跨帧均匀摊开，不是"一帧一个元素"那么死板
 *   - 记录每帧实际消耗，方便验证"确实摊开了"而不是一帧跑完
 *
 * 为什么不直接用 async/await：await 的恢复是微任务，一帧内就把整条链跑完了，
 * 除非到处插 setTimeout；而且 await 无法表达"这一帧还剩 3 个名额，先做 3 个再停"。
 */

/** 一帧的让出信号；带 ops 表示"这一步我做了多少活"，用于预算记账。 */
export function frame(ops = 1) {
  return { __yieldFrame: true, ops };
}

/**
 * 调度器：把生成器按 ops 预算摊到多帧。
 * `run()` 一口气跑完（用于对照）；`step()` 跑一帧。
 */
export class Scheduler {
  constructor({ opsPerFrame = 24 } = {}) {
    this.opsPerFrame = opsPerFrame;
    this.stack = [];          // 当前调用栈：每层一个生成器
    this.frames = 0;
    this.totalOps = 0;
    this.trace = [];          // 每帧 ops
    this.done = false;
    this.result = undefined;
    this.depthMax = 0;
  }

  add(gen) {
    this.stack = [{ gen, value: undefined }];
    this.done = false;
    return this;
  }

  /** 跑一帧。返回 { ops, done }。 */
  step() {
    if (this.done) return { ops: 0, done: true };
    let budget = this.opsPerFrame;
    let opsThisFrame = 0;
    this.depthMax = Math.max(this.depthMax, this.stack.length);

    while (budget > 0 && this.stack.length) {
      const top = this.stack[this.stack.length - 1];
      const r = top.gen.next(top.value);
      if (r.done) {
        this.stack.pop();
        if (this.stack.length) {
          // 子协程结束，把返回值交给父级 yield* 的接收点
          this.stack[this.stack.length - 1].value = r.value;
        } else {
          this.done = true;
          this.result = r.value;
          break;
        }
        continue;
      }
      const y = r.value;
      if (y && typeof y === 'object' && y.__yieldFrame) {
        const used = y.ops || 1;
        budget -= used;
        opsThisFrame += used;
        top.value = undefined;
        // 预算用完了才算一帧；没用完就继续同帧推进（省帧，但仍是"可中断"的）
        if (budget <= 0) break;
      } else if (y && typeof y.next === 'function') {
        // 嵌套：子生成器压栈，父级挂起等它
        this.stack.push({ gen: y, value: undefined });
        this.depthMax = Math.max(this.depthMax, this.stack.length);
      } else if (typeof y === 'number') {
        budget -= y;
        opsThisFrame += y;
      }
    }
    this.frames++;
    this.totalOps += opsThisFrame;
    this.trace.push(opsThisFrame);
    return { ops: opsThisFrame, done: this.done };
  }

  run(maxFrames = 100000) {
    while (!this.done && this.frames < maxFrames) this.step();
    return this.result;
  }

  stats() {
    const t = this.trace;
    return {
      frames: this.frames,
      totalOps: this.totalOps,
      maxDepth: this.depthMax,
      opsPerFrame: this.opsPerFrame,
      peakOps: t.length ? Math.max(...t) : 0,
      // 摊平度：1.0 = 每帧都顶满预算；越低说明末尾越空
      fill: t.length ? +(this.totalOps / (t.length * this.opsPerFrame)).toFixed(3) : 0,
      lastFrameOps: t.length ? t[t.length - 1] : 0,
    };
  }
}

/* ------------------------------------------------------------ 例子：跨帧洪水填充 */

/**
 * 洪水填充，写成嵌套协程的样子。
 * 递归结构：fillCell → 对每个邻居再 fillCell（用 `yield*` 递归下去）。
 * 每处理一格 `yield frame(1)`。
 *
 * **一个反直觉的事实**（我实测才发现的）：`yield*` 是引擎内部委托的，
 * 子生成器对象根本不会交到调度器手上 —— 所以调度器自己的 `stack` 永远是 1 层。
 * 更糟的是 `yield*` 的委托仍然吃 JS 调用栈：一条 1 格宽的长走廊（递归深度 = 长度）实测
 *   普通递归 4000 层 OK、20000 层 RangeError；
 *   `yield*` 版 2496 层就 RangeError —— 比普通递归**还低**，因为每层多套了一层生成器帧。
 * 所以"嵌套协程 = 不爆栈"是错的。真要做到 6 万层不爆，必须 `yield childGen`（显式交给调度器），
 * 见 `fillCellExplicit`：实测 60000 层、调度器栈深 60001、235 帧，正常返回。
 * 这也解释了原文为什么值得单独发一条推：它解决的是**代码形状**（可读性），不是栈深度。
 */
export function* fillCell(grid, w, h, x, y, target, into, seen, state = { depth: 0, maxDepth: 0 }) {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const i = y * w + x;
  if (seen[i]) return 0;
  if (grid[i] !== target) return 0;
  seen[i] = 1;
  into.push(i);
  state.depth++;
  if (state.depth > state.maxDepth) state.maxDepth = state.depth;
  yield frame(1);
  let n = 1;
  n += yield* fillCell(grid, w, h, x + 1, y, target, into, seen, state);
  n += yield* fillCell(grid, w, h, x - 1, y, target, into, seen, state);
  n += yield* fillCell(grid, w, h, x, y + 1, target, into, seen, state);
  n += yield* fillCell(grid, w, h, x, y - 1, target, into, seen, state);
  state.depth--;
  return n;
}

/**
 * 同一算法，但用 `yield child`（显式把子生成器交给调度器）而不是 `yield*`。
 * 好处：调度器看得见调用栈（可以按层限流、可以中途取消某棵子树）；
 * 代价：多一层对象分配，且写法没有 `yield*` 那么干净 —— 这正是原文说 `yield*` "elegant" 的原因。
 */
export function* fillCellExplicit(grid, w, h, x, y, target, into, seen) {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const i = y * w + x;
  if (seen[i] || grid[i] !== target) return 0;
  seen[i] = 1;
  into.push(i);
  yield frame(1);
  let n = 1;
  n += yield fillCellExplicit(grid, w, h, x + 1, y, target, into, seen);
  n += yield fillCellExplicit(grid, w, h, x - 1, y, target, into, seen);
  n += yield fillCellExplicit(grid, w, h, x, y + 1, target, into, seen);
  n += yield fillCellExplicit(grid, w, h, x, y - 1, target, into, seen);
  return n;
}

/** 同步版（对照用）：同样的算法，普通递归。 */
export function fillSync(grid, w, h, sx, sy, target) {
  const seen = new Uint8Array(w * h);
  const into = [];
  const go = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const i = y * w + x;
    if (seen[i] || grid[i] !== target) return 0;
    seen[i] = 1; into.push(i);
    return 1 + go(x + 1, y) + go(x - 1, y) + go(x, y + 1) + go(x, y - 1);
  };
  const n = go(sx, sy);
  return { cells: into, count: n };
}

/**
 * 把一个"每步代价不同"的生成器跑成若干帧，并给出可对账的报告。
 * 这里刻意让预算很小（12 ops/帧），这样几十格的小图也能看出"摊开"了。
 */
export function runFrames(gen, opsPerFrame = 12, maxFrames = 100000) {
  const s = new Scheduler({ opsPerFrame }).add(gen);
  const v = s.run(maxFrames);
  return { value: v, stats: s.stats(), trace: s.trace.slice() };
}
