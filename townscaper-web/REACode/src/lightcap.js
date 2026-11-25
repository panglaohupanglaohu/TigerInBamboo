/**
 * lightcap.js — 灯塔顶冠：柱高决定顶冠，改一格要把整柱的顶冠重算一遍
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1331905048801144836（2020-11-26）：
 *     "Townscaper now has lighthouses! This pattern required more code rewrite
 *      than seems reasonable. Luckily, I got some slight optimization out of
 *      it too."
 *
 *   原文两句都是**架构**信息，不是美术信息：
 *     ① "This **pattern**" —— 灯塔不是一种新模块，是一个**模式**（对某柱形配置的匹配）；
 *     ② "required more code rewrite" —— 现有放置流程假设"一格 = 一个自足的模块"，
 *        而顶冠要依赖**同柱其它格**，所以原有的"放下一格就定终身"必须改成可重算。
 *
 *   所以这个模块的重点不是画个塔，是 **resolveCaps()**：把"柱高 → 顶冠种类"
 *   做成纯函数，配一条**只重算受影响柱**的脏传播。画面部分只是把量到的比值画出来。
 *
 * ── 帧实测（f110，512²，灯塔唯一清晰全身帧；f045 用于低于阈值的状态）──────────
 *   竖向剖面（x 窗口 275..400，逐 3 行扫；颜色分类 石白/红/橙/玻璃青/暗）：
 *       y  19..24   顶尖（红小球 + 短刺）
 *       y  22..49   橙锥屋顶，底宽 88
 *       y  51..57   檐口暗带（白+暗），宽 84
 *       y  58..66   灯笼室上楣（石白），宽 76
 *       y  67..100  **玻璃带**，宽 66–68
 *       y 103..132  灯笼室下鼓 + 瞭望台盘，宽 80 → 105
 *       y 133..148  栏杆（暗柱），宽 103
 *       y 151..218  红色故事层，宽 88–92
 *       y 220..238  外翻的箍环（collar），最宽 104
 *       y 241..     白色故事层（下两层都是白）
 *   柱身宽取干净故事层的中位数 **W = 88 px**。以下全部 ÷88：
 *       故事层节距            88   → 1.00 W
 *       顶冠总高（柱顶→尖端）132   → 1.50 W      ← 正好一层半，不是随手给的高度
 *       瞭望台盘宽            105   → 1.19 W
 *       栏杆圈直径            103   → 1.17 W
 *       灯笼鼓宽               80   → 0.91 W
 *       玻璃带宽               67   → 0.76 W
 *       檐口宽                 84   → 0.95 W
 *       锥屋顶底宽             88   → 1.00 W
 *       锥顶到檐口高           26   → 0.30 W
 *       箍环宽（每层柱脚）    104   → 1.18 W      ← 和瞭望台盘同宽（同一个 ring 件复用）
 *       箍环高                 12   → 0.14 W
 *
 *   配色（f110 同一帧取色）：石白 (236,239,241) / 红 (203,71,76) / 橙屋顶 (224,146,68)
 *   / 玻璃青 (86,116,124) / 栏杆暗 (58,58,58)。红 = 该调色板的 accent 槽，
 *   橙 = roof 槽，白 = wall 槽 —— 即灯塔**没有自带配色**，全继承放置它的那座建筑的调色板。
 *   故事层配色从下往上 = [wall, wall, accent]（片子最下面两层白、上面一层红）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **顶冠是柱高的函数，不是一个可选件。** f045 里同一位置只有两层时是"炮塔"：
 *      锥屋顶 + 红尖，**没有**灯笼室和瞭望台；长到三层才出现玻璃灯笼。所以阈值是硬的
 *      （h≥3 且临水）。若做成"用户手动选顶"，就不会有原文那句代码重写。
 *   ② **改动必须向上冒泡。** 在柱底插一层，顶上那格的身份从 "lantern" 变 "turret"，
 *      但它自己的位姿没变 —— 只重画被改的格子会留下一个悬空的灯笼。这里用
 *      `resolveCaps()` 整柱重解 + `dirtyColumns` 只把**被改格所在柱 + 相邻柱**标脏。
 *      实测：改一格 → 触达 1 柱；整岛重解 → 触达 N 柱（见 lab 面板）。
 *   ③ **箍环和瞭望台盘复用一个件**（都是 1.18W 的 ring）。这是原文"slight optimization"
 *      最容易对上的一处：两种视觉上不同的"外翻圈"在数据上同宽，可以共用一件。
 *      这一条是从 1.18 vs 1.19 的测量差（1%）反推的，属于**推断**，标注在此。
 */

