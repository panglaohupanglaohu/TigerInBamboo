// =====================================================================
//  VoxelGrid3D — 3D 体素网格图适配器（V7-G1）
//  六向邻接（N/E/S/W/U/D）、有限高度（y ∈ [0, height)）、boundary policy、
//  稳定 cell ID（"v:{x}:{y}:{z}"）。y 方向永不周期。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

export const DIR3 = Object.freeze(["N", "E", "S", "W", "U", "D"]);
export const OPP3 = Object.freeze({ N: "S", S: "N", E: "W", W: "E", U: "D", D: "U" });
const DELTA3 = Object.freeze({
  N: [0, 0, -1],
  S: [0, 0, 1],
  W: [-1, 0, 0],
  E: [1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
});

/**
 * @param {object} opts
 * @param {number} opts.width  x（>0）
 * @param {number} opts.height y / 楼层（>0，有限，永不周期）
 * @param {number} opts.depth  z（>0）
 * @param {"sealed"|"open"|"periodic-x"|"periodic-z"|"periodic-xz"} [opts.boundary]
 *   sealed：水平边界外无邻居（墙式）；open：同 sealed（显式别名）；
 *   periodic-x/z/xz：对应水平轴回绕。
 */
export function createVoxelGrid3D({ width, height, depth, boundary = "sealed" }) {
  width = width >>> 0;
  height = height >>> 0;
  depth = depth >>> 0;
  if (width <= 0 || height <= 0 || depth <= 0) {
    throw new Error(`VoxelGrid3D size must be > 0, got ${width}x${height}x${depth}`);
  }
  const periodicX = boundary === "periodic-x" || boundary === "periodic-xz";
  const periodicZ = boundary === "periodic-z" || boundary === "periodic-xz";

  const idOf = (x, y, z) => `v:${x}:${y}:${z}`;
  const indexOf = (x, y, z) => (y * depth + z) * width + x;

  const count = width * height * depth;
  const adjacency = new Array(count);
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const list = [];
        for (const dir of DIR3) {
          const [dx, dy, dz] = DELTA3[dir];
          let nx = x + dx;
          const ny = y + dy;
          let nz = z + dz;
          if (ny < 0 || ny >= height) continue; // y 有限且永不周期
          if (nx < 0 || nx >= width) {
            if (!periodicX) continue;
            nx = (nx + width) % width;
          }
          if (nz < 0 || nz >= depth) {
            if (!periodicZ) continue;
            nz = (nz + depth) % depth;
          }
          list.push({ to: indexOf(nx, ny, nz), direction: dir });
        }
        adjacency[indexOf(x, y, z)] = list;
      }
    }
  }

  const ids = new Array(count);
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) ids[indexOf(x, y, z)] = idOf(x, y, z);
    }
  }
  const idToIndex = new Map(ids.map((id, i) => [id, i]));

  return {
    kind: "voxel-grid-3d",
    width,
    height,
    depth,
    boundary,
    get cellCount() {
      return count;
    },
    cells() {
      return ids.map((id, index) => ({ id, index }));
    },
    cellId(index) {
      return ids[index];
    },
    indexOfId(id) {
      return idToIndex.get(id) ?? -1;
    },
    /** @returns {{to:number, direction:string}[]}（稳定 N,E,S,W,U,D 序） */
    neighborsOf(index) {
      return adjacency[index] || [];
    },
    validate() {
      const errors = [];
      for (let i = 0; i < adjacency.length; i++) {
        for (const e of adjacency[i]) {
          const hasReverse = adjacency[e.to].some(
            (b) => b.to === i && b.direction === OPP3[e.direction]
          );
          if (!hasReverse) errors.push(`missing-reverse:${ids[i]}->${ids[e.to]}:${e.direction}`);
        }
      }
      return { ok: errors.length === 0, errors };
    },
  };
}
