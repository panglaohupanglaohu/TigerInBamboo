// =====================================================================
//  RectGrid2D — 2D 矩形网格图适配器（V7-G1）
//  支持非周期 / 单轴周期 / 双轴周期边界与稳定 cell ID（"r:{x}:{y}"）。
//  统一图接口：cells() / neighborsOf(index)（方向 token 来自边，不写死）。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

export const DIR2 = Object.freeze(["N", "E", "S", "W"]);
export const OPP2 = Object.freeze({ N: "S", S: "N", E: "W", W: "E" });
const DELTA2 = Object.freeze({
  N: [0, -1],
  S: [0, 1],
  W: [-1, 0],
  E: [1, 0],
});

/**
 * @param {object} opts
 * @param {number} opts.width  x 方向格数（>0）
 * @param {number} opts.height y 方向格数（>0）
 * @param {"non-periodic"|"periodic-x"|"periodic-y"|"periodic-both"} [opts.boundary]
 */
export function createRectGrid2D({ width, height, boundary = "non-periodic" }) {
  width = width >>> 0;
  height = height >>> 0;
  if (width <= 0 || height <= 0) throw new Error(`RectGrid2D size must be > 0, got ${width}x${height}`);

  const periodicX = boundary === "periodic-x" || boundary === "periodic-both";
  const periodicY = boundary === "periodic-y" || boundary === "periodic-both";

  const idOf = (x, y) => `r:${x}:${y}`;
  const indexOf = (x, y) => y * width + x;

  // 预计算邻接表：adjacency[i] = [{ to, direction }]
  const adjacency = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const list = [];
      for (const dir of DIR2) {
        const [dx, dy] = DELTA2[dir];
        let nx = x + dx;
        let ny = y + dy;
        if (nx < 0 || nx >= width) {
          if (!periodicX) continue;
          nx = (nx + width) % width;
        }
        if (ny < 0 || ny >= height) {
          if (!periodicY) continue;
          ny = (ny + height) % height;
        }
        list.push({ to: indexOf(nx, ny), direction: dir });
      }
      adjacency[indexOf(x, y)] = list;
    }
  }

  const ids = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) ids[indexOf(x, y)] = idOf(x, y);
  }
  const idToIndex = new Map(ids.map((id, i) => [id, i]));

  return {
    kind: "rect-grid-2d",
    width,
    height,
    boundary,
    get cellCount() {
      return width * height;
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
    /** @returns {{to:number, direction:string}[]} 出边列表（稳定 N,E,S,W 序） */
    neighborsOf(index) {
      return adjacency[index] || [];
    },
    /** 邻接完整性自检：每条边存在方向互补的反向边（宽度 2 的周期网格
     *  存在平行回绕边，只要存在任一互补反向边即合法） */
    validate() {
      const errors = [];
      for (let i = 0; i < adjacency.length; i++) {
        for (const e of adjacency[i]) {
          const hasReverse = adjacency[e.to].some(
            (b) => b.to === i && b.direction === OPP2[e.direction]
          );
          if (!hasReverse) errors.push(`missing-reverse:${ids[i]}->${ids[e.to]}:${e.direction}`);
        }
      }
      return { ok: errors.length === 0, errors };
    },
  };
}
