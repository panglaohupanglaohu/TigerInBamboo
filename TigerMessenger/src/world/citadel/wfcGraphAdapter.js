// =====================================================================
//  Citadel cell graph — 非空格为节点，六向 N/E/S/W/U/D。
//
//  两条规则决定了这张图长什么样，都来自 S19/S20：
//  · **水平边只在同色格之间建**。Townscaper 里颜色是玩家刷的「这是同一栋楼」，
//    异色相邻不共享屋顶（S19 t=3.50：黄塔紧贴红屋顶，红屋顶自己收边成 gable.end，
//    没有跨过去合并）。异色在 exposure 里记成 "foreign"，对 policy 等同一堵别人的墙。
//  · **竖向边不分颜色**：叠在一起就是同一根柱子。
//
//  exposure 四态（不是布尔）：
//    "air"       无格
//    "foreign"   异色相邻（不建边）
//    "edge"      同色相邻，且该邻居**上方还有格**（它是体块）
//    "edge-top"  同色相邻，且该邻居**上方无格**（它也是顶格）
//  顶格之间要么屋顶延续（ridge↔ridge）、要么晒台连片，绝不会互相砌一堵墙——
//  这就是 townBanPolicy 要区分 edge / edge-top 的原因。
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

export const CITADEL_DELTA = Object.freeze({
  N: Object.freeze([0, 0, -1]),
  E: Object.freeze([1, 0, 0]),
  S: Object.freeze([0, 0, 1]),
  W: Object.freeze([-1, 0, 0]),
  U: Object.freeze([0, 1, 0]),
  D: Object.freeze([0, -1, 0]),
});
export const CITADEL_OPP = Object.freeze({ N: "S", S: "N", E: "W", W: "E", U: "D", D: "U" });
export const CITADEL_DIRS = Object.freeze(["N", "E", "S", "W", "U", "D"]);
export const CITADEL_HORIZ = Object.freeze(["N", "E", "S", "W"]);

/**
 * @param {Map<string, string>} grid  "ix,iy,iz" → char（只含非空格）
 * @param {object} [opts]
 * @param {boolean} [opts.colorSplit=true] 水平边是否只连同色格。
 *   关掉只用于对照实验（会让相邻异色楼合并屋顶，画面立刻不像 Townscaper）。
 */
export function createCitadelCellGraph(grid, { colorSplit = true } = {}) {
  if (!grid || typeof grid.keys !== "function") {
    throw new Error("createCitadelCellGraph: grid Map required");
  }
  // 稳定序 iy → iz → ix：solver 的遍历顺序与 hash 都依赖它
  const ids = [...grid.keys()]
    .map((k) => k.split(",").map(Number))
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0])
    .map(([ix, iy, iz]) => `${ix},${iy},${iz}`);
  const index = new Map(ids.map((id, i) => [id, i]));
  const coord = ids.map((id) => id.split(",").map(Number));
  const hasAbove = (ix, iy, iz) => grid.has(`${ix},${iy + 1},${iz}`);

  const adjacency = ids.map((id, i) => {
    const [ix, iy, iz] = coord[i];
    const mine = grid.get(id);
    const list = [];
    for (const dir of CITADEL_DIRS) {
      const [dx, dy, dz] = CITADEL_DELTA[dir];
      const nid = `${ix + dx},${iy + dy},${iz + dz}`;
      const j = index.get(nid);
      if (j === undefined) continue;
      if (colorSplit && dy === 0 && grid.get(nid) !== mine) continue; // 异色不建边
      list.push({ to: j, direction: dir });
    }
    return list;
  });

  const exposureOf = ids.map((id, i) => {
    const [ix, iy, iz] = coord[i];
    const mine = grid.get(id);
    const exp = {};
    for (const dir of CITADEL_DIRS) {
      const [dx, dy, dz] = CITADEL_DELTA[dir];
      const nx = ix + dx;
      const ny = iy + dy;
      const nz = iz + dz;
      const nid = `${nx},${ny},${nz}`;
      if (!grid.has(nid)) exp[dir] = "air";
      else if (colorSplit && dy === 0 && grid.get(nid) !== mine) exp[dir] = "foreign";
      else if (dy === 0 && !hasAbove(nx, ny, nz)) exp[dir] = "edge-top";
      else exp[dir] = "edge";
    }
    return Object.freeze(exp);
  });

  // 同列连续非空格数（含自己，向上向下都算）：孤立高柱成塔要用
  const columnHeightOf = ids.map((_, i) => {
    const [ix, iy, iz] = coord[i];
    let up = 0;
    let down = 0;
    while (grid.has(`${ix},${iy + up + 1},${iz}`)) up++;
    while (grid.has(`${ix},${iy - down - 1},${iz}`)) down++;
    return up + down + 1;
  });

  // 整根柱子是否「四面无同色邻居」。塔必须按**柱**判定而不是按格：
  // 只让顶格当塔、底下几格当普通体块，锥顶的 D 面就找不到 stack.tower 支撑，
  // 求解直接矛盾（2026-09-04 实测 19,2,10 empty-domain）。
  const columnIsolatedOf = (() => {
    const byColumn = new Map();
    ids.forEach((id, i) => {
      const [ix, , iz] = coord[i];
      const key = `${ix},${iz}`;
      const free = CITADEL_HORIZ.every((d) => exposureOf[i][d] === "air" || exposureOf[i][d] === "foreign");
      byColumn.set(key, (byColumn.get(key) ?? true) && free);
    });
    return ids.map((_, i) => {
      const [ix, , iz] = coord[i];
      return byColumn.get(`${ix},${iz}`) === true;
    });
  })();

  return {
    kind: "citadel-cell-graph",
    colorSplit,
    get cellCount() {
      return ids.length;
    },
    cells() {
      return ids.map((id, cellIndex) => ({ id, index: cellIndex }));
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
    /** @returns {{N:string,E:string,S:string,W:string,U:string,D:string}} 四态 */
    exposure(i) {
      return exposureOf[i];
    },
    columnHeight(i) {
      return columnHeightOf[i];
    },
    /** 整根柱子四面都没有同色邻居（塔的必要条件） */
    columnIsolated(i) {
      return columnIsolatedOf[i];
    },
    charOf(i) {
      return grid.get(ids[i]);
    },
    validate() {
      const errors = [];
      for (let i = 0; i < adjacency.length; i++) {
        for (const e of adjacency[i]) {
          const hasReverse = adjacency[e.to].some(
            (b) => b.to === i && b.direction === CITADEL_OPP[e.direction]
          );
          if (!hasReverse) errors.push(`missing-reverse:${ids[i]}->${ids[e.to]}:${e.direction}`);
        }
      }
      return { ok: errors.length === 0, errors };
    },
  };
}
