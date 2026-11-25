/**
 * grassedge.js — 草的描边不是"描出来"的，是**两次采样之差**。
 *
 * 1590674061092212738（2022-11-10，light）
 *   "In the vertex shader, my grass gets to sample that contrast texture both where
 *    they stand, and also raycast into the background. The outline strength is
 *    determined by the difference between these two samples! Not perfect, but pretty
 *    good! Not too jittery when turning the camera"
 *
 * ---- 为什么是"两次采样"而不是"画一圈黑边" ----
 * 画黑边的做法（src/outline.js 现在就是屏幕空间描边）有两个绕不过去的问题：
 *   ① 每片草都要描边 → 一丛草里前后重叠的卡片互相描边，远看是一团糊；
 *   ② 描边宽度是像素常数，镜头推近就变粗，和"美术画的草"不是一回事。
 * 他这句话换了个判据：**草自己不需要轮廓，需要的是"草和它背后那层东西的对比度"**。
 * 所以描边强度 = |contrast(草的落点) − contrast(草背后被打中的点)|：
 *   · 草站在亮草坡上，背后也是亮草坡 → 差 ≈ 0 → 一片叶子都不描（远看是一片绿）；
 *   · 草站在崖沿，背后是暗崖面 → 差很大 → 只在这一丛的迎崖那侧出现深边。
 * 于是描边密度跟着**画面结构**走，不跟着草的几何走 —— 这就是他说的 pretty good。
 *
 * ---- 第二句"raycast into the background"在本文件里怎么落地 ----
 * 真正的实现是在顶点着色器里沿视线方向对背景做一次射线求交，拿命中点的坐标去查
 * contrast texture。我们没有顶点着色器（画布是 2D 的），但等价量可以算出来：
 * 相机俯角 elevation、草高 h 时，草顶在背景上的落点 = 沿视线反方向退
 *     d = h / tan(elevation)
 * 个世界单位。所以 `sampleBehind()` 就是"从草的脚下往后退 d 再采一次"。
 * 这不是近似求交（我们背后没有可求交的几何），但它保住了原文最关键的性质：
 * 采样点是**世界空间里连续移动的**，不是每帧重新判定的二值遮挡。
 *
 * ---- 最后一句"not too jittery when turning the camera"是可测的 ----
 * `audit()` 里同时算两套描边的**转向抖动**：
 *   · field 版（本文件）—— 采样是双线性连续场，相机转 1° 强度只动一点点；
 *   · occlusion 版（朴素做法）—— 背后有没有崖是 0/1 判定，转到某个角度整丛草翻面。
 * 指标是"相邻方位角之间强度差的平均绝对值"，越小越稳。
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

/* ------------------------------------------------------------ 对比度场（contrast texture） */

/**
 * 把"没有草的时候，这个世界每一点有多暗"烘成一张世界空间的小图。
 *
 * 原文里这是一张真实的贴图（mega texture 旁边那张）；我们这里没有贴图管线，
 * 就按同样的**语义**烘一张：值越大 = 越暗 = 草压上去越容易被读出来。
 *
 * 三个来源，正好对应"草会被看出来的三种背景"：
 *   1. 高度 → 高台比水面暗（俯视时高台把光挡掉一半）；
 *   2. 崖脚 → 邻居比自己高 Δ 层时，沿那条边往里 band 宽的一条最暗（接触阴影）；
 *   3. 水 → 水是最亮的背景，草压在水线上几乎是剪影。
 */
