import os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/citadel/gridMigration.js")
s = open(p).read()

start = s.index("export function buildFaceCellMapping(")
end = s.index("/**\n * ASCII levels → face 存档")
body = '''export function buildFaceCellMapping(quad, { candidates = 64, cellKeys = null } = {}) {
  const { gridSize, cellSize, centroids, faceIds } = quad;
  const half = (gridSize - 1) / 2;
  // cellKeys 给了就只配这些列（正常路径：只配非空列）。稳定序：iz,ix 升序。
  const wanted = cellKeys
    ? [...new Set(cellKeys)].sort((a, b) => {
        const [ax, az] = a.split(",").map(Number);
        const [bx, bz] = b.split(",").map(Number);
        return (az - bz) || (ax - bx);
      })
    : null;
  const cells = [];
  if (wanted) {
    for (const key of wanted) {
      const [ix, iz] = key.split(",").map(Number);
      cells.push({ key, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
    }
  } else {
    for (let iz = 0; iz < gridSize; iz++) {
      for (let ix = 0; ix < gridSize; ix++) {
        cells.push({ key: `${ix},${iz}`, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
      }
    }
  }

  const dist = (c, fi) => Math.hypot(centroids[fi][0] - c.x, centroids[fi][1] - c.z);

  // 每列的 K 个最近候选（稳定序：距离 → face 序）
  const cand = cells.map((c) => {
    const all = [];
    for (let fi = 0; fi < centroids.length; fi++) all.push([dist(c, fi), fi]);
    all.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    return all.slice(0, Math.min(candidates, all.length));
  });

  // ---- 拍卖算法（Bertsekas auction，ε 缩放）----
  //
  // 为什么不是贪心：列与 face 在被占用的那片区域里**密度几乎相同**，
  // 「最近优先」的贪心会连锁挤位——2026-09-04 实测同一批数据
  //   贪心（+兜底+2-opt）  P50 0.40 / P95 1.5 / max 3.0
  //   拍卖（本实现）       P50 0.41 / P95 0.74 / max 1.07
  // 差的两格多全是算法的，不是几何的（每个列到最近 face 只有 ≤0.85 格）。
  // 2-opt 救不了：交换的距离和不变，需要的是增广路，而拍卖就是在做这件事。
  //
  // 确定性：候选序、出价队列的初始序、ε 序列全部固定，没有随机。
  const price = new Float64Array(centroids.length);
  const ownerOf = new Int32Array(centroids.length).fill(-1);
  const assign = new Int32Array(cells.length).fill(-1);
  const GUARD = 400000;
  for (let eps = 0.5 * cellSize; eps > 1e-3 * cellSize; eps /= 4) {
    const queue = [];
    for (let i = cells.length - 1; i >= 0; i--) if (assign[i] < 0) queue.push(i);
    let guard = 0;
    while (queue.length && guard++ < GUARD) {
      const i = queue.pop();
      let best = Infinity;
      let second = Infinity;
      let bi = -1;
      for (const [d, fi] of cand[i]) {
        const v = d + price[fi];
        if (v < best) { second = best; best = v; bi = fi; }
        else if (v < second) second = v;
      }
      if (bi < 0) continue;                       // 候选表空（不可能，除非 face 数为 0）
      price[bi] += (Number.isFinite(second) ? second - best : 0) + eps;
      const prev = ownerOf[bi];
      if (prev >= 0) { assign[prev] = -1; queue.push(prev); }
      ownerOf[bi] = i;
      assign[i] = bi;
    }
  }

  // 兜底：K 个候选全被抢光的列（face 数少于列数时才可能）取全局最近空闲 face
  for (let i = 0; i < cells.length; i++) {
    if (assign[i] >= 0) continue;
    let bi = -1;
    let bd = Infinity;
    for (let fi = 0; fi < centroids.length; fi++) {
      if (ownerOf[fi] >= 0) continue;
      const d = dist(cells[i], fi);
      if (d < bd) { bd = d; bi = fi; }
    }
    if (bi < 0) continue;
    ownerOf[bi] = i;
    assign[i] = bi;
  }

  const cellToFace = new Map();
  const faceToCell = new Map();
  const devs = [];
  for (let i = 0; i < cells.length; i++) {
    if (assign[i] < 0) continue;
    const fid = faceIds[assign[i]];
    cellToFace.set(cells[i].key, fid);
    faceToCell.set(fid, cells[i].key);
    devs.push(dist(cells[i], assign[i]) / cellSize);
  }
  const unmappedCells = cells.filter((c) => !cellToFace.has(c.key)).map((c) => c.key);
  devs.sort((a, b) => a - b);
  const at = (q) => (devs.length ? round6(devs[Math.min(devs.length - 1, Math.floor(devs.length * q))]) : 0);
  return {
    cellToFace,
    faceToCell,
    unmappedCells,
    maxDeviationCells: devs.length ? round6(devs[devs.length - 1]) : 0,
    p95DeviationCells: at(0.95),
    p50DeviationCells: at(0.5),
  };
}

'''
s = s[:start] + body + s[end:]
open(p, "w").write(s)
print("ok", len(s))
