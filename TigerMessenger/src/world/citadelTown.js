// ============================================================================
//  Citadel Town — Townscaper 式规则化圣城构建器
//
//  城市不再手工摆放坐标：布局是一张逐层 ASCII 单元格地图（见
//  CITADEL_TOWN_SPEC），建筑构件全部由邻接规则自动生成——
//    · 实心体块        · 屋顶边缘城垛      · 3×3 屋顶矩形中心出黄金穹顶
//    · 1×1 高塔出金顶  · 悬空格下出拱      · 暴露立面出拱窗
//    · 墙脚屋顶出绿植  · D 格出棕色正门门廊
//    · 低层开阔平台边缘出围栏（立柱+横杆）——「带围栏的基座」
//    · 底层被夹出且与格外相通的水道：铺水面 + 夹道立面出拱形水门
//    · 条状屋顶出人字坡顶 · 孤立方顶出四坡尖顶（瓦红 roofTile）
//  改布局 = 改几行 ASCII，几秒完成一轮迭代。
//
//  坐标约定：行 0 = 后排（z−），末行 = 前排（z+，朝正门/瀑布）；列 0 = 左（x−）。
//  小镇原点位于基座底面中心，由调用方抬放到台地顶面。
// ============================================================================
import * as THREE from "three";

/** 编辑器（citadelEditorPanel / townscaper.html）与主场景共用的布局存档键。 */
export const CITADEL_LEVELS_KEY = "tm.citadel.levels.v1";
export const CITADEL_TERRACE_COUNT = 5;
export const CITADEL_CASTLE_FLOORS = 5;
export const CITADEL_GRID_SIZE = 25;

/**
 * Canonical 2D-map/3D-town grid transform. Every editor surface, support
 * query and generated mesh must use this function so cell (12, *, 12) stays
 * exactly on the shared citadel origin.
 */
export function citadelGridCellCenter(
  ix,
  iy,
  iz,
  cellSize = CITADEL_TOWN_SPEC.cellSize,
  cellHeight = CITADEL_TOWN_SPEC.cellHeight,
  gridSize = CITADEL_GRID_SIZE
) {
  return {
    x: (ix - (gridSize - 1) / 2) * cellSize,
    y: (iy + 0.5) * cellHeight,
    z: (iz - (gridSize - 1) / 2) * cellSize,
  };
}

export const CITADEL_TOWN_SPEC = Object.freeze({
  cellSize: 2.0,
  cellHeight: 2.0,
  // 字符：`.` 空 · `W` 白石 · `L` 浅砂石 · `B` 淡砖（角塔）· `D` 棕色正门
  levels: Object.freeze([
    // Level 0 —— 7×7 基座，四角淡砖塔基，前排中央正门；
    // 第 5 列纵向留空成水道（两端与格外相通）；iz=0 一排离墙附屋
    // （1×3 条状，顶部出坡屋顶），iz=1 空格成后排水巷。
    Object.freeze([
      "..WWW..",
      ".......",
      "BWWWW.B",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "BWWDW.B",
    ]),
    // Level 1 —— 正门上方的门洞豁口（..W.W.. → 悬空位）；水道与附屋同层续空
    Object.freeze([
      "..WWW..",
      ".......",
      "BWWWW.B",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "WLLLL.W",
      "BWW.W.B",
    ]),
    // Level 2 —— 基座顶层；门洞豁口上方悬空格 → 出拱；
    // 本层整体横跨水道（水道成暗渠，两端出拱形水门）
    Object.freeze([
      ".......",
      ".......",
      "BWWWWWB",
      "WWWWWWW",
      "WWWWWWW",
      "WWWWWWW",
      "WWWWWWW",
      "WWWWWWW",
      "BWWWWWB",
    ]),
    // Level 3 —— 5×5 中层内缩，四角塔继续拔高
    Object.freeze([
      ".......",
      ".......",
      "B.....B",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      "B.....B",
    ]),
    // Level 4 —— 5×5 中层顶层；角塔到顶 → 出金顶
    Object.freeze([
      ".......",
      ".......",
      "B.....B",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      ".WWWWW.",
      "B.....B",
    ]),
    // Level 5 —— 3×3 顶层
    Object.freeze([
      ".......",
      ".......",
      ".......",
      ".......",
      "..WWW..",
      "..WWW..",
      "..WWW..",
      ".......",
      ".......",
    ]),
    // Level 6 —— 3×3 屋顶：中心格出主黄金穹顶
    Object.freeze([
      ".......",
      ".......",
      ".......",
      ".......",
      "..WWW..",
      "..WWW..",
      "..WWW..",
      ".......",
      ".......",
    ]),
  ]),
});

