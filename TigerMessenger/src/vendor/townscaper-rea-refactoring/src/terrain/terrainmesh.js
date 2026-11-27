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
 * 纯纹理灌木（1707490932017279035 / 1707497006640365880）：顶面扇形写 aEdge（到崖边距离），灌木全在着色器里画（shrub-texture.js）。
 *
 * 岩层线（1699146321318314094）："make the whole world wobbly, do the texturing math, then
 * simply undo the wobble" —— 这里每层一条线，高度 = 层中线 + 世界空间噪声(x, z)，
 * 这是保留的旧窄条近似；新strata着色读取岩壁mask与core/sediment.js世界剪切坐标，几何保持原位。
 */

import { TERRAIN, BUILD } from '../core/palette.js';
import { fbm, hash01 } from '../core/noise.js';
import { UP, DOWN, edgeOut } from '../core/meshwriter.js';
import { footprintFor, splicePolygon } from '../build/splice.js';
import { softCorners } from './soft-tops.js';
import { liveLakes } from './drainage.js';
import { shrubEdgeFlags } from './shrub-edges-c09.js';
import { shrubBandMul } from './shrub-band.js';
import { SHRUB_DEFAULT_STYLE } from './shrub-texture.js';
import { prepareFootprintSplices, emitFootprintSplices } from '../build/splice-polygon-c09.js';

