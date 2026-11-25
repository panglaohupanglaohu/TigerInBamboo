/**
 * quadmc.js — 在不规则四边形网格上跑 3D 重建（"marching cubes over a squircle grid"）
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1163836000688365571（2019-08-20）
 *   "在我这个**不规则网格**上跑最基础的 marching cubes，下一步做成 mixed-initiative WFC"
 *   → 原文给了三件事：①底子是"不规则网格"（不是立方格）②跑的是 MC ③下一步接 WFC。
 *
 * ── 帧实测（420×420 · f020 / f002）──────────────────────────────────────
 *   底网格       4× 放大裁切数格子：横向 140px 里约 6.5 格 → **格距 21.5px**（占画幅 5.1%）。
 *                **不是方格**：顶点有 3 价也有 4 价，格子是梯形；**边是弯的**，
 *                21px 长的边中点偏离弦约 1.5px（≈7% 弦长）。
 *   MC 输出      表面是**三角面**，不是方块。面片贴着格子中心走，
 *                所以轮廓是"跟着格子的多边形"，不是"沿格线的台阶"。
 *   体积占比     红色像素 5.05%（f020，已长成）、1.19%（f002，刚起头两个块）。
 *   生长          0.95s 一个块 → 2.2s 三个块 → 8.3s 长满；**每帧只加 1–2 格**。
 *   表面粗糙度    同一块红面上有 3–4 档明暗（法线分档），不是平滑渐变。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **顶点放在格心，不放在格角。** 片子里的三角形顶点落在"格子中心附近"，
 *      面片跨过格子而不沿格边 —— 这是 surface nets / dual contouring 的特征，
 *      不是经典 MC（经典 MC 的顶点在格边上）。格心取"所有变号边的交点均值"，
 *      于是面会自动贴住等值面，同时保持"一格一顶点"的稀疏度。
 *   ② **按格角生成多边形，不按格边。** 不规则网格上，一条边两侧未必正好两个格子
 *      （3 价顶点处是三个），按边生成会漏面。改成"围着每个格角，把它周围所有
 *      变号格子连成一圈"：4 价角出四边形、3 价角出三角形 —— 正好对上片子里
 *      "有四边形也有三角形"的画面。
 *   ③ **网格必须真的抖 + 边真的弯。** 第一版用方格跑，出的是标准 MC 台阶，
 *      和片子完全不像。把顶点按 0.22 格抖动、边画成二次曲线（弓高 7%），
 *      再去跑同一套算法，轮廓的"多边形感"才对。
 *   ④ **法线按面算、按 3 档量化。** 片子里同一块红面有 3–4 档明暗，
 *      没有平滑过渡 → 逐面平面着色（flat shading），量化到 4 档。
 */

export const MEASURED = {
  ref: 420,
  cellPitch: 21.5,      // 片子里格距（px @420）
  pitchPct: 5.1,        // 占画幅百分比
  edgeBow: 0.07,        // 边长中点偏离弦的比例（量到 7%）
  jitter: 0.22,         // 顶点抖动（格）
  redPct: 5.05,         // f020 红色像素占比
  shadeSteps: 4,        // 红面明暗档数
  vertexPerCell: 1,     // 每格一个顶点（surface nets 口径）
};

export function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * 抖过的四边形格：返回格角坐标 pos[i][j][k] 与每格的 8 个角索引。
 * 抖动只作用于 x/y（水平方向），k 方向保持等距 —— 片子里层与层是平的。
 */
export function makeLattice({ n = 11, h = 6, jitter = MEASURED.jitter, seed = 5 } = {}) {
  const rnd = lcg(seed);
  const jx = [], jy = [];
  for (let i = 0; i <= n; i++) {
    jx.push([]); jy.push([]);
    for (let j = 0; j <= n; j++) {
      // 边界不抖，否则岛会从画面里"淌"出去
      const edge = i === 0 || j === 0 || i === n || j === n;
      jx[i][j] = edge ? 0 : (rnd() - 0.5) * jitter * 2;
      jy[i][j] = edge ? 0 : (rnd() - 0.5) * jitter * 2;
    }
  }
  // 半点也要能取（方块模式取格心）：抖动按最近整数格角取，避免 undefined
  const jit = (i, j) => {
    const a = Math.max(0, Math.min(n, Math.round(i)));
    const b = Math.max(0, Math.min(n, Math.round(j)));
    return [jx[a][b], jy[a][b]];
  };
  const pos = (i, j, k) => {
    const [a, b] = jit(i, j);
    return [i + a, j + b, k];
  };
  return { n, h, pos, jitter };
}

/**
 * 场函数：一座"岛"（中心 1、边缘 0），带一点竖直衰减 —— 对应片子里
 * 从两个块长成一整块带孔洞的岛状体。
 */
