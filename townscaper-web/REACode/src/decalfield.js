/**
 * decalfield.js — 贴花不是"贴上去一层"就完事：它是**每帧继续往上叠**，所以会长出抖动（boil）。
 *
 * 1427721874490933250（2021-08-17，texture）
 *   "Here's a very quick technical test. Though this one is continuously adding decals,
 *    so it looks a bit like claymation or line boil. Might be softer than what I'd be
 *    going for, but it was an easy style to throw together. And obviously you'd need
 *    some padding for the seams."
 *
 * ---- 画面观察（24 帧总览，512²；镜头不动） ----
 *   · 前 8 帧：黄绿地面上铺着一片灰紫色的小方块，**明显是格子里的**，块与块之间留黄缝；
 *   · 换算下来每块 ≈ 34px（512 画布），格子步距 ≈ 40px —— 贴花是**按格**贴的，不是撒点；
 *   · 12 帧之后同一片地面上的块变细、变碎，位置也在挪 —— 因为每帧都在加新的、旧的没删；
 *   · 镜头没动，画面却在"呼吸"：这就是他说的 claymation / line boil。
 *
 * ---- 为什么"持续加"会 boil，而不是越叠越黑 ----
 * 因为每张新贴花都带**自己的随机相位**（位置、角度、软硬边、不透明度）。新的一张压上去，
 * 只改掉它自己覆盖的那几十个像素；整片区域的颜色分布却在慢慢换人。于是
 * "静止的相机 + 静止的几何"仍然每秒都有 x% 的像素在变 —— 抖动量由一个旋钮控制：
 * 每帧加多少张（rate）和每张抖多少（jitter）。
 *
 * ---- 原文最后那句 "you'd need some padding for the seams" 是本文件的重点 ----
 * 按格贴就必然踩到接缝：一张贴花被裁在格子边界上，边界外侧什么都没有，
 * 于是相邻两格各自裁一刀 → 边界上出现一条**亮度阶跃**（比格子内部的梯度大得多）。
 * 修法不是"把贴花挪进格子里"（那会露出整齐的缝），而是**每格多画 pad 个像素的出血**：
 * 贴花照旧越过边界，只是画到邻居的地盘上一点，边界两侧的覆盖率因此连续。
 * `seamStep()` 就是把这条阶跃量出来：边界列的平均梯度 vs 内部列的平均梯度。
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 一张贴花的"笔刷"：不规则软斑。
 *
 * 原作是手绘的贴花图集；这里用极坐标上的噪声轮廓生成，理由是量参数时只关心
 * "边缘有多软、覆盖多大"，不关心花纹。边缘硬度 `edge` 直接对应观感：
 * edge→1 是硬边色块（前 8 帧那种），edge→0 是一团雾（12 帧之后那种）。
 */
export function makeStamp(size = 64, { edge = 0.62, seed = 7, lobes = 7, shape = 'square' } = {}) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2, R = size / 2;
  g.beginPath();
  if (shape === 'square') {
    // 片子里那批贴花是**小方块**（512 画布里约 34px，格距 40px），不是圆斑。
    // 所以笔刷也做成"四条边各带两个抖动点的方片"：近看是方，远看边缘不机械。
    const k = 0.94;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    let first = true;
    for (let e = 0; e < 4; e++) {
      const a = corners[e], b = corners[(e + 1) % 4];
      for (let t = 0; t <= 2; t++) {
        const f = t / 2;
        const jx = (1 - Math.abs(f - 0.5) * 2) * (rnd() - 0.5) * 0.22;
        const jy = (1 - Math.abs(f - 0.5) * 2) * (rnd() - 0.5) * 0.22;
        const x = cx + ((a[0] * (1 - f) + b[0] * f) + jx) * R * k;
        const y = cy + ((a[1] * (1 - f) + b[1] * f) + jy) * R * k;
        if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
      }
    }
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    // 边缘软硬：edge=1 硬边色块（前 8 帧），edge→0 用两次模糊把边糊掉（12 帧之后那种）
    const px = (1 - edge) * 7;
    if (px > 0.4 && 'filter' in g) {
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = size;
      const tg = tmp.getContext('2d');
      tg.filter = `blur(${px.toFixed(2)}px)`;
      tg.drawImage(c, 0, 0);
      g.clearRect(0, 0, size, size);
      g.drawImage(tmp, 0, 0);
    }
    return c;
  }
  const n = lobes + 2;
  const radii = Array.from({ length: n }, () => 0.62 + rnd() * 0.38);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const t = ((a / (Math.PI * 2)) * n) % n;
    const i0 = Math.floor(t), f = t - i0;
    const r = radii[i0] * (1 - f) + radii[(i0 + 1) % n] * f;
    const px = cx + Math.cos(a) * R * r, py = cy + Math.sin(a) * R * r;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  // 用径向渐变做边缘软硬：edge=1 时几乎一路实到边缘，edge=0 时从中心就开始掉
  const grd = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(Math.max(0.05, edge * 0.92), 'rgba(255,255,255,0.92)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fill();
  return c;
}

