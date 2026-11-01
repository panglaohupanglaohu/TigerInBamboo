/**
 * roofs.js — steep gable roofs, measured off the reference clips.
 *
 * Every built volume in the clips is capped by a *steep* gable, not the shallow
 * hip I had before: a ridge runs along the long axis, two planes fall to the
 * long walls at roughly 50-55 degrees, and the short ends close with a flat
 * triangle painted in the wall colour — that pale triangle under a terracotta
 * roof is the single most recognisable silhouette in the reference.
 *
 * Rows of tiles are drawn as horizontal bands of alternating shade with a dark
 * seam between them, because a flat-coloured plane reads as cardboard at this
 * polygon count.
 *
 * Faces are emitted with automatic winding correction: the quad grid is
 * irregular, so a fixed vertex order flips normals on some cells.
 */

import * as THREE from 'three';
import { wallFrame, placeProps, rectCorners } from './props.js';

const ONE = [1, 1, 1, 1];

/** cell.id 可能是字符串，摊成一个稳定的整数给摆放器当 seed。 */
function hashId(id, salt = 0) {
  const s = String(id);
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000;
}

export class RoofBuilder {
  constructor({ levelHeight = 0.42 } = {}) {
    this.levelHeight = levelHeight;
    this.pos = [];
    this.col = [];
    this.cache = new Map();
  }

  colorOf(hex) {
    let c = this.cache.get(hex);
    if (!c) this.cache.set(hex, (c = new THREE.Color(hex).convertSRGBToLinear()));
    return c;
  }

