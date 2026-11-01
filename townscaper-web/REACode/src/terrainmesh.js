/**
 * terrainmesh.js — the land half of the fusion scene: stepped terrain out of the
 * same quad grid the houses stand on.
 *
 * The clip that decides the shape here is
 *
 *   1447488323845509121  "Properly combine seamless soft slopes with distinct
 *     sharp cliffs. Erosion valid terrain with no local minimums."
 *
 * So a height difference of exactly one level becomes a slope the player can
 * walk up (the low cell lifts its rim to meet the high cell — the top face
 * becomes a bilinear patch with per-corner heights), while a difference of two
 * or more becomes a wall. Nothing in between: that is what makes the two read
 * as different things instead of a mushy ramp everywhere.
 *
 *   1063115611289645057  "I finally added grass to slopes to make navigability
 *     easier to read" — the slope faces get grass, the cliff faces stay rock.
 *
 * The terrain is a plain Town: one solid column per cell, same 9-bit mask as the
 * buildings. That is the point of step 1 — land and houses share one voxel
 * field, so nobody has to convert between a "heightmap" and a "voxel model".
 */

import * as THREE from 'three';
import { pointInQuad } from './town.js';

export const LAND = {
  grass: '#8fae5f',
  grassDark: '#7d9c52',
  grassLit: '#a3bd70',
  rock: '#9a9284',
  rockDark: '#847c70',
  rockLit: '#a9a193',
  cliff: '#8b8377',
  cliffDark: '#736c62',
  sand: '#cabf9d',
  sandDark: '#b8ac8a',
  quay: '#a89f8d',
};

const hex = (h) => new THREE.Color(h);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * @param {object} o
 * @param {object} o.town        the land voxel set (1 bit per level, level 1 = sea level)
 * @param {object} o.grid
 * @param {number} [o.levelHeight]
 * @param {boolean} [o.softSlopes]  false = every step is a cliff (A/B switch)
 * @param {boolean} [o.wire]
 * @returns {{ geometry: THREE.BufferGeometry, stats: object }}
 */
