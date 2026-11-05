/**
 * terrainmesh.js — 地形管线的网格：把 World 里的岩石体素画成崖壁、岩层、台地顶。
 *
 * 和建筑写进同一个 MeshWriter（同一次 AO 烘焙、同一个 draw call）。
 *   - 崖壁：岩石色，按层交替明暗 + 每两层一道深色岩层缝（1699038611125985317 沉积线）
 *   - 台地顶：平坦处苔 / 草，靠崖边是沙，贴水的 1 层是沙滩；河道是水色、略低
 *   - 崖顶暖色亮边：顶面边缘一条向外倾的窄条，接住主光（参考片里最显眼的一条线）
 *   - 洞窟顶：岩石段下面是空的 → 深色顶棚
 *
 * 所有顶点位置都经过 shape.at(p, 切面)（见 shape.js：层级平滑 + 笼形变形），
 * 崖壁第 lv 段连接切面 lv-1 和 lv，台地顶在切面 top，所以变形后网格仍然闭合。
 *
 * 本地顶面混色：每个顶面画成扇形；1781405550061687016展示的投影贴图/手工UV patch不等同此方法，
 * 中心是本格的颜色，角上是"共用这个角、同一高度的所有顶面颜色"的平均 → 草、苔、沙之间柔和过渡，
 * 不再是一块块拼色。
 *
 * 草皮垂过崖边（1696896119794479541 "the grass blotches bleed over the cliff edges"）：
 * 草顶面的崖边，沿崖面往下垂一段圆润的草色"舌头"，深浅由噪声决定，不是每段都有。
 *
 * 岩层线（1699146321318314094）："make the whole world wobbly, do the texturing math, then
 * simply undo the wobble" —— 这里每层一条线，高度 = 层中线 + 世界空间噪声(x, z)，
 * 这是保留的旧窄条近似；新strata着色读取岩壁mask与core/sediment.js世界剪切坐标，几何保持原位。
 */

import { TERRAIN } from '../core/palette.js';
import { fbm, hash01 } from '../core/noise.js';
import { UP, DOWN, edgeOut } from '../core/meshwriter.js';

