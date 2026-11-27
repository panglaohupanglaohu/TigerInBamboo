/**
 * bindchain.js — 一个 bool 资产 → 四个组件节点 → UI 位置：脏传播的值链
 *
 * ── 原文（这条帖子的正文只有一句，真正的规格在**画面里的 Inspector**）─────
 *   1724449858369568780（2023-11-14）：
 *     "Ok, here's a small example. The button toggles a ScriptableObject bool.
 *      The FloatSelectNode component listens to that ScriptableObject, and then a
 *      series of node-like components end up moving a piece of UI"
 *
 *   所以"原文说了什么"要拆成两层：
 *     · 文字层：bool 存在 ScriptableObject 里 → 节点监听它 → 一串节点把 UI 挪走。
 *     · 画面层（Inspector 直接把参数报出来了，这是本模块全部数值的来源）：
 *         Float Select Node        On False = 226.9   On True = -33.8
 *                                  Bool Condition = BoolAsset"output"   Output = 226.9
 *         Float Lerp Towards Node  Target = 226.9    Speed = 20          Output = 210.8688
 *         Vector2 Compose Node     In 0 = -5         In 1 = 210.86       Output = (-5, 210.86)
 *         Vector2 Event Node       UnityEvent(Vector2) → RectTransform.anchoredPosition
 *       左栏还能看到被移动的那个物件叫 "Moving"，值 -33.8 与 226.9 是它的两个落位。
 *
 * ── 从画面反推出来的三个数（都能对上，不是猜的）─────────────────────────
 *   ① 行程 = 226.9 − (−33.8) = 260.7 单位；Speed 20 → 到位耗时 **13.035s**。
 *   ② 那一帧 Output = 210.8688，落后 Target 16.0312 → 已经走了 16.0312/20 = **0.8016s**。
 *      这一帧的时间戳是 2.317s，反推 toggle 发生在 **1.52s** 左右（片里 f012=1.667s 时
 *      UI 确实还在半路，f000–f003 是静止的顶位 → 自洽）。
 *   ③ 屏幕上量到的两个静止位：cy=277 与 cy=533，跨度 **256px**。
 *      256 / 260.7 = 0.982 → UI 画布缩放 ≈ 0.98（不是 1.0，因为 canvas 被整体缩过）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① 这条链的价值不是"插值"，是**只有下游该算的才算**：bool 一翻，Select 变脏，
 *      脏标记沿出边传播，Lerp/Compose/Event 依次重算，链外的节点一次都不跑。
 *      所以本模块的图是「拉取 + 脏传播」，不是「每帧全量求值」。
 *   ② LerpTowards 必须是**定速直线**（MoveTowards），不是 `lerp(a,b,k*dt)` 的指数逼近：
 *      指数逼近永远到不了位（残差按帧率衰减），13.035s 这个数就无从谈起，
 *      而且 30fps 与 60fps 下观感不同 —— 这正是 Unity 里 MoveTowards 与 Lerp 的经典区别。
 *   ③ 因此本模块的步进写成 `sign * min(speed*dt, 剩余距离)`，最后一步**精确落位**，
 *      不留 1e-7 的尾巴（否则"到位"判定要写 epsilon，而 epsilon 又和帧率有关）。
 */

/** Inspector 里读出来的参数 */
export const MEASURED = {
  onFalse: 226.9,
  onTrue: -33.8,
  speed: 20,
  lerpOutputAtFrame: 210.8688,   // f020 里 Lerp 节点的 Output
  frameT: 2.317,                 // f020 的时间戳（s）
  composeIn0: -5,
  screenTopCy: 277,              // "Moving" 静止顶位的屏幕质心 y
  screenBotCy: 533,
};

/** 派生：行程 / 耗时 / 那一帧已走的秒数 */
export const DERIVED = (() => {
  const span = MEASURED.onFalse - MEASURED.onTrue;
  const travel = span / MEASURED.speed;
  const behind = MEASURED.onFalse - MEASURED.lerpOutputAtFrame;
  const elapsed = behind / MEASURED.speed;
  const screenSpan = MEASURED.screenBotCy - MEASURED.screenTopCy;
  return {
    span,                       // 260.7
    travel,                     // 13.035
    elapsed,                    // 0.8016
    toggleAt: MEASURED.frameT - elapsed,   // 1.5154
    canvasScale: screenSpan / span,        // 0.9820
  };
})();