const EMPTY_CASTLE_FLOOR = Object.freeze(
  Array.from({ length: CITADEL_GRID_SIZE }, () => ".".repeat(CITADEL_GRID_SIZE))
);

function centerFloor(rows, size = CITADEL_GRID_SIZE) {
  const source = Array.isArray(rows) && rows.length ? rows.map(String) : ["."];
  const sourceWidth = Math.max(1, ...source.map((row) => row.length));
  const offsetX = Math.floor((size - sourceWidth) / 2);
  const offsetZ = Math.floor((size - source.length) / 2);
  const output = Array.from({ length: size }, () => ".".repeat(size));
  for (let iz = 0; iz < source.length; iz++) {
    const targetZ = offsetZ + iz;
    if (targetZ < 0 || targetZ >= size) continue;
    const chars = [...output[targetZ]];
    for (let ix = 0; ix < source[iz].length; ix++) {
      const targetX = offsetX + ix;
      if (targetX >= 0 && targetX < size) chars[targetX] = source[iz][ix];
    }
    output[targetZ] = chars.join("");
  }
  return Object.freeze(output);
}

function normalizeFiveFloors(levels, useLegacyCrown = false) {
  const source = Array.isArray(levels) ? levels : [];
  const selected = useLegacyCrown && source.length > CITADEL_CASTLE_FLOORS
    ? [...source.slice(0, CITADEL_CASTLE_FLOORS - 1), source[source.length - 1]]
    : source.slice(0, CITADEL_CASTLE_FLOORS);
  return Object.freeze(
    Array.from({ length: CITADEL_CASTLE_FLOORS }, (_, floor) =>
      selected[floor] ? centerFloor(selected[floor]) : EMPTY_CASTLE_FLOOR
    )
  );
}

/**
 * Normalize legacy single-stack saves and the v2 five-terrace layout into:
 * terrace 0 = 台地 1（最高）, each terrace owns exactly five castle floors.
 * Every floor is padded to a common 25×25 centered grid, so editing one
 * terrace can never shift the shared sacred-city origin.
 */
export function normalizeCitadelTerraceLayout(input = CITADEL_TOWN_SPEC) {
  const rawTerraces = input?.terraces;
  let terraces;
  if (Array.isArray(rawTerraces)) {
    terraces = rawTerraces.map((entry) =>
      normalizeFiveFloors(Array.isArray(entry) ? entry : entry?.levels)
    );
  } else {
    const legacy = Array.isArray(input) ? input : input?.levels;
    terraces = [normalizeFiveFloors(legacy, true)];
  }
  while (terraces.length < CITADEL_TERRACE_COUNT) {
    terraces.push(normalizeFiveFloors([]));
  }
  terraces.length = CITADEL_TERRACE_COUNT;
  return Object.freeze({
    version: 2,
    gridSize: CITADEL_GRID_SIZE,
    terraces: Object.freeze(
      terraces.map((levels, terraceIndex) =>
        Object.freeze({ terraceIndex, levels })
      )
    ),
  });
}

const DIRS = Object.freeze([
  Object.freeze([1, 0]), // +x
  Object.freeze([-1, 0]), // -x
  Object.freeze([0, 1]), // +z（前排/门面）
  Object.freeze([0, -1]), // -z
]);

