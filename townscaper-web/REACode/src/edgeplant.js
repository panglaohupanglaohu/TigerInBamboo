/**
 * edgeplant.js — 贴着"边"长的东西：崖沿草带、崖沿小灌木、墙脚花园带。
 *
 * 三条原文，同一个几何前提：**它们都只长在边上**，不是撒在地形上。
 *
 * ① x.com/OskSta/status/1590669875869286400（2022-11-10）
 *    "An early look at grass billboards. I really like how they add a completely
 *     new kind of shape and detail frequency."
 *
 * ② x.com/OskSta/status/1707490274425884929（2023-09-28）
 *    "I added back the lil' shrubbery at the edges of things for like the 3rd time"
 *
 * ③ x.com/OskSta/status/1290997501332525056（2020-08-05）
 *    "I added some garden paths"
 *
 * 画面实测（640² 帧，放大 3 倍看）：
 *   · **草带**：卡片的剪影是**多瓣的小丛**（3~5 个圆瓣），带 1px 深色描边；
 *     它们连成一条毛边挂在**台地边缘**上，越往里越稀，不是均匀铺满草地。
 *     单片卡片高 ≈ 岛宽的 1/18（≈ 11px / 200px），比格子小一个数量级 ——
 *     原文说的 "detail frequency" 就是这个比值。
 *   · **崖沿灌木**：更小、更暖（橙褐，明度比地面低一档），贴着边缘线成串，
 *     凸角处单独一坨。尺寸 ≈ 岛宽 1/30。
 *   · **花园带**：走的是**墙脚的水平面**，不是崖沿；带子有固定宽度（≈ 1 格），
 *     沿墙等距摆**球状灌木**（深绿、顶亮），末端接一块方草坪。
 *
 * 这三条都是"找出边 → 沿边撒"，所以放在一个文件里；撒法各自一个策略。
 * 本文件不 import three，纯数据 + 一个俯视渲染器（用来核对位置，不追求好看）。
 */

import { normalAt } from './bouncegi.js';

/**
 * 找"边"：一格高于水面、且 4 邻域里有一格的落差 > drop 的，就是崖沿格。
 * 返回每个沿格的外法向（指向落差那侧），后面撒东西要沿着它往外偏。
 */
export function findRims(field, { drop = 0.35, minHeight = 0.25 } = {}) {
  const { res, h } = field;
  const out = [];
  for (let y = 1; y < res - 1; y++) {
    for (let x = 1; x < res - 1; x++) {
      const i = y * res + x;
      if (h[i] < minHeight) continue;
      let best = 0, bx = 0, by = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * res + (x + dx);
        const d = h[i] - h[j];
        if (d > best) { best = d; bx = dx; by = dy; }
      }
      if (best < drop) continue;
      out.push({ x, y, drop: best, nx: bx, ny: by, height: h[i] });
    }
  }
  return out;
}

/** 最小间距过滤（网格加速的简单版本；点数几千以内够用）。 */
function poisson(items, minDist) {
  const kept = [];
  const grid = new Map();
  const cs = Math.max(minDist, 1e-3);
  for (const it of items) {
    const gx = Math.floor(it.x / cs), gy = Math.floor(it.y / cs);
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) {
      for (let dx = -1; dx <= 1 && ok; dx++) {
        const bucket = grid.get((gx + dx) + ',' + (gy + dy));
        if (!bucket) continue;
        for (const o of bucket) {
          if (Math.hypot(o.x - it.x, o.y - it.y) < minDist) { ok = false; break; }
        }
      }
    }
    if (!ok) continue;
    kept.push(it);
    const k = gx + ',' + gy;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(it);
  }
  return kept;
}

/**
 * ① 崖沿草带：从沿格出发，向**外**（落差那侧）偏一点点，再沿着边撒若干排，
 * 越往里越稀。卡片尺寸按岛宽的比例给，不按格子给 —— 这是"细节频率"的关键：
 * 卡片必须比格子小一个数量级，否则看起来还是格子。
 */
