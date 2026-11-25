/**
 * route-preview.js — 小队移动时的「虚线路线预览」几何。
 *
 * 依据：995043346778415104 "The pathfinding in some levels does get a bit convoluted"
 *   → 片子里点 Move 之后满屏是一串白点：先沿台地横着走，到崖沿往下折，再沿下一层走；
 *     折角是圆角，不是折线尖角。点串不是从起点到终点的直线，直线会穿进岩壁里。
 *
 * 现状差距：`src/badnorth/battle.js` 的 `#drawPath` 直接把导航图节点连成折线，再按等弧长撒点。
 *   导航图节点是「区域中心」，跨层那一段是斜的 —— 点串从台地中心斜插到下层中心，
 *   中间那段埋在崖体内部；折角也是尖的。片子里看到的是「先横 → 再竖 → 再横」+ 圆角。
 *
 * 本模块只做几何，不依赖 three：
 *   landArcs(points)        跨层段换成落崖弧：从崖沿外抛、落到下层，而不是斜插穿岩
 *   roundCorners(points)    内部拐点做二次贝塞尔圆角
 *   buildRoutePreview(...)  landArcs → roundCorners → 等弧长采样（复用 path-samples.js）
 *   buriedSamples(...)      统计埋在给定地表以下的点数（预览点应当为 0）
 */

import { samplePath } from './path-samples.js';

const EPS = 1e-9;
const isTriple = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const len3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last && len3(last, p) <= EPS) continue;
    out.push(p.slice());
  }
  return out;
}

/**
 * 跨层段 → 换成一条「落崖弧」：走到崖沿，从沿口往外抛出去，落到下层地面，再沿下层横走。
 *
 * 为什么不是竖直腿：竖腿贴着崖面，但崖沿是凸棱，二次贝塞尔/采样误差都会让点掉进岩体；
 * 片子里的点是从沿口向外抛、悬在下层台地上方落下去（995043346778415104 帧 0035 原尺寸可见）。
 * 外抛段整段都在下层地面之上，天然不会埋点，也和片子的弧度一致。
 *
 * `at` 是崖沿在这一段上的归一化位置：给数（默认 0.5）或 (a, b, i) => t。
 * 导航图有真实楼梯格对时要传真实位置，否则弧会落在台地中间。
 *
 * 第 175 轮：外抛距离 `land` 是**上限**，不是死值 —— 真实导航图相邻节点只有 0.42–0.47 世界单位
 * （一格宽），固定 0.55 会越过终点 → 原实现整段放弃弧（退化成斜插），主战场上 2 处跨崖
 * 6 个点埋进崖体（995043346778415104 的片子正是「外抛一小段再几乎竖直落下」）。
 * 现在按「这一段还剩多少水平余量」收边：reach = min(land, 剩余段 × 0.85)。
 * 只有剩余余量小到塞不下任何弧（< 5% 段长）才退化成斜落。
 */