export function buildTerrainMesh({ town, grid, levelHeight = 0.5, softSlopes = true }) {
  const t0 = performance.now();
  const L = levelHeight;
  const cells = grid.cells;

  const C = {
    grass: hex(LAND.grass), grassDark: hex(LAND.grassDark), grassLit: hex(LAND.grassLit),
    rock: hex(LAND.rock), rockDark: hex(LAND.rockDark), rockLit: hex(LAND.rockLit),
    cliff: hex(LAND.cliff), cliffDark: hex(LAND.cliffDark),
    sand: hex(LAND.sand), sandDark: hex(LAND.sandDark), quay: hex(LAND.quay),
  };

  const pos = [];
  const col = [];
  const glow = [];

  const tri = (a, b, c, colour, shade = 1) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) { col.push(colour.r * shade, colour.g * shade, colour.b * shade); glow.push(0); }
  };
  /** Quad, wound so its normal points along `dir`. */
  const quad = (a, b, c, d, dir, colour, shade = 1) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (dir && nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) {
      tri(a, c, b, colour, shade); tri(a, d, c, colour, shade);
    } else {
      tri(a, b, c, colour, shade); tri(a, c, d, colour, shade);
    }
  };

  const top = (c) => town.top(c);
  const nbrTop = (c, i) => {
    const id = c.edgeNeighbors[i];
    return id < 0 ? 0 : town.top(cells[id]);
  };

  /* ---- per-corner heights: this is the soft slope ------------------------- */
  // Edge i sits at the higher of (own top, neighbour top) *only when the step is
  // exactly one level*; a deeper step leaves the edge where it is, and a wall
  // closes the gap instead.
  //
  // 裂缝 bug（2026-10-31 实测）：一开始每个格子各自算角点高度，结果是**同一个
  // 顶点被不同格子算出不同高度**（912 个顶点里 84 个冲突，最大差 2 层 = 1.0
  // 世界单位）。原因是软坡只沿"抬起来的那条边"生效，而这个角点还被另外两三个
  // 等高的格子共用 —— 它们不抬，于是两者之间裂开一条竖缝，海色从缝里透出来
  // （草坡上一片片青色三角形，2064 像素）。
  //
  // 修法：高度按**顶点**存，不按格子存。y(v) = 所有共用这个顶点的格子中最大的
  // 那个角点高度 —— 谁都用同一个值，接缝按定义不存在。代价是低格子的一个角会
  // 被抬起来（最多一层），所以下面画墙时**墙顶跟着角点走**，不然抬起来的那个角
  // 悬空、又会在墙面和顶面之间裂一道。
  const cornerY = new Float32Array(4);
  const edgeY = new Float32Array(4);
  const desired = new Float32Array(cells.length * 4);

  for (const cell of cells) {
    const t = top(cell);
    if (!t) continue;
    for (let i = 0; i < 4; i++) {
      const nt = nbrTop(cell, i);
      edgeY[i] = softSlopes && nt === t + 1 ? t + 1 : t;
    }
    for (let j = 0; j < 4; j++) {
      desired[cell.id * 4 + j] = Math.max(edgeY[(j + 3) % 4], edgeY[j]);
    }
  }

  /** 顶点 → 高度（层）。共用顶点的所有格子读到的都是同一个值。 */
  const vertY = new Map();
  for (const cell of cells) {
    const t = top(cell);
    if (!t) continue;
    for (let j = 0; j < 4; j++) {
      const p = cell.pts[j];
      // 每个格子只允许把角抬到 t+1（一格落差 = 软坡）。不封顶的话，紧挨着
      // 三层塔的低格会被抬成一根尖刺（实测有，画面上一片三角锥）。
      const y = Math.min(desired[cell.id * 4 + j], t + 1);
      const prev = vertY.get(p);
      if (prev === undefined || y > prev) vertY.set(p, y);
    }
  }
  const yOf = (p) => vertY.get(p) ?? 0;

  let cliffs = 0, slopes = 0, faces = 0;

  for (const cell of cells) {
    const t = top(cell);
    if (!t) continue;

    for (let i = 0; i < 4; i++) {
      const nt = nbrTop(cell, i);
      // A one-level step is only a *slope* when there is land on the other side
      // to carry the ramp. Against water (or the grid rim) it stays a quay wall.
      if (nt > 0 && nt < t) {
        if (t - nt === 1 && softSlopes) slopes++;
        else cliffs++;
      } else if (nt === 0) cliffs++;
    }
    for (let j = 0; j < 4; j++) cornerY[j] = yOf(cell.pts[j]);

    // slope of the top patch, used to pick grass vs rock vs sand
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < 4; j++) { lo = Math.min(lo, cornerY[j]); hi = Math.max(hi, cornerY[j]); }
    const spread = hi - lo;
    const h = hash01(cell.id * 131 + 7);

    let face;
    if (t === 1 && spread < 0.25) face = h < 0.5 ? C.sand : C.sandDark;
    else if (spread > 0.2) face = h < 0.45 ? C.grassLit : C.grass;      // walkable ramp
    else face = h < 0.38 ? C.grassDark : h < 0.8 ? C.grass : C.grassLit;

    const P = (j, y) => [cell.pts[j].x, y * L, cell.pts[j].z];
    const y0 = cornerY[0], y1 = cornerY[1], y2 = cornerY[2], y3 = cornerY[3];
    quad(P(0, y0), P(1, y1), P(2, y2), P(3, y3), [0, 1, 0], face, 1.0);
    faces++;

    /* ---- cliff walls where the step is deeper than one level ------------- */
    // 判据仍然是"邻居比我们低"（软坡那一侧自己会升上来接住我们）。但墙顶要
    // 沿两个端点的角点高度走：上一版把判据改成"这条边上还有没盖住的高度"，
    // 结果等高格之间也互相补墙，两块面片重合成 z-fighting，画面上是一条条
    // **虚线状的黑边**（实测：草地斜坡上全是点线）。
    for (let i = 0; i < 4; i++) {
      const nt = nbrTop(cell, i);
      if (nt >= t) continue;                                    // nothing to draw
      if (nt > 0 && t - nt === 1 && softSlopes) continue;        // the neighbour ramps up to us
      const yA = cornerY[i], yB = cornerY[(i + 1) % 4];
      const a = [cell.pts[i].x, nt * L, cell.pts[i].z];
      const b = [cell.pts[(i + 1) % 4].x, nt * L, cell.pts[(i + 1) % 4].z];
      const c = [cell.pts[(i + 1) % 4].x, yB * L, cell.pts[(i + 1) % 4].z];
      const d = [cell.pts[i].x, yA * L, cell.pts[i].z];
      const ex = b[0] - a[0], ez = b[2] - a[2];
      let nx = -ez, nz = ex;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;
      if (nx * ((a[0] + b[0]) / 2 - cell.cx) + nz * ((a[2] + b[2]) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }

      // rock strata: a slightly different tone every level, so a tall cliff
      // reads as stacked stone instead of one flat wall
      const shade = 0.9 + 0.16 * hash01(cell.id * 17 + i * 5 + t);
      const isQuay = nt === 0 && t <= 1;
      const base = isQuay ? C.quay : (h < 0.5 ? C.cliff : C.cliffDark);
      quad(a, b, c, d, [nx, 0, nz], base, shade);
      faces++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  /**
   * 世界 XZ → 地面高度（世界单位）。走的是**画出来的那张面**（同样的两个三角形、
   * 同样的角点高度），不是体素列顶 `top*L`。两者的差别就是软坡抬起的那一层：
   * 房子按 `top*L` 平移就会在坡边悬空、底下漏出海面（实测 283 px）。
   * 有了这个函数，融合场景可以把房子"踩"到真正的地面上。
   */
  const surfaceAt = (x, z) => {
    for (const cell of cells) {
      const t = top(cell);
      if (!t) continue;
      if (x < cell.minX || x > cell.maxX || z < cell.minZ || z > cell.maxZ) continue;
      if (!pointInQuad(cell.pts, x, z)) continue;
      const p = cell.pts;
      const y0 = yOf(p[0]), y1 = yOf(p[1]), y2 = yOf(p[2]), y3 = yOf(p[3]);
      // 和画面对齐：三角形 (0,1,2) + (0,2,3)，用 XZ 重心坐标插值
      const tri = (ax, az, bx, bz, cx, cz, hA, hB, hC) => {
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) return null;
        const wA = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const wB = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const wC = 1 - wA - wB;
        if (wA < -1e-6 || wB < -1e-6 || wC < -1e-6) return null;
        return (hA * wA + hB * wB + hC * wC) * L;
      };
      const a = tri(p[0].x, p[0].z, p[1].x, p[1].z, p[2].x, p[2].z, y0, y1, y2);
      if (a !== null) return a;
      const b = tri(p[0].x, p[0].z, p[2].x, p[2].z, p[3].x, p[3].z, y0, y2, y3);
      if (b !== null) return b;
      return null;
    }
    return null;
  };

  return {
    geometry,
    surfaceAt,
    stats: {
      triangles: pos.length / 9,
      faces,
      cliffs,
      slopes,
      ms: +(performance.now() - t0).toFixed(1),
    },
  };
}
