// ============================================================================
//  Citadel Town — Townscaper 式规则化圣城构建器
//
//  城市不再手工摆放坐标：布局是一张逐层 ASCII 单元格地图（见
//  CITADEL_TOWN_SPEC），建筑构件全部由邻接规则自动生成——
//    · 实心体块        · 屋顶边缘城垛      · 3×3 屋顶矩形中心出黄金穹顶
//    · 1×1 高塔出金顶  · 悬空格下出拱      · 暴露立面出拱窗
//    · 墙脚屋顶出绿植  · G 格出棕色正门门廊
//    · 低层开阔平台边缘出围栏（立柱+横杆）——「带围栏的基座」
//    · 底层被夹出且与格外相通的水道：铺水面 + 夹道立面出拱形水门
//    · 条状屋顶出人字坡顶 · 孤立方顶出四坡尖顶（瓦红 roofTile）
//    · Townscaper 15 色调色板（0-9A-E）+ 每块明度微抖（5 档）
//    · 户概念（竖柱同色）+ 屋顶形状分类（L/十字/2×2→教堂尖塔，条带→人字坡）
//    · 围合平顶→花园（草+栅栏+树）· 底层围合空格→石板广场 · 水面船/灯笼
//  改布局 = 改几行 ASCII，几秒完成一轮迭代。
//
//  坐标约定：行 0 = 后排（z−），末行 = 前排（z+，朝正门/瀑布）；列 0 = 左（x−）。
//  小镇原点位于基座底面中心，由调用方抬放到台地顶面。
// ============================================================================
import * as THREE from "three";

/** 编辑器（citadelEditorPanel / townscaper.html）与主场景共用的布局存档键。 */
export const CITADEL_LEVELS_KEY = "tm.citadel.levels.v1";

/**
 * 城堡实例化：存档键按实例隔离。
 * 默认实例（高山圣城）用兼容旧档的 CITADEL_LEVELS_KEY；
 * 其他实例（如运河交汇古堡）用带 id 后缀的键，互不覆盖。
 */
export function citadelLevelsKey(instanceId = null) {
  return instanceId ? `tm.citadel.levels.${instanceId}.v1` : CITADEL_LEVELS_KEY;
}

export const CITADEL_TERRACE_COUNT = 5;
export const CITADEL_CASTLE_FLOORS = 5;
export const CITADEL_GRID_SIZE = 25;

// ============================================================================
//  Townscaper 15 色调色板 + 字符集 + 旧档迁移
//  char 集：`.` 空 · `0-9A-E` 十五色 · `G` 正门（特殊语义，不占调色板）
// ============================================================================

/**
 * Townscaper 同名 15 色（适配水墨 toon 明度）。
 * 索引 0–14 ↔ 字符 "0"–"9" 与 "A"–"E"。
 */
export const CITADEL_PALETTE = Object.freeze([
  Object.freeze({ name: "白", char: "0", color: 0xe8e4da }),
  Object.freeze({ name: "米白", char: "1", color: 0xe9ddc0 }),
  Object.freeze({ name: "沙黄", char: "2", color: 0xd8c08a }),
  Object.freeze({ name: "柠黄", char: "3", color: 0xd4b450 }),
  Object.freeze({ name: "橙", char: "4", color: 0xc67a3f }),
  Object.freeze({ name: "砖红", char: "5", color: 0xa8543c }),
  Object.freeze({ name: "陶土", char: "6", color: 0xb06a4a }),
  Object.freeze({ name: "褐", char: "7", color: 0x8a5a3a }),
  Object.freeze({ name: "深褐", char: "8", color: 0x6a4a33 }),
  Object.freeze({ name: "蓝灰", char: "9", color: 0x7c8a93 }),
  Object.freeze({ name: "石板灰", char: "A", color: 0x5f6b73 }),
  Object.freeze({ name: "蓝", char: "B", color: 0x5a7d9e }),
  Object.freeze({ name: "藏青", char: "C", color: 0x3e5368 }),
  Object.freeze({ name: "青", char: "D", color: 0x4d8f84 }),
  Object.freeze({ name: "松绿", char: "E", color: 0x4f7755 }),
]);

/** 正门字符（门廊语义，非调色板色；颜色固定为木褐）。 */
export const CITADEL_GATE_CHAR = "G";
export const CITADEL_GATE_COLOR = 0x8b5a2b;

/** 调色板字符串 "0123456789ABCDE"（顺序即色序）。 */
export const CITADEL_PALETTE_CHARS = CITADEL_PALETTE.map((entry) => entry.char).join("");

/** 字符 → 调色板索引（非色字符返回 -1）。 */
export function citadelPaletteIndexOfChar(char) {
  return CITADEL_PALETTE_CHARS.indexOf(char);
}

/** 调色板索引 → 字符（越界返回 "."）。 */
export function citadelPaletteCharAt(index) {
  return CITADEL_PALETTE[index]?.char ?? ".";
}

/**
 * 旧档迁移（v1：W/L/B/D 四色）→ Townscaper 15 色 + 正门 G。
 * 迁移映射：W→白 0 · L→沙黄 2 · B→陶土 6 · D→正门 G。
 * 在 normalizeCitadelTerraceLayout 入口统一执行，双向无损（导入导出仍 ASCII）。
 */
export function migrateLegacyTownChars(row) {
  return String(row)
    .replace(/W/g, "0")
    .replace(/L/g, "2")
    .replace(/B/g, "6")
    .replace(/D/g, CITADEL_GATE_CHAR);
}

/**
 * 每块明度微抖（Townscaper 手绘感）：按格坐标哈希到 5 档
 * （-4% / -2% / 0 / +2% / +4% 亮度），大面纯色不呆板。
 * 档位取整保证材质可缓存（15 色 × 5 档 = 至多 75 个材质实例）。
 */
export function citadelShadeStep(ix, iz, char = "") {
  const h = (ix * 374761393 + iz * 668265263 + (char ? char.charCodeAt(0) * 2246822519 : 0)) >>> 0;
  return (h % 5) - 2; // -2..+2
}

// ============================================================================
//  扭曲网格（Townscaper 大尺寸扭曲网格的几何层模拟）
//  逻辑网格保持规则（拾取/存档/裁剪全部不变），只在几何层给每个格子的
//  四个角点做确定性扰动——相邻格共享角点，建筑体块互相贴合不裂开，
//  产生原版「手工搭积木」的有机歪斜感。
// ============================================================================

/** 扭曲网格开关：false = 严格正交（对比验收/兼容旧截图） */
export const CITADEL_DISTORTION_ENABLED = true;
/** 角点扰动幅度（cellSize 1.4 的 ~2.4%），确定性、与层高累积 */
const JITTER_AMT = 0.034;
const JITTER_FLOOR_GROWTH = 0.012; // 每层额外累积的歪斜

/**
 * 网格顶点 (gx, gz) 的确定性扰动偏移（局部坐标，单位格尺寸）。
 * 相邻格共享同一角点 → 体块不裂开；结果只依赖 (gx, gz, floor)，可缓存。
 * @returns {{ dx: number, dz: number }}
 */