export function placeGrassBand(field, rims, {
  islandWidth = 16, sizeRatio = 1 / 18, rows = 2, rowStep = 0.05,
  perCell = 1.5, seed = 5, heightRange = 0.55,
} = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const items = [];
  const cardSize = islandWidth * sizeRatio;
  const pitch = field.pitch;
  // 格心坐标要减掉半个岛宽才是世界坐标（第一版忘了减，所有草都跑到 +x/+z 那一个
  // 象限里去了 —— 俯视图上只有右下角有草，而统计数字全对，典型的"数对图错"）
  const half = (field.res * pitch) / 2;
  for (const r of rims) {
    for (let row = 0; row < rows; row++) {
      // 越往里越稀：第二排开始按 row 递减概率
      const keep = row === 0 ? 1 : Math.pow(0.55, row);
      const n = Math.round(perCell * keep + rnd());
      for (let k = 0; k < n; k++) {
        if (rnd() > keep) continue;
        const jx = (rnd() - 0.5) * pitch * 0.9;
        const jy = (rnd() - 0.5) * pitch * 0.9;
        // 向外（-n 方向）偏：第 0 排刚好在边上，往里各排往反方向退
        const inward = -row * rowStep;
        const x = (r.x + 0.5) * pitch - half + jx + r.nx * inward * pitch;
        const z = (r.y + 0.5) * pitch - half + jy + r.ny * inward * pitch;
        const y = field.h[r.y * field.res + r.x] + (rnd() - 0.5) * heightRange * 0.06;
        items.push({
          kind: 'grass', x, z, y,
          size: cardSize * (0.75 + rnd() * 0.6),
          rotation: rnd() * Math.PI * 2,
          lobes: 3 + Math.floor(rnd() * 3),
          row,
        });
      }
    }
  }
  return items;
}

/** ② 崖沿灌木：稀疏、只在边上、暖色；凸角（外法向和邻格法向不同）优先。 */
export function placeRimShrubs(field, rims, {
  islandWidth = 16, sizeRatio = 1 / 30, minSpacingCells = 3.2, seed = 9, coverage = 0.55,
} = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pitch = field.pitch;
  const half = (field.res * pitch) / 2;
  const shuffled = rims.filter(() => rnd() < coverage);
  const kept = poisson(shuffled, minSpacingCells * pitch);
  const size = islandWidth * sizeRatio;
  return kept.map((r) => ({
    kind: 'shrub',
    x: (r.x + 0.5) * pitch - half + r.nx * pitch * 0.28,
    z: (r.y + 0.5) * pitch - half + r.ny * pitch * 0.28,
    y: r.height,
    size: size * (0.8 + rnd() * 0.5),
    lobes: 3 + Math.floor(rnd() * 3),
    rotation: rnd() * Math.PI * 2,
  }));
}

/**
 * ③ 花园带：找**平地上贴着墙**的那些格子（自身坡度小、但邻格高出很多），
 * 沿它们退开 `offset` 画一条带子，带子上等距摆球状灌木。
 *
 * 和崖沿的区别就写在这里：崖沿是"自己高、邻格低"，花园是"自己低、邻格高"。
 */
export function placeGardenPath(field, {
  wallRise = 0.35, maxSlope = 0.28, offsetCells = 0.75, spacing = 2.2, islandWidth = 16, seed = 13,
} = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const { res, h, pitch } = field;
  const stations = [];
  for (let y = 1; y < res - 1; y++) {
    for (let x = 1; x < res - 1; x++) {
      const i = y * res + x;
      if (h[i] < 0.2) continue;
      let hi = -1e9, lo = 1e9, bx = 0, by = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const hv = h[(y + dy) * res + (x + dx)];
        if (hv > hi) { hi = hv; bx = dx; by = dy; }
        if (hv < lo) lo = hv;
      }
      // 这一格自己得基本是平的（和最低邻格差不多），但旁边有一堵墙
      if (h[i] - lo > maxSlope) continue;
      if (hi - h[i] < wallRise) continue;
      stations.push({ x, y, nx: -bx, ny: -by, height: h[i] });  // 法向背离墙
    }
  }
  const kept = poisson(stations, spacing * 0.7 * pitch);
  const half = (field.res * pitch) / 2;
  const shrubs = kept.map((r) => {
    const d = offsetCells * pitch;
    return {
      kind: 'gardenShrub',
      x: (r.x + 0.5) * pitch - half + r.nx * d,
      z: (r.y + 0.5) * pitch - half + r.ny * d,
      y: r.height,
      size: islandWidth / 26 * (0.9 + rnd() * 0.2),
      lobes: 2,
      rotation: 0,
    };
  });
  return { stations, shrubs, pathWidth: offsetCells * pitch };
}

