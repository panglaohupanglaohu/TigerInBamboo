/**
 * voxel-ao.js — 793557992931266561 "flat -> up normal -> vertex voxel AO -> SSAO -> directional AO
 * (With textures and baked vertex colors, I could get rid of the SSAO)".
 *
 * 逐格（共享 World）的四档着色量，迁自 REACode src/voxelao.js buildVoxelAO：
 *   flat / upNormal / ao（邻居高差遮蔽，无方向）/ dirAo（被哪一侧挡住：带符号向量）。
 * 网格顶点上的同四档在 bake.js bakeLighting({aoMode}) 里，读同一张分层占用；
 * 本文件给的是格级"体素事实"与全岛统计，用来证明四档确实不同。SSAO 原作自己去掉了，不迁。
 */
export const FACE_DIRS = ['+x', '-x', '+z', '-z'];
const OFFSETS = [['+x', 1, 0], ['-x', -1, 0], ['+z', 0, 1], ['-z', 0, -1]];
const opposite = (d) => (d[0] === '+' ? '-' : '+') + d[1];

export function buildVoxelAO(world) {
  const cells = world.cells;
  const height = new Int16Array(cells.length);
  for (let i = 0; i < cells.length; i++) height[i] = world.top(cells[i]);
  // 不规则格：用格心连线方向判断"这一侧的邻居"，不能靠边序号
  const neighbourHeight = (cell, dx, dz) => {
    let best = 0, bestDot = 0.55;
    for (const nid of cell.edgeNeighbors) {
      if (nid < 0) continue;
      const nc = cells[nid], vx = nc.cx - cell.cx, vz = nc.cz - cell.cz, l = Math.hypot(vx, vz) || 1;
      const d = (vx / l) * dx + (vz / l) * dz;
      if (d > bestDot) { bestDot = d; best = height[nid]; }
    }
    return best;
  };
  function faceShading(cell, dir) {
    if (dir !== 'top' && !FACE_DIRS.includes(dir)) throw new RangeError('face dir');
    const h = height[cell.id];
    const nb = OFFSETS.map(([name, dx, dz]) => ({ name, h: neighbourHeight(cell, dx, dz) }));
    if (dir === 'top') {
      let blocked = 0, wsum = 0;
      for (const n of nb) { const d = Math.max(0, n.h - h), w = 1 / (1 + d * 0.8); blocked += (d > 0 ? 1 : 0) * w; wsum += w; }
      const ao = 1 - 0.30 * (blocked / Math.max(1e-6, wsum));
      const px = Math.max(0, nb[0].h - h), nx = Math.max(0, nb[1].h - h), pz = Math.max(0, nb[2].h - h), nz = Math.max(0, nb[3].h - h);
      const k = 1 / (1 + Math.max(px, nx, pz, nz, 1));
      return { flat: 1, upNormal: 1, ao, dirAo: [(px - nx) * k, 1, (pz - nz) * k] };
    }
    const rec = nb.find((n) => n.name === dir), front = Math.max(0, rec.h - h);
    let side = 0;
    for (const n of nb) if (n.name !== dir && n.name !== opposite(dir)) side = Math.max(side, n.h - h);
    const ao = 1 - 0.34 * Math.min(1, front * 0.5) - 0.14 * Math.min(1, Math.max(0, side) * 0.5);
    const sign = dir[0] === '+' ? 1 : -1;
    return { flat: 1, upNormal: 0.55, ao, dirAo: dir[1] === 'x' ? [sign, 0, 0] : [0, 0, sign] };
  }
  function stats() {
    const m = { flat: [], upNormal: [], ao: [], dirAo: [] };
    for (const cell of cells) {
      if (height[cell.id] <= 0) continue;
      const t = faceShading(cell, 'top');
      m.flat.push(t.flat); m.upNormal.push(t.upNormal); m.ao.push(t.ao); m.dirAo.push(Math.hypot(t.dirAo[0], t.dirAo[2]));
      for (const d of FACE_DIRS) { const f = faceShading(cell, d); m.ao.push(f.ao); m.upNormal.push(f.upNormal); }
    }
    const st = (arr) => { const a = arr.slice().sort((x, y) => x - y); if (!a.length) return { mean: 0, p05: 0, p95: 0 }; return { mean: a.reduce((s, v) => s + v, 0) / a.length, p05: a[(a.length * 0.05) | 0], p95: a[Math.min(a.length - 1, (a.length * 0.95) | 0)] }; };
    return { flat: st(m.flat), upNormal: st(m.upNormal), ao: st(m.ao), dirAo: st(m.dirAo), version: world.version };
  }
  return { height, faceShading, stats };
}
