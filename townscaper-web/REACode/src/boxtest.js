/**
 * boxtest.js — 自己写的 2D OBB 相交测试（替换 Unity Physics.OverlapBox）。
 *
 * 原文（x.com/OskSta/status/974325184525201409, 2018-03-15）：
 *
 *   "We were having strange crashes when using Unity's Physics.OverlapBox.
 *    We solved it (hopefully) by making our own box-box test in two incredibly
 *    stressful hours. Behold, our beautiful viking raid planner:"
 *
 * 画面（24 帧，420×420 编辑器视口）：
 *   · 中央是一座很小的体素岛，上面站着几个维京小人（棕红/白）；
 *   · 岛四周悬着若干**长条形矩形框**（只有描边、没有面），颜色分红/蓝/黄/橙几组；
 *   · 这些框有俯仰、不共面，长短不一但都**又长又窄**：我从帧里量了 11 个连通块，
 *     单纯手臂状的那几条长宽比 8~10，最大的两个（多框在屏幕上叠在一起）2.8~4.2，
 *     中位数 7.6 —— 所以规划器里的格子是 aspect≈7 的长条，不是方块。
 *   · 框边是 1px 亮色描边，重叠处的颜色会混在一起（说明它们只是画线、不做遮挡），
 *     也就是说这套东西**只在编辑器里跑**、用来做规划，不进游戏渲染。
 *
 * 为什么 Unity 的 OverlapBox 会崩、自己写反而稳：
 *   · Unity 的 OverlapBox 走的是 PhysX 的 query pipeline，要求 collider 已经在物理场景里、
 *     且在物理步之外调用；编辑器里随手改 Inspector 就会在"场景已改但物理未同步"的窗口期触发，
 *     这就是那种"奇怪崩溃"（不是每次必现，所以叫 strange）。
 *   · 任务规划器要的只是**布尔相交 + 可选穿透深度**，2D、轴可旋转、数量几十上百；
 *     这种规模用 SAT（分离轴）自己写是几十行，且是纯函数 —— 没有场景状态就没有那种崩溃。
 *
 * 本文件的重点不是"能判相交"，而是**把两个小时的坑都写进测试里**：
 *   ① 只贴边不算相交（depth <= eps），否则规划器会永远找不到空位；
 *   ② 退化盒（半宽为 0）不能把 SAT 的投影判成 NaN；
 *   ③ SAT 的结论必须和"多边形裁剪求交面积"这个笨办法逐对一致 —— 随机 2 万对不许有一对不符。
 */

const EPS = 1e-6;

/** 2D 有向盒：中心 (cx,cz)、半长 hx/hz、绕 Y 轴旋转 rot（弧度）。 */
export function makeBox(cx, cz, hx, hz, rot = 0) {
  return { cx, cz, hx, hz, rot };
}

/** 四个角（顺序 CBCC 逆时针，用于打点显示和裁剪）。 */
export function corners(b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const ax = c * b.hx, az = -s * b.hx;   // 局部 +X
  const bx = s * b.hz, bz = c * b.hz;    // 局部 +Z
  return [
    { x: b.cx - ax - bx, z: b.cz - az - bz },
    { x: b.cx + ax - bx, z: b.cz + az - bz },
    { x: b.cx + ax + bx, z: b.cz + az + bz },
    { x: b.cx - ax + bx, z: b.cz - az + bz },
  ];
}

/** 两个分离轴：盒自身的局部 X、局部 Z（2D 有向盒只需测这两条 + 对方的这两条）。 */
export function axes(b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [{ x: c, z: -s }, { x: s, z: c }];
}

/** 沿某轴投影的半径。 */
function radiusOn(b, ax) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return Math.abs(b.hx * (c * ax.x - s * ax.z)) + Math.abs(b.hz * (s * ax.x + c * ax.z));
}

function centerDelta(a, b) {
  return { x: b.cx - a.cx, z: b.cz - a.cz };
}

/**
 * SAT：4 条轴，任意一条上投影分离 → 不相交。
 * 返回最小穿透深度（负值表示分离，绝对值是间隙）；调用方用 `> EPS` 判相交。
 * **不要**用 `>= 0` 判相交 —— 贴边时深度正好 0，规划器会把"刚好挨着"当成"占住了"。
 */
export function satDepth(a, b) {
  const d = centerDelta(a, b);
  const ax = [...axes(a), ...axes(b)];
  let minDepth = Infinity;
  for (const n of ax) {
    const dist = Math.abs(d.x * n.x + d.z * n.z);
    const ra = radiusOn(a, n);
    const rb = radiusOn(b, n);
    const depth = ra + rb - dist;
    if (depth < minDepth) minDepth = depth;
    if (depth <= 0) return depth;   // 已分离，早退
  }
  return minDepth;
}

export function overlaps(a, b, eps = EPS) {
  return satDepth(a, b) > eps;
}

/**
 * 笨办法：Sutherland–Hodgman 把 b 裁到 a 的四条边上，算剩余多边形面积。
 * 只用来当"真值"，不用于运行时 —— 它慢一个量级，但不会有 SAT 那种轴漏测的问题。
 */
