/**
 * bloodfield.js — 地面血迹是**一层层叠上去的密度场**，不是贴一张图。
 *
 * 原文（912691357440978945, 2018-11-14）："Long time no combat gifs"
 *   —— 只有一句话，没有任何实现描述。所以这条的全部依据是画面。
 *
 * 画面观察（400×400, 23.3s, 24 帧全看）：
 *   · 岛是淡紫灰的岩台（量到 (157,145,160)），血迹是**偏紫的暗红**，不是正红。
 *   · 血迹不是均匀一片：有很深的核（量到 (59,18,72)）、中间过渡 (128,80,112)、
 *     和几乎看不出来的浅边。也就是说它是**密度**而不是"贴花开启了/关闭了"。
 *   · 叠加处更深（重叠两滩的地方趋近核色），说明是 **min(1, d1+d2) 式累加**。
 *   · 23 秒里没有任何可见淡出，边缘也没有随时间糊掉 —— 所以默认不衰减，
 *     只做**数量上限淘汰**（否则一场仗打下来整块地都要重画）。
 *
 * 为什么不用"每滩一张贴花 quad 叠着画"：重叠区会露出两层半透明的边界
 * （alpha 叠加是线性混合，两层叠出来比一层深但边界仍是两个圆），而片子里
 * 重叠处是**一团连着的深色块**、边界只有一个。用密度场就没有这个问题 ——
 * 同一块地面只有一个标量，谁叠上来都只是把它加高。
 *
 * 参数来源：三档颜色是从 f018 里直接取的像素，干净地 (157,145,160)、
 * 中间档 (128,80,112)、核心 (59,18,72)；下面 full/gamma 就是把这三点
 * 拟合成 "1 - (1-full)*d^gamma" 的逐通道曲线。d=0.3 时还原中间档，
 * d=1 时还原核心档 —— 两个点解三个通道的 gamma，中间形态是插值，
 * 不是量出来的（片子里量不到密度真值，只能反解）。
 */

export const BLOOD = {
  // 满密度时对地面的乘性因子（核心 59,18,72 ÷ 干净 157,145,160）
  full: [0.376, 0.124, 0.450],
  // 逐通道指数：绿掉得最快（血在紫色调里最先吃掉绿），红/蓝慢（保住"偏紫"）
  gamma: [1.00, 0.62, 0.50],
  // 参考密度：中间档 (128,80,112) 对应 d≈0.3
  midDensity: 0.30,
  // 一滩血 = 1 个主盘 + 若干个卫星点（片子里边缘是碎的，不是干净圆）
  satellites: 7,
  maxStamps: 240,
  edgeSoftness: 1.6, // 主盘衰减指数，越大边缘越硬
};

/** 空地颜色（量自 f018 的岩台）——lab 页和 audit 都用它当基准。 */
export const GROUND = [157, 145, 160];

/**
 * 密度场。只有一张 Float32Array，和地面同尺寸（一格一像素就够用，
 * 真要贴到 3D 地面上就是把它当 UV 采样）。
 */
export class BloodField {
  constructor(w, h, opts = {}) {
    this.w = w;
    this.h = h;
    this.d = new Float32Array(w * h);
    this.cfg = { ...BLOOD, ...opts };
    this.stamps = []; // 环形淘汰用：只记 (cx,cy,r,s) 供 undo/重放
    this.rng = mulberry32(0x5eed);
  }

  clear() {
    this.d.fill(0);
    this.stamps.length = 0;
  }

