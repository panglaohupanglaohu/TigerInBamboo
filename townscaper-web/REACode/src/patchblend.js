/**
 * patchblend.js — 无缝 patch 混合：投影式 patch vs 手工 UV patch，用「高度」决定谁盖谁
 *
 * 原文 // 1781405550061687016 (2024-04-19)：
 *
 *   "Ok this might not look like much but I've got seamless patch blending! Some of
 *    the patches are projected (like the grass and the water) and some are manually
 *    UV-mapped (like the shoreline). With some good textures and some height based
 *    blending this is gonna be great."
 *
 * 画面（24 帧，640²）：一个球。绿=草地、蓝=海水、中间一条很窄的桃色海岸带，带子靠水一侧
 * 排着一列等距白点。草地是投影式（世界平面投影）的圆点花样，水是投影式的斜网纹，
 * 两者在球面边缘都明显被压缩 —— 这就是 "projected" 的直接证据。海岸带是沿边一维 UV：
 * 白点永远等距贴着岸线走，不管岸线朝哪。三者交界处没有硬缝。
 *
 * 实现：
 *   - patch = { coverage, heightAt, color }；coverage 互相重叠
 *   - 重叠区内按各自高度排序，只混前两名，权重 = (h1-h2)/band 的 smoothstep
 *   - band 用「高度单位」而不是像素：过渡带在陡岸上窄、缓滩上宽（这条在 stats 里量了）
 *   - 两种映射：'project' 吃世界坐标（跨 patch 连续）；'uv' 吃 (沿岸弧长, 到岸线距离)
 *
 * 两个自己踩的坑（都改在代码里了）：
 *   ① 第一版用「|elev - 水线| < 常数」定海岸带覆盖 → 平缓海岸处带子宽度在像素上会暴涨，
 *      出现一块块桃色斑。改成用**有符号距离** sd=(elev-水线)/|∇elev| 定覆盖，带宽恒定 ~14px。
 *   ② 海岸带的 UV 用 atan2 角度当弧长，而 v 轴没参与图案 → 花纹沿射线恒定，
 *      岛变成海胆（放射状条纹）。修法：v 轴（垂岸方向）必须进图案（这里用作白点的位置带）。
 *
 * 量化（seamStats）：边界 ±5px 的平均梯度比、跨边界一像素跳跃、以及「过渡带里纹理细节还剩多少」。
 *   hard 有缝但纹理完整 / alpha 无缝但纹理被抹平 / height 两者之间 —— 见 stats。
 */

/* ───────────────────────── 噪声 ───────────────────────── */

function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const t = a + (b - a) * fx, u = c + (d - c) * fx;
  return t + (u - t) * fy;
}

function fbm(x, y, seed, oct = 3) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, seed + i * 17) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return v / norm;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/* ───────────────────────── 地形 ───────────────────────── */

/** 圆形岛 + 三层 fbm。返回「海拔」，WATER 是水线。解析式，任何 (x,y) 可重复求值。 */
export function makeElev(w, h, seed = 7) {
  const cx = w * 0.5, cy = h * 0.52;
  const sx = w * 0.46, sy = h * 0.44;
  return (x, y) => {
    const nx = (x - cx) / sx, ny = (y - cy) / sy;
    const r = Math.sqrt(nx * nx + ny * ny);
    const coast = 0.62 - r * 0.52;
    const wob = (fbm(x * 0.011, y * 0.011, seed) - 0.5) * 0.30;
    const ridge = (fbm(x * 0.034, y * 0.034, seed + 91) - 0.5) * 0.10;
    return coast + wob + ridge;
  };
}

export const WATER = 0.30;
const SHORE_PX = 14;     // 海岸带半宽（像素，由有符号距离定义）

/* ───────────────────────── 三种贴图 ───────────────────────── */