export function buildContrastField(town, grid, {
  res = 112,
  levelHeight = 1,
  blur = 2,
  cliffGain = 0.34,
  heightGain = 0.055,
  pad = 1.5,
} = {}) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const c of grid.cells) for (const p of c.pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
  }
  x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
  const w = res, h = Math.max(8, Math.round((res * (z1 - z0)) / (x1 - x0)));
  const data = new Float32Array(w * h);
  const step = (x1 - x0) / w;
  const toI = (x) => (x - x0) / step;
  const toJ = (z) => (z - z0) / step;

  const put = (i, j, v) => {
    if (i < 0 || j < 0 || i >= w || j >= h) return;
    const k = j * w + i;
    if (v > data[k]) data[k] = v;
  };

  // 1) 高度底值 + 2) 崖脚接触阴影：都按"逐格多边形扫描"写进去
  for (const cell of grid.cells) {
    const top = town.top(cell);
    if (!top) continue;                     // 空格 = 水，保持 0（最亮）
    const base = 0.32 + Math.min(0.42, top * heightGain);
    const pts = cell.pts;
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (const p of pts) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
    const i0 = Math.max(0, Math.floor(toI(bx0))), i1 = Math.min(w - 1, Math.ceil(toI(bx1)));
    const j0 = Math.max(0, Math.floor(toJ(bz0))), j1 = Math.min(h - 1, Math.ceil(toJ(bz1)));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + (j + 0.5) * step;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * step;
        if (!inPoly(pts, x, z)) continue;
        put(i, j, base);
      }
    }
    // 崖脚：对每条"邻居更高"的边，沿边往格内倒一条渐变带
    const nbr = cell.edgeNeighbors || cell.nbr;
    for (let e = 0; e < pts.length; e++) {
      const nb = nbr ? nbr[e] : -1;
      if (nb === undefined || nb < 0) continue;
      const nt = town.top(grid.cells[nb]);
      if (nt <= top) continue;
      const drop = Math.min(4, nt - top);
      const a = pts[e], b = pts[(e + 1) % pts.length];
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const inx = (cell.cx ?? (pts[0].x + pts[2].x) / 2) - cx;
      const inz = (cell.cz ?? (pts[0].z + pts[2].z) / 2) - cz;
      const il = Math.hypot(inx, inz) || 1;
      const bandW = 0.45 + drop * 0.42;                 // 世界单位：崖越高，暗带越宽
      const depth = cliffGain * (0.55 + drop * 0.34);   // 越深越暗，但封顶（不然纯黑）
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        const f = s / (steps - 1);
        const px = a.x + (b.x - a.x) * 0.5 + (inx / il) * bandW * f;
        const pz = a.z + (b.z - a.z) * 0.5 + (inz / il) * bandW * f;
        const v = base + depth * (1 - f) * 0.9;
        // 沿边往两侧各散开一点，别只写中心一个像素
        for (let t = -1; t <= 1; t++) {
          const qx = px + (b.x - a.x) * 0.09 * t, qz = pz + (b.z - a.z) * 0.09 * t;
          put(Math.round(toI(qx)), Math.round(toJ(qz)), v);
        }
      }
    }
  }

  // 3) 软一遍：contrast texture 在原作里也是模糊的（它有 mipmap / 双线性），
  //    硬边的场会让描边强度在转向时逐像素跳变 —— 恰恰是原文说"不要太抖"的反面。
  for (let pass = 0; pass < blur; pass++) boxBlur(data, w, h);

  return {
    w, h, x0, z0, step, data, res,
    /** 世界坐标 → 对比度（0=亮背景，1=最暗）。双线性。 */
    sample(x, z) {
      const fx = (x - x0) / step - 0.5, fz = (z - z0) / step - 0.5;
      const i = Math.floor(fx), j = Math.floor(fz);
      const tx = fx - i, tz = fz - j;
      const at = (ii, jj) => {
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) return 0;
        return data[jj * w + ii];
      };
      const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
      const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
      return a * (1 - tz) + b * tz;
    },
    /** 世界坐标 → 采样点落在图外时返回 0（水/虚空），避免边缘外推出一条假边。 */
    inside(x, z) {
      return x > x0 && z > z0 && x < x0 + w * step && z < z0 + h * step;
    },
  };
}

function inPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function boxBlur(src, w, h) {
  const tmp = new Float32Array(src.length);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const a = src[k], b = src[j * w + Math.max(0, i - 1)], c = src[j * w + Math.min(w - 1, i + 1)];
      tmp[k] = (a * 2 + b + c) / 4;
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const a = tmp[k], b = tmp[Math.max(0, j - 1) * w + i], c = tmp[Math.min(h - 1, j + 1) * w + i];
      src[k] = (a * 2 + b + c) / 4;
    }
  }
}

/* ------------------------------------------------------------ 两次采样 → 描边强度 */

/**
 * 一片草的描边强度。
 *
 *   a = 草地落点的对比度        —— "where they stand"
 *   b = 沿视线退 d 之后的对比度 —— "raycast into the background"
 *   strength = |a − b|
 *
 * d = h / tan(elevation)：草越高、相机越低，草顶压到背景上的位置越远。
 * 俯视（elevation→90°）时 d→0，两次采样重合、strength→0 —— 这也对：
 * 正上方看下去，草确实没有"背后的东西"可对比。
 */
