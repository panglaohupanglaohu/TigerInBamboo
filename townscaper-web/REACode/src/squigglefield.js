/**
 * squigglefield.js —— 花纹不是画出来的笔触，是几个胶囊的距离场；歪扭和动画都在场里加。
 *
 * 帖子 ID：1105131621391495176（2019-03-11，tools，badnorth）
 *
 *   "Squiggly distance fields, now with animation!
 *    Versatile, flexible, but quite laborious"
 *
 * ---- 画面观察（6 帧，512²；灰底上一枚"Victory"卷草纹牌匾） ----
 *   · 主体是一块**中间牌匾 + 左右卷草 + 上下对称小饰件**的对称版式，
 *     左右、上下都是镜像关系：把画面上半左半叠到下半右半基本重合；
 *   · 线条不是均匀的钢笔线：同一条边一路粗细在变、边缘在抖，像手绘；
 *   · 帧与帧之间**形状没换、轮廓在爬**：卷草的边缘一点点蠕动，牌匾面上有一道
 *     从左扫到右的浅色反光。也就是说这不是关键帧序列，是一个在场里跑的参数；
 *   · 灰色是低对比的纸面质感，墨是同一色相压暗，没有描边色差。
 *
 * ---- 为什么用距离场，而不是把卷草描成贝塞尔 ----
 * 描路径的问题：粗细一变、缩放一改、要镜像、要动画，就得重画四条曲线；
 * 而这枚牌匾在游戏里要出现在不同尺寸的横幅上，还要"活着"动。
 * 把每段线写成胶囊（线段 + 半径），只保留**右上四分之一**的图元，
 * 取场时把坐标折到 |x|,|y|，上下左右镜像免费得到；
 * "歪扭"就是在距离上加两个不同方向的低频正弦，"动画"就是推这两个正弦的相位 ——
 * 形状本身一秒都没改，改的只是"这条边此刻在哪"。
 * 代价正是原文那句 laborious：卷草要一段段摆胶囊，摆歪一眼能看出来。
 *
 * 渲染走"每像素查场"，但用 16px 桶缓存候选图元，逐像素只算 2~3 个胶囊。
 */

// ---------- 图元：胶囊（round-capped segment） ----------

export const seg = (x0, y0, x1, y1, r) => ({ x0, y0, x1, y1, r });

/** 阿基米德式对数螺旋，拆成 n 段胶囊 —— 卷草就是这么一段段摆出来的 */
export function spiral(cx, cy, r0, r1, a0, a1, n, r) {
  const out = [];
  let px = cx + r0 * Math.cos(a0);
  let py = cy + r0 * Math.sin(a0);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const rr = r0 * Math.pow(r1 / r0, k);
    const a = a0 + (a1 - a0) * k;
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    out.push(seg(px, py, x, y, r));
    px = x; py = y;
  }
  return out;
}

