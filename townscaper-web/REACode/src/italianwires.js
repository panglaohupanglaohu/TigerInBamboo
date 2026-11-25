/**
 * italianwires.js — 楼与楼之间的双股电线：1px、淡青白、轻微下垂、两头有小托架
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1259838941299183619（2020-05-11）：
 *     "In code, these are called 'Italian Wires'"
 *
 *   全句就这一行 —— 只有**名字**，没有一句实现描述。所以这条完全是画面活儿。
 *   名字本身是个线索：他不是把它当"电缆"建模，而是当一种**装饰物**（像意大利老城
 *   墙上那种拉过来的电线），所以观感优先于物理：细、淡、几乎不下垂、两头有小铁件。
 *
 * ── 帧实测（512²，f016 / f020 / f008 三帧复算一致）──────────────────────
 *   位置：红色楼右墙 (≈336,185) → 绿色灯塔左侧 (≈380,193)，跨度 **41px**
 *   股数：**2 股**（逐列都能在 y 上找到两个亮核，见下表）
 *   粗  ：亮核 **1px**，两侧各 1px 半透明过渡（AA）→ 视觉上 ~2px
 *   色  ：亮核 (200,225,225) #C8E1E1，**比背景水色 (97,146,166) 更亮更淡**
 *         —— 不是白线：饱和度仍 0.11，是"发青的白"，纯白会跳出画面
 *   下垂：沿列采样（每 3px 一列，取每股的亮核 y）
 *           x   339 342 345 348 351 354 357 360 363 366 369 372 375 378
 *           上股 185 185 186 187 188 189 190 191 191 192 192 192 192 192
 *         弦（339,185)→(380,193) 的斜率 0.195；中点 x=360 弦上 189.1，实测 191
 *         → **最大下垂 ≈ 2px，sag/span ≈ 4.9%**
 *   间距：两股在 x=342 上差 2px、x=369 上差 3.5px → **2→4px，随跨度缓慢张开**
 *   两端：靠楼一侧有一小簇亮点（托架，y 184–188 连成一块），不是单点；
 *         靠灯塔一侧挂一个**粉色小牌** (160,94,116) 约 6×8px
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **下垂只有 5%，别按悬链线画成"晾衣绳"。** 第一版 sag 给到 15%，画出来像
 *      晒被子；片子里它几乎是直的，只在中间鼓 2px。5% 在 41px 跨度上就是 2px，
 *      这正是"看着直、又说不上为什么不像尺子"的来源。
 *   ② **必须两股，且间距随跨度变大。** 单股看着像一道划痕；固定间距看着像双黄线。
 *      实测 2→4px 的缓慢张开，是"两根分别绑在两个点上"的结果。
 *   ③ **线要带 AA，不能硬 1px。** 片子里亮核 1px、过渡 1px；直接画 1px 实线在
 *      放大后是断点，画 2px 又太粗。所以用 lineWidth=1 + 0.82 alpha，让画布的
 *      AA 自己补出那半像素。
 */

