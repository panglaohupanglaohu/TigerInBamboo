/** 816332161036984320: Unity「Trajectory Calculator」的阻力扇面。
 *
 * 片子里是同一起点、同一 Start Speed / Drag，把一整排发射角各画一条弹道，
 * 曲线上每隔固定弧长插一段白色短划线表示该点速度方向。本仓原有
 * `ballistic-table.js` 只解无阻力、按代价挑角度的定点射表，没有「阻力」这一层，
 * 也没有「一次画一整片角度扇面」的预览。这里补的就是这两件：
 *
 *   throwArc()      —— 单条带线性阻力的弹道（解析解，不是欧拉步进）
 *   sampleTicks()   —— 沿弧等距重采样，给每个采样点带上切线方向
 *   trajectoryFan() —— 一整排角度的扇面
 *
 * 坐标系跟片子一致：x 向发射方向，y 向上，地面 y = groundY。
 * 阻力用线性阻尼（dv/dt = -drag·v），与 Inspector 里那个标量 Drag 对得上：
 * drag = 0 时退化成纯抛物线，drag 越大射程越短、轨迹越不对称。
 */

export const DEFAULT_GRAVITY = 9.8;

/** 两档阻力模型：linear（dv/dt = −k·v，解析解）与 quadratic（dv/dt = −k·|v|·v，RK4 数值解）。 */
export const DRAG_MODELS = Object.freeze(['linear', 'quadratic']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function checkModel(dragModel) {
  if (!DRAG_MODELS.includes(dragModel)) throw new RangeError('dragModel must be linear|quadratic');
}

function checkOptions({ speed, drag, gravity, dt, maxTime }) {
  if (!finite(speed) || speed <= 0) throw new RangeError('speed must be > 0');
  if (!finite(drag) || drag < 0) throw new RangeError('drag must be >= 0');
  if (!finite(gravity) || gravity <= 0) throw new RangeError('gravity must be > 0');
  if (!finite(dt) || dt <= 0 || dt > 0.05) throw new RangeError('dt must be in (0, 0.05]');
  if (!finite(maxTime) || maxTime <= 0) throw new RangeError('maxTime must be > 0');
}

/* ---------------------------------------------------------------- 二次阻力
 * 二次阻力没有初等解析解，用 RK4 在 (x,y,vx,vy) 上积分。一次 march 同时给出
 * 「到某水平距离的高度」与「落地时刻」，避免 solveLaunch 每个角度都重解一次。
 */
function quadAccel(k, g, vx, vy) {
  const s = Math.hypot(vx, vy);
  return [-k * s * vx, -k * s * vy - g];
}

/** RK4 单步（状态 [x,y,vx,vy]）。 */
function quadStep(k, g, st, dt) {
  const [x, y, vx, vy] = st;
  const f = (s) => {
    const [ax, ay] = quadAccel(k, g, s[2], s[3]);
    return [s[2], s[3], ax, ay];
  };
  const k1 = f(st);
  const k2 = f([x + (k1[0] * dt) / 2, y + (k1[1] * dt) / 2, vx + (k1[2] * dt) / 2, vy + (k1[3] * dt) / 2]);
  const k3 = f([x + (k2[0] * dt) / 2, y + (k2[1] * dt) / 2, vx + (k2[2] * dt) / 2, vy + (k2[3] * dt) / 2]);
  const k4 = f([x + k3[0] * dt, y + k3[1] * dt, vx + k3[2] * dt, vy + k3[3] * dt]);
  return [
    x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    vx + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    vy + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

/** 二次阻力积分器：到 groundY 落地、到 xMax 截断、或超时即停。collect 时逐点收。 */
function quadMarch({ k, g, vx0, vy0, dt, maxTime, groundY = 0, xMax = Infinity, collect = false }) {
  let st = [0, 0, vx0, vy0];
  let t = 0;
  const points = collect ? [Object.freeze([0, 0])] : null;
  let landed = false;
  let guard = 0;
  const limit = Math.ceil(maxTime / dt) + 2;
  while (t < maxTime - 1e-12 && guard++ < limit) {
    const prev = st;
    st = quadStep(k, g, st, dt);
    t += dt;
    if (collect) points.push(Object.freeze([st[0], st[1]]));
    if (st[1] <= groundY) {
      // 落地：在最后一段上按 y 线性插值，落点精确贴地
      const t0 = prev[1] - groundY;
      const t1 = st[1] - groundY;
      const f = t0 === t1 ? 1 : t0 / (t0 - t1);
      const xg = prev[0] + (st[0] - prev[0]) * f;
      if (collect) points[points.length - 1] = Object.freeze([xg, groundY]);
      st = [xg, groundY, st[2], st[3]];
      landed = true;
      break;
    }
    if (st[0] >= xMax) break;
    if (!collect && Math.hypot(st[2], st[3]) < 1e-3 && st[0] < xMax) break;  // 速度被吃光 → 够不到
  }
  return { st, points, landed, time: t };
}

/** 线性阻力下的位置解析解；k→0 时退化为抛物线（避免 1/k 除零）。 */
function posAt(k, g, vx0, vy0, t) {
  if (k < 1e-9) return [vx0 * t, vy0 * t - 0.5 * g * t * t];
  const e = Math.exp(-k * t);
  const term = (1 - e) / k;
  return [vx0 * term, (vy0 + g / k) * term - (g / k) * t];
}

/**
 * 单条弹道。返回点串（含起点与落地点）、射程、顶点高、飞行时间。
 * 落地时刻用二分求 y(t)=groundY，射程不受采样步长影响。
 */
export function throwArc({
  speed,
  drag = 0,
  dragModel = 'linear',
  gravity = DEFAULT_GRAVITY,
  angleDeg,
  dt = 1 / 240,
  groundY = 0,
  maxTime = 12,
} = {}) {
  if (!finite(angleDeg)) throw new RangeError('angleDeg must be finite');
  if (!finite(groundY)) throw new RangeError('groundY must be finite');
  checkModel(dragModel);
  checkOptions({ speed, drag, gravity, dt, maxTime });

  const th = (angleDeg * Math.PI) / 180;
  const vx0 = speed * Math.cos(th);
  const vy0 = speed * Math.sin(th);

  if (dragModel === 'quadratic') {
    const march = quadMarch({ k: drag, g: gravity, vx0, vy0, dt, maxTime, groundY, collect: true });
    const points = march.points;
    let apex = 0;
    for (const p of points) if (p[1] > apex) apex = p[1];
    const last = points[points.length - 1];
    return Object.freeze({
      angleDeg,
      dragModel,
      points: Object.freeze(points),
      range: last[0],
      apex,
      flightTime: march.time,
      landed: march.landed,
      velocity: Object.freeze([march.st[2], march.st[3]]),
    });
  }

  const yOf = (t) => posAt(drag, gravity, vx0, vy0, t)[1] + (0 - 0);

  // 先找到落地时刻：y(t) 从 0 先升后降（俯角时立刻下降）
  let tLand = 0;
  if (vy0 <= 0) {
    tLand = 0;
  } else {
    // 无阻力有闭式解；带阻力用二分，上界用「y 掉到 groundY 以下」的探测时长
    let hi = Math.min(maxTime, (2 * vy0) / gravity + 1);
    let guard = 0;
    while (yOf(hi) > groundY && guard++ < 60 && hi < maxTime * 4) hi *= 1.5;
    let lo = 0;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (yOf(mid) > groundY) lo = mid;
      else hi = mid;
    }
    tLand = (lo + hi) / 2;
  }
  const steps = Math.max(2, Math.ceil(tLand / dt));
  const points = [];
  let apex = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (tLand * i) / steps;
    const [x, y] = posAt(drag, gravity, vx0, vy0, t);
    points.push([x, i === steps ? groundY : y]);
    if (y > apex) apex = y;
  }
  const last = points[points.length - 1];
  return Object.freeze({
    angleDeg,
    dragModel: 'linear',
    points: Object.freeze(points.map((p) => Object.freeze(p))),
    range: last[0],
    apex,
    flightTime: tLand,
    landed: true,
  });
}

/**
 * 沿折线等弧长重采样，返回 {x,y,dx,dy}：位置 + 单位切线（朝发射方向）。
 * 片子里白划线的间距是等弧长而不是等时间——无阻力时水平速度恒定，两者在
 * 近水平弧上重合；带阻力时等时间会让划线越到后面越密，与片子不符
 * （实测最低那条弧的划线在 x 上等距 42–43px）。
 */
export function sampleTicks(points, { spacing = 0.5 } = {}) {
  if (!Array.isArray(points) || points.length < 2) return [];
  if (!finite(spacing) || spacing <= 0) throw new RangeError('spacing must be > 0');
  const out = [];
  let carry = 0;
  let target = spacing;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg < 1e-12) continue;
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    while (target <= carry + seg) {
      const d = target - carry;
      out.push(
        Object.freeze({
          x: x0 + ux * d,
          y: y0 + uy * d,
          dx: ux,
          dy: uy,
        }),
      );
      target += spacing;
    }
    carry += seg;
  }
  return out;
}

