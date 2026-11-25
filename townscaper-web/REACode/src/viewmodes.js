/**
 * viewmodes.js — 同一座塔的四档"看穿"视图：纯贴图 / 带光照 / 只有光照 / AO 烘焙网格
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1298689301488775169（2020-08-26）：
 *     "Flat texture, shaded, lighting only, and my AO baking mesh. I'm thinking of
 *      adding some little widgets like this to give people a peek at how things work.
 *      Perhaps hide them behind a break-glass-to-push-button widget."
 *
 *   原文把四档的**名字和顺序**都给全了，这是这条唯一的文字信息：
 *       ① Flat texture      —— 只有贴图色，没有明暗
 *       ② shaded            —— 打光之后的成品
 *       ③ lighting only     —— 只看照明项
 *       ④ AO baking mesh    —— AO 烘焙用的网格
 *   注意原文说的是"**widgets**"（小部件）—— 片子里确实是 UI：右上一排四个图标按钮
 *   （方 / 圆 / 太阳 / 叠层），点一下换一档，两张大白板是调色板。
 *
 * ── 帧实测（512²，24 帧）──────────────────────────────────────────────────
 *   四个图标按钮在 x≈356..496 / y≈118..140，从左到右：方、圆、太阳、叠层。
 *   整幅平均亮度（只取左侧岛体 x<282，避开彩色面板）：
 *       24 帧 **131.0 – 132.4**（极差 1.4 / 1.06%）
 *   整幅平均饱和度：**0.365 – 0.373**（极差 0.008）
 *   帧差热力图（f014 vs f019）：变化的像素**集中在朝上的面（屋顶、平台）**，
 *     竖直墙面几乎不动 → 四档之间动的是"光怎么落"，不是"色相怎么变"。
 *
 *   ⚠ 一个和片子对不上的地方，如实记下来：片子四档的饱和度都在 0.37 附近，
 *     **没有一档是灰的**。所以他的 "lighting only" 不是把画面变黑白，更像是
 *     "把照明项当颜色显示、但仍乘在原色上"。本模块的 light 档是**纯灰度**，
 *     A/B 里饱和度会掉到 ~0.02 —— 这是本实现与片子的已知差异，不是量错了。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① 四档共享**同一套几何与同一个相机**，只换"往面上写什么" —— 这才是"看穿"，
 *      换几何就没法比了。所以 paintTower 里 mode 只影响 tone 函数。
 *   ② albedo 档必须**面内零梯度**（连 AO 都不加），否则量不出"贴图档和光照档差多少"。
 *      第一版 albedo 里顺手加了一点 AO，结果面内 std 6.9，和 shaded 的 7.4 分不开。
 *   ③ aomesh 档画的是**网格**：每个体素的三条可见棱各一条 1px 线 + 面填 AO 灰度。
 *      线必须去重（唯一棱集），否则同一条棱被两个面各描一次，2px 变 3px。
 */

export const MEASURED = {
  frame: 512,
  lumFrames: [131.0, 132.4],   // 24 帧平均亮度极差
  satFrames: [0.365, 0.373],
  modes: ['albedo', 'shaded', 'light', 'aomesh'],
  labels: { albedo: 'flat texture', shaded: 'shaded', light: 'lighting only', aomesh: 'AO mesh' },
  icons: { albedo: 'square', shaded: 'circle', light: 'sun', aomesh: 'layers' },
  btnRow: { x0: 356, x1: 496, y0: 118, y1: 140 },
  wire: 1,                    // AO 网格线宽（px，屏幕定宽）
  aoStep: 0.34,               // 面级光照档位差（片中朝下面 vs 朝上面约差 1/3）
  aoCorner: 0.19,             // 顶点 AO 每一级遮挡压掉的明度
  shadowK: 0.46,              // 软阴影（朝光走 6 步）最多压掉的明度
  sub: 3,                     // shaded 档每面细分：3×3 足够，再细只是多花像素
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

/** 光：左上前方。跟片子里"屋顶最亮、右墙次之、左墙最暗"的顺序对齐。 */
export const LIGHT = { x: -0.45, y: -0.35, z: 0.82 };

export const PALETTE = {
  top: [226, 208, 160],
  left: [188, 92, 84],
  right: [212, 120, 96],
  roof: [200, 106, 88],
  stone: [176, 172, 164],
};

/**
 * 一座带悬挑的塔（三条悬挑 + 一个平台），够看出 AO 和光的方向。
 * 用字符串画地图只是为了改起来方便，voxel 是 {x,y,z}。
 */
export function buildTower() {
  const v = [];
  const seen = new Set();
  const add = (x, y, z, kind = 'wall') => {
    const k = `${x},${y},${z}`;
    if (seen.has(k)) return;
    seen.add(k);
    v.push({ x, y, z, kind });
  };
  // 平台 5×5
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) add(x, y, 0, 'stone');
  // 主楼 2×2，五层
  for (let z = 1; z <= 5; z++) for (let x = 1; x <= 2; x++) for (let y = 1; y <= 2; y++) add(x, y, z);
  // 阳台板：z=3 往两侧各挑出一格（下面这两块墙一定被压暗）
  for (let x = 0; x <= 3; x++) { add(x, 1, 3, 'stone'); add(x, 2, 3, 'stone'); }
  // 顶层再挑一圈小檐
  for (let x = 1; x <= 2; x++) { add(x, 0, 6, 'stone'); add(x, 3, 6, 'stone'); }
  for (let y = 1; y <= 2; y++) { add(0, y, 6, 'stone'); add(3, y, 6, 'stone'); }
  // 顶帽 3×3
  for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) add(x, y, 6);
  for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) add(x, y, 7, 'stone');
  return v;
}

