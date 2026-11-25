/**
 * field-plot-map.js — 1798310423554658732：把「地块耕纹」从画布接回 View 主材质。
 *
 * 片内（614 帧，六边格地形工具实录，无文字）看到的是：
 *   - 农田是一块一块的：**同一块地里的条带方向完全一致**，走到地块边界才改向
 *     （frame-0600 的 6× 裁切：左边地块条带接近水平，右边地块约 −60°，边界处一刀切换向）；
 *   - 条带是**宽软带**（明暗各约一条、边缘糊掉半条宽），不是发丝细线；
 *   - 条带在块内会**缓慢弯**（frame-0300），块与块之间还有一点整体色调差。
 *
 * 本仓原来的状态（`src/terrain/terrainmesh.js:187` + `src/terrain/field-pattern.js`）：
 *   aField.xy 只写「本格自己的轴」，而 `fieldTone(vField)` 只拿到这个轴 —— 没有世界坐标、
 *   没有地块、没有行号，于是格内是一片常数色，条带根本画不出来（页面 `fields.html` 是 2D 画布，
 *   不是主场景）。`src/core/field-plots.js` 的并查集地块 / 主轴 / 人字坐标早在，缺的就是这一层。
 *
 * 这里做的是**烘焙世界 XZ 图**：每个纹素写 4 个量（都是浮点，纹素里自己做双线性）
 *   R = 行号（单位 = 一条垄宽；已含人字 skew·|u|，所以块内自然折成人字）
 *   G = 田埂（1 = 块内，0 = 紧贴地块边界）
 *   B = 该地块的色调扰动（0–1）
 *   A = 有效（1 = 这一纹素落在可种的地块格里）
 * 着色见 `view-shading.js` 的 `?shade=fieldplots`（GLSL 与 `fieldToneAt()` 是同一套常数）。
 *
 * 不 import THREE / 不碰 view：node 里能直接跑（`tests/field-plot-map.mjs`）。
 */
import { partitionPlots, chevronRow, mulberry32 } from '../core/field-plots.js';

/** 可种地的格：有顶、顶是裸露地形（不是建筑）、不是河道。 */
export function fieldPlotCells(world) {
  const out = [];
  for (const c of world.cells) {
    const t = world.top(c);
    if (!(t > 0)) continue;
    if (world.river && world.river[c.id]) continue;
    if (typeof world.topIsBuilt === 'function' && world.topIsBuilt(c)) continue;
    out.push(c);
  }
  return out;
}

const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 > 1e-12 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

const inPoly = (px, pz, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-12) + xi) inside = !inside;
  }
  return inside;
};

/**
 * 烘一张「地块耕纹图」。
 * @param {object} world  共享 World（要 cells / top / topIsBuilt / river）
 * @param {object} opt    index: view.index（有 cellAt 就快点）；texel: 纹素边长（世界单位）
 */