/* ── 节点基类：脏标记 + 版本号 ─────────────────────────────────────────── */
class Node {
  constructor(name) {
    this.name = name;
    this.dirty = true;
    this.version = 0;
    this.downstream = [];
    this.evals = 0;         // 本节点被真正重算过多少次（用于验证脏传播）
  }
  linkTo(n) { this.downstream.push(n); return n; }

  /**
   * 把自己和下游全部标脏。返回**新**标脏的节点数。
   * 关键：已脏就停（不再往下传）—— 一次 toggle 只标一次子图，
   * 否则 Compose/Event 被两条路径各标一次，计数就虚高。
   */
  invalidate() {
    if (this.dirty) return 0;
    this.dirty = true;
    let n = 1;
    for (const d of this.downstream) n += d.invalidate();
    return n;
  }

  evaluate() { return this.out; }

  /** 从自己开始按"本节点 → 下游"的宽度优先把脏节点算掉，返回算了几个 */
  flush() {
    let n = 0;
    const queue = [this];
    const seen = new Set();
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (cur.dirty) {
        cur.evaluate();
        cur.evals++; cur.dirty = false; cur.version++;
        n++;
      }
      for (const d of cur.downstream) if (d.dirty) queue.push(d);
    }
    return n;
  }
}

/** FloatSelectNode：一个 bool 在两个常量之间选（片子：OnFalse 226.9 / OnTrue −33.8） */
export class FloatSelectNode extends Node {
  constructor({ onFalse, onTrue, condition = false }) {
    super('FloatSelect');
    this.onFalse = onFalse;
    this.onTrue = onTrue;
    this.condition = condition;
    this.out = condition ? onTrue : onFalse;
  }
  setCondition(v) {
    if (this.condition === v) return 0;
    this.condition = v;
    // 自己 + 下游一起标脏；本节点必须先 evaluate 才能把新值传给下游，
    // 所以这里不指望 invalidate 顺手算值，只让它挂脏。
    const wasDirty = this.dirty;
    this.dirty = true;
    let n = 1;
    if (!wasDirty) for (const d of this.downstream) n += d.invalidate();
    this.evaluate();          // 立刻出新值（Toggle 是"同一帧就要生效"的）
    this.dirty = false; this.version++; this.evals++;
    return n;
  }
  evaluate() { this.out = this.condition ? this.onTrue : this.onFalse; return this.out; }
}

/**
 * FloatLerpTowardsNode：定速直线逼近（= Unity 的 Mathf.MoveTowards）
 * 关键：位移量 = min(speed*dt, 剩余距离)，快到位时**精确吸附**，于是耗时严格 = span/speed。
 */
export class FloatLerpTowardsNode extends Node {
  constructor({ target = 0, speed = 20, value = 0 } = {}) {
    super('LerpTowards');
    this.target = target;
    this.speed = speed;
    this.out = value;
    this.dirty = false;
    this.steps = 0;          // 步进次数（它不走 evaluate，走 step）
  }
  evaluate() { return this.out; }
  setTarget(t) {
    if (this.target === t) return 0;
    this.target = t;
    this.dirty = true;
    return 1 + this.downstream.reduce((a, d) => a + d.invalidate(), 0);
  }
  /** 拉一次时间：返回是否还有位移（Event 只在有位移时才发） */
  step(dt) {
    const d = this.target - this.out;
    if (d === 0) return false;
    const move = Math.min(Math.abs(d), this.speed * dt);
    this.out += Math.sign(d) * move;
    this.steps++;
    if (Math.abs(this.target - this.out) < 1e-9) this.out = this.target;  // 精确落位
    return true;
  }
}

/** Vector2ComposeNode：两个标量拼成 (X, Y)（片子：In0 = −5 是固定的横位） */
export class Vector2ComposeNode extends Node {
  constructor({ in0 = 0 } = {}) { super('Vector2Compose'); this.in0 = in0; this.in1 = 0; this.out = [in0, 0]; }
  evaluate() { this.out = [this.in0, this.in1]; return this.out; }
}

/** Vector2EventNode：值变了才发（Unity 的 UnityEvent 不会每帧都发） */
export class Vector2EventNode extends Node {
  constructor(fn) { super('Vector2Event'); this.fn = fn; this.last = null; this.fires = 0; }
  evaluate() {
    const v = this.in;
    if (!v) return null;
    if (!this.last || this.last[0] !== v[0] || this.last[1] !== v[1]) {
      this.last = [v[0], v[1]];
      this.fires++;
      this.fn && this.fn(v);
    }
    return v;
  }
}