export function buildTerrain(w, world, { L, shape = null }) {
  const cells = world.cells;
  const grid = world.grid;
  const K = Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, w.c(v)]));
  const nbr = (c, i) => world.neighbor(c, i);
  const solid = (c, lv) => c !== null && world.isSolid(c, lv);
  let count = 0;
  const splices = [];
  // 第 69 轮：崖面垂挂段的实测统计（灌木色段 vs 草皮段的数量与最大垂深），由测试直接读。
  const drapeStats = { shrub: 0, grass: 0, shrubMaxDepth: 0, grassMaxDepth: 0, fullFace: 0 };
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
  // r55 (1447488323845509121 seamless soft slopes + sharp cliffs): optional continuous top surface, default off.
  const soft = world.softTops ? softCorners(world, { L }) : null;
  const altered = (c, a, b, o) => !!soft && (soft.has(c.id, a.id) || soft.has(c.id, b.id) || (!!o && (soft.has(o.id, a.id) || soft.has(o.id, b.id))));
  const WP = (p, y) => shape?.continuous ? P(p, Math.max(0, y / L), y) : P(p, Math.max(0, Math.round(y / L)), y);
  // r55: exact copy of the emitted wall quads / top fans for collision (terrain/terrain-collide.js) and
  // final-bevel consistency checks (core/terrace-edges.js); only when world.terrainCollide is set.
  const rec = world.terrainCollide ? { walls: [], tops: [], L } : null;
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

  // r56 C09 · 1584623053061099520：world.spliceFootprintsC09（任意轮廓占地）→ 跳过被重网格的扇形三角，循环后写新三角 + 房子；未设 = null
  const fpSpl = prepareFootprintSplices(world, { L, at });
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
      if (altered(c, a, b, o)) {
        // soft-slope corners: one quad per exposed level, stretched between the neighbour's surface (Yb) and ours (Yt)
        const og = o ? world.ground(o) : 0;
        if (og >= g) {
          // same-level neighbour whose corner heights differ (mixed vertex: non-plain cell stayed fixed,
          // or a different soft group): no wall would cover the gap between the two fans — fill it once.
          if (og === g && o && c.id < o.id) {
            const lo = [Math.min(soft.y(c.id, a.id) ?? g * L, soft.y(o.id, a.id) ?? g * L), Math.min(soft.y(c.id, b.id) ?? g * L, soft.y(o.id, b.id) ?? g * L)];
            const hi = [Math.max(soft.y(c.id, a.id) ?? g * L, soft.y(o.id, a.id) ?? g * L), Math.max(soft.y(c.id, b.id) ?? g * L, soft.y(o.id, b.id) ?? g * L)];
            if (hi[0] - lo[0] > 1e-9 || hi[1] - lo[1] > 1e-9) {
              const q = [WP(a, lo[0]), WP(b, lo[1]), WP(b, hi[1]), WP(a, hi[0])];
              w.soft = true; w.quad(...q, out, wallBase, 1.0, 0, 1.0); w.soft = false;
              rec?.walls.push({ cell: c.id, edge: i, lv: g, q, out, fill: true });
            }
          }
          continue;
        }
        const Yt = [soft.y(c.id, a.id) ?? g * L, soft.y(c.id, b.id) ?? g * L];
        const Yb = [o ? soft.y(o.id, a.id) ?? og * L : 0, o ? soft.y(o.id, b.id) ?? og * L : 0];
        if (Math.abs(Yt[0] - Yb[0]) < 1e-9 && Math.abs(Yt[1] - Yb[1]) < 1e-9) continue;   // linked: seamless slope
        for (let lv = og + 1; lv <= g; lv++) {
          const span = (k) => { const lo = Math.min(Yb[k], og * L), hi = Yt[k]; let y0 = lv === og + 1 ? lo : (lv - 1) * L, y1 = lv === g ? hi : lv * L; y0 = Math.max(lo, Math.min(y0, hi)); y1 = Math.max(y0, Math.min(y1, hi)); return [y0, y1]; };
          const [a0, a1] = span(0), [b0, b1] = span(1);
          if (a1 - a0 < 1e-9 && b1 - b0 < 1e-9) continue;
          const col = lv === 1 ? K.rockDark : wallBase, shade = (lv % 2 ? 0.93 : 1.0) * (0.96 + 0.05 * hash01(c.id * 31 + lv));
          const q = [WP(a, a0), WP(b, b0), WP(b, b1), WP(a, a1)];
          w.soft = true; w.quad(...q, out, col, shade, 0, shade); w.soft = false;
          rec?.walls.push({ cell: c.id, edge: i, lv, q, out });
        }
        continue;
      }
      for (let lv = 1; lv <= g; lv++) {
        if (!world.isRock(c, lv) || solid(o, lv)) continue;
        const y0 = (lv - 1) * L, y1 = lv * L;
        const col = lv === 1 ? K.rockDark : wallBase;
        const shade = (lv % 2 ? 0.93 : 1.0) * (0.96 + 0.05 * hash01(c.id * 31 + lv));
        w.soft = true;
        w.quad(P(a, lv - 1, y0), P(b, lv - 1, y0), P(b, lv, y1), P(a, lv, y1), out, col, shade, 0, shade);
        w.soft = false;
        rec?.walls.push({ cell: c.id, edge: i, lv, q: [P(a, lv - 1, y0), P(b, lv - 1, y0), P(b, lv, y1), P(a, lv, y1)], out });
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
    const ring = c.pts.map((p) => { const ys = soft?.y(c.id, p.id); return ys === undefined ? P(p, g, y) : P(p, ys / L, ys); });
    // soft tops: centre at the mean corner height so the fan is a gentle cone, not a pit/peak at level·L
    const yc = soft && c.pts.some((p) => soft.has(c.id, p.id)) ? ring.reduce((s, q) => s + q[1], 0) / c.n : y;
    const ctr = [ring.reduce((s, q) => s + q[0], 0) / c.n, yc, ring.reduce((s, q) => s + q[2], 0) / c.n];
    const cc = c.pts.map((p) => cornerColor(c, p));
    const fieldAngle = hash01(c.id * 19 + 5) * Math.PI;
    // Only exposed, non-river rock tops: no fields on roofs, walls or river water.
    w.fieldFrame = me.kind === 'river' ? null : [Math.cos(fieldAngle), Math.sin(fieldAngle)];
    // 1707490932017279035「100% texture, painted onto a fairly low poly mesh」：灌木不是几何，是顶面着色。
    // 这里只给顶面扇形每个顶点写「到崖边的归一化距离」：边 i 外侧更低（崖 / 台地边，非河）→ 该边两端 0、格心 1；
    // 角落在另一条崖边上的也记 0（与相邻扇形沿辐条连续）。着色见 src/terrain/shrub-texture.js。
    const shrubby = me.kind === 'grass' || me.kind === 'dry';   // 沙滩 / 河道不长（原片沙岸一圈是空的）
    // 「东西的边上」：台地边 / 崖顶，不含临海；r56 C09：world.shrubFootC09 时再加崖脚 / 墙根（shrub-edges-c09.js，默认关 = 旧式）
    const cliff = shrubEdgeFlags(world, c, g, shrubby);
    const cornerOnCliff = (i) => cliff[i] || cliff[(i - 1 + c.n) % c.n];
    // 第 49 轮（原片：高崖顶的灌木带宽、矮台地边窄）：本格最大落差越大，格心那一端的距离值越小 → 着色器同一宽度阈值盖住更多格面。
    // 第 65 轮（原片 frame-0040 原尺寸）：带宽是**逐边**的 —— 同一格一边是 5 层崖、另一边是 1 层台阶时，
    //   宽的那边带子明显粗、窄的那边只有一条发丝。旧写法取全格 maxDrop 一起放大，等于把最陡那条边的宽度
    //   抹到了所有边上。现在每个顶面三角（ctr, ring[i], ring[j] 张的是第 i 条边）只按第 i 条边自己的落差缩放。
    // 1 层落差 = 1（原样），每多 1 层带宽 +35%，封顶 1.8 倍（再宽会盖满小格）。
    const edgeDrop = new Array(c.n).fill(0);
    for (let i = 0; i < c.n; i++) if (cliff[i]) { const o = nbr(c, i); edgeDrop[i] = Math.max(0, g - (o ? world.top(o) : 0)); }
    // 第 70 轮（原片 1707497006640365880 frame-0420 原尺寸 + 3× 裁切）：落差档是**四档**，不是连续缩放。
    //   1 层 = 一条发丝边；2 层 ≈ 1.35×；3 层 ≈ 1.75×；**≥4 层整面覆盖**（左塔顶整片橙色、外缘就是崖沿本身）。
    //   旧写法封顶 1/1.8=0.556，最深的崖也只有 44% 面宽被盖住，永远到不了原片那种「整顶橙」。
    //   所以「大幅覆盖档」现在是按该边落差自动选的，不用手动把 width 调过 0.9。
    const centreFor = (dp) => (dp >= 4 ? -1 : 1 / Math.min(1.8, 1 + 0.35 * Math.max(0, dp - 1)));
    if (edgeDrop.some((dp) => dp >= 4)) drapeStats.fullFace += edgeDrop.filter((dp) => dp >= 4).length;
    const splice = me.kind === 'river' ? null : world.splicedHouses?.get(c.id);
    if (splice) {
      // 1584623053061099520: house spliced into the terrain cell — ring patch + sunk footprint (src/build/splice.js).
      const outer = ring.map((q) => ({ x: q[0], z: q[2] })), inner = footprintFor(outer, { inset: splice.inset }), cut = splicePolygon(outer, inner);
      for (const t of cut.tris) w.tri(...t.pts.map((q) => [q.x, y, q.z]), UP, me.color, 1);
      const y0 = y - splice.sink, y1 = y + splice.stories * L * 0.8, wallC = w.c(BUILD.plaster), roofC = w.c(BUILD.roof);
      const hc = { x: inner.reduce((s2, p) => s2 + p.x, 0) / inner.length, z: inner.reduce((s2, p) => s2 + p.z, 0) / inner.length };
      for (let i = 0; i < inner.length; i++) {
        const a = inner[i], b = inner[(i + 1) % inner.length], mx = (a.x + b.x) / 2 - hc.x, mz = (a.z + b.z) / 2 - hc.z, l = Math.hypot(mx, mz) || 1;
        w.quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], [mx / l, 0, mz / l], wallC, 0.97);
      }
      const rise = Math.min(...inner.map((p) => Math.hypot(p.x - hc.x, p.z - hc.z))) * 1.1;
      for (let i = 0; i < inner.length; i++) { const a = inner[i], b = inner[(i + 1) % inner.length]; w.tri([a.x, y1, a.z], [b.x, y1, b.z], [hc.x, y1 + rise, hc.z], UP, roofC, 1); }
      splices.push({ cell: c.id, outer, inner, ...cut, y, y0, y1 });
    } else {
    // 第 99 轮 · 逐三角带宽（原片同落差的两条边宽度差 1.5–1.9×、且沿一条边恒定）：每个顶面三角倍率
    //   由 hash(格 id, 边号, 层号) 决定（src/terrain/shrub-band.js），三个顶点同值 → 插值后沿三角恒定。
    //   `world.shrubBandPerEdge === false` 时退回 1（逐位等于旧画面），用于截图对照。
    const bandOn = world.shrubBandPerEdge !== false;
    let bandN = 0;
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      if (fpSpl?.skip.has(c.id * 64 + i)) continue;
      const ce = centreFor(edgeDrop[i]);
      // 整面覆盖档（ce = -1）：三个角一起写 -1，着色器据此「整片顶面直接长灌木」，不再走崖边带那条阈值线，
      //   否则 -1 与崖角 0 插值会在面中间插出一条假的灌木边界（原片宽档是实的、边界就是崖沿）。
      w.edgeTri = ce < 0 ? [-1, -1, -1] : [ce, cornerOnCliff(i) ? 0 : ce, cornerOnCliff(j) ? 0 : ce];
      // 整面档不吃逐三角倍率（那一档根本不走宽度阈值，宽度无意义）。
      w.bandTri = bandOn && ce >= 0 ? shrubBandMul(c.id, i, g) : 1;
      if (w.bandTri !== 1) bandN++;
      w.triC(ctr, ring[i], ring[j], UP, me.color, cc[i], cc[j]);
      rec?.tops.push({ cell: c.id, edge: i, level: g, t: [ctr, ring[i], ring[j]] });
    }
    if (bandOn) drapeStats.bandTris = (drapeStats.bandTris || 0) + bandN;
    }
    w.edgeTri = null;
    w.bandTri = 1;

    w.fieldFrame = null;

    // 草皮垂过崖边：草顶面、邻居更低的边，沿崖面垂下一段圆润的"舌头"
    const shrubCol = w.c(world.shrubDrapeColor ?? SHRUB_DEFAULT_STYLE.color);
    if ((me.kind === 'grass' || me.kind === 'dry') && g >= 2) {
      for (let i = 0; i < c.n; i++) {
        const o = nbr(c, i);
        const og = o ? world.top(o) : 0;
        if (og >= g) continue;
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        if (altered(c, a, b, o)) continue;   // soft-slope edge: no drape (corner heights moved)
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const amt = fbm(mx * 0.9 + 21, mz * 0.9 + 5, { octaves: 2, freq: 1.5, seed: 131 });
        if (amt < 0.42) continue;
        const depth = L * (0.12 + 0.55 * (amt - 0.42));
        const [nx, nz] = edgeOut(c, i);
        const e = 0.007;
        const top = (u) => { const A = wallAt(a, g, g * L), B = wallAt(b, g, g * L); return [A[0] + (B[0] - A[0]) * u + nx * e, g * L + 0.002, A[2] + (B[2] - A[2]) * u + nz * e]; };
        const at2 = (u, yy) => { const A = wallAt(a, g, yy), B = wallAt(b, g, yy); return [A[0] + (B[0] - A[0]) * u + nx * e, yy, A[2] + (B[2] - A[2]) * u + nz * e]; };
        // 第 69 轮：灌木边上的垂挂段改成**灌木色、且比草皮舌头短**（原片 1707490932017279035 frame-0205 放大：
        // 崖面上那层是鲑橙色、只有草舌头的四成多高，不是草皮颜色）。灌木带本身仍由顶面着色器画，这里只翻过崖沿那一段。
        const shrubEdge = !!cliff[i];
        const S = 6, drape = me.color.clone().multiplyScalar(0.9), shrubDrape = shrubCol.clone().multiplyScalar(0.94);
        for (let k = 0; k < S; k++) {
          const u0 = k / S, u1 = (k + 1) / S;
          // 两端收成圆头：深度 = depth × sin(πu)^0.6，再叠一点小起伏
          const d = (u) => depth * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.85 + 0.3 * hash01(Math.round((mx + u) * 97) + c.id));
          const dm = Math.max(d(u0), d(u1));
          drapeStats.grass++; drapeStats.grassMaxDepth = Math.max(drapeStats.grassMaxDepth, dm);
          w.quad(top(u0), top(u1), at2(u1, g * L - d(u1)), at2(u0, g * L - d(u0)), [nx, 0, nz], drape, 1);
          // 灌木色短段：叠在草皮舌头上面（再往崖外让 1.5mm 防 z-fight），垂深只有四成半
          if (shrubEdge) {
            const ds = (u) => d(u) * 0.45;
            drapeStats.shrub++; drapeStats.shrubMaxDepth = Math.max(drapeStats.shrubMaxDepth, Math.max(ds(u0), ds(u1)));
            const topS = (u) => { const A = wallAt(a, g, g * L), B = wallAt(b, g, g * L); return [A[0] + (B[0] - A[0]) * u + nx * (e + 0.0015), g * L + 0.003, A[2] + (B[2] - A[2]) * u + nz * (e + 0.0015)]; };
            const at2S = (u, yy) => { const A = wallAt(a, g, yy), B = wallAt(b, g, yy); return [A[0] + (B[0] - A[0]) * u + nx * (e + 0.0015), yy, A[2] + (B[2] - A[2]) * u + nz * (e + 0.0015)]; };
            w.quad(topS(u0), topS(u1), at2S(u1, g * L - ds(u1)), at2S(u0, g * L - ds(u0)), [nx, 0, nz], shrubDrape, 1);
          }
        }
      }
    }

    // 崖顶暖色亮边 / 河岸
    for (let i = 0; i < c.n; i++) {
      const o = nbr(c, i);
      const og = o ? world.top(o) : 0;
      if (og >= g && !(world.river[c.id] && o && !world.river[o.id])) continue;
      if (altered(c, c.pts[i], c.pts[(i + 1) % c.n], o)) {
        // lip follows the moved corners; a linked (seamless) soft edge has no lip at all
        const j = (i + 1) % c.n, ya = ring[i][1], yb = ring[j][1];
        const ba = o ? soft.y(o.id, c.pts[i].id) ?? og * L : 0, bb = o ? soft.y(o.id, c.pts[j].id) ?? og * L : 0;
        if (Math.abs(ya - ba) < 1e-9 && Math.abs(yb - bb) < 1e-9) continue;
        const [nx, nz] = edgeOut(c, i), inw = 0.042, drop2 = 0.05, A = ring[i], B = ring[j];
        w.quad([A[0] + nx * 0.004, ya - drop2, A[2] + nz * 0.004], [B[0] + nx * 0.004, yb - drop2, B[2] + nz * 0.004],
          [B[0] - nx * inw, yb + 0.002, B[2] - nz * inw], [A[0] - nx * inw, ya + 0.002, A[2] - nz * inw], [nx, 0.8, nz], K.lip, 1.04);
        continue;
      }
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
  if (fpSpl) world.footprintSplicesC09 = { ...fpSpl, emitted: emitFootprintSplices(w, fpSpl, { cells, colorOf: (id) => capOf[id]?.color ?? K.grass, wallColor: w.c(BUILD.plaster), roofColor: w.c(BUILD.roof), L, UP }) };
  else if (world.footprintSplicesC09) delete world.footprintSplicesC09;
  // r55 lakes (REACode/depfill lake surface, 1447488323845509121): World.lakes from a water-mode fill.
  // One flat water polygon per lake cell at the spill level, on the same cage slice as the rim tops.
  let lakeCells = 0;
  const lakes = liveLakes(world);
  for (const lake of lakes) {
    const yl = lake.level * L - 0.07;
    for (const id of lake.cells) {
      const c = cells[id];
      w.at?.(c);
      w.poly(c.pts.map((p) => P(p, lake.level, yl)), UP, K.river.clone().multiplyScalar(0.94 + 0.05 * hash01(id * 7 + 3)), 1);
      lakeCells++;
    }
  }
  if (rec) { rec.version = world.version; world.terrainSurface = rec; }
  return { cells: count, splices, lakes: lakes.length, lakeCells, softVertices: soft?.vertices ?? 0, softGroups: soft?.groups ?? 0,
    drapeShrub: drapeStats.shrub, drapeGrass: drapeStats.grass,
    drapeShrubMaxDepth: +drapeStats.shrubMaxDepth.toFixed(4), drapeGrassMaxDepth: +drapeStats.grassMaxDepth.toFixed(4),
    shrubFullFaceEdges: drapeStats.fullFace };
}
