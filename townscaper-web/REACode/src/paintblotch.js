/**
 * paintblotch.js — 把"体块感"画进贴图：低模 + 大色斑 + 扇贝状笔触边
 *
 * ── 原文（两条片子说的是同一件事）────────────────────────────────────────
 *   1707490932017279035（2023-09-28）：
 *     "They are of course **100% texture**, painted onto a fairly low, poly mesh.
 *      I keep thinking I'm gonna need to give em some volume with billboard sprites,
 *      but now I'm not so sure anymore."
 *     → 体积感不是几何给的，是**画上去的**；连"要不要加 billboard 补充体积"都在犹豫。
 *
 *   1480635131614355459（2022-01-10）：
 *     "More experiments in procedural texturing of procedural islands. Still very early,
 *      but I do like these **big paint blotches**. They **hide the polys well** and they
 *      would be hard to achieve [procedurally]..."
 *     → 色斑的用处写得很直白：**遮住多边形**。所以色斑必须跨面连续，
 *       一旦按面填色（flat shading）就等于把"低模"这件事暴露了。
 *
 * ── 帧实测（1707490932017279035，640×640，f000；f012 复算一致）──────────────
 *   画面分块     色斑 42.66% / 底色 26.45% / 水 10.77% / 其余（崖、房、线框）20.11%
 *   色斑（受光）  #EAB68C (234,182,140)
 *   色斑（背光）  #CAA27E (202,162,126)   ← 同一块色斑内部的明暗差，不是两个色
 *   底色（第二层）#B3B29E (179,178,158)   ← 偏绿的灰，几乎无色相
 *   边界过渡      **4px**（x=396..402 一条水平扫描里 R 从 202 落到 179，
 *                 中间没有暗环 —— 边界是"糊"开的，不是描边也不是硬切）
 *   笔触扇贝      **≈5px 周期**（把边界放大 4× 数鼓包：单包 18–22px@4x → 4.5–5.5px）
 *                 —— 这是"用小圆笔盖章"留下的痕迹；**估计值**，因为鼓包互相粘连，
 *                 自相关在 3–9px 之间没有单峰（我试过，见 /tmp 里的 bead.mjs）
 *   线框帧 f012   整片地形有**细灰三角线**（每面从中心点扇形三角化），
 *                 贴图完全不受三角边影响 —— 这就是"100% painted"的直接证据：
 *                 细节密度 ≈ 5px，而三角面边长 40–90px，两者差一个数量级。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **色斑必须跨面连续**，所以先烘一张岛域 UV 的贴图，再用岛轮廓 clip 上去；
 *      按面填色（本文件的 `flat` 模式）留作对照 —— 一开就能看见三角面。
 *   ② **扇贝边 = 用高频噪声扰动采样坐标**，不是 cos(距离)。第一版我按
 *      "沿等值线加 cos 波纹"写，结果沿边界 cos 的相位是常数 → 边界一点鼓包都没有
 *      （等值线方向上场的值不变，这是等值线的定义）。改成 domain warp 之后才有。
 *   ③ **边界 4px 软边 + 无暗环**。加暗环会变成贴纸感，片子里没有。
 *   ④ 内部明暗差只有 (234,182,140)→(202,162,126)，约 **−14% 亮度**，
 *      所以色斑内部是"低幅慢变"，不是贴图里再画一层结构。
 */

export const MEASURED = {
  frame: 640,
  coverage: { blotch: 42.66, base: 26.45, water: 10.77, other: 20.11 },
  blotchLit: [234, 182, 140],
  blotchShade: [202, 162, 126],
  baseWash: [179, 178, 158],
  edgeSoftPx: 4,        // 640 帧
  beadPeriodPx: 5,      // 640 帧；估计值（鼓包粘连，自相关无单峰）
  beadAmpPx: 2.0,       // 鼓包凸出量，同上估计
  innerMottle: 0.14,    // 色斑内部亮度差 14%
  meshFanPx: [40, 90],  // 三角面边长；比细节密度大一个数量级
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 值噪声（双线性 + smoothstep），周期由 cells 控制：cells 越大特征越小 */
function vnoise(x, y, cells, seed) {
  const fx = x * cells, fy = y * cells;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function fbm(x, y, cells, oct, seed) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    v += amp * vnoise(x, y, cells * f, seed + o * 71);
    norm += amp; amp *= 0.5; f *= 2.07;
  }
  return v / norm;
}

