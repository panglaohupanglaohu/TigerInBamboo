/**
 * buildings.js — 建筑管线（Townscaper）：体素列 → 墙 / 基座 / 屋顶 / 支撑 / 门窗 / 后院。
 *
 * 只处理 World 里"非岩石"的实心层；岩石层交给 terrain/terrainmesh.js。两者遮挡关系
 * 统一看 solid，所以房子盖在悬崖上、贴着山体时，贴住的那面墙自然不出。
 *
 * 依据（帖子 ID）：
 *  1197909675443916803 / 1189908238566903808  每格一栋窄房子、陡坡双坡顶，单宽排屋端头是山墙；
 *                                            屋顶永远陶土色，调色板只上墙
 *  1258421104756097029 / 1215642481162887168  码头：灰石基座入水外鼓、深红压顶、深灰铺地、栏杆
 *  1189902695303458816                        悬空的方块站在深色钢架上
 *  1189908238566903808                        两侧都有支撑时出现拱
 *  1238474550511308800                        围合的地面变成后院
 *  1176516621223043073                        白框小窗，临步道的一面开门
 */

import { classifyCourtyards } from '../core/courtyards.js';
import { gardenPaths } from '../core/garden-paths.js';
import { BUILD } from '../core/palette.js';
import { hash01, mix, clamp } from '../core/noise.js';
import { UP, DOWN, edgeOut } from '../core/meshwriter.js';

/**
 * @param {import('../core/meshwriter.js').MeshWriter} w
 * @param {import('../core/world.js').World} world
 * @returns {{ posts: {x:number,z:number}[], yards:number }}
 */