export const MEASURED = {
  frame: 512,
  shaftW: 88,              // px，柱身屏幕宽（= 一格）
  storyPitch: 1.00,        // ×W
  capHeight: 1.50,         // ×W，柱顶到尖端
  deckW: 1.19,
  railW: 1.17,
  drumW: 0.91,
  glassW: 0.76,
  eaveW: 0.95,
  coneW: 1.00,
  coneH: 0.30,
  collarW: 1.18,
  collarH: 0.14,
  // 顶冠内部高度分界（×W，从柱顶起算，向上）
  //   ⚠ 这里写错过一次：把 drum 段写在 glass 之上（y0=h.drum, y1=h.glass），
  //     结果鼓与玻璃带整段互换，反测里 drum 量成 1.19（真值 0.91）、glass 0.93（真值 0.76）。
  //     "y0 是下沿、y1 是上沿" 在 capPlan 里必须成立，不能靠读起来像。
  h: { deck: 0.20, rail: 0.31, drum: 0.58, glass: 0.95, eave: 1.14, cone: 1.47, tip: 1.52 },
  glassBand: 0.37,         // 玻璃带自身高（0.95-0.58）
  storyMix: ['wall', 'wall', 'accent'], // 从下往上
  col: {
    wall: [236, 239, 241],
    accent: [203, 71, 76],
    roof: [224, 146, 68],
    glass: [86, 116, 124],
    rail: [58, 58, 58],
    shade: 0.86,           // 背光侧乘数
  },
  // 阈值：片子只给了 h=2（炮塔）与 h=3（灯笼）两个样本。h≥3 是最小可证阈值，
  // 4 层以上是否换样不可知 → 估计值：一律 lantern。
  lanternMinH: 3,
  turretMinH: 2,
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/**
 * 等距柱体：圆盘在屏幕上的短长轴比。
 *
 * ⚠ 这里写错过一次，代价是整根柱看起来像一摞压扁的球：第一版按"俯角 30° → sin30 = 0.5"取 0.5，
 *   而片中柱子/箍环的圆盘扁得多 —— f110 里 104px 宽的箍环，露出的盘面只有 ~9px，
 *   即 9 / 52 ≈ **0.17**。0.5 会让 0.27W 高的一段身体被上下两个盘面吃光。
 *   （原因：Townscaper 是正交相机 + 很低的俯角，不能用 30° 透视的 sin 去套。）
 */
export const ISO = 0.17;

const ELL = (ctx, cx, cy, rx, ry) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, Math.PI * 2);
};

/**
 * 顶冠计划：给定种类与柱宽，返回一串"件"。纯数据，方便反测与复用。
 * kind: 'roof' | 'turret' | 'lantern'
 */
export function capPlan(kind, W = MEASURED.shaftW, m = MEASURED) {
  const h = m.h;
  if (kind === 'roof') return [];          // 普通屋顶由房子的 roof pass 画，这里不接管
  const parts = [
    { shape: 'cone', y0: h.eave, y1: h.cone, r0: m.coneW / 2, r1: 0.02, mat: 'roof' },
    { shape: 'cyl', y0: h.glass, y1: h.eave, r0: m.eaveW / 2, r1: m.eaveW / 2, mat: 'wall' }, // 檐口/上楣
    { shape: 'ball', y0: h.cone, y1: h.tip, r0: 0.045, r1: 0.045, mat: 'accent' },
  ];
  if (kind === 'lantern') {
    parts.unshift(
      { shape: 'cyl', y0: h.drum, y1: h.glass, r0: m.glassW / 2, r1: m.glassW / 2, mat: 'glass' },
      { shape: 'cyl', y0: h.rail, y1: h.drum, r0: m.drumW / 2, r1: m.drumW / 2, mat: 'wall' },
      { shape: 'ring', y0: 0, y1: h.deck, r0: m.deckW / 2, r1: m.deckW / 2, mat: 'accent' },
      { shape: 'rail', y0: h.deck, y1: h.rail, r0: m.railW / 2, r1: m.railW / 2, mat: 'rail' },
    );
  } else {
    // 炮塔：锥屋顶直接坐在柱顶上，中间一段短白鼓 —— 没有瞭望台、没有玻璃（对 f045）
    parts.unshift({ shape: 'cyl', y0: 0.02, y1: h.eave, r0: m.drumW / 2, r1: m.drumW / 2, mat: 'wall' });
  }
  return parts.map((p) => ({ ...p, W }));
}