export function citadelGridVertexJitter(gx, gz, floor = 0) {
  if (!CITADEL_DISTORTION_ENABLED) return { dx: 0, dz: 0 };
  const h = (gx * 1103515245 + gz * 12345 + floor * 78901) >>> 0;
  const h2 = (h ^ (h >>> 13)) >>> 0;
  const a = ((h2 % 1000) / 1000 - 0.5) * 2; // -1..1
  const h3 = (h * 2654435761 + gz * 40503) >>> 0;
  const b = (((h3 ^ (h3 >>> 16)) % 1000) / 1000 - 0.5) * 2;
  const k = JITTER_AMT * (1 + floor * JITTER_FLOOR_GROWTH);
  return { dx: a * k, dz: b * k };
}

/**
 * 把共享 BoxGeometry 克隆为「该格专属」的扭曲立方体：
 * 四个底角/顶角按网格顶点表扰动，与相邻格共享角点坐标（不裂开）。
 * 调用方每格 clone 一次（合并阶段会按材质重新拼装，顶点冗余可接受）。
 *
 * @param {THREE.BufferGeometry} source 共享 BoxGeometry（cs×ch×cs）
 * @param {number} ix 格 x 索引（角点 = ix, ix+1）
 * @param {number} iz 格 z 索引（角点 = iz, iz+1）
 * @param {number} floor 层高（扰动随层累积）
 * @returns {THREE.BufferGeometry} 该格专属的扭曲立方体
 */
export function makeDistortedCellGeometry(source, ix, iz, floor = 0) {
  const geo = source.clone();
  const pos = geo.attributes.position;
  // BoxGeometry（24 顶点非索引）角点布局：x = ±half, y = ±half, z = ±half
  const halfX = source.parameters?.width ? source.parameters.width / 2 : 0.7;
  const halfZ = source.parameters?.depth ? source.parameters.depth / 2 : 0.7;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // 该顶点归属的网格角点：x>0 → ix+1，否则 ix（同理 z）
    const gx = x >= 0 ? ix + 1 : ix;
    const gz = z >= 0 ? iz + 1 : iz;
    const j = citadelGridVertexJitter(gx, gz, floor);
    // 只在 ±x/±z 外立面方向移动角点；y 保持（层高不变）
    if (Math.abs(x) > halfX * 0.9) pos.setX(i, x + j.dx);
    if (Math.abs(z) > halfZ * 0.9) pos.setZ(i, z + j.dz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

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

function normalizeFiveFloors(levels, useLegacyCrown = false, floors = CITADEL_CASTLE_FLOORS) {
  const source = Array.isArray(levels) ? levels : [];
  const selected = useLegacyCrown && source.length > floors
    ? [...source.slice(0, floors - 1), source[source.length - 1]]
    : source.slice(0, floors);
  return Object.freeze(
    Array.from({ length: floors }, (_, floor) =>
      selected[floor] ? centerFloor(selected[floor].map(migrateLegacyTownChars)) : EMPTY_CASTLE_FLOOR
    )
  );
}

/**
 * Normalize legacy single-stack saves and the v2 five-terrace layout into:
 * terrace 0 = 台地 1（最高）, each terrace owns exactly `floors` castle floors
 * （高山圣城 5 层；运河交汇古堡 12 层——层数参数化，100% Townscaper 高塔）。
 * Every floor is padded to a common 25×25 centered grid, so editing one
 * terrace can never shift the shared sacred-city origin.
 */
export function normalizeCitadelTerraceLayout(input = CITADEL_TOWN_SPEC, floors = CITADEL_CASTLE_FLOORS) {
  const rawTerraces = input?.terraces;
  let terraces;
  if (Array.isArray(rawTerraces)) {
    terraces = rawTerraces.map((entry) =>
      normalizeFiveFloors(Array.isArray(entry) ? entry : entry?.levels, false, floors)
    );
  } else {
    const legacy = Array.isArray(input) ? input : input?.levels;
    terraces = [normalizeFiveFloors(legacy, true, floors)];
  }
  while (terraces.length < CITADEL_TERRACE_COUNT) {
    terraces.push(normalizeFiveFloors([], false, floors));
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

/**
 * 台地-建筑放置有效性闭环（纯函数）：
 * 台地半径/层高可缩放，建筑单元必须始终可放置。给定一个台地的五层
 * 栅格与支撑判定器，把「不可放置」的越界格从布局中剔除，返回被裁剪的
 * 格数。支撑判定器由调用方注入（citadelTerrainCellSupported），保持本
 * 模块零 three 依赖、headless 可测。
 *
 * 裁剪规则：某一格在任意楼层有块，但该柱基座格（ix,iz）不再被台地
 * 支撑 → 整柱移除（含悬空的上层块，避免出现无基座的浮空建筑）。
 * 台地放大后不恢复已裁格子——用户手动重放即可，避免隐性数据恢复。
 *
 * @param {string[][]} levels 五层 ASCII 布局（25×25）
 * @param {(ix: number, iz: number) => boolean} isSupported 基座格支撑判定
 * @returns {{ levels: string[][], trimmed: number }}
 */
export function trimCitadelGridToTerrain(levels, isSupported) {
  const grid = levelsToGrid(levels);
  const trimmed = [];
  for (const key of grid.keys()) {
    const [ix, , iz] = key.split(",").map(Number);
    if (!isSupported(ix, iz)) trimmed.push(key);
  }
  for (const key of trimmed) grid.delete(key);
  return { levels: gridToLevels(grid), trimmed: trimmed.length };
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
 * 屋顶连通分量形状分类（Townscaper 屋顶规则核心，纯函数）。
 * 输入 = 顶层（isRoof）格集合的 (ix,iz) 数组；输出形状签名：
 *   - single   1×1 孤立块 → 四坡尖顶（高柱出更高尖顶）
 *   - strip    直线条带 → 人字坡（沿条带轴向）
 *   - L        L 形（恰一个转角格、两臂正交）→ 转角出教堂尖塔
 *   - cross    十字/T 形（存在邻数 ≥3 的格）→ 中心出教堂尖塔
 *   - block2x2 2×2 方块环 → 晒台 + 中央矮尖塔
 *   - plaza    大平顶（其余连通面）→ 花园（贴墙）或晒台
 * 零 three 依赖，供构建规则与 headless 测试共用。
 */
export function classifyRoofComponent(cells) {
  const set = new Set(cells.map(([ix, iz]) => `${ix},${iz}`));
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const neighborDirs = (ix, iz) => {
    const dirs = [];
    for (const [dx, dz] of DIRS4) {
      if (set.has(`${ix + dx},${iz + dz}`)) dirs.push([dx, dz]);
    }
    return dirs;
  };
  const size = cells.length;
  if (size === 1) return { kind: "single" };
  let axisX = 0;
  let axisZ = 0;
  let cornerCount = 0;
  let corner = null;
  let cross = null;
  let hasSolidFace = false; // 存在邻数 ≥3 的格 = 实心面（矩形/阶梯平顶）
  for (const [ix, iz] of cells) {
    const dirs = neighborDirs(ix, iz);
    if (dirs.length >= 4 && !cross) cross = [ix, iz];
    if (dirs.length >= 3) hasSolidFace = true;
    if (dirs.length === 2) {
      const ax = Math.abs(dirs[0][0]) + Math.abs(dirs[1][0]);
      if (ax === 2) axisX++;
      else if (ax === 0) axisZ++;
      else {
        cornerCount++;
        if (!corner) corner = [ix, iz];
      }
    }
  }
  // 十字教堂：恰存在四臂交汇格
  if (cross) return { kind: "cross", center: cross };
  // 2×2 方块环：四格全为垂直转角、无面格
  if (size === 4 && cornerCount === 4 && !hasSolidFace) {
    return { kind: "block2x2" };
  }
  // L 形教堂：无面格、恰一个转角格、两臂正交
  if (!hasSolidFace && cornerCount === 1 && size >= 3) {
    return { kind: "L", corner };
  }
  // 直线条带：无转角格，两端各一邻
  if (cornerCount === 0 && (size === 2 || axisX + axisZ === size - 2)) {
    return { kind: "strip", alongX: axisX > 0 };
  }
  // 其余连通面（矩形/阶梯/不规则）→ 大平顶（花园/晒台）
  return { kind: "plaza" };
}

/**
 * 屋顶静态小鸟（Townscaper 点缀）：低模橙白小鸟停栅栏/檐口，
 * 全基础几何（身体/双翅/头/尾），随机朝向。
 */
function buildCitadelRoofBird(materials, x, y, z, random) {
  const bird = new THREE.Group();
  bird.name = "town-bird";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.16),
    materials.wood
  );
  body.position.y = 0.1;
  bird.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    materials.wood
  );
  head.position.set(0.18, 0.18, 0);
  bird.add(head);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.12),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xd8c08a : 0xb06a4a })
    );
    wing.position.set(0, 0.2, side * 0.14);
    wing.rotation.x = side * 0.28;
    bird.add(wing);
  }
  bird.position.set(x, y, z);
  bird.rotation.y = random() * Math.PI * 2;
  return bird;
}

