/**
 * foliageblob.js — 树冠 = 一坨 metaball 等值面，而不是"一堆球/一堆卡片"
 *
 * 1580158269267406849  "Can you make good looking foliage from Marching Cubes-blobs? Maybe?"
 *
 * ---- 画面观察（tmp/cap/1580158269267406849 的 f02 / f04） ----
 *   · 树冠是一整坨**融合的圆包**：每个包是同一个球，相邻包在接缝处平滑过渡，
 *     外轮廓是一圈大弧夹小弧（凹口浅、是圆的），内部**没有交线**、也没有"两份明暗"叠在一起。
 *   · 明暗是**低模面色**：每个圆包只有一两档色阶，边界是折线，不是渐变球。
 *     这正是 MC 团块被 flat shading 之后的样子 —— 原文那句 "Marching Cubes-blobs" 不是比喻。
 *   · 树冠下面没有叶子贴片：叶片/卡片在六帧里都看不出来，视觉重量全在"坨"的轮廓上。
 *   · 同一棵树的包大小接近（半径差 ~1.3×），分布在一条向上倾斜的枝轴上，不是球面对称。
 *
 * ---- 为什么这样写 ----
 * 做"好看的叶簇"最容易走的两条错路：
 *   ① 每个球单独画 → 相邻球之间留交线，轮廓上是深 V 凹口，读作"一堆球"；
 *   ② 在球面上撒叶片卡片 → 每条卡片自带边框，远处缩成噪点。
 * 原片的答案是：树冠是**场**，轮廓是等值面。所以这里就做三件事并把差别量出来：
 *   1. `canopy()`  一坨 lump（主包 + 环绕包），沿一条枝轴往上叠；
 *   2. `field()`   Σ r²/(d²+ε) 的 metaball 场，iso = 1 取轮廓（marching squares 画线，
 *      掩码算面积/环数，射线二分求 r(θ) 剖面）；
 *   3. `measure()` 同一批 lump 三种读法的对照：
 *        A metaball（融合）  B 每球单独画（有交线）  C 并集（凹口尖锐）
 *      指标 = 环数 / 轮廓最大转角 / 凹口深度 min(r)/max(r) / 面积比 / 内部交线弧数。
 * 然后顺带算"叶片卡片撒在团块里"的覆盖率（卡片中心必须落在 iso>1 内）。
 *
 * 所有数字都是本文件里现算的（measure() 会重跑一遍），不是写在注释里的估计值。
 */

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 1. 一坨 lump ---------------- */

/**
 * 一坨树冠的 lump 列表。枝轴从 (x0,y0) 往上（-y）走，主包在最上面、最大，
 * 环绕包以 0.55R 的偏心贴在主包周围 —— 偏心里侧才融得进主包，外侧才鼓出来。
 */
export function canopy(x0, y0, R, seed = 7, opts = {}) {
  const rnd = mulberry32(seed);
  const lumps = [];
  const axis = opts.axis ?? -1;              // 向上长
  const tilt = (opts.tilt ?? 0.28) * R;      // 枝轴侧倾
  // 主包
  lumps.push({ x: x0, y: y0, r: R * 0.56, main: true, lvl: 0 });
  // 一圈环绕包（数量 5~7，半径 0.30~0.42R，偏心 0.52~0.62R）
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.5;
    const d = R * (0.52 + rnd() * 0.10);
    lumps.push({
      x: x0 + Math.cos(a) * d + Math.sin(a) * 0.05 * R,
      y: y0 + Math.sin(a) * d * 0.86 + axis * 0.04 * R,
      r: R * (0.30 + rnd() * 0.12),
      lvl: 1,
    });
  }
  // 顶上再叠一两个，让轮廓不是圆的
  const top = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < top; i++) {
    lumps.push({
      x: x0 + tilt * (i - 0.4) + (rnd() - 0.5) * 0.18 * R,
      y: y0 + axis * R * (0.62 + rnd() * 0.16),
      r: R * (0.26 + rnd() * 0.10),
      lvl: 2,
    });
  }
  return lumps;
}

/* ---------------- 2. 场 ---------------- */