/** 体素占用表 */
function occupancy(voxels) {
  const s = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
  return { has: (x, y, z) => s.has(`${x},${y},${z}`), set: s };
}

/**
 * 顶点级 AO（经典 voxel AO）：面有四个角，每个角看它外侧的三个格子。
 *
 * ⚠ 这里**必须是顶点级、不是面级**。第一版按"一个面一个遮挡值"写，四个面各自
 *   一块纯色，量出来面内 std 6.9，和 shaded 档的 7.4 分不开 —— 因为那只量到了
 *   格子与格子的边界，没量到"同一个面上的明暗渐变"。片子里墙根比墙顶暗，
 *   那是顶点 AO 插值出来的。
 *
 * ⚠⚠ 更贵的一课：**光靠顶点 AO 在这座塔上量不出梯度**。露出来的面，它外侧那三格
 *   按定义就是空的（否则这个面根本不露），所以四个角全是 1.0，面内照样平。
 *   第一版就是这样：flatB 量到 0.00，和 albedo 完全一样。
 *   真正的渐变来自**大尺度遮挡** —— 悬挑下方的墙、塔身下段，得往光的方向走几步
 *   才知道自己被挡了。所以这里同时算"顶点 AO"和"朝光走 6 步的软阴影"。
 *
 * @returns {number[]} 四个角的系数（0..1），顺序与 quad 顶点一致
 */
export function cornerAO(voxels, v, n, d1, d2) {
  const { has } = occupancy(voxels);
  const out = [];
  for (let k = 0; k < 4; k++) {
    const i = k === 0 || k === 3 ? 0 : 1;
    const j = k < 2 ? 0 : 1;
    const si = i ? 1 : -1, sj = j ? 1 : -1;
    const A = [v.x + n[0] + si * d1[0], v.y + n[1] + si * d1[1], v.z + n[2] + si * d1[2]];
    const B = [v.x + n[0] + sj * d2[0], v.y + n[1] + sj * d2[1], v.z + n[2] + sj * d2[2]];
    const C = [v.x + n[0] + si * d1[0] + sj * d2[0], v.y + n[1] + si * d1[1] + sj * d2[1], v.z + n[2] + si * d1[2] + sj * d2[2]];
    let cnt = 0;
    if (has(A[0], A[1], A[2])) cnt++;
    if (has(B[0], B[1], B[2])) cnt++;
    if (has(C[0], C[1], C[2])) cnt += 1.4;   // 对角更狠一点，接缝才收得住
    const aoK = Math.max(0, 1 - MEASURED.aoCorner * cnt);
    // 朝光走 6 步的软阴影：角点稍微错开，四个角才会得到不同的结果
    const ox = v.x + n[0] + si * 0.5 * d1[0] + sj * 0.5 * d2[0];
    const oy = v.y + n[1] + si * 0.5 * d1[1] + sj * 0.5 * d2[1];
    const oz = v.z + n[2] + si * 0.5 * d1[2] + sj * 0.5 * d2[2];
    let hit = 0, steps = 0;
    for (let t = 1; t <= 6; t++) {
      steps++;
      const px = Math.round(ox + LIGHT.x * t * 1.6);
      const py = Math.round(oy + LIGHT.y * t * 1.6);
      const pz = Math.round(oz + LIGHT.z * t * 1.6);
      if (has(px, py, pz)) hit++;
    }
    const sh = 1 - MEASURED.shadowK * (hit / steps);
    out.push(Math.max(0.25, aoK * sh));
  }
  return out;
}

const dot = (x, y, z) => x * LIGHT.x + y * LIGHT.y + z * LIGHT.z;

/**
 * 一档的"面 → 颜色"函数。
 * @param {'albedo'|'shaded'|'light'|'aomesh'} mode
 */
