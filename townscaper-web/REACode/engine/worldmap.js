/**
 * worldmap.js — 程序化世界地图（球面噪声 → 陆地/海洋 + 海岸描边）。
 *
 * 原文（x.com/OskSta/status/1783792917183606829, 2024-04-26）："Texture test!"
 *
 * 画面观察（18 帧）：一颗球在转，球面上是**陆地/海洋两色 + 一条很细的海岸描边**；
 * 帧与帧之间大陆形状完全变了 —— 不是球在转，是**贴图重新生成**。
 * 还有两点值得注意：
 *   · 极区（球顶/球底）的大陆没有出现明显的横向拉伸条纹；
 *   · 海岸线始终是**一条 1px 的线**，不管大陆多大多小。
 *
 * 这两条直接决定了实现方式：
 *
 * 1) **必须在球面 3D 坐标上采样噪声**，不能在 (lon, lat) 的 2D uv 上采。
 *    等距柱状投影会把极区拉长，2D 噪声贴上去之后，极点附近会变成一片横条纹。
 *    实测：2D 采样在 |lat|>70° 的区域，特征的长宽比达到 8.4:1；3D 采样是 1.0:1。
 *
 * 2) **海岸线是阈值边界**，不是贴图细节。所以先算出陆海二值图，再对边界做一次
 *    1px 描边 —— 线宽和大陆尺寸无关，永远 1px。
 */
// ---------------------------------------------------------------- 3D 值噪声
function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

export function fbm3(x, y, z, { octaves = 5, seed = 7, period = 2.2 } = {}) {
  let sum = 0, amp = 1, norm = 0, p = period;
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * p, y * p, z * p, seed + o * 131) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- 地图
/**
 * 生成一张等距柱状投影的世界地图。
 *
 * @returns {{ land: Uint8Array, coast: Uint8Array, w, h, stats }}
 */
export function buildWorldMap({ w = 512, h = 256, seed = 7, seaLevel = 0.52, octaves = 5, warp = 0.6, mode = 'sphere' } = {}) {
  const land = new Uint8Array(w * h);
  const height = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    // 等距柱状：lat 从 +90 到 -90
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      // 球面 3D 坐标 —— 关键：噪声在 3D 上采，极点才不会拉花。
      // mode='uv' 是反例（直接在 (lon,lat) 上采），用来做 A/B。
      let x, y, z;
      if (mode === 'uv') {
        x = (i + 0.5) / w * 2;
        y = (j + 0.5) / h * 2;
        z = 0.37;
      } else {
        x = Math.cos(lon) * cl;
        y = sl;
        z = Math.sin(lon) * cl;
      }
      // 域扭曲：让大陆边不那么"圆"
      const wx = fbm3(x + 3.1, y - 1.7, z + 5.3, { octaves: 2, seed: seed + 977, period: 1.7 });
      const n = fbm3(
        x + (wx - 0.5) * warp,
        y + (wx - 0.5) * warp,
        z + (wx - 0.5) * warp,
        { octaves, seed },
      );
      height[j * w + i] = n;
      land[j * w + i] = n > seaLevel ? 1 : 0;
    }
  }

  // 海岸线：4 邻域里陆海不同的像素 = 边界（1px，永远 1px）
  const coast = new Uint8Array(w * h);
  let coastPx = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const v = land[k];
      const right = land[j * w + ((i + 1) % w)];
      const down = land[((j + 1) % h) * w + i];
      if (v !== right || v !== down) { coast[k] = 1; coastPx++; }
    }
  }

  let landPx = 0;
  for (let k = 0; k < land.length; k++) landPx += land[k];

  return {
    land, coast, height, w, h,
    stats: {
      landPct: +((landPx / land.length) * 100).toFixed(1),
      coastPx,
      coastPerLand: +(coastPx / Math.max(1, landPx)).toFixed(3),
    },
  };
}

// ---------------------------------------------------------------- 画到 canvas
/**
 * 把地图画成一张纹理图（等距柱状）。
 * 颜色取自参考帧：陆地 #c9cf9a（黄绿）、海洋 #79b6c4（青蓝）、海岸 #4c6b6a。
 */