/**
 * 柱高 → 顶冠种类。
 *
 * 为什么需要 waterAdj：片子只有两个样本，但两个都在水边（岛缘伸出水面的柱）。
 * 岛内高塔在 Townscaper 里是"塔楼"（锥顶），不会长出灯笼。所以临水是必要条件。
 * ⚠ 这一条是**从两张帧推的**，不是原文说的；若要放宽把 requireWater 设 false。
 */
export function capFor(column, { requireWater = true, m = MEASURED } = {}) {
  const h = column.stories | 0;
  if (h <= 0) return 'none';
  const wet = !!column.waterAdjacent;
  if (h >= m.lanternMinH && (!requireWater || wet)) return 'lantern';
  if (h >= m.turretMinH && (!requireWater || wet)) return 'turret';
  return 'roof';
}

/**
 * 整柱重解。store: Map<'x,y' | 'x,z', {stories}>（这里只关心柱，不关心 y 层）。
 * 返回 { caps: Map<key,kind>, stats }
 *
 * 为什么要"整柱"：柱高是唯一输入，所以从柱顶往下的每一格身份都依赖它；
 * 在柱底插一格会让柱顶那格从 turret 变 lantern。只重画被改格 = 悬空灯笼。
 */
export function resolveCaps(store, opts = {}) {
  const caps = new Map();
  let columns = 0;
  const { has, waterAround } = opts;
  for (const [key, cell] of store) {
    columns++;
    const waterAdjacent = waterAround ? waterAround(key) : true;
    caps.set(key, capFor({ stories: cell.stories, waterAdjacent }, opts));
  }
  return { caps, stats: { columns } };
}

/**
 * 脏传播：一次编辑只重解"被改格所在柱 + 邻柱"。
 * 返回被重解的柱 key 列表，用来证明 O(1) 而不是 O(N)。
 */
export function onEdit(store, key, opts = {}) {
  const touched = new Set([key]);
  const [x, z] = key.split(',').map(Number);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nk = (x + dx) + ',' + (z + dz);
    if (store.has(nk)) touched.add(nk);
  }
  const { caps } = resolveCaps(new Map([...touched].filter((k) => store.has(k)).map((k) => [k, store.get(k)])), opts);
  return { touched: [...touched], caps };
}

// ─── 画 ────────────────────────────────────────────────────────────────────

/**
 * 一根柱：故事层 + 每层柱脚箍环 + 顶冠。
 * cam: { pt(u,v) -> [x,y], p }；柱占一格，(u,v) 是格坐标。
 * 屏幕尺度：W = cam.p（一格 = W 像素宽），与帧实测的 88px 同口径。
 */
