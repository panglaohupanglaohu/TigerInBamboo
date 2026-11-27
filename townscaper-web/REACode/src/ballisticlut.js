/**
 * ballisticlut.js — 弹道查表：把"给定初速 + 阻力"的抛物线族烘成一张表，
 *                   再按格子取最近的一条的切线画成一格一箭头
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   816332161036984320（2017-01-03）
 *   "PRO TIP: Avoid your ballistics homework by making a lookup table"
 *   画面里那个 Unity Inspector 是这条片子的**真参数**，直接读得出来：
 *     Title   Trajectory Calculator (Scrip…)
 *     Start Speed  6.7
 *     Drag         0.83
 *   下面还有两个被窗口裁掉的滑条（露出 "…" 与 "0.0"）。方向明确：**离线烘表**，
 *   运行时只查表，不算积分。
 *
 * ── 帧实测（490×486 · 816332161036984320 f008 / f015 两帧互校）───────────
 *   ① 箭头网格：列 x = 79,124,168,210,253,296,339,381,423 → 间距 43.0px
 *                行 y = 55,99,141,186,231,274,318,362,407,451 → 间距 44.0px
 *                即格子 **43×44**（不是 64，200px 缩略图上按 6×6 数会数错）。
 *   ② 每支箭头长 **22px**（0.51 格），细杆 + 小三角头（头宽约 4px）。
 *      箭杆不是从格心出发的：质心随仰角横向漂 3–8px，说明**尾部落在格点上**。
 *   ③ 仰角沿 +x 单调下降（同一行内）：
 *        y≈99 行：x=80 → 65.9°，x=124 → 57.9°，x=166 → 57.8°，x=208 → 57.3°
 *        y≈186 行：x=83 → 41.8°，再往右继续降到 30° 上下
 *        y≈451 行：x=80 → 55.4°（最下面几行反而回升）
 *      → 场不是径向的（径向会随 x 增长而快速趋零），是**沿最近那条抛物线的切线**。
 *   ④ 抛物线族是细青色线，起点全部收在左边缘 (35,241) 附近；最高那条的顶点
 *      在 (78,40)，即从起点**上升 201px / 横移 43px**。
 *      → 竖直上抛的顶点高度 ≈ 201px，这一条是唯一可以直接量到的标定值。
 *   ⑤ 左侧 x=35 那列 y 间隔 43px 的短横条是**坐标轴虚线**，不是箭头
 *      （初版把它当箭头统计，仰角全是 -93.9°，一眼假）。
 *
 * ── 卡点（写在前面，别当成已解决）─────────────────────────────────────────
 *   "每格取最近轨迹的切线"这条规则，用 57 支实测箭头做最小二乘（V0/a/k 网格搜），
 *   最好也只有 mean 58.9° / median 19.7° / p90 166°，**拟合失败**。
 *   → 说明箭头不是"最近轨迹的切线"，更可能是"该格到最近轨迹的**法线**"或
 *     "到目标点所需发射角"（后两者都会出现近 180° 的翻转，正好对上 p90）。
 *   本轮不猜了：模块只提供**积分 + 建表 + 最近切线**这三件确定的东西，
 *   箭头语义标为未定，lab 里把两种候选都画出来供下轮比对。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   · 表按**固定 dt 的 Euler** 积分（Burst job 的常规写法），不是解析解：
 *     解析解算得准但和片子对不上（片子是烘表，表里就是 Euler 的轨迹）。
 *     代价是 dt 决定误差，所以 lab 里必须报"Euler 顶点 vs 解析顶点"的偏差。
 *   · 轨迹点**按弧长等距重采样**：查表时用的是"最近点"，按时间等距采样会让
 *     快的地方点稀、顶点附近点密，NearestPoint 会系统性偏向顶点。
 *   · 表用**角度索引 + 采样点数组**的扁平结构，不建空间哈希：一格一次线性扫
 *     在本机 20 条 × 200 点上是 4k 次距离比较，比建哈希还快（建哈希要 3 倍时间）。
 */