/** 开阔屋顶边缘出围栏（而非城垛）的最高层：0–2 层=基座露台。 */
const FENCE_MAX_LEVEL = 2;

// ============================================================================
//  栅格模型纯函数 —— Townscaper 编辑器（townscaper.html）与本构建器共用
//  同一份数据模型。grid 是 Map<"ix,iy,iz", char>，不依赖 three，headless 可测。
// ============================================================================

/** ASCII 逐层布局 → 栅格 Map（跳过 `.` 空格）。 */
export function levelsToGrid(levels) {
  const grid = new Map();
  levels.forEach((rowsArr, iy) => {
    rowsArr.forEach((row, iz) => {
      [...row].forEach((char, ix) => {
        if (char !== ".") grid.set(`${ix},${iy},${iz}`, char);
      });
    });
  });
  return grid;
}

/**
 * 栅格 Map → ASCII 逐层布局（尺寸取栅格包围盒，至少 1×1；与
 * CITADEL_TOWN_SPEC.levels 同格式，可直接粘贴回写）。空层输出全 `.`。
 */
export function gridToLevels(grid) {
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (const key of grid.keys()) {
    const [ix, iy, iz] = key.split(",").map(Number);
    if (ix > maxX) maxX = ix;
    if (iy > maxY) maxY = iy;
    if (iz > maxZ) maxZ = iz;
  }
  const levels = [];
  for (let iy = 0; iy <= maxY; iy++) {
    const rowsArr = [];
    for (let iz = 0; iz <= maxZ; iz++) {
      let row = "";
      for (let ix = 0; ix <= maxX; ix++) {
        row += grid.get(`${ix},${iy},${iz}`) ?? ".";
      }
      rowsArr.push(row);
    }
    levels.push(rowsArr);
  }
  return levels;
}

/** 放置/改色一格（char 为 `.` 时等价于 clearCell）。 */
export function setCell(grid, ix, iy, iz, char) {
  if (char === ".") grid.delete(`${ix},${iy},${iz}`);
  else grid.set(`${ix},${iy},${iz}`, char);
  return grid;
}

/** 删除一格。 */
export function clearCell(grid, ix, iy, iz) {
  grid.delete(`${ix},${iy},${iz}`);
  return grid;
}

/**
 * 求一根城堡柱的下一放置层。空柱落到当前台地承重面；非空柱叠到
 * 最高块上；五层已满或无承重面时返回 null。保持为纯函数，供 UI 与
 * headless 测试共用，避免最高层被误判成可重复放置。
 */
export function resolveCitadelDropTarget(
  grid,
  ix,
  iz,
  supportLevel,
  maxLevel = CITADEL_CASTLE_FLOORS - 1
) {
  for (let iy = maxLevel; iy >= 0; iy--) {
    if (!grid.has(`${ix},${iy},${iz}`)) continue;
    return iy < maxLevel ? { ix, iy: iy + 1, iz } : null;
  }
  if (supportLevel < 0 || supportLevel > maxLevel) return null;
  return { ix, iy: supportLevel, iz };
}

/**
 * 人字坡屋顶棱柱（非索引三角面）：屋脊沿 +x，两坡落水、檐口略出挑，
 * 两端山墙封三角。沿 z 成条时 clone 后 rotateY(π/2)。
 */