/**
 * 逐格贴花场。
 *
 * 坐标系是**世界格子坐标**（cols × rows 个 tile），每格边长 tilePx。
 * 每帧 `step()` 往场上加 rate 张新贴花；所有贴花都存在数组里（不删），
 * 渲染时按 `render()` 里给的 pad 决定"画到格子外面多少"。
 */
export class DecalField {
  constructor({
    cols = 8, rows = 6, tilePx = 64,
    seed = 1427721, edge = 0.62, stampSize = 96,
    jitter = 0.09, rate = 3, scale = 0.55,
    palette = ['#8b8798', '#a09aad', '#7d7a8c', '#b3adba'],
    background = '#d8d27a',
  } = {}) {
    this.cols = cols; this.rows = rows; this.tilePx = tilePx;
    this.w = cols * tilePx; this.h = rows * tilePx;
    this.rnd = mulberry32(seed);
    this.stamp = makeStamp(stampSize, { edge, seed });
    this.stampSize = stampSize;
    this.decals = [];
    this.jitter = jitter;
    this.rate = rate;
    this.scale = scale;
    this.palette = palette;
    this.background = background;
    this.frame = 0;
    this.addedTotal = 0;
  }

  /** 加一张贴花。位置是按"格内相对坐标"存的，格子变了它也跟着走 —— 这才是"贴在格上"。 */
  add(n = 1) {
    for (let k = 0; k < n; k++) {
      const cell = Math.floor(this.rnd() * this.cols * this.rows);
      const cx = cell % this.cols, cz = Math.floor(cell / this.cols);
      this.decals.push({
        cx, cz,
        u: this.rnd(), v: this.rnd(),                       // 格内 0..1
        rot: this.rnd() * Math.PI * 2,
        size: this.stampSize * this.scale * (0.6 + this.rnd() * 0.8),
        alpha: 0.28 + this.rnd() * 0.42,
        color: this.palette[Math.floor(this.rnd() * this.palette.length)],
        seed: this.rnd(),
      });
      this.addedTotal++;
    }
  }

  /** 一帧：加 rate 张，然后让每张"微抖"一下 —— 抖的是贴花自己的局部量，不是整幅图。 */
  step() {
    this.frame++;
    this.add(this.rate);
    const j = this.jitter;
    for (const d of this.decals) {
      d.u = clamp01(d.u + (this.rnd() - 0.5) * j * 0.35);
      d.v = clamp01(d.v + (this.rnd() - 0.5) * j * 0.35);
      d.rot += (this.rnd() - 0.5) * j * 1.2;
      d.size *= 1 + (this.rnd() - 0.5) * j * 0.5;
      d.alpha = clamp01(d.alpha + (this.rnd() - 0.5) * j * 0.5);
    }
  }