/** 草地：投影式（世界平面投影，所以放大缩小时花纹不跟着走）。 */
function grassColor(x, y, seed) {
  const blotch = fbm(x * 0.013, y * 0.013, seed + 3);
  let c = mix3([0.45, 0.62, 0.34], [0.38, 0.55, 0.29], blotch);
  const gx = Math.floor((x + 7) / 22), gy = Math.floor((y + 11) / 22);
  const px = (gx + 0.5) * 22 + (hash2(gx, gy, seed + 5) - 0.5) * 5;
  const py = (gy + 0.5) * 22 + (hash2(gx, gy, seed + 6) - 0.5) * 5;
  const d = Math.hypot(x - px, y - py);
  if (d < 6.5) c = mix3(c, [0.34, 0.50, 0.26], 0.55 * (1 - d / 6.5));
  return c;
}

/** 海水：投影式。两组斜线交叉。 */
function waterColor(x, y) {
  const u = (x + y) / 19, v = (x - y) / 26;
  const lineU = Math.abs(u - Math.round(u)) < 0.07;
  const lineV = Math.abs(v - Math.round(v)) < 0.05;
  let c = [0.36, 0.55, 0.72];
  if (lineU) c = mix3(c, [0.47, 0.66, 0.80], 0.8);
  if (lineV) c = mix3(c, [0.32, 0.50, 0.68], 0.7);
  return c;
}

/**
 * 海岸带：手工 UV。u = 沿岸弧长（绕岛角度×半径近似），v = 到岸线的有符号距离。
 * 图案：v 决定深浅（水侧深、陆侧浅），u 决定白点的等距位置。
 * v 轴必须参与图案，否则花纹沿射线恒定 → 放射状条纹（坑 ②）。
 */
function shoreColor(x, y, world, sd) {
  const ang = Math.atan2(y - world.cy, x - world.cx);
  // u = 沿真实岸线的弧长（A(θ) 表 + 当前角度在格内的线性插值）
  const twoPi = Math.PI * 2;
  const a01 = ((ang % twoPi) + twoPi) % twoPi;
  const fb = (a01 / twoPi) * world.coast.NB;
  const b0 = Math.min(world.coast.NB - 1, Math.floor(fb));
  const fr = fb - b0;
  const u = world.coast.A[b0] + (world.coast.A[b0 + 1] - world.coast.A[b0]) * fr;
  const v = clamp01(sd / SHORE_PX * -0.5 + 0.5);      // 0=最靠水，1=最靠陆
  let c = mix3([0.84, 0.66, 0.52], [0.94, 0.80, 0.64], v);
  // 沿岸等距白点，只在靠水那 35% 的带子里
  const dot = Math.abs((u / 13) - Math.round(u / 13));
  if (dot < 0.20 && v < 0.35 && v > 0.04) c = mix3(c, [0.97, 0.97, 0.95], 0.9);
  // 一条很淡的潮线
  if (Math.abs(sd + 2) < 1.2) c = mix3(c, [0.76, 0.57, 0.44], 0.30);
  return c;
}

/* ───────────────────────── world ───────────────────────── */