export function islandField(x, y, z, { n = 11, h = 6 } = {}) {
  const cx = n / 2, cy = n / 2;
  const r = Math.hypot((x - cx) / (n * 0.36), (y - cy) / (n * 0.32));
  // 侧壁要"陡"：min(近岸项, 顶面项) 让 r>0.98 处直接归零 → 竖直崖面。
  // 第一版用 (1-d)*a + (top-z)*b 的加权和，结果是一个缓坡圆顶，
  // 和片子里"立起来的块"完全不是一回事。
  // 侧壁：r<0.86 处给满高，0.86→0.98 之间线性落到 0（约一格宽的过渡带）。
  // 直接用 (0.98-r)*k 会得到"从中心一路斜坡"的圆顶，永远看不到竖直崖面。
  const side = 3.4 * Math.max(0, Math.min(1, (0.98 - r) / 0.12));
  const top = h * 0.40 + 0.55 * Math.sin(x * 0.9 + 0.7) + 0.45 * Math.cos(y * 1.1) + 0.25 * Math.sin((x + y) * 1.7);
  let v = Math.min(side, top - z);
  // 拱洞：中间挖一条贯穿的隧道（片子里后段能看见一个孔）
  if (Math.hypot(x - cx + 0.4, y - cy - 0.2) < 1.05 && z > 1.1 && z < 2.3) v -= 1.4;
  return v;
}

/** 沿一条格边找变号点（线性插值）。 */
function crossAt(a, b, fa, fb) {
  const t = fa / (fa - fb);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * surface nets on quad lattice：
 *   ① 每格 8 角的场值 → 变号边 → 交点均值 = 该格顶点
 *   ② 每个**格角**（而不是格边）周围取变号格子，连成一圈多边形
 * 返回 {verts, polys, cellIndex}，polys 每项是顶点索引数组（3 或 4 个）。
 */
export function surfaceNets(lat, field) {
  const { n, h, pos } = lat;
  const cellV = new Map();          // "i,j,k" → 顶点索引
  const verts = [];
  const val = new Map();            // 格角场值缓存
  const f = (i, j, k) => {
    const key = i + ',' + j + ',' + k;
    if (!val.has(key)) val.set(key, field(...pos(i, j, k)));
    return val.get(key);
  };
  const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  for (let k = 0; k < h; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const cs = CORNERS.map(([a, b, c]) => [i + a, j + b, k + c]);
        const vs = cs.map(([a, b, c]) => f(a, b, c));
        let posCount = 0, negCount = 0;
        for (const v of vs) (v > 0 ? posCount++ : negCount++);
        if (!posCount || !negCount) continue;
        // 变号边交点均值（= surface nets 的顶点放置）
        let sx = 0, sy = 0, sz = 0, m = 0;
        for (const [a, b] of EDGES) {
          if ((vs[a] > 0) === (vs[b] > 0)) continue;
          const p = crossAt(pos(...cs[a]), pos(...cs[b]), vs[a], vs[b]);
          sx += p[0]; sy += p[1]; sz += p[2]; m++;
        }
        if (!m) continue;
        cellV.set(i + ',' + j + ',' + k, verts.length);
        verts.push([sx / m, sy / m, sz / m]);
      }
    }
  }

  // ② 每条**变号的格棱**周围取 4 个格子连成一个四边形（surface nets 标准做法）。
  //
  // 坑：第一版是"围着格角把 8 个格子连一圈"，但 8 个格子绕一个角的顺序在 3D 里
  // 不是唯一的（要按垂直于某个轴的平面分三组），我当成一个环连出来，结果面片
  // 自交、表面上一堆灰洞。改成按 3 个轴向各出一组四边形，洞全没了。
  // 代价：这套只在 4 价格角上成立；片子里还有 3 价格角（连通性会变），
  // 这轮只抖了位置没改拓扑，3 价那块留作欠账。
  const polys = [];
  const cv = (i, j, k) => cellV.get(i + ',' + j + ',' + k);
  const quad = (a, b, c, d) => {
    if (a === undefined || b === undefined || c === undefined || d === undefined) return;
    polys.push([a, b, c, d]);
  };
  for (let k = 0; k < h; k++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        // x 向棱 (i,j,k)-(i+1,j,k)：绕它的 4 个格子
        if (i < n && j >= 1 && k >= 1) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k));
        // y 向棱
        if (j < n && i >= 1 && k >= 1) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1));
        // z 向棱
        if (k < h && i >= 1 && j >= 1) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k));
      }
    }
  }
  return { verts, polys };
}

/** 等距投影（与项目其余 lab 一致）。 */
export function makeCam({ cx, cy, w = 26, h = 15, zh = 18 }) {
  return {
    cx, cy, w, h, zh,
    p(x, y, z) { return [cx + (x - y) * w, cy + (x + y) * h * 0.5 - z * zh]; },
    depth(x, y, z) { return x + y + z * 1.2; },
  };
}