export function landArcs(points, { minStep = 0.5, at = 0.5, land = 0.55, arcSegs = 8, maxArcs = 256 } = {}) {
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  if (!points.every(isTriple)) throw new TypeError('finite XYZ triples required');
  if (!Number.isFinite(minStep) || minStep <= 0) throw new RangeError('minStep must be > 0');
  if (!Number.isFinite(land) || land <= 0) throw new RangeError('land must be > 0');
  if (!Number.isInteger(arcSegs) || arcSegs < 2) throw new RangeError('arcSegs must be an integer >= 2');
  const atFn = typeof at === 'function' ? at : (() => at);
  if (typeof at !== 'function' && (!Number.isFinite(at) || at <= 0 || at >= 1)) throw new RangeError('at must be in (0,1)');

  const src = dedupe(points);
  if (src.length < 2) return { points: src, arcs: 0 };
  const out = [src[0]];
  let arcs = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const dy = b[1] - a[1];
    const hx = b[0] - a[0], hz = b[2] - a[2];
    const flat = Math.hypot(hx, hz);
    if (Math.abs(dy) < minStep || flat <= EPS || arcs >= maxArcs) { out.push(b); continue; }
    const t = atFn(a, b, i);
    if (!Number.isFinite(t) || t <= 0 || t >= 1) throw new RangeError('at callback must return t in (0,1)');
    const ux = hx / flat, uz = hz / flat;
    // 外抛距离按「这一段在崖沿之后还剩多少水平余量」收边（land 是上限）
    const room = flat * (1 - t);
    const reach = Math.min(land, room * 0.85);
    if (!(reach > flat * 0.05)) {
      // 剩余段太短，弧塞不下：退化成段内的斜落，不加弧
      out.push(b); continue;
    }
    // 沿口：崖沿处、上层高度；落点：沿走向再外抛 reach，下层高度
    const lip = [a[0] + hx * t, a[1], a[2] + hz * t];
    const landing = [lip[0] + ux * reach, b[1], lip[2] + uz * reach];
    out.push(lip);
    // 二次贝塞尔：从沿口水平出去，控制点外抛 1.6 倍，再落到下层 —— 起点切线水平、终点切线陡
    // 控制点同样收边：外抛不得超过剩余段（否则弧会甩到下一格外面，落点附近的点反而浮空）
    const bulge = Math.min(reach * 1.6, room * 1.05);
    const cx = lip[0] + ux * bulge, cz = lip[2] + uz * bulge;
    for (let k = 1; k < arcSegs; k++) {
      const s = k / arcSegs, w0 = (1 - s) * (1 - s), w1 = 2 * (1 - s) * s, w2 = s * s;
      out.push([w0 * lip[0] + w1 * cx + w2 * landing[0], w0 * lip[1] + w1 * lip[1] + w2 * landing[1], w0 * lip[2] + w1 * cz + w2 * landing[2]]);
    }
    out.push(landing);
    arcs++;
    out.push(b);
  }
  return { points: dedupe(out), arcs };
}