/**
 * 烘一张色斑场。
 * 返回 {mask:Float32Array(0..1), size, meta} —— 1 = 色斑，0 = 底色。
 *
 * opts:
 *   cells      色斑的"团块数"（岛域 UV 上的噪声格数）。片子里 640px 上大约
 *              3.5 个大团 → cells≈3.5；给 0 会用 MEASURED 反推。
 *   warpCell   扇贝边的频率（UV/px）。默认由 beadPeriodPx 反推。
 *   warpAmp    扇贝凸出量（UV），由 beadAmpPx 反推。
 *   size       贴图边长 px。
 */
export function blotchField(size = 512, opts = {}) {
  const S = size;
  const px = S / MEASURED.frame;               // 相对 640 帧的像素倍率
  const cells = opts.cells ?? 3.6;
  // vnoise 是整数格上的双线性插值，**一个起伏 = 两格**（一凸一凹）。
  // 所以要得到"周期 P px"，cells 必须取 2S/P —— 直接取 S/P 量出来是 7px，正好差一倍。
  const warpCell = opts.warpCell ?? (2 * S) / (MEASURED.beadPeriodPx * px);
  const warpAmp = opts.warpAmp ?? (MEASURED.beadAmpPx * px) / S;
  const threshIn = opts.thresh;         // 不给就按目标覆盖率反解（见下）
  // 片子里"陆地上色斑占 61.7%"，所以贴图直接按这个覆盖率定阈值 —— 
  // 覆盖率是**从标题数字反解出来的**，不是调参调出来的。
  const target = opts.landCoverage ?? 61.7;
  const softPx = opts.softPx ?? MEASURED.edgeSoftPx * px;
  const band = clamp((softPx * cells * 0.62) / S, 0.0012, 0.4);
  const seed = opts.seed ?? 1337;

  // 第一遍：存原始场
  const field = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // ② domain warp：用高频小振幅噪声挪采样点 → 边界长出扇贝鼓包。
      //    振幅 1.4px、波长 ≈5px，跟片子里"小圆笔盖章"的痕迹同量级。
      const wx = u + (vnoise(u, v, warpCell, seed + 11) - 0.5) * 2 * warpAmp;
      const wy = v + (vnoise(u, v, warpCell, seed + 23) - 0.5) * 2 * warpAmp;
      field[y * S + x] = fbm(wx, wy, cells, 3, seed);
    }
  }

  // 阈值 = 场的分位数（覆盖率 61.7% → 取 38.3% 分位）
  let thresh = threshIn;
  if (thresh === undefined) {
    const sample = [];
    for (let i = 0; i < field.length; i += 7) sample.push(field[i]);
    sample.sort((a, b) => a - b);
    thresh = sample[Math.floor((1 - target / 100) * (sample.length - 1))];
  }

  const mask = new Float32Array(S * S);
  let on = 0;
  for (let i = 0; i < field.length; i++) {
    const m = clamp((field[i] - (thresh - band)) / (2 * band), 0, 1);
    mask[i] = m * m * (3 - 2 * m);
    if (mask[i] > 0.5) on++;
  }
  return {
    mask, size: S,
    meta: {
      coverage: (on / (S * S)) * 100,
      // 片子里的 "42.66%" 是整幅（含水），而贴图只覆盖陆地：
      // 陆地上色斑占 174738/(174738+108356) = **61.7%**，这才是贴图该对齐的数。
      landCoverage: (on / (S * S)) * 100,
      cells, warpCell, warpAmp, band,
    },
  };
}