/**
 * 一整片角度扇面。angles 默认覆盖片子里那种「从俯角一路到接近竖直」的排布。
 * 每条弧都带自己的 ticks，方便一次画完。
 */
export function trajectoryFan({
  speed,
  drag = 0,
  dragModel = 'linear',
  gravity = DEFAULT_GRAVITY,
  angles = defaultAngles(),
  spacing = 0.5,
  ...rest
} = {}) {
  if (!Array.isArray(angles) || angles.length === 0) throw new RangeError('angles must be a non-empty array');
  checkModel(dragModel);
  const arcs = angles.map((a) => {
    const arc = throwArc({ speed, drag, dragModel, gravity, angleDeg: a, ...rest });
    return Object.freeze({ ...arc, ticks: Object.freeze(sampleTicks(arc.points, { spacing })) });
  });
  const ranges = arcs.map((a) => a.range);
  return Object.freeze({
    speed,
    drag,
    dragModel,
    gravity,
    arcs: Object.freeze(arcs),
    maxRange: Math.max(...ranges),
    maxApex: Math.max(...arcs.map((a) => a.apex)),
    tickCount: arcs.reduce((s, a) => s + a.ticks.length, 0),
  });
}

export function defaultAngles({ from = -20, to = 90, step = 5 } = {}) {
  if (!finite(from) || !finite(to) || !finite(step) || step <= 0 || to < from) throw new RangeError('angle range');
  const out = [];
  for (let a = from; a <= to + 1e-9; a += step) out.push(a);
  return out;
}