const distSeg = (px, py, x0, y0, x1, y1) => {
  const vx = x1 - x0, vy = y1 - y0;
  const wx = px - x0, wy = py - y0;
  const L = vx * vx + vy * vy;
  let t = L > 1e-12 ? (wx * vx + wy * vy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = wx - vx * t, dy = wy - vy * t;
  return Math.sqrt(dx * dx + dy * dy);
};

// ---------- 一朵花纹：只在 u≥0, v≥0 象限摆一遍 ----------

/**
 * 版式（世界单位，牌匾半宽 0.30 / 半高 0.085）：
 *   牌匾双线框 → 两端竖梃 → 左右大卷草 → 四角小卷草 → 牌匾上下的翼形与小破折号。
 * 上下镜像靠折坐标，所以只写上半。
 */
export function buildOrnament() {
  const P = [];
  const W = 0.30, H = 0.085;      // 牌匾半宽 / 半高
  const fr = 0.014;               // 外框半径（线的粗细）

  // 双线框上半：顶边、右上角、右边一半
  P.push(seg(0, H, W - fr, H, fr));
  P.push(seg(W, H - fr, W, 0, fr));
  P.push(seg(0, H - 0.026, W - 0.026, H - 0.026, 0.006));

  // 两端竖梃：让牌匾两端像被夹住
  P.push(seg(W + 0.004, 0, W + 0.004, 0.052, 0.020));
  P.push(seg(W + 0.030, 0, W + 0.030, 0.038, 0.008));

  // 左右大卷草：从竖梃伸出，卷一圈半
  P.push(seg(W + 0.030, 0, 0.395, 0, 0.012));
  P.push(...spiral(0.415, 0.012, 0.082, 0.020, Math.PI * 0.5, Math.PI * 0.5 - 1.55 * Math.PI, 18, 0.012));

  // 四角小卷草（只在右上，折坐标后自动四份）
  P.push(seg(0.215, 0.10, 0.215, 0.135, 0.010));
  P.push(...spiral(0.240, 0.155, 0.048, 0.012, Math.PI * 1.15, Math.PI * 1.15 + 1.35 * Math.PI, 14, 0.010));

  // 牌匾上方的翼形：两条折线 + 一枚小菱形
  P.push(seg(0.012, H + 0.020, 0.052, H + 0.058, 0.011));
  P.push(seg(0.052, H + 0.058, 0.104, H + 0.030, 0.011));
  P.push(seg(0.104, H + 0.030, 0.104, H + 0.010, 0.008));
  P.push(seg(0.0, H + 0.012, 0.0, H + 0.046, 0.007));      // 中缝短柱
  P.push(seg(0.132, H + 0.062, 0.132, H + 0.062, 0.013));  // 点
  P.push(seg(0.176, H + 0.040, 0.176, H + 0.040, 0.009));

  // 破折号：斜着撒几笔，角度各不相同（手摆的，别循环算）
  P.push(seg(0.150, H + 0.012, 0.176, H + 0.028, 0.006));
  P.push(seg(0.196, H + 0.020, 0.222, H + 0.032, 0.006));
  P.push(seg(0.238, H + 0.058, 0.238, H + 0.076, 0.006));
  P.push(seg(0.272, H + 0.045, 0.272, H + 0.062, 0.005));

  return P;
}

// ---------- 场的求值 ----------

/** 折到第一象限：四折镜像全在这里发生 */
export function fold(x, y) {
  return [x < 0 ? -x : x, y < 0 ? -y : y];
}

/**
 * 有符号距离（<0 在墨里）。wob 是歪扭：两个不同方向的低频正弦，
 * 相位 t 一推，边缘就沿着自己法线爬 —— 这就是"now with animation"。
 */
export function sdfAt(P, x, y, opt = {}) {
  const amp = opt.amp ?? 0.010;
  const freq = opt.freq ?? 19;
  const t = opt.t ?? 0;
  const [u, v] = fold(x, y);

  let d = 1e9;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const di = distSeg(u, v, p.x0, p.y0, p.x1, p.y1) - p.r;
    if (di < d) d = di;
  }
  if (amp === 0) return d;

  // A 波沿 35° 走，B 波沿 -20°，两个频率不同 → 不会退化成规整的波纹
  const a1 = 0.62, a2 = -0.35;
  const w1 = Math.sin((u * Math.cos(a1) + v * Math.sin(a1)) * freq * 2 * Math.PI + t * 2.1);
  const w2 = Math.sin((u * Math.cos(a2) + v * Math.sin(a2)) * freq * 3.7 * Math.PI - t * 3.3);
  return d - amp * (0.66 * w1 + 0.34 * w2);
}

// ---------- 16px 桶：逐像素只碰 2~3 个图元 ----------

