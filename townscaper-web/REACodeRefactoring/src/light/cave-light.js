/**
 * cave-light.js — 洞里比洞外暗一档 + 洞口渐变（906416813810049025 的「洞内光照」那一层）。
 *
 * 原片 f0000–f0299 的洞是可穿的山体拱洞：站在外面能看见洞里是**一片暗**，
 * 越往里越暗，洞口那一圈还留着一档天光（洞口内侧沿边缘有一道亮边、往里立刻沉下去）。
 * 本仓原来只有 bakeLighting 的体素 AO：洞底在地形顶点色里确实略暗，但
 *   ① 只按「周围多少格是岩石」算一次，洞身中段与洞口差不出「一档」；
 *   ② 洞口没有渐变，看到的是一条硬边。
 * 所以这里补两层，都是**几何量**（不靠美术资产）：
 *
 *   1. 洞身（roofed 部分）整片压暗 `strength`（默认 0.46 = 亮度掉一档多）；
 *   2. 沿洞轴从洞口往里 `ramp` 格（默认 1.6 格）做 smoothstep 渐变 —— 洞口 factor=1，
 *      到 ramp 处 factor=1-strength。穿山拱两端都是洞口，取两端距离的较小值（中间最暗）。
 *
 * 第 241 轮补**面朝向判据**：r240 的像素账证明只按「y 带 + 横向距洞轴 ≤ 半宽」这个柱体判据，
 * 会把贴着洞口的**外立面**（朝外的那一整面岩壁）一起压暗 —— 柱体不是洞。
 * 现在每个顶点还要按法线走 0.12 格探一步：探针落进「被挖掉的隧道格」才算洞内表面
 * （侧壁/地板/洞顶的法线都朝洞内 → 命中；外立面法线朝外 → 落在洞外 → 不压暗）。
 * 没给法线时（node 侧老调用）退回纯柱体判据，行为与 r239 一致。
 *
 * 只吃 `world.bnCaves`（island-caves.js 挖出来的隧道：`{cells, floor, through}`）
 * 与体素位，不改世界、不改导航；`applyCaveLight()` 在 bake 之后按顶点坐标乘色。
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** 隧道两端凡是「贴着洞外同高地面」的那头就是洞口。 */
function mouthEnds(world, cells, floor, set) {
  const ends = [];
  const isMouth = (c) => c.edgeNeighbors.some((id) => id >= 0 && !set.has(id) && world.top(world.cells[id]) === floor);
  if (cells.length && isMouth(world.cells[cells[0]])) ends.push('head');
  if (cells.length > 1 && isMouth(world.cells[cells[cells.length - 1]])) ends.push('tail');
  if (!ends.length && cells.length === 1 && isMouth(world.cells[cells[0]])) ends.push('head');
  return ends;
}

/**
 * 建遮蔽计划。`world.bnCaves` 为空时返回 null（默认场景零影响）。
 * @returns {?{tunnels:Array, strength:number, ramp:number, L:number, halfWidth:number}}
 */