/* ------------------------------------------------------------------ 第 56 批 C03
 * 原文「PRO TIP: Avoid your ballistics homework by making a lookup table」+ 原尺寸 frame-0040 复看：
 * 白色短线并不是弧上的切线，而是**落在规则点阵上**——每个格点一根，指向「从原点要打中这个格点该用的出射方向」；
 * 够不着的格点（右上角）只剩白点、没有线。青色扇面只是陪衬。Inspector 第三行是 Gravity（frame-0040 露出半行）。
 * 这就是「把弹道作业变成查找表」：对 (dx, dy) 格点预先解出射角，运行时只查表 / 双线性插值。
 */

/** 二次阻力下「水平方向够得到多远」的上界（几个常见角度的最大落地 x，带缓存）。
 *  只用来快速否掉够不着的格点——否则每个够不着的点都要积到 maxTime。 */
const reachCache = new Map();
export function quadMaxReach({ speed, drag, gravity = DEFAULT_GRAVITY, dt = 1 / 120 } = {}) {
  const key = `${speed}|${drag}|${gravity}|${dt}`;
  if (reachCache.has(key)) return reachCache.get(key);
  let best = 0;
  for (const a of [25, 35, 42, 45, 50, 58, 70]) {
    const th = (a * Math.PI) / 180;
    const m = quadMarch({ k: drag, g: gravity, vx0: speed * Math.cos(th), vy0: speed * Math.sin(th), dt, maxTime: 60, groundY: 0 });
    if (m.st[0] > best) best = m.st[0];
  }
  reachCache.set(key, best);
  return best;
}

/** 线性阻力下，以 angleDeg 出射时穿过水平距离 x 的高度；x 超出渐近射程（vx0/k）返回 null。 */
export function heightAtX({ speed, drag = 0, dragModel = 'linear', gravity = DEFAULT_GRAVITY, angleDeg, x, dt = 1 / 240 }) {
  checkModel(dragModel);
  const th = (angleDeg * Math.PI) / 180, vx0 = speed * Math.cos(th), vy0 = speed * Math.sin(th);
  if (vx0 <= 1e-9) return null;
  if (dragModel === 'quadratic') {
    if (x <= 0) return 0;
    if (x > quadMaxReach({ speed, drag, gravity, dt: 1 / 120 }) * 1.0001) return null;
    const m = quadMarch({ k: drag, g: gravity, vx0, vy0, dt, maxTime: 60, xMax: x, groundY: -1e9, collect: true });
    if (m.st[0] < x) return null;              // 水平速度被阻力吃光，够不到
    const n = m.points.length;
    if (n >= 2) {
      const [xa, ya] = m.points[n - 2], [xb, yb] = m.points[n - 1];
      if (xb >= x && xb !== xa) return ya + ((yb - ya) * (x - xa)) / (xb - xa);
    }
    return m.st[1];
  }
  let t;
  if (drag < 1e-9) t = x / vx0;
  else { const r = 1 - (drag * x) / vx0; if (r <= 1e-9) return null; t = -Math.log(r) / drag; }
  return posAt(drag, gravity, vx0, vy0, t)[1];
}