export function buildFieldPlotField(world, {
  index = null, seed = 5, joinChance = 0.55, maxCells = 8,
  skew = 0.35, bandWidth = 0.55, texel = 0.1, borderWidth = 0.3, pad = 0.4,
} = {}) {
  const cells = fieldPlotCells(world);
  if (!cells.length) return null;
  const byId = new Map(cells.map((c) => [c.id, c]));
  const neighbors = (c) => (c.edgeNeighbors || []).map((id) => (id >= 0 ? byId.get(id) : null)).filter(Boolean);
  const topOf = (c) => world.top(c);
  const { plotOf, plots } = partitionPlots({
    cells, neighbors, seed, joinChance, maxCells,
    same: (a, b) => topOf(a) === topOf(b),
  });

  // 地块边界段：邻格不属于本块（或无邻格）的边上，从格顶点到格顶点
  const borderSegs = new Map();   // cellId → [[ax,az,bx,bz], ...]
  for (const c of cells) {
    const mine = plotOf.get(c.id), segs = [];
    for (let i = 0; i < c.n; i++) {
      const nb = (c.edgeNeighbors || [])[i];
      const other = nb >= 0 ? plotOf.get(nb) : undefined;
      if (other === mine) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      segs.push([a.x, a.z, b.x, b.z]);
    }
    if (segs.length) borderSegs.set(c.id, segs);
  }

  // 世界包围盒（只框住可种格）+ 纹素图
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cells) {
    for (const p of c.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  }
  minX -= pad; minZ -= pad;
  const spanX = maxX - minX + pad, spanZ = maxZ - minZ + pad;
  const w = Math.max(2, Math.ceil(spanX / texel)), h = Math.max(2, Math.ceil(spanZ / texel));
  const data = new Float32Array(w * h * 4);
  const tone = plots.map((p) => 0.5 + 0.5 * Math.sin(p.index * 12.9898 + seed));   // 每块地一点色调差
  const rng = mulberry32(seed * 7 + 3);
  for (let p = 0; p < plots.length; p++) tone[p] = 0.25 + 0.5 * rng();

  // 点 → 格：优先用 view.index.cellAt，其次暴力扫（node 测试）
  const locate = (x, z) => {
    if (index?.cellAt) {
      const c = index.cellAt(x, z);
      return c && byId.has(c.id) ? c : null;
    }
    for (const c of cells) if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && inPoly(x, z, c.pts)) return c;
    return null;
  };

  let filled = 0, maxRow = 0;
  for (let iz = 0; iz < h; iz++) {
    const z = minZ + (iz + 0.5) * texel;
    for (let ix = 0; ix < w; ix++) {
      const x = minX + (ix + 0.5) * texel, o = (iz * w + ix) * 4;
      const c = locate(x, z);
      if (!c) continue;
      const pi = plotOf.get(c.id);
      if (pi === undefined) continue;
      const plot = plots[pi];
      const row = chevronRow(plot, x, z, { skew, width: bandWidth }).row / bandWidth;
      const segs = borderSegs.get(c.id);
      let d = Infinity;
      if (segs) for (const s of segs) d = Math.min(d, segDist(x, z, s[0], s[1], s[2], s[3]));
      data[o] = row;
      data[o + 1] = Number.isFinite(d) ? Math.min(1, d / borderWidth) : 1;
      data[o + 2] = tone[pi];
      data[o + 3] = 1;
      filled++;
      maxRow = Math.max(maxRow, Math.abs(row));
    }
  }

  const axes = plots.map((p) => ({
    index: p.index, cells: p.cells.length, axisRad: p.axis,
    axisDeg: +(((p.axis * 180) / Math.PI + 3600) % 180).toFixed(3),
    cx: +p.cx.toFixed(3), cz: +p.cz.toFixed(3), len: +p.len.toFixed(3), wide: +p.wide.toFixed(3),
  }));

  return {
    w, h, texel, minX, minZ, spanX: w * texel, spanZ: h * texel,
    data, plots: axes, count: cells.length, filled, maxRow, bandWidth, skew,
    borders: borderSegs.size,
  };
}

/** CPU 孪生：点到纹素中心取行号（着色器里是四抽头双线性，这里给最近纹素，判据用得到）。 */
export function fieldPlotAt(field, x, z) {
  const ix = Math.floor((x - field.minX) / field.texel), iz = Math.floor((z - field.minZ) / field.texel);
  if (ix < 0 || iz < 0 || ix >= field.w || iz >= field.h) return null;
  const o = (iz * field.w + ix) * 4, d = field.data;
  if (d[o + 3] < 0.5) return null;
  return { row: d[o], border: d[o + 1], tone: d[o + 2] };
}

/**
 * CPU 孪生（= GLSL `shFieldPlot` 的同一套常数）：
 * 明暗 = 1 + contrast·(cos(2π·fract(row)) − …)；田埂把颜色压暗；每块地再乘一点色调。
 */
export function fieldToneAt(field, x, z, { contrast = 0.2, borderInk = 0.2, toneMix = 0.35 } = {}) {
  const s = fieldPlotAt(field, x, z);
  if (!s) return 1;
  const band = 0.5 + 0.5 * Math.cos(2 * Math.PI * s.row);
  const ink = 1 - Math.min(1, Math.max(0, s.border / 0.22));
  const plotTone = 1 + 0.12 * (s.tone - 0.5) * 2 * toneMix;   // 每块地一点整体色调差
  return (1 + contrast * (band * 2 - 1)) * (1 - borderInk * ink) * plotTone;
}

/** 两地块主轴夹角（度，0–90）。 */
export function axisSpreadDeg(axes) {
  let maxD = 0, pairs = 0;
  for (let i = 0; i < axes.length; i++) for (let j = i + 1; j < axes.length; j++) {
    let d = Math.abs(axes[i].axisDeg - axes[j].axisDeg) % 180;
    if (d > 90) d = 180 - d;
    maxD = Math.max(maxD, d); pairs++;
  }
  return { maxDeg: +maxD.toFixed(3), pairs };
}

/** 与 `view-shading.js` 里 `uShFPP` 同口径的 uniform 值。 */
export function fieldPlotUniforms(field, { contrast = 0.2, borderInk = 0.2 } = {}) {
  return { extent: [field.minX, field.minZ, 1 / (field.w * field.texel), 1 / (field.h * field.texel)], size: [field.w, field.h, contrast, borderInk] };
}
