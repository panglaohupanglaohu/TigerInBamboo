/**
 * surfaceshadow.js — 贴图级「表面阴影」：投射高度与深度测试高度是两个独立的量
 *
 * 原文 // 1705195380457996629 (2023-09-22)：
 *
 *   "I tamed the texture based surface shadows a bit, so the shadow casting height is
 *    independent of the z test height. Now I only get shadows over grass-cliff edges
 *    and under roofs. It has some artifacts across UV borders, but it's quite subtle
 *    so I might not actually have to fix it."
 *
 * 画面（24 帧，640²）：整整一圈崖壁都是亮的、没有投影，但**草皮与崖口的接缝处**有一圈
 * 暗边、**屋顶檐下**也有一条暗边。即：这不是一张普通的 shadow map ——
 * 普通 shadow map 会让整根崖壁把下面的台地压暗一大片。
 *
 * 两个旋钮（本文件按原文分离成两个独立参数）：
 *   castH   —— 「谁有资格当投射体」：相对自身地基的高度 ≥ castH 才投。
 *              调大 → 只有屋脊、台地边缘这种真正凸起的东西投，崖壁本身不投，
 *              于是阴影只出现在「草-崖口」和「檐下」。
 *   zTestH  —— 光线行进时的深度比较偏置（以高度单位计）。
 *              调大 → 影子从根部分离（脱地），调小 → 贴脚但容易自阴影噪点。
 *   两个量以前是同一个数，所以想让影子只出现在边缘就必然贴脚出噪点 —— 这就是他说的 "tamed"。
 *
 * 坑（他自己说的）：跨 UV 边界的伪影。本文件把地形切成 4 个象限、每个象限在**自己的
 * 局部坐标系**里做光线行进，于是象限边界两侧的阴影对不上 —— 量出来的 seam 像素占比
 * 与参考帧里那种「细看才看得见」的程度吻合。
 */

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
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, seed + i * 13) * amp; n += amp; amp *= 0.5; f *= 2.01; }
  return v / n;
}

/* ───────────────────────── 地形 ───────────────────────── */

/**
 * 顶视高度图：两级台地（量化过的 fbm）+ 几栋房子（屋顶 = 最高的方台）。
 * 台地边缘就是原文里「草-崖口」那种地方。
 */
export function buildTerrain({ w = 300, h = 200, seed = 21 } = {}) {
  const hf = new Float32Array(w * h);
  const roof = new Uint8Array(w * h);
  const houses = [
    { x: 0.34, y: 0.46, r: 9 },
    { x: 0.62, y: 0.36, r: 7 },
    { x: 0.70, y: 0.65, r: 8 },
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5, ny = y / h - 0.5;
      const r = Math.hypot(nx * 1.05, ny * 1.25) * 2;
      let e = 0.72 - r * 0.62 + (fbm(x * 0.013, y * 0.013, seed) - 0.5) * 0.42;
      // 量化成台地：3 级
      e = Math.round(e * 3) / 3;
      if (e > 0.66) e = 0.66;
      hf[y * w + x] = e;
    }
  }
  for (const hs of houses) {
    const cx = hs.x * w, cy = hs.y * h;
    for (let y = Math.max(0, cy - hs.r); y < Math.min(h, cy + hs.r); y++) {
      for (let x = Math.max(0, cx - hs.r); x < Math.min(w, cx + hs.r); x++) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (d <= hs.r) {
          const i = (y | 0) * w + (x | 0);
          hf[i] = 0.66 + 0.34 * (1 - d / hs.r) + 0.05;   // 屋顶比台地高一截
          roof[i] = 1;
        }
      }
    }
  }
  return { w, h, hf, roof, houses };
}

/** 宽半径模糊当作「地基高度」，用来量每个点的相对凸起（prominence）。 */
function blur(src, w, h, rad = 14) {
  // 可分离箱式模糊，两次近似高斯
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -rad; x <= rad; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (rad * 2 + 1);
        acc += a[y * w + Math.min(w - 1, x + rad + 1)] - a[y * w + Math.max(0, x - rad)];
      }
    }
    const t = a; a = b; b = t;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / (rad * 2 + 1);
        acc += a[Math.min(h - 1, y + rad + 1) * w + x] - a[Math.max(0, y - rad) * w + x];
      }
    }
    const t2 = a; a = b; b = t2;
  }
  return a;
}

/* ───────────────────────── 阴影 ───────────────────────── */

/**
 * 光：dx,dy 是「朝光走」的方向（影子落在反方向）。
 * tan 是高度单位 → 像素的换算系数：高度场只在 0..1 之间，而地图 300px 宽，
 * 两者单位不同。tan = 0.04 时，0.4 高的屋顶投出约 10px 的影子（参考帧里檐下就是十来像素）。
 * 第一版把 tan 写成 0.95（当成真实角度），结果影子长度 0.4px —— 覆盖率全 0。
 */
const LIGHT = { dx: -0.82, dy: -0.48, tan: 0.035 };

/**
 * @param {object} o
 * @param {number} o.castH  caster 门槛：相对地基高 ≥ castH 才算投射体
 * @param {number} o.zTestH 深度比较偏置（高度单位）
 * @param {boolean} o.islands 是否切 4 个象限、各用各的局部坐标系（复现 UV 边界伪影）
 */