  /** 往密度场里叠一滩。strength=1 表示满密度的核心。 */
  splat(cx, cy, r, strength = 1) {
    const { w, h, d, cfg } = this;
    const g = cfg.edgeSoftness;
    const x0 = Math.max(0, Math.floor(cx - r * 1.25));
    const x1 = Math.min(w - 1, Math.ceil(cx + r * 1.25));
    const y0 = Math.max(0, Math.floor(cy - r * 1.25));
    const y1 = Math.min(h - 1, Math.ceil(cy + r * 1.25));

    // 主盘：椭圆 + 轻微偏心，避免所有血都是正圆
    const ax = r * (0.82 + this.rng() * 0.4);
    const ay = r * (0.82 + this.rng() * 0.4);
    const rot = this.rng() * Math.PI;
    const ca = Math.cos(rot), sa = Math.sin(rot);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * ca + dy * sa) / ax;
        const v = (-dx * sa + dy * ca) / ay;
        const t = u * u + v * v;
        if (t >= 1) continue;
        const a = strength * Math.pow(1 - t, g);
        const i = y * w + x;
        const nv = d[i] + a;
        d[i] = nv > 1 ? 1 : nv;
      }
    }

    // 卫星点：片子里边缘是碎的（几颗小滴落在主盘外），这也是"看密度不是看圆"的证据
    for (let s = 0; s < cfg.satellites; s++) {
      const ang = this.rng() * Math.PI * 2;
      const dist = r * (0.75 + this.rng() * 0.55);
      const rr = r * (0.06 + this.rng() * 0.16);
      const sx = cx + Math.cos(ang) * dist;
      const sy = cy + Math.sin(ang) * dist * 0.75;
      const ss = Math.max(1, Math.ceil(rr));
      for (let y = Math.max(0, sy - ss | 0); y <= Math.min(h - 1, sy + ss); y++) {
        for (let x = Math.max(0, sx - ss | 0); x <= Math.min(w - 1, sx + ss); x++) {
          const dx = (x - sx) / rr, dy = (y - sy) / rr;
          const t = dx * dx + dy * dy;
          if (t >= 1) continue;
          const i = y * w + x;
          const nv = d[i] + strength * 0.7 * (1 - t);
          d[i] = nv > 1 ? 1 : nv;
        }
      }
    }

    this.stamps.push({ cx, cy, r, strength });
    // 上限淘汰：片子里的血从不淡出，所以淘汰是"挪掉最老的那滩"而不是"淡化"
    while (this.stamps.length > cfg.maxStamps) this.stamps.shift();
    return this;
  }

  at(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  }

  /** 密度 → 逐通道乘性因子。d=0 干净，d=1 核心。 */
  factor(d) {
    const { full, gamma } = this.cfg;
    const t = d <= 0 ? 0 : d > 1 ? 1 : d;
    return [
      1 - (1 - full[0]) * Math.pow(t, gamma[0]),
      1 - (1 - full[1]) * Math.pow(t, gamma[1]),
      1 - (1 - full[2]) * Math.pow(t, gamma[2]),
    ];
  }

  /** 把密度场乘到一块 ImageData 上（原地改）。 */
  applyTo(imgData, skipThreshold = 0.012) {
    const px = imgData.data;
    const { w, h, d } = this;
    for (let i = 0, p = 0; i < d.length; i++, p += 4) {
      const v = d[i];
      if (v <= skipThreshold) continue;
      const f = this.factor(v);
      px[p] = px[p] * f[0];
      px[p + 1] = px[p + 1] * f[1];
      px[p + 2] = px[p + 2] * f[2];
    }
  }

  /** 覆盖率：密度超过阈值的格子占比（这是能跨片子对比的那一个数）。 */
  coverage(threshold = 0.08) {
    let n = 0;
    for (let i = 0; i < this.d.length; i++) if (this.d[i] > threshold) n++;
    return n / this.d.length;
  }

  /** 自检：把三个量到的档位还原出来，跟片子里的像素比。 */
  audit() {
    const fMid = this.factor(this.cfg.midDensity);
    const fCore = this.factor(1);
    const mix = (f) => f.map((k, i) => Math.round(GROUND[i] * k));
    return {
      ground: GROUND,
      mid: mix(fMid),
      core: mix(fCore),
      // 片子里量到的两档，用来算误差
      targetMid: [128, 80, 112],
      targetCore: [59, 18, 72],
      errMid: maxErr(mix(fMid), [128, 80, 112]),
      errCore: maxErr(mix(fCore), [59, 18, 72]),
      coverage: this.coverage(),
      stamps: this.stamps.length,
    };
  }
}

function maxErr(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** 固定种子，重放同一场仗时血迹位置一致（否则两次截图没法做像素差）。 */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 一场仗的落点分布：片子里血集中在**岸边到岛心的那条路上**，
 * 空地（左上岩台）几乎没有。这里把落点按"离路越远概率越低"分布，
 * 不是为了好看，是为了让覆盖率和片子里一样是局部聚集而不是满地都是。
 */
export function scatterFight(field, n, opts = {}) {
  const { w, h } = field;
  const cx = (opts.cx ?? 0.62) * w;
  const cy = (opts.cy ?? 0.70) * h;
  const spread = (opts.spread ?? 0.18) * w;
  for (let i = 0; i < n; i++) {
    // 高斯：Box-Muller，取绝对值防止越界
    const u = Math.max(1e-6, field.rng());
    const v = field.rng();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const x = cx + g * spread;
    const y = cy + g * spread * 0.55;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    field.splat(x, y, w * (0.012 + field.rng() * 0.022), 0.45 + field.rng() * 0.55);
  }
  return field;
}