export function drawColumn(ctx, cam, u, v, {
  stories = 1, kind = 'roof', palette, m = MEASURED,
  // 错法用：capAt 让顶冠锚在"第几层之上"，默认 = 实际层数。
  // 只重画被改格（不向上冒泡）时，capAt 会落后于 stories → 顶冠悬空。
  capAt = null, noCollar = false, noWindow = false,
} = {}) {
  const W = cam.p;
  const [cx, cy] = cam.pt(u, v);
  const pal = palette || { wall: m.col.wall, accent: m.col.accent, roof: m.col.roof };
  const rBody = W / 2 * 0.98;
  const ry = rBody * ISO;
  const pitch = m.storyPitch * W;

  // 从柱顶往下画，柱顶 y = cy
  const topY = cy;
  const drawStory = (y0, y1, col) => {
    // 柱身：矩形 + 上下椭圆
    const g = ctx.createLinearGradient(cx - rBody, 0, cx + rBody, 0);
    g.addColorStop(0, rgba(mixc(col, m.col.shade)));
    g.addColorStop(0.62, rgba(col));
    g.addColorStop(1, rgba(mixc(col, 1.04)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rBody, y0);
    ctx.lineTo(cx - rBody, y1);
    ctx.ellipse(cx, y1, rBody, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rBody, y0);
    ctx.ellipse(cx, y0, rBody, ry, 0, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,55,.55)';
    ctx.lineWidth = Math.max(1, W * 0.012);
    ctx.stroke();
    // 每层正中一扇 4 格小窗（片子里每层都有；窗大小按 f110 反推：宽 0.20W 高 0.22W）
    if (!noWindow) {
      const wy = (y0 + y1) / 2;
      const ww = W * 0.20, wh = W * 0.22;
      ctx.fillStyle = rgba(m.col.wall);
      ctx.fillRect(cx - ww / 2 - W * 0.02, wy - wh / 2 - W * 0.02, ww + W * 0.04, wh + W * 0.04);
      ctx.fillStyle = rgba(m.col.glass);
      ctx.fillRect(cx - ww / 2, wy - wh / 2, ww, wh);
      ctx.strokeStyle = rgba(m.col.wall, 0.95);
      ctx.lineWidth = Math.max(1, W * 0.014);
      ctx.beginPath();
      ctx.moveTo(cx, wy - wh / 2); ctx.lineTo(cx, wy + wh / 2);
      ctx.moveTo(cx - ww / 2, wy); ctx.lineTo(cx + ww / 2, wy);
      ctx.stroke();
    }
  };

  // 故事层：从柱顶往下，颜色按 storyMix 从下往上取 → 索引要反着来
  const cols = [];
  for (let i = 0; i < stories; i++) {
    const slot = m.storyMix[i % m.storyMix.length];
    cols.push(pal[slot] || m.col.wall);
  }
  for (let i = 0; i < stories; i++) {
    const top = topY + i * pitch;
    drawStory(top, top + pitch, cols[stories - 1 - i]);
    // 柱脚箍环（每层底部一圈外翻），宽 1.18W —— 和瞭望台盘同宽
    if (noCollar) continue;
    const cyRing = top + pitch;
    ctx.fillStyle = rgba(pal.accent || m.col.accent);
    ctx.beginPath();
    ctx.ellipse(cx, cyRing, m.collarW / 2 * W, m.collarW / 2 * W * ISO, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(cx - m.collarW / 2 * W, cyRing - m.collarH * W, m.collarW * W, m.collarH * W);
    ctx.strokeStyle = 'rgba(40,50,55,.45)';
    ctx.lineWidth = Math.max(1, W * 0.01);
    ctx.beginPath();
    ctx.ellipse(cx, cyRing - m.collarH * W, m.collarW / 2 * W, m.collarW / 2 * W * ISO, 0, Math.PI, 0);
    ctx.stroke();
  }

  // 顶冠
  const capTop = topY - ((capAt ?? stories) - stories) * pitch;
  const parts = capPlan(kind, W, m);
  for (const p of parts) {
    const yA = capTop - p.y1 * W;   // 上沿（屏幕 y 更小）
    const yB = capTop - p.y0 * W;
    const r0 = p.r0 * W, r1 = p.r1 * W;
    const col = pal[p.mat] || m.col[p.mat] || m.col.wall;
    if (p.shape === 'cone' || p.shape === 'cyl') {
      const g = ctx.createLinearGradient(cx - Math.max(r0, r1), 0, cx + Math.max(r0, r1), 0);
      g.addColorStop(0, rgba(mixc(col, m.col.shade)));
      g.addColorStop(0.6, rgba(col));
      g.addColorStop(1, rgba(mixc(col, 1.05)));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - r1, yA);
      ctx.lineTo(cx - r0, yB);
      ctx.ellipse(cx, yB, r0, r0 * ISO, 0, Math.PI, 0, true);
      ctx.lineTo(cx + r1, yA);
      ctx.ellipse(cx, yA, r1, r1 * ISO, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,50,55,.5)';
      ctx.lineWidth = Math.max(1, W * 0.012);
      ctx.stroke();
      // 玻璃带：竖棂 + 一道横棂（片子里灯笼面是 4×2 格）
      if (p.mat === 'glass') {
        const n = 4, rows = 2;
        ctx.strokeStyle = rgba(m.col.wall, 0.95);
        ctx.lineWidth = Math.max(1, W * 0.018);
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = cx - r0 + 2 * r0 * t;
          const bulge = Math.sin(Math.PI * t) * r0 * ISO * 0.42;
          ctx.beginPath();
          ctx.moveTo(x, yA + bulge * 0.4);
          ctx.lineTo(x, yB - bulge * 0.2);
          ctx.stroke();
        }
        for (let j = 1; j < rows; j++) {
          const yy = yA + (yB - yA) * (j / rows);
          ctx.beginPath();
          ctx.ellipse(cx, yy, r0 * 1.0, r0 * ISO, 0, Math.PI, 0, true);
          ctx.stroke();
        }
      }
    } else if (p.shape === 'ring') {
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.ellipse(cx, yB, r0, r0 * ISO, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(cx - r0, yA, 2 * r0, yB - yA);
      ctx.strokeStyle = 'rgba(40,50,55,.45)';
      ctx.lineWidth = Math.max(1, W * 0.01);
      ctx.beginPath();
      ctx.ellipse(cx, yB, r0, r0 * ISO, 0, Math.PI, 0);
      ctx.stroke();
    } else if (p.shape === 'rail') {
      // 栏杆：一圈竖柱 + 一道顶栏（片子里是暗色细柱，柱数按周长给 12 根）
      const n = 12;
      ctx.strokeStyle = rgba(col);
      ctx.lineWidth = Math.max(1, W * 0.014);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r0;
        const yy = yB + Math.sin(a) * r0 * ISO;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x, yy - (yB - yA));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(cx, yA, r0, r0 * ISO, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'ball') {
      ctx.fillStyle = rgba(col);
      ELL(ctx, cx, yB, r0, r0);
      ctx.fill();
    }
  }
  return { topY, W, pitch };
}

/**
 * 反测：在自己画的这张图上，用和量片子同一套判据再量一遍。
 * 返回的都是 ÷W 的比值，直接和 MEASURED 对。
 *
 * ⚠ 第一版用"离某个已知颜色 <tol"判柱体，被柱身渐变坑了：边缘像素落在渐变外，
 *   于是柱身宽量小了 ~30%，所有比值跟着放大 1.44×（玻璃带量成 1.12，真值 0.76）。
 *   第二版改"非背景"，又被**岛台**坑了：柱身那一行的左右两侧落到岛台侧壁上，
 *   柱身宽量成 134（真值 106），所有比值缩小到 0.79×。
 *   所以最终版要求：**在透明底上单独画这一根柱再量**（useAlpha），
 *   场景合成图只用来做 A/B，不用来量。
 */
export function probeCap(ctx, cx, topY, W, m = MEASURED, useAlpha = false) {
  const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
  const dpr = Wc / (ctx.canvas.clientWidth || Wc) || 1;
  const d = ctx.getImageData(0, 0, Wc, Hc).data;
  const at = (x, y) => { const i = ((y | 0) * Wc + (x | 0)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const near = (p, c, tol = 26) => Math.abs(p[0] - c[0]) < tol && Math.abs(p[1] - c[1]) < tol && Math.abs(p[2] - c[2]) < tol;
  const bgc = at(cx + W * 0.9, topY - W * 1.2);
  const isBody = useAlpha ? (p) => p[3] > 60 : (p) => !near(p, bgc, 20);
  // 单位是 CSS px，而 getImageData 是设备像素 → 先换算
  const S = dpr;
  const span = (hAbove, half = 0.65) => {
    const y = Math.round((topY - hAbove * W) * S);
    let a = -1, b = -1;
    for (let x = Math.round((cx - W * half) * S); x < Math.round((cx + W * half) * S); x++) {
      if (isBody(at(x, y))) { if (a < 0) a = x; b = x; }
    }
    return a < 0 ? 0 : (b - a + 1) / S;
  };
  // 柱身宽：柱顶下方 0.4 层处（一定在故事层里，且没有箍环）
  const shaft = span(-0.4, 0.62) || 1;
  const rel = (v) => +(v / shaft).toFixed(2);
  return {
    shaftPx: +shaft.toFixed(1),
    deckW: rel(span(0.10)),
    drumW: rel(span(m.h.drum * 0.75)),
    glassW: rel(span((m.h.drum + m.h.glass) / 2)),
    coneW: rel(span(m.h.eave + 0.03)),
    // 顶冠总高：从柱顶往上扫，最后一条还有柱体的行
    capH: (() => {
      let y = Math.round((topY - 0.15 * W) * S);
      const yStop = Math.round((topY - 2.2 * W) * S);
      while (y > yStop) {
        let any = false;
        for (let x = Math.round((cx - W * 0.55) * S); x < Math.round((cx + W * 0.55) * S); x++) if (isBody(at(x, y))) { any = true; break; }
        if (!any) break;
        y--;
      }
      return +(((topY * S) - (y + 1)) / S / shaft).toFixed(2);
    })(),
    want: { deckW: m.deckW, drumW: m.drumW, glassW: m.glassW, coneW: m.coneW, capH: m.capHeight },
  };
}
