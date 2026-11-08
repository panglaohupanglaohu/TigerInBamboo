/**
 * quadinf.js — 让"不规则四边形网格"能无限延展：把生成改成**按坐标寻址**。
 *
 * 1151137783785771008  "As promised: an aperiodic infinite deterministic
 *   irregular relaxed quadrilateral grid."
 *
 * ---- 为什么单独写这一份（缺口） ----
 * src/quadgrid.js 的 buildQuadGrid() 是一张**有限 patch**：顶点先塞进一个数组、
 * 三角形随机两两合并、最后整体松弛，网格边上用 pinned rim 钉住。这条片子的原帖
 * 只有一个词是新增的：**infinite**。要无限，就不能"先生成一坨再切"，必须让
 * **每个顶点、每块格子的坐标只由它自己的晶格索引 (q,r) 与 seed 决定**：
 *
 *   · 顶点位置 = 三角晶格位置 + hash(seed,q,r) 抖动  → 同一 (q,r) 在哪个 chunk
 *     里算都是同一个点，两块 chunk 交界处的点号/坐标**天然相等**，缝 = 0。
 *   · 一块格子里"合并成菱形还是留两个三角形" = hash(seed,q,r) 的一次判定，
 *     这是**局部**决定，不需要全局匹配，所以也能无限。
 *     （quadgrid.js 里那一步是"随机挑一对邻居合并"，本质是匹配问题：一个三角形
 *      只能属于一次合并，谁跟谁配要做好几次全局裁决 —— 那种写法没法流式。）
 *   · 每条边取中点、每块多边形取重心，再切成四边形（与 quadgrid 第 3 步同构）。
 *
 * ---- 代价：松弛是扩散，跟"无限"本质冲突（实测见 measure()） ----
 * 上面三件都是**局部**运算，缝严格 0。但最后一步 relax 是把每格拉向正方的迭代，
 * 它是扩散：一个顶点最终位置取决于**它能走多远之外**的东西。所以：
 *   · 不松弛：任意两个原点生成的 chunk，重叠顶点的坐标**逐位相同**（diff 0.000000）；
 *   · 松弛 80 遍：chunk 边界必须冻住（rim），两个不同原点会冻在不同位置 →
 *     重叠顶点被拉开（diff 见 measure().relaxSeam），边界一圈方格也变差。
 * 也就是说"无限 + 松弛"只能取折中：**固定一个松弛半径（halo），边界冻住**。
 * 本模块把两个数都量出来，不假装缝是 0。
 *
 * ---- 与原版的差别（诚实标注） ----
 * 1. 原版先随机合并三角形、再把多边形细分；这里是"每个菱形单元自己决定合并与否"，
 *    视觉上同为"菱形块 + 三角形块混排"，但**合并的配对自由度少一个维度**（只能同格
 *    内的两块三角合并）。这是为了流式付出的代价，不是等价变换。
 * 2. 抖动振幅取 L 的 ±0.30，实测四边形仍全凸（非凸 0 块）；再大就会翻面。
 */

const SQRT3 = Math.sqrt(3);

