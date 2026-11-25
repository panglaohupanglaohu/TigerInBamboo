/**
 * terrace-field.js — 台地高度场（R43 随 island-passes 一起嫁接自 REACode/src/terracecliff.js，原版只读不改）。
 *
 * 来源帖子：815236105079398400（2016-12-31，仅视频）、781957658597269506（黄色浮岛，同一套结构 + 木梯）。
 * 原版做的事（行为照搬，默认参数下与原版逐值一致）：
 *   fieldSmooth  连续高度：径向衰减 + 两组低频正弦 + 一点高频哈希 → 一座有坡的岛；
 *   fieldTerrace 按层高 STEP 量化成台面（同一层同一个值 = 层中心），只对层界做一点抖动（不改高度）；
 *   classify     四邻最大高差 → 平 / 可站 / 崖（「一格之内跨掉一级」g ≥ 0.9·STEP 才算崖，不看角度阈值）。
 * 和原版不同：classify(h, water, step) 多一个可选 step 参数（原版写死 CFG.STEP）；不传时一致。
 * island-passes.js 的 grid() 用这里的 heights('terrace')，与原版 islandpasses 复用 terracecliff 同一座岛一致。
 */

const H = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

export const CFG = Object.freeze({
  N: 34,
  STEP: 0.9,
  WATER: 0.35,
  ROUGH: 0.22,
});

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
      h[y].push(k * step + step * 0.5);
    }
  }
  return h;
}

export function classify(h, water = CFG.WATER, step = CFG.STEP) {
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
      const ang = Math.atan(g) * 180 / Math.PI;
      angHist.push(ang);
      if (isShore) shore++;
      if (g >= step * 0.9) cliff++;
      if (g < step * 0.12) { flat++; stand++; }
      else if (g < step * 0.45) stand++;
    }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  void mean;
  angHist.sort((a, b) => a - b);
  return {
    land,
    flatPct: +(flat / land * 100).toFixed(1),
    cliffPct: +(cliff / land * 100).toFixed(1),
    standPct: +(stand / land * 100).toFixed(1),
    shore,
    angMed: +angHist[Math.floor(angHist.length / 2)].toFixed(1),
    angP90: +angHist[Math.floor(angHist.length * 0.9)].toFixed(1),
    levels: new Set(h.flat().filter((z) => z > water).map((z) => Math.round(z / step))).size,
  };
}

export function measure(mode = 'smooth') {
  const h = mode === 'terrace' ? fieldTerrace() : fieldSmooth();
  return { mode, ...classify(h) };
}

export function heights(mode = 'terrace') {
  return mode === 'terrace' ? fieldTerrace() : fieldSmooth();
}