export function bakeBuckets(P, worldW, worldH, cell) {
  const nx = Math.ceil(worldW / cell), ny = Math.ceil(worldH / cell);
  const buckets = Array.from({ length: nx * ny }, () => []);
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const pad = p.r + 0.03;      // 留出歪扭的余量，别在桶边界上截断
    const x0 = Math.min(p.x0, p.x1) - pad, x1 = Math.max(p.x0, p.x1) + pad;
    const y0 = Math.min(p.y0, p.y1) - pad, y1 = Math.max(p.y0, p.y1) + pad;
    const bx0 = Math.max(0, Math.floor(x0 / cell)), bx1 = Math.min(nx - 1, Math.floor(x1 / cell));
    const by0 = Math.max(0, Math.floor(y0 / cell)), by1 = Math.min(ny - 1, Math.floor(y1 / cell));
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) buckets[by * nx + bx].push(i);
    }
  }
  return { nx, ny, cell, buckets };
}

/** 单点求值：只查自己那个桶里的图元（桶外按最近的桶兜底） */
export function sdfBucketed(P, bk, x, y, opt) {
  const [u, v] = fold(x, y);
  const bx = Math.min(bk.nx - 1, Math.max(0, Math.floor(u / bk.cell)));
  const by = Math.min(bk.ny - 1, Math.max(0, Math.floor(v / bk.cell)));
  const list = bk.buckets[by * bk.nx + bx];
  const amp = opt.amp ?? 0.010, freq = opt.freq ?? 19, t = opt.t ?? 0;

  let d = 1e9;
  for (let k = 0; k < list.length; k++) {
    const p = P[list[k]];
    const di = distSeg(u, v, p.x0, p.y0, p.x1, p.y1) - p.r;
    if (di < d) d = di;
  }
  if (d > 0.09) return d;        // 离墨很远就不必算歪扭，省时间
  if (amp === 0) return d;
  const a1 = 0.62, a2 = -0.35;
  const w1 = Math.sin((u * Math.cos(a1) + v * Math.sin(a1)) * freq * 2 * Math.PI + t * 2.1);
  const w2 = Math.sin((u * Math.cos(a2) + v * Math.sin(a2)) * freq * 3.7 * Math.PI - t * 3.3);
  return d - amp * (0.66 * w1 + 0.34 * w2);
}

// ---------- 着色：一张灰度纸 + 墨 + 扫光 ----------

/**
 * 返回 RGBA 像素；sweep<0 关掉扫光。
 * 三轮"色调"全部由 d 推出来：芯、墨、纸，加一条 r 外的浅浮雕。
 */
export function shade(P, bk, w, h, view, opt = {}) {
  const { cx, cy, scale } = view;          // 世界→像素：px = cx + x*scale
  const img = new Uint8ClampedArray(w * h * 4);
  const pxWorld = 1 / scale;
  const amp = opt.amp ?? 0.010, freq = opt.freq ?? 19, t = opt.t ?? 0;
  const sweep = opt.sweep ?? -1;

  for (let y = 0; y < h; y++) {
    const wy = (y - cy) / scale;
    for (let x = 0; x < w; x++) {
      const wx = (x - cx) / scale;
      const d = sdfBucketed(P, bk, wx, wy, { amp, freq, t });

      // 纸面：极淡的斜向噪纹，纯为了不像塑料
      const grain = 0.985 + 0.015 * Math.sin((x * 1.7 + y * 2.3) * 0.9);
      let r = 222 * grain, g = 226 * grain, b = 225 * grain;

      // 墨：d=0 处覆盖 1，抗锯齿宽度 = 1 像素
      const cov = 0.5 - d / pxWorld;
      if (cov > 0) {
        const a = cov > 1 ? 1 : cov;
        // 越往芯里越暗一点，读起来像压下去的凹版
        const core = d < -0.006 ? 1 : 1 - (-d - 0.006 > 0 ? 0 : 0);
        const ink = 46 - 10 * core;
        r = r * (1 - a) + ink * a;
        g = g * (1 - a) + (ink + 8) * a;
        b = b * (1 - a) + (ink + 12) * a;
      } else if (d < 0.010) {
        // 线外一圈浅浮雕高光
        const a = (1 - d / 0.010) * 0.35;
        r = r * (1 - a) + 246 * a;
        g = g * (1 - a) + 249 * a;
        b = b * (1 - a) + 248 * a;
      }

      // 扫光：一道斜着走的亮带，只在墨上明显
      if (sweep >= 0) {
        const s = (wx * 0.9 + wy * 0.35) - sweep;
        const band = Math.exp(-(s * s) / 0.0016);
        const onInk = cov > 0 ? 0.42 : 0.10;
        const a = band * onInk;
        r = r * (1 - a) + 255 * a;
        g = g * (1 - a) + 255 * a;
        b = b * (1 - a) + 253 * a;
      }

      const o = (y * w + x) * 4;
      img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = 255;
    }
  }
  return img;
}