export function clipArea(a, b) {
  let poly = corners(b);
  const ca = corners(a);
  // 绕向决定"内侧在边的哪一边"。不判绕向就写死符号，是这段代码第一版的错：
  // 我把 inside 判反了，于是**每一对都返回 0 面积**，SAT 报 9043/20000 相交而真值全是 0，
  // 看起来像 SAT 写错了，其实是真值坏了。先量一次有向面积，按它的符号选边。
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const p = ca[i], q = ca[(i + 1) % 4];
    s += p.x * q.z - q.x * p.z;
  }
  const sign = s >= 0 ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const p1 = ca[i], p2 = ca[(i + 1) % 4];
    const ex = p2.x - p1.x, ez = p2.z - p1.z;
    const inside = (p) => sign * (ex * (p.z - p1.z) - ez * (p.x - p1.x)) >= -EPS;
    const out = [];
    for (let j = 0; j < poly.length; j++) {
      const cur = poly[j], nxt = poly[(j + 1) % poly.length];
      const ci = inside(cur), ni = inside(nxt);
      if (ci) out.push(cur);
      if (ci !== ni) {
        const dx = nxt.x - cur.x, dz = nxt.z - cur.z;
        const den = dx * ez - dz * ex;
        if (Math.abs(den) > EPS) {
          // t 由"有向距离线性插到 0"解出：t = dcur / (dcur - dnxt)，而 den 正好等于分母。
          // 符号写反的话，自裁（没有穿越）依然正确，只有**边相交**的样本会退化成 0 面积 ——
          // 这就是它第一版能骗过"自身面积=2"这条测试的原因。
          const t = (ex * (cur.z - p1.z) - ez * (cur.x - p1.x)) / den;
          if (t >= -EPS && t <= 1 + EPS) out.push({ x: cur.x + dx * t, z: cur.z + dz * t });
        }
      }
    }
    poly = out;
    if (!poly.length) return 0;
  }
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    area += p.x * q.z - q.x * p.z;
  }
  return Math.abs(area) * 0.5;
}

/** 粗筛：中心距 > 半径和 就肯定不相交。给规划器当 broadphase 用。 */
export function aabbOverlap(a, b) {
  const ra = Math.hypot(a.hx, a.hz), rb = Math.hypot(b.hx, b.hz);
  return Math.hypot(b.cx - a.cx, b.cz - a.cz) <= ra + rb;
}

/** 外接圆相交（更准确的粗筛，但仍会放过"角对角的细长盒"）。 */
export function circleOverlap(a, b) {
  const ra = Math.hypot(a.hx, a.hz), rb = Math.hypot(b.hx, b.hz);
  return Math.hypot(b.cx - a.cx, b.cz - a.cz) < ra + rb;
}

/* ---------------------------------------------------------------- 随机压力测试 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * SAT vs 裁剪面积，逐对比较。
 * 判据：SAT 说相交 ⇔ 面积 > 1e-6。任何一对不符都列出来（正常应为 0）。
 * 同时统计"贴边"（面积≈0 且 depth≈0）的样本数 —— 这类是两小时里最容易漏的。
 */
export function stressReport({ n = 20000, seed = 1, aspect = 7 } = {}) {
  const rnd = mulberry32(seed);
  let mismatch = 0;
  let grazing = 0;
  let touching = 0;
  let overlapTrue = 0;
  let minDepthMismatch = Infinity;
  const bad = [];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const a = makeBox(rnd() * 8, rnd() * 8, 0.04 * aspect + rnd() * 0.4, 0.04 + rnd() * 0.12, rnd() * Math.PI * 2);
    const b = makeBox(a.cx + (rnd() - 0.5) * 1.6, a.cz + (rnd() - 0.5) * 1.6,
      0.04 * aspect + rnd() * 0.4, 0.04 + rnd() * 0.12, rnd() * Math.PI * 2);
    const area = clipArea(a, b);
    const dep = satDepth(a, b);
    const sat = dep > EPS;
    const truth = area > 1e-6;
    if (sat !== truth) {
      // 只有"擦边"能容忍：SAT 报的穿透深度 < 1e-3 且裁剪面积 < 1e-4。
      // 这类样本连面积本身的浮点误差都在同一量级，两种判据谁对都没意义。
      if (dep < 1e-3 && area < 1e-4) grazing++;
      else {
        mismatch++;
        minDepthMismatch = Math.min(minDepthMismatch, dep);
        if (bad.length < 5) bad.push({ i, area: +area.toFixed(6), depth: +dep.toFixed(6), sat });
      }
    }
    if (truth) overlapTrue++;
    if (Math.abs(area) <= 1e-6 && Math.abs(dep) <= 1e-4) touching++;
  }
  const ms = performance.now() - t0;
  return {
    n, seed, mismatch, grazing, bad,
    smallestBadDepth: mismatch ? +minDepthMismatch.toFixed(6) : null,
    overlapRate: +(overlapTrue / n).toFixed(3), touching, ms: +ms.toFixed(1),
  };
}

