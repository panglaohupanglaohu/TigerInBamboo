// =====================================================================
//  角柱图适配器（C9 · G-13）
//  节点 = 格顶点 (gx,gz) × 层 iy；边 = 共享格边（N/E/S/W）或同柱相邻层（U/D）。
//  mask → bans 用 G-12 的 classId + 目录 allowedClasses。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import {
  CORNER_DIRS,
  CORNER_OPP,
  CORNER_DELTA,
  cornerBit,
} from "./cornerPrototypes.js";

export { CORNER_DIRS, CORNER_OPP, CORNER_DELTA };

/** 角柱 (gx,gz,iy) 的 8-bit 邻域。格坐标 = (gx-1+dx, iy+dy, gz-1+dz)。 */
export function cornerMaskAt(grid, gx, gz, iy) {
  let mask = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        if (grid.has(`${gx - 1 + dx},${iy + dy},${gz - 1 + dz}`)) {
          mask |= 1 << cornerBit(dx, dz, dy);
        }
      }
    }
  }
  return mask;
}

/**
 * @param {Map<string,string>} grid "ix,iy,iz" → char
 * @param {{ cols:number, rows:number, floors:number }} bounds
 */
export function createCornerGraph(grid, { cols, rows, floors } = {}) {
  if (!grid || typeof grid.keys !== "function") {
    throw new Error("createCornerGraph: grid Map required");
  }
  let maxX = 0;
  let maxZ = 0;
  let maxY = 0;
  for (const key of grid.keys()) {
    const [ix, iy, iz] = key.split(",").map(Number);
    if (ix > maxX) maxX = ix;
    if (iz > maxZ) maxZ = iz;
    if (iy > maxY) maxY = iy;
  }
  const C = Number.isInteger(cols) ? cols : maxX + 1;
  const R = Number.isInteger(rows) ? rows : maxZ + 1;
  const F = Number.isInteger(floors) ? floors : maxY + 1;

  const ids = [];
  const masks = [];
  for (let iy = 0; iy <= F; iy++) {
    for (let gz = 0; gz <= R; gz++) {
      for (let gx = 0; gx <= C; gx++) {
        const mask = cornerMaskAt(grid, gx, gz, iy);
        if (!mask) continue;
        ids.push(`c:${gx}:${gz}:${iy}`);
        masks.push(mask);
      }
    }
  }
  const index = new Map(ids.map((id, i) => [id, i]));
  const parse = (id) => {
    const p = id.split(":");
    return [Number(p[1]), Number(p[2]), Number(p[3])];
  };
  const adjacency = ids.map((id) => {
    const [gx, gz, iy] = parse(id);
    const list = [];
    for (const dir of CORNER_DIRS) {
      const [dgx, dgz, diy] = CORNER_DELTA[dir];
      const j = index.get(`c:${gx + dgx}:${gz + dgz}:${iy + diy}`);
      if (j !== undefined) list.push({ to: j, direction: dir });
    }
    return list;
  });

  return {
    kind: "citadel-corner-graph",
    cols: C,
    rows: R,
    floors: F,
    get cellCount() {
      return ids.length;
    },
    cells() {
      return ids.map((id, i) => ({ id, index: i }));
    },
    cellId(i) {
      return ids[i];
    },
    indexOfId(id) {
      return index.get(id) ?? -1;
    },
    neighborsOf(i) {
      return adjacency[i] || [];
    },
    maskOf(i) {
      return masks[i];
    },
    coordOf(i) {
      const [gx, gz, iy] = parse(ids[i]);
      return { gx, gz, iy };
    },
    validate() {
      const errors = [];
      for (let i = 0; i < adjacency.length; i++) {
        for (const e of adjacency[i]) {
          const hasReverse = adjacency[e.to].some(
            (b) => b.to === i && b.direction === CORNER_OPP[e.direction]
          );
          if (!hasReverse) errors.push(`missing-reverse:${ids[i]}->${ids[e.to]}:${e.direction}`);
        }
      }
      return { ok: errors.length === 0, errors };
    },
  };
}

/**
 * @param {object} graph createCornerGraph 的返回
 * @param {object} compiled compileVariants(CORNER_PROTOTYPES)
 * @param {object} maskTable { table: [{mask, classId}, ...] } 或 256 行数组
 * @param {(variant: object) => Set<number>} allowedClassesOf
 */
export function cornerBans(graph, compiled, maskTable, allowedClassesOf) {
  const rows = Array.isArray(maskTable) ? maskTable : maskTable.table;
  const byMask = new Map(rows.map((r) => [r.mask, r]));
  const bans = [];
  for (const { index } of graph.cells()) {
    const mask = graph.maskOf(index);
    const cls = byMask.get(mask)?.classId;
    if (cls === undefined) {
      throw new Error(`cornerBans: mask ${mask} 不在 mask 表里`);
    }
    for (const v of compiled.variants) {
      const allowed = allowedClassesOf(v);
      if (!allowed || !allowed.has(cls)) {
        bans.push({ cell: index, variant: v.index, reason: `mask-class-${cls}` });
      }
    }
  }
  return bans;
}