export function toneFor(mode) {
  return (base, n, ao) => {
    const lam = Math.max(0, dot(n[0], n[1], n[2]));
    const lightK = 0.62 + 0.38 * lam;
    const aoK = ao;
    if (mode === 'albedo') {
      // ① 纯贴图：不乘光、不乘 AO。面内必须零梯度。
      return base.map((c) => c);
    }
    if (mode === 'shaded') {
      // ② 成品：光 × 顶点 AO
      return base.map((c) => c * lightK * aoK);
    }
    if (mode === 'light') {
      // ③ 只有照明：同一个 lightK×aoK 印成灰度。
      //    不能直接 255×k —— k 在受光面接近 1，整幅会白成一片（第一版就是这样）。
      const g = Math.round(255 * (0.26 + 0.74 * lightK * aoK));
      return [g, g, g];
    }
    // ④ AO 烘焙网格：面填 AO 灰度（压到 0.10–0.86，留出网格线的对比）
    const g = Math.round(255 * (0.10 + 0.76 * aoK));
    return [g, g, g];
  };
}

/** 双线性取四角之间的一点 */
const bil = (c, u, v) => (c[0] * (1 - u) * (1 - v) + c[1] * u * (1 - v) + c[3] * (1 - u) * v + c[2] * u * v);

/**
 * 画整座塔。
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  {voxels, cam, mode, scale, sub}
 */
export function paintTower(ctx, { voxels, cam, mode = 'shaded', scale = 1, bg = null, sub = 3 } = {}) {
  if (bg) { ctx.fillStyle = rgba(bg, 1); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  const tone = toneFor(mode);
  const list = voxels.slice().sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.x - b.x || a.y - b.y);
  const edges = new Set();
  for (const v of list) {
    const quad = boxFaces(cam, v);
    // 侧面先、顶面后（同一格内）
    const spec = [
      { n: [1, 0, 0], d1: [0, 1, 0], d2: [0, 0, 1], pts: quad.rx, base: PALETTE.right },
      { n: [0, 1, 0], d1: [1, 0, 0], d2: [0, 0, 1], pts: quad.ly, base: PALETTE.left },
      { n: [0, 0, 1], d1: [1, 0, 0], d2: [0, 1, 0], pts: quad.top, base: v.kind === 'stone' ? PALETTE.stone : PALETTE.top },
    ];
    for (const f of spec) {
      const ao = cornerAO(voxels, v, f.n, f.d1, f.d2);
      if (mode === 'albedo' || sub <= 1) {
        // 单一色：albedo 档就是要"面内零梯度"，所以这里绝不能细分
        const c = tone(f.base, f.n, bil(ao, 0.5, 0.5));
        ctx.fillStyle = rgba(c, 1);
        path(ctx, f.pts); ctx.fill();
      } else {
        // 细分 sub×sub，每格取格心处的双线性 AO —— 明暗渐变就是这么来的
        const p = f.pts;
        for (let a = 0; a < sub; a++) {
          for (let b = 0; b < sub; b++) {
            const u0 = a / sub, u1 = (a + 1) / sub, v0 = b / sub, v1 = (b + 1) / sub;
            const P = (u, w) => lerp2(p, u, w);
            const c = tone(f.base, f.n, bil(ao, (u0 + u1) / 2, (v0 + v1) / 2));
            ctx.fillStyle = rgba(c, 1);
            ctx.beginPath();
            const q = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
            ctx.moveTo(q[0][0], q[0][1]);
            for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]);
            ctx.closePath(); ctx.fill();
          }
        }
      }
      if (mode === 'aomesh') {
        // 唯一棱集：把每条棱的两个端点排序后做 key，重复的跳过
        for (let i = 0; i < 4; i++) {
          const a = f.pts[i], b = f.pts[(i + 1) % 4];
          const k = [a, b].map((p2) => p2.map((q2) => q2.toFixed(1)).join('_')).sort().join('|');
          if (edges.has(k)) continue;
          edges.add(k);
          ctx.lineWidth = 1.4 * MEASURED.wire * scale;
          ctx.strokeStyle = 'rgba(38,44,50,0.92)';
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
    }
  }
  return { tris: list.length * 3 };
}

/** 四边形上的双线性点：p = [k0,k1,k2,k3] 依次是 (0,0),(1,0),(1,1),(0,1) */
function lerp2(p, u, v) {
  const x = p[0][0] * (1 - u) * (1 - v) + p[1][0] * u * (1 - v) + p[2][0] * u * v + p[3][0] * (1 - u) * v;
  const y = p[0][1] * (1 - u) * (1 - v) + p[1][1] * u * (1 - v) + p[2][1] * u * v + p[3][1] * (1 - u) * v;
  return [x, y];
}

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** 一个体素的三个可见面（角点表）。 */
export function boxFaces(cam, v) {
  const { x, y, z } = v;
  const P = (u, w, h) => cam.pt(u, w, h);
  const t = [
    P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1),
  ];
  const b = [
    P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z),
  ];
  return {
    top: t,
    rx: [t[1], t[2], b[2], b[1]],
    ly: [t[2], t[3], b[3], b[2]],
    bot: b,
  };
}