export const MEASURED = {
  ref: [490, 486],
  startSpeed: 6.7,          // GUI 原文
  drag: 0.83,               // GUI 原文
  grid: [43.0, 44.0],       // 箭头网格间距 px
  arrowLen: 22,             // 箭头长 px
  arrowHead: 4,             // 箭头三角头宽 px
  origin: [35, 241],        // 抛物线族收束点（屏幕 px）
  apexRise: 201,            // 最高那条的顶点高度（px）
  apexRun: 43,              // 顶点横移（px）
  elevSample: [             // f008 实测仰角（度，向上为正）
    { x: 80,  y: 99,  e: 65.9 },
    { x: 124, y: 99,  e: 57.9 },
    { x: 166, y: 99,  e: 57.8 },
    { x: 208, y: 99,  e: 57.3 },
    { x: 83,  y: 186, e: 41.8 },
    { x: 125, y: 186, e: 42.3 },
    { x: 168, y: 186, e: 42.3 },
    { x: 210, y: 186, e: 42.2 },
    { x: 253, y: 143, e: 42.8 },
  ],
  fitError: { mean: 58.9, median: 19.7, p90: 166.2, note: '最近切线规则未通过' },
};

/**
 * 固定步长 Euler 积分（重力 + 线性阻力）。
 * 单位：米 / 秒。返回采样点（含速度）。
 */
export function integrate({ speed = MEASURED.startSpeed, drag = MEASURED.drag, g = 9.81,
                            angleDeg = 60, dt = 1 / 60, seconds = 8 } = {}) {
  const r = angleDeg * Math.PI / 180;
  let x = 0, y = 0;
  let vx = speed * Math.cos(r), vy = speed * Math.sin(r);
  const pts = [[x, y, vx, vy]];
  for (let t = 0; t < seconds; t += dt) {
    const ax = -drag * vx;
    const ay = -drag * vy - g;
    vx += ax * dt; vy += ay * dt;
    x += vx * dt; y += vy * dt;
    if (y < -0.01 && t > dt * 2) break;
    pts.push([x, y, vx, vy]);
  }
  return pts;
}

/** 线性阻力的解析解（竖直上抛顶点高度与时刻），用来校验 Euler 的 dt 误差。 */
export function apexAnalytic({ speed = MEASURED.startSpeed, drag = MEASURED.drag, g = 9.81 } = {}) {
  const k = drag;
  if (k <= 1e-6) return { t: speed / g, h: speed * speed / (2 * g) };
  const t = Math.log(1 + (k * speed) / g) / k;
  const h = ((speed + g / k) / k) * (1 - Math.exp(-k * t)) - (g / k) * t;
  return { t, h };
}

/** Euler 积分里实际达到的最大高度与时刻（顶点采样）。 */
export function apexSim(pts) {
  let bh = -1e9, bt = 0;
  // 采样点没带 t，用索引近似：调用方按固定 dt 生成，索引 * dt = t
  for (let i = 0; i < pts.length; i++) if (pts[i][1] > bh) { bh = pts[i][1]; bt = i; }
  return { h: bh, i: bt };
}

/** 弧长等距重采样（查表用）。 */
export function resampleEven(pts, spacing) {
  const out = [pts[0]];
  let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    let d = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    while (acc + d >= spacing) {
      const f = (spacing - acc) / d;
      const nx = prev[0] + (p[0] - prev[0]) * f;
      const ny = prev[1] + (p[1] - prev[1]) * f;
      const nvx = prev[2] + (p[2] - prev[2]) * f;
      const nvy = prev[3] + (p[3] - prev[3]) * f;
      out.push([nx, ny, nvx, nvy]);
      prev = [nx, ny, nvx, nvy];
      d = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      acc = 0;
    }
    acc += d;
    prev = p;
  }
  return out;
}

/**
 * 建表：angles 度 → 等距采样点。
 * @returns {{angles:number[], table:Array<Array<[number,number,number,number]>>, spacing:number}}
 */
