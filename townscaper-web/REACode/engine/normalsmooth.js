/**
 * normalsmooth.js — terrain normals averaged over a voxel-sized neighbourhood.
 *
 * Source note (x.com/OskSta/status/1062374549407350790):
 *
 *   "To make Bad North even prettier, I'm adding some extra smoothing to the
 *    island using my voxel normals. It helps break up the grid and make it all
 *    look a wee bit more natural."
 *
 * And the follow-up (x.com/OskSta/status/929417420921556993):
 *
 *   "Fun fact: I generate smooth normals for all my meshes and use a blend
 *    between smooth and hard normals in the final lighting"
 *
 * What the clip shows: the island is built from quads on a funky grid, yet the
 * shading runs *across* the quad borders — a flat quad next to a cliff is not a
 * uniform patch of colour, it falls off towards the cliff. The silhouette is
 * still stepped (the geometry is untouched), only the normals are smooth. That
 * is what breaks up the grid read without touching the topology, which is the
 * point of doing it in normals rather than in vertices.
 *
 * How: `computeVertexNormals()` already averages per-face normals at shared
 * vertices, but the terrain mesh has *split* vertices (one per quad, so colours
 * and seams stay per-cell), so every vertex ends up with its own face normal
 * and every face shades flat. Averaging by *position* instead of by index
 * rebuilds the smooth field the split destroyed: any two vertices that sit at
 * the same (or nearly the same) spot share their normals.
 *
 * The "voxel" part is the radius: neighbours are gathered within roughly one
 * voxel of the grid, so the blend spans a cell, not the whole island. A second,
 * deliberate guard keeps real corners hard — where the smoothed normal points
 * far away from the geometric one, the blend is dialled back, exactly the
 * "blend between smooth and hard normals" the follow-up describes.
 */

/**
 * @param {THREE.BufferGeometry} geometry  mutated in place
 * @param {object} opts
 * @param {number} opts.radius   neighbourhood radius in world units (≈ 1 voxel)
 * @param {number} opts.blend    how far to go towards the smoothed normal (0..1)
 * @param {number} opts.hardLo   dot(n, avg) below this keeps the hard normal
 * @param {number} opts.hardHi   dot(n, avg) above this takes the full blend
 * @returns {{verts:number, smoothed:number, welded:number}}
 */
export function smoothTerrainNormals(geometry, {
  radius = 0.55,
  blend = 0.72,
  hardLo = 0.55,
  hardHi = 0.92,
} = {}) {
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  if (!pos || !nrm) return { verts: 0, smoothed: 0, welded: 0 };

  const count = pos.count;
  const cell = Math.max(radius, 1e-3);
  const buckets = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;

  // Spatial hash. One bucket per voxel-sized cell; neighbours are the 27 cells
  // around a vertex, which is what makes the field "voxel sized" rather than
  // global.
  for (let i = 0; i < count; i++) {
    const x = Math.floor(pos.getX(i) / cell);
    const y = Math.floor(pos.getY(i) / cell);
    const z = Math.floor(pos.getZ(i) / cell);
    const k = key(x, y, z);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(i);
  }

  const out = new Float32Array(count * 3);
  const r2 = radius * radius;
  let smoothed = 0;
  let welded = 0;

  for (let i = 0; i < count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);

    let ax = 0, ay = 0, az = 0, wsum = 0;
    let shared = 0;
    const bx = Math.floor(px / cell), by = Math.floor(py / cell), bz = Math.floor(pz / cell);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          const b = buckets.get(key(bx + ox, by + oy, bz + oz));
          if (!b) continue;
          for (const j of b) {
            const dx = pos.getX(j) - px, dy = pos.getY(j) - py, dz = pos.getZ(j) - pz;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > r2) continue;
            if (j === i) { shared++; continue; }
            if (d2 < 1e-10) { shared++; welded++; }
            // near neighbours weigh more: the field should be local
            const w = 1.0 / (1.0 + d2 * 4.0);
            ax += nrm.getX(j) * w;
            ay += nrm.getY(j) * w;
            az += nrm.getZ(j) * w;
            wsum += w;
          }
        }
      }
    }

    if (wsum < 1e-6) {
      out[i * 3] = nx; out[i * 3 + 1] = ny; out[i * 3 + 2] = nz;
      continue;
    }

    let sx = ax / wsum, sy = ay / wsum, sz = az / wsum;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl; sy /= sl; sz /= sl;

    // hard-normal guard: the further the smooth normal wanders from the
    // geometric one, the less of it we take. Corners stay crisp.
    const cosang = nx * sx + ny * sy + nz * sz;
    const w = blend * smoothstep(hardLo, hardHi, cosang);
    if (w > 0.01) smoothed++;

    let ox2 = nx + (sx - nx) * w;
    let oy2 = ny + (sy - ny) * w;
    let oz2 = nz + (sz - nz) * w;
    const ol = Math.hypot(ox2, oy2, oz2) || 1;
    out[i * 3] = ox2 / ol;
    out[i * 3 + 1] = oy2 / ol;
    out[i * 3 + 2] = oz2 / ol;
  }

  // 把**原始硬法线另存一份**（原文 929417420921556993：
  //   "I generate smooth normals for all my meshes and use a blend between
  //    smooth and hard normals in the **final lighting**"）
  // 之前这里是"烘焙时混一次就不再回头"，于是想要"更硬一点"只能整岛重建。
  // 存成 aFlatNormal 之后，混合比例变成着色器里的一个 uniform（surface.js 的
  // uNormalMix），A/B 只改一个数，而且描边/法线 pass 读的仍是平滑后的 normal，
  // 不受影响。
  if (!geometry.getAttribute('aFlatNormal')) {
    const flat = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      flat[i * 3] = nrm.getX(i);
      flat[i * 3 + 1] = nrm.getY(i);
      flat[i * 3 + 2] = nrm.getZ(i);
    }
    // 本文件没有 import three（只碰 attribute 接口），所以复用现有 attribute 的构造函数
    geometry.setAttribute('aFlatNormal', new nrm.constructor(flat, 3));
  }

  for (let i = 0; i < count; i++) {
    nrm.setXYZ(i, out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
  }
  nrm.needsUpdate = true;

  return { verts: count, smoothed, welded };
}

function smoothstep(a, b, x) {
  if (b === a) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