export function makeCam({ cx, cy, p = 34, hz = 34, scale = 1 } = {}) {
  const k = p * scale;
  return { p: k, scale, pt: (u, v, h = 0) => [cx + (u - v) * 0.866 * k, cy + (u + v) * 0.5 * k - h * hz * scale * 0.5] };
}

/* ───────────────────────── 反测 ───────────────────────── */

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };

/** 整幅的亮度 / 饱和度 / 深色线覆盖率 */
export function probeFrame(ctx) {
  const { width: W, height: H } = ctx.canvas;
  const d = ctx.getImageData(0, 0, W, H).data;
  let n = 0, s = 0, st = 0, dark = 0;
  for (let i = 0; i < d.length; i += 4) {
    const c = [d[i], d[i + 1], d[i + 2]];
    if (d[i + 3] < 200) continue;
    n++; s += lum(c); st += sat(c);
    if (lum(c) < 70) dark++;
  }
  return { lum: s / n, sat: st / n, dark: dark / n };
}

/** 一块矩形里的面内梯度：亮度标准差 */
export function probePatch(ctx, x, y, w, h) {
  const d = ctx.getImageData(x, y, w, h).data;
  const v = [];
  for (let i = 0; i < d.length; i += 4) v.push(lum([d[i], d[i + 1], d[i + 2]]));
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length);
  return { mean: m, std: sd };
}

/**
 * 整幅的"面内平坦度"：5×5 窗口的亮度标准差（取中位数）。
 * 用中位数而不是均值，是因为均值会被棱线（AA）拉高，量不出"面内到底平不平"。
 * 纯贴图档应该 ≈0（只有棱上有梯度，占少数），带光照档应该 >1。
 *
 * ⚠ 踩过的坑：采样数写成常数 9，但实际按 step 2 采了 36 个点。
 *   `s2/9 - (s/9)²` 于是变成 `4E[x²] - 16E[x]²`，在均值 100 附近**恒为负**，
 *   被 Math.max(0,·) 夹成 0 —— 四档全都量到 0.00，看起来"两种模式一样平"。
 *   样本数必须由循环自己数出来。
 */
export function probeFlatness(ctx, win = 5, bg = null) {
  const { width: W, height: H } = ctx.canvas;
  const d = ctx.getImageData(0, 0, W, H).data;
  const g = (x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
  const isBg = (x, y) => {
    if (!bg) return false;
    const i = (y * W + x) * 4;
    return Math.abs(d[i] - bg[0]) < 6 && Math.abs(d[i + 1] - bg[1]) < 6 && Math.abs(d[i + 2] - bg[2]) < 6;
  };
  const v = [];
  for (let y = win; y < H - win; y += 3) {
    for (let x = win; x < W - win; x += 3) {
      // ⚠ 只量**完全落在物体内部**的窗口。
      //    整幅里背景占七成且全是纯色 → 中位数恒为 0；
      //    只判中心像素也不行，轮廓上的窗口把"物体 vs 背景"的落差算成 7.8 —— 
      //    结果 albedo 档量出 7.83，看着像"表面有明暗"，其实是剪影。
      if (isBg(x, y)) continue;
      let s = 0, s2 = 0, n = 0, allIn = true;
      for (let j = -win; j <= win; j += 2) {
        for (let i = -win; i <= win; i += 2) {
          if (isBg(x + i, y + j)) { allIn = false; break; }
          const p = g(x + i, y + j);
          s += p; s2 += p * p; n++;
        }
        if (!allIn) break;
      }
      if (!allIn) continue;
      const m = s / n;
      v.push(Math.sqrt(Math.max(0, s2 / n - m * m)));
    }
  }
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  // 取 p75：棱线（AA）占比小但有极高值，中位数会被"面内局部平坦"的窗口吃掉
  return v[Math.floor(v.length * 0.75)];
}

/** 两幅同尺寸画布的像素差 */
export function diffPair(a, b) {
  const A = a.getImageData(0, 0, a.canvas.width, a.canvas.height).data;
  const B = b.getImageData(0, 0, b.canvas.width, b.canvas.height).data;
  let nn = 0, c = 0, sum = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    sum += d; nn++; if (d > 18) c++;
  }
  return { pct: (100 * c) / nn, mean: sum / nn / 3 };
}