/**
 * 户概念（Townscaper：竖柱同色 = 一户）。
 * 扫描栅格中每根非空柱 (ix,iz)，返回户列表：
 * { ix, iz, seed, bottom, top, floors, char, hasGate }。
 * seed = 柱坐标哈希，决定该户的窗密度/门面朝向（户级随机，全城稳定）。
 * 纯函数、零 three 依赖，供立面规则与 headless 测试共用。
 */
export function collectCitadelHouses(grid) {
  const columns = new Map(); // "ix,iz" -> { keys: string[], chars: Set }
  for (const key of grid.keys()) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const col = `${ix},${iz}`;
    let entry = columns.get(col);
    if (!entry) columns.set(col, (entry = { keys: [], chars: new Set() }));
    entry.keys.push(key);
    entry.chars.add(grid.get(key));
  }
  const houses = [];
  for (const [col, entry] of columns) {
    const [ix, iz] = col.split(",").map(Number);
    let bottom = Infinity;
    let top = -1;
    let hasGate = false;
    for (const key of entry.keys) {
      const [, iy] = key.split(",").map(Number);
      if (iy < bottom) bottom = iy;
      if (iy > top) top = iy;
      if (grid.get(key) === CITADEL_GATE_CHAR) hasGate = true;
    }
    houses.push({
      ix,
      iz,
      seed: (ix * 374761393 + iz * 668265263) >>> 0,
      bottom,
      top,
      floors: top - bottom + 1,
      char: grid.get(`${ix},${bottom},${iz}`) ?? "0",
      hasGate,
    });
  }
  return houses;
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
  // 旧档字符在入口统一迁移（W/L/B/D → 0/2/6/G），所有调用方共用
  const levels = spec.levels.map((rowsArr) => rowsArr.map(migrateLegacyTownChars));
  levels.forEach((rowsArr, iy) => {
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

  const levelGroups = levels.map((_, iy) => {
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
    doorCount: 0,
    steepleCount: 0,
    gardenCount: 0,
    plazaCount: 0,
    boatCount: 0,
    birdCount: 0,
    supportCount: 0, // 悬空支撑支架（flying buildings 支撑柱 + 斜撑）
    corniceCount: 0,
    plinthCount: 0,
    balconyCount: 0,
    pilasterCount: 0,
    arcadeColumnCount: 0,
    ridgeCount: 0,
    eaveCount: 0,
    oculusCount: 0,
    gate: null,
  };
  const domeCenters = new Set(); // "ix,iy,iz" —— 不出垛口/塔顶
  const towerTops = new Set();

  // ---------- 规则 0：实心体块（扭曲网格：每格克隆 + 角点扰动） ----------
  const cellGeometry = new THREE.BoxGeometry(cs, ch, cs);
  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const cell = mesh(
      makeDistortedCellGeometry(cellGeometry, ix, iz, iy),
      ctx.materials.shade?.(char, ix, iz) ?? materials[char] ?? materials.W,
      "town-cell"
    );
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
      if (by >= Math.min(4, levels.length - 1)) {
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

  // ---------- 规则 2：塔楼金顶 —— 1×1 竖向连续 3 层、顶部四邻皆空 ----------
  // 3 层塔保留黄金穹顶（本作特色）；≥4 层细柱在规则 2.5 的 single 分支
  // 出更高四坡尖顶（红旗/旗杆不做）。
  for (let ix = 0; ix < cols; ix++) {
    for (let iz = 0; iz < rows; iz++) {
      let top = -1;
      for (let iy = levels.length - 1; iy >= 0; iy--) {
        if (at(ix, iy, iz) !== ".") {
          top = iy;
          break;
        }
      }
      if (top < 2) continue;
      const char = at(ix, top, iz);
      let run = 0;
      for (let iy = top; iy >= 0 && at(ix, iy, iz) === char; iy--) run++;
      if (run !== 3) continue; // 仅 3 层金顶；≥4 层归规则 2.5 尖顶
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

  // 围栏构件几何（低层开阔屋顶边缘：立柱 + 通长横杆）
  const fencePostGeometry = new THREE.BoxGeometry(0.09, 0.5, 0.09);
  const fenceRailXGeometry = new THREE.BoxGeometry(cs + 0.06, 0.07, 0.07); // 横杆沿 x
  const fenceRailZGeometry = new THREE.BoxGeometry(0.07, 0.07, cs + 0.06); // 横杆沿 z

  // ---------- 建筑构件统一几何（Townscaper 立面层次）----------
  // 深色盘 trim：檐口线 / 墙裙 / 窗台窗楣 / 阳台栏杆 / 屋脊瓦 / 山墙圆窗 / 风向标
  const trimMat = materials.trim ?? materials.ink;
  // 楼板檐口线：外露面层顶压条（宽跨格、突出 0.08）
  const corniceGeometry = new THREE.BoxGeometry(cs + 0.16, 0.16, 0.09);
  // 底层墙裙：外露面底部基座条
  const plinthGeometry = new THREE.BoxGeometry(cs + 0.16, 0.46, 0.09);
  // 窗台（下托）/ 窗楣（上压）
  const sillGeometry = new THREE.BoxGeometry(0.92, 0.09, 0.16);
  const lintelGeometry = new THREE.BoxGeometry(1.06, 0.1, 0.12);
  // 转角壁柱：竖向细柱
  const pilasterGeometry = new THREE.BoxGeometry(0.3, ch * 0.96, 0.3);
  // 阳台：悬挑板 + 铁艺栏杆（3 根竖条 + 扶手横杆）
  const balconySlabGeometry = new THREE.BoxGeometry(0.96, 0.08, 0.5);
  const balconyRailPostGeometry = new THREE.BoxGeometry(0.05, 0.42, 0.05);
  const balconyRailBarGeometry = new THREE.BoxGeometry(0.96, 0.045, 0.05);
  // 连拱柱廊细柱
  const arcadeColumnGeometry = new THREE.CylinderGeometry(0.13, 0.17, ch, 6);
  // 屋脊瓦 / 挑檐压条
  const ridgeGeometry = new THREE.BoxGeometry(cs * 0.92, 0.12, 0.18);
  const eaveGeometry = new THREE.BoxGeometry(cs, 0.09, 0.24);
  // 山墙圆窗（口沿 + 十字格）
  const oculusGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10);
  const oculusCrossGeometry = new THREE.BoxGeometry(0.34, 0.06, 0.08);
  // 风向标：细杆 + 箭头尾翼（教堂尖塔顶饰；旗杆不做——用户偏好）
  const vanePostGeometry = new THREE.BoxGeometry(0.03, 0.5, 0.03);
  const vaneTailGeometry = new THREE.BoxGeometry(0.26, 0.05, 0.04);

  // ---------- 规则 2.5：屋顶形状分类（Townscaper 全模拟）----------
  // 1×1 孤立 → 四坡尖顶（高柱更高）· 直线条带 → 人字坡 · L 形 → 转角教堂尖塔
  // 十字/T 形 → 中心教堂尖塔 · 2×2 方块 → 晒台+中央矮尖塔 · 大平顶 → 花园/晒台（D5）
  const roofCells = new Set();
  const roofPlazas = []; // 大平顶分量（花园/晒台判定，规则 3.5 消费）
  {
    const gableX = makeGableRoofGeometry(cs, ch); // 屋脊沿 +x
    const gableZ = gableX.clone().rotateY(Math.PI / 2); // 屋脊沿 +z
    const spireGeometry = new THREE.ConeGeometry(cs * 0.58, ch * 0.55, 4);
    spireGeometry.rotateY(Math.PI / 4); // 四坡尖顶对齐格边
    // 教堂尖塔：白石塔身 + 红瓦四棱锥 + 墨色小十字顶饰
    const steepleTowerGeometry = new THREE.BoxGeometry(cs * 0.5, ch * 0.85, cs * 0.5);
    const steepleConeGeometry = new THREE.ConeGeometry(cs * 0.4, ch * 0.95, 4);
    steepleConeGeometry.rotateY(Math.PI / 4);

    // 柱高表（孤立尖顶按柱高拉高）
    const columnHeight = new Map();
    for (const house of collectCitadelHouses(grid)) {
      columnHeight.set(`${house.ix},${house.iz}`, house.floors);
    }

    // BFS 屋顶连通分量（同层四邻、排除穹顶/塔顶格）
    const visited = new Set();
    const components = [];
    for (const key of grid.keys()) {
      if (visited.has(key)) continue;
      const [ix0, iy0, iz0] = key.split(",").map(Number);
      if (!isRoof(ix0, iy0, iz0)) continue;
      if (domeCenters.has(key) || towerTops.has(key)) continue;
      const cells = [];
      const queue = [[ix0, iz0]];
      const seen = new Set([`${ix0},${iz0}`]);
      visited.add(key);
      while (queue.length) {
        const [x, z] = queue.pop();
        cells.push([x, z]);
        for (const [dx, dz] of DIRS) {
          const nk = `${x + dx},${iy0},${z + dz}`;
          if (!grid.has(nk) || !isRoof(x + dx, iy0, z + dz)) continue;
          if (domeCenters.has(nk) || towerTops.has(nk)) continue;
          if (seen.has(`${x + dx},${z + dz}`)) continue;
          seen.add(`${x + dx},${z + dz}`);
          visited.add(nk);
          queue.push([x + dx, z + dz]);
        }
      }
      components.push({ iy: iy0, cells, keys: cells.map(([x, z]) => `${x},${iy0},${z}`) });
    }

    for (const comp of components) {
      const { iy } = comp;
      const shape = classifyRoofComponent(comp.cells);
      const cellSet = new Set(comp.keys);

      if (shape.kind === "single") {
        const [ix, iz] = comp.cells[0];
        const key = `${ix},${iy},${iz}`;
        const floors = columnHeight.get(`${ix},${iz}`) ?? 1;
        // 高细柱（≥4 层）出更高更尖的四坡尖顶；红旗装饰不做（用户偏好）
        const spire = mesh(spireGeometry, materials.roofTile, "town-spire", 0.035);
        spire.scale.set(1, 1 + Math.max(0, floors - 3) * 0.45, 1);
        spire.position.set(cx(ix), (iy + 1) * ch + ch * 0.27, cz(iz));
        levelGroups[iy].add(spire);
        stats.roofCount++;
        roofCells.add(key);
        continue;
      }

      if (shape.kind === "L" || shape.kind === "cross") {
        // 教堂尖塔落点：L 转角格 / 十字中心格
        const anchor = shape.kind === "L" ? shape.corner : shape.center;
        const towerGroup = new THREE.Group();
        towerGroup.name = "town-steeple";
        const tower = mesh(steepleTowerGeometry, materials.steepleStone ?? materials.W, "town-steeple-tower", 0.04);
        tower.position.y = ch * 0.42;
        towerGroup.add(tower);
        const cone = mesh(steepleConeGeometry, materials.roofTile, "town-steeple-cone", 0.035);
        cone.position.y = ch * 0.85 + ch * 0.48;
        towerGroup.add(cone);
        const crossBar = mesh(new THREE.BoxGeometry(0.09, 0.09, 0.55), materials.ink, "town-steeple-cross", 0.01);
        crossBar.position.y = ch * 0.85 + ch * 0.95 + 0.3;
        towerGroup.add(crossBar);
        const crossPost = mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), materials.ink, "town-steeple-cross", 0.01);
        crossPost.position.y = ch * 0.85 + ch * 0.95 + 0.44;
        towerGroup.add(crossPost);
        // 风向标：十字之上细杆 + 尾翼（Townscaper 尖塔顶饰）
        const vanePost = mesh(vanePostGeometry, trimMat, "town-steeple-vane", 0.008);
        vanePost.position.y = ch * 0.85 + ch * 0.95 + 0.68;
        towerGroup.add(vanePost);
        const vaneTail = mesh(vaneTailGeometry, trimMat, "town-steeple-vane", 0.008);
        vaneTail.position.set(0.13, ch * 0.85 + ch * 0.95 + 0.76, 0);
        towerGroup.add(vaneTail);
        const vaneTip = mesh(
          new THREE.ConeGeometry(0.05, 0.22, 4),
          trimMat,
          "town-steeple-vane",
          0.008
        );
        vaneTip.rotation.z = Math.PI / 2;
        vaneTip.position.set(0.3, ch * 0.85 + ch * 0.95 + 0.76, 0);
        towerGroup.add(vaneTip);
        towerGroup.position.set(cx(anchor[0]), (iy + 1) * ch, cz(anchor[1]));
        levelGroups[iy].add(towerGroup);
        stats.steepleCount++;
        roofCells.add(`${anchor[0]},${iy},${anchor[1]}`);

        // 臂上格子出人字坡（沿臂轴向：4 邻分量方向取主轴）
        for (const [ix, iz] of comp.cells) {
          const key = `${ix},${iy},${iz}`;
          if (key === `${anchor[0]},${iy},${anchor[1]}`) continue;
          let inX = 0;
          let inZ = 0;
          for (const [dx, dz] of DIRS) {
            if (cellSet.has(`${ix + dx},${iy},${iz + dz}`)) {
              if (dx !== 0) inX++;
              else inZ++;
            }
          }
          if (inX + inZ === 0) continue;
          const alongX = inX >= inZ;
          const roof = mesh(alongX ? gableX : gableZ, materials.roofTile, "town-roof", 0.04);
          roof.position.set(cx(ix), (iy + 1) * ch, cz(iz));
          levelGroups[iy].add(roof);
          roofCells.add(key);
          stats.roofCount++;
          // 臂上屋脊瓦
          const ridge = mesh(ridgeGeometry, trimMat, "town-roof-ridge", 0.014);
          ridge.position.set(cx(ix), (iy + 1) * ch + ch * 0.52, cz(iz));
          if (!alongX) ridge.rotation.y = Math.PI / 2;
          levelGroups[iy].add(ridge);
          stats.ridgeCount = (stats.ridgeCount ?? 0) + 1;
        }
        continue;
      }

      if (shape.kind === "strip") {
        for (const [ix, iz] of comp.cells) {
          const key = `${ix},${iy},${iz}`;
          const roof = mesh(shape.alongX ? gableX : gableZ, materials.roofTile, "town-roof", 0.04);
          roof.position.set(cx(ix), (iy + 1) * ch, cz(iz));
          levelGroups[iy].add(roof);
          roofCells.add(key);
          stats.roofCount++;
        }
        // 屋脊瓦：沿条带轴向一条深色压条（挑檐方向的两端不出）
        const alongX = shape.alongX;
        for (const [ix, iz] of comp.cells) {
          const ridge = mesh(ridgeGeometry, trimMat, "town-roof-ridge", 0.014);
          ridge.position.set(cx(ix), (iy + 1) * ch + ch * 0.52, cz(iz));
          if (!alongX) ridge.rotation.y = Math.PI / 2;
          levelGroups[iy].add(ridge);
          stats.ridgeCount = (stats.ridgeCount ?? 0) + 1;
          // 挑檐：条带两端各出一条压檐（沿轴向端头）
          const firstX = comp.cells[0][0] === ix && comp.cells[0][1] === iz;
          const lastX = comp.cells[comp.cells.length - 1][0] === ix && comp.cells[comp.cells.length - 1][1] === iz;
          if (firstX || lastX) {
            const eave = mesh(eaveGeometry, trimMat, "town-roof-eave", 0.012);
            eave.position.set(
              cx(ix) + (alongX ? (firstX ? -cs * 0.5 : cs * 0.5) : 0),
              (iy + 1) * ch + 0.06,
              cz(iz) + (!alongX ? (firstX ? -cs * 0.5 : cs * 0.5) : 0)
            );
            if (!alongX) eave.rotation.y = Math.PI / 2;
            levelGroups[iy].add(eave);
            stats.eaveCount = (stats.eaveCount ?? 0) + 1;
          }
        }
        // 山墙圆窗：条带两端山墙面各开一圆窗
        {
          const [sx0, sz0] = comp.cells[0];
          const [sx1, sz1] = comp.cells[comp.cells.length - 1];
          for (const [gx, gz] of [[sx0, sz0], [sx1, sz1]]) {
            const oculus = mesh(oculusGeometry, trimMat, "town-gable-oculus", 0.014);
            oculus.rotation.x = Math.PI / 2;
            oculus.position.set(
              cx(gx) + (alongX ? 0 : (gx === sx0 ? -cs * 0.5 - 0.04 : cs * 0.5 + 0.04)),
              (iy + 1) * ch + ch * 0.3,
              cz(gz) + (alongX ? (gz === sz0 ? -cs * 0.5 - 0.04 : cs * 0.5 + 0.04) : 0)
            );
            oculus.rotation.z = alongX ? 0 : Math.PI / 2;
            levelGroups[iy].add(oculus);
            // 十字窗棂
            const oculusCross = mesh(oculusCrossGeometry, trimMat, "town-gable-oculus", 0.008);
            oculusCross.position.copy(oculus.position);
            oculusCross.rotation.y = oculus.rotation.y;
            levelGroups[iy].add(oculusCross);
            stats.oculusCount = (stats.oculusCount ?? 0) + 1;
          }
        }
        continue;
      }

      if (shape.kind === "block2x2") {
        // 2×2 方块：平台晒台 + 中央矮尖塔（四棱锥直落屋面）
        const [minX] = [Math.min(...comp.cells.map((c) => c[0]))];
        const [minZ] = [Math.min(...comp.cells.map((c) => c[1]))];
        const center = [minX + 0.5, minZ + 0.5];
        const cone = mesh(
          new THREE.ConeGeometry(cs * 0.4, ch * 0.7, 4).rotateY(Math.PI / 4),
          materials.roofTile,
          "town-block2x2-cone",
          0.035
        );
        cone.position.set(cx(center[0]), (iy + 1) * ch + ch * 0.35, cz(center[1]));
        levelGroups[iy].add(cone);
        stats.steepleCount++;
        // 方块本身平顶：交给规则 3 边缘围栏（openSky 判定）
        continue;
      }

      // plaza：大平顶分量，留给规则 3.5 花园/晒台判定
      roofPlazas.push(comp);
    }
  }



  // ---------- 规则 3：逐格立面/屋顶构件 ----------
  // 户概念（Townscaper）：竖柱同色 = 一户，户种子决定窗密度与门面。
  const houseByColumn = new Map();
  for (const house of collectCitadelHouses(grid)) {
    houseByColumn.set(`${house.ix},${house.iz}`, house);
  }

  // ---------- 规则 3.5：花园（围合大平顶）----------
  // Townscaper 屋顶花园：大平顶分量且贴更高墙 → 铺草地 + 低栅栏 + 1~3 棵树；
  // 不贴墙的晒台保持平顶（规则 3 出城垛/围栏）。gardenCells 让规则 3 跳过城垛。
  const gardenCells = new Set();
  {
    const grassGeometry = new THREE.BoxGeometry(cs * 0.96, 0.06, cs * 0.96);
    for (const comp of roofPlazas) {
      const { iy } = comp;
      let hugsWall = false;
      for (const key of comp.keys) {
        const [x, , z] = key.split(",").map(Number);
        for (const [dx, dz] of DIRS) {
          if (at(x + dx, iy + 1, z + dz) !== ".") hugsWall = true;
        }
      }
      if (!hugsWall) continue; // 晒台：留给规则 3 的围栏/城垛
      for (const key of comp.keys) {
        const [x, , z] = key.split(",").map(Number);
        gardenCells.add(key);
        const grass = mesh(grassGeometry, materials.foliageDark, "town-garden-grass", 0.008);
        grass.position.set(cx(x), (iy + 1) * ch + 0.03, cz(z));
        levelGroups[iy].add(grass);
        // 分量外缘低栅栏（外露 + 上方开敞的边）
        for (const [dx, dz] of DIRS) {
          if (at(x + dx, iy, z + dz) !== ".") continue;
          if (at(x + dx, iy + 1, z + dz) !== ".") continue;
          const ex = cx(x) + dx * cs / 2;
          const ez = cz(z) + dz * cs / 2;
          const topY = (iy + 1) * ch;
          const rail = mesh(
            dz !== 0 ? fenceRailXGeometry : fenceRailZGeometry,
            materials.wood,
            "town-garden-fence",
            0.014
          );
          rail.position.set(ex, topY + 0.22, ez);
          levelGroups[iy].add(rail);
          stats.fenceCount++;
        }
      }
      stats.gardenCount++;
      // 树 1~3 棵：哈希选位，落在分量内部（非最外圈）
      const inner = comp.cells.filter(([x, z]) =>
        at(x + 1, iy, z) !== "." && at(x - 1, iy, z) !== "." &&
        at(x, iy, z + 1) !== "." && at(x, iy, z - 1) !== "."
      );
      const slots = inner.length ? inner : comp.cells;
      const treeCount = 1 + (comp.cells.length % 3);
      for (let i = 0; i < treeCount && i < slots.length; i++) {
        const [tx, tz] = slots[(i * 2654435761 + comp.cells.length) % slots.length];
        const green =
          stats.shrubCount % 2 === 0
            ? ctx.buildShrub(`town-shrub-${stats.shrubCount}`, 1.0, ctx.shrubMaterials, random)
            : ctx.buildTopiary(`town-shrub-${stats.shrubCount}`, 0.9, ctx.shrubMaterials, random);
        green.position.set(
          cx(tx) + (random() - 0.5) * 0.4,
          (iy + 1) * ch + 0.06,
          cz(tz) + (random() - 0.5) * 0.4
        );
        levelGroups[iy].add(green);
        stats.shrubCount++;
      }
      // 屋顶鸟：花园边缘栅栏上停 1~2 只静态小鸟（Townscaper 点缀）
      const edge = comp.cells.filter(([x, z]) =>
        at(x + 1, iy, z) === "." || at(x - 1, iy, z) === "." ||
        at(x, iy, z + 1) === "." || at(x, iy, z - 1) === "."
      );
      const birdCount = 1 + (comp.cells.length % 2);
      for (let i = 0; i < birdCount && edge.length; i++) {
        const [bx, bz] = edge[(i * 40503 + comp.cells.length) % edge.length];
        const bird = buildCitadelRoofBird(materials, cx(bx), (iy + 1) * ch + 0.5, cz(bz), random);
        levelGroups[iy].add(bird);
        stats.birdCount++;
      }
    }
  }

  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const isGate = char === CITADEL_GATE_CHAR;
    const house = houseByColumn.get(`${ix},${iz}`) ?? {
      ix, iz, seed: 0, bottom: iy, top: iy, floors: 1, hasGate: isGate,
    };

    // 暴露立面出拱窗（底层为台基不开窗；门面留给正门/户门）
    // 户窗密度：seed 决定 0.5 / 0.7 / 1.0 三档——大户疏窗、小户密窗的
    // Townscaper 式立面节奏；窗材质 windowDark（夜间切换 windowLit）。
    if (iy >= 1) {
      const winMat = materials.windowDark || materials.ink;
      const density = [0.5, 0.7, 1.0][house.seed % 3];
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) !== ".") continue;
        if (isGate && dz === 1) continue;
        // 户级随机：同一面（ix,iz,dx,dz）全层一致，避免每层窗位漂移
        const faceSeed = (house.seed ^ (dx * 131 + dz * 173) ^ (ix * 7 + iz * 11)) >>> 0;
        if ((faceSeed % 1000) / 1000 >= density) continue;
        const window = mesh(ctx.archWindowGeometry, winMat, "town-window", 0.022);
        window.position.set(
          cx(ix) + dx * (cs / 2 + 0.028),
          cy(iy) - ch * 0.08,
          cz(iz) + dz * (cs / 2 + 0.028)
        );
        window.rotation.y = Math.atan2(dx, dz);
        window.userData.citadelWindow = true;
        // 房屋单元 id 用格坐标；台地号在挂到 town-terrace-T 后由 refresh 补齐
        window.userData.cellIx = ix;
        window.userData.cellIz = iz;
        window.userData.cellIy = iy;
        levelGroups[iy].add(window);
        stats.windowCount++;
        // 窗台 / 窗楣：深色盘压条（Townscaper 立面细部）
        const wx = cx(ix) + dx * (cs / 2 + 0.06);
        const wz = cz(iz) + dz * (cs / 2 + 0.06);
        const sill = mesh(sillGeometry, trimMat, "town-window-sill", 0.01);
        sill.position.set(wx, cy(iy) - ch * 0.08 - 0.62, wz);
        sill.rotation.y = Math.atan2(dx, dz);
        levelGroups[iy].add(sill);
        const lintel = mesh(lintelGeometry, trimMat, "town-window-lintel", 0.01);
        lintel.position.set(wx, cy(iy) - ch * 0.08 + 0.92, wz);
        lintel.rotation.y = Math.atan2(dx, dz);
        levelGroups[iy].add(lintel);
      }
    }

    // 户门（Townscaper 底层门）：非正门户在底层外露立面开一扇木门，
    // 优先朝 +z 前排；每户至多一扇（正门 G 户已有门廊，跳过）。
    if (iy === house.bottom && !house.hasGate && !house.userDataDoorPlaced) {
      house.userDataDoorPlaced = true;
      const openFaces = [];
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) === ".") openFaces.push([dx, dz]);
      }
      if (openFaces.length) {
        // 朝 +z 的面优先；否则按户种子轮转
        const preferred = openFaces.find(([dx, dz]) => dz === 1);
        const [ddx, ddz] = preferred ?? openFaces[house.seed % openFaces.length];
        const doorGroup = new THREE.Group();
        doorGroup.name = "town-door";
        const recess = mesh(
          new THREE.BoxGeometry(0.95, 1.62, 0.1),
          materials.ink,
          "town-door-recess",
          0.024
        );
        recess.position.set(0, 0.81, cs / 2 + 0.02);
        doorGroup.add(recess);
        const leaf = mesh(
          new THREE.BoxGeometry(0.72, 1.5, 0.06),
          materials.wood,
          "town-door-leaf",
          0.02
        );
        leaf.position.set(0, 0.75, cs / 2 + 0.06);
        doorGroup.add(leaf);
        doorGroup.position.set(cx(ix), 0, cz(iz));
        doorGroup.rotation.y = Math.atan2(ddx, ddz);
        levelGroups[iy].add(doorGroup);
        stats.doorCount = (stats.doorCount ?? 0) + 1;
      }
    }

    // ---------- 规则 3.6：立面层次（Townscaper 建筑构架）----------
    // 楼板檐口线：每层外露立面层顶压深色条（含悬空/顶层），营造楼层分割。
    // 底层墙裙：iy=0 外露面底部基座条。转角壁柱：两相邻面开敞的角格出竖柱。
    // 阳台：外露面 + 上方有窗/户种子 30%，出悬挑板 + 铁艺栏杆。
    {
      const trimMatLoc = trimMat;
      const charMat = materials[char] ?? materials.W;
      // 每个外露方向
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) !== ".") continue; // 内面不出构件
        const ex = cx(ix) + dx * (cs / 2 + 0.055);
        const ez = cz(iz) + dz * (cs / 2 + 0.055);
        const yaw = Math.atan2(dx, dz);
        // 檐口线（顶层 + 中间层，贴墙檐高）
        if (iy >= 1 || isRoof(ix, iy, iz)) {
          const cornice = mesh(corniceGeometry, trimMatLoc, "town-cornice", 0.014);
          cornice.position.set(ex, (iy + 1) * ch - 0.09, ez);
          cornice.rotation.y = yaw;
          levelGroups[iy].add(cornice);
          stats.corniceCount = (stats.corniceCount ?? 0) + 1;
        }
        // 底层墙裙
        if (iy === 0) {
          const plinth = mesh(plinthGeometry, trimMatLoc, "town-plinth", 0.016);
          plinth.position.set(ex, 0.24, ez);
          plinth.rotation.y = yaw;
          levelGroups[0].add(plinth);
          stats.plinthCount = (stats.plinthCount ?? 0) + 1;
        }
        // 阳台：外露面 + 上方开空（外墙）+ 户种子 30%
        const balconySeed = (house.seed ^ (dx * 911 + dz * 313)) >>> 0;
        const wantsBalcony = (balconySeed % 100) < 30;
        const aboveOpen = at(ix + dx, iy + 1, iz + dz) === ".";
        if (iy >= 1 && aboveOpen && wantsBalcony) {
          const slab = mesh(balconySlabGeometry, charMat, "town-balcony", 0.014);
          slab.position.set(
            cx(ix) + dx * (cs / 2 + 0.26),
            iy * ch + 0.42,
            cz(iz) + dz * (cs / 2 + 0.26)
          );
          slab.rotation.y = yaw;
          levelGroups[iy].add(slab);
          for (const off of [-0.34, 0, 0.34]) {
            const post = mesh(balconyRailPostGeometry, trimMatLoc, "town-balcony-rail", 0.01);
            post.position.set(
              cx(ix) + dx * (cs / 2 + 0.26) + (dz !== 0 ? off : 0),
              iy * ch + 0.42 + 0.25,
              cz(iz) + dz * (cs / 2 + 0.26) + (dx !== 0 ? off : 0)
            );
            levelGroups[iy].add(post);
          }
          const bar = mesh(balconyRailBarGeometry, trimMatLoc, "town-balcony-rail", 0.01);
          bar.position.set(
            cx(ix) + dx * (cs / 2 + 0.26),
            iy * ch + 0.42 + 0.46,
            cz(iz) + dz * (cs / 2 + 0.26)
          );
          bar.rotation.y = yaw;
          levelGroups[iy].add(bar);
          stats.balconyCount = (stats.balconyCount ?? 0) + 1;
        }
      }
      // 转角壁柱：两相邻方向同时开敞（角格）
      const openDirs = [];
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) === ".") openDirs.push([dx, dz]);
      }
      if (openDirs.length >= 2) {
        for (let a = 0; a < openDirs.length; a++) {
          for (let b = a + 1; b < openDirs.length; b++) {
            const [ax, az] = openDirs[a];
            const [bx, bz] = openDirs[b];
            if (ax === bx || az === bz) continue; // 对角不算角
            const px = cx(ix) + (ax + bx) * (cs / 2 + 0.02) * 0.5;
            const pz = cz(iz) + (az + bz) * (cs / 2 + 0.02) * 0.5;
            const pilaster = mesh(pilasterGeometry, trimMatLoc, "town-pilaster", 0.016);
            pilaster.position.set(px, iy * ch + ch * 0.5, pz);
            pilaster.rotation.y = Math.atan2(ax + bx, az + bz);
            levelGroups[iy].add(pilaster);
            stats.pilasterCount = (stats.pilasterCount ?? 0) + 1;
          }
        }
      }
    }

    // 屋顶格：边缘出城垛（高处/贴墙）或围栏（低层开阔平台）；花园格已自出低栅栏
    if (isRoof(ix, iy, iz)) {
      const skipTrim = domeCenters.has(key) || towerTops.has(key) || roofCells.has(key) || gardenCells.has(key);
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
        // 屋顶花园判定移至规则 3.5（roofPlazas 分量整体判定，替代旧随机 32% 绿化）
      }
    }

    // 悬空格出拱：下方为空且某轴向两侧有支撑
    // （连拱柱廊由规则 3.7 统一处理，含连续悬空段的拱 + 中间细柱）
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

  // ---------- 规则 3.7：连拱柱廊（Townscaper 底层开敞廊）----------
  // 悬空段（下方全空、同层连续、两端有支撑）长度 ≥2：每格出拱，
  // 段内每两格出细柱，形成连续拱廊。单格悬空仍由规则 3 的单拱处理。
  {
    const archGeoX = new THREE.CylinderGeometry(cs * 0.48, cs * 0.48, cs * 0.96, 12, 1, false, 0, Math.PI);
    archGeoX.rotateZ(Math.PI / 2);
    archGeoX.rotateX(-Math.PI / 2);
    const archGeoZ = archGeoX.clone().rotateY(Math.PI / 2);
    const visitedArcade = new Set();
    for (const key of grid.keys()) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (iy === 0 || at(ix, iy - 1, iz) !== ".") continue; // 需悬空
      if (visitedArcade.has(key)) continue;
      const arcChar = grid.get(key);
      // 沿 +x 扫描连续悬空段
      let runX = 1;
      while (at(ix + runX, iy, iz) !== "." && at(ix + runX, iy - 1, iz) === ".") runX++;
      const supportXLeft = at(ix - 1, iy, iz) !== ".";
      const supportXRight = at(ix + runX, iy, iz) !== ".";
      if (runX >= 2 && supportXLeft && supportXRight) {
        for (let r = 0; r < runX; r++) {
          visitedArcade.add(`${ix + r},${iy},${iz}`);
          const arch = mesh(archGeoX, materials[arcChar] ?? materials.W, "town-arch", 0.035);
          arch.position.set(cx(ix + r), iy * ch + 0.02, cz(iz));
          levelGroups[iy - 1].add(arch);
          stats.archCount++;
          if (r % 2 === 1) {
            const column = mesh(arcadeColumnGeometry, trimMat, "town-arcade-column", 0.02);
            column.position.set(cx(ix + r), iy * ch - ch * 0.5, cz(iz));
            levelGroups[iy - 1].add(column);
            stats.arcadeColumnCount = (stats.arcadeColumnCount ?? 0) + 1;
          }
        }
        continue;
      }
      // 沿 +z 扫描
      let runZ = 1;
      while (at(ix, iy, iz + runZ) !== "." && at(ix, iy - 1, iz + runZ) === ".") runZ++;
      const supportZDown = at(ix, iy, iz - 1) !== ".";
      const supportZUp = at(ix, iy, iz + runZ) !== ".";
      if (runZ >= 2 && supportZDown && supportZUp) {
        for (let r = 0; r < runZ; r++) {
          visitedArcade.add(`${ix},${iy},${iz + r}`);
          const arch = mesh(archGeoZ, materials[arcChar] ?? materials.W, "town-arch", 0.035);
          arch.position.set(cx(ix), iy * ch + 0.02, cz(iz + r));
          levelGroups[iy - 1].add(arch);
          stats.archCount++;
          if (r % 2 === 1) {
            const column = mesh(arcadeColumnGeometry, trimMat, "town-arcade-column", 0.02);
            column.position.set(cx(ix), iy * ch - ch * 0.5, cz(iz + r));
            levelGroups[iy - 1].add(column);
            stats.arcadeColumnCount = (stats.arcadeColumnCount ?? 0) + 1;
          }
        }
      }
    }
  }

  // ---------- 规则 4：水道 —— 底层被建筑夹出、且与格外相通的空格成水道 ----------
  // 判定：iy=0 空格，x 向或 z 向两侧皆为实心格（夹道），且经底层空格
  // 洪水填充可达包围盒边界（与外部水面相通）。水道格铺水面；夹道的
  // 建筑立面在底层出拱形水门（水道口）。
  // reached 提升到块外：规则 4.5（广场）与 4.6（水面点缀）复用。
  const waterReached = new Set();
  {
    const empty0 = (x, z) => at(x, 0, z) === ".";
    const reached = waterReached;
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

  // ---------- 规则 4.5：广场 —— 底层被建筑围合的空格成石板广场 ----------
  // Townscaper：空地被房屋四面（或 ≥3 面）围出即自动成石板铺装；
  // 与水道互斥（水道格已连通边界水面，reached 集合排除）。
  {
    const plazaGeometry = new THREE.BoxGeometry(cs * 0.97, 0.08, cs * 0.97);
    const seamGeometry = new THREE.BoxGeometry(cs * 0.97, 0.085, 0.045);
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        if (at(ix, 0, iz) !== ".") continue;
        if (waterReached.has(`${ix},${iz}`)) continue; // 水道格
        let solidNei = 0;
        for (const [dx, dz] of DIRS) {
          if (at(ix + dx, 0, iz + dz) !== ".") solidNei++;
        }
        if (solidNei < 3) continue; // 至少三面围合
        const plaza = mesh(plazaGeometry, materials.plazaStone ?? materials.W, "town-plaza", 0.018);
        plaza.position.set(cx(ix), 0.05, cz(iz));
        levelGroups[0].add(plaza);
        // 石板拼缝：两条交叉细缝
        const seamX = mesh(seamGeometry, materials.ink, "town-plaza-seam", 0.008);
        seamX.position.set(cx(ix), 0.05, cz(iz) + cs * 0.24);
        levelGroups[0].add(seamX);
        const seamZ = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.085, cs * 0.97),
          seamX.material
        );
        seamZ.name = "town-plaza-seam";
        seamZ.position.set(cx(ix) + cs * 0.24, 0.05, cz(iz));
        levelGroups[0].add(seamZ);
        stats.plazaCount++;
      }
    }
  }

  // ---------- 规则 4.6：水面点缀 —— 小船 / 灯笼（Townscaper 水道细节） ----------
  {
    const waterKeys = [];
    for (const [key, value] of grid) {
      void value;
      const [ix, iy, iz] = key.split(",").map(Number);
      if (iy === 0 && at(ix, 0, iz) === "." && waterReached.has(`${ix},${iz}`)) {
        waterKeys.push([ix, iz]);
      }
    }
    const boatGeometry = new THREE.BoxGeometry(0.72, 0.22, 0.3);
    const sailGeometry = new THREE.BoxGeometry(0.02, 0.5, 0.22);
    for (const [ix, iz] of waterKeys) {
      const seed = (ix * 997 + iz * 811) >>> 0;
      const roll = seed % 100;
      if (roll < 18) {
        // 小船：木船体 + 白帆
        const boatGroup = new THREE.Group();
        boatGroup.name = "town-boat";
        const hull = mesh(boatGeometry, materials.wood, "town-boat-hull", 0.014);
        hull.position.y = 0.13;
        boatGroup.add(hull);
        const sail = mesh(sailGeometry, materials.W, "town-boat-sail", 0.008);
        sail.position.y = 0.5;
        boatGroup.add(sail);
        boatGroup.position.set(cx(ix), 0.38, cz(iz));
        boatGroup.rotation.y = ((seed >> 3) % 4) * (Math.PI / 2);
        levelGroups[0].add(boatGroup);
        stats.boatCount++;
      } else if (roll < 30) {
        // 灯笼：水面小光点（暖黄无光材质）
        const lantern = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.3, 0.22),
          new THREE.MeshBasicMaterial({ color: 0xffc878 })
        );
        lantern.name = "town-lantern";
        lantern.position.set(cx(ix), 0.5, cz(iz));
        levelGroups[0].add(lantern);
        stats.boatCount++;
      }
    }
  }

  // ---------- 规则 5：悬空支撑支架（Townscaper flying buildings）----------
  // 右键删除中间层后，上层建筑不塌陷、悬浮在空中的块自动长出支撑支架：
  // 从下方承重面（下一非空块的顶面 / 基座顶）到悬空块底面的细木柱 + 四角斜撑。
  // 与规则 1（拱）互补：悬空但有侧向支撑 → 拱；完全悬空 → 支架。
  {
    const pillarGeo = new THREE.BoxGeometry(0.16, 1, 0.16); // 支架细柱（单位高，按需拉长）
    const strutGeo = new THREE.BoxGeometry(0.07, 0.07, 1); // 斜撑（单位长，按需旋转/拉长）
    const supportMat = materials.trim ?? materials.wood ?? materials.ink;
    let supportCount = 0;
    for (const [key, char] of grid) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (iy === 0) continue; // 底层贴台地，无需支架
      if (at(ix, iy - 1, iz) !== ".") continue; // 下方有块，无需支架
      // 向下找承重面：下一个非空块的顶面（iy2+1）或基座顶（0）
      let supportTop = 0;
      for (let iy2 = iy - 1; iy2 >= 0; iy2--) {
        if (at(ix, iy2, iz) !== ".") {
          supportTop = iy2 + 1;
          break;
        }
      }
      const pillarH = iy - supportTop; // 悬空高度（层数）
      if (pillarH <= 0) continue;
      // 中央细柱：从承重面顶升到悬空块底
      const pillar = mesh(pillarGeo, supportMat, "town-support-pillar", 0.01);
      pillar.scale.y = pillarH;
      pillar.position.set(cx(ix), supportTop * ch + pillarH * ch * 0.5, cz(iz));
      levelGroups[iy].add(pillar);
      supportCount++;
      // 四角斜撑（桌腿式）：悬空块底四角 → 承重面中心，只在大悬空（≥2 层）时加
      if (pillarH >= 2) {
        for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const top = new THREE.Vector3(
            cx(ix) + sx * ch * 0.45,
            iy * ch,
            cz(iz) + sz * ch * 0.45
          );
          const bot = new THREE.Vector3(cx(ix), supportTop * ch, cz(iz));
          const dir = top.clone().sub(bot);
          const len = dir.length();
          dir.normalize();
          const strut = mesh(strutGeo, supportMat, "town-support-strut", 0.008);
          strut.scale.z = len;
          strut.position.copy(bot.clone().addScaledVector(dir, len * 0.5));
          strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
          levelGroups[iy].add(strut);
          supportCount++;
        }
      }
    }
    if (supportCount > 0) stats.supportCount = supportCount;
  }

  stats.gridSize = { cols, rows, levels: levels.length };
  return { levels: levelGroups, stats };
}