export function bladeOutline(card, field, cam, {
  elevation = 0.62,
  heightScale = 1,
  gain = 2.6,
  gamma = 0.85,
} = {}) {
  const a = field.sample(card.x, card.z);
  const d = (card.h * heightScale) / Math.max(0.18, Math.tan(elevation));
  const bx = card.x - cam.x * d;
  const bz = card.z - cam.z * d;
  const b = field.inside(bx, bz) ? field.sample(bx, bz) : 0;
  const raw = Math.abs(a - b);
  const strength = clamp01(Math.pow(raw * gain, gamma));
  return { a, b, raw, strength, d };
}

/**
 * 朴素做法：背后有没有更高的格子，有就是 1。
 * 只用来和上面那版比"转向抖不抖"，不参与渲染。
 */
export function occlusionOutline(card, town, grid, cam, { probe = 1.1, heightScale = 1 } = {}) {
  const tx = card.x + cam.x * probe, tz = card.z + cam.z * probe;
  let best = -1;
  for (const cell of grid.cells) {
    if (!inPoly(cell.pts, tx, tz)) continue;
    best = town.top(cell);
    break;
  }
  if (best < 0) return 0;
  return best * heightScale > card.y + card.h * 0.35 ? 1 : 0;
}

/* ------------------------------------------------------------ 量测 */

/**
 * 把"not too jittery when turning the camera"变成两个数。
 *
 *   meanStrength —— 有多少草真的被描了（视觉有效性的下界）
 *   jitterField  —— 方位角每转 360/azimuths 度，强度平均变化多少（连续场）
 *   jitterOcc    —— 同一转向下，二值遮挡判定的平均变化（朴素做法）
 * 期望关系：jitterField << jitterOcc，且 field 版的强度分布是连续的（不是 0/1 两极）。
 */
export function audit({ field, cards, town, grid, azimuths = 24, elevation = 0.62, heightScale = 1, gain = 2.6 } = {}) {
  const t0 = performance.now();
  let sum = 0, n = 0, covered = 0;
  const hist = new Array(10).fill(0);
  let jf = 0, jo = 0, prevF = null, prevO = null;
  // 逐叶翻转率：相邻两个方位角之间，这一片草的描边强度跳变 > 0.4 的比例。
  // 这是"抖不抖"更贴近观感的量 —— 均值抖动会被数量平均掉，翻转率不会。
  let flipF = 0, flipO = 0, flipN = 0;
  let prevPerBladeF = null, prevPerBladeO = null;

  for (let k = 0; k < azimuths; k++) {
    const az = (k / azimuths) * Math.PI * 2;
    const cam = { x: Math.cos(az), z: Math.sin(az) };
    let mf = 0, mo = 0;
    const perF = new Float32Array(cards.length);
    const perO = new Float32Array(cards.length);
    for (let ci = 0; ci < cards.length; ci++) {
      const c = cards[ci];
      const r = bladeOutline(c, field, cam, { elevation, heightScale, gain });
      perF[ci] = r.strength;
      perO[ci] = occlusionOutline(c, town, grid, cam, { heightScale });
      mf += r.strength;
      mo += perO[ci];
      if (k === 0) {
        sum += r.strength; n++;
        if (r.strength > 0.08) covered++;
        hist[Math.min(9, Math.floor(r.strength * 10))]++;
      }
    }
    if (prevPerBladeF) {
      for (let ci = 0; ci < cards.length; ci++) {
        if (Math.abs(perF[ci] - prevPerBladeF[ci]) > 0.4) flipF++;
        if (Math.abs(perO[ci] - prevPerBladeO[ci]) > 0.4) flipO++;
        flipN++;
      }
    }
    prevPerBladeF = perF; prevPerBladeO = perO;
    mf /= cards.length || 1; mo /= cards.length || 1;
    if (prevF !== null) { jf += Math.abs(mf - prevF); jo += Math.abs(mo - prevO); }
    prevF = mf; prevO = mo;
  }

  return {
    cards: cards.length,
    meanStrength: sum / (n || 1),
    coveredFrac: covered / (n || 1),
    histogram: hist,
    jitterField: jf / Math.max(1, azimuths - 1),
    jitterOcclusion: jo / Math.max(1, azimuths - 1),
    flipField: flipF / Math.max(1, flipN),
    flipOcclusion: flipO / Math.max(1, flipN),
    ms: performance.now() - t0,
  };
}

export { mulberry32 };