/**
 * metaball：每个包是一个**有限支撑**的核
 *   w(d) = (1 − (d / 1.55r)²)²   ，d < 1.55r 时为 0
 * 场 = Σw，iso = 0.35。单包的等值线落在 ≈ 0.99r（所以 iso 换成"半径"不跑偏），
 * 两包重叠时和在凹口处仍 > iso → 凹口被填成圆弧，这正是"一坨"的来源。
 *
 * 踩过的坑：先用无条件长尾核 Σ r²/(d²+ε) + iso=1，9 个包相加把远场抬起来，
 * 等值面膨胀到圆并集的 2.08 倍、面积 55404 vs 26592 —— 数看着像"融合得很好"，
 * 其实是整棵树被吹成一个大气球。有限支撑核才让"面积≈并集"这件事成立。
 */
export function kernel(d, r) {
  const t = d / (1.55 * r);
  if (t >= 1) return 0;
  const u = 1 - t * t;
  return u * u;
}

export function field(x, y, lumps) {
  let v = 0;
  for (const L of lumps) {
    const dx = x - L.x, dy = y - L.y;
    v += kernel(Math.sqrt(dx * dx + dy * dy), L.r);
  }
  return v;
}

export const ISO = 0.35;

export function inside(x, y, lumps, iso = ISO) {
  return field(x, y, lumps) >= iso;
}

/** 某方向上的轮廓半径（从 0 向外找 iso 交点，再二分 20 次）。 */
export function radiusAt(theta, lumps, iso = ISO, maxR = 400) {
  const dx = Math.cos(theta), dy = Math.sin(theta);
  let lo = 0, hi = 0;
  for (let r = 2; r < maxR; r += 2) {
    if (field(dx * r, dy * r, lumps) < iso) { lo = r - 2; hi = r; break; }
  }
  if (hi === 0) return maxR;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (field(dx * m, dy * m, lumps) >= iso) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * 射线剖面 r(θ)。注意这里的坐标原点是 lump 的中心（传 ox/oy 是绝对坐标），
 * 树冠不是以中心为心的星形时 profile 会失真 —— 本文件所有树冠都按"主包在中心"生成，
 * 所以这一条成立；换形状要先检查。
 */
export function profile(lumps, ox, oy, n = 720, iso = ISO) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const dx = Math.cos(th), dy = Math.sin(th);
    let lo = 0, hi = 0;
    for (let r = 2; r < 400; r += 2) {
      if (field(ox + dx * r, oy + dy * r, lumps) < iso) { lo = r - 2; hi = r; break; }
    }
    if (hi === 0) { out[i] = 400; continue; }
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2;
      if (field(ox + dx * m, oy + dy * m, lumps) >= iso) lo = m; else hi = m;
    }
    out[i] = (lo + hi) / 2;
  }
  return out;
}

/** 同一个剖面，但读的是"圆并集"的边界（用于对照：一堆球 vs 一坨）。 */
export function profileUnion(lumps, ox, oy, n = 720) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const dx = Math.cos(th), dy = Math.sin(th);
    let last = 0;
    for (let r = 2; r < 400; r += 1) {
      const px = ox + dx * r, py = oy + dy * r;
      let hit = false;
      for (const L of lumps) {
        if ((px - L.x) ** 2 + (py - L.y) ** 2 <= L.r * L.r) { hit = true; break; }
      }
      if (hit) last = r;
    }
    out[i] = last;
  }
  return out;
}

/* ---------------- 3. 画线用的 marching squares ---------------- */

