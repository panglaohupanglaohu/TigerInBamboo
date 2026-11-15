/**
 * uv-bake.js — r55 · REACode engine/spritepack.js 缺口「UV 页接贴图烘焙」。
 *
 * 1478114309263839244 画面下半：同一座岛形模型贴着由图块页烘出来的棋盘格 —— 也就是
 * radialChartPack 的 UV 页要真的被当作贴图写像素，再贴回模型。本模块：
 *   1. 把 radialChartPack 的 UV 页放进共享 Atlas 的一个分配（满了 grow()），UV 换算到该槽；
 *   2. 在像素空间逐三角形光栅化：重心坐标插值出 3D 位置 + 面法线，交给 shade() 出颜色
 *      （默认：世界空间棋盘 × 预烘方向光 × 高度色带 —— 光照烘进贴图，渲染用无光照材质）；
 *   3. 边缘 gutter：只往外扩 N 像素（取邻居平均），双线性采样不会串到别的图块；
 *   4. 统计：texelFill（被三角覆盖的像素 / 槽面积）、chartFill（pack.fill）。
 * 纯数据，不 import three。原片的具体烘焙内容未知，棋盘 + 光照是本地替代。
 */
import { Atlas } from './atlas.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** 默认烘焙：世界空间棋盘（边长 checker）× 方向光 × 高度色带。返回 [r,g,b] 0..255。 */
export function checkerLitShade({ checker = 0.5, light = [0.45, 0.8, 0.35], ambient = 0.38 } = {}) {
  const L = norm(light);
  return (p, n) => {
    const c = (Math.floor(p[0] / checker) + Math.floor(p[1] / checker) + Math.floor(p[2] / checker)) & 1;
    const lam = ambient + (1 - ambient) * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const up = n[1] > 0.7, base = up ? (p[1] < 0.3 ? [214, 196, 150] : [128, 170, 98]) : [150, 132, 112];
    const k = (c ? 1 : 0.72) * lam;
    return [base[0] * k, base[1] * k, base[2] * k];
  };
}

/**
 * mesh: {positions, triangles}（weldSoup 输出）；pack: radialChartPack 输出。
 * opts.atlas: 共享 Atlas（缺省新建 size×size）；opts.texels: UV 页边长像素；opts.key: 槽键。
 * 返回 {atlas, slot, grown, rgba, width, height, uvs(Float32Array, 每三角 3×2), positions(Float32Array 非索引),
 *       texelFill, covered, gutterFilled, chartFill}
 */