function turnAngle(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (lu <= EPS || lv <= EPS) return 0;
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

/** 陡腿判定：这一段几乎是在竖直下落（崖面），不是台地上的横走。 */
const steep = (p, q, maxSlope) => Math.abs(q[1] - p[1]) > maxSlope * len3(p, q);

/**
 * 内部拐点 → 二次贝塞尔圆角；直线段（转角 < minTurn）不动，避免无谓加密。
 * 崖沿拐点（相邻腿有一段近乎竖直）默认不圆角：二次贝塞尔是从拐角内侧切过去的，
 * 在凸棱上切进去就是扎进岩体，预览点会跑到崖壁里 —— 这一条由 buriedSamples 校验。
 */
export function roundCorners(points, { radius = 0.3, segs = 8, minTurn = 0.25, maxSlope = 0.7 } = {}) {
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  if (!points.every(isTriple)) throw new TypeError('finite XYZ triples required');
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('radius must be > 0');
  if (!Number.isInteger(segs) || segs < 2) throw new RangeError('segs must be an integer >= 2');
  if (!Number.isFinite(maxSlope) || maxSlope <= 0 || maxSlope >= 4) throw new RangeError('maxSlope must be in (0,4)');

  const src = dedupe(points);
  if (src.length < 3) return { points: src, corners: 0 };
  const out = [src[0]];
  let corners = 0;
  for (let i = 1; i < src.length - 1; i++) {
    const a = src[i - 1], b = src[i], c = src[i + 1];
    if (turnAngle(a, b, c) < minTurn) { out.push(b); continue; }
    if (steep(a, b, maxSlope) || steep(b, c, maxSlope)) { out.push(b); continue; }
    const la = len3(a, b), lc = len3(b, c);
    const d = Math.min(radius, 0.45 * la, 0.45 * lc);
    if (d <= EPS) { out.push(b); continue; }
    const t1 = [b[0] + (a[0] - b[0]) / la * d, b[1] + (a[1] - b[1]) / la * d, b[2] + (a[2] - b[2]) / la * d];
    const t2 = [b[0] + (c[0] - b[0]) / lc * d, b[1] + (c[1] - b[1]) / lc * d, b[2] + (c[2] - b[2]) / lc * d];
    out.push(t1);
    for (let k = 1; k < segs; k++) {
      const t = k / segs, w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
      out.push([
        w0 * t1[0] + w1 * b[0] + w2 * t2[0],
        w0 * t1[1] + w1 * b[1] + w2 * t2[1],
        w0 * t1[2] + w1 * b[2] + w2 * t2[2],
      ]);
    }
    out.push(t2);
    corners++;
  }
  out.push(src.at(-1));
  return { points: dedupe(out), corners };
}

/**
 * 完整预览点串：跨层落崖弧 → 圆角 → 等弧长撒点（间距 = spacing）。
 * 返回 { points, distances, length, hops, corners, arcs }。
 */
export function buildRoutePreview(nodes, { spacing = 0.12, radius = 0.3, minStep = 0.5, segs = 8, at = 0.5, land = 0.55, arcSegs = 8, maxSamples = 8192 } = {}) {
  if (!Array.isArray(nodes)) throw new TypeError('nodes must be an array');
  if (!nodes.every(isTriple)) throw new TypeError('finite XYZ triples required');
  if (!Number.isFinite(spacing) || spacing <= 0) throw new RangeError('spacing must be > 0');
  const src = dedupe(nodes);
  if (src.length === 0) return { points: [], distances: [], length: 0, hops: 0, corners: 0, arcs: 0 };
  if (src.length === 1) return { points: [src[0].slice()], distances: [0], length: 0, hops: 0, corners: 0, arcs: 0 };

  let hops = 0;
  for (let i = 1; i < src.length; i++) if (Math.abs(src[i][1] - src[i - 1][1]) >= minStep) hops++;

  const landed = landArcs(src, { minStep, at, land, arcSegs });
  const rounded = roundCorners(landed.points, { radius, segs });
  const sampled = samplePath(rounded.points, { spacing, maxSamples });
  return { ...sampled, hops, corners: rounded.corners, arcs: landed.arcs };
}

/**
 * 检查点拖拽（810157485638189056 片中的三轴 gizmo）：返回**新**节点串，不改入参。
 *
 * 片子 0020–0450 逐帧看：棕色块顶面一直画着三角剖分对角线，一个带红/绿/蓝三轴的方柄
 * 沿路线滑动，红曲线先画出、黑点再沿它铺开 —— 也就是「拖检查点 → 重采样」的实时回路。
 * 这里只做几何侧的搬运；手柄→世界坐标的反投影在页面里（2D 线性映射有精确逆）。
 */
export function moveCheckpoint(nodes, index, delta) {
  if (!Array.isArray(nodes)) throw new TypeError('nodes must be an array');
  if (!nodes.every(isTriple)) throw new TypeError('finite XYZ triples required');
  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) throw new RangeError('index out of range');
  if (!isTriple(delta)) throw new TypeError('delta must be a finite XYZ triple');
  const out = nodes.map((p) => p.slice());
  const from = out[index].slice();
  out[index] = [from[0] + delta[0], from[1] + delta[1], from[2] + delta[2]];
  return { nodes: out, moved: len3(from, out[index]), index };
}

/**
 * 累积轨迹模式：把新采样点并进历史点阵，按 xz 栅格去重（同格只留第一次的点），
 * 超过 max 从最早的开始丢。片子里点阵是「只增不减、铺满走过的地方」，不是每帧清空重画。
 *
 * trail 传空数组即可；返回新的 points（不原地改）。
 */