const mixRGB = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];

function sampleBilinear(mask, S, x, y) {
  const x0 = clamp(Math.floor(x), 0, S - 1), y0 = clamp(Math.floor(y), 0, S - 1);
  const x1 = clamp(x0 + 1, 0, S - 1), y1 = clamp(y0 + 1, 0, S - 1);
  const tx = clamp(x - x0, 0, 1), ty = clamp(y - y0, 0, 1);
  const a = mask[y0 * S + x0], b = mask[y0 * S + x1];
  const c = mask[y1 * S + x0], d = mask[y1 * S + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

/**
 * 用"盖章"把色斑边界做成扇贝。
 *
 * ── 为什么会走到这一步 ────────────────────────────────────────────────
 *   我先试了两次"数学法"，都不行：
 *   ① 沿等值线加 cos(相位)：等值线方向上场的值恒定，cos 的相位也是常数 → 一点鼓包都没有。
 *   ② domain warp（高频噪声挪采样点）：鼓包出来了，但幅度只有 ±0.8px，40 行 ASCII 打出来
 *      是一条光滑楼梯；而且自相关量出的周期是 7px，跟设的 4px 差一倍 —— 因为 vnoise 一个
 *      起伏要两格（凸+凹），频率参数的直接换算会错 2×。
 *   ③ 最后按片子的**成因**来写：边界是一串小圆点叠出来的（放大 4× 看就是一颗颗珠子），
 *      所以直接盖圆点、让"并集的外包络"自己长出扇贝。周期 = 点的间距，半径 = 珠的大小，
 *      两个都是可量的量，再也不用跟噪声频率换算。
 */
export function beadEdge(ctx, mask, S, { r = 2.4, spacing = 4.4, color, rimColor, jitter = 0.22, seed = 7 } = {}) {
  const beads = [];
  const step = spacing;
  let n = 0;
  for (let gy = 0; gy < S; gy += step) {
    for (let gx = 0; gx < S; gx += step) {
      // 网格抖动，避免珠子排成正交阵列（那样边界会出现 45°/90° 的方向性）
      const jx = gx + (hash2(gx | 0, gy | 0, seed) - 0.5) * step;
      const jy = gy + (hash2(gx | 0, gy | 0, seed + 5) - 0.5) * step;
      const m = sampleBilinear(mask, S, jx, jy);
      // 只在**边缘过渡带**盖章：珠子进到深处会被内部 mottle 衬出来，整块色斑变成
      // 一堆泡泡（第一版就是这样，4× 放大看像珊瑚）。深处保持平滑，符合片子里
      // "只有边缘有珠、内部是平涂"的样子。
      if (m < 0.12 || m > 0.90) continue;
      const rr = r * (1 + (hash2(gx | 0, gy | 0, seed + 9) - 0.5) * 2 * jitter);
      beads.push([jx, jy, rr, m]);
      n++;
    }
  }
  // 两遍盖章：先铺一圈**更大**的暗色珠（露出来的部分就成了外包络上的"壳"），
  // 再压上亮色珠。第一版把暗色画成 r*0.72 的小圆 → 每颗珠子变成甜甜圈，
  // 4× 放大看是一串空心环，明显不对；壳只应该出现在并集的**外沿**。
  ctx.save();
  // 珠子是硬边圆，会把下面那层 4px 的软过渡整个盖掉（量出来只剩 1px）。
  // 用 0.92 的透明度压上去，软边还能从珠缝里透出来 —— 片子的边是"软底 + 硬珠"两层。
  ctx.globalAlpha = 0.75;
  if (rimColor) {
    for (const [x, y, rr, m] of beads) {
      if (m > 0.8) continue;                      // 深处的珠不铺壳
      ctx.fillStyle = rimColor;
      ctx.beginPath(); ctx.arc(x, y, rr * 1.28, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const [x, y, rr] of beads) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return { beads: n, spacing, r };
}

/**
 * 把色斑场画成一张贴图（RGB，不含岛轮廓）。
 * 两步：① 软边的低频"色块"打底（这是片子里色斑内部那 14% 的明暗差）；
 *       ② 用盖圆点把边界换成扇贝边（beadEdge 的注释里写了为什么不能用数学法）。
 */
export function blotchTexture(size = 512, opts = {}) {
  const field = blotchField(size, opts);
  const { mask, size: S } = field;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const lit = opts.blotch ?? MEASURED.blotchLit;
  const shade = opts.shade ?? MEASURED.blotchShade;
  const base = opts.base ?? MEASURED.baseWash;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const m = mask[i];
      // 色斑内部：低频 mottle，只改亮度不改色相
      const mot = fbm(x / S, y / S, 7, 2, 991) - 0.5;
      const t = clamp(0.5 + mot * MEASURED.innerMottle * 4, 0, 1);
      const bc = mixRGB(shade, lit, t);
      const c = m > 0.001 ? mixRGB(base, bc, m) : base;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ② 扇贝边。半径/间距按 640 帧的像素换算，so 在 512 的贴图上 r=2.4、spacing=4.4。
  const px = S / MEASURED.frame;
  const bead = opts.bead === false ? null : beadEdge(ctx, mask, S, {
    r: (opts.beadR ?? 3.0) * px,
    spacing: (opts.beadGap ?? 3.8) * px,
    color: opts.beadColor ?? `rgb(${lit.join(',')})`,
    rimColor: opts.rimColor === null ? null : (opts.rimColor ?? `rgba(${mixRGB(lit, [120, 60, 30], 0.22).join(',')},0.55)`),
    seed: (opts.seed ?? 1337) + 3,
  });
  return { canvas: cv, field, bead };
}


/**
 * 第二个用例：苔藓/植被软洗（1480635131614355459，2022-01-10）
 *
 *   原文："More experiments in procedural texturing of procedural islands. Still very early,
 *         but I do like these big paint blotches. They hide the polys well..."
 *   帧实测（f016，640×640）：岛是灰泥色的裸模，中间一大片橄榄绿洗：
 *     (124,132,113) #7C8471 —— **G 略高于 R、B 最低**，饱和度极低（max−min = 19），
 *     边界极软（比 1707 的色斑软得多，10px 级），**完全没有扇贝珠**。
 *   → 所以它和 1707 是同一套系统的两个预设：1707 = 干笔着色（硬珠 + 4px 软底），
 *     1480 = 湿笔晕染（无珠 + 10px 软边）。差别只在 bead 与 softPx 两个参数上。
 */
export const PRESETS = {
  // 1707：干笔 / 色斑
  clay: {
    blotch: [234, 182, 140], shade: [202, 162, 126], base: [179, 178, 158],
    cells: 3.6, softPx: 4, bead: true,
  },
  // 1480：湿笔 / 苔藓。覆盖率 34% 是帧里量的：f016 = 28.3%、f022 = 40.7%（这一条里
  // 苔藓是**边生成边扩散**的，所以取中段）。
  moss: {
    blotch: [124, 132, 113], shade: [104, 114, 96], base: [150, 150, 141],
    cells: 2.2, softPx: 10, bead: false, landCoverage: 34,
  },
};

/** 按预设直接出图（省得每个调用点都抄一遍参数） */
export function presetTexture(size, preset = 'clay', over = {}) {
  const p = PRESETS[preset] ?? PRESETS.clay;
  const opts = { ...p, ...over };
  return blotchTexture(size, opts);
}

/* ────────────────────────── 低模岛 + 贴上贴图 ────────────────────────── */

/**
 * 生成一座"扇形三角化"的低模岛（跟片子 f012 的线框一致：
 * 每个面从中心点向环上两点连线，边长 40–90px@640）。
 */
export function fanIsland({ radius = 150, rings = 3, seed = 7, cx = 0, cy = 0 } = {}) {
  const rnd = (i) => hash2(i, Math.floor(i / 7), seed);
  const pts = [{ x: cx, y: cy }];
  const ringPts = [];
  for (let r = 1; r <= rings; r++) {
    const n = 7 + r * 3;
    const rr = (radius * r) / rings;
    const row = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r * 0.27;
      const wob = 1 + (rnd(r * 31 + k) - 0.5) * 0.22;
      row.push({ x: cx + Math.cos(a) * rr * wob, y: cy + Math.sin(a) * rr * wob * 0.62 });
    }
    ringPts.push(row);
  }
  // 三角：中心 → 内环；内环 → 外环（相邻两点 + 交叉）
  const tris = [];
  const r0 = ringPts[0];
  for (let k = 0; k < r0.length; k++) tris.push([pts[0], r0[k], r0[(k + 1) % r0.length]]);
  for (let r = 1; r < rings; r++) {
    const A = ringPts[r - 1], B = ringPts[r];
    for (let k = 0; k < B.length; k++) {
      const b0 = B[k], b1 = B[(k + 1) % B.length];
      const a0 = A[Math.floor((k * A.length) / B.length) % A.length];
      tris.push([a0, b0, b1]);
    }
  }
  return { tris, center: pts[0], rings: ringPts };
}

export function islandPath(ctx, island) {
  const outer = island.rings[island.rings.length - 1];
  ctx.beginPath();
  outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * 纹理模式：把贴图按 UV 铺在岛上，用岛轮廓 clip。
 * 关键：**不按面填色**，所以三角面完全看不见 → 这就是"hide the polys"。
 */
export function paintTextured(ctx, island, tex, { box }) {
  ctx.save();
  islandPath(ctx, island);
  ctx.clip();
  ctx.drawImage(tex, box.x, box.y, box.w, box.h);
  ctx.restore();
}

/**
 * 对照模式：按面填色（flat）。取每个三角重心的贴图颜色 —— 片子里的低模一旦这样画，
 * 三角面立刻全部暴露，正好用来证明①。
 */
export function paintFlat(ctx, island, tex, { box }) {
  const tctx = tex.getContext('2d');
  const S = tex.width;
  const tdata = tctx.getImageData(0, 0, S, S).data;
  for (const [a, b, c] of island.tris) {
    const gx = (a.x + b.x + c.x) / 3, gy = (a.y + b.y + c.y) / 3;
    const u = clamp((gx - box.x) / box.w, 0, 1), v = clamp((gy - box.y) / box.h, 0, 1);
    const i = ((v * (S - 1)) | 0) * S * 4 + (((u * (S - 1)) | 0) * 4);
    ctx.fillStyle = `rgb(${tdata[i]},${tdata[i + 1]},${tdata[i + 2]})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    ctx.closePath(); ctx.fill();
  }
}


/**
 * 反测：边界粗糙度（扇贝鼓包的起伏 rms）。
 *
 * 为什么不用"周期"：色斑外沿是一条弯曲的长边界，沿 x 一条条取"第一处穿越"会在
 * 两块色斑之间跳（我量到过 y 从 20 直接跳到 204），自相关因此被弧长不均带偏 ——
 * 参数设 3.8px，量出来 8px。所以反测量**起伏幅度**（这个稳），周期只作为设计参数报。
 */
export function measureEdgeRoughness(canvas, x0, x1, y0, y1) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width;
  const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const bw = x1 - x0, bh = y1 - y0;
  const isBlotch = (x, y) => d[(y * bw + x) * 4] - d[(y * bw + x) * 4 + 1] > 34;
  const prof = [];
  for (let y = 1; y < bh - 1; y++) {
    // 方向不预设：色斑在左还是在右都行，取"第一个与左端不同的像素"。
    // 第一版写死"非色斑→色斑"，遇到色斑在左侧的裁切就一行都取不到（只拿到 12 行）。
    const start = isBlotch(2, y);
    for (let x = 3; x < bw - 1; x++) {
      if (isBlotch(x, y) !== start) { prof.push(x); break; }
    }
  }
  if (prof.length < bh * 0.5) return { rms: null, n: prof.length };
  const R = 4, res = [];
  for (let i = 0; i < prof.length; i++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - R); k <= Math.min(prof.length - 1, i + R); k++) { s += prof[k]; n++; }
    res.push(prof[i] - s / n);
  }
  const rms = Math.sqrt(res.reduce((a, v) => a + v * v, 0) / res.length);
  let flips = 0, prev = 0;
  for (let i = 1; i < res.length; i++) {
    const dv = res[i] - res[i - 1];
    if (Math.abs(dv) < 0.08) continue;
    const sg = Math.sign(dv);
    if (prev && sg !== prev) flips++;
    prev = sg;
  }
  return { rms: +rms.toFixed(2), n: prof.length, bumps: Math.round(flips / 2), period: flips > 3 ? +((2 * (prof.length)) / flips).toFixed(1) : null };
}

/**
 * 反测：量笔触的扇贝周期。（保留，但在弯曲长边界上不稳，见 measureEdgeRoughness）
 *
 * 第一版用"水平扫描线上的穿越次数"，量出来 19.5px（真实≈4px）—— 因为一条线只
 * 在边界大致水平时才反复穿越，剩下的穿越是两块色斑之间的空档，全混在一起了。
 * 改成**沿边界走**：对每个 x 取"从 y0 往下第一处色斑→非色斑"的 y，得到边界曲线
 * y(x)，减去滑动均值去趋势，数导数变号次数 = 鼓包数。
 *
 * 返回 {period, bumps, rms, span}；|rms| 太小（边界是直的）就返回 period=null。
 */
export function measureBeadPeriod(canvas, y0 = 8, y1 = null) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width, H = canvas.height;
  y1 = y1 ?? H - 9;
  const d = ctx.getImageData(0, 0, W, H).data;
  const isBlotch = (x, y) => d[(y * W + x) * 4] - d[(y * W + x) * 4 + 1] > 34;

  const xs = [], ys = [];
  for (let x = 0; x < W; x++) {
    for (let y = y0; y <= y1 - 1; y++) {
      if (isBlotch(x, y) && !isBlotch(x, y + 1)) { xs.push(x); ys.push(y); break; }
    }
  }
  if (xs.length < W * 0.4) return { period: null, bumps: 0, rms: 0, span: 0 };

  // 去趋势（滑动均值）。窗口必须比鼓包还窄：第一版 R=12（25px）直接把 4px 的鼓包抹平，
  // 量出来 11.9px —— 窗口宽了不是"更稳"，是把要量的东西滤掉了。
  const R = 3, res = [];
  for (let i = 0; i < ys.length; i++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - R); k <= Math.min(ys.length - 1, i + R); k++) { s += ys[k]; n++; }
    res.push(ys[i] - s / n);
  }
  const rms = Math.sqrt(res.reduce((a, v) => a + v * v, 0) / res.length);
  if (rms < 0.4) return { period: null, bumps: 0, rms: +rms.toFixed(2), span: xs.length };

  // 自相关找第一个局部峰 —— 数导数变号会被 ±0.5px 的量化噪声骗（一像素抖一次）。
  const acf = [];
  for (let lag = 1; lag <= 20; lag++) {
    let s = 0, n = 0;
    for (let i = 0; i + lag < res.length; i++) { s += res[i] * res[i + lag]; n++; }
    acf.push(s / Math.max(n, 1));
  }
  const a0 = acf[0] || 1;
  let period = null, bestLag = 0;
  for (let i = 1; i < acf.length - 1; i++) {
    if (acf[i] > acf[i - 1] && acf[i] >= acf[i + 1] && acf[i] > 0.15 * a0) {
      period = acf[i]; bestLag = i + 1; break;
    }
  }
  const span = xs[xs.length - 1] - xs[0];
  return {
    period: bestLag || null,
    bumps: bestLag ? Math.round(span / bestLag) : 0,
    rms: +rms.toFixed(2), span,
  };
}
