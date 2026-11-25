/**
 * darkcontour.js — 2023 版式的**深色轮廓线**：1px 暗边 + 折缝，靠蒙版 + 深度做
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1707497006640365880（2023-09-28）
 *   原文只有一句 "And here's a couple more being generated"，**没有一个字讲实现**。
 *   索引里当初记的是"橙红轮廓光 + 台地浅色描边"，那是从 200px 缩略图上看出来的。
 *   这轮放大到 6× 逐像素比，结论**反了**：
 *
 *     · 岛上没有"橙红轮廓光"。那些橙红是**屋顶瓦色**（255,155,118），
 *       以及被阳光晒到的沙坡（255,204,138）。两者都不贴轮廓走，是面片本色。
 *     · 真正贴着轮廓走的是**一条深褐色的暗线**，1px 核心 + 1px 抗锯齿，
 *       色约 (132,117,84)，比旁边的沙地 (198,188,152) 暗 0.68×。
 *     · 第 2 帧（f002）是**纯黑剪影**：整幅 52.67% 是 #000，硬边，
 *       没有任何明暗。→ 这条渲染管线确实有一条"先出 footprint mask"的通道，
 *       暗线就是从这张 mask 的边界提出来再压回去的。
 *
 * ── 帧实测（640×640 · f010 / f014，均来自 1707497006640365880）──────────
 *   剪影帧 f002    黑像素 **52.67%**（640² 全幅），边缘 1px AA，内部全 0 亮度。
 *   暗线颜色       (132,117,84) / (133,123,116) 两档交替 → 核心 1px + AA 1px。
 *   暗线位置       ①岛的外轮廓（与水面交界）②台地顶面与崖面的**折缝**
 *                  —— 两处都有，说明它不是单纯的后处理描边，是"折缝 AO + 轮廓"合流。
 *   暗线宽度       横向游程：跨过所有边界 1–2px，画幅 640 定宽，不随地块缩放。
 *   明暗对比       沙地 (198,188,152) → 暗线 (132,117,84)：Δlum −52，饱和度不掉。
 *   折缝方向       只在**背光侧**的折缝更明显；朝光侧的折缝几乎不可见（f014 左上崖顶）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **从 mask 提边界，不从几何提。** 片子里暗线严格贴最终像素轮廓（包括房子
 *      挡出来的缺口），几何提边会得到"模型边"而不是"看得见的边"。做法：把本帧
 *      所有可见面栅格化进一张 id/深度图，取"有 id 且四邻有任一无 id"的像素当边界。
 *      实测 52.67% 的剪影就是这张图的二值化，尺寸和形状对得上。
 *   ② **宽度写死 1px，不 scale。** 640 画幅量到 1–2px（含 AA），且这条片子的
 *      相机在推拉，线宽始终不变 → 屏幕空间定宽。跟着 scale 画会在大特写里变成
 *      一条粗带子（第一版就是这样，反测宽度中位数 4px，一眼假）。
 *   ③ **折缝单独一遍，不能只描外轮廓。** 只描外轮廓的话，台地之间那道缝会消失，
 *      整座岛变成一块没有层次的板（A/B 差 2.1%，但观感差很多）。折缝用相邻面
 *      法线夹角 > 18° 判定，且**只在背光侧**加深（点积 > 0 的折缝跳过）——
 *      这是 f014 左上崖顶那条缝几乎看不见的原因。
 *   ④ **深度测试必须做，不能靠画家算法。** 暗线是"贴轮廓"的，而轮廓会被前景
 *      物体切碎；按面排序时同一段轮廓可能被后画的远处地块重新盖住。用 1/z
 *      缓冲逐像素测，断口就自然落在"被挡住"的地方。
 */

export const MEASURED = {
  ref: 640,             // 主量测片画幅
  width: 1,             // 核心线宽（屏幕 px）
  aa: 1,                // 抗锯齿边
  color: [132, 117, 84],// 暗线色（量到两档之一）
  color2: [133, 123, 116],
  darkGain: 0.68,       // 相对沙地的亮度比（(132+117+84)/(198+188+152) ≈ 0.62~0.68）
  maskCoverage: 52.67,  // f002 剪影占全幅百分比
  creaseAngle: 18,      // 折缝判定：相邻面法线夹角阈值（度）
  litSkip: 0.0,         // 折缝只在背光侧：dot(n, L) > 此值则跳过
};