export function buildLUT(opt = {}) {
  const angles = opt.angles ?? Array.from({ length: 19 }, (_, i) => 90 - i * 5);
  const spacing = opt.spacing ?? 0.05;
  const table = angles.map((a) =>
    resampleEven(integrate({ ...opt, angleDeg: a }), spacing));
  return { angles, table, spacing, params: { ...MEASURED, ...opt } };
}

/**
 * 最近轨迹点 + 该点切线仰角（度，向上为正）。
 * @param {{table:Array}} lut
 * @param {[number,number]} p 世界坐标（米，y 向上）
 */
export function nearestTangent(lut, p) {
  let best = Infinity, bv = null, bi = -1, bj = -1;
  for (let i = 0; i < lut.table.length; i++) {
    const pts = lut.table[i];
    for (let j = 0; j < pts.length; j++) {
      const d = (pts[j][0] - p[0]) ** 2 + (pts[j][1] - p[1]) ** 2;
      if (d < best) { best = d; bv = pts[j]; bi = i; bj = j; }
    }
  }
  const elev = Math.atan2(bv[3], bv[2]) * 180 / Math.PI;
  return { d: Math.sqrt(best), elev, angle: lut.angles[bi], idx: [bi, bj], v: bv };
}

/**
 * 场：对每个格点给出 方向角（度，屏幕系，向上为正）。
 * 两种语义都算，供比对（见"卡点"）：
 *   kind='tangent' → 最近轨迹点的切线
 *   kind='normal'  → 该点到最近轨迹点的法线
 * @returns {{cols:number, rows:number, cells:Array<{x,y,elev,tangent,normal}>}}
 */
export function elevationField(lut, opt = {}) {
  const cols = opt.cols ?? 11, rows = opt.rows ?? 10;
  const px = opt.pitchX ?? MEASURED.grid[0];
  const py = opt.pitchY ?? MEASURED.grid[1];
  const scale = opt.scale ?? 118;   // px / m，由 apexRise=201 反解（见 lab）
  const ox = opt.ox ?? MEASURED.origin[0], oy = opt.oy ?? MEASURED.origin[1];
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + 44 + c * px, y = oy - 142 + r * py * 0 + 55 + r * py;
      const wx = (x - ox) / scale, wy = -(y - oy) / scale;
      const n = nearestTangent(lut, [wx, wy]);
      const nrm = Math.atan2(-(n.v[1] - wy), n.v[0] - wx) * 180 / Math.PI;
      cells.push({ x, y, elev: n.elev, normal: nrm, d: n.d });
    }
  }
  return { cols, rows, cells, pitchX: px, pitchY: py };
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** 画一族抛物线（青色细线）。 */
export function drawTrajectories(ctx, lut, opt = {}) {
  const scale = opt.scale ?? 118;
  const ox = opt.ox ?? MEASURED.origin[0], oy = opt.oy ?? MEASURED.origin[1];
  ctx.save();
  ctx.strokeStyle = opt.color || 'rgba(120,215,205,0.85)';
  ctx.lineWidth = opt.width ?? 1;
  for (const pts of lut.table) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const X = ox + pts[i][0] * scale, Y = oy - pts[i][1] * scale;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 画箭头场：尾巴落在格点，长度 len。 */
export function drawArrowField(ctx, field, opt = {}) {
  const len = opt.len ?? MEASURED.arrowLen;
  const head = opt.head ?? MEASURED.arrowHead;
  ctx.save();
  ctx.strokeStyle = opt.color || 'rgba(240,244,248,0.95)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = opt.width ?? 1.2;
  for (const cell of field.cells) {
    const e = (opt.useNormal ? cell.normal : cell.elev) * Math.PI / 180;
    const dx = Math.cos(e), dy = -Math.sin(e);
    const x0 = cell.x, y0 = cell.y;
    const x1 = x0 + dx * len, y1 = y0 + dy * len;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - dx * head * 0.6, y1 - dy * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - dx * head - dy * head * 0.42, y1 - dy * head + dx * head * 0.42);
    ctx.lineTo(x1 - dx * head + dy * head * 0.42, y1 - dy * head - dx * head * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
