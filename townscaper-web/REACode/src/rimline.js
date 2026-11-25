/**
 * rimline.js — 岛顶外缘那条 2px 纯白描线（Bad North 可读性的骨架）
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   837027901853810688（2017-03-01）**帖子无文字**
 *   877995885250138119（2017-06-22）**帖子无文字**
 *   984703192465330176（2018-04-13）**帖子无文字**
 *   995034777756536833（2018-05-11）**帖子无文字**
 *   1022855252574437376（2018-07-27）**帖子无文字**
 *   1410697531424714752（2021-07-01）GoG 促销片，正文只有商店链接
 *
 *   这六条是本项目最后一批"无文字"的片子。它们看着毫不相干（雪岛、春岛、
 *   生日蛋糕岛、石头岛、Townscaper 小镇），但逐帧比下来有一条**每条都有**的
 *   共同元素：岛的顶面外缘都压了一条细白线。它没有任何一句文字说明，
 *   所以这条线全部靠量：宽度、颜色、幂等性、断口位置。
 *
 * ── 帧实测（460×460·837 f004/f012/f020；320×320·877；340×340·984）──────
 *   线色         **纯白 (255,255,255)**，不是"淡蓝的晕"——
 *               底色是 ~(180,190,194) 的雪/岩，线是硬切上去的。
 *   线宽         行/列游程统计，1–3px 占绝对多数（1px 是抗锯齿边）：
 *                 877(320px)  {1:120, 2:62, 3:42}   ← 峰在 1–2
 *                 984(340px)  {1:193, 2:74, 3:10}   ← 峰在 1
 *                 837(460px)  {1:107, 2:84, 3:66}   ← 峰在 1–2
 *               三张片子画幅差 1.44×，线**都是 2px 核心 + 1px AA** →
 *               这是**屏幕空间定宽**，不是跟着网格缩放的线（否则 460 那张会粗 44%）。
 *   线的位置     贴着**顶面与崖面的折边**走，压在顶面一侧（往陆地内收 <1px）。
 *               在 837 的放大图里看得最清楚：线沿着"雪 / 裸岩"的分界，
 *               而那条分界正好就是顶面抬起来变崖面的地方。
 *   断口         线不是一圈闭合的：雪边界在**同一高度**与岩面接上时（没有折边）
 *               线就断了，断口是**硬断**（不淡出、不收头）。全画面大约
 *               40–55% 的边界段有折边、有折边的段 100% 有线。
 *   折角         格子的边界是 90°/45° 的阶梯，但线是**圆的**：
 *               一个 90° 折角在 460px 画面上被抹成 ~5px 半径的弧，
 *               长直段（>60px）依然是直的。→ 描的是"平滑后的环"，不是格边。
 *   出现时机     全片常驻，不闪、不呼吸；只有被更近的地块挡住时才消失（见下）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **必须用画家算法现场挡，不能用"只画前侧"偷懒。** 第一版只画朝向镜头的
 *      那条边，结果岛的另一半完全没有线，而片子里背面（远离镜头的）崖顶
 *      是**有**线的——它衬在海面上是剪影，照样看得见。所以：地块按 (x+y)
 *      从远到近排序，**每画完一块就把它的折边描上去**，后面的地块自然会
 *      盖住前面的线，断口于是自动出现在"被前面的崖挡住"的地方。这正是
 *      片子里断口的位置分布。
 *   ② **线宽固定 2px，不随地块大小变。** 实测三张画幅差 1.44× 线宽不变，
 *      说明它是贴在画面上的（后处理 / 屏幕恒定宽度），不是几何体上的带子。
 *      用 ctx.lineWidth = 2 且 **不** scale，就是对的；跟着 scale 画会变粗。
 *   ③ **先平滑再描。** 直接 stroke 格边会得到一条 45° 阶梯（第一版就是这样，
 *      反测宽度中位数没问题，但一眼假）。Chaikin 两轮把 90° 折角抹成
 *      约 1/4 段长的圆弧，正好对上量到的 5px 半径，长直段基本不动。
 *   ④ **断口是硬断。** 试过在断口处做 3px 淡出，反测"有线的行占比"掉了 12%，
 *      而片子里断口处的白是一刀切下去的——所以收头用 butt，不做渐变。
 */