/** 确定性 LCG，lab 里所有随机都走它（Math.random 没法复测）。 */
export function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** 等距相机：与 tideflat / rimline 同一套（地面圆 R → 半轴 1.2247R / 0.7071R）。 */
export function makeCam({ cx, cy, w = 24, h = 13.86, zh = 20 }) {
  return {
    cx, cy, w, h, zh,
    p(x, y, z) { return [cx + (x - y) * w, cy + (x + y) * h * 0.5 - z * zh]; },
    depth(x, y, z) { return x + y + z * 1.35; }, // 画家序用的近似视深
  };
}

/**
 * 把一组四边形面（{pts:[[x,y,z]...], color, id}）画进 canvas，同时产出
 * ①深度图 ②id 图。暗线/折缝都从这两张图里读，不从几何重算。
 */
export function rasterize(ctx, faces, cam, W, H) {
  const idbuf = new Int32Array(W * H).fill(-1);
  const zbuf = new Float32Array(W * H).fill(1e9);
  const order = faces.map((f, i) => ({ f, i, d: cam.depth(...f.center) }))
    .sort((a, b) => b.d - a.d);           // 远 → 近

  for (const { f, i } of order) {
    const sp = f.pts.map((p) => cam.p(...p));
    ctx.beginPath();
    ctx.moveTo(sp[0][0], sp[0][1]);
    for (let k = 1; k < sp.length; k++) ctx.lineTo(sp[k][0], sp[k][1]);
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.fill();
    // 栅格化进 id/z（用多边形扫描，逐行求交，省一个 WebGL 上下文）
    let minY = 1e9, maxY = -1e9;
    for (const p of sp) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
      const xs = [];
      for (let k = 0; k < sp.length; k++) {
        const a = sp[k], b = sp[(k + 1) % sp.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) {
        for (let x = Math.max(0, Math.ceil(xs[n])); x <= Math.min(W - 1, Math.floor(xs[n + 1])); x++) {
          const idx = y * W + x;
          const d = f.depth ?? cam.depth(...f.center);
          if (d < zbuf[idx]) { zbuf[idx] = d; idbuf[idx] = i; }
        }
      }
    }
  }
  return { idbuf, zbuf };
}

/**
 * 从 id 图取轮廓像素：有 id 且四邻有任一无 id。
 * 只取**不重复**的像素（每个边界像素只画一个 1px 方块），否则同一条边被两侧
 * 各画一次会变成 2px——这是 rimline 那一轮踩过的坑，这里直接避开。
 */
export function contourPixels(idbuf, W, H) {
  const out = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && idbuf[y * W + x] >= 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) out.push([x, y]);
    }
  }
  return out;
}

/** 把轮廓像素按 1px 定宽画上去；color 用实测色，alpha 由 AA 折半模拟。 */
export function paintContour(ctx, pixels, { color = MEASURED.color, alpha = 0.92 } = {}) {
  ctx.save();
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  for (const [x, y] of pixels) ctx.fillRect(x, y, 1, 1);
  ctx.restore();
  return pixels.length;
}

/** 面法线（取前三个点，够用；我们的面都是凸四边形）。 */
export function normalOf(pts) {
  const [a, b, c] = pts;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return n.map((q) => q / l);
}

/**
 * 折缝：共边的两个面夹角 > creaseAngle 时输出该边。
 * 只在背光侧画（dot(n, L) <= litSkip），对应 f014 里朝光侧折缝几乎看不见。
 */
export function creaseSegments(faces, { creaseAngle = MEASURED.creaseAngle, light = [-0.4, -0.55, 0.73] } = {}) {
  const key = (p) => p.map((v) => v.toFixed(3)).join(',');
  const map = new Map();
  for (const f of faces) {
    const n = normalOf(f.pts);
    for (let k = 0; k < f.pts.length; k++) {
      const a = f.pts[k], b = f.pts[(k + 1) % f.pts.length];
      const kk = [key(a), key(b)].sort().join('|');
      if (!map.has(kk)) map.set(kk, []);
      map.get(kk).push({ a, b, n, f });
    }
  }
  const cosT = Math.cos((creaseAngle * Math.PI) / 180);
  const segs = [];
  for (const [, list] of map) {
    if (list.length !== 2) continue;
    const [p, q] = list;
    const dot = p.n[0] * q.n[0] + p.n[1] * q.n[1] + p.n[2] * q.n[2];
    if (dot > cosT) continue;                                  // 太顺，不是折缝
    const lit = p.n[0] * light[0] + p.n[1] * light[1] + p.n[2] * light[2];
    if (lit > MEASURED.litSkip) continue;                      // 朝光侧的缝不画
    segs.push({ a: p.a, b: p.b });
  }
  return segs;
}