export function buildTerrain(w, world, { L, shape = null }) {
  const cells = world.cells;
  const grid = world.grid;
  const K = Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, w.c(v)]));
  const nbr = (c, i) => world.neighbor(c, i);
  const solid = (c, lv) => c !== null && world.isSolid(c, lv);
  let count = 0;
  const at = shape ? (p, sl) => shape.at(p, sl) : (p) => [p.x, p.z];
  const P = (p, sl, y) => { const [x, z] = at(p, sl); return [x, y, z]; };
  // 崖面上高度 y 处的点：在下、上两个切面之间插值（崖壁收分、扭动后不再竖直）
  const wallAt = (p, lv, y) => {
    // 1579478470098243584: reuse the shared continuous cage sampler for strata.
    // Keep compatibility with custom shapes that only support integer planes.
    if (shape?.continuous) return P(p, Math.max(lv-1, Math.min(lv, y/L)), y);
    const [x0, z0] = at(p, lv - 1), [x1, z1] = at(p, lv);
    const t = Math.min(1, Math.max(0, y / L - (lv - 1)));
    return [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t];
  };
  const wob = (x, z) => (fbm(x * 0.32 + 5, z * 0.32 + 11, { octaves: 3, freq: 1.4, seed: 23 }) - 0.5) * 0.36 * L;

  // 第一遍：每格顶面的颜色（混色要用到邻居的）
  const capOf = new Array(cells.length).fill(null);
  for (const c of cells) {
    const g = world.ground(c);
    if (!g || world.isSolid(c, g + 1)) continue;
    let flat = true, drop = 0;
    for (let i = 0; i < c.n; i++) {
      const o = nbr(c, i);
      const og = o ? world.top(o) : 0;
      if (og !== g) flat = false;
      drop = Math.max(drop, g - og);
    }
    let cap, kind;
    if (world.river[c.id]) { cap = K.river; kind = 'river'; }
    else if (g <= 1) { cap = hash01(c.id) < 0.5 ? K.sand : K.sandBright; kind = 'sand'; }
    else if (flat) {
      const patch = fbm(c.cx * 0.5 + 40, c.cz * 0.5 + 12, { octaves: 2, freq: 1.6, seed: 77 });
      cap = patch > 0.58 ? K.moss : patch > 0.42 ? K.grass : K.grassDeep; kind = 'grass';
    } else if (drop >= 2) { cap = K.sand; kind = 'dry'; }
    else { cap = K.mossDeep; kind = 'grass'; }
    capOf[c.id] = { g, kind, color: cap.clone().multiplyScalar(0.97 + 0.06 * hash01(c.id * 3)) };
  }
  // 角上的混色：共用这个角、同一高度、同一种"非河道"顶面的平均
  const cornerColor = (c, p) => {
    const me = capOf[c.id];
    if (me.kind === 'river') return me.color;
    const acc = me.color.clone(); let n = 1;
    for (const id of grid.vertexCells.get(p.id) || []) {
      if (id === c.id) continue;
      const o = capOf[id];
      if (!o || o.g !== me.g || o.kind === 'river') continue;
      acc.add(o.color); n++;
    }
    return acc.multiplyScalar(1 / n);
  };

  for (const c of cells) {
    const g = world.ground(c);
    if (!g) continue;
    w.at?.(c);   // 分块路由
    count++;
    const tone = fbm(c.cx * 0.35 + 9, c.cz * 0.35 + 4, { octaves: 2, freq: 1.3, seed: 17 });
    const wallBase = tone > 0.55 ? K.rockPale : K.rock;

    // aField.z: -1 rock wall, -2 legacy raised stripe; +1 field top, 0 other.
    w.fieldFrame = [0,0,-1];
    // 崖壁
    for (let i = 0; i < c.n; i++) {
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const [nx, nz] = edgeOut(c, i);
      const out = [nx, 0, nz];
      const o = nbr(c, i);
      for (let lv = 1; lv <= g; lv++) {
        if (!world.isRock(c, lv) || solid(o, lv)) continue;
        const y0 = (lv - 1) * L, y1 = lv * L;
        const col = lv === 1 ? K.rockDark : wallBase;
        const shade = (lv % 2 ? 0.93 : 1.0) * (0.96 + 0.05 * hash01(c.id * 31 + lv));
        w.soft = true;
        w.quad(P(a, lv - 1, y0), P(b, lv - 1, y0), P(b, lv, y1), P(a, lv, y1), out, col, shade, 0, shade);
        w.soft = false;
        if (lv >= 2) {
          // 起伏的沉积线：贴在崖面外侧一点点
          const s2 = 0.011, e = 0.006;
          const ya = y0 + 0.5 * L + wob(a.x, a.z), yb = y0 + 0.5 * L + wob(b.x, b.z);
          const off = (q) => [q[0] + nx * e, q[1], q[2] + nz * e];
          w.fieldFrame = [0,0,-2];
          w.quad(off(wallAt(a, lv, ya - s2)), off(wallAt(b, lv, yb - s2)), off(wallAt(b, lv, yb + s2)), off(wallAt(a, lv, ya + s2)), out, K.strata, 0.9);
          w.fieldFrame = [0,0,-1];
        }
      }
    }

    w.fieldFrame = null;
    // 洞窟顶：岩石段的底下是空的
    for (let lv = 2; lv <= g; lv++) {
      if (world.isRock(c, lv) && !world.isSolid(c, lv - 1)) {
        w.poly(c.pts.map((p) => P(p, lv - 1, (lv - 1) * L)), DOWN, K.rockDark, 0.55);
      }
    }
    // 悬垂 / 石拱下面的那块地：岩石段的顶面上方是空的，但不是最上面一段（1671808851895627776）
    for (let lv = 1; lv < g; lv++) {
      if (world.isRock(c, lv) && !world.isSolid(c, lv + 1)) {
        w.poly(c.pts.map((p) => P(p, lv, lv * L)), UP, lv <= 1 ? K.sand : K.mossDeep, 0.72);
      }
    }

    // 顶面（上面没有东西时）：扇形，中心本色、角上混色
    if (world.isSolid(c, g + 1)) continue;
    const me = capOf[c.id];
    let y = g * L;
    if (me.kind === 'river') y -= 0.06;
    const ring = c.pts.map((p) => P(p, g, y));
    const ctr = [ring.reduce((s, q) => s + q[0], 0) / c.n, y, ring.reduce((s, q) => s + q[2], 0) / c.n];
    const cc = c.pts.map((p) => cornerColor(c, p));
    const fieldAngle = hash01(c.id * 19 + 5) * Math.PI;
    // Only exposed, non-river rock tops: no fields on roofs, walls or river water.
    w.fieldFrame = me.kind === 'river' ? null : [Math.cos(fieldAngle), Math.sin(fieldAngle)];
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      w.triC(ctr, ring[i], ring[j], UP, me.color, cc[i], cc[j]);
    }

    w.fieldFrame = null;

    // 草皮垂过崖边：草顶面、邻居更低的边，沿崖面垂下一段圆润的"舌头"
    if ((me.kind === 'grass' || me.kind === 'dry') && g >= 2) {
      for (let i = 0; i < c.n; i++) {
        const o = nbr(c, i);
        const og = o ? world.top(o) : 0;
        if (og >= g) continue;
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const amt = fbm(mx * 0.9 + 21, mz * 0.9 + 5, { octaves: 2, freq: 1.5, seed: 131 });
        if (amt < 0.42) continue;
        const depth = L * (0.12 + 0.55 * (amt - 0.42));
        const [nx, nz] = edgeOut(c, i);
        const e = 0.007;
        const top = (u) => { const A = wallAt(a, g, g * L), B = wallAt(b, g, g * L); return [A[0] + (B[0] - A[0]) * u + nx * e, g * L + 0.002, A[2] + (B[2] - A[2]) * u + nz * e]; };
        const at2 = (u, yy) => { const A = wallAt(a, g, yy), B = wallAt(b, g, yy); return [A[0] + (B[0] - A[0]) * u + nx * e, yy, A[2] + (B[2] - A[2]) * u + nz * e]; };
        const S = 6, drape = me.color.clone().multiplyScalar(0.9);
        for (let k = 0; k < S; k++) {
          const u0 = k / S, u1 = (k + 1) / S;
          // 两端收成圆头：深度 = depth × sin(πu)^0.6，再叠一点小起伏
          const d = (u) => depth * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.85 + 0.3 * hash01(Math.round((mx + u) * 97) + c.id));
          w.quad(top(u0), top(u1), at2(u1, g * L - d(u1)), at2(u0, g * L - d(u0)), [nx, 0, nz], drape, 1);
        }
      }
    }

    // 崖顶暖色亮边 / 河岸
    for (let i = 0; i < c.n; i++) {
      const o = nbr(c, i);
      const og = o ? world.top(o) : 0;
      if (og >= g && !(world.river[c.id] && o && !world.river[o.id])) continue;
      const [ax, az] = at(c.pts[i], g), [bx, bz] = at(c.pts[(i + 1) % c.n], g);
      const [nx, nz] = edgeOut(c, i);
      if (world.river[c.id]) {
        w.quad([ax, y, az], [bx, y, bz], [bx, g * L, bz], [ax, g * L, az], [-nx, 0, -nz], K.riverBank, 0.9);
        continue;
      }
      const inw = 0.042, drop2 = 0.05;
      w.quad([ax + nx * 0.004, y - drop2, az + nz * 0.004], [bx + nx * 0.004, y - drop2, bz + nz * 0.004],
        [bx - nx * inw, y + 0.002, bz - nz * inw], [ax - nx * inw, y + 0.002, az - nz * inw], [nx, 0.8, nz], K.lip, 1.04);
    }
  }
  return { cells: count };
}