export function planCaveLight(world, { strength = 0.46, ramp = 1.6, L = 0.5 } = {}) {
  const tunnels = world?.bnCaves;
  if (!Array.isArray(tunnels) || !tunnels.length) return null;
  if (!(strength >= 0 && strength <= 1)) throw new RangeError('invalid cave light strength');
  if (!(ramp > 0)) throw new RangeError('invalid cave light ramp');
  const out = [], seen = new Set();
  for (const t of tunnels) {
    const ids = (t.cells || []).filter((id) => Number.isInteger(id) && !seen.has(id));
    if (!ids.length) continue;
    const set = new Set(ids);
    for (const id of ids) seen.add(id);
    const floor = t.floor ?? 1;
    const mouths = mouthEnds(world, ids, floor, set);
    // 折线从洞口那头开始，方便用「离洞口多远」当渐变参数
    const ordered = mouths.includes('tail') && !mouths.includes('head') ? ids.slice().reverse() : ids.slice();
    const poly = ordered.map((id) => { const c = world.cells[id]; return { x: c.cx, z: c.cz }; });
    // 洞体格矩形（面朝向判据的落点表：探针落在这些矩形里 = 探针在洞里）
    const rects = ordered.map((id) => {
      const c = world.cells[id];
      return { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ };
    });
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].z - poly[i - 1].z));
    const len = cum[cum.length - 1];
    // 两端都是洞口时，最暗点在中点，ramp 不能超过半长 —— 否则「渐变」会被两侧互相盖掉
    const rampHalf = mouths.length >= 2 ? Math.max(0.2, Math.min(ramp, len / 2)) : Math.max(0.2, Math.min(ramp, len));
    // 洞身横向半宽：用隧道格的包围盒算，别硬编码格距
    let hw = 0;
    for (const id of ordered) { const c = world.cells[id]; hw = Math.max(hw, (c.maxX - c.minX) / 2, (c.maxZ - c.minZ) / 2); }
    out.push({ cells: ordered, floor, poly, cum, len, ramp: rampHalf, mouthCount: mouths.length, halfWidth: hw * 1.15 + 0.05, strength, rects });
  }
  if (!out.length) return null;
  return { tunnels: out, strength, ramp, L, halfWidth: Math.max(...out.map((t) => t.halfWidth)) };
}

/** 点 (x,y,z) 是否落在某条隧道被挖掉的**空腔**里（矩形 + 洞高区间）。面朝向判据用。 */
export function insideTunnel(plan, x, z, y = null, margin = 0) {
  if (!plan) return false;
  for (const t of plan.tunnels) {
    if (y != null) {
      const lo = t.floor * plan.L + 0.02, hi = (t.floor + 2) * plan.L - 0.02;
      if (!(y > lo && y < hi)) continue;
    }
    for (const r of t.rects) {
      if (x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin) return true;
    }
  }
  return false;
}

/** 探针步长（格宽 0.5 的 1/4）：沿法线探一步就够分清「朝洞里」还是「朝洞外」。 */
const FACE_PROBE = 0.12;

/**
 * 面朝向：沿**三维**法线探 0.12 格，落进隧道空腔 = 这一面朝洞内。
 *  - 侧壁：水平法线朝轴 → 探针仍在同一格空腔里；
 *  - 地板（朝上）：探针抬高 0.12，仍在洞高区间内；
 *  - 洞顶（朝下）：探针压低 0.12，同样在洞高区间内；
 *  - 洞顶**上表面**（y = (floor+2)·L 的屋顶地面，法线也朝上）：探针抬到洞外 → 不算洞内（r240 的 24 个误压顶点就是这种）；
 *  - 贴洞口的外立面（法线朝外）：探针落到洞体格矩形外 → 不算洞内。
 */
export function facesCave(plan, x, y, z, nx, ny, nz) {
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-6) return true;   // 无法线可用：退回柱体口径
  return insideTunnel(plan, x + (nx / l) * FACE_PROBE, z + (nz / l) * FACE_PROBE, y + (ny / l) * FACE_PROBE, 0.02);
}

/**
 * 某点到计划里所有隧道的「亮度系数」；洞外/洞顶上方一律 1。
 * @param {?number[]} n 顶点法线（给定时加面朝向判据；不给 = 老口径，纯柱体）
 */
export function caveShadeAt(plan, x, y, z, n = null) {
  if (!plan) return 1;
  if (n && !facesCave(plan, x, y, z, n[0], n[1], n[2])) return 1;   // 朝洞外的面（外立面 / 洞顶上表面）不压暗
  let best = 1;
  const { L } = plan;
  for (const t of plan.tunnels) {
    const lo = t.floor * L - 0.02, hi = (t.floor + 2) * L + 0.02;
    if (!(y > lo && y < hi)) continue;   // 洞顶上面/地板下面不算洞内
    let bd = Infinity, s = 0;
    for (let i = 1; i < t.poly.length; i++) {
      const ax = t.poly[i - 1].x, az = t.poly[i - 1].z;
      const bx = t.poly[i].x, bz = t.poly[i].z;
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const u = clamp01(((x - ax) * dx + (z - az) * dz) / l2);
      const px = ax + dx * u, pz = az + dz * u;
      const d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; s = t.cum[i - 1] + u * Math.hypot(dx, dz); }
    }
    if (t.poly.length === 1) bd = Math.hypot(x - t.poly[0].x, z - t.poly[0].z);
    if (!(bd <= t.halfWidth)) continue;
    const sEff = t.mouthCount >= 2 ? Math.min(s, t.len - s) : s;
    const f = 1 - t.strength * smoothstep(sEff / t.ramp);
    if (f < best) best = f;
  }
  return best;
}