export function bakeChartPage(mesh, pack, { atlas = null, size = 1024, texels = 512, key = 'uv-page', gutter = 2, shade = checkerLitShade() } = {}) {
  if (!mesh?.positions || !mesh?.triangles || typeof pack?.uv !== 'function') throw new TypeError('mesh + radialChartPack result required');
  if (!Number.isInteger(texels) || texels < 16 || texels > 4096 || !Number.isInteger(gutter) || gutter < 0 || gutter > 16) throw new RangeError('invalid bake options');
  let A = atlas ?? new Atlas(size, size), grown = null;
  let slot = A.place(key, texels, texels, { rng: () => 0.5 });
  while (!slot) {
    grown = A.grow(); if (!grown) throw new RangeError('atlas cannot grow');
    A = grown.atlas; slot = A.place(key, texels, texels, { rng: () => 0.5 });
    if (A.width > 8192) throw new RangeError('atlas grew past 8192');
  }
  const W = A.width, H = A.height, rgba = new Uint8Array(W * H * 4), owner = new Int32Array(texels * texels).fill(-1);
  const T = mesh.triangles.length, uvs = new Float32Array(T * 6), pos = new Float32Array(T * 9);
  // 槽内 UV 留半像素边，保证 [0,1] 页的边缘像素中心也在槽内
  const toPx = (u, v) => [slot.x + 0.5 + u * (texels - 1), slot.y + 0.5 + v * (texels - 1)];
  let covered = 0;
  for (let t = 0; t < T; t++) {
    const tri = mesh.triangles[t], P = tri.map((i) => mesh.positions[i]), uv = pack.uv(t);
    if (!uv) throw new RangeError('triangle ' + t + ' has no UV');
    const n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    const px = uv.map(([u, v]) => toPx(u, v));
    for (let k = 0; k < 3; k++) { uvs[t * 6 + k * 2] = px[k][0] / W; uvs[t * 6 + k * 2 + 1] = px[k][1] / H; pos.set(P[k], t * 9 + k * 3); }
    // 光栅化：像素中心在三角内（含边，容差半像素保证相邻三角无缝）
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
    const x0 = Math.max(slot.x, Math.floor(Math.min(...xs) - 0.5)), x1 = Math.min(slot.x + texels - 1, Math.ceil(Math.max(...xs) + 0.5));
    const y0 = Math.max(slot.y, Math.floor(Math.min(...ys) - 0.5)), y1 = Math.min(slot.y + texels - 1, Math.ceil(Math.max(...ys) + 0.5));
    const [a, b, c] = px, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-12) continue;
    const edgeLen = [Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), Math.hypot(a[0] - b[0], a[1] - b[1])];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const l0 = ((b[1] - c[1]) * (qx - c[0]) + (c[0] - b[0]) * (qy - c[1])) / den, l1 = ((c[1] - a[1]) * (qx - c[0]) + (a[0] - c[0]) * (qy - c[1])) / den, l2 = 1 - l0 - l1;
      // 到每条边的像素距离 = λ_i × 2·面积 / 边长；> -0.5px 视为覆盖（保守，避免接缝漏像素）
      const area2 = Math.abs(den), inside = [l0, l1, l2].every((l, i) => l * area2 / edgeLen[i] > -0.5);
      if (!inside) continue;
      const o = (y - slot.y) * texels + (x - slot.x), strict = l0 >= 0 && l1 >= 0 && l2 >= 0;
      if (owner[o] >= 0 && !strict) continue;           // 已由别的三角严格覆盖：不覆写
      const cl = [l0, l1, l2].map((l) => Math.max(0, l)), s = cl[0] + cl[1] + cl[2] || 1;
      const p3 = [0, 1, 2].map((d) => (cl[0] * P[0][d] + cl[1] * P[1][d] + cl[2] * P[2][d]) / s);
      const col = shade(p3, n), i4 = (y * W + x) * 4;
      if (owner[o] < 0) covered++;
      owner[o] = t; rgba[i4] = col[0]; rgba[i4 + 1] = col[1]; rgba[i4 + 2] = col[2]; rgba[i4 + 3] = 255;
    }
  }
  // gutter：逐圈往外扩，空像素取已填邻居平均（只在槽内）
  let gutterFilled = 0;
  for (let g = 0; g < gutter; g++) {
    const add = [];
    for (let y = 0; y < texels; y++) for (let x = 0; x < texels; x++) {
      const i4 = ((slot.y + y) * W + slot.x + x) * 4; if (rgba[i4 + 3]) continue;
      let r = 0, gg = 0, bb = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= texels || Y >= texels) continue; const j = ((slot.y + Y) * W + slot.x + X) * 4; if (rgba[j + 3] === 255) { r += rgba[j]; gg += rgba[j + 1]; bb += rgba[j + 2]; k++; } }
      if (k) add.push([i4, r / k, gg / k, bb / k]);
    }
    for (const [i4, r, gg, bb] of add) { rgba[i4] = r; rgba[i4 + 1] = gg; rgba[i4 + 2] = bb; rgba[i4 + 3] = 254; }   // 254 = gutter
    gutterFilled += add.length;
  }
  return { atlas: A, slot, grown, rgba, width: W, height: H, uvs, positions: pos, texelFill: covered / (texels * texels), covered, gutterFilled, chartFill: pack.fill, owner };
}