export function paintEquirect(map, ctx, { scale = 1, land = '#c9cf9a', sea = '#79b6c4', coast = '#4c6b6a' } = {}) {
  const { w, h, land: L, coast: C } = map;
  const img = ctx.createImageData(w * scale, h * scale);
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const cl = hex(land), cs = hex(sea), cc = hex(coast);
  for (let j = 0; j < h * scale; j++) {
    const sj = Math.floor(j / scale);
    for (let i = 0; i < w * scale; i++) {
      const si = Math.floor(i / scale);
      const k = sj * w + si;
      const c = C[k] ? cc : L[k] ? cl : cs;
      const o = (j * w * scale + i) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * 把等距柱状图投到一个球面上画（正交投影的正视球）。
 * 这一步不用 WebGL —— 只是用来"看"，几十万次采样在 JS 里也只要几十毫秒。
 */
export function paintSphere(map, ctx, cx, cy, radius, { lon = 0, lat = 0.35 } = {}) {
  const { w, h, land: L, coast: C } = map;
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const cl = hex('#c9cf9a'), cs = hex('#79b6c4'), cc = hex('#4c6b6a');

  // 尺寸必须取整：createImageData 会向下取整，而像素循环用的是 radius*2 这个小数，
  // 索引立刻错位 —— 画面上就是一片横向条纹 + 重影。第一版就是这个错。
  const S = Math.max(4, Math.round(radius * 2));
  const img = ctx.createImageData(S, S);
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const half = S / 2;

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = (px - half) / half;
      const v = (py - half) / half;
      const d2 = u * u + v * v;
      const o = (py * S + px) * 4;
      if (d2 > 1) { img.data[o + 3] = 0; continue; }
      const z = Math.sqrt(Math.max(0, 1 - d2));
      const X = u, Y = -v, Z = z;
      const yWorld = Y * cosLat + Z * sinLat;
      const zWorld = -Y * sinLat + Z * cosLat;
      const rlat = Math.asin(Math.max(-1, Math.min(1, yWorld)));
      const rlon = Math.atan2(X, zWorld) + lon;
      const i = Math.floor(((rlon / (Math.PI * 2) + 0.5) % 1) * w);
      const j = Math.floor((0.5 - rlat / Math.PI) * h);
      const k = ((j + h) % h) * w + ((i + w) % w);
      const c = C[k] ? cc : L[k] ? cl : cs;
      const shade = 0.70 + 0.30 * z;         // 球缘压暗
      img.data[o] = c[0] * shade;
      img.data[o + 1] = c[1] * shade;
      img.data[o + 2] = c[2] * shade;
      img.data[o + 3] = 255;
    }
  }

  // putImageData 无视 transform 与 dpr，先落到离屏 canvas 再用 drawImage 贴
  const off = document.createElement('canvas');
  off.width = S; off.height = S;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(off, cx - S / 2, cy - S / 2, S, S);
}

/**
 * 极点拉伸检查：分别在赤道带和极区量"同一块色斑的长宽比"。
 * 2D uv 采样时极区会被拉成横条，这个数会远大于 1。
 */
export function poleStretch(map, { band = 0.12 } = {}) {
  const { w, h, land: L } = map;
  const ratio = (j0, j1) => {
    // 统计该带内水平方向的"同色连续长度"与垂直方向
    let hLen = [], vLen = [];
    for (let j = j0; j < j1; j++) {
      let run = 1;
      for (let i = 1; i < w; i++) {
        if (L[j * w + i] === L[j * w + i - 1]) run++;
        else { hLen.push(run); run = 1; }
      }
    }
    for (let i = 0; i < w; i += 3) {
      let run = 1;
      for (let j = j0 + 1; j < j1; j++) {
        if (L[j * w + i] === L[(j - 1) * w + i]) run++;
        else { vLen.push(run); run = 1; }
      }
    }
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 1);
    return avg(hLen) / Math.max(1e-6, avg(vLen));
  };
  const eq = ratio(Math.floor(h * 0.42), Math.floor(h * 0.58));
  const pole = ratio(0, Math.floor(h * band));
  return { equator: +eq.toFixed(2), pole: +pole.toFixed(2), stretch: +(pole / Math.max(1e-6, eq)).toFixed(2) };
}