/** 在 bake 之后按顶点乘色（只乘 col，不动 pos / normal）。返回被压暗的顶点数。 */
export function applyCaveLight(w, plan, normals = w?.normal, stats = null) {
  if (!plan || !w?.pos || !w?.col) return 0;
  let n = 0;
  for (let i = 0; i < w.pos.length; i += 3) {
    const f0 = caveShadeAt(plan, w.pos[i], w.pos[i + 1], w.pos[i + 2]);
    if (f0 >= 0.999) continue;                       // 柱体判据就没命中：洞外，直接跳过
    // 有法线才判朝向：柱体命中但面朝洞外（贴着洞口的外立面）→ 保持原色
    const nv = normals ? [normals[i], normals[i + 1], normals[i + 2]] : null;
    const f = nv ? caveShadeAt(plan, w.pos[i], w.pos[i + 1], w.pos[i + 2], nv) : f0;
    if (f >= 0.999) { if (stats) stats.rejected++; continue; }
    w.col[i] *= f; w.col[i + 1] *= f; w.col[i + 2] *= f; n++;
  }
  if (stats) stats.shaded = (stats.shaded || 0) + n;
  return n;
}

/** 页面/测试用的读数：每条隧道几个洞格、多长、洞口与最暗处系数各是多少。 */
export function caveLightReport(plan) {
  if (!plan) return { tunnels: 0 };
  // 中点按**沿轴弧长**取（隧道会拐弯，首尾连线的中点可能落到洞口附近甚至洞外）
  const alongMid = (t) => {
    const s = t.len / 2;
    for (let i = 1; i < t.poly.length; i++) {
      if (t.cum[i] >= s || i === t.poly.length - 1) {
        const seg = Math.max(1e-6, t.cum[i] - t.cum[i - 1]), u = Math.max(0, Math.min(1, (s - t.cum[i - 1]) / seg));
        return { x: t.poly[i - 1].x + (t.poly[i].x - t.poly[i - 1].x) * u, z: t.poly[i - 1].z + (t.poly[i].z - t.poly[i - 1].z) * u };
      }
    }
    return t.poly[0];
  };
  const ts = plan.tunnels.map((t) => {
    const mid = t.poly.length > 1 ? alongMid(t) : t.poly[0];
    const yMid = (t.floor + 0.5) * plan.L;
    return {
      floor: t.floor, cells: t.cells.length, len: +t.len.toFixed(3), ramp: +t.ramp.toFixed(3),
      mouths: t.mouthCount, halfWidth: +t.halfWidth.toFixed(3),
      atMouth: +caveShadeAt(plan, t.poly[0].x, yMid, t.poly[0].z).toFixed(4),
      atMid: +caveShadeAt(plan, mid.x, yMid, mid.z).toFixed(4),
      aboveRoof: +caveShadeAt(plan, mid.x, (t.floor + 3) * plan.L + 0.25, mid.z).toFixed(4),
    };
  });
  return { tunnels: ts.length, strength: plan.strength, ramp: plan.ramp, cells: ts.reduce((a, t) => a + t.cells, 0), ts };
}

/** URL 开关：`?cavelight=0` 关掉（缺省开）。node 里恒为 true。 */
export function caveLightFromUrl() {
  const v = globalThis.location?.search;
  if (v == null) return true;
  return new URLSearchParams(v).get('cavelight') !== '0';
}
