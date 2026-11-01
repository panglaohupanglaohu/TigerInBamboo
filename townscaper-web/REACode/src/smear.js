/**
 * smear.js — 轨道相机为什么"该"有拖影，以及它到底值多少像素。
 *
 * 1727315611959865407  "I've shipped two whole games with orbital cameras and not once have I
 *   previously though about adding motion blur smear. What a fool I am."
 *
 * ---- 画面观察（24 帧，640²；相机绕着岛转） ----
 *   · 静止时（frame 0–3）边缘是干净的，没有拖影；
 *   · 转起来之后（frame 19–23），岛的**外缘**糊成一条条，越靠画面中心越清楚；
 *   · 糊的方向是**绕中心转的切向**，不是水平方向 —— 所以这不是普通的"整屏方向模糊"，
 *     是按像素到画面中心的半径做的（v = ω × r）；
 *   · 没有重影/鬼影（不是多帧叠加），是单帧内的一次性拉伸。
 *
 * 有了轨道相机，屏幕上每个点的**每帧位移**是解析的：v = ω × (p − c) × dt。
 * 所以不需要重建"上一帧"再比对，直接从 ω 算，采样几次就够 —— 这也是为什么它便宜。
 *
 * 这个文件做三件可量的事：
 *   1. `velocityField()` —— 每个像素的位移（解析）
 *   2. `smear()`         —— 按位移方向采样 N 次的 CPU 实现（也就顺手量出耗时）
 *   3. `sharpness()`     —— 拖影前后边缘锐度掉了多少（p95 梯度）
 */

/** 像素位移：切向，长度 ∝ 半径。omega 单位 rad/s，dt 单位 s。 */
export function velocityField(w, h, omega, dt = 1 / 60, cx = w / 2, cy = h / 2) {
  const out = new Float32Array(w * h * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = -(y - cy) * omega * dt;
      const dy = (x - cx) * omega * dt;
      const i = (y * w + x) * 2;
      out[i] = dx;
      out[i + 1] = dy;
    }
  }
  return out;
}

/** 半径 r 处的拖影长度（像素）：|ω|·r·dt。用来跟实测的糊宽对表。 */
export function smearLengthPx(omega, r, dt = 1 / 60) {
  return Math.abs(omega) * r * dt;
}

/**
 * 单帧内沿速度方向采样 N 次（三角权重：中心重、两端轻，跟真实快门的样子接近）。
 * `src` 是 {data:Uint8ClampedArray, w, h}（ImageData 形状），返回同形状的新 buffer。
 */
export function smear(src, vel, { samples = 6, gain = 1, maxPx = 24 } = {}) {
  const t0 = performance.now();
  // 既吃 {data,w,h} 也吃 ImageData（它把尺寸叫 width/height）。
  // 只认一种的话，传错时下面两层循环一次都不进 → **静默返回全 0**，不报错（踩过一次）。
  const data = src.data;
  const w = src.w ?? src.width;
  const h = src.h ?? src.height;
  if (!data || !w || !h) throw new Error('smear: 需要 {data,w,h} 或 ImageData');
  const out = new Uint8ClampedArray(data.length);
  const n = Math.max(1, samples);
  const weights = [];
  let wsum = 0;
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : k / (n - 1); // 0..1
    const wt = 1 - Math.abs(t - 0.5) * 2 * 0.75; // 三角，端点 0.25
    weights.push(wt);
    wsum += wt;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 2;
      let vx = vel[i];
      let vy = vel[i + 1];
      const len = Math.hypot(vx, vy);
      if (len > maxPx) { vx *= maxPx / len; vy *= maxPx / len; }
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < n; k++) {
        const f = n === 1 ? 0 : k / (n - 1) - 0.5;
        const wt = weights[k];
        // 必须**双线性**：整像素取值时，1.9px 的位移取整后等于没位移，
        // 实测一版 ω=0.6（外圈 1.92px）锐度掉 0.0% —— 看着像"拖影没生效"，其实是采样错了
        const fx = x + vx * f;
        const fy = y + vy * f;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const xa = Math.max(0, Math.min(w - 1, x0));
        const xb = Math.max(0, Math.min(w - 1, x0 + 1));
        const ya = Math.max(0, Math.min(h - 1, y0));
        const yb = Math.max(0, Math.min(h - 1, y0 + 1));
        const i00 = (ya * w + xa) * 4;
        const i10 = (ya * w + xb) * 4;
        const i01 = (yb * w + xa) * 4;
        const i11 = (yb * w + xb) * 4;
        for (let c = 0; c < 4; c++) {
          const v = (data[i00 + c] * (1 - tx) + data[i10 + c] * tx) * (1 - ty)
            + (data[i01 + c] * (1 - tx) + data[i11 + c] * tx) * ty;
          if (c === 0) r += v * wt;
          else if (c === 1) g += v * wt;
          else if (c === 2) b += v * wt;
          else a += v * wt;
        }
      }
      const oi = (y * w + x) * 4;
      out[oi] = (r / wsum) * gain;
      out[oi + 1] = (g / wsum) * gain;
      out[oi + 2] = (b / wsum) * gain;
      out[oi + 3] = (a / wsum) * gain;
    }
  }
  return { data: out, w, h, ms: performance.now() - t0 };
}