// ---------- 量：歪扭到底改变了什么 ----------

/**
 * 单边探针：一条已知的横线（半径 0.014），量歪扭到底把它推了多远。
 *
 * 为什么不用"整枚花纹的边界像素数"：
 *   上一版拿"每行最左边那道墨"做探针，量出来 60px 的假位移——
 *   花纹的卷草边缘接近竖直，横向挪 1px 就能换一段切线，探针自己先崩了。
 *   要量"边在抖"，就得选一条**法线方向确定**的边，所以这里单独摆一条横线，
 *   沿列解 sdf=0 的零点（二分），得到边缘高度剖面 y(x)。
 *   然后 RMS / 最大偏移 / 弧长比（波浪线比直线长多少）三个数全从这个剖面来。
 */
export function probeEdge(opt = {}, scale = 760) {
  const edge = [seg(-0.30, 0, 0.30, 0, 0.014)];
  const cols = 320;
  const span = 0.60, x0 = -0.30;
  const ys = [];
  for (let i = 0; i < cols; i++) {
    const x = x0 + (span * i) / (cols - 1);
    // 沿 y 从 +0.06 往下找 sdf 穿零（上边沿）
    let lo = 0.06, hi = 0.0005;
    for (let k = 0; k < 26; k++) {
      const mid = (lo + hi) / 2;
      if (sdfAt(edge, x, mid, opt) > 0) lo = mid; else hi = mid;
    }
    ys.push((lo + hi) / 2);
  }
  const base = 0.014;                       // amp=0 时上边沿应在 y=+r
  let s2 = 0, max = 0;
  for (const y of ys) { const e = Math.abs(y - base); s2 += e * e; max = Math.max(max, e); }
  let arc = 0;
  const dx = span / (cols - 1);
  for (let i = 1; i < cols; i++) arc += Math.hypot(dx, ys[i] - ys[i - 1]);
  return {
    rmsPx: Math.sqrt(s2 / cols) * scale,
    maxPx: max * scale,
    arcRatio: arc / span,                   // 直线 = 1
    wavelengthPx: scale / Math.max(1, opt.freq ?? 18),
    cols,
  };
}

/** 墨量占比：粗网格采样（240×140 够用），用来证明"相位在动、形状没换" */
export function inkShare(P, bk, view, opt = {}, gw = 240, gh = 140) {
  const { cx, cy, scale } = view;
  const pw = (view.w || 880) / gw, ph = (view.h || 520) / gh;
  let inside = 0;
  for (let j = 0; j < gh; j++) {
    const wy = ((gh - 0.5 - j) * ph - cy) / scale;
    for (let i = 0; i < gw; i++) {
      const wx = ((i + 0.5) * pw - cx) / scale;
      if (sdfBucketed(P, bk, wx, wy, opt) < 0) inside++;
    }
  }
  return (100 * inside) / (gw * gh);
}

/** 控制台里快速看轮廓（不需要 canvas / 浏览器） */
export function ascii(P, w, h, view, opt = {}) {
  const { cx, cy, scale } = view;
  const lines = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    const wy = ((h - 1 - y) - cy) / scale;
    for (let x = 0; x < w; x++) {
      const wx = (x - cx) / scale;
      const d = sdfAt(P, wx, wy, opt);
      row += d < -0.004 ? '#' : d < 0.004 ? '+' : ' ';
    }
    lines.push(row);
  }
  return lines.join('\n');
}