export function shadowMap(terr, { castH = 0.18, zTestH = 0.02, steps = 56, islands = false } = {}) {
  const { w, h, hf } = terr;
  const base = blur(hf, w, h, 14);
  const prom = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) prom[i] = hf[i] - base[i];

  const out = new Float32Array(w * h);
  const stepLen = 1.15;
  // 3 条轻微散开的光线 → 半影。单条光线只会得到硬边，看不出「柔和但短」。
  const RAYS = [-0.028, 0, 0.028];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hr = hf[i];

      /**
       * UV 边界伪影：4 个象限各用自己的一点偏移（光向 ±5° + 半像素 texel 偏移）。
       * 第一版直接转 90°，那样影子方向整体反转，不是原文说的 "quite subtle"。
       */
      let ang = 0, tox = 0, toy = 0;
      if (islands) {
        const q = (x < w / 2 ? 0 : 1) + (y < h / 2 ? 0 : 2);
        ang = [0.06, -0.05, 0.04, -0.03][q];
        tox = [0.5, -0.5, 0.5, -0.5][q];
        toy = [0.5, 0.5, -0.5, -0.5][q];
      }
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ldx = LIGHT.dx * ca - LIGHT.dy * sa;
      const ldy = LIGHT.dx * sa + LIGHT.dy * ca;

      let hits = 0;
      for (const ra of RAYS) {
        const rca = Math.cos(ra), rsa = Math.sin(ra);
        const ddx = ldx * rca - ldy * rsa, ddy = ldx * rsa + ldy * rca;
        for (let s = 1; s <= steps; s++) {
          const t = s * stepLen;
          const qx = (x + tox + ddx * t) | 0, qy = (y + toy + ddy * t) | 0;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) break;
          const j = qy * w + qx;
          // ① caster 门槛：只看「相对自己地基的高度」，和深度测试无关
          if (prom[j] < castH) continue;
          // ② 深度测试：光线上这个高度能否挡住我
          const rayH = hr + t * LIGHT.tan;
          if (hf[j] > rayH + zTestH) { hits++; break; }
        }
      }
      out[i] = hits / RAYS.length;
    }
  }
  return out;
}

/* ───────────────────────── 量化 ───────────────────────── */

/**
 * 阴影落点统计：原文的关键句子是 "Now I only get shadows over grass-cliff edges and
 * under roofs" —— 所以要分开数「檐下」和「草-崖口」，而不是只给一个总覆盖率。
 * 第一版统计了 shadow ∩ roof，结果恒为 0：顶视图里屋顶投下的影子落在地上，不落在屋顶上。
 */
export function shadowStats(sm, terr, { w = terr.w, h = terr.h, nearPx = 12 } = {}) {
  const { hf, roof } = terr;
  const near = (mask, rad) => {
    let a = mask, b = new Uint8Array(w * h);
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
  // 台地边缘（高度突变）：顶视图里「草-崖口」就是这些地方
  const edgeMask = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(hf[i + 1] - hf[i - 1]) + Math.abs(hf[i + w] - hf[i - w]);
      if (g > 0.22) edgeMask[i] = 1;
    }
  }
  const nearRoof = near(roof, nearPx);
  const nearEdge = near(edgeMask, nearPx);

  let shadowed = 0, sum = 0, underRoof = 0, atEdge = 0;
  for (let i = 0; i < w * h; i++) {
    sum += sm[i];
    if (sm[i] <= 0.15) continue;
    shadowed++;
    if (nearRoof[i]) underRoof++;
    else if (nearEdge[i]) atEdge++;
  }
  return {
    coveragePct: +((shadowed / (w * h)) * 100).toFixed(2),
    meanOcclusion: +(sum / (w * h)).toFixed(3),
    underRoofPct: +((underRoof / (w * h)) * 100).toFixed(2),
    atCliffEdgePct: +((atEdge / (w * h)) * 100).toFixed(2),
    roofShareOfShadowPct: +((underRoof / Math.max(1, shadowed)) * 100).toFixed(0),
    edgeShareOfShadowPct: +((atEdge / Math.max(1, shadowed)) * 100).toFixed(0),
  };
}

/** 跨 UV 象限边界的伪影：边界两侧 1px 的阴影差 > 0.25（3 条光线，一级差 = 0.333）。 */
export function islandSeams(sm, w, h) {
  let n = 0, max = 0;
  const check = (a, b) => { const d = Math.abs(sm[a] - sm[b]); if (d > 0.25) n++; if (d > max) max = d; };
  for (let y = 0; y < h; y++) check(y * w + (w / 2 - 1), y * w + (w / 2));
  for (let x = 0; x < w; x++) check((h / 2 - 1) * w + x, (h / 2) * w + x);
  return { seamPx: n, seamSharePct: +((n / (w + h)) * 100).toFixed(2), maxJump: +max.toFixed(2) };
}

/** castH × zTestH 扫描表：这是本轮最想给出的数字。 */
export function sweep(terr, castHs = [0.0, 0.18, 0.35], zTestHs = [0.01, 0.10, 0.30]) {
  const rows = [];
  for (const c of castHs) {
    const row = { castH: c, cells: [] };
    for (const z of zTestHs) {
      const sm = shadowMap(terr, { castH: c, zTestH: z });
      const st = shadowStats(sm, terr);
      row.cells.push({ zTestH: z, ...st });
    }
    rows.push(row);
  }
  return rows;
}

/** 把阴影画成顶视图（草绿 / 崖灰 / 屋黄 + 阴影压暗）。 */
export function renderTop(terr, sm) {
  const { w, h, hf, roof } = terr;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const e = hf[i];
    let c;
    if (roof[i]) c = [0.95, 0.83, 0.42];
    else if (e > 0.62) c = [0.42, 0.60, 0.32];      // 台地顶（草）
    else if (e > 0.30) c = [0.58, 0.62, 0.55];      // 崖壁（斜坡）
    else c = [0.74, 0.77, 0.78];
    const s = sm[i];
    const k = 1 - 0.55 * s;
    const o = i * 4;
    data[o] = c[0] * k * 255; data[o + 1] = c[1] * k * 255; data[o + 2] = c[2] * k * 255; data[o + 3] = 255;
  }
  return { data, w, h };
}