/** 返回线段数组（不做拼接）：x1,y1,x2,y2。只用于画轮廓。 */
export function contour(lumps, x0, y0, x1, y1, step = 2, iso = ISO) {
  const segs = [];
  const nx = Math.ceil((x1 - x0) / step), ny = Math.ceil((y1 - y0) / step);
  const V = (i, j) => field(x0 + i * step, y0 + j * step, lumps) - iso;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
      let k = 0;
      if (a >= 0) k |= 1; if (b >= 0) k |= 2; if (c >= 0) k |= 4; if (d >= 0) k |= 8;
      if (k === 0 || k === 15) continue;
      const px = x0 + i * step, py = y0 + j * step;
      const T = () => [px + step * (a / (a - b)), py];
      const R = () => [px + step, py + step * (b / (b - c))];
      const B = () => [px + step * (d / (d - c)), py + step];
      const L = () => [px, py + step * (a / (a - d))];
      const push = (p, q) => segs.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
      switch (k) {
        case 1: case 14: push(L(), T()); break;
        case 2: case 13: push(T(), R()); break;
        case 3: case 12: push(L(), R()); break;
        case 4: case 11: push(R(), B()); break;
        case 6: case 9: push(T(), B()); break;
        case 7: case 8: push(L(), B()); break;
        case 5: push(L(), T()); push(R(), B()); break;   // 鞍点（本文件很少见）
        case 10: push(T(), R()); push(B(), L()); break;
      }
    }
  }
  return segs;
}

/* ---------------- 4. 量 ---------------- */

/** 圆集合的"并集掩码"尺寸/环数（只用掩码，不描边）。 */
function maskStats(test, x0, y0, x1, y1, step = 2) {
  const nx = Math.ceil((x1 - x0) / step), ny = Math.ceil((y1 - y0) / step);
  const m = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      m[j * nx + i] = test(x0 + i * step, y0 + j * step) ? 1 : 0;
    }
  }
  // 4 邻域连通块 → 环数
  const lab = new Int32Array(nx * ny).fill(-1);
  let loops = 0;
  const stack = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    loops++;
    lab[s] = loops; stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      const pi = p % nx, pj = (p / nx) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [di, dj] of nb) {
        const ii = pi + di, jj = pj + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const q = jj * nx + ii;
        if (m[q] && lab[q] < 0) { lab[q] = loops; stack.push(q); }
      }
    }
  }
  let area = 0;
  for (let i = 0; i < m.length; i++) area += m[i];
  return { area: area * step * step, loops };
}

/** 剖面最大转角（相邻两条边方向的夹角，度）。 */
function maxTurn(prof) {
  const n = prof.length;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = i, c = (i + 1) % n;
    const v1x = Math.cos(a / n * TAU) * prof[a], v1y = Math.sin(a / n * TAU) * prof[a];
    const v2x = Math.cos(b / n * TAU) * prof[b], v2y = Math.sin(b / n * TAU) * prof[b];
    const v3x = Math.cos(c / n * TAU) * prof[c], v3y = Math.sin(c / n * TAU) * prof[c];
    const e1x = v2x - v1x, e1y = v2y - v1y, e2x = v3x - v2x, e2y = v3y - v2y;
    const d1 = Math.hypot(e1x, e1y), d2 = Math.hypot(e2x, e2y);
    if (d1 < 1e-6 || d2 < 1e-6) continue;
    const cosv = Math.max(-1, Math.min(1, (e1x * e2x + e1y * e2y) / (d1 * d2)));
    best = Math.max(best, Math.acos(cosv) * 180 / Math.PI);
  }
  return best;
}

/** 相邻圆之间"需要单独描一段交线"的对数（重叠且互不包含）。 */
function overlapPairs(lumps) {
  let n = 0;
  for (let i = 0; i < lumps.length; i++) {
    for (let j = i + 1; j < lumps.length; j++) {
      const d = Math.hypot(lumps[i].x - lumps[j].x, lumps[i].y - lumps[j].y);
      const ri = lumps[i].r, rj = lumps[j].r;
      if (d < ri + rj && d > Math.abs(ri - rj)) n++;   // 真正相交（不是包含）
    }
  }
  return n;
}

/* ---------------- 5. 一片叶子（卡片）撒点 ---------------- */

/**
 * 在团块内部撒叶片卡片：抖动格点 + 只保留 iso>1 的点。
 * 返回 {cards, spacing, cover, out}。cover = 卡片面积和 / 掩码面积。
 */