/**
 * 把四段接起来。返回的对象里 `tick(dt)` 是"一帧"：
 *   ① 若 bool 变了，脏标记已沿链传播；
 *   ② 拉时间让 Lerp 走一步；
 *   ③ 若真的动了，把 Compose→Event 这段脏链刷掉（Event 才发一次坐标）。
 * 链外节点（本例里没有）不会被碰。
 */
export function buildChain({ onFalse = MEASURED.onFalse, onTrue = MEASURED.onTrue, speed = MEASURED.speed, composeX = MEASURED.composeIn0 } = {}) {
  const compose = new Vector2ComposeNode({ in0: composeX });
  const event = new Vector2EventNode();
  const select = new FloatSelectNode({ onFalse, onTrue });
  const lerp = new FloatLerpTowardsNode({ target: onFalse, speed, value: onFalse });

  select.linkTo(lerp);        // Select.Output → Lerp.Target
  lerp.linkTo(compose);       // Lerp.Output  → Compose.In1
  compose.linkTo(event);      // Compose.Output → Event.Input

  let evalsOnToggle = 0;
  const state = {
    select, lerp, compose, event,
    /** 翻转 bool（模拟 ScriptableObject 被写） */
    toggle(v) {
      const marked = select.setCondition(v);
      lerp.setTarget(select.out);   // select 已在 setCondition 里 evaluate 过，out 是新值
      compose.in1 = lerp.out;
      compose.dirty = true; event.dirty = true;
      evalsOnToggle = marked + 3;   // Select + Lerp + Compose + Event
      return marked;
    },
    /** 一帧：只有真的动了才往下游发 */
    tick(dt) {
      const moved = lerp.step(dt);
      if (!moved) return false;
      // 分两趟刷：Compose 先出值，Event 才有输入可读。
      // 一趟刷会把 Event 和 Compose 一起入队，Event 可能先读到上一帧的值
      // （第一版就是这么错：Event 的 fires 恒为 0，因为它的 input 还是 undefined）。
      compose.in1 = lerp.out;
      compose.dirty = true;
      compose.flush();
      event.in = compose.out;
      event.dirty = true;
      event.flush();
      return true;
    },
    get lerpSteps() { return lerp.steps; },
    get pos() { return compose.out; },
  };
  Object.defineProperty(state, 'evalsOnToggle', { get: () => evalsOnToggle });
  return state;
}

/**
 * 对照实现：指数逼近 `lerp(a, b, 10*dt)`。
 * 它看起来"更顺"，但永远到不了位，且到位时间随帧率变 —— 用来证明片子里那条
 * 13.035s 的定值只可能来自 MoveTowards。
 */
export function buildExponential({ onFalse = MEASURED.onFalse, onTrue = MEASURED.onTrue, k = 10 } = {}) {
  let v = onFalse, target = onFalse;
  return {
    get value() { return v; },
    toggle(toTrue) { target = toTrue ? onTrue : onFalse; },
    tick(dt) { v += (target - v) * Math.min(1, k * dt); return v; },
    /** 到"落位差 < 0.5 单位"（≈0.2% 行程，肉眼已看不出）用了多久 */
    settleTime(fps = 60, tol = 0.5) {
      let t = 0, cur = onFalse, tg = onTrue;
      while (Math.abs(cur - tg) > tol && t < 60) {
        const dt = 1 / fps;
        cur += (tg - cur) * Math.min(1, k * dt);
        t += dt;
      }
      return t;
    },
  };
}

/** 定速链的到位耗时（解析值，给定 fps 也应是同一个数） */
export function settleTimeAt(fps, { onFalse = MEASURED.onFalse, onTrue = MEASURED.onTrue, speed = MEASURED.speed } = {}) {
  const chain = buildChain({ onFalse, onTrue, speed });
  chain.toggle(true);
  let t = 0;
  const dt = 1 / fps;
  const span = Math.abs(onFalse - onTrue);
  while (Math.abs(chain.lerp.out - onTrue) > 1e-9 && t < span / speed + 2) {
    chain.tick(dt); t += dt;
  }
  return t;
}