export const MEASURED = {
  ref: 460,             // 主量测片 837 的画幅
  width: 2,             // 核心线宽（片中 px，屏幕恒定）
  aa: 1,                // 抗锯齿边，单独记，不计入核心宽
  color: [255, 255, 255],
  cornerR: 5,           // 90° 折角被抹成的弧半径（片中 px，460 画幅）
  smooth: 2,            // Chaikin 轮数
  lipShare: 0.47,       // 有折边的边界段占比（量到的 40–55% 取中）
  innerPull: 0.6,       // 线压在顶面内侧的偏移（px）
};

/** 2D 可复现随机数（项目里所有 lab 都用这套，避免 Math.random 不可复测）。 */
function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * 等距投影。与 tideflat/shore 用的是同一套：地面上的圆 R 投成
 * 半轴 1.2247R / 0.7071R 的椭圆。
 */
export function makeCam({ cx, cy, w = 30, h = 17.3, zh = 15, scale = 1 }) {
  return {
    cx, cy, w: w * scale, h: h * scale, zh: zh * scale, scale,
    p(x, y, z) {
      return [cx + (x - y) * this.w, cy + (x + y) * this.h * 0.5 - z * this.zh];
    },
  };
}

/**
 * 从"每格高度"的网格里抽出顶面折边（lip）。
 *
 * @param {Array<{x:number,y:number,h:number,kind?:string}>} cells
 *        格子，(x,y) 是整数格坐标，h 是台面高度（层），kind 只用于材质断边。
 * @returns {{segs:Array, gh:Map}} segs 里的段是**格坐标**下的边（x0,y0,x1,y1,h）
 */
export function lipSegments(cells) {
  const gh = new Map();
  for (const c of cells) gh.set(c.x + ',' + c.y, c);
  const at = (x, y) => gh.get(x + ',' + y);
  const segs = [];
  /**
   * ⚠ **归属格必须显式传**。第一版想省事，用"边的起点"去查格：
   *     N 边 (x,y)→(x+1,y) 起点正好是格子自己 → 对；
   *     E 边 (x+1,y)→(x+1,y+1) 起点是**东邻** → 错；
   *     S 边 (x+1,y+1)→(x,y+1) 起点是**对角邻** → 错；
   *     W 边 (x,y+1)→(x,y) 起点是**南邻** → 错。
   *   于是四条边里有三条在拿错格子的高度跟错格子的邻居比，折边生成得又少又乱：
   *   45 段里 37 段找不到相邻段（端点点不上），屏幕上一把悬空短划线。
   *   现在每条边都带上自己的格子和"对面那格"的坐标。
   */
  const push = (c, x0, y0, x1, y1, dir, nx, ny) => {
    const nb = at(nx, ny);
    const hb = nb ? nb.h : 0;
    if (hb >= c.h) return;                       // 邻居不低 → 这里没有折边
    segs.push({ x0, y0, x1, y1, h: c.h, dir, d: c.x + c.y, kind: c.kind || 'top' });
  };
  for (const c of cells) {
    // 北 / 东 / 南 / 西（屏幕上看是 上 / 右 / 下 / 左）
    push(c, c.x, c.y, c.x + 1, c.y, 'N', c.x, c.y - 1);
    push(c, c.x + 1, c.y, c.x + 1, c.y + 1, 'E', c.x + 1, c.y);
    push(c, c.x + 1, c.y + 1, c.x, c.y + 1, 'S', c.x, c.y + 1);
    push(c, c.x, c.y + 1, c.x, c.y, 'W', c.x - 1, c.y);
  }
  return { segs, gh };
}