export function buildBuildings(w, world, { L, debugModules = false }) {
  const cells = world.cells;
  const grid = world.grid;
  const n = cells.length;
  const tops = new Int32Array(n);
  for (const c of cells) tops[c.id] = world.top(c);
  const nbr = (c, i) => world.neighbor(c, i);
  const solid = (c, lv) => c !== null && world.isSolid(c, lv);
  const built = (c, lv) => c !== null && world.isBuilt(c, lv);
  const wallColor = (c) => w.c(world.color[c.id] >= 0 ? world.palette.colors[world.color[c.id]] ?? BUILD.plaster : BUILD.plaster);

  /* ---- 模块签名调试色（1279107097108635649 "the puzzle pieces that make up Townscaper. To date, there are 545"）
   * 每段墙所在的"拼图块"由它周围的占用决定：这一格边数 n、上一层 / 下一层是否实心、每条边外面同层是否实心。
   * 打开 toggle 'modules' 后，同一种签名涂同一种颜色 —— 一眼看出哪些位置在用同一块拼图、一共用到多少种。 */
  const sigs = new Map();
  const sigColor = (c, lv) => {
    let sig = c.n * 4 + (solid(c, lv + 1) ? 2 : 0) + (solid(c, lv - 1) ? 1 : 0);
    for (let i = 0; i < c.n; i++) sig = sig * 2 + (solid(nbr(c, i), lv) ? 1 : 0);
    let col = sigs.get(sig);
    if (!col) {
      const hue = (hash01(sig * 2654435761 + 11) * 360) | 0, lit = 52 + ((hash01(sig + 5) * 18) | 0);
      col = w.c(`hsl(${hue}, 62%, ${lit}%)`);
      sigs.set(sig, col);
    }
    return col;
  };

  const K = Object.fromEntries(Object.entries(BUILD).map(([k, v]) => [k, w.c(v)]));

  /* ---- 码头外轮廓的逐顶点外法线：基座外鼓时相邻格不开缝 ------------------------ */
  const quayN = new Map();
  for (const c of cells) {
    if (!built(c, 1)) continue;
    for (let i = 0; i < c.n; i++) {
      if (solid(nbr(c, i), 1)) continue;
      const [nx, nz] = edgeOut(c, i);
      for (const p of [c.pts[i], c.pts[(i + 1) % c.n]]) {
        const v = quayN.get(p.id) || [0, 0];
        v[0] += nx; v[1] += nz;
        quayN.set(p.id, v);
      }
    }
  }
  const flare = (p, amount) => {
    const v = quayN.get(p.id);
    if (!v) return [p.x, p.z];
    const l = Math.hypot(v[0], v[1]) || 1;
    const k = amount * Math.min(1.35, Math.max(1, l));
    return [p.x + (v[0] / l) * k, p.z + (v[1] / l) * k];
  };

  /* ---- 后院：地面层（顶=1 的码头格）连通块碰不到水 / 网格边 ------------------- */
  const courtyard = classifyCourtyards(world, { tops });
  const yard = courtyard.mask;
  const yardComps = courtyard.components;
  const path = new Uint8Array(n);

  // Local graph reconstruction: connect PCA endpoints through garden cells.
  // Source video shows paths, not PCA or this algorithm. Never bridge a hole.
  for (const comp of yardComps) {
    const plan = gardenPaths(comp, c => Array.from({length:c.n},(_,i)=>nbr(c,i)));
    for (const id of plan.path) path[id] = 1;
  }

  /* ---- 墙面零件 ------------------------------------------------------------- */
  const plinth = (c, i) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const out = [nx, 0, nz];
    const rows = [[0.0, 0.085], [0.1 * L, 0.06], [0.3 * L, 0.022], [0.62 * L, 0.004], [L - 0.055, 0.0]];
    for (let r = 0; r < rows.length - 1; r++) {
      const [y0, f0] = rows[r];
      const [y1, f1] = rows[r + 1];
      const a0 = flare(a, f0), b0 = flare(b, f0), a1 = flare(a, f1), b1 = flare(b, f1);
      const shade = (0.86 + 0.05 * r) * (0.96 + 0.08 * hash01(c.id * 7 + i * 3 + r));
      w.quad([a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], out, r < 2 ? K.stoneDark : K.stone, shade);
    }
    const o = 0.012, ya = L - 0.055, yb = L + 0.006;
    w.quad([a.x + nx * o, ya, a.z + nz * o], [b.x + nx * o, ya, b.z + nz * o], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], out, K.band, 1);
    w.quad([a.x, ya, a.z], [b.x, ya, b.z], [b.x + nx * o, ya, b.z + nz * o], [a.x + nx * o, ya, a.z + nz * o], DOWN, K.band, 0.7);
    w.quad([a.x, yb, a.z], [b.x, yb, b.z], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], UP, K.band, 1.05);
  };

  /* ---- 门窗 = 道具放置：尽量多放、互不重叠（1205416648397721601） ----------------
   * "It tries to place as many props as it can without overlap. I use it for doors and windows too,
   *  which means they are no longer skewed when placed on skewed tiles"
   * 每层一张已放置列表（世界坐标中点 + 半宽）；新开口离已有的太近、或离墙边端点太近（拐角）就放弃。
   * 开口始终是沿墙边的正矩形，不随格子歪斜。 */
  const placed = new Map();   // lv → [[x, z, halfWidth]]
  const GAP = 0.05, CORNER = 0.035;
  const tryPlace = (c, i, t, lv, width) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const hw = width / 2 + 0.022;
    if (t * len - hw < CORNER || (1 - t) * len - hw < CORNER) return false;
    const x = mix(a.x, b.x, t), z = mix(a.z, b.z, t);
    const list = placed.get(lv) || placed.set(lv, []).get(lv);
    for (const [px, pz, ph] of list) if (Math.hypot(px - x, pz - z) < ph + hw + GAP) return false;
    list.push([x, z, hw]);
    return true;
  };

  /* ---- 表面装饰的"小 WFC"（1181464374839521280）：
   * "an additional smaller WFC for surface decorations like windows and doors (who's awkward placement
   *  otherwise explodes the permutation count)"
   * 不把门窗塞进主模块的排列组合里，而是另起一层：每栋房子（同层连通的建筑格）每层挑一种窗型，
   * 同一面上的窗型一致；整栋房子只开一扇门（在临步道的边里挑哈希最小的那条）。 */
  const house = new Int32Array(n).fill(-1);
  for (const c of cells) {
    if (house[c.id] >= 0 || !world.isBuilt(c, 2)) continue;
    const q = [c]; house[c.id] = c.id;
    for (let k = 0; k < q.length; k++) for (const id of q[k].edgeNeighbors) {
      if (id >= 0 && house[id] < 0 && world.isBuilt(cells[id], 2)) { house[id] = c.id; q.push(cells[id]); }
    }
  }
  const windowStyle = (c, lv) => (hash01((house[c.id] + 7) * 977 + lv * 131) * 3) | 0;   // 0 单窗 1 双窗 2 高窗
  const door = new Map();   // house → 'cellId:edge'
  for (const c of cells) {
    if (house[c.id] < 0) continue;
    for (let i = 0; i < c.n; i++) {
      const nb = nbr(c, i);
      if (!nb || !world.isBuilt(c, 2) || solid(nb, 2) || tops[nb.id] !== 1 || world.bottom(nb) !== 1) continue;
      const len = Math.hypot(c.pts[(i + 1) % c.n].x - c.pts[i].x, c.pts[(i + 1) % c.n].z - c.pts[i].z);
      if (len < 0.3) continue;
      const k = hash01(c.id * 131 + i * 17), cur = door.get(house[c.id]);
      if (!cur || k < cur.k) door.set(house[c.id], { k, key: c.id + ':' + i });
    }
  }

  const opening = (c, i, t, y0, width, height, isDoor) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const out = [nx, 0, nz];
    const P = (tt, y, o) => [mix(a.x, b.x, tt) + nx * o, y, mix(a.z, b.z, tt) + nz * o];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const hw = width / 2 / len, fw = 0.022 / len, ft = 0.022;
    const t1 = t - hw, t2 = t + hw, y1 = y0 + height;
    w.quad(P(t1 - fw, y0 - ft, 0.008), P(t2 + fw, y0 - ft, 0.008), P(t2 + fw, y1 + ft, 0.008), P(t1 - fw, y1 + ft, 0.008), out, K.frame, 1);
    w.quad(P(t1, y0, 0.012), P(t2, y0, 0.012), P(t2, y1, 0.012), P(t1, y1, 0.012), out, isDoor ? K.door : K.glass, 1, isDoor ? 0 : 1);
    if (!isDoor) {
      const mw = 0.006 / len;
      w.quad(P(t - mw, y0, 0.016), P(t + mw, y0, 0.016), P(t + mw, y1, 0.016), P(t - mw, y1, 0.016), out, K.frame, 1);
      w.quad(P(t1 - fw * 1.6, y0 - ft * 1.6, 0.03), P(t2 + fw * 1.6, y0 - ft * 1.6, 0.03), P(t2 + fw * 1.6, y0 - ft * 0.6, 0.03), P(t1 - fw * 1.6, y0 - ft * 0.6, 0.03), out, K.frame, 0.95);
    }
  };

  const wallBody = (c, i, y0, y1, color, shade) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    w.quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], [nx, 0, nz], color, shade);
  };

  /* ---- 逐格：墙、顶、底 ------------------------------------------------------ */
  const railings = [];
  const posts = [];
  const postSeen = new Set();

  for (const c of cells) {
    const h = tops[c.id];
    if (h === 0) continue;
    w.at?.(c);   // 分块：这一格的三角形写进它所在的块（world/worldmesh.js）
    const wall = wallColor(c);
    const mosaic = 0.965 + 0.07 * hash01(c.id * 2654435761 + 3);

    for (let i = 0; i < c.n; i++) {
      const nb = nbr(c, i);
      const nbTop = nb ? tops[nb.id] : 0;
      const edgeLen = Math.hypot(c.pts[(i + 1) % c.n].x - c.pts[i].x, c.pts[(i + 1) % c.n].z - c.pts[i].z);
      for (let lv = 1; lv <= h; lv++) {
        if (!world.isBuilt(c, lv) || solid(nb, lv)) continue;
        if (lv === 1) { plinth(c, i); continue; }
        const y0 = (lv - 1) * L, y1 = lv * L;
        const runStart = !world.isBuilt(c, lv - 1) || lv === 2 || solid(nb, lv - 1);
        const wc = debugModules ? sigColor(c, lv) : wall;
        if (runStart) {
          wallBody(c, i, y0, y0 + 0.045, wc, 0.55);       // 深色勒脚
          wallBody(c, i, y0 + 0.045, y1, wc, mosaic);
        } else {
          wallBody(c, i, y0, y1, wc, mosaic);
        }
        const hk = c.id * 131 + i * 17 + lv * 7;
        const isDoor = lv === 2 && door.get(house[c.id])?.key === c.id + ':' + i;
        if (isDoor) {
          if (tryPlace(c, i, 0.5, lv, 0.12)) opening(c, i, 0.5, y0 + 0.03, 0.12, 0.22, true);
        } else if (hash01(hk + 1) < 0.85) {
          // 窗型由"小 WFC"定（同一栋同一层一致），能不能放下由道具放置决定
          const st = windowStyle(c, lv), wy = y0 + L * 0.4;
          const cand = st === 1 ? [[0.3, 0.085, 0.14], [0.7, 0.085, 0.14]]
            : st === 2 ? [[0.5, 0.075, 0.24]]
            : [[0.5, 0.095, 0.15]];
          // 双窗放不下（墙短）就退成单窗；单窗还放不下就算了
          let any = false;
          for (const [t, ww, hh] of cand) if (tryPlace(c, i, t, lv, ww)) { opening(c, i, t, st === 2 ? y0 + L * 0.28 : wy, ww, hh, false); any = true; }
          if (!any && st === 1 && tryPlace(c, i, 0.5, lv, 0.085)) opening(c, i, 0.5, wy, 0.085, 0.14, false);
        }
      }
    }

    for (let lv = 1; lv <= h; lv++) {
      if (!world.isBuilt(c, lv)) continue;
      const runTop = !world.isSolid(c, lv + 1);
      const runBottom = lv > 1 && !world.isSolid(c, lv - 1);
      if (runTop && lv < h) {
        const y = lv * L;
        w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, lv === 1 ? K.paving : wall, 0.92);
      }
      if (runTop && lv === h && h === 1) {
        const y = L + 0.006;
        if (yard[c.id] && path[c.id]) {
          // 小径：浅色石板，四周留一道缝
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, K.pavingAlt, 0.82);
          w.poly(c.pts.map((p) => [mix(p.x, c.cx, 0.1), y + 0.003, mix(p.z, c.cz, 0.1)]), UP, K.stone, 1.12 + 0.06 * hash01(c.id));
        } else if (yard[c.id]) {
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, hash01(c.id * 5) < 0.5 ? K.lawn : K.lawnAlt, 0.97 + 0.06 * hash01(c.id));
        } else {
          const pc = hash01(c.id * 5) < 0.5 ? K.paving : K.pavingAlt;
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, pc, 0.78);           // 砖缝
          const ins = c.pts.map((p) => [mix(p.x, c.cx, 0.07), y + 0.003, mix(p.z, c.cz, 0.07)]);
          w.poly(ins, UP, pc, 0.97 + 0.08 * hash01(c.id));
        }
        for (let i = 0; i < c.n; i++) {
          const nb = nbr(c, i);
          if (nb === null || tops[nb.id] === 0) railings.push([c, i]);
        }
      }
      if (runBottom) underside(c, lv, wall);
    }
  }

  /** 悬空段的底部：两侧（对边）在下一层都有支撑 → 拱；否则平底 + 钢架。 */
  function underside(c, lv, wall) {
    const yBase = (lv - 1) * L;
    let floorLv = 0;
    for (let l = lv - 1; l >= 1; l--) if (world.isSolid(c, l)) { floorLv = l; break; }
    const yFloor = floorLv * L;
    const below = lv - 1;

    // 拱要有一对对边：只有方格有（三角格没有对边 → 平底 + 钢架）
    const axis = c.n === 4 ? [0, 1].find((i) => solid(nbr(c, i), below) && solid(nbr(c, i + 2), below)) : undefined;
    if (axis !== undefined) {
      const i = axis;
      const A0 = c.pts[i], A1 = c.pts[(i + 1) % 4], B1 = c.pts[(i + 2) % 4], B0 = c.pts[(i + 3) % 4];
      const P = (u, v, y) => {
        const x0 = mix(A0.x, B0.x, u), z0 = mix(A0.z, B0.z, u), x1 = mix(A1.x, B1.x, u), z1 = mix(A1.z, B1.z, u);
        return [mix(x0, x1, v), y, mix(z0, z1, v)];
      };
      const rise = Math.min((yBase - yFloor) * 0.75, L * 0.8);
      const crown = yBase - 0.05;
      const yAt = (u) => crown - rise * (1 - Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)));
      const soffit = wall.clone().multiplyScalar(0.72);
      const S = 10;
      for (let s = 0; s < S; s++) {
        const u0 = s / S, u1 = (s + 1) / S, y0 = yAt(u0), y1 = yAt(u1);
        const m = P((u0 + u1) / 2, 0.5, (y0 + y1) / 2);
        w.quad(P(u0, 0, y0), P(u1, 0, y1), P(u1, 1, y1), P(u0, 1, y0), [0, -1, 0], soffit, 0.9);
        void m;
        for (const [v, ei] of [[0, (i + 3) % 4], [1, (i + 1) % 4]]) {
          if (solid(nbr(c, ei), below)) continue;
          const [nx, nz] = edgeOut(c, ei);
          w.quad(P(u0, v, y0), P(u1, v, y1), P(u1, v, yBase), P(u0, v, yBase), [nx, 0, nz], wall, 0.97);
        }
      }
      return;
    }

    w.poly(c.pts.map((p) => [p.x, yBase, p.z]), DOWN, wall.clone().multiplyScalar(0.6), 1);
    const legs = [];
    for (let k = 0; k < c.n; k++) {
      const p = c.pts[k];
      const sharing = grid.vertexCells.get(p.id) || [];
      if (sharing.some((id) => world.isSolid(cells[id], below))) continue;  // 角上已有墙托着
      legs.push(k);
      const key = p.id * 64 + lv;
      if (postSeen.has(key)) continue;
      postSeen.add(key);
      const x = mix(p.x, c.cx, 0.06), z = mix(p.z, c.cz, 0.06);
      w.beam([x, yFloor, z], [x, yBase, z], 0.045, K.steel, 1);
      if (floorLv === 0) posts.push({ x, z });
    }
    for (let e = 0; e < c.n; e++) {
      const k0 = e, k1 = (e + 1) % c.n;
      if (!legs.includes(k0) || !legs.includes(k1)) continue;
      const p0 = c.pts[k0], p1 = c.pts[k1];
      const a = [mix(p0.x, c.cx, 0.06), mix(p0.z, c.cz, 0.06)];
      const b = [mix(p1.x, c.cx, 0.06), mix(p1.z, c.cz, 0.06)];
      const yg = yBase - 0.05;
      const drop = Math.min(0.25, (yBase - yFloor) * 0.4);
      w.beam([a[0], yg, a[1]], [b[0], yg, b[1]], 0.035, K.steel, 0.95);
      w.beam([a[0], yg - drop, a[1]], [mix(a[0], b[0], 0.3), yg, mix(a[1], b[1], 0.3)], 0.022, K.steel, 0.9);
      w.beam([b[0], yg - drop, b[1]], [mix(b[0], a[0], 0.3), yg, mix(b[1], a[1], 0.3)], 0.022, K.steel, 0.9);
    }
  }

  /* ---- 栏杆 ---------------------------------------------------------------- */
  for (const [c, i] of railings) {
    w.at?.(c);
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const ax = a.x - nx * 0.035, az = a.z - nz * 0.035, bx = b.x - nx * 0.035, bz = b.z - nz * 0.035;
    const y = L;
    w.beam([ax, y + 0.13, az], [bx, y + 0.13, bz], 0.018, K.rail, 1);
    w.beam([ax, y + 0.07, az], [bx, y + 0.07, bz], 0.01, K.rail, 0.95);
    const count = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.16) + 1);
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      w.beam([mix(ax, bx, t), y, mix(az, bz, t)], [mix(ax, bx, t), y + 0.13, mix(az, bz, t)], k === 0 || k === count - 1 ? 0.022 : 0.009, K.rail, 1);
    }
  }

  /* ---- 屋顶 ---------------------------------------------------------------- */
  const chimneys = [];
  buildRoofs(w, world, { L, tops, K, wallColor, chimneys });

  /* ---- 后院的树 ------------------------------------------------------------- */
  let yards = 0;
  for (const c of cells) {
    if (!yard[c.id]) continue;
    w.at?.(c);
    yards++;
    if (path[c.id]) continue;          // 小径上不种树
    const r = hash01(c.id * 977 + 5);
    const y = L + 0.006;
    if (r < 0.45) {
      const big = r < 0.25;
      const s = big ? 0.15 : 0.11;
      const x = c.cx + (hash01(c.id * 31) - 0.5) * 0.1, z = c.cz + (hash01(c.id * 37) - 0.5) * 0.1;
      w.beam([x, y, z], [x, y + s * 1.3, z], 0.035, K.trunk, 1);
      w.blob(x, y + s * 1.6, z, s, s * 0.95, big ? K.tree : K.treeLight);
      if (big) w.blob(x + s * 0.35, y + s * 2.25, z - s * 0.2, s * 0.7, s * 0.65, K.treeLight);
    } else if (r < 0.7) {
      w.blob(c.cx, y + 0.05, c.cz, 0.09, 0.07, K.treeLight);
    }
  }

  const yardCells = new Set(), pathCells = new Set();
  for (let i = 0; i < n; i++) { if (yard[i]) yardCells.add(i); if (path[i]) pathCells.add(i); }
  return { posts, yards, yardCells, pathCells, yardOpenings: courtyard.openComponents, chimneys, modules: sigs.size, doors: door.size };
}