export function buildWorld({ w = 560, h = 380, seed = 7, band = 0.018, lip = 0.03 } = {}) {
  const elev = makeElev(w, h, seed);
  const world = {
    w, h, seed, band, lip,
    cx: w * 0.5, cy: h * 0.52,
    shoreRadius: Math.min(w, h) * 0.42,
    elev,
    patches: [],
  };

  // 预先把海拔和有符号距离算成数组：render() 里每像素要读 1 次海拔 + 梯度，
  // 直接调解析式就是 5 次 fbm/像素（5 个模式 ≈ 9000 万次 hash，浏览器里要好几秒）。
  /**
   * 沿岸弧长表：海岸带的 u 轴要「沿真实岸线等距」，不能用 角度×常数（那只对圆形岛成立，
   * 结果是白点在岛的上/下缘挤成一堆、左右缘稀稀拉拉）。
   * 做法：360 个角度各射一条线找水线半径 R(θ)，再把 R·dθ 累加成弧长 A(θ)。
   */
  const NB = 360;
  const R = new Float32Array(NB);
  const A = new Float32Array(NB + 1);
  for (let b = 0; b < NB; b++) {
    const th = (b / NB) * Math.PI * 2;
    const cx = Math.cos(th), cy = Math.sin(th);
    let rr = 1;
    for (let t = 1; t < Math.max(w, h); t++) {
      if (elev(world.cx + cx * t, world.cy + cy * t) < WATER) break;
      rr = t;
    }
    R[b] = rr;
  }
  for (let b = 0; b < NB; b++) A[b + 1] = A[b] + R[b] * (Math.PI * 2 / NB);
  world.coast = { R, A, NB };

  world.E = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) world.E[y * w + x] = elev(x, y);
  world.SD = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const xm = x > 0 ? i - 1 : i, xp = x < w - 1 ? i + 1 : i;
      const ym = y > 0 ? i - w : i, yp = y < h - 1 ? i + w : i;
      const gx = (world.E[xp] - world.E[xm]) * 0.5;
      const gy = (world.E[yp] - world.E[ym]) * 0.5;
      const grad = Math.hypot(gx, gy);
      world.SD[i] = (world.E[i] - WATER) / Math.max(1e-4, grad);
    }
  }

  world.patches = [
    {
      id: 0, name: 'water', mapping: 'project', css: '#5C8CB8',
      coverage: (e, sd) => e < WATER,
      heightAt: () => WATER,
      color: (x, y) => waterColor(x, y),
    },
    {
      id: 1, name: 'shore', mapping: 'uv', css: '#DCAA80',
      coverage: (e, sd) => Math.abs(sd) <= SHORE_PX,
      // 中段高、两端低：差值为 0 才不会有硬边，所以这里用 (f-0.5) 而不是 f
      heightAt: (e, sd) => e + lip * (Math.cos(Math.PI * 0.5 * clamp01(Math.abs(sd) / SHORE_PX)) ** 2 - 0.5),
      color: (x, y, e, sd) => shoreColor(x, y, world, sd),
    },
    {
      id: 2, name: 'land', mapping: 'project', css: '#6E9E57',
      coverage: (e, sd) => e > WATER,
      heightAt: (e) => e,
      color: (x, y) => grassColor(x, y, seed),
    },
  ];
  return world;
}

/* ───────────────────────── 合成 ───────────────────────── */

/**
 * mode:
 *   'hard'   只取最高那个 patch（硬切，基线）
 *   'alpha'  覆盖到的全平均（最常见的「羽化」做法）
 *   'height' 取前两名，按 (h1-h2)/band smoothstep 混合（原文做法）
 */
export function render(world, mode = 'height') {
  const { w, h } = world;
  const data = new Uint8ClampedArray(w * h * 4);
  const ids = new Int8Array(w * h);
  const soft = new Uint8Array(w * h);        // 权重落在 0.1..0.9 的像素 = 过渡带
  let covHist = { 1: 0, 2: 0, 3: 0 };
  const cov = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = world.E[y * w + x];
      const sd = world.SD[y * w + x];   // 到水线的有符号距离（像素），负=水侧

      cov.length = 0;
      for (const p of world.patches) {
        if (p.coverage(e, sd)) cov.push({ p, hh: p.heightAt(e, sd), c: p.color(x, y, e, sd) });
      }
      if (!cov.length) cov.push({ p: world.patches[e > WATER ? 2 : 0], hh: e, c: waterColor(x, y) });
      covHist[Math.min(3, cov.length)]++;

      let c, top;
      if (mode === 'hard') {
        cov.sort((a, b) => b.hh - a.hh);
        top = cov[0];
        c = top.c;
      } else if (mode === 'alpha') {
        let r = 0, g = 0, b = 0;
        for (const q of cov) { r += q.c[0]; g += q.c[1]; b += q.c[2]; }
        c = [r / cov.length, g / cov.length, b / cov.length];
        top = cov[cov.length - 1];
      } else {
        cov.sort((a, b) => b.hh - a.hh);
        top = cov[0];
        if (cov.length === 1) {
          c = top.c;
        } else {
          const w1 = smooth(clamp01(0.5 + (cov[0].hh - cov[1].hh) / (2 * world.band)));
          c = mix3(cov[1].c, cov[0].c, w1);
          if (w1 < 0.5) top = cov[1];
          const t = Math.min(w1, 1 - w1);
          if (t > 0.1 && t < 0.9) soft[y * w + x] = 1;
        }
      }

      const i = y * w + x;
      ids[i] = top.p.id;
      const o = i * 4;
      data[o] = c[0] * 255; data[o + 1] = c[1] * 255; data[o + 2] = c[2] * 255; data[o + 3] = 255;
    }
  }
  return { data, ids, w, h, covHist, soft };
}

