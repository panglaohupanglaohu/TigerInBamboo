/**
 * cage-c09.js — 第 56 批 C09-D · 1579478470098243584
 * "To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells."
 *
 * shape.js 的 at(p, s) 只给出「笼角点」在连续层高 s 处的位置（相邻切面线性插值）。
 * 片子里的崖面是整面被笼形变拉弯的，所以这里补两件事（纯函数，不改 shape.js / terrainmesh.js）：
 *
 *   cageWallPoint(shape, a, b, lv, u, v, L)
 *     崖壁第 lv 段（切面 lv-1 → lv）内部任意点：沿边 a→b 取 u、沿高度取 v，
 *     双线性 = 与 terrainmesh 发出的墙四边形、以及 terrain-collide 按高度切墙的做法同一张面。
 *   cageSlice(shape, cell, s)
 *     连续层高 s 处整格的笼截面多边形（每个角点都是 shape.at(p, s)）。
 *   insideCage(shape, cell, x, y, z, L)
 *     3D 点是否落在「已形变的格笼」内：按 y 取连续截面，再做点在多边形内判定。
 *   cageCollider(shape, world, L)
 *     对所有岩石列建立形变笼的 3D 包含 / 推出：pushOut(x,y,z,r) 把半径 r 的竖柱推到形变后的崖面外。
 *     与 terrain/terrain-collide.js（按实际画出的墙四边形碰撞）互为校验。
 */

const lerp = (a, b, t) => a + (b - a) * t;

/** 崖壁内部点：u ∈[0,1] 沿 a→b，v ∈[0,1] 从切面 lv-1 到切面 lv。返回 [x, y, z]。 */
export function cageWallPoint(shape, a, b, lv, u, v, L) {
  if (!(lv >= 1)) throw new RangeError('wall level must be ≥ 1');
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) throw new RangeError('u, v must be in [0,1]');
  const s = lv - 1 + v;                       // 连续层高：与 shape.at 的分数切面一致
  const pa = shape.at(a, s), pb = shape.at(b, s);
  return [lerp(pa[0], pb[0], u), s * L, lerp(pa[1], pb[1], u)];
}

/** 连续层高 s 处整格的形变截面（[[x,z],…]，与 cell.pts 同序）。 */
export function cageSlice(shape, cell, s) {
  return cell.pts.map((p) => shape.at(p, s));
}

function pointInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 3D 点是否在该格（已形变）的笼里，只看高度 y 落在第几段；不看体素是否实心。 */
export function insideCage(shape, cell, x, y, z, L) {
  if (y < 0) return false;
  return pointInPoly(cageSlice(shape, cell, y / L), x, z);
}

function closestOnSeg(p, q, x, z) {
  const dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz;
  const t = l2 < 1e-14 ? 0 : Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2));
  return [p[0] + dx * t, p[1] + dz * t];
}

/**
 * 岩石列的形变笼碰撞。实心判定：高度 y 所在层 lv=ceil(y/L) 在该格是岩石。
 * 只在「实心格 ↔ 非实心邻格」的边上生成墙（与 terrainmesh 一致），墙的位置用连续切面。
 */
export function cageCollider(shape, world, L) {
  const cells = world.cells;
  const solidAt = (c, y) => {
    if (!c) return false;
    const lv = Math.max(1, Math.ceil(y / L - 1e-9));
    return world.isRock(c, lv);
  };
  /** 高度 y 处所有暴露的形变墙段（外法线指向空气）。 */
  function wallsAt(y, x = null, z = null, r = 0) {
    const out = [];
    const s = y / L;
    for (const c of cells) {
      if (x !== null && Math.hypot(c.cx - x, c.cz - z) > r + 2.5) continue;
      if (!solidAt(c, y)) continue;
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        if (solidAt(o, y)) continue;
        const p = shape.at(c.pts[i], s), q = shape.at(c.pts[(i + 1) % c.n], s);
        // 外法线：格中心指向边的一侧
        let nx = q[1] - p[1], nz = -(q[0] - p[0]);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const ctr = cageSlice(shape, c, s).reduce((m, v) => [m[0] + v[0] / c.n, m[1] + v[1] / c.n], [0, 0]);
        if ((p[0] - ctr[0]) * nx + (p[1] - ctr[1]) * nz < 0) { nx = -nx; nz = -nz; }
        out.push({ cell: c.id, edge: i, p, q, n: [nx, nz] });
      }
    }
    return out;
  }
  function cellAt(x, y, z) {
    for (const c of cells) {
      if (Math.hypot(c.cx - x, c.cz - z) > 2.5) continue;
      if (insideCage(shape, c, x, y, z, L)) return c;
    }
    return null;
  }
  /** 点是否在形变后的岩石内。 */
  function solid(x, y, z) {
    const c = cellAt(x, y, z);
    return !!c && solidAt(c, y);
  }
  function wallDistance(x, y, z, r = 1) {
    let best = Infinity;
    for (const s of wallsAt(y, x, z, r)) {
      const [cx, cz] = closestOnSeg(s.p, s.q, x, z);
      best = Math.min(best, Math.hypot(x - cx, z - cz));
    }
    return { d: best, inside: solid(x, y, z) };
  }
  function pushOut(x, y, z, r, { iterations = 24 } = {}) {
    let px = x, pz = z, contacts = 0;
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      const inRock = solid(px, y, pz);
      for (const s of wallsAt(y, px, pz, r)) {
        const [cx, cz] = closestOnSeg(s.p, s.q, px, pz), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
        const side = dx * s.n[0] + dz * s.n[1];
        if (!inRock && d >= r - 1e-9) continue;
        if (inRock && side > 0 && d >= r - 1e-9) continue;
        const [ux, uz] = !inRock && side >= 0 && d > 1e-12 ? [dx / d, dz / d] : s.n;
        if (inRock && side < 0 && d > r * 4) continue;      // 远处的墙不管，只推最近的出口
        px = cx + ux * r; pz = cz + uz * r; moved = true; contacts++;
        break;
      }
      if (!moved) break;
    }
    const after = wallDistance(px, y, pz, r);
    return { x: px, z: pz, contacts, inside: after.inside, clearance: after.d };
  }
  return { wallsAt, cellAt, solid, wallDistance, pushOut };
}