/** 32 位混合 hash → [0,1)。三个序号参数保证"同 (seed,q,r) 恒同值"。 */
function hash(seed, a, b, k) {
  let h = Math.imul(seed | 0, 374761393)
        ^ Math.imul((a + 1013) | 0, 668265263)
        ^ Math.imul((b + 2029) | 0, 2246822519)
        ^ Math.imul((k + 37) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 三角晶格顶点（带抖动）。**唯一入口** —— 所有位置都从这里算，不存全局表。 */
export function vertexPos(seed, q, r, L = 1, jitter = 0.30) {
  const x0 = L * (q + r / 2);
  const z0 = L * (SQRT3 / 2) * r;
  return {
    x: x0 + (hash(seed, q, r, 1) - 0.5) * 2 * jitter * L,
    z: z0 + (hash(seed, q, r, 2) - 0.5) * 2 * jitter * L,
    key: `v${q}:${r}`, q, r,
  };
}

function midKey(a, b) {
  const ka = `${a.q}:${a.r}`, kb = `${b.q}:${b.r}`;
  return ka < kb ? `m${ka}|${kb}` : `m${kb}|${ka}`;
}

/**
 * 生成一块 chunk。**同样的参数永远得到同样的格子**，与调用顺序无关。
 *
 * @param {object} o
 * @param {number} o.seed
 * @param {number} o.q0,o.r0   窗口左下角（菱形单元索引）
 * @param {number} o.w,o.h     窗口宽高（单元数）
 * @param {number} o.halo      额外多算几圈（松弛需要邻域；取 0 也能出门，位置函数化不需要邻域）
 * @param {number} o.relaxPasses  0 = 不松弛
 * @param {number} o.mergeRate    菱形单元合并成一块四边形的比例
 */
export function buildChunk({
  seed = 1337, q0 = 0, r0 = 0, w = 8, h = 8, L = 1,
  halo = 1, relaxPasses = 0, mergeRate = 0.5, jitter = 0.30,
} = {}) {
  const verts = new Map();
  const quads = [];
  const insideWindow = (q, r) => q >= q0 && q < q0 + w && r >= r0 && r < r0 + h;

  const put = (p) => {
    let v = verts.get(p.key);
    if (!v) { v = { ...p, movable: false, fx: 0, fz: 0, fn: 0 }; verts.set(p.key, v); }
    return v;
  };
  const getV = (q, r) => put(vertexPos(seed, q, r, L, jitter));

  // 中点 / 重心都是"从顶点算出来的"，同样不含任何全局状态
  const getMid = (a, b) => put({
    key: midKey(a, b),
    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
    q: (a.q + b.q) / 2, r: (a.r + b.r) / 2,
  });
  const getCenter = (poly, tag) => {
    let x = 0, z = 0;
    for (const p of poly) { x += p.x; z += p.z; }
    return put({ key: `c${tag}`, x: x / poly.length, z: z / poly.length, q: NaN, r: NaN });
  };
  /** 一块多边形 → n 个四边形：[角点, 下条边中点, 重心, 上条边中点] */
  const subdivide = (poly, tag, cq, cr) => {
    const n = poly.length;
    const c = getCenter(poly, tag);
    if (insideWindow(cq, cr)) c.movable = true;   // 重心也要能动，否则格子拉不方
    const mids = poly.map((p, i) => getMid(p, poly[(i + 1) % n]));
    for (let i = 0; i < n; i++) {
      const cur = poly[i];
      const a = mids[i];                 // (cur, next) 的中点
      const b = mids[(i + n - 1) % n];    // (prev, cur) 的中点
      if (insideWindow(cq, cr)) { a.movable = true; b.movable = true; }
      quads.push({ verts: [cur, a, c, b], tag: `${tag}.${i}`, cq, cr });
    }
  };

  const qa = q0 - halo, qb = q0 + w + halo, ra = r0 - halo, rb = r0 + h + halo;
  for (let q = qa; q < qb; q++) {
    for (let r = ra; r < rb; r++) {
      const A = getV(q, r), B = getV(q + 1, r), C = getV(q, r + 1), D = getV(q + 1, r + 1);
      const merged = hash(seed, q, r, 3) < mergeRate;
      const tag = `|${q}:${r}`;
      if (merged) {
        subdivide([A, B, D, C], tag + 'm', q, r);     // 菱形：4 块
      } else {
        subdivide([A, B, C], tag + 'u', q, r);        // 上三角：3 块
        subdivide([B, D, C], tag + 'd', q, r);        // 下三角：3 块
      }
      // 窗口内的单元，其顶点才可动（边界一冻结，chunk 就是可复现的）
      if (insideWindow(q, r)) {
        for (const v of [A, B, C, D]) v.movable = true;
      }
    }
  }

  // ---- 松弛：每格拉向"最佳拟合正方形"（与 quadgrid.js 第 4 步同一套公式） ----
  if (relaxPasses > 0) {
    for (let pass = 0; pass < relaxPasses; pass++) {
      for (const v of verts.values()) { v.fx = 0; v.fz = 0; v.fn = 0; }
      for (const qd of quads) {
        const p = qd.verts;
        let cx = 0, cz = 0;
        for (const v of p) { cx += v.x; cz += v.z; }
        cx /= 4; cz /= 4;
        let vx = 0, vz = 0;
        for (let i = 0; i < 4; i++) {
          let ox = p[i].x - cx, oz = p[i].z - cz;
          for (let k = 0; k < i; k++) { const t = ox; ox = oz; oz = -t; }
          vx += ox; vz += oz;
        }
        vx /= 4; vz /= 4;
        let tx = vx, tz = vz;
        for (let i = 0; i < 4; i++) {
          const v = p[i];
          v.fx += cx + tx - v.x; v.fz += cz + tz - v.z; v.fn += 1;
          const t = tx; tx = -tz; tz = t;
        }
      }
      const k = pass < relaxPasses * 0.5 ? 0.45 : 0.30;
      for (const v of verts.values()) {
        if (!v.movable || v.fn === 0) continue;
        v.x += (v.fx / v.fn) * k;
        v.z += (v.fz / v.fn) * k;
      }
    }
  }

  // id 只依赖 key 的字典序（不用插入序，避免"顺序不同结果不同"）
  const keys = [...verts.keys()].sort();
  const idOf = new Map(keys.map((k, i) => [k, i]));
  for (const v of verts.values()) v.id = idOf.get(v.key);
  quads.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  // ---- 邻接（用边做键，不推导公式，避免中点细分的朝向踩坑） ----
  // 注意：必须在这里才取 id —— 上面 push 时 id 还没分配（踩过：全部是 undefined，边表只剩 1 条）
  const edgeOwner = new Map();
  for (const qd of quads) {
    qd.ids = qd.verts.map((v) => v.id);
    for (let i = 0; i < 4; i++) {
      const a = qd.ids[i], b = qd.ids[(i + 1) % 4];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      const list = edgeOwner.get(k);
      if (list) list.push(qd); else edgeOwner.set(k, [qd]);
    }
  }
  let shared = 0, dangling = 0, over = 0;
  for (const [, list] of edgeOwner) {
    if (list.length === 2) shared++;
    else if (list.length === 1) dangling++;
    else over++;
  }

  const inWin = quads.filter((qd) => insideWindow(qd.cq, qd.cr));

  return {
    quads, quadsInWindow: inWin, verts, edgeOwner,
    stats: { quads: quads.length, quadsInWindow: inWin.length, shared, dangling, over, verts: verts.size },
  };
}

/** 四边形内角偏离 90° 的平均/最大值；顺带数非凸块。 */
export function squareness(quads) {
  let sum = 0, max = 0, n = 0, nonConvex = 0;
  for (const qd of quads) {
    const p = qd.verts;
    let bad = 0;
    for (let i = 0; i < 4; i++) {
      const a = p[(i + 3) % 4], b = p[i], c = p[(i + 1) % 4];
      const ux = a.x - b.x, uz = a.z - b.z, vx = c.x - b.x, vz = c.z - b.z;
      const ang = Math.atan2(Math.abs(ux * vz - uz * vx), ux * vx + uz * vz) * 180 / Math.PI;
      const dev = Math.abs(ang - 90);
      sum += dev; n++; if (dev > max) max = dev;
      if (ang >= 180 - 1e-9) bad++;
    }
    if (bad) nonConvex++;
  }
  return { mean: sum / n, max, nonConvex, n };
}

/** 两块**不同原点**、覆盖同一片区域的 chunk，重叠格子的顶点坐标差。 */
export function seamDiff({ seed = 1337, relaxPasses = 0, halo = 2 } = {}) {
  const A = buildChunk({ seed, q0: 0, r0: 0, w: 7, h: 6, halo, relaxPasses });
  const B = buildChunk({ seed, q0: 2, r0: 1, w: 7, h: 6, halo, relaxPasses });
  const byKey = new Map([...B.verts.values()].map((v) => [v.key, v]));
  let maxD = 0, cnt = 0, exact = 0;
  for (const a of A.verts.values()) {
    const b = byKey.get(a.key);
    if (!b) continue;
    cnt++;
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d === 0) exact++;
    if (d > maxD) maxD = d;
  }
  return { sharedVerts: cnt, exactEqual: exact, maxDiff: maxD };
}

/**
 * 周期性体检：把 18×18 顶点位置量化到 1e-4，再试一遍所有平移 (dq,dr)，
 * 看有没有哪个非零平移能把点集映回自己。抖动为 0 时应当"每个平移都命中"（对照组）。
 */
export function aperiodicity({ seed = 1337, jitter = 0.30, N = 18, span = 9 } = {}) {
  const key = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.z * 1e4)}`;
  const set0 = new Set();
  for (let q = 0; q < N; q++) for (let r = 0; r < N; r++) set0.add(key(vertexPos(seed, q, r, 1, jitter)));
  let hits = 0, tried = 0, firstHit = null;
  for (let dq = -span; dq <= span; dq++) {
    for (let dr = -span; dr <= span; dr++) {
      if (dq === 0 && dr === 0) continue;
      tried++;
      // 只比"平移后仍在窗口内"的那部分点，否则边界会永远对不上（第一版就是这么跑出 0 命中的）
      const dx = dq + dr / 2, dz = (SQRT3 / 2) * dr;   // 晶格平移在 x,z 上的位移
      let ok = 0, tot = 0;
      for (let q = 0; q < N; q++) for (let r = 0; r < N; r++) {
        const qq = q + dq, rr = r + dr;
        if (qq < 0 || qq >= N || rr < 0 || rr >= N) continue;
        const p = vertexPos(seed, q, r, 1, jitter);
        tot++; if (set0.has(key({ x: p.x + dx, z: p.z + dz }))) ok++;
      }
      if (tot > N * N * 0.15 && ok === tot) { hits++; if (!firstHit) firstHit = [dq, dr]; }
    }
  }
  return { tried, hits, firstHit, note: 'hits = 能把整片点集映回自己的非零平移个数（只比平移后仍在窗口内的点）' };
}

/** 一轮体检，数字全部现算，lab 与 node 用同一份。 */
export function measure({ seed = 1337, relaxPasses = 80, halo = 2 } = {}) {
  const raw = buildChunk({ seed, q0: 0, r0: 0, w: 18, h: 14, L: 1, halo, relaxPasses: 0 });
  const rel = buildChunk({ seed, q0: 0, r0: 0, w: 18, h: 14, L: 1, halo, relaxPasses });
  const sq0 = squareness(raw.quadsInWindow);
  const sq1 = squareness(rel.quadsInWindow);
  const s0 = seamDiff({ seed, relaxPasses: 0, halo });
  const s1 = seamDiff({ seed, relaxPasses, halo });
  const ap = aperiodicity({ seed });
  const apCtrl = aperiodicity({ seed, jitter: 0 });

  // 合并/拆分混排比例 + 每单元块数
  let merged = 0, split = 0;
  for (let q = 0; q < 18; q++) for (let r = 0; r < 14; r++) {
    if (hash(seed, q, r, 3) < 0.5) merged++; else split++;
  }
  const cells = 18 * 14;

  return {
    seed, relaxPasses, halo,
    cells,
    mergedCells: merged, splitCells: split,
    quads: rel.stats.quadsInWindow,
    quadsPerCell: rel.stats.quadsInWindow / cells,
    sharedEdges: rel.stats.shared, danglingEdges: rel.stats.dangling, overEdges: rel.stats.over,
    verts: rel.stats.verts,
    squareBefore: sq0, squareAfter: sq1,
    seamBefore: s0, seamAfter: s1,
    aperiodic: ap, aperiodicControl: apCtrl,
    determinism: (() => {
      const x = buildChunk({ seed, q0: 3, r0: 2, w: 5, h: 5, halo, relaxPasses });
      const y = buildChunk({ seed, q0: 3, r0: 2, w: 5, h: 5, halo, relaxPasses });
      let diff = 0;
      for (const v of x.verts.values()) {
        const w2 = y.verts.get(v.key);
        if (!w2 || Math.hypot(v.x - w2.x, v.z - w2.z) > 0) diff++;
      }
      return { differing: diff, quads: x.stats.quads };
    })(),
  };
}

/**
 * 正方度的**下限**在哪：四边形内角受顶点价数锁死 —— 6 条边交汇的顶点，每块格子的
 * 那个角只能是 360/6 = 60°，离 90° 恒差 30°，再松弛也拉不回来。
 * 这个函数按"顶点被几块格子共用"分组统计偏差，用来证明 17.8° 的残差不是松弛没做完。
 */
export function valenceReport(quads) {
  const use = new Map();
  for (const qd of quads) for (const v of qd.verts) use.set(v.id, (use.get(v.id) || 0) + 1);
  const acc = new Map();
  for (const qd of quads) {
    const p = qd.verts;
    for (let i = 0; i < 4; i++) {
      const a = p[(i + 3) % 4], b = p[i], c = p[(i + 1) % 4];
      const ux = a.x - b.x, uz = a.z - b.z, vx = c.x - b.x, vz = c.z - b.z;
      const ang = Math.atan2(Math.abs(ux * vz - uz * vx), ux * vx + uz * vz) * 180 / Math.PI;
      const k = use.get(b.id) || 0;
      const cur = acc.get(k) || { n: 0, sum: 0 };
      cur.n++; cur.sum += Math.abs(ang - 90); acc.set(k, cur);
    }
  }
  const out = {};
  for (const [k, v] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
    out['val' + k] = { n: v.n, meanDev: v.sum / v.n, idealDev: Math.abs(360 / k - 90) };
  }
  return out;
}

export { hash };