/** 统计：数量、最小/中位间距、尺寸比、边缘覆盖率。 */
export function stats(items, rims, { islandWidth = 16, pitch = 0.167, originHalf = 0 } = {}) {
  const pts = items.map((it) => ({ x: it.x, z: it.z }));
  // 最近邻距离（中位）比"全局最小"有用：卡片本来就是互相压着的
  const nn = [];
  for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 400))) {
    let best = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) nn.push(best);
  }
  nn.sort((a, b) => a - b);
  // 边缘覆盖率：每个沿格半径 2 格内有没有东西（沿格坐标也要减半个岛宽，
  // 否则和撒点后的世界坐标差一个 half，覆盖率会算成 4%）
  let covered = 0;
  for (const r of rims) {
    const rx = (r.x + 0.5) * pitch - (originHalf || 0), rz = (r.y + 0.5) * pitch - (originHalf || 0);
    let near = false;
    for (const p of pts) {
      if (Math.abs(p.x - rx) < pitch * 2 && Math.abs(p.z - rz) < pitch * 2) { near = true; break; }
    }
    if (near) covered++;
  }
  const sizes = items.map((i) => i.size).sort((a, b) => a - b);
  return {
    count: items.length,
    nnMedian: nn.length ? +nn[Math.floor(nn.length / 2)].toFixed(3) : null,
    sizeMedian: sizes.length ? +sizes[Math.floor(sizes.length / 2)].toFixed(3) : 0,
    sizeOverIsland: sizes.length ? +(sizes[Math.floor(sizes.length / 2)] / islandWidth).toFixed(4) : 0,
    rimCoverage: rims.length ? +(covered / rims.length * 100).toFixed(1) : 0,
  };
}

/** 俯视渲染：高度着色 + 植物剪影（瓣用圆近似），只为核对位置。 */
export function renderPlan(field, layers, { w = 520, h = 520, yaw = 0 } = {}) {
  const { res, h: hf, pitch } = field;
  const data = new Uint8ClampedArray(w * h * 4);
  const span = res * pitch;
  const sc = w / span;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  // 地形：按高度上色（低=暗蓝，高=暖白）
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let x = px / sc - span / 2, z = py / sc - span / 2;
      const rx = x * cosY - z * sinY, rz = x * sinY + z * cosY;
      const gx = Math.floor(rx / pitch + res / 2), gy = Math.floor(rz / pitch + res / 2);
      const o = (py * w + px) * 4;
      if (gx < 0 || gy < 0 || gx >= res || gy >= res || hf[gy * res + gx] <= 0.02) {
        data[o] = 26; data[o + 1] = 44; data[o + 2] = 52;
      } else {
        const t = Math.min(1, hf[gy * res + gx] / 2.4);
        data[o] = 90 + t * 130; data[o + 1] = 86 + t * 120; data[o + 2] = 70 + t * 100;
      }
      data[o + 3] = 255;
    }
  }
  const dot = (cx, cy, r, col, outline) => {
    for (let yy = Math.floor(cy - r - 1); yy <= cy + r + 1; yy++) {
      for (let xx = Math.floor(cx - r - 1); xx <= cx + r + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const d = Math.hypot(xx - cx, yy - cy);
        if (d > r) continue;
        const o = (yy * w + xx) * 4;
        const isEdge = d > r - 1;
        const c = isEdge && outline ? outline : col;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      }
    }
  };
  for (const layer of layers) {
    for (const it of layer.items) {
      const rx = it.x * cosY - it.z * sinY, rz = it.x * sinY + it.z * cosY;
      const cx = (rx + span / 2) * sc, cy = (rz + span / 2) * sc;
      const r = Math.max(1.0, it.size * sc * 0.34);
      if (it.kind === 'grass') {
        for (let k = 0; k < it.lobes; k++) {
          const a = it.rotation + (k / it.lobes) * Math.PI * 2;
          dot(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.62, [150, 168, 96], [48, 62, 36]);
        }
      } else if (it.kind === 'shrub') {
        for (let k = 0; k < it.lobes; k++) {
          const a = it.rotation + (k / it.lobes) * Math.PI * 2;
          dot(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.6, [196, 118, 74], [92, 46, 30]);
        }
      } else {
        dot(cx, cy, r, [36, 84, 52], [18, 44, 28]);
      }
    }
  }
  return { w, h, data };
}

/** 验收。 */
export function audit({ heightRes = 96, span = 16 } = {}) {
  // 延迟取，避免模块初始化时就依赖 bouncegi 的建岛逻辑
  return import('./bouncegi.js').then(({ makeCanyon }) => {
    const field = makeCanyon({ res: heightRes, span });
    const rims = findRims(field);
    const grass = placeGrassBand(field, rims, { islandWidth: span });
    const shrubs = placeRimShrubs(field, rims, { islandWidth: span });
    const garden = placeGardenPath(field, { islandWidth: span });
    return {
      field, rims,
      rimCells: rims.length,
      grass: stats(grass, rims, { islandWidth: span, pitch: field.pitch, originHalf: (field.res * field.pitch) / 2 }),
      shrubs: stats(shrubs, rims, { islandWidth: span, pitch: field.pitch, originHalf: (field.res * field.pitch) / 2 }),
      garden: { stations: garden.stations.length, shrubs: garden.shrubs.length, pathWidth: +garden.pathWidth.toFixed(3) },
    };
  });
}