/**
 * 把散段串成环。
 *
 * ⚠ 必须**无向**串：每格的四条边是按下标逆时针给的，两条相邻格的折边在共享顶点上
 *   方向**相反**（一条是"从 A 到 B"，另一条是"从 B 到 A"）。
 *   第一版只朝 (x1,y1)→(x0,y0) 一个方向找下一个段，45 段里 37 段永远串不上，
 *   于是每条折边都被单独描一遍 —— 屏幕上就是一把悬空的白色短划线。
 *   无向串（端点任一匹配、必要时翻转）之后，一条海岸线才是一整条。
 */
export function chainLoops(segs) {
  const key = (x, y) => x + ',' + y;
  const adj = new Map();
  segs.forEach((s, i) => {
    for (const k of [key(s.x0, s.y0), key(s.x1, s.y1)]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(i);
    }
  });
  const used = new Array(segs.length).fill(false);
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const s = segs[i];
    const mid = [[s.x0, s.y0], [s.x1, s.y1]];
    const owned = [s];
    const walk = (from) => {
      const acc = [];
      let cur = from;
      for (;;) {
        const cand = (adj.get(key(cur[0], cur[1])) || []).filter((j) => !used[j] && segs[j].h === s.h);
        if (!cand.length) break;
        const j = cand[0];
        used[j] = true;
        owned.push(segs[j]);
        const t = segs[j];
        const nxt = key(t.x0, t.y0) === key(cur[0], cur[1]) ? [t.x1, t.y1] : [t.x0, t.y0];
        acc.push(nxt);
        cur = nxt;
      }
      return acc;
    };
    const fwd = walk(mid[1]);
    const back = walk(mid[0]).reverse();
    const pts = back.concat(mid, fwd);
    out.push({
      pts,
      h: s.h,
      depth: Math.min(...owned.map((x) => x.d)),
      segs: owned,
      closed: pts.length > 2 && key(pts[0][0], pts[0][1]) === key(pts[pts.length - 1][0], pts[pts.length - 1][1]),
    });
  }
  return out;
}