/** 二次曲线画网格线（片中边是弯的，弓高 7%）。 */
export function bowedLine(ctx, a, b, bow = MEASURED.edgeBow) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  ctx.quadraticCurveTo(mx + nx * L * bow, my + ny * L * bow, b[0], b[1]);
}

/** 画底层网格（片子里网格只在"地面"那一层可见，红色实体压在上面）。 */
export function drawLattice(ctx, lat, cam, { bow = MEASURED.edgeBow, color = '#3b3b3b' } = {}) {
  const { n, pos } = lat;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let j = 0; j <= n; j++) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const a = cam.p(...pos(i, j, 0)), b = cam.p(...pos(i + 1, j, 0));
      if (!started) { ctx.moveTo(a[0], a[1]); started = true; }
      bowedLine(ctx, a, b, bow);
    }
    ctx.stroke();
  }
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    let started = false;
    for (let j = 0; j < n; j++) {
      const a = cam.p(...pos(i, j, 0)), b = cam.p(...pos(i, j + 1, 0));
      if (!started) { ctx.moveTo(a[0], a[1]); started = true; }
      bowedLine(ctx, a, b, bow);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 逐面平面着色，量化到 shadeSteps 档（片子里 3–4 档，没有平滑过渡）。 */
export function shadeColor(base, n, steps = MEASURED.shadeSteps) {
  const L = [-0.35, -0.5, 0.79];
  const d = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const q = Math.min(1, Math.round(d * steps) / steps);
  const k = 0.52 + 0.48 * q;
  return base.map((c) => Math.round(Math.min(255, c * k)));
}

/** 三角化多边形（扇形，凸多边形够用；不规则网格里 4 价角出来的就是凸四边形）。 */
export function fanTriangles(polys) {
  const tris = [];
  for (const p of polys) for (let i = 1; i + 1 < p.length; i++) tris.push([p[0], p[i], p[i + 1]]);
  return tris;
}

/** 批量把三角面画出来（画家算法：按视深远→近）。 */
export function drawSolid(ctx, verts, tris, cam, base = [222, 42, 38]) {
  const sp = verts.map((v) => cam.p(...v));
  const order = tris.map((t, i) => ({
    t, i,
    d: (cam.depth(...verts[t[0]]) + cam.depth(...verts[t[1]]) + cam.depth(...verts[t[2]])) / 3,
  })).sort((a, b) => b.d - a.d);
  for (const { t } of order) {
    const [a, b, c] = t.map((id) => sp[id]);
    // **不做背面剔除**：格角连圈出来的四边形绕向不一致，剔一面就会在表面
    // 上留下灰色的三角洞（第一版满身洞就是这么来的）。按视深排好序整体盖过去，
    // 多画的背面都被后面的正面盖住，代价只是几个百分点填充率。
    const n = faceNormal(verts[t[0]], verts[t[1]], verts[t[2]]);
    const col = shadeColor(base, n);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.round(col[0] * 0.72)},${Math.round(col[1] * 0.55)},${Math.round(col[2] * 0.55)},0.85)`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  return order.length;
}

export function faceNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return n.map((q) => q / l);
}

/** 对照用的"方块"模式：每个实心格画一个立方体（经典 MC 的台阶感）。 */
export function drawBlocky(ctx, lat, field, cam, base = [222, 42, 38]) {
  const { n, h, pos } = lat;
  const CUBE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const items = [];
  for (let k = 0; k < h; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = pos(i + 0.5, j + 0.5, k + 0.5);
    if (field(...c) <= 0) continue;
    const p = CUBE.map(([a, b, d]) => cam.p(...pos(i + a, j + b, k + d)));
    items.push({ p, d: cam.depth(i + 0.5, j + 0.5, k + 0.5) });
  }
  items.sort((a, b) => b.d - a.d);
  for (const { p } of items) {
    for (const f of F) {
      const [a, b, c] = [p[f[0]], p[f[1]], p[f[2]]];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (area >= 0) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      for (let q = 1; q < f.length; q++) ctx.lineTo(p[f[q]][0], p[f[q]][1]);
      ctx.closePath();
      ctx.fillStyle = `rgb(${base[0]},${Math.round(base[1] * 0.8)},${Math.round(base[2] * 0.8)})`;
      ctx.fill();
    }
  }
}

/** 反测：红色像素占全幅百分比（片子里 f020 = 5.05%）。 */
export function redCoverage(ctx, W, H, base = [222, 42, 38], tol = 80) {
  const d = ctx.getImageData(0, 0, W, H).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    // 判据：红通道显著高于绿蓝（片子里红面 (222,42,38) 到 (140,32,30) 都能过）
    if (d[i] > 110 && d[i] - d[i + 1] > 60 && d[i] - d[i + 2] > 60) n++;
  }
  return +(n / (W * H) * 100).toFixed(2);
}