export function accumulateTrail(trail, added, { cell = 0.12, max = 8192 } = {}) {
  if (!Array.isArray(trail)) throw new TypeError('trail must be an array');
  if (!Array.isArray(added)) throw new TypeError('added must be an array');
  if (!trail.every(isTriple) || !added.every(isTriple)) throw new TypeError('finite XYZ triples required');
  if (!Number.isFinite(cell) || cell <= 0) throw new RangeError('cell must be > 0');
  if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be an integer >= 1');

  const key = (p) => `${Math.round(p[0] / cell)},${Math.round(p[2] / cell)}`;
  const seen = new Set(trail.map(key));
  const points = trail.map((p) => p.slice());
  let addedCount = 0;
  for (const p of added) {
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    points.push(p.slice());
    addedCount++;
  }
  let dropped = 0;
  while (points.length > max) { points.shift(); dropped++; }
  return { points, added: addedCount, dropped, cells: seen.size };
}

/**
 * 块面三角剖分线（调试层）：每个矩形顶面按一条对角线切成两片三角形。
 * 片子里棕色块的顶面全都有这条线，且相邻块的斜向不一致（不是全局统一方向）。
 *
 * 注意：矩形的两条对角线**等长**，所以没有「取短/取长」这回事，只有斜向：
 *   mode='a'   (x0,z0)-(x1,z1)
 *   mode='b'   (x0,z1)-(x1,z0)
 *   mode='alt' 按序号奇偶交替（片子里相邻块斜向不一致的样子）
 * 返回 3D 线段端点，直接给页面画。
 */
export function quadTriDiagonals(rects, { mode = 'a' } = {}) {
  if (!Array.isArray(rects)) throw new TypeError('rects must be an array');
  if (!['a', 'b', 'alt'].includes(mode)) throw new RangeError("mode must be 'a' | 'b' | 'alt'");
  const segments = [];
  let aCount = 0, bCount = 0;
  rects.forEach((r, i) => {
    for (const k of ['x0', 'x1', 'z0', 'z1', 'y']) if (!Number.isFinite(r?.[k])) throw new TypeError(`rect[${i}].${k} must be finite`);
    if (!(r.x1 > r.x0) || !(r.z1 > r.z0)) throw new RangeError(`rect[${i}] must have x1>x0, z1>z0`);
    const a = [r.x0, r.y, r.z0], b = [r.x1, r.y, r.z1];   // 对角线 A：(x0,z0)-(x1,z1)
    const c = [r.x0, r.y, r.z1], d = [r.x1, r.y, r.z0];   // 对角线 B：(x0,z1)-(x1,z0)
    const useA = mode === 'a' ? true : mode === 'b' ? false : (i % 2) === 0;
    if (useA) aCount++; else bCount++;
    segments.push(useA ? [a, b] : [c, d]);
  });
  return { segments, quads: rects.length, a: aCount, b: bCount };
}

/**
 * 拖拽回路要用的一组读数：点数 / 总长 / 跨层段 / 圆角 / 落崖弧 / 埋点数。
 * surface 给了才数埋点（没给就是 null）。
 */
export function editRouteStats(nodes, { spacing = 0.16, radius = 0.35, surface = null, tol = 0.02, ...rest } = {}) {
  const built = buildRoutePreview(nodes, { spacing, radius, ...rest });
  return {
    count: built.points.length,
    length: built.length,
    hops: built.hops,
    corners: built.corners,
    arcs: built.arcs,
    buried: typeof surface === 'function' ? buriedSamples(built.points, surface, tol).length : null,
    points: built.points,
  };
}

/**
 * 埋在岩体里的点数：surface(x,z) 返回该处地面高度，点比地面低 tol 以上就算埋住。
 * 预览点串应当返回 0（片子里白点永远浮在地表上）。
 */
export function buriedSamples(points, surface, tol = 0.02) {
  if (!Array.isArray(points) || typeof surface !== 'function') throw new TypeError('points array + surface fn required');
  if (!Number.isFinite(tol) || tol < 0) throw new RangeError('tol must be >= 0');
  const hits = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!isTriple(p)) throw new TypeError('finite XYZ triples required');
    const g = surface(p[0], p[2]);
    if (Number.isFinite(g) && p[1] < g - tol) hits.push(i);
  }
  return hits;
}