  /**
   * 画出来。`pad` 就是原文那句 padding：贴花允许画到格子边界外多少像素。
   *
   * pad = 0 时每格先 clip 到自己的矩形再画 → 边界外面什么都没盖住，
   * 相邻两格各自裁一刀，接缝上留下一条硬边（正好是原文说"obviously you'd need"的原因）。
   */
  render(ctx, { pad = 0, showSeams = false } = {}) {
    const { tilePx, cols, rows } = this;
    ctx.save();
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.w, this.h);
    for (const d of this.decals) {
      const cx = d.cx * tilePx, cz = d.cz * tilePx;
      if (pad > 0) {
        // 出血版：不裁，只把绘制中心留在格内，笔刷自然压到邻居身上
        this._blit(ctx, cx + d.u * tilePx, cz + d.v * tilePx, d);
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cz, tilePx, tilePx);
        ctx.clip();
        this._blit(ctx, cx + d.u * tilePx, cz + d.v * tilePx, d);
        ctx.restore();
      }
    }
    if (showSeams) {
      ctx.strokeStyle = 'rgba(255,80,80,.55)';
      ctx.lineWidth = 1;
      for (let i = 1; i < cols; i++) {
        ctx.beginPath(); ctx.moveTo(i * tilePx + 0.5, 0); ctx.lineTo(i * tilePx + 0.5, this.h); ctx.stroke();
      }
      for (let j = 1; j < rows; j++) {
        ctx.beginPath(); ctx.moveTo(0, j * tilePx + 0.5); ctx.lineTo(this.w, j * tilePx + 0.5); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * 染色笔刷：白笔刷 + source-in 染成贴花色，缓存起来。
   *
   * 第一版直接在主画布上做 `destination-in` —— 那是全局合成操作，
   * 它把**整张画布**上笔刷覆盖不到的像素全擦掉了（画面直接变成一片均匀灰）。
   * 染色必须发生在离屏的小画布上，主画布只做 drawImage。
   */
  _tinted(color) {
    this._cache = this._cache || new Map();
    if (this._cache.has(color)) return this._cache.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = this.stampSize;
    const g = c.getContext('2d');
    g.drawImage(this.stamp, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this._cache.set(color, c);
    return c;
  }

  _blit(ctx, x, y, d) {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    ctx.translate(x, y);
    ctx.rotate(d.rot);
    const img = this._tinted(d.color);
    ctx.drawImage(img, -d.size / 2, -d.size / 2, d.size, d.size);
    ctx.restore();
  }
}

/* ------------------------------------------------------------ 量测 */

/** 两帧之间的差异（0..255 平均差 + 变动像素占比）。boil 的大小。 */
export function boil(a, b) {
  const w = a.width, h = a.height;
  const da = a.getContext('2d').getImageData(0, 0, w, h).data;
  const db = b.getContext('2d').getImageData(0, 0, w, h).data;
  let sum = 0, moved = 0, n = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
    sum += d; if (d > 6) moved++; n++;
  }
  return { mean: sum / n, movedPct: (moved / n) * 100 };
}

/**
 * 接缝可见度：格子边界那一列的**水平梯度**，比（远离边界的）内部列大多少。
 *
 * 比值 ≈ 1 说明边界和内部一样平滑（看不见接缝）；> 2 就是能看见一条线。
 * 只量竖直方向的边界列，内部列取"离任何边界都 ≥ 8px"的列做基准。
 */
export function seamStep(canvas, { tilePx, cols, rows } = {}) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = (x, y) => {
    const i = (y * w + x) * 4;
    return 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  };
  const gradX = (x, y) => Math.abs(lum(x + 1, y) - lum(x - 1, y));
  const boundary = [];
  for (let i = 1; i < cols; i++) boundary.push(i * tilePx);
  const inner = [];
  for (let x = 10; x < w - 10; x++) {
    if (boundary.some((b) => Math.abs(b - x) < 10)) continue;
    inner.push(x);
  }
  let gb = 0, nb = 0, gi = 0, ni = 0;
  for (let y = 4; y < h - 4; y++) {
    for (const x of boundary) { gb += gradX(x, y); nb++; }
    for (const x of inner) { gi += gradX(x, y); ni++; }
  }
  const b = gb / Math.max(1, nb), i2 = gi / Math.max(1, ni);
  return { boundaryGrad: b, innerGrad: i2, ratio: b / Math.max(1e-6, i2) };
}

/**
 * 一轮完整测量：
 *   · boil  —— 相邻两帧之间有多少像素在动（= 他说的 claymation 手感）
 *   · seam  —— pad=0 与 pad=2 时的边界梯度比（= "you'd need some padding"）
 *   · cover —— 贴花覆盖了地面的多少（太低就是"撒了几点"，不是铺面）
 */
export function audit({ frames = 12, pad = 2, cols = 8, rows = 6, tilePx = 64, jitter = 0.09, rate = 3 } = {}) {
  const field = new DecalField({ cols, rows, tilePx, jitter, rate });
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = field.w; c.height = field.h;
    return c;
  };
  const a = mk(), b = mk();
  const ctxA = a.getContext('2d'), ctxB = b.getContext('2d');

  field.render(ctxA, { pad });
  const diffs = [];
  for (let f = 0; f < frames; f++) {
    const prev = mk(); prev.getContext('2d').drawImage(a, 0, 0);
    field.step();
    field.render(ctxB, { pad });
    diffs.push(boil(prev, b));
    ctxA.clearRect(0, 0, field.w, field.h);
    ctxA.drawImage(b, 0, 0);
  }

  const seamPadded = seamStep(a, { tilePx, cols, rows });
  // 同一批贴花再画一遍，pad=0
  const c0 = mk();
  const f0 = new DecalField({ cols, rows, tilePx, jitter: 0, rate: 0 });
  f0.decals = field.decals.map((d) => ({ ...d }));
  f0.render(c0.getContext('2d'), { pad: 0 });
  const seamRaw = seamStep(c0, { tilePx, cols, rows });

  const d = a.getContext('2d').getImageData(0, 0, field.w, field.h).data;
  let covered = 0;
  for (let i = 0; i < d.length; i += 4) {
    // 与背景色的距离当作"这像素被盖住了"
    const dr = d[i] - 216, dg = d[i + 1] - 210, db = d[i + 2] - 122;
    if (dr * dr + dg * dg + db * db > 900) covered++;
  }

  return {
    frames: diffs.length,
    boilMean: diffs.reduce((s, x) => s + x.mean, 0) / diffs.length,
    boilMovedPct: diffs.reduce((s, x) => s + x.movedPct, 0) / diffs.length,
    boilSeries: diffs.map((x) => +x.movedPct.toFixed(2)),
    seamRaw, seamPadded,
    coverPct: (covered / (field.w * field.h)) * 100,
    decals: field.decals.length,
    size: [field.w, field.h],
  };
}

export { mulberry32 };