  /** Triangle with forced outward winding. `hint` is the direction it should face. */
  tri(a, b, c, color, shade = 1, hint = null) {
    let n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
    if (n.lengthSq() < 1e-12) return;
    if (hint) {
      const hn = new THREE.Vector3(...hint);
      if (n.dot(hn) < 0) { const t = b; b = c; c = t; }
    }
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(color.r * shade, color.g * shade, color.b * shade);
    }
  }

  quad(a, b, c, d, color, shades = ONE, hint = null) {
    const s = shades;
    this.tri(a, b, c, color, s[0] ?? 1, hint);
    this.tri(a, c, d, color, s[2] ?? 1, hint);
  }

  /**
   * A whole little house: plaster body sitting on the cap, then the gable on top
   * of it. The reference never puts a roof straight onto rock — there is always
   * one white storey with a couple of dark windows underneath it.
   */
  house(cell, baseTop, opts = {}) {
    const { wallColor, stoneColor, bodyLevels = 1, windows = true } = opts;
    const L = this.levelHeight;
    const y0 = baseTop * L;
    const y1 = (baseTop + bodyLevels) * L;
    const p = cell.pts;

    for (let i = 0; i < 4; i++) {
      const a = p[i];
      const b = p[(i + 1) % 4];
      // outward normal of this wall
      const mx = (a.x + b.x) / 2 - cell.cx;
      const mz = (a.z + b.z) / 2 - cell.cz;
      const d = Math.hypot(mx, mz) || 1;
      const hint = [mx / d, 0, mz / d];

      // plaster face, inset a hair so the corners read
      this.quad(
        [a.x, y1, a.z], [a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z],
        wallColor, [1.0, 0.93, 0.93, 1.0], hint,
      );

      // dark plinth at the foot of the plaster
      const plinth = 0.045;
      this.quad(
        [a.x, y0 + plinth, a.z], [a.x, y0, a.z], [b.x, y0, b.z], [b.x, y0 + plinth, b.z],
        stoneColor, [0.92, 0.86, 0.86, 0.92], hint,
      );

      if (!windows) continue;
      // ---- 窗 / 门：交给 props.js 摆（原文 1205416648397721601）----------
      //
      // 老做法是沿墙边插值 t1/t2 —— 在不规则四边形上，两条边不等长，
      // 插出来的"矩形"会被拉成梯形（歪窗）。新做法给这面墙建正交基
      // (u, Y)，道具在 (u, Y) 里是真正的矩形，映射回世界就永远是正的，
      // 跟格子歪不歪无关。
      const frame = wallFrame(a, b);
      // 法线朝外（用格心判断方向，wallFrame 的右手系可能朝内）
      const toOut = (mx / d) * frame.nx + (mz / d) * frame.nz < 0;
      if (toOut) { frame.nx = -frame.nx; frame.nz = -frame.nz; }

      const props = placeProps(frame, y0 + 0.055, y1 - 0.045, {
        seed: hashId(cell.id, i + 1),
        door: i % 2 === 0,
        attempts: 220,
        margin: 0.05,
      });
      // 外推距离（踩坑）：**玻璃必须在门框前面**。第一版写成"框在外、玻璃在内"
      // 想装凹陷，结果框是一整块填充四边形，正好把玻璃盖住 —— 渲染出来墙上什么
      // 都没有（线框里能看见窗框，着色后一片白）。没有真正打洞的情况下，"凹"
      // 是画不出来的；那件事只能靠 stencil（见 props.html）。所以这里：
      // 墙(0) < 框(0.0045) < 玻璃(0.0095) < 竖棂/门槛(0.012)
      const frameCol = wallColor.clone().multiplyScalar(0.97);
      const glassCol = wallColor.clone().multiplyScalar(0.22);
      const doorCol = wallColor.clone().multiplyScalar(0.42);
      for (const r of props) {
        const isDoor = r.kind === 'door';
        const grow = isDoor ? 0.02 : 0.03;
        const o = rectCorners(frame, {
          u0: r.u0 - grow, u1: r.u1 + grow,
          y0: r.y0 - grow, y1: r.y1 + grow,
        }, 0.0045);
        this.quad(o[0], o[1], o[2], o[3], frameCol, ONE, hint);
        const g = rectCorners(frame, r, 0.0095);
        this.quad(g[0], g[1], g[2], g[3], isDoor ? doorCol : glassCol, ONE, hint);
        if (isDoor) {
          const sill = rectCorners(frame, {
            u0: r.u0 - 0.03, u1: r.u1 + 0.03,
            y0: r.y0, y1: r.y0 + 0.022,
          }, 0.012);
          this.quad(sill[0], sill[1], sill[2], sill[3], stoneColor, ONE, hint);
        } else if (r.kind === 'winWide') {
          const mid = (r.u0 + r.u1) / 2;
          const m = rectCorners(frame, {
            u0: mid - 0.006, u1: mid + 0.006,
            y0: r.y0, y1: r.y1,
          }, 0.012);
          this.quad(m[0], m[1], m[2], m[3], frameCol, ONE, hint);
        }
      }
    }

    this.gable(cell, baseTop + bodyLevels, {
      ...opts,
      wallColor,
      roofColor: opts.roofColor,
      spire: opts.spire ?? false,
    });
  }

  /** One gable roof over a single cell. */
  gable(cell, top, {
    wallColor,
    roofColor,
    rise = null,
    overhang = 0.028,
    rows = 6,
    spire = false,
  }) {
    const L = this.levelHeight;
    const p = cell.pts;
    const y = top * L;
    const c = [cell.cx, y, cell.cz];

    const mid = (a, b) => [(a.x + b.x) / 2, (a.z + b.z) / 2];
    const len = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    // Which axis is longer? Ridge runs along it; gables close the short ends.
    const spanA = len(p[0], p[1]) + len(p[2], p[3]); // edges 0,2
    const spanB = len(p[1], p[2]) + len(p[3], p[0]); // edges 1,3
    // ridge connects the midpoints of the *short* pair of edges
    const ridgeEdges = spanA <= spanB ? [0, 2] : [1, 3];
    const m0 = mid(p[ridgeEdges[0]], p[(ridgeEdges[0] + 1) % 4]);
    const m1 = mid(p[ridgeEdges[1]], p[(ridgeEdges[1] + 1) % 4]);

    // ridge length = distance between the two end walls
    const ridgeLen = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]);
    const width = Math.min(spanA, spanB) * 0.5;
    const r = rise ?? Math.min(0.62 * cell.size, width * 1.15);
    const ridgeY = y + r;

    const rA = [m0[0], ridgeY, m0[1]];
    const rB = [m1[0], ridgeY, m1[1]];

    // eave offset per edge
    const out = (i) => {
      const a = p[i];
      const b = p[(i + 1) % 4];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      let nx = mx - cell.cx;
      let nz = mz - cell.cz;
      const d = Math.hypot(nx, nz) || 1;
      return { nx: nx / d, nz: nz / d, mx, mz };
    };

    const eave = (i, extra = 0) => {
      const o = out(i);
      const a = p[i];
      const b = p[(i + 1) % 4];
      const ox = o.nx * (overhang + extra);
      const oz = o.nz * (overhang + extra);
      return [
        [a.x + ox, y + 0.012, a.z + oz],
        [b.x + ox, y + 0.012, b.z + oz],
      ];
    };

    // ---- the two slope planes (one per long wall) ------------------------
    const slopeEdges = ridgeEdges.map((e) => (e + 1) % 4);
    for (const e of slopeEdges) {
      const [ea, eb] = eave(e);
      const o = out(e);
      const nrm = [o.nx, 0.75, o.nz];
      // subdivide eave->ridge into `rows` bands so tiles read
      for (let r2 = 0; r2 < rows; r2++) {
        const t0 = r2 / rows;
        const t1 = (r2 + 1) / rows;
        const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        // ridge endpoint matching each eave corner: pick by proximity
        const pick = (pt) => (Math.hypot(pt[0] - rA[0], pt[2] - rA[2]) < Math.hypot(pt[0] - rB[0], pt[2] - rB[2]) ? rA : rB);
        const topA = pick(ea);
        const topB = pick(eb);
        const a0 = lerp(ea, topA, t0);
        const b0 = lerp(eb, topB, t0);
        const a1 = lerp(ea, topA, t1);
        const b1 = lerp(eb, topB, t1);
        const shade = r2 % 2 === 0 ? 1.0 : 0.955;
        // push each band out a hair along the slope normal to avoid co-planar fights
        const lift = 0.0016 * r2;
        const up = [0, lift, 0];
        this.quad(
          [a0[0] + up[0], a0[1] + up[1], a0[2] + up[2]],
          [b0[0] + up[0], b0[1] + up[1], b0[2] + up[2]],
          [b1[0] + up[0], b1[1] + up[1], b1[2] + up[2]],
          [a1[0] + up[0], a1[1] + up[1], a1[2] + up[2]],
          roofColor, [shade, shade, shade, shade], nrm,
        );
        // dark seam at the band edge
        if (r2 < rows - 1) {
          const seamColor = roofColor.clone().multiplyScalar(0.72);
          const t2 = t1 + 0.004;
          const a2 = lerp(ea, topA, t2);
          const b2 = lerp(eb, topB, t2);
          this.quad(
            [a1[0], a1[1] + 0.0025, a1[2]],
            [b1[0], b1[1] + 0.0025, b1[2]],
            [b2[0], b2[1] + 0.0025, b2[2]],
            [a2[0], a2[1] + 0.0025, a2[2]],
            seamColor, ONE, nrm,
          );
        }
      }
      // eave fascia: a thin darker board under the overhang
      const [fa, fb] = eave(e, -0.004);
      this.quad(
        [fa[0], fa[1] + 0.01, fa[2]],
        [fb[0], fb[1] + 0.01, fb[2]],
        [fb[0], fb[1] - 0.035, fb[2]],
        [fa[0], fa[1] - 0.035, fa[2]],
        roofColor.clone().multiplyScalar(0.6), ONE, [o.nx, 0.1, o.nz],
      );
    }

    // ---- gable ends: flat wall-coloured triangles ------------------------
    for (const e of ridgeEdges) {
      const a = p[e];
      const b = p[(e + 1) % 4];
      const o = out(e);
      const ra = Math.hypot(a.x - rA[0], a.z - rA[2]) < Math.hypot(a.x - rB[0], a.z - rB[2]) ? rA : rB;
      // inset the triangle slightly so the roof planes overhang it
      const inset = 0.006;
      const pa = [a.x - o.nx * inset, y + 0.01, a.z - o.nz * inset];
      const pb = [b.x - o.nx * inset, y + 0.01, b.z - o.nz * inset];
      this.tri(pa, pb, [ra[0], ra[1], ra[2]], wallColor, 0.99, [o.nx, 0.15, o.nz]);
    }

    // ---- ridge cap -------------------------------------------------------
    const capColor = roofColor.clone().multiplyScalar(1.06);
    const capW = 0.028;
    const dirx = rB[0] - rA[0];
    const dirz = rB[2] - rA[2];
    const dl = Math.hypot(dirx, dirz) || 1;
    const px = (-dirz / dl) * capW;
    const pz = (dirx / dl) * capW;
    this.quad(
      [rA[0] - px, rA[1] + 0.004, rA[2] - pz],
      [rA[0] + px, rA[1] + 0.004, rA[2] + pz],
      [rB[0] + px, rB[1] + 0.004, rB[2] + pz],
      [rB[0] - px, rB[1] + 0.004, rB[2] - pz],
      capColor, ONE, [0, 1, 0],
    );

    // ---- spire for tall single-cell volumes ------------------------------
    if (spire) {
      const apex = [cell.cx, ridgeY + r * 0.85, cell.cz];
      const rim = [
        [rA[0], ridgeY, rA[2]],
        [cell.cx + px * 2, ridgeY, cell.cz + pz * 2],
        [rB[0], ridgeY, rB[2]],
        [cell.cx - px * 2, ridgeY, cell.cz - pz * 2],
      ];
      for (let i = 0; i < 4; i++) {
        const a = rim[i];
        const b = rim[(i + 1) % 4];
        const nx = (a[0] + b[0]) / 2 - cell.cx;
        const nz = (a[2] + b[2]) / 2 - cell.cz;
        this.tri(a, b, apex, roofColor, i % 2 ? 0.97 : 1.0, [nx, 0.6, nz]);
      }
      // finial
      const stem = roofColor.clone().multiplyScalar(0.5);
      this.quad(
        [apex[0] - 0.012, apex[1], apex[2] - 0.012],
        [apex[0] + 0.012, apex[1], apex[2] - 0.012],
        [apex[0] + 0.012, apex[1] + 0.09, apex[2] - 0.012],
        [apex[0] - 0.012, apex[1] + 0.09, apex[2] - 0.012],
        stem, ONE, [0, 0, -1],
      );
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Convenience: gable roofs over every listed cell. */
export function buildHouseRoofs(town, houses, opts = {}) {
  const b = new RoofBuilder(opts);
  const wall = b.colorOf(opts.wallHex ?? '#e7dfcc');
  const stone = b.colorOf(opts.stoneHex ?? '#a9a6a0');
  const roof = b.colorOf(opts.roofHex ?? '#cf8672');
  for (const { cell, top, spire } of houses) {
    const tall = spire ? 2 : 1;
    b.house(cell, top, {
      wallColor: wall,
      stoneColor: stone,
      roofColor: roof,
      bodyLevels: tall,
      rows: opts.rows ?? 7,
      spire: spire ?? false,
    });
  }
  return b.geometry();
}
