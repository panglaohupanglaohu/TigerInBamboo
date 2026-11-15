/**
 * terrain-collide.js — collision against the final, cage-deformed terrain mesh (r55).
 *
 * REACode/overhangterrain + 1671808851895627776 overhangs: once shape.js bends the cliff walls (lean,
 * twist, hierarchical smoothing) and soft tops tilt the plateaus, the logical cell polygons are no
 * longer where the rock is. This collider is built from the exact wall quads and top-fan triangles
 * that terrain/terrainmesh.js emitted (World.terrainSurface, recorded when world.terrainCollide is
 * set), so a unit collides with the drawn rock, including overhang walls and soft slopes.
 *
 *   heightAt(x, z, yMax)    highest drawn top surface at (x, z) not above yMax (overhang floors work)
 *   wallSegmentsAt(y)       every wall quad cut at height y → horizontal segments with outward normals
 *   pushOut(x, y, z, r)     push a vertical cylinder of radius r (at height y) out of the deformed walls
 *
 * Hook for the battle/unit code (not wired here; battle.js belongs to G3): after WorldMesh rebuilds,
 * `const col = terrainCollider(world)`; per unit `({x, z} = col.pushOut(x, y, z, r))`, `y = col.heightAt(x, z, y + step)`.
 */

const CELL = 1.0;

export function terrainCollider(world, surface = world.terrainSurface) {
  if (!surface?.walls || !surface?.tops) throw new RangeError('terrainCollider needs World.terrainSurface (set world.terrainCollide and rebuild the mesh)');
  const tops = surface.tops, walls = surface.walls;
  const bin = new Map(), wbin = new Map();
  const add = (map, minX, maxX, minZ, maxZ, k) => {
    for (let i = Math.floor(minX / CELL); i <= Math.floor(maxX / CELL); i++)
      for (let j = Math.floor(minZ / CELL); j <= Math.floor(maxZ / CELL); j++) {
        const key = i * 73856093 ^ j * 19349663; let a = map.get(key); if (!a) map.set(key, a = []); a.push(k);
      }
  };
  tops.forEach((t, k) => { const xs = t.t.map((p) => p[0]), zs = t.t.map((p) => p[2]); add(bin, Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), k); });
  walls.forEach((wq, k) => { const xs = wq.q.map((p) => p[0]), zs = wq.q.map((p) => p[2]); add(wbin, Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), k); });
  const near = (map, x, z, r = 0) => {
    const out = new Set();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) for (const k of map.get(i * 73856093 ^ j * 19349663) ?? []) out.add(k);
    return out;
  };

  function heightAt(x, z, yMax = Infinity) {
    let best = -Infinity, cell = -1;
    for (const k of near(bin, x, z)) {
      const [A, B, C] = tops[k].t;
      const d = (B[0] - A[0]) * (C[2] - A[2]) - (C[0] - A[0]) * (B[2] - A[2]);
      if (Math.abs(d) < 1e-14) continue;
      const u = ((B[0] - x) * (C[2] - z) - (C[0] - x) * (B[2] - z)) / d, v = ((C[0] - x) * (A[2] - z) - (A[0] - x) * (C[2] - z)) / d, w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      const y = u * A[1] + v * B[1] + w * C[1];
      if (y <= yMax + 1e-9 && y > best) { best = y; cell = tops[k].cell; }
    }
    return best === -Infinity ? null : { y: best, cell };
  }

  /** Cut wall quad k at height y: quad is [a-bottom, b-bottom, b-top, a-top]. */
  function cut(k, y) {
    const [A, B, C, D] = walls[k].q;
    const ta = D[1] - A[1], tb = C[1] - B[1];
    const lo = Math.min(A[1], B[1]), hi = Math.max(D[1], C[1]);
    if (y < lo - 1e-9 || y > hi + 1e-9) return null;
    const fa = ta > 1e-12 ? (y - A[1]) / ta : NaN, fb = tb > 1e-12 ? (y - B[1]) / tb : NaN;
    const ok = (f) => f >= -1e-9 && f <= 1 + 1e-9;
    if (!ok(fa) || !ok(fb)) return null;     // only where both side edges span y (trapezoid walls are cut conservatively)
    const p = [A[0] + (D[0] - A[0]) * fa, A[2] + (D[2] - A[2]) * fa], q = [B[0] + (C[0] - B[0]) * fb, B[2] + (C[2] - B[2]) * fb];
    let nx = q[1] - p[1], nz = -(q[0] - p[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (nx * walls[k].out[0] + nz * walls[k].out[2] < 0) { nx = -nx; nz = -nz; }
    return { k, p, q, n: [nx, nz], cell: walls[k].cell };
  }
  function wallSegmentsAt(y, x = null, z = null, r = 0) {
    const ids = x === null ? walls.keys() : near(wbin, x, z, r);
    const out = []; for (const k of ids) { const s = cut(k, y); if (s) out.push(s); } return out;
  }
  function closest(s, x, z) {
    const dx = s.q[0] - s.p[0], dz = s.q[1] - s.p[1], l2 = dx * dx + dz * dz;
    const t = l2 < 1e-14 ? 0 : Math.max(0, Math.min(1, ((x - s.p[0]) * dx + (z - s.p[1]) * dz) / l2));
    return [s.p[0] + dx * t, s.p[1] + dz * t];
  }
  /** Distance to the nearest wall at height y and whether (x,z) is on the rock side of it. */
  function wallDistance(x, y, z, r = 1) {
    let best = Infinity, inside = false;
    for (const s of wallSegmentsAt(y, x, z, r + CELL)) {
      const [cx, cz] = closest(s, x, z), d = Math.hypot(x - cx, z - cz);
      if (d < best) { best = d; inside = (x - cx) * s.n[0] + (z - cz) * s.n[1] < 0; }
    }
    return { d: best, inside };
  }
  function pushOut(x, y, z, r, { iterations = 24 } = {}) {
    let px = x, pz = z, contacts = 0, blocked = false;
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      for (const s of wallSegmentsAt(y, px, pz, r + CELL)) {
        const [cx, cz] = closest(s, px, pz), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
        const side = dx * s.n[0] + dz * s.n[1];
        if (d >= r - 1e-9) continue;
        // in front of the wall but too close → push along the separation; behind it (inside rock) → push out along the wall normal
        const [ux, uz] = side >= 0 && d > 1e-12 ? [dx / d, dz / d] : s.n;
        px = cx + ux * r; pz = cz + uz * r; moved = true; contacts++;
      }
      if (!moved) break;
      if (it === iterations - 1) blocked = true;
    }
    if (blocked) {
      // inside corners can make the per-wall projection oscillate: fall back to the nearest free spot on
      // rings around the start (clearance ≥ r, on the open side); only a pocket narrower than 2r stays blocked
      search: for (let rr = 0.02; rr <= 0.6 + 1e-9; rr += 0.02) for (let a = 0; a < 32; a++) {
        const cx = x + Math.cos(a / 32 * Math.PI * 2) * rr, cz = z + Math.sin(a / 32 * Math.PI * 2) * rr, d = wallDistance(cx, y, cz, r);
        if (d.d >= r && !d.inside) { px = cx; pz = cz; blocked = false; break search; }
      }
    }
    return { x: px, z: pz, contacts, blocked };
  }
  return { heightAt, wallSegmentsAt, wallDistance, pushOut, walls: walls.length, tops: tops.length, version: surface.version };
}