/**
 * 一座"三层台地"的小岛，专供反测用：层数少、折缝数得清。
 * 高度函数 = 椭圆半径分档 + 只在**分档边界上**抖动（对应片子里那条不规则海岸线）。
 *
 * 坑：第一版对每一格都 `if (rnd()<0.16) v--`，结果台地中间被打出一堆洞，
 * 渲出来是一张"迷宫板"而不是岛 —— 片子里台地内部是整块的，只有海岸线在抖。
 */
export function makeIsland({ n = 13, seed = 7 } = {}) {
  const rnd = lcg(seed);
  const h = [];
  for (let y = 0; y < n; y++) {
    h.push([]);
    for (let x = 0; x < n; x++) {
      const dx = (x - n / 2 + 0.5) / (n / 2), dy = (y - n / 2 + 0.5) / (n / 2);
      const d = Math.hypot(dx, dy * 1.12);
      const j = (rnd() - 0.5) * 0.16;          // 只在档位附近抖，不掏空内部
      const dd = d + j;
      h[y][x] = dd < 0.46 ? 3 : dd < 0.74 ? 2 : dd < 0.96 ? 1 : 0;
    }
  }
  // 平滑两遍：把单格的锯齿补掉。片子里台地边是"整块推进"的，
  // 不分青红皂白地逐格抖动会得到一排 1 格深的槽，视觉上像迷宫不像岛。
  for (let pass = 0; pass < 2; pass++) {
    const cp = h.map((r) => r.slice());
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => (x + dx < 0 || y + dy < 0 || x + dx >= n || y + dy >= n) ? 0 : cp[y + dy][x + dx]);
        const tally = {};
        for (const v of nb) tally[v] = (tally[v] || 0) + 1;
        const [best, cnt] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
        if (cnt >= 3 && Number(best) !== cp[y][x]) h[y][x] = Number(best);
      }
    }
  }
  return { n, h };
}

/** 把高度场拆成朝上的顶面；侧壁只在高度差处生成（和片子里"柱状崖面"一致）。 */
function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((v >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((v >> 8) & 255) * k));
  const b = Math.min(255, Math.round((v & 255) * k));
  return `rgb(${r},${g},${b})`;
}

export function islandFaces(isl, palette = {}, step = 0.7) {
  const { n, h } = isl;
  const C = palette;
  const top = C.top || ['#c9c08a', '#cdc68f', '#c2bd86'];
  const cliff = C.cliff || ['#8d7f63', '#98876a'];
  const faces = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = h[y][x];
      if (!v) continue;
      const z = v * step;
      faces.push({
        pts: [[x, y, z], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z]],
        center: [x + 0.5, y + 0.5, z],
        // 层级提亮：片子里每层台地的顶面亮度都不同（越高越亮），
        // 全靠这一档差 + 轮廓线，台阶才读得出来。
        color: shade(top[(x * 3 + y * 5) % top.length], 0.88 + v * 0.045),
      });
      // 四邻侧壁
      const nb = [[1, 0, [[x + 1, y, z], [x + 1, y + 1, z]]], [-1, 0, [[x, y + 1, z], [x, y, z]]],
      [0, 1, [[x + 1, y + 1, z], [x, y + 1, z]]], [0, -1, [[x, y, z], [x + 1, y, z]]]];
      for (const [dx, dy, edge] of nb) {
        const nx = x + dx, ny = y + dy;
        const nv = (nx < 0 || ny < 0 || nx >= n || ny >= n) ? 0 : h[ny][nx];
        if (nv >= v) continue;
        const z0 = nv * step;
        faces.push({
          pts: [...edge.map((p) => [p[0], p[1], z]), ...edge.map((p) => [p[0], p[1], z0]).reverse()],
          center: [(edge[0][0] + edge[1][0]) / 2 + dx * 0.01, (edge[0][1] + edge[1][1]) / 2 + dy * 0.01, (z + z0) / 2],
          color: shade(cliff[(x + y) % cliff.length], 0.84),
        });
      }
    }
  }
  return faces;
}