export const MEASURED = {
  frame: 512,
  wire: [200, 225, 225],
  wireAlpha: 0.82,
  width: 1,
  strands: 2,
  sep0: 2,          // 近端两股间距 px
  sep1: 4,          // 远端两股间距 px
  sagRatio: 0.049,  // 2px / 41px
  bracket: [156, 122, 118],
  bracketW: 3,
  tag: [160, 94, 116],
  tagW: 6,
  tagH: 8,
  spanPx: 41,
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

/**
 * 一根线的点表。
 * 抛物线下垂（跨度远小于地球半径，抛物线与悬链线在 5% 下垂下差 < 0.02px）。
 * 抛物线而不是"二次贝塞尔"：贝塞尔在 t=0.5 处的实际下沉只有控制点偏移的 3/4，
 * 用控制点直接给 sag 会少 25%，反测就会量到 1.5px 而不是 2px。
 */
export function strand({ a, b, sag = 0, offset = 0, n = 24 }) {
  // offset 可以是数，也可以是 t 的函数（两股间距是"从近端 2px 张到远端 4px"的）
  const [ax, ay] = a, [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  // 垂直于弦的法线（屏幕空间），offset 沿它平移 → 两股平行且都往下垂
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = typeof offset === 'function' ? offset(t) : offset;
    const x = ax + (bx - ax) * t + nx * off;
    const y = ay + (by - ay) * t + ny * off + sag * (1 - (2 * t - 1) * (2 * t - 1));
    out.push([x, y]);
  }
  return out;
}

/**
 * 一整跨：两股 + 两端托架 + 可选小牌。
 * @param {{a:number[], b:number[], sagRatio?:number, strands?:number, sep?:number[], tag?:boolean}} o
 */
export function makeSpan({ a, b, sagRatio = MEASURED.sagRatio, strands = MEASURED.strands, sep = [MEASURED.sep0, MEASURED.sep1], tag = true }) {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const sag = span * sagRatio;
  const lines = [];
  for (let k = 0; k < strands; k++) {
    // 间距从近端 sep0 张开到远端 sep1；k=0 在上，k=1 在下（片子里下股先垂）
    // ⚠ 这里原来写的是 `sep[0] + (sep[1]-sep[0]) * 0` —— 那个 0 本该是 t，
    //   于是间距永远是 sep0，"2→4px 张开"一点没实现，反测量到 0.94% 跨（片子 8.5%）。
    const f = strands === 1 ? 0 : k / (strands - 1);
    const off = (t) => (sep[0] + (sep[1] - sep[0]) * t) * f;
    const pts = strand({ a, b, sag: sag + f * 0.6, offset: off });
    lines.push({ pts, f });
  }
  return { a, b, span, sag, lines, tag };
}

/** 画一跨。scale 是"片中 px → 画布 px"。 */
export function paintSpan(ctx, sp, { scale = 1, m = MEASURED } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 两股
  for (const L of sp.lines) {
    ctx.beginPath();
    ctx.moveTo(L.pts[0][0], L.pts[0][1]);
    for (let i = 1; i < L.pts.length; i++) ctx.lineTo(L.pts[i][0], L.pts[i][1]);
    ctx.lineWidth = m.width * scale;
    ctx.strokeStyle = rgba(m.wire, m.wireAlpha);
    ctx.stroke();
  }
  // 远端托架：一小簇亮块（片子里靠楼那头是 184–188 连成一片，不是单点）
  const [ex, ey] = sp.a;
  ctx.fillStyle = rgba(m.bracket, 0.9);
  ctx.fillRect(ex - m.bracketW * scale, ey - 2 * scale, m.bracketW * scale, 5 * scale);
  // 小牌：挂在远端 1/5 处的下股上
  if (sp.tag) {
    const L = sp.lines[sp.lines.length - 1];
    const p = L.pts[Math.round(L.pts.length * 0.82)];
    const w = m.tagW * scale, h = m.tagH * scale;
    ctx.fillStyle = rgba(m.tag, 0.95);
    ctx.fillRect(p[0] - w * 0.25, p[1], w * 0.55, h);
    ctx.fillStyle = rgba([210, 170, 180], 0.9);
    ctx.fillRect(p[0] - w * 0.25, p[1], w * 0.55, 1.6 * scale);
  }
  ctx.restore();
  return sp;
}

/** 反测：从画出来的像素里量下垂与股数。 */
export function probeSag(ctx, sp, { scale = 1, bg = [97, 146, 166] } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const d = ctx.getImageData(0, 0, W, H).data;
  const near = (i, t, tol) => Math.abs(d[i] - t[0]) < tol && Math.abs(d[i + 1] - t[1]) < tol && Math.abs(d[i + 2] - t[2]) < tol;
  const x0 = Math.min(sp.a[0], sp.b[0]) + 2 * scale;
  const x1 = Math.max(sp.a[0], sp.b[0]) - 2 * scale;
  const cols = [];
  let maxStrands = 0;
  for (let x = Math.round(x0); x <= Math.round(x1); x += Math.max(1, Math.round(2 * scale))) {
    const hits = [];
    let run = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      const is = near(i, MEASURED.wire, 60) || (d[i] > 150 && d[i + 1] > 170 && Math.abs(d[i + 2] - d[i + 1]) < 45 && !near(i, bg, 60));
      if (is) { run++; } else { if (run) hits.push(y - run / 2); run = 0; }
    }
    if (hits.length) { cols.push({ x, hits }); maxStrands = Math.max(maxStrands, hits.length); }
  }
  if (cols.length < 4) return { sag: null, strands: 0, sep: null };
  // 每列取最上面那股的 y，用首末列连弦，量中间最大偏差
  const top = cols.map((c) => ({ x: c.x, y: Math.min(...c.hits) }));
  const A = top[0], B = top[top.length - 1];
  const sl = (B.y - A.y) / (B.x - A.x || 1);
  let dev = 0, at = 0;
  for (const p of top) {
    const chord = A.y + sl * (p.x - A.x);
    const dd = p.y - chord;
    if (dd > dev) { dev = dd; at = p.x; }
  }
  // 股间距：只取"恰好量到 2 股"的列，取中位。固定取某一列会踩到只有 1 股的列
  // （端点附近两股粘在一起），算出来是负的（第一版量到 -355.9）。
  const gaps = [];
  for (const c of cols) {
    if (c.hits.length !== 2) continue;
    const hs = c.hits.slice().sort((a, b) => a - b);
    gaps.push(hs[1] - hs[0]);
  }
  gaps.sort((a, b) => a - b);
  const sep = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  const span = B.x - A.x;
  return { sag: dev / scale, span: span / scale, ratio: dev / (span || 1), strands: maxStrands, sep: sep != null ? sep / scale : null, sepRatio: sep != null ? sep / (span || 1) : null, at };
}
