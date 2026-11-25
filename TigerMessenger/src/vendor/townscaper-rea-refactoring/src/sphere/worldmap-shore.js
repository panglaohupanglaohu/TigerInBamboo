/**
 * worldmap-shore.js — 第 56 批 C11 · 1783792917183606829「Texture test!」岸缘贴图。
 *
 * 逐帧复看（242 帧，原尺寸 0150）：r55 已有 worldmap（3D 噪声海陆 + 沙岸/草/陡坡 + 1px 海岸线）上星球，但片子的岸缘还有三样
 *   ① 陆地一侧沿海一圈**深绿暗带**（海岸坡），往内渐亮；② 海一侧**几道平行于海岸的浅色浪线**，越往外越淡、断断续续；
 *   ③ 少数海湾里的**白色沙滩月牙**；另外陆地内部是**两色草块**（大块斑驳）。
 * 这里只加一张「岸缘」配色：在 buildWorldMap 的结果上算球面度量的有向距离场（等距柱状格，经向步长 × cos(lat)，
 * 双向 chamfer 两轮，经度回绕），再按距离着色。草块用同一 3D 噪声（fbm3）按方向取，所以没有经度接缝/极点拉伸。
 * worldmap-material.js 的 worldMapTexture({ shore: true }) 选用；默认不变。
 */
import { fbm3 } from './worldmap.js';

/** 每像素到「另一类」（陆↔海）的最近球面角距离（弧度）。返回 { dist, w, h }。 */
export function shoreDistance(map, { passes = 2 } = {}) {
  const { w, h, land } = map;
  if (!land || land.length !== w * h) throw new RangeError('shoreDistance needs a world map');
  const INF = 1e9, d = new Float32Array(w * h).fill(INF), dl = Math.PI * 2 / w, dp = Math.PI / h;
  const cl = Array.from({ length: h }, (_, j) => Math.max(.02, Math.cos((.5 - (j + .5) / h) * Math.PI)));
  // 种子：与 4 邻域任一不同类的像素，距离 = 半格（边界在两像素之间）
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, v = land[k];
    const nb = [[j, (i + 1) % w], [j, (i - 1 + w) % w], [j - 1, i], [j + 1, i]];
    for (const [jj, ii] of nb) if (jj >= 0 && jj < h && land[jj * w + ii] !== v) { d[k] = Math.min(d[k], .5 * (jj === j ? dl * cl[j] : dp)); }
  }
  const relax = (j, i, jj, ii, step) => { if (jj < 0 || jj >= h) return; ii = (ii + w) % w; const k = j * w + i, q = jj * w + ii; if (land[q] !== land[k]) return; const c = d[q] + step; if (c < d[k]) d[k] = c; };
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const sx = dl * cl[j], dg = Math.hypot(sx, dp); relax(j, i, j, i - 1, sx); relax(j, i, j - 1, i, dp); relax(j, i, j - 1, i - 1, dg); relax(j, i, j - 1, i + 1, dg); }
    for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) { const sx = dl * cl[j], dg = Math.hypot(sx, dp); relax(j, i, j, i + 1, sx); relax(j, i, j + 1, i, dp); relax(j, i, j + 1, i + 1, dg); relax(j, i, j + 1, i - 1, dg); }
  }
  return { dist: d, w, h };
}

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const SHORE_PALETTE = { sea: [.36, .62, .63], seaNear: [.42, .68, .68], wave: [.80, .90, .89], grass: [.63, .76, .44], grass2: [.52, .67, .36], rim: [.27, .37, .22], sand: [.93, .92, .86], ink: [.17, .22, .2] };
/**
 * 岸缘配色：rim（陆侧暗带宽，弧度）、waves（浪线条数）、waveGap（浪线间距，弧度）、sandPct（沙滩月牙出现阈值）。
 * 返回 { rgba, roles, stats }，row 0 = 北（与 worldMapColors 相同）。
 */
export function worldMapShoreColors(map, { rim = .035, waves = 3, waveGap = .022, waveW = .0045, seed = 7, palette = SHORE_PALETTE } = {}) {
  const { w, h, land } = map, { dist } = shoreDistance(map), rgba = new Uint8ClampedArray(w * h * 4);
  const roles = { sea: 0, wave: 0, grass: 0, grass2: 0, rim: 0, sand: 0 };
  for (let j = 0; j < h; j++) {
    const lat = (.5 - (j + .5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const k = j * w + i, lon = (i + .5) / w * Math.PI * 2, p = [Math.cos(lon) * cl, sl, Math.sin(lon) * cl], dd = dist[k];
      const beach = fbm3(p[0] + 9.1, p[1] - 4.2, p[2] + 2.7, { octaves: 2, seed: seed + 41, period: 3.1 });   // 低频：哪些海湾有沙
      let c;
      if (land[k]) {
        const blot = fbm3(p[0], p[1], p[2], { octaves: 3, seed: seed + 17, period: 7 });
        c = blot > .52 ? palette.grass2 : palette.grass; roles[blot > .52 ? 'grass2' : 'grass']++;
        const r = 1 - sm(rim * .25, rim, dd + (fbm3(p[0] * 3, p[1] * 3, p[2] * 3, { octaves: 2, seed: seed + 5, period: 5 }) - .5) * rim * .6);
        if (r > .5) roles.rim++;
        c = mix3(c, palette.rim, r * .85);
        if (beach > .6 && dd < rim * .55) { c = palette.sand; roles.sand++; }
        if (dd < .0035) c = mix3(c, palette.ink, .7);
      } else {
        c = mix3(palette.seaNear, palette.sea, sm(0, waveGap * (waves + 1), dd)); roles.sea++;
        if (beach > .6 && dd < .006) c = mix3(c, palette.sand, .8);
        for (let n = 1; n <= waves; n++) {
          const center = n * waveGap * (1 + .25 * (fbm3(p[0] * 2, p[1] * 2, p[2] * 2, { octaves: 1, seed: seed + n, period: 4 }) - .5));
          const on = 1 - sm(waveW * .5, waveW, Math.abs(dd - center));
          const broken = sm(.42, .5, fbm3(p[0] * 4 + n, p[1] * 4, p[2] * 4, { octaves: 2, seed: seed + 60 + n, period: 6 }));
          const a = on * broken * (1 - (n - 1) / waves) * .9;
          if (a > .3) roles.wave++;
          c = mix3(c, palette.wave, a);
        }
      }
      rgba[k * 4] = c[0] * 255; rgba[k * 4 + 1] = c[1] * 255; rgba[k * 4 + 2] = c[2] * 255; rgba[k * 4 + 3] = 255;
    }
  }
  return { rgba, roles, stats: { rim, waves, waveGap } };
}