function makeGableRoofGeometry(cs, ch) {
  const w = cs * 0.56; // 坡面半宽（檐口出挑 0.12cs）
  const h = ch * 0.5; // 屋脊净高
  const l = cs * 0.54; // 沿屋脊半长（与邻格坡顶相接）
  const tris = [
    // 北坡（z−）
    [-l, 0, -w], [l, h, 0], [l, 0, -w],
    [-l, 0, -w], [-l, h, 0], [l, h, 0],
    // 南坡（z+）
    [-l, 0, w], [l, 0, w], [l, h, 0],
    [-l, 0, w], [l, h, 0], [-l, h, 0],
    // 山墙（x− / x+）
    [-l, 0, -w], [-l, 0, w], [-l, h, 0],
    [l, 0, -w], [l, h, 0], [l, 0, w],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 由单元格地图规则生成圣城。
 *
 * @param {typeof CITADEL_TOWN_SPEC} spec 逐层 ASCII 布局
 * @param {{
 *   mesh: (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, outline?: number) => THREE.Mesh,
 *   materials: Record<string, THREE.Material>, // W/L/B/D/gold/wood/ink
 *   random: () => number,
 *   archWindowGeometry: THREE.BufferGeometry,
 *   buildHalfDome: (radius: number, material: THREE.Material, name: string, stretchY?: number) => THREE.Mesh,
 *   buildShrub: (name: string, scale: number, materials: object, random: () => number) => THREE.Group,
 *   buildTopiary: (name: string, scale: number, materials: object, random: () => number) => THREE.Group,
 *   finialHeight: number,
 * }} ctx 调用方提供的 toon/描边构建约定
 * @returns {{ levels: THREE.Group[], stats: object }}
 */
export function buildCitadelTown(spec, ctx) {
  const { cellSize: cs, cellHeight: ch } = spec;
  const { mesh, materials, random } = ctx;

  // ---------- 栅格索引 ----------
  const grid = new Map();
  let cols = Number.isInteger(spec.gridSize) ? spec.gridSize : 0;
  let rows = Number.isInteger(spec.gridSize) ? spec.gridSize : 0;
  spec.levels.forEach((rowsArr, iy) => {
    rows = Math.max(rows, rowsArr.length);
    rowsArr.forEach((row, iz) => {
      cols = Math.max(cols, row.length);
      [...row].forEach((char, ix) => {
        if (char !== ".") grid.set(`${ix},${iy},${iz}`, char);
      });
    });
  });
  const at = (ix, iy, iz) => grid.get(`${ix},${iy},${iz}`) ?? ".";
  const cx = (ix) => citadelGridCellCenter(ix, 0, 0, cs, ch, cols).x;
  const cz = (iz) => citadelGridCellCenter(0, 0, iz, cs, ch, rows).z;
  const cy = (iy) => citadelGridCellCenter(0, iy, 0, cs, ch, cols).y;

  const levelGroups = spec.levels.map((_, iy) => {
    const group = new THREE.Group();
    group.name = `town-level-${iy}`;
    return group;
  });

  const stats = {
    cellCount: 0,
    windowCount: 0,
    crenelCount: 0,
    domeCount: 0,
    towerCount: 0,
    archCount: 0,
    shrubCount: 0,
    fenceCount: 0,
    roofCount: 0,
    canalCount: 0,
    waterGateCount: 0,
    gate: null,
  };
  const domeCenters = new Set(); // "ix,iy,iz" —— 不出垛口/塔顶
  const towerTops = new Set();

  // ---------- 规则 0：实心体块 ----------
  const cellGeometry = new THREE.BoxGeometry(cs, ch, cs);
  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const cell = mesh(cellGeometry, materials[char] ?? materials.W, "town-cell");
    cell.position.set(cx(ix), cy(iy), cz(iz));
    cell.userData.cell = { ix, iy, iz, char };
    levelGroups[iy].add(cell);
    stats.cellCount++;
  }

  const isRoof = (ix, iy, iz) => at(ix, iy, iz) !== "." && at(ix, iy + 1, iz) === ".";

  // ---------- 规则 1：穹顶 —— 3×3 全屋顶区域的中心 ----------
  {
    const candidates = new Set();
    for (const key of grid.keys()) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (!isRoof(ix, iy, iz)) continue;
      let full = true;
      for (let dx = -1; dx <= 1 && full; dx++) {
        for (let dz = -1; dz <= 1 && full; dz++) {
          if (!isRoof(ix + dx, iy, iz + dz)) full = false;
        }
      }
      if (full) candidates.add(key);
    }
    // 连通分组，每组在离质心最近的候选格上出一座穹顶
    const seen = new Set();
    for (const key of candidates) {
      if (seen.has(key)) continue;
      const component = [];
      const queue = [key];
      seen.add(key);
      while (queue.length) {
        const current = queue.pop();
        component.push(current.split(",").map(Number));
        const [ix, iy, iz] = component[component.length - 1];
        for (const [dx, dz] of DIRS) {
          const next = `${ix + dx},${iy},${iz + dz}`;
          if (candidates.has(next) && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      const centroid = component.reduce(
        (sum, [ix, , iz]) => [sum[0] + ix, sum[2] + iz],
        [0, 0, 0]
      );
      const tx = centroid[0] / component.length;
      const tz = centroid[1] / component.length;
      let best = component[0];
      let bestDist = Infinity;
      for (const [ix, iy, iz] of component) {
        const dist = (ix - tx) ** 2 + (iz - tz) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = [ix, iy, iz];
        }
      }
      const [bx, by, bz] = best;
      domeCenters.add(`${bx},${by},${bz}`);
      const dome = new THREE.Group();
      dome.name = "town-dome";
      const drum = mesh(
        new THREE.CylinderGeometry(cs * 0.72, cs * 0.8, 0.5, 10),
        materials.W,
        "town-dome-drum",
        0.04
      );
      drum.position.y = 0.25;
      dome.add(drum);
      const cap = ctx.buildHalfDome(cs * 0.78, materials.gold, "town-dome-cap", 1.28);
      cap.position.y = 0.5;
      dome.add(cap);
      if (by >= Math.min(4, spec.levels.length - 1)) {
        // 主穹顶避雷针（2× 玩家身高）
        const finial = mesh(
          new THREE.CylinderGeometry(0.03, 0.03, ctx.finialHeight, 6),
          materials.ink,
          "town-dome-finial",
          0.018
        );
        finial.position.y = 0.5 + cs * 0.78 * 1.28 + ctx.finialHeight / 2;
        dome.add(finial);
      }
      dome.position.set(cx(bx), (by + 1) * ch, cz(bz));
      levelGroups[by].add(dome);
      stats.domeCount++;
    }
  }

  // ---------- 规则 2：塔楼金顶 —— 1×1 竖向连续 ≥3 层、顶部四邻皆空 ----------
  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      let top = -1;
      for (let iy = spec.levels.length - 1; iy >= 0; iy--) {
        if (at(ix, iy, iz) !== ".") {
          top = iy;
          break;
        }
      }
      if (top < 2) continue;
      const char = at(ix, top, iz);
      let run = 0;
      for (let iy = top; iy >= 0 && at(ix, iy, iz) === char; iy--) run++;
      if (run < 3) continue;
      let isolated = true;
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, top, iz + dz) !== ".") isolated = false;
      }
      if (!isolated || domeCenters.has(`${ix},${top},${iz}`)) continue;
      towerTops.add(`${ix},${top},${iz}`);
      const cap = ctx.buildHalfDome(cs * 0.56, materials.gold, "town-tower-cap", 1.22);
      cap.position.set(cx(ix), (top + 1) * ch, cz(iz));
      levelGroups[top].add(cap);
      stats.towerCount++;
    }
  }

  // ---------- 规则 2.5：坡屋顶 / 尖顶 —— 条状屋顶出人字坡，孤立方顶出四坡尖顶 ----------
  // 条状 = 仅沿一个轴向有同层邻居、且条带两侧开敞（贴墙条带保持平顶露台）；
  // 坡顶格不再出城垛/围栏（skipTrim 走 roofCells）。
  const roofCells = new Set();
  {
    const gableX = makeGableRoofGeometry(cs, ch); // 屋脊沿 +x
    const gableZ = gableX.clone().rotateY(Math.PI / 2); // 屋脊沿 +z
    const spireGeometry = new THREE.ConeGeometry(cs * 0.58, ch * 0.55, 4);
    spireGeometry.rotateY(Math.PI / 4); // 四坡尖顶对齐格边
    for (const key of grid.keys()) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (!isRoof(ix, iy, iz)) continue;
      if (domeCenters.has(key) || towerTops.has(key)) continue;
      const sx = (at(ix - 1, iy, iz) !== "." ? 1 : 0) + (at(ix + 1, iy, iz) !== "." ? 1 : 0);
      const sz = (at(ix, iy, iz - 1) !== "." ? 1 : 0) + (at(ix, iy, iz + 1) !== "." ? 1 : 0);
      if (sx > 0 && sz > 0) continue; // 拐角/大片平顶 → 留给围栏与城垛
      if (sx === 0 && sz === 0) {
        const spire = mesh(spireGeometry, materials.roofTile, "town-spire", 0.035);
        spire.position.set(cx(ix), (iy + 1) * ch + ch * 0.27, cz(iz));
        levelGroups[iy].add(spire);
        roofCells.add(key);
        stats.roofCount++;
        continue;
      }
      const alongX = sx > 0;
      // 条带两侧必须都开敞（一侧贴墙的是露台边缘，不上坡顶）
      const openSides = alongX
        ? at(ix, iy, iz - 1) === "." && at(ix, iy, iz + 1) === "."
        : at(ix - 1, iy, iz) === "." && at(ix + 1, iy, iz) === ".";
      if (!openSides) continue;
      const roof = mesh(alongX ? gableX : gableZ, materials.roofTile, "town-roof", 0.04);
      roof.position.set(cx(ix), (iy + 1) * ch, cz(iz));
      levelGroups[iy].add(roof);
      roofCells.add(key);
      stats.roofCount++;
    }
  }

  // 围栏构件几何（低层开阔屋顶边缘：立柱 + 通长横杆）
  const fencePostGeometry = new THREE.BoxGeometry(0.09, 0.5, 0.09);
  const fenceRailXGeometry = new THREE.BoxGeometry(cs + 0.06, 0.07, 0.07); // 横杆沿 x
  const fenceRailZGeometry = new THREE.BoxGeometry(0.07, 0.07, cs + 0.06); // 横杆沿 z

  // ---------- 规则 3：逐格立面/屋顶构件 ----------
  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const isGate = char === "D";

    // 暴露立面出拱窗（底层为台基不开窗；门面留给正门）
    if (iy >= 1) {
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) !== ".") continue;
        if (isGate && dz === 1) continue;
        const window = mesh(ctx.archWindowGeometry, materials.ink, "town-window", 0.022);
        window.position.set(
          cx(ix) + dx * (cs / 2 + 0.028),
          cy(iy) - ch * 0.08,
          cz(iz) + dz * (cs / 2 + 0.028)
        );
        window.rotation.y = Math.atan2(dx, dz);
        levelGroups[iy].add(window);
        stats.windowCount++;
      }
    }

    // 屋顶格：边缘出城垛（高处/贴墙）或围栏（低层开阔平台）；墙脚出绿植
    if (isRoof(ix, iy, iz)) {
      const skipTrim = domeCenters.has(key) || towerTops.has(key) || roofCells.has(key);
      if (!skipTrim) {
        for (const [dx, dz] of DIRS) {
          if (at(ix + dx, iy, iz + dz) !== ".") continue;
          const openSky = at(ix + dx, iy + 1, iz + dz) === "."; // 边缘上空无更高墙体
          if (openSky && iy <= FENCE_MAX_LEVEL) {
            // 围栏：低层开阔平台（基座露台）边缘出立柱 + 横杆
            const ex = cx(ix) + dx * cs / 2;
            const ez = cz(iz) + dz * cs / 2;
            const topY = (iy + 1) * ch;
            for (const offset of [-cs * 0.36, cs * 0.36]) {
              const post = mesh(fencePostGeometry, materials[char] ?? materials.W, "town-fence", 0.018);
              post.position.set(
                ex + (dz !== 0 ? offset : 0),
                topY + 0.25,
                ez + (dx !== 0 ? offset : 0)
              );
              levelGroups[iy].add(post);
            }
            const rail = mesh(
              dz !== 0 ? fenceRailXGeometry : fenceRailZGeometry,
              materials[char] ?? materials.W,
              "town-fence",
              0.018
            );
            rail.position.set(ex, topY + 0.46, ez);
            levelGroups[iy].add(rail);
            stats.fenceCount++;
            continue;
          }
          // 城垛：高处檐口或贴着更高墙体的墙脚
          for (const offset of [-cs * 0.26, cs * 0.26]) {
            const merlon = mesh(
              new THREE.BoxGeometry(0.42, 0.52, 0.42),
              materials[char] ?? materials.W,
              "town-crenel",
              0.03
            );
            merlon.position.set(
              cx(ix) + dx * (cs / 2 - 0.22) + (dz !== 0 ? offset : 0),
              (iy + 1) * ch + 0.26,
              cz(iz) + dz * (cs / 2 - 0.22) + (dx !== 0 ? offset : 0)
            );
            levelGroups[iy].add(merlon);
            stats.crenelCount++;
          }
        }
        // 屋顶花园：贴着更高墙体的屋面格，种子概率出绿植
        let hugsWall = false;
        for (const [dx, dz] of DIRS) {
          if (at(ix + dx, iy + 1, iz + dz) !== ".") hugsWall = true;
        }
        if (hugsWall && random() < 0.32) {
          const green =
            stats.shrubCount % 2 === 0
              ? ctx.buildShrub(`town-shrub-${stats.shrubCount}`, 1.05, ctx.shrubMaterials, random)
              : ctx.buildTopiary(`town-shrub-${stats.shrubCount}`, 0.95, ctx.shrubMaterials, random);
          green.position.set(
            cx(ix) + (random() - 0.5) * 0.5,
            (iy + 1) * ch,
            cz(iz) + (random() - 0.5) * 0.5
          );
          levelGroups[iy].add(green);
          stats.shrubCount++;
        }
      }
    }

    // 悬空格出拱：下方为空且某轴向两侧有支撑
    if (iy > 0 && at(ix, iy - 1, iz) === ".") {
      const alongX = at(ix - 1, iy, iz) !== "." && at(ix + 1, iy, iz) !== ".";
      const alongZ = at(ix, iy, iz - 1) !== "." && at(ix, iy, iz + 1) !== ".";
      if (alongX || alongZ) {
        const archGeometry = new THREE.CylinderGeometry(
          cs * 0.48,
          cs * 0.48,
          cs * 0.96,
          12,
          1,
          false,
          0,
          Math.PI
        );
        archGeometry.rotateZ(Math.PI / 2); // 轴线转为 x
        archGeometry.rotateX(-Math.PI / 2); // 弧面朝天
        if (!alongX) archGeometry.rotateY(Math.PI / 2);
        const arch = mesh(archGeometry, materials[char] ?? materials.W, "town-arch", 0.035);
        arch.position.set(cx(ix), iy * ch + 0.02, cz(iz));
        levelGroups[iy - 1].add(arch);
        stats.archCount++;
      }
    }

    // 正门：深色门洞 + 棕色双开门 + 木门廊（朝 +z 前排）
    if (isGate) {
      const gate = new THREE.Group();
      gate.name = "town-gate";
      const recess = mesh(
        new THREE.BoxGeometry(1.5, 1.9, 0.12),
        materials.ink,
        "town-gate-recess",
        0.03
      );
      recess.position.set(0, 0.95, cs / 2 + 0.02);
      gate.add(recess);
      for (const sx of [-0.36, 0.36]) {
        const door = mesh(
          new THREE.BoxGeometry(0.68, 1.7, 0.08),
          materials.wood,
          "town-gate-door",
          0.025
        );
        door.position.set(sx, 0.85, cs / 2 + 0.07);
        gate.add(door);
      }
      for (const sx of [-0.82, 0.82]) {
        const column = mesh(
          new THREE.CylinderGeometry(0.14, 0.17, 2.3, 5),
          materials.wood,
          "town-gate-portico-column",
          0.03
        );
        column.position.set(sx, 1.15, cs / 2 + 0.62);
        gate.add(column);
      }
      const pediment = mesh(
        new THREE.ConeGeometry(1.45, 0.72, 4, 1, true),
        materials.wood,
        "town-gate-portico-pediment",
        0.035
      );
      pediment.position.set(0, 2.42, cs / 2 + 0.62);
      pediment.rotation.x = Math.PI;
      pediment.rotation.y = Math.PI / 4;
      gate.add(pediment);
      gate.position.set(cx(ix), 0, cz(iz));
      levelGroups[iy].add(gate);
      stats.gate = { ix, iy, iz, x: cx(ix), z: cz(iz) + cs / 2 };
    }
  }

  // ---------- 规则 4：水道 —— 底层被建筑夹出、且与格外相通的空格成水道 ----------
  // 判定：iy=0 空格，x 向或 z 向两侧皆为实心格（夹道），且经底层空格
  // 洪水填充可达包围盒边界（与外部水面相通）。水道格铺水面；夹道的
  // 建筑立面在底层出拱形水门（水道口）。
  {
    const empty0 = (x, z) => at(x, 0, z) === ".";
    const reached = new Set();
    const queue = [];
    for (let ix = -1; ix <= cols; ix++) {
      for (let iz = -1; iz <= rows; iz++) {
        const onRing = ix === -1 || iz === -1 || ix === cols || iz === rows;
        if (onRing && empty0(ix, iz)) {
          reached.add(`${ix},${iz}`);
          queue.push([ix, iz]);
        }
      }
    }
    while (queue.length) {
      const [x, z] = queue.pop();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx;
        const nz = z + dz;
        const k = `${nx},${nz}`;
        if (nx < -1 || nx > cols || nz < -1 || nz > rows) continue;
        if (reached.has(k) || !empty0(nx, nz)) continue;
        reached.add(k);
        queue.push([nx, nz]);
      }
    }
    const waterGeometry = new THREE.BoxGeometry(cs * 0.98, 0.12, cs * 0.98);
    for (const key of reached) {
      const [ix, iz] = key.split(",").map(Number);
      if (ix < 0 || ix >= cols || iz < 0 || iz >= rows) continue; // 格外水源不算
      const enclosedX = at(ix - 1, 0, iz) !== "." && at(ix + 1, 0, iz) !== ".";
      const enclosedZ = at(ix, 0, iz - 1) !== "." && at(ix, 0, iz + 1) !== ".";
      if (!enclosedX && !enclosedZ) continue;
      const water = mesh(waterGeometry, materials.water, "town-canal-water", 0.02);
      water.castShadow = false;
      water.position.set(cx(ix), 0.34, cz(iz));
      levelGroups[0].add(water);
      stats.canalCount++;
      // 拱形水门：夹道立面底层开深色拱券（水道口）
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, 0, iz + dz) === ".") continue;
        const waterGate = mesh(ctx.archWindowGeometry, materials.ink, "town-watergate", 0.024);
        waterGate.scale.set(2.1, 0.72, 1.5);
        waterGate.position.set(
          cx(ix) + dx * (cs / 2 + 0.03),
          0.02,
          cz(iz) + dz * (cs / 2 + 0.03)
        );
        waterGate.rotation.y = Math.atan2(dx, dz);
        levelGroups[0].add(waterGate);
        stats.waterGateCount++;
      }
    }
  }

  stats.gridSize = { cols, rows, levels: spec.levels.length };
  return { levels: levelGroups, stats };
}