/**
 * 双坡顶：每个体量（同高相邻的建筑顶）在半格点阵（格角、边中点、格心）上算
 * "到檐口的距离"，屋顶高度 = 距离 × 坡度。一格宽排屋的远端、孤立格的两条短边
 * 不算檐口 → 屋脊直通到那里，补一块墙色的山墙三角。
 */
function buildRoofs(w, world, { L, tops, K, wallColor, chimneys = [] }) {
  const { regions } = world.regions();
  const slope = 1.3, cap = 0.27, overhang = 0.055, thick = 0.045;
  const nbr = (c, i) => world.neighbor(c, i);

  for (const region of regions) {
    const h = region.h;
    if (h < 2) continue;
    const base = h * L;
    const inRegion = new Set(region.cells.map((c) => c.id));

    // 每条边：1 = 檐口，2 = 山墙，0 = 内部 / 贴着更高的墙
    const flags = new Map();
    for (const c of region.cells) {
      w.at?.(c);
      const f = new Array(c.n).fill(0);
      for (let i = 0; i < c.n; i++) {
        const nb = nbr(c, i);
        if (nb && inRegion.has(nb.id)) continue;
        if (nb && tops[nb.id] > h) continue;
        f[i] = 1;
      }
      const cnt = f.reduce((a, b) => a + b, 0);
      // 山墙规则只对方格成立（要有"对边"）；三角格的屋顶是小四坡 / 三坡顶
      if (c.n !== 4) { /* 保持全部是檐口 */ }
      else if (cnt === 3) {
        const ge = (f.indexOf(0) + 2) % 4;
        if (f[(ge + 1) % 4] && f[(ge + 3) % 4]) f[ge] = 2;
      } else if (cnt === 4) {
        const m = (i) => [(c.pts[i].x + c.pts[(i + 1) % 4].x) / 2, (c.pts[i].z + c.pts[(i + 1) % 4].z) / 2];
        const d02 = Math.hypot(m(0)[0] - m(2)[0], m(0)[1] - m(2)[1]);
        const d13 = Math.hypot(m(1)[0] - m(3)[0], m(1)[1] - m(3)[1]);
        if (d02 >= d13) { f[0] = 2; f[2] = 2; } else { f[1] = 2; f[3] = 2; }
      }
      flags.set(c.id, f);
    }

    const eaves = [];
    for (const c of region.cells) {
      w.at?.(c);
      const f = flags.get(c.id);
      for (let i = 0; i < c.n; i++) if (f[i] === 1) eaves.push([c.pts[i], c.pts[(i + 1) % c.n]]);
    }

    const pts = new Map();
    const pt = (key, x, z) => {
      let p = pts.get(key);
      if (!p) pts.set(key, (p = { x, z, nx: 0, nz: 0, onEdge: false, y: 0, ox: x, oz: z }));
      return p;
    };
    const lat = new Map();
    for (const c of region.cells) {
      w.at?.(c);
      const cs = c.pts.map((p) => pt('v' + p.id, p.x, p.z));
      const ms = c.pts.map((_, i) => {
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        return pt(a.id < b.id ? `e${a.id}_${b.id}` : `e${b.id}_${a.id}`, (a.x + b.x) / 2, (a.z + b.z) / 2);
      });
      const ctr = pt('c' + c.id, c.cx, c.cz);
      lat.set(c.id, { cs, ms, ctr });
      const f = flags.get(c.id);
      for (let i = 0; i < c.n; i++) {
        if (!f[i]) continue;
        const [nx, nz] = edgeOut(c, i);
        for (const p of [cs[i], ms[i], cs[(i + 1) % c.n]]) { p.nx += nx; p.nz += nz; p.onEdge = true; }
      }
    }
    for (const p of pts.values()) {
      let best = Infinity;
      for (const [a, b] of eaves) best = Math.min(best, segDist(p.x, p.z, a.x, a.z, b.x, b.z));
      const d = eaves.length ? best : 0.3;
      p.y = base + Math.min(d, cap) * slope;
      if (p.onEdge) {
        const l = Math.hypot(p.nx, p.nz) || 1;
        p.ox = p.x + (p.nx / l) * overhang;
        p.oz = p.z + (p.nz / l) * overhang;
        if (d < 1e-3) p.y -= 0.02;
      }
    }

    for (const c of region.cells) {
      w.at?.(c);
      const { cs, ms, ctr } = lat.get(c.id);
      const shade = 0.96 + 0.08 * hash01(c.id * 977 + 11);
      const roof = hash01(c.id * 13) < 0.5 ? K.roof : K.roofAlt;
      const P = (p) => [p.ox, p.y, p.oz];
      for (let i = 0; i < c.n; i++) {
        w.tri(P(cs[i]), P(ms[i]), P(ctr), UP, roof, shade);
        w.tri(P(cs[i]), P(ctr), P(ms[(i + c.n - 1) % c.n]), UP, roof, shade);
      }
    }

    for (const c of region.cells) {
      w.at?.(c);
      const { cs, ms } = lat.get(c.id);
      const f = flags.get(c.id);
      const wall = wallColor(c);
      for (let i = 0; i < c.n; i++) {
        if (!f[i]) continue;
        const [nx, nz] = edgeOut(c, i);
        const out = [nx, 0, nz];
        const seq = [cs[i], ms[i], cs[(i + 1) % c.n]];
        for (let s = 0; s < 2; s++) {
          const p = seq[s], q = seq[s + 1];
          w.quad([p.ox, p.y, p.oz], [q.ox, q.y, q.oz], [q.ox, q.y - thick, q.oz], [p.ox, p.y - thick, p.oz], out, K.roofTrim, 1);
          w.quad([p.ox, p.y - thick, p.oz], [q.ox, q.y - thick, q.oz], [q.x, q.y - thick - 0.01, q.z], [p.x, p.y - thick - 0.01, p.z], DOWN, K.roofTrim, 0.6);
        }
        if (f[i] === 2) {
          const a = c.pts[i], b = c.pts[(i + 1) % c.n], mid = ms[i];
          w.tri([a.x, base, a.z], [b.x, base, b.z], [mid.x, mid.y - thick, mid.z], out, wall, 0.98);
          const wy = base + (mid.y - base) * 0.32;
          const P2 = (t, y, o) => [mix(a.x, b.x, t) + nx * o, y, mix(a.z, b.z, t) + nz * o];
          if (mid.y - base > 0.16) {
            w.quad(P2(0.44, wy - 0.012, 0.006), P2(0.56, wy - 0.012, 0.006), P2(0.56, wy + 0.1, 0.006), P2(0.44, wy + 0.1, 0.006), out, K.frame, 1);
            w.quad(P2(0.465, wy, 0.01), P2(0.535, wy, 0.01), P2(0.535, wy + 0.08, 0.01), P2(0.465, wy + 0.08, 0.01), out, K.glass, 1, 1);
          }
        }
      }
    }

    for (const c of region.cells) {
      w.at?.(c);
      if (hash01(c.id * 4099 + h) > 0.12) continue;
      const { ctr } = lat.get(c.id);
      w.box(ctr.x + 0.05, ctr.y - 0.06, ctr.z, 0.07, 0.16, 0.07, K.chimney, 1);
      w.box(ctr.x + 0.05, ctr.y + 0.1, ctr.z, 0.09, 0.025, 0.09, K.roofTrim, 1);
      chimneys.push({ x: ctr.x + 0.05, y: ctr.y + 0.13, z: ctr.z });   // 火的发射点（effects.js）
    }
  }
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