/**
 * 解「打中 (x, y) 的低弧出射角」：从 −89° 往上扫，第一次 y(θ) 越过目标高度处二分。
 * 返回 { angleDeg, dx, dy } 或 null（够不着）。x≈0 时只看竖直上抛 / 下抛能否到。
 * dragModel='quadratic' 时高度来自 RK4 积分（同一扫+二分流程，低弧解=第一个交点）。
 */
export function solveLaunch({ speed, drag = 0, dragModel = 'linear', gravity = DEFAULT_GRAVITY, x, y, step = 0.5, dt = 1 / 120 }) {
  checkModel(dragModel);
  checkOptions({ speed, drag, gravity, dt: 0.01, maxTime: 1 });
  if (!finite(x) || !finite(y) || x < 0) throw new RangeError('target must be finite with x >= 0');
  if (x < 1e-6) {
    if (y <= 0) return Object.freeze({ angleDeg: -90, dx: 0, dy: -1 });
    // 竖直上抛最高点（线性阻力）：t* = ln(1 + k·v/g)/k
    const top = drag < 1e-9 ? (speed * speed) / (2 * gravity) : posAt(drag, gravity, 0, speed, Math.log(1 + (drag * speed) / gravity) / drag)[1];
    return y <= top ? Object.freeze({ angleDeg: 90, dx: 0, dy: 1 }) : null;
  }
  const f = (a) => { const h = heightAtX({ speed, drag, dragModel, gravity, angleDeg: a, x, dt }); return h === null ? null : h - y; };
  const scanStep = dragModel === 'quadratic' ? Math.max(step, 2) : step;
  let prevA = -89.5, prev = f(prevA);
  for (let a = -89.5 + scanStep; a <= 89.5 + 1e-9; a += scanStep) {
    const v = f(a);
    if (prev !== null && v !== null && prev <= 0 && v >= 0) {
      let lo = prevA, hi = a;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, fm = f(m); if (fm !== null && fm < 0) lo = m; else hi = m; }
      const ang = (lo + hi) / 2, r = (ang * Math.PI) / 180;
      return Object.freeze({ angleDeg: ang, dx: Math.cos(r), dy: Math.sin(r) });
    }
    prev = v; prevA = a;
  }
  return null;
}

/**
 * 查找表：规则点阵 (x0..x1, y0..y1, 间距 cell) 上每格点一个出射方向（或 null = 够不着）。
 * lookup(x, y) 在表里做双线性插值（四角有空 → 退回最近的有解角点），运行时不再解方程。
 */
export function launchGrid({ speed, drag = 0, dragModel = 'linear', gravity = DEFAULT_GRAVITY, x0 = 0, x1 = 6, y0 = -3, y1 = 3, cell = 0.5 } = {}) {
  if (!finite(cell) || cell <= 0) throw new RangeError('cell must be > 0');
  checkModel(dragModel);
  const nx = Math.round((x1 - x0) / cell) + 1, ny = Math.round((y1 - y0) / cell) + 1, nodes = [];
  const reach = dragModel === 'quadratic' ? quadMaxReach({ speed, drag, gravity }) : Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell;
    const shot = x < 0 || x > reach * 1.0001 ? null : solveLaunch({ speed, drag, dragModel, gravity, x, y });
    nodes.push(Object.freeze({ i, j, x, y, shot }));
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? null : nodes[j * nx + i]);
  const lookup = (x, y) => {
    const fi = (x - x0) / cell, fj = (y - y0) / cell, i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const c = [[at(i, j), (1 - u) * (1 - v)], [at(i + 1, j), u * (1 - v)], [at(i, j + 1), (1 - u) * v], [at(i + 1, j + 1), u * v]];
    if (c.every(([n]) => n?.shot)) return c.reduce((s, [n, w]) => s + n.shot.angleDeg * w, 0);
    const best = c.filter(([n]) => n?.shot).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0].shot.angleDeg : null;
  };
  const solved = nodes.filter((n) => n.shot).length;
  return Object.freeze({ speed, drag, dragModel, gravity, nx, ny, cell, nodes: Object.freeze(nodes), solved, unreachable: nodes.length - solved, lookup });
}

/** 无阻力射程解析解，测试与页面读都用它做对照。 */
export function analyticRange(speed, angleDeg, gravity = DEFAULT_GRAVITY) {
  return (speed * speed * Math.sin((2 * angleDeg * Math.PI) / 180)) / gravity;
}
