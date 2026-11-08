/**
 * terracecliff.js — 高度场量化成台地层，台面之间就成了近乎垂直的崖壁。
 *
 * 帖子 ID：815236105079398400（2016-12-31，无原文字，仅有视频）
 *   画面（6 帧，512²，灰白无贴图）：一座灰白岛，能数出 3~4 级台面。每一级台面
 *   顶面几乎全平（不是缓坡），台面之间是**近乎垂直的崖壁**，水线处压着一条白沫。
 *   蓝白小人只站在台面上，没有谁站在崖壁上。
 *   同题材的 781957658597269506（黄色浮岛）也是同一套结构，只是多了木梯跨层。
 *
 * 为什么要量化而不是直接用 fBm：
 *   连续噪声地形上，任意一点都有一点坡度 —— 没有"平面"，也没有"墙"。单位和
 *   建筑只能靠 blur 出来的近似平面勉强站住，看起来总是"贴着坡滑"。
 *   把高度量化到层高 step 之后：h_q = floor(h / step) * step（+ 一点抖动只作用
 *   在层界位置，不改高度），地形自己就分裂成 平面 + 崖壁 两种面：
 *     台面：邻格高差 ≈ 0  → 坡度 0°，可站立面积成片；
 *     崖壁：邻格高差 = step → 坡角 90°（像素网格上受一格宽度限制，实测 arctan(step/1)）。
 *   这一条直接给出了"单位站哪儿"和"崖壁画哪儿"，不需要额外的坡度分类器。
 *
 * 白沫 = 水线那条线：h_q == 0 且邻格 h_q ≥ step 的格，沿边画一圈 —— 崖壁把
 * 水线切得很硬，白沫才有一条清楚的落脚边（缓坡上白沫只能糊成一圈渐变）。
 */

const H = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

export const CFG = {
  N: 34,          // 高度场边长（格）
  STEP: 0.9,      // 一层台地的高度
  WATER: 0.35,    // 水线（低于它算海）
  ROUGH: 0.22,    // 层界抖动（只挪边界，不改高度）
};

/** 连续高度场：径向衰减 + 两组低频正弦 + 一点高频，得到一座有坡的岛 */
export function fieldSmooth(n = CFG.N) {
  const h = [];
  for (let y = 0; y < n; y++) {
    h.push([]);
    for (let x = 0; x < n; x++) {
      const cx = (x - n / 2) / (n / 2), cy = (y - n / 2) / (n / 2);
      const r = Math.hypot(cx, cy * 1.05);
      const island = Math.max(0, 1 - r * 1.08);
      const v = 0.55
        + 0.42 * Math.sin(cx * 2.1 + 0.7) * Math.cos(cy * 1.7 - 0.4)
        + 0.22 * Math.sin(cx * 4.3 - 1.1) * Math.cos(cy * 3.1 + 2.0)
        + 0.10 * (H(x, y) - 0.5);
      let z = Math.pow(Math.max(0, island), 1.15) * (1.5 + v * 1.9) - 0.35;
      h[y].push(Math.max(-0.6, z));
    }
  }
  return h;
}

/** 量化成台地：先按层高切，再只对**层界**做一点抖动（边缘不那么规整，但不改高度） */
export function fieldTerrace(step = CFG.STEP, jitter = CFG.ROUGH) {
  const n = CFG.N;
  const s = fieldSmooth(n);
  const h = [];
  for (let y = 0; y < n; y++) {
    h.push([]);
    for (let x = 0; x < n; x++) {
      const z = s[y][x];
      const j = (H(x * 7 + 3, y * 11 + 5) - 0.5) * jitter * step;
      const k = Math.floor((z + j) / step);
      h[y].push(k * step + step * 0.5);       // 台面中心高度（同一层同一个值）
    }
  }
  return h;
}

/** 坡度分类：按四邻最大高差 / 格宽 → 坡角 */
export function classify(h, water = CFG.WATER) {
  const n = h.length;
  let land = 0, flat = 0, cliff = 0, shore = 0, stand = 0;
  const angHist = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const z = h[y][x];
      if (z <= water) continue;
      land++;
      let g = 0, isShore = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        const zz = (xx >= 0 && yy >= 0 && xx < n && yy < n) ? h[yy][xx] : water - 1;
        g = Math.max(g, Math.abs(z - zz));
        if (zz <= water) isShore = true;
      }
      const ang = Math.atan(g) * 180 / Math.PI;     // 格宽 = 1
      angHist.push(ang);
      if (isShore) shore++;
      // 崖壁的判据是「一格之内跨掉一级」（g ≥ 0.9×step），不是看角度阈值——
      // 网格宽 1 格、层高 0.9，理论坡角就是 atan(0.9)=42°，永远到不了 70°。
      if (g >= CFG.STEP * 0.9) cliff++;
      if (g < CFG.STEP * 0.12) { flat++; stand++; }
      else if (g < CFG.STEP * 0.45) stand++;
    }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  angHist.sort((a, b) => a - b);
  return {
    land,
    flatPct: +(flat / land * 100).toFixed(1),
    cliffPct: +(cliff / land * 100).toFixed(1),
    standPct: +(stand / land * 100).toFixed(1),
    shore,
    angMed: +angHist[Math.floor(angHist.length / 2)].toFixed(1),
    angP90: +angHist[Math.floor(angHist.length * 0.9)].toFixed(1),
    levels: new Set(h.flat().filter((z) => z > CFG.WATER).map((z) => Math.round(z / CFG.STEP))).size,
  };
}

export function measure(mode = 'smooth') {
  const h = mode === 'terrace' ? fieldTerrace() : fieldSmooth();
  return { mode, ...classify(h) };
}

/** 供页面画等距柱子用：返回每格的台面高度（0 = 海） */
export function heights(mode = 'terrace') {
  return mode === 'terrace' ? fieldTerrace() : fieldSmooth();
}