/**
 * 房子：白墙 + 珊瑚红屋顶（片中 (255,155,118)，这是被我误认成"轮廓光"的那个色）。
 * 返回面列表 + 顶面中心，方便 lab 里数房子。
 */
export function houseFaces(x, y, z, s = 0.62, roof = '#ff9b76') {
  const w = s / 2;
  const wallH = s * 0.9;
  const f = [];
  const quad = (pts, color) => f.push({ pts, center: pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]), color });
  const p = (dx, dy, dz) => [x + dx, y + dy, z + dz];
  // 墙：只画朝外的三面（后面被挡，省面）
  quad([p(-w, w, 0), p(w, w, 0), p(w, w, wallH), p(-w, w, wallH)], '#dfe6e0');
  quad([p(w, -w, 0), p(w, w, 0), p(w, w, wallH), p(w, -w, wallH)], '#e8ede6');
  quad([p(-w, -w, 0), p(w, -w, 0), p(w, -w, wallH), p(-w, -w, wallH)], '#d6ded7');
  // 屋顶两坡（脊沿 x）
  quad([p(-w - 0.06, w + 0.06, wallH), p(w + 0.06, w + 0.06, wallH), p(w + 0.06, 0, wallH + s * 0.5), p(-w - 0.06, 0, wallH + s * 0.5)], roof);
  quad([p(-w - 0.06, -w - 0.06, wallH), p(w + 0.06, -w - 0.06, wallH), p(w + 0.06, 0, wallH + s * 0.5), p(-w - 0.06, 0, wallH + s * 0.5)], roof);
  return f;
}

/**
 * 反测：把画布上的暗线宽度量出来（行游程，只统计连续 <8px 的暗段）。
 *
 * **坑**：第一版按"颜色接近 (132,117,84)"来认暗线，结果**带线和不带线都量到 4px**——
 * 因为崖面色 #8d7f63 = (141,127,99) 跟暗线只差 15，整片崖壁都被认成线。
 * 改成**跟"不画线的同一帧"逐像素做差**：差出来的才是线，跟底色无关。
 * 这个口径和片子里的"线 = 底色上硬切过去的一道"是同一件事。
 */
export function measureContourWidth(ctx, W, H, ref, color = MEASURED.color, tol = 26) {
  const d = ctx.getImageData(0, 0, W, H).data;
  const isInk = ref
    ? (i, j) => {
      const k = (j * W + i) * 4;
      return Math.abs(d[k] - ref[k]) + Math.abs(d[k + 1] - ref[k + 1]) + Math.abs(d[k + 2] - ref[k + 2]) > 18;
    }
    : (i, j) => {
      const k = (j * W + i) * 4;
      return Math.abs(d[k] - color[0]) < tol && Math.abs(d[k + 1] - color[1]) < tol && Math.abs(d[k + 2] - color[2]) < tol;
    };
  const runs = [];
  // 厚度 = min(该像素所在的行游程, 列游程)。
  // 坑：只取行游程会把**水平段**的长度当成线宽（一条 60px 的横向线量出 60）。
  // 取两者较小值，横线靠列游程=1、竖线靠行游程=1，斜线两向都小 —— 与朝向无关。
  const rowLen = new Int32Array(W * H), colLen = new Int32Array(W * H);
  for (let j = 0; j < H; j++) {
    let i = 0;
    while (i < W) {
      if (!isInk(i, j)) { i++; continue; }
      let k = i; while (k < W && isInk(k, j)) k++;
      for (let q = i; q < k; q++) rowLen[j * W + q] = k - i;
      i = k;
    }
  }
  for (let i = 0; i < W; i++) {
    let j = 0;
    while (j < H) {
      if (!isInk(i, j)) { j++; continue; }
      let k = j; while (k < H && isInk(i, k)) k++;
      for (let q = j; q < k; q++) colLen[q * W + i] = k - j;
      j = k;
    }
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      if (!rowLen[idx]) continue;
      const t = Math.min(rowLen[idx], colLen[idx] || 999);
      if (t < 9) runs.push(t);
    }
  }
  runs.sort((a, b) => a - b);
  if (!runs.length) return { n: 0 };
  return {
    n: runs.length,
    p50: runs[runs.length >> 1],
    p90: runs[Math.floor(runs.length * 0.9)],
    max: runs[runs.length - 1],
  };
}