/**
 * 外圈频带锐度：只看 r > rMin 的像素 —— 拖影是 v=ω×r，外圈才是它发生的地方。
 * 全图 p95 会被中心的强边缘主导，第一版就是这么把 15.8% 的损失看成了"几乎没影响"。
 */
export function sharpnessBand(img, rMin = 0.55) {
  const { data, w, h } = img;
  const g = [];
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const rr = Math.hypot(x - cx, y - cy) / R;
      if (rr < rMin) continue;
      const c = lum((y * w + x) * 4);
      const dx = lum((y * w + x + 1) * 4) - c;
      const dy = lum(((y + 1) * w + x) * 4) - c;
      g.push(Math.hypot(dx, dy));
    }
  }
  if (!g.length) return { p50: 0, p95: 0, mean: 0, samples: 0 };
  g.sort((a, b) => a - b);
  const q = (p) => g[Math.min(g.length - 1, Math.floor(g.length * p))] || 0;
  let mean = 0;
  for (const v of g) mean += v;
  return { p50: q(0.5), p95: q(0.95), mean: mean / g.length, samples: g.length };
}

/** 边缘锐度：灰度梯度的 p95。拖影会把高频抹掉，这个数会掉。 */
export function sharpness(img) {
  const { data, w, h } = img;
  const g = [];
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const c = lum((y * w + x) * 4);
      const dx = lum((y * w + x + 1) * 4) - c;
      const dy = lum(((y + 1) * w + x) * 4) - c;
      g.push(Math.hypot(dx, dy));
    }
  }
  g.sort((a, b) => a - b);
  const q = (p) => g[Math.min(g.length - 1, Math.floor(g.length * p))] || 0;
  let mean = 0;
  for (const v of g) mean += v;
  return { p50: q(0.5), p95: q(0.95), mean: mean / g.length, samples: g.length };
}

/**
 * 一键体检：给一张图，量不同 ω 下的糊宽与锐度损失。
 *
 * 说明：这里用**合成测试图**（同心环 + 径向刻度），因为它有确定的频率内容，
 * 锐度掉多少可比；真实岛上"糊不糊"还取决于贴图细节，那是美术判断，不是数。
 */
export function audit({ size = 384, omegas = [0, 0.6, 1.2, 2.4], dt = 1 / 60, samples = 6 } = {}) {
  const w = size;
  const h = size;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2;
      const dy = y - h / 2;
      const r = Math.hypot(dx, dy) / (w / 2);
      const th = Math.atan2(dy, dx);
      // 同心环 × 径向刻线：既有一维高频（环），也有切向高频（刻线，最容易被切向拖影抹掉）
      const ring = Math.sin(r * 46) > 0 ? 1 : 0;
      const spoke = Math.sin(th * 24) > 0 ? 1 : 0;
      const v = 30 + 200 * (0.5 * ring + 0.5 * spoke);
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v * 0.9;
      data[i + 2] = v * 0.75;
      data[i + 3] = 255;
    }
  }
  const src = { data, w, h };
  const base = sharpness(src);
  const baseBand = sharpnessBand(src, 0.55);
  const rows = [];
  for (const omega of omegas) {
    const vel = velocityField(w, h, omega, dt);
    const out = smear(src, vel, { samples });
    const s = sharpness(out);
    const band = sharpnessBand(out, 0.55);
    rows.push({
      omega,
      rimPx: smearLengthPx(omega, w / 2, dt),
      ms: out.ms,
      p95: s.p95,
      drop: base.p95 ? 1 - s.p95 / base.p95 : 0,
      bandP95: band.p95,
      bandDrop: baseBand.p95 ? 1 - band.p95 / baseBand.p95 : 0,
    });
  }
  return { size, dt, samples, base, baseBand, rows, note: 'rimPx = |ω| · (w/2) · dt，画面最外圈的单帧位移' };
}