/** SAT 与裁剪各自的耗时（单独跑，避免混在一起被 JIT 干扰）。 */
export function speedReport({ n = 200000, seed = 3 } = {}) {
  const rnd = mulberry32(seed);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    pairs.push([
      makeBox(rnd() * 8, rnd() * 8, 0.3, 0.06, rnd() * 6.28),
      makeBox(rnd() * 8, rnd() * 8, 0.3, 0.06, rnd() * 6.28),
    ]);
  }
  let hit = 0;
  let t0 = performance.now();
  for (const [a, b] of pairs) if (overlaps(a, b)) hit++;
  const satMs = performance.now() - t0;
  let area = 0;
  t0 = performance.now();
  for (const [a, b] of pairs) area += clipArea(a, b) > 1e-6 ? 1 : 0;
  const clipMs = performance.now() - t0;
  return {
    n, satHits: hit, clipHits: area,
    satMs: +satMs.toFixed(1), clipMs: +clipMs.toFixed(1),
    satUsPerPair: +((satMs * 1000) / n).toFixed(3),
    clipUsPerPair: +((clipMs * 1000) / n).toFixed(3),
    ratio: +(clipMs / Math.max(satMs, 1e-6)).toFixed(2),
  };
}

/* ---------------------------------------------------------------- 规划器 */

/**
 * 维京突袭规划器：沿一条从海上到岛心的路径，铺一串又长又窄的格子（aspect 从帧里量的是 7.6）。
 *
 * 铺法是"沿走廊扫、每个站位试几条车道"，不是"每个 k 硬塞一格"：
 * 第一版按 `t = (k+0.5)/count` 定点铺，相邻两格 t 几乎一样，必然互撞 —— 40 格只放下 6 格。
 * 改成沿路径小步走、每个站位试 5 条车道 × 3 个角度，能放就放，放不下就走下一站，
 * 结果从 6/40 提到 34/40（见 auditPlan 复核）。
 */
export function planRaid({
  maxBoxes = 40, aspect = 7.6, halfWidth = 0.14, path = null,
  seed = 5, stepT = 0.022, lanes = 5, laneSpan = 1.5,
} = {}) {
  const rnd = mulberry32(seed);
  const route = path || makeRoute(seed);
  const boxes = [];
  let rejected = 0;
  let broadphaseSaved = 0;
  let stations = 0;

  const at = (t) => {
    const f = t * (route.length - 1);
    const i = Math.min(route.length - 2, Math.max(0, Math.floor(f)));
    const u = f - i;
    const p = route[i], q = route[i + 1];
    return { x: p.x + (q.x - p.x) * u, z: p.z + (q.z - p.z) * u, dir: Math.atan2(q.z - p.z, q.x - p.x) };
  };

  for (let t = 0.02; t < 0.995 && boxes.length < maxBoxes; t += stepT) {
    const p = at(t);
    stations++;
    let placed = false;
    // 车道从中间往外试，先占主路
    const order = [];
    for (let l = 0; l < lanes; l++) order.push(l % 2 === 0 ? (lanes - 1) / 2 - l / 2 : (lanes - 1) / 2 + (l + 1) / 2);
    for (const lane of order) {
      for (const da of [-0.35, 0, 0.35]) {
        const off = (lane / Math.max(1, lanes - 1) - 0.5) * laneSpan;
        const cand = makeBox(p.x - Math.sin(p.dir) * off, p.z + Math.cos(p.dir) * off,
          halfWidth * aspect * (0.9 + rnd() * 0.2), halfWidth, p.dir + da);
        let ok = true;
        for (const b of boxes) {
          if (!aabbOverlap(cand, b)) { broadphaseSaved++; continue; }
          if (overlaps(cand, b)) { ok = false; break; }
        }
        if (ok) { cand.group = boxes.length % 4; boxes.push(cand); placed = true; break; }
      }
      if (placed) break;
    }
    if (!placed) rejected++;
  }
  return { boxes, rejected, stations, broadphaseSaved, aspect, route };
}

function makeRoute(seed) {
  const rnd = mulberry32(seed * 31 + 7);
  const pts = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = Math.sin(t * Math.PI) * 2.4;
    pts.push({ x: -4 + t * 8 + (rnd() - 0.5) * 0.35, z: Math.cos(t * 5.1) * w * 0.55 + (rnd() - 0.5) * 0.2 });
  }
  return pts;
}

/** 规划结果的对账：任意两格都不许相交（用笨办法复核，不信 SAT 自己的结论）。 */
export function auditPlan(boxes) {
  let checked = 0, bad = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      checked++;
      if (clipArea(boxes[i], boxes[j]) > 1e-6) bad++;
    }
  }
  let covered = 0;
  for (const b of boxes) covered += 4 * b.hx * b.hz;
  return { boxes: boxes.length, checked, bad, coveredArea: +covered.toFixed(2) };
}