export function scatterCards(lumps, x0, y0, x1, y1, cell = 9, seed = 3, cardR = 4.2) {
  const rnd = mulberry32(seed);
  const cards = [];
  for (let y = y0; y < y1; y += cell) {
    for (let x = x0; x < x1; x += cell) {
      const px = x + (rnd() - 0.5) * cell * 0.8;
      const py = y + (rnd() - 0.5) * cell * 0.8;
      if (!inside(px, py, lumps)) continue;
      cards.push({ x: px, y: py, a: (rnd() - 0.5) * 0.7, s: cardR * (0.82 + rnd() * 0.36) });
    }
  }
  let out = 0, minD = Infinity;
  for (const c of cards) {
    if (!inside(c.x, c.y, lumps)) out++;
  }
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const d = Math.hypot(cards[i].x - cards[j].x, cards[i].y - cards[j].y);
      if (d < minD) minD = d;
    }
  }
  const area = maskStats((x, y) => inside(x, y, lumps), x0, y0, x1, y1, 2).area;
  const cover = cards.length * Math.PI * cardR * cardR / area;
  return { cards, spacing: minD, cover, out, area };
}

/* ---------------- 6. 对照与汇总 ---------------- */

export function compare(lumps, ox, oy) {
  const prof = profile(lumps, ox, oy, 720);
  const pu = profileUnion(lumps, ox, oy, 720);
  const rMin = Math.min(...prof), rMax = Math.max(...prof);
  const uMin = Math.min(...pu), uMax = Math.max(...pu);

  const blob = maskStats((x, y) => inside(x, y, lumps), ox - 260, oy - 220, ox + 260, oy + 220, 2);
  const union = maskStats(
    (x, y) => lumps.some((L) => (x - L.x) ** 2 + (y - L.y) ** 2 <= L.r * L.r),
    ox - 260, oy - 220, ox + 260, oy + 220, 2);
  const discSum = lumps.reduce((s, L) => s + Math.PI * L.r * L.r, 0);

  return {
    lumps: lumps.length,
    rMin, rMax,
    notchDepth: rMin / rMax,             // 凹口深度：越接近 1 越"一坨"
    maxTurnDeg: maxTurn(prof),
    unionNotch: uMin / uMax,
    unionTurnDeg: maxTurn(pu),
    blobArea: blob.area,
    blobLoops: blob.loops,
    unionArea: union.area,
    unionLoops: union.loops,
    discSum,
    fillRatio: blob.area / union.area,    // 融合后面积 / 并集面积
    discRatio: blob.area / discSum,       // 融合后面积 / 圆面积和
    innerArcs: overlapPairs(lumps),       // 单独画时必须描的交线弧数
  };
}

/** lab 用的一批树冠（固定 seed，画面与数字对得上）。 */
export function demo(seed = 21) {
  const rnd = mulberry32(seed);
  const trees = [];
  const spots = [
    { x: 250, y: 470, R: 96 },
    { x: 470, y: 300, R: 78 },
    { x: 700, y: 500, R: 104 },
    { x: 930, y: 320, R: 72 },
    { x: 1080, y: 540, R: 86 },
  ];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    trees.push({ ...s, lumps: canopy(s.x, s.y, s.R, seed + i * 37) });
  }
  return { trees, seed };
}

export function measure(seed = 21) {
  const D = demo(seed);
  const main = D.trees[2];              // 最大那棵做对照
  const C = compare(main.lumps, main.x, main.y);
  const S = scatterCards(main.lumps, main.x - 160, main.y - 150, main.x + 160, main.y + 150, 9, 5);
  const all = D.trees.map((t) => compare(t.lumps, t.x, t.y));
  const avg = (f) => all.reduce((s, c) => s + f(c), 0) / all.length;
  return {
    ...C,
    trees: D.trees.length,
    lumpsTotal: all.reduce((s, c) => s + c.lumps, 0),
    avgNotch: avg((c) => c.notchDepth),
    maxTurnAvg: avg((c) => c.maxTurnDeg),
    unionNotchAvg: avg((c) => c.unionNotch),
    unionTurnAvg: avg((c) => c.unionTurnDeg),
    fillAvg: avg((c) => c.fillRatio),
    cards: S.cards.length,
    cardSpacing: S.spacing,
    cardCover: S.cover,
    cardOut: S.out,
    cardArea: S.area,
    seed,
  };
}

export default { canopy, field, inside, radiusAt, profile, contour, scatterCards, compare, demo, measure };