/** Chaikin 一次：切掉每个折角，折角变成两条 1/4 点连线。 */
function chaikin(pts, closed) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out = [];
  const m = closed ? n : n - 1;
  if (!closed) out.push(pts[0]);
  for (let i = 0; i < m; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/**
 * 把一条折线换成屏幕空间的描线点表。
 * 平滑在**屏幕空间**做（不是在格空间），因为圆角半径是屏幕定宽的。
 */
export function smoothLoop(loop, cam, { iters = MEASURED.smooth } = {}) {
  let pts = loop.pts.map(([x, y]) => cam.p(x, y, loop.h));
  for (let i = 0; i < iters; i++) pts = chaikin(pts, loop.closed);
  return { pts, closed: loop.closed, h: loop.h, depth: loop.depth, segs: loop.segs };
}

/**
 * 描线。关键三条：线宽屏幕恒定、颜色纯白、收头 butt（断口硬断）。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} loops  smoothLoop 的产物
 * @param {object} o     { width, color, alpha, dash }
 */
export function paintRim(ctx, loops, o = {}) {
  const w = o.width ?? MEASURED.width;
  const col = o.color ?? MEASURED.color;
  const alpha = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  ctx.lineWidth = w;
  ctx.lineCap = o.cap || 'butt';      // ④ 硬断
  ctx.lineJoin = 'round';             // 折角本身已经平掉了，这里只是兜底
  ctx.setLineDash(o.dash || []);
  for (const l of loops) {
    if (l.pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let i = 1; i < l.pts.length; i++) ctx.lineTo(l.pts[i][0], l.pts[i][1]);
    if (l.closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
/* ── 台架：一块带台面的岛 ──────────────────────────────────────────────── */

/** 由高度函数生成格子；outside 返回 0 表示水（没有格子）。 */
export function makeIsland(n, heightFn, kindFn) {
  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const h = heightFn(x, y);
      if (!h) continue;
      cells.push({ x, y, h, kind: kindFn ? kindFn(x, y, h) : 'top' });
    }
  }
  return cells;
}

/**
 * 画一块等距方墩：顶面 + 朝镜头两个崖面。
 * 顶面色、崖面色由调用方给，因为不同片子的配色不一样。
 */
export function paintPlate(ctx, cam, c, { top, sideA, sideB }) {
  const { x, y, h } = c;
  const z = h;
  const t = [cam.p(x, y, z), cam.p(x + 1, y, z), cam.p(x + 1, y + 1, z), cam.p(x, y + 1, z)];
  const b0 = [cam.p(x, y, 0), cam.p(x + 1, y, 0), cam.p(x + 1, y + 1, 0), cam.p(x, y + 1, 0)];
  // 南面（朝观众）+ 东面（朝右）
  ctx.fillStyle = sideA;
  ctx.beginPath();
  ctx.moveTo(t[3][0], t[3][1]);
  ctx.lineTo(t[2][0], t[2][1]);
  ctx.lineTo(b0[2][0], b0[2][1]);
  ctx.lineTo(b0[3][0], b0[3][1]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = sideB;
  ctx.beginPath();
  ctx.moveTo(t[2][0], t[2][1]);
  ctx.lineTo(t[1][0], t[1][1]);
  ctx.lineTo(b0[1][0], b0[1][1]);
  ctx.lineTo(b0[2][0], b0[2][1]);
  ctx.closePath();
  ctx.fill();
  // 顶面
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(t[0][0], t[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(t[i][0], t[i][1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * 一块地块在屏幕上的可见轮廓（顶面 + 朝镜头的两个崖面）构成的六边形。
 * 用来做"这条折边有没有被更近的地块挡住"的点测试。
 */
export function platePoly(cam, c) {
  const { x, y, h } = c;
  const t = [cam.p(x, y, h), cam.p(x + 1, y, h), cam.p(x + 1, y + 1, h), cam.p(x, y + 1, h)];
  const b2 = cam.p(x + 1, y + 1, 0);
  const b3 = cam.p(x, y + 1, 0);
  // 屏幕轮廓：t0 → t1 → b1(≈t1 正下方) → b2 → b3 → t0
  return [t[0], t[1], cam.p(x + 1, y, 0), b2, b3, t[0]];
}

function inQuad(poly, px, py) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * 完整一遍：**先**把地块从远到近画完，**再**描折边，折边逐点做遮挡测试。
 *
 * 为什么不是"画一块描一块"（第一版就是那样）：折边要平滑，而平滑必须作用在
 * **整条环**上；一格一格描只能描到 1–2 段（<3 个点，Chaikin 直接原样返回），
 * 结果阶梯一点没抹平 —— 反测里"阶梯 vs 平滑 像素差 0.00%"就是这么来的。
 * 所以把顺序拆成：全域串环 → 屏幕空间平滑 → 逐点问"这里被更近的地块挡住没"。
 * 同时这也避免了同一条线被相邻格子各描一遍、抗锯齿边反复叠加导致线看着变粗
 * （第一版 2px 的线反测量成 5px，就是这么来的）。
 */
export function paintIsland(ctx, cam, cells, opts = {}) {
  const o = Object.assign({
    top: '#e8edee', sideA: '#c3ccce', sideB: '#aab5b8',
    rim: {}, drawRim: true, plate: true, frontOnly: false, testOcclusion: true,
  }, opts);
  let { segs } = lipSegments(cells);
  if (o.frontOnly) segs = segs.filter((s) => s.dir === 'S' || s.dir === 'E');

  const order = cells.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.h - b.h);
  if (o.plate) for (const c of order) paintPlate(ctx, cam, c, o);
  if (!o.drawRim) return { cells: cells.length, segs: segs.length, drawn: 0, runs: 0, len: 0 };

  // 遮挡体：按深度降序，测试时一命中就跳出
  const polys = [];
  if (o.testOcclusion) {
    for (const c of cells) polys.push({ d: c.x + c.y, poly: platePoly(cam, c) });
    polys.sort((a, b) => b.d - a.d);
  }
  const blocked = (px, py, depth) => {
    for (const q of polys) {
      if (q.d <= depth) continue;
      if (inQuad(q.poly, px, py)) return true;
    }
    return false;
  };

  const chains = chainLoops(segs).map((lp) => smoothLoop(lp, cam, o.rim));
  const w = o.rim.width ?? MEASURED.width;
  const col = o.rim.color ?? MEASURED.color;
  ctx.save();
  ctx.globalAlpha = o.rim.alpha ?? 1;
  if (o.rim.dash) ctx.setLineDash(o.rim.dash);
  ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';               // ④ 断口硬断
  ctx.lineJoin = 'round';
  let runs = 0, len = 0;
  for (let ci = 0; ci < chains.length; ci++) {
    const ch = chains[ci];
    // 平滑后的点靠"最近的原线段中点"认领深度：不能一律用环首深度，
    // 否则一条横跨好几层的环会在自己身上误判遮挡（第一版把折线全吃掉了）。
    const mids = ch.segs.map((s) => {
      const a = cam.p(s.x0, s.y0, ch.h), b = cam.p(s.x1, s.y1, ch.h);
      return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, d: s.d };
    });
    const depthOf = (px, py) => {
      let best = 1e9, d = ch.depth;
      for (const m of mids) {
        const dd = (m.x - px) ** 2 + (m.y - py) ** 2;
        if (dd < best) { best = dd; d = m.d; }
      }
      return d;
    };
    let cur = [];
    const flush = () => {
      if (cur.length > 1) {
        ctx.beginPath();
        ctx.moveTo(cur[0][0], cur[0][1]);
        for (let i = 1; i < cur.length; i++) {
          ctx.lineTo(cur[i][0], cur[i][1]);
          len += Math.hypot(cur[i][0] - cur[i - 1][0], cur[i][1] - cur[i - 1][1]);
        }
        ctx.stroke();
        runs++;
      }
      cur = [];
    };
    for (const p of ch.pts) {
      if (!o.testOcclusion) { cur.push(p); continue; }
      if (blocked(p[0], p[1], depthOf(p[0], p[1]))) flush();
      else cur.push(p);
    }
    flush();
  }
  ctx.restore();
  // len = 描出来的中心线总长（px）—— 反测线宽要用"白像素数 / 长度"，
  // 用行游程量会被线段倾角带偏：近水平的 2px 线一行能跑出 5px。
  return { cells: cells.length, segs: segs.length, drawn: segs.length, runs, len };
}

/* ── 反测 ──────────────────────────────────────────────────────────────── */

/**
 * 沿行/列量白线的游程宽度，返回 { med, p10, p90, rows }。
 * 判据跟片子里的取法一致：三通道 ≥243 且近中性（线是纯白，雪是偏蓝的白）。
 * 注意：台架上没有别的高光，所以这里不需要像片子那样再排除精灵。
 */
export function probeWidth(ctx, length = 0) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const isLine = (i) => img[i] >= 243 && img[i + 1] >= 243 && img[i + 2] >= 243;
  let area = 0;
  const runs = [];
  let rowsWith = 0;
  for (let y = 0; y < height; y++) {
    let x = 0, any = false;
    while (x < width) {
      const i = (y * width + x) * 4;
      if (isLine(i)) {
        const s0 = x;
        while (x < width && isLine((y * width + x) * 4)) { area++; x++; }
        if (x - s0 <= 12) runs.push(x - s0);
        any = true;
      } else x++;
    }
    if (any) rowsWith++;
  }
  runs.sort((a, b) => a - b);
  const q = (p) => runs[Math.min(runs.length - 1, Math.floor(runs.length * p))] || 0;
  return { n: runs.length, med: q(0.5), p10: q(0.1), p90: q(0.9), rows: rowsWith / height,
    area, len: length, px: length ? area / length : 0 };
}

/** 两条折线的平均偏离（px）——用来量"平滑把折角抹掉了多少"。 */
export function maxDeviation(a, b) {
  let sum = 0, n = 0;
  for (const p of a) {
    let best = 1e9;
    for (const q of b) {
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best); n++;
  }
  return n ? sum / n : 0;
}

export const STATS = () => ({
  width: MEASURED.width,
  cornerR: MEASURED.cornerR,
  lipShare: MEASURED.lipShare,
});