/* ───────────────────────── 量化 ───────────────────────── */

const luma = (d, i) => (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;

export function seamStats(img, { r = 5, innerGap = 12 } = {}) {
  const { data, ids, w, h } = img;

  const isEdge = new Uint8Array(w * h);
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, id = ids[i];
      if (ids[i + 1] !== id || ids[i - 1] !== id || ids[i + w] !== id || ids[i - w] !== id) {
        isEdge[i] = 1; edgeCount++;
      }
    }
  }
  const dilate = (src, rad) => {
    let a = src, b = new Uint8Array(w * h);
    for (let k = 0; k < rad; k++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          b[i] = a[i] || a[i + 1] || a[i - 1] || a[i + w] || a[i - w] ? 1 : 0;
        }
      }
      const t = a; a = b; b = t;
    }
    return a;
  };
  const band = dilate(isEdge, r);
  const excl = dilate(isEdge, innerGap);

  const gradMag = (x, y) => {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return 0;
    const i = y * w + x;
    const gx = luma(data, i + 1) - luma(data, i - 1);
    const gy = luma(data, i + w) - luma(data, i - w);
    return Math.hypot(gx, gy) * 0.5;
  };

  let bSum = 0, bN = 0, iSum = 0, iN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (band[i]) { bSum += gradMag(x, y); bN++; }
      else if (!excl[i]) { iSum += gradMag(x, y); iN++; }
    }
  }
  const gradBand = bN ? bSum / bN : 0;
  const gradInner = iN ? iSum / iN : 0;
  let softN = 0;
  for (let i = 0; i < w * h; i++) softN += img.soft[i];
  return {
    edgePx: edgeCount,
    bandPx: bN,
    bandShare: +((bN / (w * h)) * 100).toFixed(2),
    gradBand: +gradBand.toFixed(4),
    gradInner: +gradInner.toFixed(4),
    ratio: +(gradInner > 0 ? gradBand / gradInner : 0).toFixed(2),
    /** 过渡带宽度（像素）与它的离散度：高度混合的宽度会随坡度变，羽化不会 */
    softMeanPx: +(edgeCount ? softN / edgeCount : 0).toFixed(1),
  };
}

/** 跨边界一像素的颜色跳跃：接缝「看不看得见」最直接的数字。 */
export function edgeJump(img) {
  const { data, ids, w, h } = img;
  let sum = 0, n = 0, max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (ids[i + 1] === ids[i]) continue;
      const d = Math.abs(luma(data, i + 1) - luma(data, i));
      sum += d; n++; if (d > max) max = d;
    }
  }
  return { n, meanJump: +(n ? sum / n : 0).toFixed(4), maxJump: +max.toFixed(4) };
}

/** 同一世界里三种合成模式一起跑，返回对比表。 */
export function abModes(world) {
  const out = {};
  for (const mode of ['hard', 'alpha', 'height']) {
    const img = render(world, mode);
    out[mode] = { seam: seamStats(img), jump: edgeJump(img), covHist: img.covHist };
  }
  const base = out.hard.seam.gradBand || 1;
  for (const k of Object.keys(out)) {
    out[k].detailKeptPct = +((out[k].seam.gradBand / base) * 100).toFixed(0);
    out[k].jumpCutPct = +((1 - out[k].jump.meanJump / (out.hard.jump.meanJump || 1)) * 100).toFixed(0);
  }
  return out;
}
