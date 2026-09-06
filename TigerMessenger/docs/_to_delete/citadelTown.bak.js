// ============================================================================
//  @legacy Citadel Town — Townscaper 网格装配（禁止追加新玩法）
//  V4 真源：src/world/citadel/moduleResolver.js · incrementalBuilder.js
//  本文件暂留：V4 尚未输出等价 Three 网格。见 docs/citadel-v4-legacy.md
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
export { isCitadelTownV4 } from "../core/params.js";
export {
  TOWNSCAPER_MODULE_VARIANTS,
  TOWNSCAPER_MODULE_FAMILIES,
} from "./citadel/moduleFamilies.js";
import {
  TOWNSCAPER_MODULE_VARIANTS,
  TOWNSCAPER_MODULE_FAMILIES,
} from "./citadel/moduleFamilies.js";
import { isDecorTree, stripDecorMeshes, decorateTown } from "./citadel/decoratePass.js";
import { P } from "../core/params.js";
import {
  resolveTownSelection,
  makeTownRoleOracle,
  partitionRoofComponent,
  townGridSignature,
} from "./citadel/wfcTownWiring.js";
import { resolveIncremental } from "./citadel/wfcIncremental.js";
import { assembleCornerBody } from "./citadel/cornerAssembly.js";
import { cellCageCorners, cageMapUnit } from "./citadel/cageDeform.js";
import { citadelColumnCenter } from "./citadel/gridMigration.js";

/** 编辑器（citadelEditorPanel / townscaper.html）与主场景共用的布局存档键。 */
// v3：在五彩户/坡屋顶/飞楼支架基础上加入沿台地生长的密集街区，
// 绕开旧版稀疏布局存档；v2 仍留在 localStorage 中，可回退读取。
// v5：参考高山圣城设计图重做 12 层湖岸坡城种子。使用新键隔离 v4 的
// 运河示例种子，确保现有浏览器也能看到新构图；两版都保持逐格可编辑。
export const CITADEL_LEVELS_KEY = "tm.citadel.levels.highland-townscaper.v5";

/**
 * 城堡实例化：存档键按实例隔离。
 * 默认实例（高山圣城）用兼容旧档的 CITADEL_LEVELS_KEY；
 * 其他实例（如运河交汇古堡）用带 id 后缀的键，互不覆盖。
 */
export function citadelLevelsKey(instanceId = null) {
  // v4：水面地基就绪后重新落入 Townscaper 种子岛（彩色竖户 / 飞楼 / 贴水）
  if (instanceId === "canal-junction") return "tm.citadel.levels.canal-junction.v4";
  return instanceId ? `tm.citadel.levels.${instanceId}.v1` : CITADEL_LEVELS_KEY;
}

export const CITADEL_TERRACE_COUNT = 5;
export const CITADEL_CASTLE_FLOORS = 5;
export const CITADEL_GRID_SIZE = 25;

/**
 * Townscaper 资源拆解的运行时对应物。
 *
 * 原作把“2450 种 module”表现成网格邻接后的组合结果，而不是 2450
 * 个互不相干的静态模型。这里保留同样的思路：把可复用的部件拆成八个
 * 家族，再由格坐标、楼层、户色和开敞方向确定性选型。这样既能稳定复现
 * 同一座城，又能让一座城里出现足够多的楼层、地基、围栏、阳台、楼梯、
 * 支架、开洞和装饰组合，而不会为每种组合复制一套几何资产。
 */
/** 组合索引只依赖布局，不依赖随机数，因此编辑器和运行时完全一致。 */
export function townscaperModuleSelection(ix, iy, iz, char = "", salt = 0, openMask = 0) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2246822519
    + char.charCodeAt(0) * 3266489917 + salt * 1597334677
    + openMask * 2971215073) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h ^= h >>> 13;
  const pick = (family) => h % TOWNSCAPER_MODULE_FAMILIES[family].length;
  return {
    foundation: pick("foundation"),
    floor: pick("floor"),
    fence: pick("fence"),
    balcony: pick("balcony"),
    stairs: pick("stairs"),
    support: pick("support"),
    hole: pick("hole"),
    decor: pick("decor"),
  };
}

// ============================================================================
//  Townscaper 15 色调色板 + 字符集 + 旧档迁移
//  char 集：`.` 空 · `0-9A-E` 十五色 · `G` 正门（特殊语义，不占调色板）
// ============================================================================

/**
 * Townscaper 同名 15 色（适配水墨 toon 明度）。
 * 索引 0–14 ↔ 字符 "0"–"9" 与 "A"–"E"。
 */
export const CITADEL_PALETTE = Object.freeze([
  Object.freeze({ name: "瓷白", char: "0", color: 0xf2f4f4 }),
  Object.freeze({ name: "浅灰蓝", char: "1", color: 0xd5dbdb }),
  Object.freeze({ name: "瓷白", char: "2", color: 0xf2f4f4 }),
  Object.freeze({ name: "鹅黄", char: "3", color: 0xfcf3cf }),
  Object.freeze({ name: "鹅黄", char: "4", color: 0xfcf3cf }),
  Object.freeze({ name: "薄荷", char: "5", color: 0xe8f8f5 }),
  Object.freeze({ name: "薄荷", char: "6", color: 0xe8f8f5 }),
  Object.freeze({ name: "浅灰蓝", char: "7", color: 0xd5dbdb }),
  Object.freeze({ name: "浅灰蓝", char: "8", color: 0xd5dbdb }),
  Object.freeze({ name: "浅灰蓝", char: "9", color: 0xd5dbdb }),
  Object.freeze({ name: "瓷白", char: "A", color: 0xf2f4f4 }),
  Object.freeze({ name: "浅灰蓝", char: "B", color: 0xd5dbdb }),
  Object.freeze({ name: "薄荷", char: "C", color: 0xe8f8f5 }),
  Object.freeze({ name: "薄荷", char: "D", color: 0xe8f8f5 }),
  Object.freeze({ name: "薄荷", char: "E", color: 0xe8f8f5 }),
]);

/** 正门字符（门廊语义，非调色板色；无菌灰蓝，去掉木褐）。 */
export const CITADEL_GATE_CHAR = "G";
export const CITADEL_GATE_COLOR = 0xd5dbdb;

/**
 * 运河古堡 15 色（仅运河交汇古堡实例；高山圣城仍用 CITADEL_PALETTE）。
 * 字符集与 CITADEL_PALETTE 一一对应，布局 ASCII 无需改动即可整体换色。
 * 全部改为马卡龙色调：朱红/明黄/钴蓝等高饱和原色拉高明度、降饱和，
 * 黄昏光线下仍能看清色相（杏粉/沙石等浅色也给出可分辨的色偏）。
 */
export const TOWNSCAPER_CANAL_PALETTE = Object.freeze([
  Object.freeze({ name: "奶油白", char: "0", color: 0xf6efe3 }),
  Object.freeze({ name: "沙石", char: "1", color: 0xe8d8bc }),
  Object.freeze({ name: "杏粉", char: "2", color: 0xf5cdbd }),
  Object.freeze({ name: "明黄", char: "3", color: 0xf6de8c }),
  Object.freeze({ name: "蜜橙", char: "4", color: 0xf2b67f }),
  Object.freeze({ name: "朱红", char: "5", color: 0xee9a93 }),
  Object.freeze({ name: "绛红", char: "6", color: 0xce8e97 }),
  Object.freeze({ name: "紫罗兰", char: "7", color: 0xc4a3d8 }),
  Object.freeze({ name: "堇青", char: "8", color: 0xb3a6db }),
  Object.freeze({ name: "天青", char: "9", color: 0x93c6ec }),
  Object.freeze({ name: "湖蓝", char: "A", color: 0x97d2e4 }),
  Object.freeze({ name: "草绿", char: "B", color: 0x93cf95 }),
  Object.freeze({ name: "青碧", char: "C", color: 0x86c9be }),
  Object.freeze({ name: "赭红", char: "D", color: 0xde9d85 }),
  Object.freeze({ name: "钴蓝", char: "E", color: 0x8fa9e4 }),
]);

/** 运河古堡正门墙体色（奶油白，与 0 户同色系）。 */
export const TOWNSCAPER_CANAL_GATE_COLOR = 0xf6efe3;

/**
 * 高山圣城 15 个可编辑户色槽 —— Townscaper 配色（主人指定，2026-09-05）。
 *
 * **这一版推翻了上一版「全部收敛到方尖碑冷白石材」的决定。** 上一版把 15 个槽位
 * 全压到 max−min ≤ 42 的冷灰蓝里，`tools/test_odyssey_citadel.mjs` 还加了一条断言
 * 专门拦住「恢复彩色墙体」。主人 2026-09-05 明确要 Townscaper 那种配色，
 * 所以断言按 PLAN §5.1 的第二种改法更新（设计变更 → 改测试并写明理由），
 * 不是为了让测试转绿而放宽。
 *
 * 取色口径：Townscaper 的 16 色藏在游戏的 `TownPalette.png` 里，官方没公布十六进制
 * （Steam 官方指南只说明怎么改那张图），所以**不抄不可靠的网上数值**。这里沿用
 * 本仓库已被验证过的同族口径——`TOWNSCAPER_CANAL_PALETTE` 的「马卡龙色调」明度/
 * 彩度区间，把编辑面板里那套过饱和糖果色（#32CBB2 一类）按同一柔和度重做：
 * **色相保留、彩度下调、明度抬高**。于是名字不用改（松石绿仍是青绿），
 * 主人点哪个色就建出哪个色。
 *
 * ⚠️ 面板色块**不要再抄一份十六进制**。`citadelEditorPanel.js` 现在直接从本表派生，
 * 这正是历史上漂过两次的根因（第一次注释写着「修复选薄荷建成色差」，
 * 第二次就是这次的「选松石绿建成风化白石」）。
 */
export const TOWNSCAPER_HIGHLAND_PALETTE = Object.freeze([
  Object.freeze({ name: "奶油白", char: "0", color: 0xf6efe0 }),
  Object.freeze({ name: "暖砂石", char: "1", color: 0xe8cfa0 }),
  Object.freeze({ name: "杏粉", char: "2", color: 0xefb3a6 }),
  Object.freeze({ name: "奶油黄", char: "3", color: 0xf0dc8a }),
  Object.freeze({ name: "蜜橙", char: "4", color: 0xe9ae70 }),
  Object.freeze({ name: "珊瑚红", char: "5", color: 0xe28a90 }),
  Object.freeze({ name: "覆盆子", char: "6", color: 0xc9819b }),
  Object.freeze({ name: "薄荷绿", char: "7", color: 0x8fcfa8 }),
  Object.freeze({ name: "翡翠绿", char: "8", color: 0x7cbe8c }),
  Object.freeze({ name: "天青", char: "9", color: 0x92bee0 }),
  Object.freeze({ name: "湖蓝", char: "A", color: 0x7fa9d6 }),
  Object.freeze({ name: "鲜草绿", char: "B", color: 0xa3ce86 }),
  Object.freeze({ name: "松石绿", char: "C", color: 0x82c7bc }),
  Object.freeze({ name: "灰紫", char: "D", color: 0xb79bcb }),
  Object.freeze({ name: "钴蓝", char: "E", color: 0x94a2ce }),
]);

/** 高山圣城正门墙体色（奶油白，与 0 户同色系）。 */
export const TOWNSCAPER_HIGHLAND_GATE_COLOR = 0xeee9d8;

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
//  建筑簇划分（V3 配色 C2）：同字符 4 连通洪泛成簇，簇内统一户色，
//  只在簇边界换色；簇 id = 簇内字典序最小格坐标，天然稳定。
// ============================================================================

/**
 * @param {Map<string, string>} grid  "ix,iy,iz" → char（buildCitadelTown 栅格）
 * @returns {{ baseChar: Map<string, string>, clusterOf: Map<string, string> }}
 *   baseChar: "ix,iz" → 该列最低占用层字符（竖柱同色 = 一户的基底）
 *   clusterOf: "ix,iz" → 簇 id "c<ix>,<iz>"
 */
export function computeTownClusters(grid) {
  // G30 增量性能：列坐标走整数 key（ix*32+iz，网格 ≤ 25×25 不越界），
  // 每 edit 全量 BFS 不再做字符串拼接；cluster id 仍为 "c<ix>,<iz>" 字符串。
  const baseChar = new Map();
  // 取每列最低占用层字符作为户色基底（竖柱同色 = 一户）
  const baseLevel = new Map();
  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const col = ix * 32 + iz;
    const lv = baseLevel.get(col);
    if (lv === undefined || iy < lv) {
      baseLevel.set(col, iy);
      baseChar.set(col, char);
    }
  }
  const clusterOf = new Map();
  for (const [col] of baseChar) {
    if (clusterOf.has(col)) continue;
    const char = baseChar.get(col);
    // BFS 洪泛同字符 4 连通
    const queue = [col];
    const members = [];
    clusterOf.set(col, col); // 暂置，最后统一改写为最小 id
    while (queue.length) {
      const cur = queue.pop();
      members.push(cur);
      const cx0 = Math.floor(cur / 32);
      const cz0 = cur % 32;
      for (const [dx, dz] of DIRS) {
        const nb = (cx0 + dx) * 32 + (cz0 + dz);
        if (baseChar.get(nb) === char && !clusterOf.has(nb)) {
          clusterOf.set(nb, nb);
          queue.push(nb);
        }
      }
    }
    members.sort((a, b) => a - b);
    const id = `c${Math.floor(members[0] / 32)},${members[0] % 32}`;
    for (const m of members) clusterOf.set(m, id);
  }
  return { baseChar, clusterOf };
}

/**
 * 单格朝向（V3 路线导向明度，PLAN 7.4.3 的近似）：
 * 4 邻接正门 G → "route"（提亮）；四邻同字符（簇核内部）→ "back"（压暗）；
 * 其余 → "normal"。
 */
export function townCellFacing(baseChar, ix, iz) {
  const char = baseChar.get(ix * 32 + iz);
  if (char === undefined) return "normal";
  let sameCount = 0;
  for (const [dx, dz] of DIRS) {
    const nb = baseChar.get((ix + dx) * 32 + (iz + dz));
    if (nb === "G") return "route";
    if (nb === char) sameCount++;
  }
  return sameCount === 4 ? "back" : "normal";
}

// ============================================================================
//  扭曲网格（Townscaper 大尺寸扭曲网格的几何层模拟）
//  逻辑网格保持规则（拾取/存档/裁剪全部不变），只在几何层给每个格子的
//  四个角点做确定性扰动——相邻格共享角点，建筑体块互相贴合不裂开，
//  产生原版「手工搭积木」的有机歪斜感。
// ============================================================================

/** 扭曲网格开关：false = 严格正交（对比验收/兼容旧截图） */
export const CITADEL_DISTORTION_ENABLED = true;
/** 角点扰动幅度（约 cellSize 的 4%），上层再略歪，对齐原版积木感 */
const JITTER_AMT = 0.056;
const JITTER_FLOOR_GROWTH = 0.02;

/**
 * 网格顶点 (gx, gz) 的确定性扰动偏移（局部坐标，单位格尺寸）。
 * 相邻格共享同一角点 → 体块不裂开；结果只依赖 (gx, gz, floor)，可缓存。
 *
 * floor 只缩放幅度、不进哈希：方向一旦逐层重新随机，竖着叠的格就共享不到
 * 竖棱，每层错一点（实测最大 0.06，格宽 2.0 的 3%），看上去就像整层扭了一下。
 * 同方向 + 幅度逐层微增 = “上层再略歪”的手搭积木感。
 * @returns {{ dx: number, dz: number }}
 */
export function citadelGridVertexJitter(gx, gz, floor = 0) {
  if (!CITADEL_DISTORTION_ENABLED) return { dx: 0, dz: 0 };
  const h = (gx * 1103515245 + gz * 12345) >>> 0;
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
/**
 * Townscaper 式立面渐变：顶亮底暗（天空漫反射），写进 vertex color。
 */
export function applyVerticalVertexColors(geo, top = 1.2, bot = 0.7) {  const pos = geo.attributes.position;
  if (!pos) return geo;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-5, maxY - minY);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    const e = t * t * (3 - 2 * t);
    const k = bot + (top - bot) * e;
    col[i * 3] = k;
    col[i * 3 + 1] = k;
    col[i * 3 + 2] = k;
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/**
 * Townscaper 原版墙面质感（运河交汇古堡 colorful 模式）：
 * 在「顶亮底暗」立面渐变之上，再按面片抹一层确定性明度色块——
 * 同一面墙保留轻微的 0.96~1.04 明度漂移；更细的错缝砖块由程序化墙砖
 * 纹理负责。这里只做柔和天空渐变，避免早期 0.85~1.12 的强渐变洗掉户色。
 * 只写 vertex color，
 * 材质需 vertexColors=true（墙面 shade 材质保证）。
 */
export function applyPatchyWallColors(geo, ix = 0, iz = 0, iy = 0) {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-5, maxY - minY);
  const col = new Float32Array(pos.count * 3);
  // 面片分组：外露面几何每 6 顶点一 quad；BoxGeometry 回退每 4 顶点一面
  const groupSize = pos.count % 6 === 0 ? 6 : 4;
  for (let g = 0; g + groupSize <= pos.count; g += groupSize) {
    const faceIndex = g / groupSize;
    const h = (ix * 374761393 + iz * 668265263 + iy * 2246822519 + faceIndex * 3266489917) >>> 0;
    const tint = 0.96 + ((h % 1000) / 1000) * 0.08;
    for (let i = g; i < g + groupSize; i++) {
      const t = (pos.getY(i) - minY) / span;
      const e = t * t * (3 - 2 * t);
      const k = (0.94 + (1.06 - 0.94) * e) * tint;
      col[i * 3] = k;
      col[i * 3 + 1] = k;
      col[i * 3 + 2] = k;
    }
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

function pushTownQuad(pos, nrm, uv, a, b, c, d, n) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  pos.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  for (let i = 0; i < 6; i++) nrm.push(n[0], n[1], n[2]);
  // 每个单元格外墙固定铺两列×四行错缝砖；纹理自身首尾可拼接，
  // 相邻单元格与上下楼层会在灰缝处自然衔接。
  uv.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
}

/**
 * 只生成朝空邻的外露面。相邻实心格共享面不画 → 体块融合成一整坨，
 * 不再是描边方盒堆（Townscaper 邻接协调的几何层）。
 */
export function makeExposedCellGeometry(cs, ch, expose, ix, iz, floor = 0, cage = null) {
  const hx = cs * 0.5;
  const hy = ch * 0.5;
  const hz = cs * 0.5;
  const j00 = citadelGridVertexJitter(ix, iz, floor);
  const j10 = citadelGridVertexJitter(ix + 1, iz, floor);
  const j01 = citadelGridVertexJitter(ix, iz + 1, floor);
  const j11 = citadelGridVertexJitter(ix + 1, iz + 1, floor);
  const corner = cage
    ? (sx, sy, sz) => {
        const u = (sx + 1) * 0.5;
        const v = (sz + 1) * 0.5;
        const y = (sy + 1) * 0.5;
        const p = cageMapUnit(u, y, v, cage.corners, -hy, hy);
        return [p[0] - cage.cx, p[1], p[2] - cage.cz];
      }
    : (sx, sy, sz) => {
        const j = sx > 0 ? (sz > 0 ? j11 : j10) : (sz > 0 ? j01 : j00);
        return [sx * hx + j.dx, sy * hy, sz * hz + j.dz];
      };
  // 注意：pushTownQuad 的角点顺序必须与法线构成右手系（绕序 = 正面）。
  // 旧版顺序与法线相反——FrontSide 材质下墙面正面被剔除，看到的是屋内
  // 远侧内壁（白墙时代侥幸发白），反向壳描边（BackSide）则整个糊在墙面
  // 上（彩墙时代整面深灰蓝）。修正绕序后两者同时归位。
  const pos = [];
  const nrm = [];
  const uv = [];
  if (expose.py) {
    pushTownQuad(pos, nrm, uv, corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1), [0, 1, 0]);
  }
  if (expose.ny) {
    pushTownQuad(pos, nrm, uv, corner(-1, -1, 1), corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), [0, -1, 0]);
  }
  if (expose.px) {
    pushTownQuad(pos, nrm, uv, corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1), [1, 0, 0]);
  }
  if (expose.nx) {
    pushTownQuad(pos, nrm, uv, corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1), [-1, 0, 0]);
  }
  if (expose.pz) {
    pushTownQuad(pos, nrm, uv, corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1), corner(-1, -1, 1), [0, 0, 1]);
  }
  if (expose.nz) {
    pushTownQuad(pos, nrm, uv, corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), corner(1, -1, -1), [0, 0, -1]);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  applyVerticalVertexColors(geo, 1.22, 0.68);
  return geo;
}

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
/**
 * C13-1（S23 / PLAN §10.1）：把墙面 UV 改成**世界坐标**取模。
 *
 * 原来每个面都是 0..1 的 UV，于是砖块尺寸随面大小缩放、相邻两格的砖缝也对不上——
 * 远看就是一块块「贴了图的方盒子」。z1.png 实测 Townscaper 的砖是**连续**的：
 * 一栋楼从底到顶、跨好几格，横缝是一条直线穿过去的。
 *
 * 做法：每个顶点按它所在面的朝向取世界 X 或 Z 当 u、世界 Y 当 v，
 * 再除以「一块砖的世界尺寸」。因为用的是世界坐标，跨格自动连续，且砖尺寸恒定。
 *
 * @param {THREE.BufferGeometry} geo 已经算好 normal 的格几何（局部坐标，中心在原点）
 * @param {number} wx 该格中心的世界 X
 * @param {number} wy 该格中心的世界 Y
 * @param {number} wz 该格中心的世界 Z
 * @param {number} cs 格宽（世界单位）
 * @param {number} ch 层高（世界单位）
 * @param {number} [bricksPerCell=6] 一格宽几块砖（贴图一个 tile = 2 砖 × 4 皮）
 * @param {number} [coursesPerFloor=12] 一层几皮砖
 */
export function applyWorldBrickUv(geo, wx, wy, wz, cs, ch, bricksPerCell = 6, coursesPerFloor = 12) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) return geo;
  // 贴图一个 tile 覆盖 2 砖 × 4 皮（makeTownPatternTexture: brickW=64 / courseH=32 / size=128）
  const tileW = (cs / bricksPerCell) * 2;
  const tileH = (ch / coursesPerFloor) * 4;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const px = pos.getX(i) + wx;
    const py = pos.getY(i) + wy;
    const pz = pos.getZ(i) + wz;
    let u;
    let v;
    if (ny >= nx && ny >= nz) {
      // 顶/底面：用 XZ 平铺，避免顶面被拉成条纹
      u = px / tileW;
      v = pz / tileW;
    } else if (nx >= nz) {
      u = pz / tileW; // 朝 ±X 的面：横向走 Z
      v = py / tileH;
    } else {
      u = px / tileW; // 朝 ±Z 的面：横向走 X
      v = py / tileH;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

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

// ============================================================================
//  高山圣城 · Townscaper 种子山城（v3，确定性生成）
//  手绘 ASCII 已表达不了「五台地 × 有机屋群」：改为生成器落子——
//  顶台地主堡（奶油基座 + 珊瑚主塔穹顶 + 两翼坡屋顶 + 正门 G），
//  低四台地在环带（上一台地半径 < r ≤ 本台地半径）上散落小屋，
//  环带外的格子自动不画（防悬浮/防插进高台地墙壁）；
//  瀑布缺口扇区（前四层）与攻城梯战场（台地 5 前排）自动留空；
//  每台地至少一处「飞楼」——悬空 2 层的挑出间，规则 5 自动长黑铁支架。
//  竖柱同色 = 一户（户色见 TOWNSCAPER_HIGHLAND_PALETTE）。
// ============================================================================
const HIGHLAND_TERRACE_RADII = [15.7464, 17.496, 19.44, 21.6, 24.0]; // 同 CITADEL.contourTerrain.terraces

function makeHighlandTownTerraces() {
  const N = CITADEL_GRID_SIZE; // 25×25
  const C = (N - 1) / 2; // 中心格 12
  const F = CITADEL_CASTLE_FLOORS; // 每台地 5 层
  const grids = Array.from({ length: CITADEL_TERRACE_COUNT }, () =>
    Array.from({ length: F }, () => Array.from({ length: N }, () => Array(N).fill(".")))
  );
  const inRing = (t, ix, iz) => {
    const r = Math.hypot((ix - C) * 2, (iz - C) * 2);
    const hi = HIGHLAND_TERRACE_RADII[t] + 0.3;
    const lo = t === 0 ? 0 : HIGHLAND_TERRACE_RADII[t - 1] - 0.6;
    return r >= lo && r <= hi;
  };
  // 瀑布缺口（方位角 0.17±0.30 rad，前四层台地开槽）：前排略偏 +x 的扇区
  const inNotch = (ix, iz) => iz >= 19 && ix >= 11 && ix <= 16;
  // 攻城梯战场（台地 5 前排 +z）：梯脚/行军通道不压房子
  const inBattlefield = (ix, iz) => iz >= 19 && ix >= 10 && ix <= 18;
  const put = (t, ix, iz, f, ch, force = false) => {
    if (ix < 0 || ix >= N || iz < 0 || iz >= N || f < 0 || f >= F) return;
    if (!force && !inRing(t, ix, iz)) return; // 环带约束
    if (!force && t < 4 && inNotch(ix, iz)) return;
    if (!force && t === 4 && inBattlefield(ix, iz)) return;
    grids[t][f][iz][ix] = ch;
  };
  const house = (t, x0, z0, x1, z1, f0, f1, ch) => {
    for (let f = f0; f <= f1; f++)
      for (let iz = z0; iz <= z1; iz++)
        for (let ix = x0; ix <= x1; ix++) put(t, ix, iz, f, ch);
  };
  // 飞楼：只画第 f 层（下方留空 → 规则 5 支架）；位置仍需台地承重柱
  const fly = (t, ix, iz, f, ch) => {
    if (inRing(t, ix, iz) && !(t < 4 && inNotch(ix, iz)) && !(t === 4 && inBattlefield(ix, iz)))
      grids[t][f][iz][ix] = ch;
  };

  // ---- 台地 1（最高，r≤15.7）：主堡群 ----
  house(0, 10, 10, 14, 14, 0, 1, "0"); // 奶油主堡基座 5×5×2（顶成环带晒台花园）
  house(0, 11, 11, 13, 13, 2, 3, "5"); // 珊瑚主塔 3×3 再拔两层 → 顶出穹顶
  house(0, 8, 11, 8, 13, 0, 1, "9");   // 天青西翼 1×3 → 人字坡
  house(0, 16, 10, 16, 12, 0, 2, "C"); // 松石绿东翼 1×3×3 居高
  house(0, 9, 9, 9, 9, 0, 2, "1");     // 沙石西北塔 → 四坡尖顶
  house(0, 15, 14, 15, 14, 0, 2, "1"); // 沙石东南塔
  house(0, 10, 16, 11, 16, 0, 0, "3"); // 明黄门廊左厢 → 坡顶
  house(0, 14, 16, 15, 16, 0, 0, "B"); // 草绿门廊右厢
  put(0, 13, 15, 0, "G");              // 正门（前排中央，与旧档同位 x=+2）
  put(0, 13, 16, 0, "G");
  fly(0, 15, 11, 2, "A");              // 湖蓝飞楼（与东翼并成 L → 尖塔 + 黑铁支架）

  // ---- 台地 2（r 15.7–17.5）：轴向一环小屋 ----
  house(1, 11, 4, 13, 4, 0, 1, "A");   // 北侧湖蓝 1×3
  house(1, 9, 19, 9, 20, 0, 1, "3");   // 前左明黄 1×2（缺口扇区外）
  house(1, 19, 11, 20, 12, 0, 2, "C"); // 东侧松石绿 2×2×2
  fly(1, 20, 13, 2, "C");              // 其旁飞楼
  house(1, 4, 11, 4, 13, 0, 1, "4");   // 西侧蜜橙 1×3

  // ---- 台地 3（r 17.5–19.4）----
  house(2, 11, 3, 13, 3, 0, 1, "B");   // 北侧草绿 1×3
  house(2, 3, 11, 3, 13, 0, 1, "9");   // 西侧天青 1×3
  house(2, 21, 11, 21, 12, 0, 1, "D"); // 东侧紫罗兰 1×2
  fly(2, 21, 13, 2, "D");              // 飞楼
  house(2, 8, 20, 8, 20, 0, 1, "6");   // 前左砖红独栋 → 尖顶

  // ---- 台地 4（r 19.4–21.6）----
  house(3, 11, 2, 13, 2, 0, 1, "4");   // 北侧蜜橙 1×3
  house(3, 2, 11, 2, 13, 0, 2, "9");   // 西侧天青 1×3×3
  fly(3, 2, 14, 2, "9");               // 飞楼
  house(3, 22, 11, 22, 12, 0, 1, "5"); // 东侧珊瑚 1×2
  house(3, 9, 21, 9, 21, 0, 1, "A");   // 前左湖蓝独栋

  // ---- 台地 5（最低，r 21.6–24；前排留攻城战场）----
  house(4, 11, 1, 13, 1, 0, 1, "B");   // 北侧草绿 1×3
  fly(4, 13, 1, 2, "B");               // 飞楼
  house(4, 1, 11, 1, 13, 0, 1, "C");   // 西侧松石绿 1×3
  house(4, 23, 11, 23, 12, 0, 1, "3"); // 东侧明黄 1×2
  house(4, 8, 22, 8, 22, 0, 1, "0");   // 前左奶油独栋
  house(4, 19, 21, 19, 21, 0, 1, "6"); // 前右砖红独栋（战场右缘外）

  // ---- 环带街屋簇：沿等高线切向连续生长，而不是只放四个孤立样板屋 ----
  // Townscaper 的体量感来自相邻格触发的坡顶、露台、拱廊和飞楼规则。
  // 这里按每级台地的中径等角采样，以 2~3 格切向条带组成一户；高度和
  // 户色由整数序列确定，既保持可复现，也为每圈形成连续但不机械的街墙。
  const districtColors = ["5", "9", "8", "3", "0", "B", "A", "2", "C", "6", "4", "E"];
  const addRingHouse = (t, sampleIndex, sampleCount) => {
    const inner = t === 0 ? 0 : HIGHLAND_TERRACE_RADII[t - 1];
    const outer = HIGHLAND_TERRACE_RADII[t];
    const radiusCells = ((inner + outer) * 0.5) / 2;
    // 每级错开半个采样间距，避免五圈街屋在鸟瞰中排成放射状直线。
    const phi = (sampleIndex + 0.34 * t) / sampleCount * Math.PI * 2;
    const centerX = Math.round(C + Math.sin(phi) * radiusCells);
    const centerZ = Math.round(C + Math.cos(phi) * radiusCells);
    // 切向取主轴，条带沿等高线排列；每第三户三格，其余两格。
    const tangentAlongX = Math.abs(Math.cos(phi)) >= Math.abs(Math.sin(phi));
    const length = (sampleIndex + t) % 3 === 0 ? 3 : 2;
    // 少量户扩成 2 格进深，制造 Townscaper 的小院、厚墙和屋顶花园，
    // 避免所有建筑都退化成单列“火柴盒”。
    const depth = (sampleIndex * 3 + t) % 5 === 0 ? 2 : 1;
    const cells = [];
    const start = -Math.floor((length - 1) / 2);
    const radialSign = Math.cos(phi) >= 0 ? 1 : -1;
    for (let d = 0; d < depth; d++) {
      for (let k = 0; k < length; k++) {
        cells.push([
          centerX + (tangentAlongX ? start + k : radialSign * d),
          centerZ + (tangentAlongX ? radialSign * d : start + k),
        ]);
      }
    }
    const floors = 2 + ((sampleIndex * 7 + t) % 3); // 2~4 层，形成高低错落屋脊
    // 整户必须完全落在本环带、避开水帘/战场且不覆盖现有标志建筑。
    if (cells.some(([ix, iz]) =>
      !inRing(t, ix, iz)
      || (t < 4 && inNotch(ix, iz))
      || (t === 4 && inBattlefield(ix, iz))
      || Array.from({ length: floors }, (_, f) => grids[t][f][iz]?.[ix] !== ".").some(Boolean)
    )) return;
    const color = districtColors[(sampleIndex * 5 + t * 3) % districtColors.length];
    for (let f = 0; f < floors; f++) {
      for (const [ix, iz] of cells) put(t, ix, iz, f, color);
    }
    // 每四户伸出一格顶层飞楼，自动触发深色支架；只在承重环带内生成。
    if ((sampleIndex + t) % 4 === 1 && floors < F) {
      const [edgeX, edgeZ] = cells.at(-1);
      const flyX = edgeX + (tangentAlongX ? 1 : 0);
      const flyZ = edgeZ + (tangentAlongX ? 0 : 1);
      if (
        inRing(t, flyX, flyZ)
        && !(t < 4 && inNotch(flyX, flyZ))
        && !(t === 4 && inBattlefield(flyX, flyZ))
        && grids[t][floors - 1][flyZ]?.[flyX] === "."
      ) fly(t, flyX, flyZ, floors - 1, color);
    }
  };

  // 主堡外围补一圈低矮街屋，让最高台地不是整圈空广场；其余四圈随
  // 周长增加采样数，外圈形成连续山城，内圈也不会留下过大的灰台面。
  for (let i = 0; i < 10; i++) addRingHouse(0, i, 10);
  for (let t = 1; t < CITADEL_TERRACE_COUNT; t++) {
    const sampleCount = 16 + t * 3;
    for (let i = 0; i < sampleCount; i++) addRingHouse(t, i, sampleCount);
  }

  // 桥接拱廊：寻找“左右有房、下方为空”的可承重缝，补一格上层房体。
  // 这是 Townscaper 里由相邻体块触发的空中连桥；数量按台地递增，
  // 同时避开瀑布缺口和港口战场的通行带。
  const bridgeBudget = [1, 2, 2, 2, 2];
  for (let t = 0; t < CITADEL_TERRACE_COUNT; t++) {
    let added = 0;
    for (let f = 1; f < F && added < bridgeBudget[t]; f++) {
      for (let iz = 1; iz < N - 1 && added < bridgeBudget[t]; iz++) {
        for (let ix = 1; ix < N - 1 && added < bridgeBudget[t]; ix++) {
          if (!inRing(t, ix, iz) || grids[t][f][iz][ix] !== "." || grids[t][f - 1][iz][ix] !== ".") continue;
          if ((t < 4 && inNotch(ix, iz)) || (t === 4 && inBattlefield(ix, iz))) continue;
          const horizontal = grids[t][f][iz][ix - 1] !== "." && grids[t][f][iz][ix + 1] !== ".";
          const vertical = grids[t][f][iz - 1][ix] !== "." && grids[t][f][iz + 1][ix] !== ".";
          if (!horizontal && !vertical) continue;
          grids[t][f][iz][ix] = horizontal
            ? grids[t][f][iz][ix - 1]
            : grids[t][f][iz - 1][ix];
          added++;
        }
      }
    }
  }

  return grids.map((floors) =>
    floors.map((rows) => Object.freeze(rows.map((row) => row.join(""))))
  );
}

const HIGHLAND_TOWN_TERRACES = Object.freeze(makeHighlandTownTerraces());

export const CITADEL_TOWN_SPEC = Object.freeze({
  cellSize: 2.0,
  cellHeight: 2.0,
  // 字符：`.` 空 · `0-9A-E` Townscaper 15 色户 · `G` 正门
  // 五台地 × 每台地五层（v3 Townscaper 密集种子山城，生成器见上）
  terraces: HIGHLAND_TOWN_TERRACES,
  // 旧读取方兼容：levels = 顶台地五层（normalize 优先走 terraces）
  levels: HIGHLAND_TOWN_TERRACES[0],
});

/**
 * 运河交汇默认岛城（Townscaper 种子）。
 * 对照原版：贴水不规则岸线、竖柱同色户、退台花园、飞楼（自动长黑铁 stilts）。
 * 仅在无存档时使用；玩家编辑写入 tm.citadel.levels.canal-junction.v1 后不再覆盖。
 */
export const CANAL_JUNCTION_TOWN_SPEC = Object.freeze({
  cellSize: 1.6,
  cellHeight: 1.7,
  levels: Object.freeze([
    // L0 不规则贴水岸 · 红/绿/蓝/橙/黄/白户基（禁止整片灰白）
    Object.freeze([
      "...5EE5BB..",
      "..55EEEBBB.",
      ".D5E00EBBBC",
      "55E0000EB5B",
      "5EE00G00EE5",
      "BB00000EE55",
      "BBBEE44455.",
      ".3BEE4455..",
      "..BEE44....",
      "...E4......",
    ]),
    // L1 巷洞 + 拱廊空档
    Object.freeze([
      "...5EE5BB..",
      "..55E.EBBB.",
      ".D5E00EBBBC",
      "55E0..0EB5B",
      "5EE0.G.0EE5",
      "BB0...0EE55",
      "BBBEE44455.",
      ".3BEE4455..",
      "..BEE44....",
      "...........",
    ]),
    // L2 退台花园底 + 中庭
    Object.freeze([
      "....E.5B...",
      "..55E.EB...",
      ".D5E00EB.C.",
      ".5E0..0E...",
      ".EE0.3.0EE.",
      ".B0...0EE..",
      ".BBEE444...",
      "..BEE44....",
      "....E4.....",
      "...........",
    ]),
    // L3 竖户拔高（红塔/蓝塔/黄块/橙条 → 人字坡）
    Object.freeze([
      "...........",
      "..5....B...",
      "..DE00E..C.",
      "...........",
      "....333....",
      "...........",
      ".....444...",
      "....E44....",
      "...........",
      "...........",
    ]),
    // L4 塔身 + 橙条续坡
    Object.freeze([
      "...........",
      "..5....B...",
      "...E.......",
      "...........",
      "....3.3....",
      "...........",
      "......44...",
      ".....44....",
      "...........",
      "...........",
    ]),
    // L5 飞楼（下空 → 黑铁 stilts）
    Object.freeze([
      "...........",
      ".......B...",
      "..DDB......",
      "...........",
      ".....3.....",
      "...........",
      "...........",
      "......4....",
      "...........",
      "...........",
    ]),
    // L6 收顶
    Object.freeze([
      "...........",
      ".......B...",
      "...........",
      "...........",
      ".....3.....",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ]),
  ]),
});

/**
 * 高山圣城的 Townscaper 种子（参考图 v2）。
 *
 * 构建方法与运河交汇古堡完全一致：逐层栅格 → 邻接解析 → module family
 * 自动换型。种子只描述结构和颜色，不写死 Three.js 建筑：
 *   · 前排湖岸低城和码头门廊；
 *   · 中段高密坡城与蛇形朝圣巷；
 *   · 后排收窄并拔高，两侧形成可编辑的山脊塔群；
 *   · 中央 5×5 空腔让给不可删除的方尖碑战斗目标。
 * 玩家之后仍可左键生长、右键逐格挖洞，所有外形由邻接重新求解。
 */
function makeHighlandTownscaperLevels() {
  const N = CITADEL_GRID_SIZE;
  const C = (N - 1) / 2;
  const F = 12;
  const levels = Array.from({ length: F }, () =>
    Array.from({ length: N }, () => Array(N).fill("."))
  );
  const clampHeight = (value) => Math.min(F - 1, Math.max(0, Math.round(value)));
  const hashAt = (x, z, salt = 0) => {
    let h = Math.imul(x + 97, 374761393)
      ^ Math.imul(z + 131, 668265263)
      ^ Math.imul(salt + 17, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const protectedCore = (x, z) => Math.abs(x) <= 2 && Math.abs(z) <= 2;
  const inside = (x, z) => x >= -12 && x <= 12 && z >= -12 && z <= 12;
  const set = (x, z, floor, char) => {
    if (!inside(x, z) || floor < 0 || floor >= F || protectedCore(x, z)) return;
    levels[floor][z + C][x + C] = char;
  };

  // 参考图的竖向叙事：湖岸只保留分段低城，建筑沿山谷向中轴方尖碑
  // 聚拢并拔高。z=+10 面向湖面，z=-10 靠山；禁止生成一整条齐平城墙。
  const towerAnchors = Object.freeze([
    // 参考图剖面主塔：后山左塔最高（插画顶部的 focal 塔）
    { x: -7, z: -8, radius: 2.4, boost: 8, char: "0" },
    { x: 7, z: -8, radius: 2.05, boost: 6, char: "9" },
    { x: -9, z: -1, radius: 1.85, boost: 4, char: "A" },
    { x: 9, z: 0, radius: 1.95, boost: 5, char: "0" },
    { x: -7, z: 6, radius: 1.65, boost: 3, char: "2" },
    { x: 7, z: 5, radius: 1.65, boost: 3, char: "1" },
  ]);
  const waterfrontPalette = ["0", "2", "4", "5", "9", "A"];
  const middlePalette = ["0", "1", "2", "9", "A", "E", "7"];
  const upperPalette = ["0", "1", "9", "A", "E"];

  for (let z = -11; z <= 10; z++) {
    const depthT = (z + 11) / 21;
    const halfWidth = Math.round(7.0 + depthT * 1.4 + Math.sin(z * 0.71) * 0.45);
    for (let x = -halfWidth; x <= halfWidth; x++) {
      if (protectedCore(x, z)) continue;
      const hash = hashAt(x, z);
      const edge = Math.abs(x) >= halfWidth;
      if (edge && hash % 4 === 0) continue;
      // 湖岸底层分成数个相连街区；缺口由邻接规则长出巷口、拱洞和台阶，
      // 视觉上不再是一根横贯画面的直墙。
      const waterfrontBreak = z >= 8
        && Math.abs(x) >= 4
        && (hashAt(x, z, 41) % 5 <= 1);
      if (waterfrontBreak) continue;

      // 从码头到方尖碑的蛇形朝圣巷保持地面净空；横巷只切出短缺口，
      // 邻接 resolver 会自动在缺口上生成拱、阳台和支架。
      const laneX = Math.round(Math.sin((z - 1) * 0.64) * 1.25);
      const onPilgrimageLane = z >= 3 && Math.abs(x - laneX) === 0;
      const onCrossAlley = (z === 6 || z === -4)
        && Math.abs(x) >= 3
        && Math.abs(x) <= halfWidth - 2
        && (Math.abs(x) % 5 === 0);
      if (onPilgrimageLane || onCrossAlley) continue;

      const rearRise = Math.max(0, Math.floor((5 - z) / 6));
      const irregularStorey = hash % 5 <= 1 ? 1 : 0;
      const axialRise = Math.max(0, 2 - Math.floor(Math.abs(x) / 4))
        * (Math.abs(z) <= 7 ? 1 : 0);
      let height = 1 + rearRise + irregularStorey + axialRise;
      let color = (z >= 6 ? waterfrontPalette : z >= -3 ? middlePalette : upperPalette)[
        hash % (z >= 6 ? waterfrontPalette.length : z >= -3 ? middlePalette.length : upperPalette.length)
      ];

      // 可编辑的六座山城塔群替代旧的独立预制副塔。塔心拔高，外圈逐级
      // 回落，因此仍然只是一组普通 Townscaper 格，而不是特殊整楼模型。
      for (const anchor of towerAnchors) {
        const distance = Math.hypot(x - anchor.x, z - anchor.z);
        if (distance > anchor.radius + 0.7) continue;
        const towerLift = Math.max(0, anchor.boost - Math.floor(distance * 2.25));
        height = Math.max(height, 2 + rearRise + towerLift);
        if (distance <= anchor.radius) color = anchor.char;
      }

      // 两侧山壁方向逐步压低，突出中轴与高塔，同时保留不对称轮廓。
      if (Math.abs(x) >= halfWidth - 1) height -= 1;
      // 参考图剖面：临水两排压成低阶（下城矮、密、亮，往上逐步拔高）
      if (z >= 9) height = Math.min(height, 2);
      height = clampHeight(height);
      for (let floor = 0; floor < height; floor++) set(x, z, floor, color);
    }
  }

  // 湖岸正门：只占底层，避免整根竖户都被解释为门材质。
  set(0, 10, 0, CITADEL_GATE_CHAR);

  // 三处跨巷飞楼。下方保持空格，上层按相邻户色接回，Townscaper 规则
  // 会自动生成拱洞和黑铁支架，呼应参考图的层叠桥廊。
  for (const bridge of [
    { x: 0, z: 6, floor: 2, char: "0" },
    { x: -5, z: -4, floor: 3, char: "9" },
    { x: 5, z: -4, floor: 4, char: "A" },
  ]) {
    set(bridge.x, bridge.z, bridge.floor, bridge.char);
    set(bridge.x, bridge.z, bridge.floor + 1, bridge.char);
  }

  // 方尖碑 hard cavity 最后再清一次，防止任何塔群/飞楼覆盖战斗核心。
  for (let floor = 0; floor < F; floor++) {
    for (let z = -2; z <= 2; z++) {
      for (let x = -2; x <= 2; x++) levels[floor][z + C][x + C] = ".";
    }
  }

  return Object.freeze(levels.map((rows) =>
    Object.freeze(rows.map((row) => Object.freeze(row.join(""))))
  ));
}

export const HIGHLAND_TOWNSCAPER_TOWN_SPEC = Object.freeze({
  cellSize: 2.0,
  cellHeight: 2.0,
  floors: 12,
  construction: "canal-townscaper-grid-v1",
  seedVersion: "highland-reference-obelisk-stone-v3",
  composition: "broken-waterfront_to_dense-white-slope_to_obelisk",
  protectedCore: Object.freeze({ centerX: 12, centerZ: 12, halfX: 2, halfZ: 2 }),
  levels: makeHighlandTownscaperLevels(),
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
 * Normalize legacy single-stack saves and the v3 five-terrace layout into:
 * terrace 0 = 台地 1（最高）, each terrace owns exactly `floors` castle floors
 * （高山圣城 5 层；运河交汇古堡 12 层——层数参数化，100% Townscaper 高塔）。
 * Every floor is padded to a common 25×25 centered grid, so editing one
 * terrace can never shift the shared sacred-city origin.
 */
export function normalizeCitadelTerraceLayout(input = CITADEL_TOWN_SPEC, floors = CITADEL_CASTLE_FLOORS) {
  // G30 增量性能：已规范化的布局（version 2 + gridSize + terraces）是
  // Object.freeze 的不可变结果（createCitadelBlueprint 产物），直接复用，
  // 避免增量 rebuild 每 edit 全量深拷贝 942 格（字符串分配 → GC 压力）。
  if (
    input?.version === 2 &&
    input?.gridSize &&
    Array.isArray(input?.terraces) &&
    input?.terraces.every?.((terrace) => Array.isArray(terrace?.levels))
  ) {
    return input;
  }
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
 * 第二轮空间规则：从建筑体块之间的空域中找出真正的“内院”。
 *
 * Townscaper 的庭院不是布局表里额外硬编码的一类房子，而是第一轮
 * 建筑组合完成后，对被墙体围合的空单元再跑一次 2D 规则。这里保持
 * 同样的分层：先做空域 flood fill，再要求区域不接触边界、上方开敞、
 * 至少有三条实体边。返回值只含坐标，不创建 Three.js 对象，便于编辑器
 * 预览、运行时装配和 headless 测试共享。
 */
export function collectCitadelCourtyardRegions(
  grid,
  cols = CITADEL_GRID_SIZE,
  rows = CITADEL_GRID_SIZE,
  levels = CITADEL_CASTLE_FLOORS
) {
  // 性能（2026-09-04）：这个函数是**每次编辑都要重跑一遍的固定成本**——
  // 增量重建只把「发不发几何」按 dirty 收窄，空间规则本身仍然是全图的。
  // CPU profile 实测它占一次编辑的 8.2%，仅次于 Three 的几何烘焙。
  // 慢的不是算法（flood fill 本来就是 O(格数)），是**字符串键**：
  // 原来 at() 每探一个邻居就拼一次 `${ix},${iy},${iz}`，seen 也用字符串键，
  // 32×32×5 的图一次调用要造 5 万多个临时字符串，全喂给 GC。
  //
  // 改法：把 grid 一次性摊成**稠密占用位图**（Uint8Array），此后所有探测都是
  // 数组下标；seen 换成按层复用的 Uint8Array。遍历顺序、push/pop 顺序、
  // 返回结构一字未改——`cells` 数组的顺序也逐位不变，测试可以直接比对。
  const planeSize = cols * rows;
  // levels + 1 层：topOpen 要探 iy+1，最上面多留一层空平面当哨兵
  const solid = new Uint8Array(planeSize * (levels + 1));
  for (const [key, ch] of grid) {
    if (ch === ".") continue;
    // grid 的键就是 "ix,iy,iz"，这里只在**摊平时**解析一次，不在热路径里
    const c1 = key.indexOf(",");
    const c2 = key.indexOf(",", c1 + 1);
    const ix = +key.slice(0, c1);
    const iy = +key.slice(c1 + 1, c2);
    const iz = +key.slice(c2 + 1);
    if (ix < 0 || ix >= cols || iz < 0 || iz >= rows || iy < 0 || iy >= levels) continue;
    solid[iy * planeSize + iz * cols + ix] = 1;
  }
  /** 越界一律当空（与原来的 `?? "."` 同义） */
  const isSolid = (ix, iy, iz) =>
    ix >= 0 && ix < cols && iz >= 0 && iz < rows && iy >= 0 && iy <= levels
      ? solid[iy * planeSize + iz * cols + ix] === 1
      : false;

  const seen = new Uint8Array(planeSize);
  const result = [];
  for (let iy = 0; iy < levels; iy++) {
    seen.fill(0);
    const base = iy * planeSize;
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const startIdx = iz * cols + ix;
        if (solid[base + startIdx] === 1 || seen[startIdx] === 1) continue;
        const queue = [[ix, iz]];
        const cells = [];
        let touchesBoundary = false;
        seen[startIdx] = 1;
        while (queue.length) {
          const [x, z] = queue.pop();
          cells.push([x, z]);
          if (x === 0 || z === 0 || x === cols - 1 || z === rows - 1) touchesBoundary = true;
          for (const [dx, dz] of DIRS) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
            const nIdx = nz * cols + nx;
            if (seen[nIdx] === 1 || solid[base + nIdx] === 1) continue;
            seen[nIdx] = 1;
            queue.push([nx, nz]);
          }
        }
        if (touchesBoundary) continue;
        let topOpen = true;
        for (let i = 0; i < cells.length; i++) {
          if (isSolid(cells[i][0], iy + 1, cells[i][1])) { topOpen = false; break; }
        }
        if (!topOpen) continue;
        let solidBorderEdges = 0;
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i][0];
          const z = cells[i][1];
          for (const [dx, dz] of DIRS) {
            if (isSolid(x + dx, iy, z + dz)) solidBorderEdges++;
          }
        }
        if (solidBorderEdges < 3) continue;
        result.push(Object.freeze({
          terraceFloor: iy,
          cells: Object.freeze(cells.map(([x, z]) => Object.freeze([x, z]))),
          size: cells.length,
          solidBorderEdges,
          topOpen,
        }));
      }
    }
  }
  return Object.freeze(result);
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
  // 实心块判据：存在一个完整的 2×2 方块 = 这是一片「面」，不是「臂」。
  // 十字教堂靠「有格子四邻皆有」来认，但**任何实心块的内部格都满足这个条件**——
  // 7×7 全实心也会被判成十字教堂，于是整片广场长满屋顶还插一根尖塔
  // （2026-09-04 实测：7×7 单层 → town-roof ×47 + 尖塔，fence 0）。
  // 而录像里（S23 sheetA 5–8s / sheet_0 15–20s）大平台就是**开阔广场 + 沿轮廓的女儿墙**。
  // 所以先排除实心块：有 2×2 就是平顶，轮不到十字。
  const has2x2 = cells.some(([ix, iz]) =>
    set.has(`${ix + 1},${iz}`) && set.has(`${ix},${iz + 1}`) && set.has(`${ix + 1},${iz + 1}`)
  );
  // 2×2 方块环（恰好四格）另有专门分支，不能被 has2x2 提前吃掉
  if (has2x2 && size > 4) return { kind: "plaza" };
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
      materials.roofTile ?? materials.wood
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
  // 性能（2026-09-04）：原来每个格键要 `split(",").map(Number)` **两遍**
  // （一遍建列、一遍求 bottom/top），还要为每根柱拼一个 "ix,iz" 字符串键。
  // 一次编辑要跑 15 遍（buildCitadelTown ×5 台地 × 3 个调用点），
  // CPU profile 实测占 2.4%。改成：手写一次解析 + 整数列键 + 边扫边求极值，
  // 不再存 keys 数组。houses 的顺序与字段一字不变（列的首次出现顺序）。
  const columns = new Map(); // ix*4096+iz -> { ix, iz, bottom, top, hasGate, bottomChar }
  for (const [key, ch] of grid) {
    const c1 = key.indexOf(",");
    const c2 = key.indexOf(",", c1 + 1);
    const ix = +key.slice(0, c1);
    const iy = +key.slice(c1 + 1, c2);
    const iz = +key.slice(c2 + 1);
    const col = ix * 4096 + iz;
    let entry = columns.get(col);
    if (!entry) {
      columns.set(col, { ix, iz, bottom: iy, top: iy, hasGate: ch === CITADEL_GATE_CHAR, bottomChar: ch });
      continue;
    }
    if (iy < entry.bottom) { entry.bottom = iy; entry.bottomChar = ch; }
    if (iy > entry.top) entry.top = iy;
    if (ch === CITADEL_GATE_CHAR) entry.hasGate = true;
  }
  const houses = [];
  for (const entry of columns.values()) {
    const { ix, iz, bottom, top, hasGate } = entry;
    houses.push({
      ix,
      iz,
      seed: (ix * 374761393 + iz * 668265263) >>> 0,
      bottom,
      top,
      floors: top - bottom + 1,
      char: entry.bottomChar ?? "0",
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
  // 两片坡面各自铺满一张可拼接陶瓦纹理；山墙端面复用同一范围，
  // 让条带屋顶连续出现横向瓦行和交错竖缝。
  const uv = [
    0, 0, 1, 1, 1, 0,
    0, 0, 0, 1, 1, 1,
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 0.5, 1,
    0, 0, 0.5, 1, 1, 0,
  ];
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
export function buildCitadelTown(spec, ctx, { dirty = null } = {}) {
  // dirty 增量（G30-A）：只生成 dirty 集的格子几何；所有"判定"循环保持全量，
  // 只在生成点按所属格过滤，保证与全量路径逐格同构（dirty 集外不生成、旧网格保留）。
  const dirtySet = dirty ? new Set(dirty.map((cell) => {
    const parts = Array.isArray(cell) ? cell : String(cell).split(",");
    return (Number(parts[0]) << 12) | (Number(parts[1]) << 6) | Number(parts[2]);
  })) : null;
  // G30 增量性能：want() 与 at() 同走整数 key（ix<<12 | iy<<6 | iz），
  // 判定循环热路径不再做模板字符串拼接。
  // 跨格构件发射期间（ownSpanning 作用域内），整组格一律视为 dirty：
  // 摘旧网格用的是 cells.some(dirty)，重建也必须整组一起来，否则「摘掉一整块
  // 屋顶只补回一格」。把口径绑在 ownSpanning 声明的格集上，比往 dirty 里塞
  // 邻域格便宜得多——后者会连带重建那些格自己的墙/窗/门（实测 P90 190ms）。
  let _spanWant = null;
  const want = (ix, iy, iz) => {
    if (!dirtySet) return true;
    const key = (ix << 12) | (iy << 6) | iz;
    return dirtySet.has(key) || (_spanWant !== null && _spanWant.has(key));
  };
  const spanKeyOf = (cellKey) => {
    const [x, y, z] = String(cellKey).split(",").map(Number);
    return (x << 12) | (y << 6) | z;
  };
  const { cellSize: cs, cellHeight: ch } = spec;
  const { mesh, materials, random } = ctx;
  const skipDecor = ctx.skipDecor === true;

  // ---------- 栅格索引 ----------
  const grid = new Map();
  // G30 增量性能：at() 是判定循环热路径（全量判定 × 每格多次邻域查询），
  // 整数 key（ix<<12 | iy<<6 | iz，网格 ≤ 25×12×25 不越界）替代字符串拼接。
  const gridFlat = new Map();
  let cols = Number.isInteger(spec.gridSize) ? spec.gridSize : 0;
  let rows = Number.isInteger(spec.gridSize) ? spec.gridSize : 0;
  // 旧档字符在入口统一迁移（W/L/B/D → 0/2/6/G），所有调用方共用
  const levels = spec.levels.map((rowsArr) => rowsArr.map(migrateLegacyTownChars));
  levels.forEach((rowsArr, iy) => {
    rows = Math.max(rows, rowsArr.length);
    rowsArr.forEach((row, iz) => {
      cols = Math.max(cols, row.length);
      [...row].forEach((char, ix) => {
        if (char !== ".") {
          grid.set(`${ix},${iy},${iz}`, char);
          gridFlat.set((ix << 12) | (iy << 6) | iz, char);
        }
      });
    });
  });
  const at = (ix, iy, iz) => gridFlat.get((ix << 12) | (iy << 6) | iz) ?? ".";

  const wfcOn = (ctx.wfcTownV1 ?? P.wfcTownV1) === true && grid.size > 0;
  let wfcOracle = makeTownRoleOracle(null);
  let wfcReport = { enabled: false, ok: false };
  if (wfcOn) {
    const cache = ctx.townCtxCache ?? null;
    const seed = ctx.wfcSeed ?? 1;
    let selection;
    if (dirtySet && cache?.wfcTownSelection?.value?.byCell) {
      const dirtyKeys = [];
      for (const packed of dirtySet) {
        dirtyKeys.push(`${packed >> 12},${(packed >> 6) & 63},${packed & 63}`);
      }
      const inc = resolveIncremental({
        grid,
        seed,
        previous: cache.wfcTownSelection.value.byCell,
        dirtyKeys,
      });
      const roleAt = (ix, iy, iz) => inc.byCell?.[`${ix},${iy},${iz}`]?.variant ?? null;
      selection = { ...inc, roleAt, fromCache: false };
      if (inc.ok && cache) {
        cache.wfcTownSelection = {
          sig: `${townGridSignature(grid)}|${seed}`,
          value: { ok: true, byCell: inc.byCell, hash: inc.hash ?? null, roleAt },
        };
      }
    } else {
      selection = resolveTownSelection(grid, { cache, seed });
    }
    wfcOracle = makeTownRoleOracle(selection);
    wfcReport = {
      enabled: true,
      ok: selection.ok === true,
      ms: selection.ms ?? 0,
      fromCache: selection.fromCache === true,
      unresolved: selection.unresolved?.length ?? 0,
      hash: selection.hash ?? null,
    };
  }
  // V3 簇配色（C2）：同字符 4 连通簇 + 朝向近似；非 V3 的 shade 工厂忽略第五参
  const townClusters = computeTownClusters(grid);
  const openMaskFor = (ix, iy, iz) => DIRS.reduce(
    (mask, [dx, dz], index) => at(ix + dx, iy, iz + dz) === "." ? mask | (1 << index) : mask,
    0
  );
  // 户表（竖柱同色 = 一户）：grid 在本次构建里不再变，所以**只收一次**。
  // 原来三个调用点各收一遍（规则 2.5 柱高表 / 规则 3 户表 / 规则 7 晾衣绳），
  // 一次编辑 ×5 台地 = 15 遍全图扫描。
  let _housesMemo = null;
  const housesOf = () => (_housesMemo ??= collectCitadelHouses(grid));

  const cx = (ix) => citadelGridCellCenter(ix, 0, 0, cs, ch, cols).x;
  const cz = (iz) => citadelGridCellCenter(0, 0, iz, cs, ch, rows).z;
  const cy = (iy) => citadelGridCellCenter(0, iy, 0, cs, ch, cols).y;

  // 归属声明（C3）：层组内每个网格都必须能说出自己属于哪一格，否则增量重建
  // 摘不掉它（`o.isMesh && (userData.cell || userData.townModule)`），合并块也
  // 无法按格局部替换。拦截 add 而不是改 52 个调用点：规则块只需在循环顶部
  // 用 ownCell() 声明当前格。
  let _ownerCell = null;
  const ownCell = (ix, iy, iz, char) => { _ownerCell = { ix, iy, iz, char }; };
  /**
   * 声明「接下来发射的对象属于这一组格」。
   * @returns {boolean} 这组格是否需要重建（全量恒 true；增量下 = 任一格 dirty）。
   *   调用方拿它当门：`if (!ownSpanning(keys)) continue;`——不 dirty 就整组不发，
   *   dirty 就整组全发（组内每格的 want() 在作用域内一律为真）。
   */
  const ownSpanning = (cells) => {
    _ownerCell = { cells };
    _spanWant = new Set(cells.map(spanKeyOf));
    return !dirtySet || cells.some((key) => dirtySet.has(spanKeyOf(key)));
  };
  const ownNone = () => { _ownerCell = null; _spanWant = null; };
  const stampOwner = (object, iy) => {
    const unowned = [];
    object.traverse?.((o) => {
      if (!o.isMesh) return;
      if (o.userData.cell || o.userData.townModule || o.userData.cells) return;
      if (_ownerCell) {
        if (_ownerCell.cells) o.userData.cells = _ownerCell.cells;
        else o.userData.cell = _ownerCell;
        return;
      }
      unowned.push(o.name || o.type);
    });
    if (unowned.length) {
      throw new Error(
        `town level ${iy}: 网格无主（不在 ownCell/ownSpanning 作用域内，自身也没写 userData.cell）：${unowned.slice(0, 5).join(", ")}`
      );
    }
  };

  const levelGroups = levels.map((_, iy) => {
    const group = new THREE.Group();
    group.name = `town-level-${iy}`;
    const rawAdd = group.add.bind(group);
    group.userData.restoreAdd = () => { group.add = rawAdd; };
    group.userData.stampOwner = (object) => stampOwner(object, iy);
    group.add = (...objects) => {
      const kept = [];
      for (const object of objects) {
        const next = skipDecor ? stripDecorMeshes(object) : object;
        if (!next) continue;
        if (skipDecor && isDecorTree(next)) continue;
        stampOwner(next, iy);
        kept.push(next);
      }
      if (!kept.length) return group;
      return rawAdd(...kept);
    };
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
    courtyardCount: 0,
    courtyardCellCount: 0,
    courtyardWallCount: 0,
    courtyardWellCount: 0,
    plazaCount: 0,
    boatCount: 0,
    birdCount: 0,
    supportCount: 0, // 悬空支撑支架（flying buildings 支撑柱 + 斜撑）
    wfcTown: wfcReport,
    corniceCount: 0,
    plinthCount: 0,
    balconyCount: 0,
    pilasterCount: 0,
    arcadeColumnCount: 0,
    ridgeCount: 0,
    eaveCount: 0,
    oculusCount: 0,
    chimneyCount: 0, // 烟囱（Townscaper 坡屋顶签名构件）
    moduleCount: 0,
    moduleFamilyCounts: Object.fromEntries(
      Object.keys(TOWNSCAPER_MODULE_FAMILIES).map((family) => [family, 0])
    ),
    gate: null,
  };
  const domeCenters = new Set(); // "ix,iy,iz" —— 不出垛口/塔顶
  const towerTops = new Set();

  // ---------- 规则 0：实心体块（只画外露面 + 顶底渐变 + 角点扰动） ----------
  const cellGeometry = new THREE.BoxGeometry(cs, ch, cs);
  const leanDecor = ctx.leanDecor === true;
  // 运河交汇古堡：Townscaper 高饱和彩城模式——墙面抹渐变色块、
  // 屋顶用带顶点渐变的陶瓦材质（高山圣城保持原平涂路径不变）。
  const colorful = ctx.colorful === true;
  const roofGradMat = materials.roofTileGrad ?? materials.roofTile;
  const roofVariantSource = ctx.roofTileVariants ?? materials.roofTileVariants;
  const roofVariants = Array.isArray(roofVariantSource) && roofVariantSource.length
    ? roofVariantSource
    : [roofGradMat];
  const roofMaterialFor = (ix, iz, iy) => {
    const h = (ix * 374761393 + iz * 668265263 + iy * 2246822519) >>> 0;
    return roofVariants[h % roofVariants.length];
  };
  const balconyVariantSource = ctx.balconyTileVariants ?? materials.balconyTileVariants;
  const balconyVariants = Array.isArray(balconyVariantSource) && balconyVariantSource.length
    ? balconyVariantSource
    : [roofGradMat];
  const foundationVariantSource = ctx.foundationVariants ?? materials.foundationVariants;
  const foundationVariants = Array.isArray(foundationVariantSource) && foundationVariantSource.length
    ? foundationVariantSource
    : [materials.plazaStone ?? materials.contour ?? trimMat];
  const fenceVariantSource = ctx.fenceVariants ?? materials.fenceVariants;
  const fenceVariants = Array.isArray(fenceVariantSource) && fenceVariantSource.length
    ? fenceVariantSource
    : [materials.iron ?? trimMat];
  const balconyMaterialFor = (ix, iz, iy, style = 0) => {
    const h = (ix * 374761393 + iz * 668265263 + iy * 2246822519 + style * 3266489917) >>> 0;
    return balconyVariants[h % balconyVariants.length];
  };
  const foundationMaterialFor = (ix, iz, iy, style = 0) => {
    const h = (ix * 668265263 + iz * 374761393 + iy * 2246822519 + style * 1597334677) >>> 0;
    return foundationVariants[h % foundationVariants.length];
  };
  const fenceMaterialFor = (ix, iz, iy, style = 0) => {
    const h = (ix * 2246822519 + iz * 3266489917 + iy * 668265263 + style * 374761393) >>> 0;
    return fenceVariants[h % fenceVariants.length];
  };
  const registerModule = (family, ix, iy, iz, variant, object = null) => {
    stats.moduleCount++;
    stats.moduleFamilyCounts[family] = (stats.moduleFamilyCounts[family] ?? 0) + 1;
    if (object) {
      const openFaces = DIRS
        .filter(([dx, dz]) => at(ix + dx, iy, iz + dz) === ".")
        .map(([dx, dz]) => `${dx},${dz}`);
      object.userData.townModule = {
        family,
        variant,
        ix,
        iy,
        iz,
        catalogSize: TOWNSCAPER_MODULE_VARIANTS,
        // 邻接约束快照：几何可以合并，但编辑器/后续 WFC 仍能知道这个
        // module 面向哪些空域、是否有上下承重关系以及是否处于屋顶。
        constraints: {
          openFaces,
          roof: at(ix, iy + 1, iz) === ".",
          supportBelow: iy === 0 || at(ix, iy - 1, iz) !== ".",
          continuationAbove: at(ix, iy + 1, iz) !== ".",
        },
      };
    }
    return object;
  };
  const cornerBody = (ctx.cornerModulesV1 ?? P.cornerModulesV1) === true;
  if (cornerBody) {
    assembleCornerBody({
      grid, cols, cs, ch, mesh, materials, ownSpanning, ownNone, levelGroups, stats,
      gridV6: ctx.gridV6 ?? null,
    });
    stats.cellCount = grid.size;
  }
  for (const [key, char] of grid) {
    if (cornerBody) continue;
    const [ix, iy, iz] = key.split(",").map(Number);
    // G30 增量性能：dirty 模式下先 want() 跳过非 dirty 格，再算 expose（
    // 6 次邻域查询）——897/942 格直接 continue，统计语义不变。
    if (!want(ix, iy, iz)) { stats.cellCount++; continue; }
    const expose = {
      px: at(ix + 1, iy, iz) === ".",
      nx: at(ix - 1, iy, iz) === ".",
      py: at(ix, iy + 1, iz) === ".",
      ny: iy === 0,
      pz: at(ix, iy, iz + 1) === ".",
      nz: at(ix, iy, iz - 1) === ".",
    };
    if (!expose.px && !expose.nx && !expose.py && !expose.ny && !expose.pz && !expose.nz) {
      stats.cellCount++;
      continue;
    }
    const gridV6 = ctx.gridV6 ?? null;
    const cageCorners = gridV6
      ? cellCageCorners(ix, iz, {
          quad: gridV6.quad, mapping: gridV6.mapping, cellSize: cs, gridSize: cols,
        })
      : null;
    const col = gridV6
      ? citadelColumnCenter(ix, iz, {
          quad: gridV6.quad, mapping: gridV6.mapping, cellSize: cs, gridSize: cols,
        })
      : null;
    const geo = makeExposedCellGeometry(
      cs, ch, expose, ix, iz, iy,
      cageCorners && col ? { corners: cageCorners, cx: col.x, cz: col.z } : null
    ) || makeDistortedCellGeometry(cellGeometry, ix, iz, iy);
    if (colorful) applyPatchyWallColors(geo, ix, iz, iy);
    else applyVerticalVertexColors(geo, 1.0, 1.0);
    // 砖缝跨格连续（C13-1）：UV 走世界坐标，不用每面 0..1
    applyWorldBrickUv(geo, cx(ix), cy(iy), cz(iz), cs, ch);
    const clusterInfo = {
      clusterId: townClusters.clusterOf.get(ix * 32 + iz),
      facing: townCellFacing(townClusters.baseChar, ix, iz),
    };
    const cell = mesh(
      geo,
      ctx.materials.shade?.(char, ix, iz, iy, clusterInfo) ?? materials[char] ?? materials.W,
      "town-cell"
    );
    cell.position.set(col?.x ?? cx(ix), cy(iy), col?.z ?? cz(iz));
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
      if (!want(bx, by, bz)) continue;
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
      ownCell(bx, by, bz, at(bx, by, bz));
      levelGroups[by].add(dome);
      ownNone();
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
      if (!want(ix, top, iz)) continue;
      const cap = ctx.buildHalfDome(cs * 0.56, materials.gold, "town-tower-cap", 1.22);
      cap.position.set(cx(ix), (top + 1) * ch, cz(iz));
      ownCell(ix, top, iz, at(ix, top, iz));
      levelGroups[top].add(cap);
      ownNone();
      stats.towerCount++;
    }
  }

  // 围栏构件几何（低层开阔屋顶边缘：立柱 + 通长横杆）
  const fencePostGeometry = new THREE.BoxGeometry(0.09, 0.5, 0.09);
  const fenceRailXGeometry = new THREE.BoxGeometry(cs + 0.06, 0.07, 0.07); // 横杆沿 x
  const fenceRailZGeometry = new THREE.BoxGeometry(0.07, 0.07, cs + 0.06); // 横杆沿 z
  // 二次庭院规则：围墙/矮墙 + 中央井盆。与第一轮体块共用格坐标，
  // 只在空域上添细节，不改变可编辑的建筑占格。
  const courtyardWallGeometry = new THREE.BoxGeometry(cs * 0.96, 0.34, 0.12);
  const courtyardBasinGeometry = new THREE.CylinderGeometry(cs * 0.2, cs * 0.24, 0.12, 8);
  const courtyardWaterGeometry = new THREE.CylinderGeometry(cs * 0.13, cs * 0.13, 0.035, 8);

  // ---------- 建筑构件统一几何（Townscaper 立面层次）----------
  // 深色盘 trim：檐口线 / 墙裙 / 窗台窗楣 / 阳台栏杆 / 屋脊瓦 / 山墙圆窗 / 风向标
  const trimMat = materials.trim ?? materials.ink;
  // 楼板檐口线：外露面层顶压条（宽跨格、突出 0.08）
  const corniceGeometry = new THREE.BoxGeometry(cs + 0.16, 0.16, 0.09);
  const floorBandGeometry = new THREE.BoxGeometry(cs * 0.88, 0.07, 0.075);
  // 底层墙裙：外露面底部基座条
  const plinthGeometry = new THREE.BoxGeometry(cs + 0.16, 0.46, 0.09);
  // 窗台（下托）/ 窗楣（上压）
  // C13-2（S23 / PLAN §10.2，证据 docs/z1.png）：窗是**三件套**，不是一块贴片。
  //   frame   白色厚外框，比洞口大 12%，外凸 0.02 → 在墙上投一道细影
  //   glass   中蓝玻璃，相对外框内凹 0.01
  //   mullion 白色十字窗棂（2×2 分格）
  // 尺寸按 z1 读数：窗接近正方形，边长 ≈ 0.62 世界单位。
  const WIN_W = 0.62;
  const winFrameGeometry = new THREE.BoxGeometry(WIN_W * 1.12, WIN_W * 1.12, 0.05);
  const winGlassGeometry = new THREE.BoxGeometry(WIN_W, WIN_W, 0.03);
  const winMullionVGeometry = new THREE.BoxGeometry(WIN_W * 0.09, WIN_W, 0.045);
  const winMullionHGeometry = new THREE.BoxGeometry(WIN_W, WIN_W * 0.09, 0.045);
  // 山墙菱形窗（z1 右下：山墙上是 45° 旋转的方窗，无棂）
  const gableDiamondFrameGeometry = new THREE.BoxGeometry(WIN_W * 0.62, WIN_W * 0.62, 0.05);
  const gableDiamondGlassGeometry = new THREE.BoxGeometry(WIN_W * 0.44, WIN_W * 0.44, 0.03);
  const sillGeometry = new THREE.BoxGeometry(0.92, 0.09, 0.16);
  const lintelGeometry = new THREE.BoxGeometry(1.06, 0.1, 0.12);
  // 转角壁柱：竖向细柱
  const pilasterGeometry = new THREE.BoxGeometry(0.3, ch * 0.96, 0.3);
  // 阳台：悬挑板 + 铁艺栏杆（3 根竖条 + 扶手横杆）
  const balconySlabGeometry = new THREE.BoxGeometry(0.96, 0.08, 0.5);
  const balconyRailPostGeometry = new THREE.BoxGeometry(0.05, 0.42, 0.05);
  const balconyRailBarGeometry = new THREE.BoxGeometry(0.96, 0.045, 0.05);
  const balconyCanopyGeometry = new THREE.BoxGeometry(1.08, 0.06, 0.42);
  const flowerBoxGeometry = new THREE.BoxGeometry(0.44, 0.14, 0.22);
  const windowAwningGeometry = new THREE.BoxGeometry(1.08, 0.06, 0.26);
  const balconyTileAccentGeometry = new THREE.BoxGeometry(0.12, 0.035, 0.12);
  // 连拱柱廊细柱
  const arcadeColumnGeometry = new THREE.CylinderGeometry(0.13, 0.17, ch, 6);
  // 屋脊瓦 / 挑檐压条
  const ridgeGeometry = new THREE.BoxGeometry(cs * 0.92, 0.12, 0.18);
  const eaveGeometry = new THREE.BoxGeometry(cs, 0.09, 0.24);
  // ---- C13-4 檐口三层色带（PLAN §10.4）----
  // z1 的檐口剖面自上而下是「瓦面橙 → 白色檐板 → 暗红封檐」，出挑约 0.04 格。
  // 原来的坡面只是一条硬边，所以屋顶像纸片。这里在**落水侧两条檐口**各挂两片薄板：
  //   檐板 EAVE_FASCIA_H = 0.03ch，顶面与坡面根部（y = baseY）齐平；
  //   封檐 EAVE_BARGE_H  = 0.02ch，紧贴檐板下沿。
  // 带的外沿 = 坡面半宽 0.56cs + 出挑 0.04cs = 0.60cs，所以带中心正好落在 0.56cs。
  const EAVE_FASCIA_H = ch * 0.03;
  const EAVE_BARGE_H = ch * 0.02;
  const EAVE_OVERHANG = cs * 0.04;
  const EAVE_SPAN = cs * 1.08; // = makeGableRoofGeometry 的 2l，与相邻格首尾相接
  const EAVE_HALF_W = cs * 0.56; // = makeGableRoofGeometry 的 w（坡面半宽）
  // 檐口按**整条屋脊**出一根，不是逐格四片：一条 N 格的条带只加 4 个网格（±Z 各
  // 檐板 + 封檐），而不是 4N 个。既省合并成本（逐格版把 edit P50 从 150 顶到 187ms），
  // 视觉上也更对——真实檐口是一条连续的线，逐格拼会在格缝处露出接头。
  const _eaveGeoCache = new Map();
  const eaveRunGeometry = (spanLen, h, depth) => {
    const key = `${spanLen.toFixed(4)}|${h.toFixed(4)}|${depth.toFixed(4)}`;
    let geo = _eaveGeoCache.get(key);
    if (!geo) { geo = new THREE.BoxGeometry(spanLen, h, depth); _eaveGeoCache.set(key, geo); }
    return geo;
  };
  // 山墙圆窗（口沿 + 十字格）
  const oculusGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10);
  const oculusCrossGeometry = new THREE.BoxGeometry(0.34, 0.06, 0.08);
  // 风向标：细杆 + 箭头尾翼（教堂尖塔顶饰；旗杆不做——用户偏好）
  const vanePostGeometry = new THREE.BoxGeometry(0.03, 0.5, 0.03);
  const vaneTailGeometry = new THREE.BoxGeometry(0.26, 0.05, 0.04);
  // 烟囱（Townscaper 签名构件）：墙色方柱 + 深色压顶，立在坡屋顶一端
  const chimneyGeometry = new THREE.BoxGeometry(cs * 0.16, ch * 0.52, cs * 0.16);
  const chimneyCapGeometry = new THREE.BoxGeometry(cs * 0.22, 0.07, cs * 0.22);
  // 拱形门口几何缓存：矩形身 + 半圆拱顶，底部对齐 y=0（ExtrudeGeometry 薄挤出）
  const archDoorCache = new Map();
  const archDoorGeometry = (w, h, depth) => {
    const key = `${w}|${h}|${depth}`;
    let geo = archDoorCache.get(key);
    if (geo) return geo;
    const r = w / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(-r, h - r);
    shape.absarc(0, h - r, r, Math.PI, 0, true); // 半圆拱顶
    shape.lineTo(r, 0);
    shape.closePath();
    geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    archDoorCache.set(key, geo);
    return geo;
  };
  // C13-4：给一格人字坡的两条落水檐口挂「白檐板 + 暗红封檐」。
  // alongX = 屋脊沿 X（落水侧朝 ±Z），否则朝 ±X。必须在 ownSpanning(comp.keys)
  // 作用域里调用——它和瓦面是同一块屋顶，整块 dirty 才重建。
  // cells：同一条屋脊上的格子（[ix, iz][]），alongX = 屋脊沿 X。
  const addEaveBands = (cells, iy, alongX) => {
    if (!cells.length) return;
    const baseY = (iy + 1) * ch;
    const fasciaMat = materials.fascia ?? materials.crenel ?? materials.stone ?? trimMat;
    const bargeMat = materials.bargeboard ?? materials.roofTile ?? trimMat;
    // 沿脊向的世界坐标区间：首尾格中心各外扩半个 EAVE_SPAN（= 坡面半长 0.54cs）
    const along = cells.map(([ix, iz]) => (alongX ? cx(ix) : cz(iz)));
    const cross = alongX ? cz(cells[0][1]) : cx(cells[0][0]);
    const a0 = Math.min(...along) - EAVE_SPAN / 2;
    const a1 = Math.max(...along) + EAVE_SPAN / 2;
    const mid = (a0 + a1) / 2;
    const spanLen = a1 - a0;
    for (const sign of [-1, 1]) {
      const off = sign * EAVE_HALF_W;
      const fascia = mesh(
        eaveRunGeometry(spanLen, EAVE_FASCIA_H, EAVE_OVERHANG * 2),
        fasciaMat,
        "town-roof-fascia",
        0.01
      );
      const barge = mesh(
        eaveRunGeometry(spanLen, EAVE_BARGE_H, EAVE_OVERHANG * 2.1),
        bargeMat,
        "town-roof-bargeboard",
        0.008
      );
      if (alongX) {
        fascia.position.set(mid, baseY - EAVE_FASCIA_H / 2, cross + off);
        barge.position.set(mid, baseY - EAVE_FASCIA_H - EAVE_BARGE_H / 2, cross + off);
      } else {
        fascia.rotation.y = Math.PI / 2;
        barge.rotation.y = Math.PI / 2;
        fascia.position.set(cross + off, baseY - EAVE_FASCIA_H / 2, mid);
        barge.position.set(cross + off, baseY - EAVE_FASCIA_H - EAVE_BARGE_H / 2, mid);
      }
      levelGroups[iy].add(fascia);
      levelGroups[iy].add(barge);
    }
    stats.eaveCount = (stats.eaveCount ?? 0) + 1;
  };

  // 在坡屋顶 cell 上加烟囱：位置偏屋脊一侧坡面，颜色随该户墙色
  const addChimney = (ix, iy, iz, alongX) => {
    const chChar = at(ix, iy, iz);
    const wallMat = materials[chChar] ?? materials.W ?? trimMat;
    const chimney = mesh(chimneyGeometry, wallMat, "town-roof-chimney", 0.012);
    chimney.position.set(
      cx(ix) + (alongX ? 0 : cs * 0.18),
      (iy + 1) * ch + ch * 0.6,
      cz(iz) + (alongX ? cs * 0.18 : 0)
    );
    levelGroups[iy].add(chimney);
    registerModule("decor", ix, iy, iz, "chimney", chimney);
    const cap = mesh(chimneyCapGeometry, materials.ink ?? trimMat, "town-roof-chimney-cap", 0.006);
    cap.position.copy(chimney.position);
    cap.position.y += ch * 0.28;
    levelGroups[iy].add(cap);
    stats.chimneyCount = (stats.chimneyCount ?? 0) + 1;
  };

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
    for (const house of housesOf()) {
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

    const routed = [];
    for (const comp of components) {
      const parts = partitionRoofComponent(comp.cells, comp.iy, wfcOracle);
      for (const cells of parts.slopedGroups) {
        routed.push({
          iy: comp.iy,
          cells,
          keys: cells.map(([x, z]) => `${x},${comp.iy},${z}`),
        });
      }
      for (const cells of parts.flatGroups) {
        routed.push({
          iy: comp.iy,
          cells,
          keys: cells.map(([x, z]) => `${x},${comp.iy},${z}`),
          forcePlaza: true,
        });
      }
    }

    for (const comp of routed) {
      if (cornerBody) break;
      const { iy } = comp;
      if (comp.forcePlaza) {
        if (!ownSpanning(comp.keys)) continue;
        roofPlazas.push(comp);
        continue;
      }
      const shape = classifyRoofComponent(comp.cells);
      const cellSet = new Set(comp.keys);
      // 屋顶归整个连通分量：形状由 classifyRoofComponent(comp.cells) 定，
      // 改一格就会改变整块屋顶，所以任一格 dirty 都得整块重建。
      // 屋顶按连通分量整块重建：形状由 classifyRoofComponent(comp.cells) 定，
      // 少一格就可能整体改形。不 dirty 就整块不动，dirty 就整块重来。
      if (!ownSpanning(comp.keys)) continue;

      if (shape.kind === "single") {
        const [ix, iz] = comp.cells[0];
        const key = `${ix},${iy},${iz}`;
        const floors = columnHeight.get(`${ix},${iz}`) ?? 1;
        if (!want(ix, iy, iz)) { roofCells.add(key); continue; }
        // 矮户：宽扁四坡（房子，不是帐篷锥）；高柱才拉尖
        const spire = mesh(spireGeometry.clone(), roofMaterialFor(ix, iz, iy), "town-spire", 0.035);
        applyVerticalVertexColors(spire.geometry, 1.28, 0.62);
        if (floors <= 2) {
          spire.scale.set(1.18, 0.68, 1.18);
          spire.position.set(cx(ix), (iy + 1) * ch + ch * 0.16, cz(iz));
        } else {
          spire.scale.set(1, 1 + Math.max(0, floors - 3) * 0.45, 1);
          spire.position.set(cx(ix), (iy + 1) * ch + ch * 0.27, cz(iz));
        }
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
        const cone = mesh(steepleConeGeometry.clone(), roofMaterialFor(anchor[0], anchor[1], iy), "town-steeple-cone", 0.035);
        applyVerticalVertexColors(cone.geometry, 1.28, 0.62);
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
        if (want(anchor[0], iy, anchor[1])) {
          levelGroups[iy].add(towerGroup);
          stats.steepleCount++;
        }
        roofCells.add(`${anchor[0]},${iy},${anchor[1]}`);

        // 臂上格子出人字坡（沿臂轴向：4 邻分量方向取主轴）
        let chimneyCell = null;
        let chimneyDist = 0;
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
          const armDist = Math.abs(ix - anchor[0]) + Math.abs(iz - anchor[1]);
          if (armDist > chimneyDist) {
            chimneyDist = armDist;
            chimneyCell = [ix, iz, alongX];
          }
          roofCells.add(key);
          if (want(ix, iy, iz)) {
            const roof = mesh((alongX ? gableX : gableZ).clone(), roofMaterialFor(ix, iz, iy), "town-roof", 0.04);
            applyVerticalVertexColors(roof.geometry, 1.26, 0.64);
            roof.position.set(cx(ix), (iy + 1) * ch, cz(iz));
            levelGroups[iy].add(roof);
            stats.roofCount++;
            addEaveBands([[ix, iz]], iy, alongX); // C13-4 檐口三层色带（臂上逐格，轴向可能各不相同）
            {
              const ridge = mesh(
                ridgeGeometry,
                materials.bargeboard ?? (colorful || !leanDecor ? trimMat : materials.roofTile ?? trimMat),
                "town-roof-ridge",
                0.014
              );
              ridge.position.set(cx(ix), (iy + 1) * ch + ch * 0.52, cz(iz));
              if (!alongX) ridge.rotation.y = Math.PI / 2;
              levelGroups[iy].add(ridge);
              stats.ridgeCount = (stats.ridgeCount ?? 0) + 1;
            }
          }
        }
        // L/十字坡屋顶：离尖塔最远的臂端出一根烟囱
        if (chimneyCell && want(chimneyCell[0], iy, chimneyCell[1])) addChimney(chimneyCell[0], iy, chimneyCell[1], chimneyCell[2]);
        continue;
      }

      if (shape.kind === "strip") {
        for (const [ix, iz] of comp.cells) {
          const key = `${ix},${iy},${iz}`;
          roofCells.add(key);   // 记账不受 dirty 影响，规则 3 靠它跳过城垛
          if (!want(ix, iy, iz)) continue;
          const roof = mesh((shape.alongX ? gableX : gableZ).clone(), roofMaterialFor(ix, iz, iy), "town-roof", 0.04);
          applyVerticalVertexColors(roof.geometry, 1.26, 0.64);
          roof.position.set(cx(ix), (iy + 1) * ch, cz(iz));
          levelGroups[iy].add(roof);
          stats.roofCount++;
        }
        // C13-4 檐口三层色带：整条屋脊一根，不逐格
        addEaveBands(comp.cells.filter(([gx, gz]) => want(gx, iy, gz)), iy, shape.alongX);
        // 屋脊瓦：沿条带轴向一条深色压条（挑檐方向的两端不出）
        const alongX = shape.alongX;
        for (const [ix, iz] of comp.cells) {
          if (!want(ix, iy, iz)) continue;
          const ridge = mesh(
            ridgeGeometry,
            materials.bargeboard ?? (colorful || !leanDecor ? trimMat : materials.roofTile ?? trimMat),
            "town-roof-ridge",
            0.014
          );
          ridge.position.set(cx(ix), (iy + 1) * ch + ch * 0.52, cz(iz));
          if (!alongX) ridge.rotation.y = Math.PI / 2;
          levelGroups[iy].add(ridge);
          stats.ridgeCount = (stats.ridgeCount ?? 0) + 1;
          // 挑檐：条带两端各出一条压檐（沿轴向端头）
          const firstX = comp.cells[0][0] === ix && comp.cells[0][1] === iz;
          const lastX = comp.cells[comp.cells.length - 1][0] === ix && comp.cells[comp.cells.length - 1][1] === iz;
          if ((firstX || lastX) && !leanDecor) {
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
        // 烟囱：条带屋顶第二格上立一根（墙色随户），Townscaper 招牌剪影
        if (comp.cells.length >= 2 && want(comp.cells[1][0], iy, comp.cells[1][1])) addChimney(comp.cells[1][0], iy, comp.cells[1][1], alongX);
        // 山墙圆窗：条带两端山墙面各开一圆窗
        {
          const [sx0, sz0] = comp.cells[0];
          const [sx1, sz1] = comp.cells[comp.cells.length - 1];
          for (const [gx, gz] of [[sx0, sz0], [sx1, sz1]]) {
            if (!want(gx, iy, gz)) continue;
            // C13-2（z1.png 右下）：山墙上是**45° 菱形窗**，不是带十字棂的圆窗。
            // 山墙端的外法线：屋脊沿 X 时朝 ±Z，沿 Z 时朝 ±X。
            const gnx = alongX ? 0 : (gx === sx0 ? -1 : 1);
            const gnz = alongX ? (gz === sz0 ? -1 : 1) : 0;
            const gPos = [
              cx(gx) + gnx * (cs * 0.5 + 0.04),
              (iy + 1) * ch + ch * 0.3,
              cz(gz) + gnz * (cs * 0.5 + 0.04),
            ];
            const gYaw = Math.atan2(gnx, gnz);
            const diamondFrame = mesh(gableDiamondFrameGeometry, trimMat, "town-gable-diamond", 0.014);
            diamondFrame.position.set(gPos[0], gPos[1], gPos[2]);
            diamondFrame.rotation.y = gYaw;
            diamondFrame.rotation.z = Math.PI / 4; // 正方形转 45° = 菱形
            levelGroups[iy].add(diamondFrame);
            const diamondGlass = mesh(
              gableDiamondGlassGeometry,
              materials.windowDark || materials.ink,
              "town-gable-diamond-glass",
              0.008
            );
            diamondGlass.position.set(gPos[0] + gnx * 0.02, gPos[1], gPos[2] + gnz * 0.02);
            diamondGlass.rotation.y = gYaw;
            diamondGlass.rotation.z = Math.PI / 4;
            levelGroups[iy].add(diamondGlass);
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
          roofMaterialFor(comp.cells[0][0], comp.cells[0][1], iy),
          "town-block2x2-cone",
          0.035
        );
        applyVerticalVertexColors(cone.geometry, 1.26, 0.64);
        cone.position.set(cx(center[0]), (iy + 1) * ch + ch * 0.35, cz(center[1]));
        if (comp.cells.some(([gx, gz]) => want(gx, iy, gz))) {
          levelGroups[iy].add(cone);
          stats.steepleCount++;
        }
        // 方块本身平顶：交给规则 3 边缘围栏（openSky 判定）
        continue;
      }

      // plaza：大平顶分量，留给规则 3.5 花园/晒台判定
      roofPlazas.push(comp);
    }
    ownNone();
  }



  // ---------- 规则 3：逐格立面/屋顶构件 ----------
  // 户概念（Townscaper）：竖柱同色 = 一户，户种子决定窗密度与门面。
  const houseByColumn = new Map();
  for (const house of housesOf()) {
    houseByColumn.set(`${house.ix},${house.iz}`, house);
  }

  // ---------- 规则 3.5：花园（围合大平顶）----------
  // Townscaper 屋顶花园：大平顶分量且贴更高墙 → 铺草地 + 低栅栏 + 1~3 棵树；
  // 不贴墙的晒台保持平顶（规则 3 出城垛/围栏）。gardenCells 让规则 3 跳过城垛。
  const gardenCells = new Set();
  if (!cornerBody) {
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
      // S20⑥ 逐字：*the garden modules are super high priority, but they … can only
      // exist … where they end up next to a wall*——**花园只在贴墙（围合）时成立**。
      // 原来还有一条「不贴墙但 ≥3 格也铺草」，结果整片开阔大平台全铺成草地；
      // 而录像里（S23 sheetA 5–8s / sheet_0 15–20s）开阔平台是**石板广场 + 沿轮廓女儿墙**，
      // 草地与树只出现在被墙围起来的内院/屋顶花园里。
      // C6：WFC 开时由 townBanPolicy 的 garden 角色接管，不再二次判 hugsWall。
      if (wfcOracle.enabled) {
        if (!comp.cells.some(([x, z]) => wfcOracle.isGarden(x, iy, z) === true)) continue;
      } else if (!hugsWall) continue;
      // 花园按整个平顶分量成立/消失（少一格就可能不再围合），归属跨格；
      // gardenCells 是规则 3 的输入，必须在门外照常填（否则城垛会冒出来）。
      for (const key of comp.keys) gardenCells.add(key);
      if (!ownSpanning(comp.keys)) continue;
      for (const key of comp.keys) {
        const [x, , z] = key.split(",").map(Number);
        if (!want(x, iy, z)) continue;
        const grass = mesh(
          grassGeometry,
          materials.foliageLight ?? materials.foliageDark,
          "town-garden-grass",
          0.008
        );
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
            fenceMaterialFor(x, z, iy, (x + z + iy) & 3),
            "town-garden-fence",
            0.014
          );
          rail.position.set(ex, topY + 0.22, ez);
          levelGroups[iy].add(rail);
          registerModule("fence", x, iy, z, TOWNSCAPER_MODULE_FAMILIES.fence[3], rail);
          stats.fenceCount++;
        }
      }
      stats.gardenCount++;
      // 绿植按整片花园成立，但下面几个循环没有逐格 want() 门——增量模式下
      // 若不在这里拦一次，全城花园的树/盆栽/鸟每次编辑都会重造一份（实测每次
      // 泄漏 6,536 tris）。与 ownSpanning(comp.keys) 的归属口径保持一致。
      if (dirtySet && !comp.cells.some(([x, z]) => want(x, iy, z))) continue;
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
      // 露台盆栽：花园格再撒 1~2 盆圆树，贴近原版「到处是球树」
      if (ctx.buildTopiary) {
        const extra = 1 + (comp.cells.length % 2);
        for (let i = 0; i < extra && i < slots.length; i++) {
          const [px, pz] = slots[(i * 7919 + 17) % slots.length];
          const pot = ctx.buildTopiary(
            `town-shrub-${stats.shrubCount}`,
            0.55 + (i % 2) * 0.12,
            ctx.shrubMaterials,
            random
          );
          pot.position.set(
            cx(px) + (i % 2 ? 0.28 : -0.22),
            (iy + 1) * ch + 0.06,
            cz(pz) + (i % 2 ? -0.2 : 0.26)
          );
          levelGroups[iy].add(pot);
          stats.shrubCount++;
        }
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
    ownNone();
  }

  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    if (!want(ix, iy, iz)) continue;
    ownCell(ix, iy, iz, char);
    const isGate = char === CITADEL_GATE_CHAR;
    const module = townscaperModuleSelection(ix, iy, iz, char, 0, openMaskFor(ix, iy, iz));
    const house = houseByColumn.get(`${ix},${iz}`) ?? {
      ix, iz, seed: 0, bottom: iy, top: iy, floors: 1, hasGate: isGate,
    };

    // 暴露立面出拱窗（底层为台基不开窗；门面留给正门/户门）
    // 户窗密度：seed 决定 0.5 / 0.7 / 1.0 三档——大户疏窗、小户密窗的
    // Townscaper 式立面节奏；窗材质 windowDark（夜间切换 windowLit）。
    if (iy >= 1) {
      const winMat = materials.windowDark || materials.ink;
      const density = [0.5, 0.7, 1.0][house.seed % 3];
      // 窗的「有没有」由**柱-面**决定，与层号无关，而且**按排名取前 n 面**，
      // 不是逐面掷骰子（C13-2，证据 z1.png / z2.png）。
      //
      // 旧写法有两个毛病：
      //   ① faceDensity 里含 `street`（只在最低层为真）→ 同一面一层有窗二层没窗，
      //      立面像被虫蛀；z1 里是严整的窗格阵，一旦开窗每层都有。
      //   ② 逐面独立掷骰 → **整栋楼可能一扇窗都没有**。实测孤立 5 层塔
      //      seed=1043026656 → density 0.5，四个面的 r 分别 0.545/0.751/0.527/0.769
      //      全部 ≥0.5，于是塔身一片空白；而 z2.png 里塔身是满满一列窗。
      // 改成排名制：这根柱子恒定开 n = max(1, round(density × 暴露面数)) 个面，
      // 取 faceSeed 最小的前 n 个。密度仍然管疏密，但永远不会归零。
      // 面集只依赖 (户种子, 柱坐标, 密度)，**不看邻居的死活**。
      // 试过「按实际暴露面排名」，结果引入了一条长程依赖：删掉 (5,2,4) 会改变
      // 邻柱 (5,3) 的暴露面数 → 改变它的开窗面 → 连带改掉该柱 iy=8 的窗，
      // 而增量的 dirty 只覆盖 ±2 层，于是增量比全量少 12 tris
      // （2026-09-04 实测，`test_edit_exactness` 逐格对比抓到）。
      // 层高方向的窗仍由「这一层这一面是否临空」逐格决定，所以外观不受影响。
      if (!house.windowFaces) {
        const ranked = DIRS
          .map(([dx, dz]) => ({ dx, dz, r: ((house.seed ^ (dx * 131 + dz * 173) ^ (ix * 7 + iz * 11)) >>> 0) % 1000 }))
          .sort((a, b) => a.r - b.r);
        const n = Math.max(1, Math.round(density * DIRS.length * (leanDecor ? 0.82 : 1)));
        house.windowFaces = new Set(ranked.slice(0, n).map(({ dx, dz }) => `${dx},${dz}`));
      }
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) !== ".") continue;
        if (isGate && dz === 1) continue;
        if (!house.windowFaces.has(`${dx},${dz}`)) continue;
        const winYaw = Math.atan2(dx, dz);
        const winY = cy(iy) - ch * 0.08;
        const winX = cx(ix) + dx * (cs / 2 + 0.028);
        const winZ = cz(iz) + dz * (cs / 2 + 0.028);
        // 外框（白，外凸）→ 玻璃（中蓝，内凹）→ 十字棂（白）
        const frameMat = materials.trim ?? materials.W;
        const addWinPart = (geo, mat, name, out, tag) => {
          const part = mesh(geo, mat, name, 0.014);
          part.position.set(winX + dx * out, winY, winZ + dz * out);
          part.rotation.y = winYaw;
          part.userData.cell = { ix, iy, iz, char };
          if (tag) part.userData.citadelWindowPart = tag;
          levelGroups[iy].add(part);
          return part;
        };
        if (!leanDecor) addWinPart(winFrameGeometry, frameMat, "town-window-frame", 0.014, "frame");
        const window = mesh(
          leanDecor ? new THREE.BoxGeometry(0.38, 0.64, 0.05) : winGlassGeometry,
          winMat,
          "town-window",
          0.022
        );
        window.position.set(winX, winY, winZ);
        window.rotation.y = winYaw;
        if (!leanDecor) {
          addWinPart(winMullionVGeometry, frameMat, "town-window-mullion", 0.024, "mullion-v");
          addWinPart(winMullionHGeometry, frameMat, "town-window-mullion", 0.024, "mullion-h");
        }
        window.userData.citadelWindow = true;
        // 房屋单元 id 用格坐标；台地号在挂到 town-terrace-T 后由 refresh 补齐
        window.userData.cellIx = ix;
        window.userData.cellIz = iz;
        window.userData.cellIy = iy;
        levelGroups[iy].add(window);
        registerModule("decor", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.decor[module.decor], window);
        stats.windowCount++;
        // 装饰归属于它所装饰的那一格：增量重建按 userData.cell 回收，没有这个
        // 标签的装饰会永远留在层容器里，格删了它还在（悬空窗/窗台）。
        window.userData.cell = { ix, iy, iz, char };
        if (!leanDecor) {
          const wx = cx(ix) + dx * (cs / 2 + 0.06);
          const wz = cz(iz) + dz * (cs / 2 + 0.06);
          const sill = mesh(sillGeometry, trimMat, "town-window-sill", 0.01);
          sill.position.set(wx, cy(iy) - ch * 0.08 - 0.62, wz);
          sill.rotation.y = Math.atan2(dx, dz);
          sill.userData.cell = { ix, iy, iz, char };
          levelGroups[iy].add(sill);
          const lintel = mesh(lintelGeometry, trimMat, "town-window-lintel", 0.01);
          lintel.position.set(wx, cy(iy) - ch * 0.08 + 0.92, wz);
          lintel.rotation.y = Math.atan2(dx, dz);
          lintel.userData.cell = { ix, iy, iz, char };
          levelGroups[iy].add(lintel);
        }
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
        // Townscaper 式拱形门口：门洞与门板都做圆拱顶（矩形身 + 半圆头），
        // 不再是方门洞。
        const recess = mesh(archDoorGeometry(0.95, 1.62, 0.1), materials.ink, "town-door-recess", 0.024);
        recess.position.set(0, 0, cs / 2 + 0.02);
        doorGroup.add(recess);
        const leaf = mesh(archDoorGeometry(0.72, 1.5, 0.06), materials.wood, "town-door-leaf", 0.02);
        leaf.position.set(0, 0, cs / 2 + 0.06);
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
        // 檐口线：软融合模式用浅色细条，避免黑框铁笼
        if (!cornerBody && (iy >= 1 || isRoof(ix, iy, iz)) && !leanDecor) {
          const floorBandMaterial = module.floor === 1 || module.floor === 3
            ? roofMaterialFor(ix, iz, iy)
            : trimMatLoc;
          const cornice = mesh(corniceGeometry, floorBandMaterial, "town-cornice", 0.014);
          cornice.position.set(ex, (iy + 1) * ch - 0.09, ez);
          cornice.rotation.y = yaw;
          levelGroups[iy].add(cornice);
          registerModule("floor", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.floor[module.floor], cornice);
          stats.corniceCount = (stats.corniceCount ?? 0) + 1;
          if (module.floor === 1 || module.floor === 3) {
            const band = mesh(floorBandGeometry, floorBandMaterial, "town-floor-band", 0.009);
            band.position.set(ex, (iy + 1) * ch - 0.27, ez);
            band.rotation.y = yaw;
            levelGroups[iy].add(band);
          }
        }
        // 底层墙裙
        if (!cornerBody && iy === 0) {
          const plinth = mesh(
            plinthGeometry,
            leanDecor ? (materials.A ?? trimMatLoc) : foundationMaterialFor(ix, iz, iy, module.foundation),
            "town-plinth",
            0.016
          );
          plinth.position.set(ex, 0.24, ez);
          plinth.rotation.y = yaw;
          levelGroups[0].add(plinth);
          registerModule("foundation", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.foundation[module.foundation], plinth);
          stats.plinthCount = (stats.plinthCount ?? 0) + 1;
        }
        // 石砌横缝：软融合模式下省略（描边+缝线会把岛城画成铁笼）
        if (!cornerBody && iy >= 1 && !leanDecor) {
          const grout = mesh(
            new THREE.BoxGeometry(cs * 0.92, 0.035, 0.04),
            trimMatLoc,
            "town-grout",
            0.008
          );
          grout.position.set(ex, cy(iy), ez);
          grout.rotation.y = yaw;
          levelGroups[iy].add(grout);
        }
        // 阳台：外露面 + 上方开空（外墙）+ 户种子概率；高山城堡增加
        // 屋檐、花箱和少量彩色遮篷，形成参考图里的街道层次。
        const balconySeed = (house.seed ^ (dx * 911 + dz * 313)) >>> 0;
        const balconyChance = iy <= 2 ? 48 : 34;
        const wantsBalcony = (balconySeed % 100) < balconyChance;
        const aboveOpen = at(ix + dx, iy + 1, iz + dz) === ".";
        if (iy >= 1 && aboveOpen && wantsBalcony) {
          const balconyMaterial = balconyMaterialFor(ix, iz, iy, module.balcony);
          const railMaterial = fenceMaterialFor(ix, iz, iy, module.fence);
          const slab = mesh(balconySlabGeometry, balconyMaterial, "town-balcony", 0.014);
          slab.position.set(
            cx(ix) + dx * (cs / 2 + 0.26),
            iy * ch + 0.42,
            cz(iz) + dz * (cs / 2 + 0.26)
          );
          slab.rotation.y = yaw;
          levelGroups[iy].add(slab);
          registerModule("balcony", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.balcony[module.balcony], slab);
          for (const off of [-0.34, 0, 0.34]) {
            const post = mesh(balconyRailPostGeometry, railMaterial, "town-balcony-rail", 0.01);
            post.position.set(
              cx(ix) + dx * (cs / 2 + 0.26) + (dz !== 0 ? off : 0),
              iy * ch + 0.42 + 0.25,
              cz(iz) + dz * (cs / 2 + 0.26) + (dx !== 0 ? off : 0)
            );
            levelGroups[iy].add(post);
          }
          const bar = mesh(balconyRailBarGeometry, railMaterial, "town-balcony-rail", 0.01);
          bar.position.set(
            cx(ix) + dx * (cs / 2 + 0.26),
            iy * ch + 0.42 + 0.46,
            cz(iz) + dz * (cs / 2 + 0.26)
          );
          bar.rotation.y = yaw;
          levelGroups[iy].add(bar);
          const planter = mesh(flowerBoxGeometry, balconyMaterial, "town-balcony-flowerbox", 0.008);
          planter.position.set(
            cx(ix) + dx * (cs / 2 + 0.48),
            iy * ch + 0.77,
            cz(iz) + dz * (cs / 2 + 0.48)
          );
          planter.rotation.y = yaw;
          levelGroups[iy].add(planter);
          // 彩色花砖不是一整块绿色花箱：在花箱外侧加三块小釉砖，
          // 与 balcony pattern 共同形成 Townscaper 式彩色拼花节奏。
          for (let tileIndex = 0; tileIndex < 3; tileIndex++) {
            const tile = mesh(
              balconyTileAccentGeometry,
              balconyMaterialFor(ix, iz, iy, module.balcony + tileIndex + 1),
              "town-balcony-flower-tile",
              0.006
            );
            const off = (tileIndex - 1) * 0.15;
            tile.position.set(
              cx(ix) + dx * (cs / 2 + 0.60) + (dz !== 0 ? off : 0),
              iy * ch + 0.86,
              cz(iz) + dz * (cs / 2 + 0.60) + (dx !== 0 ? off : 0)
            );
            tile.rotation.y = yaw;
            levelGroups[iy].add(tile);
          }
          if ((balconySeed % 100) < 22) {
            const canopy = mesh(
              balconyCanopyGeometry,
              balconyMaterialFor(ix + dx, iz + dz, iy, module.balcony + 2),
              "town-balcony-canopy",
              0.012
            );
            canopy.position.set(
              cx(ix) + dx * (cs / 2 + 0.28),
              iy * ch + 1.02,
              cz(iz) + dz * (cs / 2 + 0.28)
            );
            canopy.rotation.y = yaw;
            levelGroups[iy].add(canopy);
          }
          stats.balconyCount = (stats.balconyCount ?? 0) + 1;
        }
        // 临街窗的遮阳篷：每户少量触发，使用屋顶色而非墙色，增加彩色节奏。
        if (iy >= 1 && aboveOpen) {
          const faceSeed = (house.seed ^ (dx * 131 + dz * 173) ^ (ix * 7 + iz * 11)) >>> 0;
          if ((faceSeed % 100) < (iy <= 2 ? 24 : 14)) {
            const awning = mesh(
              windowAwningGeometry,
              roofMaterialFor(ix, iz, iy),
              "town-window-awning",
              0.01
            );
            awning.position.set(
              cx(ix) + dx * (cs / 2 + 0.11),
              cy(iy) + 0.58,
              cz(iz) + dz * (cs / 2 + 0.11)
            );
            awning.rotation.y = yaw;
            levelGroups[iy].add(awning);
          }
        }
      }
      // 转角壁柱：两相邻方向同时开敞（角格）
      const openDirs = [];
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz + dz) === ".") openDirs.push([dx, dz]);
      }
      if (openDirs.length >= 2 && !leanDecor) {
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
    if (!cornerBody && isRoof(ix, iy, iz)) {
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
              const post = mesh(
                fencePostGeometry,
                fenceMaterialFor(ix, iz, iy, module.fence),
                "town-fence",
                0.018
              );
              post.position.set(
                ex + (dz !== 0 ? offset : 0),
                topY + 0.25,
                ez + (dx !== 0 ? offset : 0)
              );
              levelGroups[iy].add(post);
            }
            const rail = mesh(
              dz !== 0 ? fenceRailXGeometry : fenceRailZGeometry,
              fenceMaterialFor(ix, iz, iy, module.fence),
              "town-fence",
              0.018
            );
            rail.position.set(ex, topY + 0.46, ez);
            levelGroups[iy].add(rail);
            registerModule("fence", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.fence[module.fence], rail);
            stats.fenceCount++;
            continue;
          }
          // 城垛：高处檐口或贴着更高墙体的墙脚
          for (const offset of [-cs * 0.26, cs * 0.26]) {
            const merlon = mesh(
              new THREE.BoxGeometry(0.42, 0.52, 0.42),
              materials.crenel ?? materials.roofTile ?? materials[char] ?? materials.W,
              "town-crenel",
              0.025
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
        registerModule("hole", ix, iy, iz, TOWNSCAPER_MODULE_FAMILIES.hole[module.hole], arch);
        stats.archCount++;
      }
    }

    // 正门：深色门洞 + 棕色双开门 + 木门廊（朝 +z 前排）
    if (isGate) {
      const gate = new THREE.Group();
      gate.name = "town-gate";
      // 正门也是圆拱门洞（与户门同一条拱形几何管线）
      const recess = mesh(archDoorGeometry(1.5, 1.9, 0.12), materials.ink, "town-gate-recess", 0.03);
      recess.position.set(0, 0, cs / 2 + 0.02);
      gate.add(recess);
      for (const sx of [-0.36, 0.36]) {
        const door = mesh(archDoorGeometry(0.68, 1.7, 0.08), materials.wood, "town-gate-door", 0.025);
        door.position.set(sx, 0, cs / 2 + 0.07);
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
  // 出循环即撤销归属：后续规则块若未自己声明，宁可留成「无主」被审计抓到，
  // 也不能沿用最后一格的陈旧值被静默错标（实测防波堤曾因此归错格）。
  ownNone();

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
      // 连拱段是一个跨格构件：整段的成立与否由「悬空 run + 两端支撑」决定，
      // 少一格就不是这条廊。归属给整段，重建也按整段（cells.some(want)）——
      // 与摘旧网格的 cells.some(dirty) 同口径，否则会摘掉一段只补回一格。
        const runCellsX = [];
        for (let r = 0; r < runX; r++) {
          visitedArcade.add(`${ix + r},${iy},${iz}`);
          runCellsX.push(`${ix + r},${iy},${iz}`);
        }
        if (!ownSpanning(runCellsX)) { continue; }
        for (let r = 0; r < runX; r++) {
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
        ownNone();
        continue;
      }
      // 沿 +z 扫描
      let runZ = 1;
      while (at(ix, iy, iz + runZ) !== "." && at(ix, iy - 1, iz + runZ) === ".") runZ++;
      const supportZDown = at(ix, iy, iz - 1) !== ".";
      const supportZUp = at(ix, iy, iz + runZ) !== ".";
      if (runZ >= 2 && supportZDown && supportZUp) {
      // 连拱段是一个跨格构件：整段的成立与否由「悬空 run + 两端支撑」决定，
      // 少一格就不是这条廊。归属给整段，重建也按整段（cells.some(want)）——
      // 与摘旧网格的 cells.some(dirty) 同口径，否则会摘掉一段只补回一格。
        const runCellsZ = [];
        for (let r = 0; r < runZ; r++) {
          visitedArcade.add(`${ix},${iy},${iz + r}`);
          runCellsZ.push(`${ix},${iy},${iz + r}`);
        }
        // 这里原本连 want() 门都没有：增量模式每次编辑都会把全城 z 向连拱
        // 重新发射一份（重影来源之一，2026-09-04）。
        if (!ownSpanning(runCellsZ)) { continue; }
        for (let r = 0; r < runZ; r++) {
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
        ownNone();
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
      if (leanDecor) break; // 水上城堡坐在真水面上，不再叠一层假水道
      const [ix, iz] = key.split(",").map(Number);
      if (ix < 0 || ix >= cols || iz < 0 || iz >= rows) continue; // 格外水源不算
      const enclosedX = at(ix - 1, 0, iz) !== "." && at(ix + 1, 0, iz) !== ".";
      const enclosedZ = at(ix, 0, iz - 1) !== "." && at(ix, 0, iz + 1) !== ".";
      if (!enclosedX && !enclosedZ) continue;
      // 水道格与水门都由「两侧夹住它的实心格」决定：任一侧被删/加，这段水
      // 道就不再成立。归属给空格自身 + 四邻实心格（与 plaza 同一套口径）。
      if (!ownSpanning([
        `${ix},0,${iz}`,
        ...DIRS.map(([dx, dz]) => [ix + dx, iz + dz])
          .filter(([x, z]) => at(x, 0, z) !== ".")
          .map(([x, z]) => `${x},0,${z}`),
      ])) continue;
      const water = mesh(waterGeometry, materials.water, "town-canal-water", 0.02);
      water.castShadow = false;
      water.position.set(cx(ix), 0.34, cz(iz));
      if (want(ix, 0, iz)) {
        levelGroups[0].add(water);
        stats.canalCount++;
      }
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
        const gateModule = townscaperModuleSelection(ix, 0, iz, at(ix + dx, 0, iz + dz), 4);
        registerModule("hole", ix, 0, iz, TOWNSCAPER_MODULE_FAMILIES.hole[3], waterGate);
        waterGate.userData.townModule.variant = TOWNSCAPER_MODULE_FAMILIES.hole[gateModule.hole];
        stats.waterGateCount++;
      }
      ownNone();
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
        // 广场铺在**空格**上，它的存在由四周的实心格决定：任一围合格被删/加，
        // 这块石板就该重来。所以归属是「空格自身 + 全部围合格」的跨格集合，
        // 与摘旧网格的 cells.some(dirty) 判据同口径。
        // （2026-09-04：此前整块无主，orphan 普查看不见——因为无主面在合并时
        //   不进 faceToCell，census 只数进了表的段。）
        if (!ownSpanning([
          `${ix},0,${iz}`,
          ...DIRS.map(([dx, dz]) => [ix + dx, iz + dz])
            .filter(([x, z]) => at(x, 0, z) !== ".")
            .map(([x, z]) => `${x},0,${z}`),
        ])) continue;
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
        ownNone();
        stats.plazaCount++;
      }
    }
  }

  // ---------- 规则 4.55：庭院二次坍缩（Townscaper courtyard pass） ----------
  // 第一轮体块已经决定“墙在哪里”；这里把墙内仍然开敞的空域当作一张
  // 小型 2D WFC 结果，生成不同于屋顶花园的内院模块。底层内院复用规则
  // 4.5 的石板地面，避免 z-fighting；高层内院补一块真正的悬空平台。
  // 水道是外部环境，不参与内院生成。
  {
    const courtyardRegions = collectCitadelCourtyardRegions(grid, cols, rows, levels.length);
    const seenWalls = new Set();
    const courtyardSurfaceMaterial = materials.plazaStone ?? materials.weatherStone ?? trimMat;
    const courtyardWallMaterial = materials.trim ?? materials.iron ?? trimMat;
    for (const region of courtyardRegions) {
      if (region.terraceFloor === 0 && region.cells.some(([x, z]) => waterReached.has(`${x},${z}`))) continue;
      const { terraceFloor: iy, cells } = region;
      const floorY = iy === 0 ? 0.05 : iy * ch + 0.05;
      // 内院的台面/矮墙/水井/水面都由整片围合决定：少一格围合，这个内院就不
      // 成立。归属统一给 region.cells，与摘旧网格的 cells.some(dirty) 同口径。
      // （2026-09-04：此前 241 个内院构件整体无主，orphan 普查漏报——无主面
      //   不进 faceToCell，合并后就从 census 里消失了。）
      //
      // **围合墙也要进格集**：region.cells 全是**空格**，而编辑发生在实心格上。
      // 只登记空格的话，玩家拆掉围墙时这段内院永远不会被判 dirty，就一直挂在
      // 那儿（2026-09-04 parity 测试里 65 个「登记了却摘不到」的键就是它）。
      const courtyardKeys = new Set(cells.map(([x, z]) => `${x},${iy},${z}`));
      for (const [x, z] of cells) {
        for (const [dx, dz] of DIRS) {
          if (at(x + dx, iy, z + dz) !== ".") courtyardKeys.add(`${x + dx},${iy},${z + dz}`);
        }
      }
      if (!ownSpanning([...courtyardKeys])) continue;
      // 底层围合空格已经由 plaza 规则铺好；上层才需要新铺庭院台面。
      if (iy > 0) {
        for (const [x, z] of cells) {
          if (!want(x, iy, z)) continue;
          const surface = mesh(
            new THREE.BoxGeometry(cs * 0.93, 0.08, cs * 0.93),
            courtyardSurfaceMaterial,
            "town-courtyard-surface",
            0.012
          );
          surface.position.set(cx(x), floorY, cz(z));
          levelGroups[iy - 1].add(surface);
          registerModule("decor", x, iy, z, "courtyard-surface", surface);
        }
      }

      // 只在每个围合边缘生成一次低墙，避免相邻内院格重复叠边。
      for (const [x, z] of cells) {
        for (const [dx, dz] of DIRS) {
          if (at(x + dx, iy, z + dz) === ".") continue;
          const wallKey = `${iy}:${Math.min(x, x + dx)},${Math.min(z, z + dz)}:${dx},${dz}`;
          if (seenWalls.has(wallKey)) continue;
          seenWalls.add(wallKey);
          if (!want(x, iy, z) && !want(x + dx, iy, z + dz)) continue;
          const wall = mesh(
            courtyardWallGeometry,
            courtyardWallMaterial,
            "town-courtyard-wall",
            0.012
          );
          wall.position.set(
            cx(x) + dx * cs * 0.5,
            floorY + 0.17,
            cz(z) + dz * cs * 0.5
          );
          wall.rotation.y = dx !== 0 ? Math.PI / 2 : 0;
          levelGroups[Math.max(0, iy - 1)].add(wall);
          registerModule("decor", x, iy, z, "courtyard-wall", wall);
          stats.courtyardWallCount++;
        }
      }

      const [centerX, centerZ] = cells[Math.floor(cells.length / 2)];
      if (want(centerX, iy, centerZ)) {
        const basin = mesh(
          courtyardBasinGeometry,
          courtyardSurfaceMaterial,
          "town-courtyard-well",
          0.014
        );
        basin.position.set(cx(centerX), floorY + 0.09, cz(centerZ));
        levelGroups[Math.max(0, iy - 1)].add(basin);
        registerModule("decor", centerX, iy, centerZ, "courtyard-well", basin);
        const basinWater = mesh(
          courtyardWaterGeometry,
          materials.water ?? materials.roofTile ?? trimMat,
          "town-courtyard-water",
          0.006
        );
        basinWater.position.set(cx(centerX), floorY + 0.165, cz(centerZ));
        levelGroups[Math.max(0, iy - 1)].add(basinWater);
        registerModule("decor", centerX, iy, centerZ, "courtyard-water", basinWater);
        stats.courtyardWellCount++;
      }

      // 大于一格的内院才放树，留出单格天井的呼吸感；树落在内院台面而非空中。
      // 与 ownSpanning(cells) 同口径拦一次：树没有逐格 want() 门，
      // 增量模式下不拦就会每次编辑重造全城内院树。
      if (cells.length >= 3 && ctx.buildTopiary
        && !(dirtySet && !cells.some(([x, z]) => want(x, iy, z)))) {
        const [treeX, treeZ] = cells[(cells.length * 7919 + iy) % cells.length];
        // 内院成立与否由整片围合决定，树跟着整个内院生灭
        ownSpanning(cells.map(([x, z]) => `${x},${iy},${z}`));
        const tree = ctx.buildTopiary(
          `town-courtyard-tree-${stats.shrubCount}`,
          0.62,
          ctx.shrubMaterials,
          random
        );
        tree.position.set(cx(treeX), floorY + 0.06, cz(treeZ));
        levelGroups[Math.max(0, iy - 1)].add(tree);
        ownNone();
        stats.shrubCount++;
      }
      ownNone();
      stats.courtyardCount++;
      stats.courtyardCellCount += cells.length;
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
      if (!want(ix, 0, iz)) continue;
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
          materials.roofTile ?? materials.wood
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
  // 从下方承重面（下一非空块的顶面 / 基座顶）到悬空块底面。
  // 与规则 1（拱）互补：悬空但有侧向支撑 → 拱；完全悬空 → 支架。
  //
  // C13-6（PLAN §10.6，证据 docs/z2.png）：形从「八面体四边桁架」改成 Oskar 的
  // **双扁方管**——两根扁方管竖柱贴着承重侧、顶部一道水平横梁托住体块底面、
  // 悬空高度 > 2 层时中段加一道 λ 斜撑。
  //
  // **不改的是构造式**（§4 N3）：支架仍然是「按下方承重面直接算出来」的，
  // 不进 WFC 域、不做可满足性搜索，所以永远不会出现「该有支架却没有」的静默失败。
  // 因此两根柱脚必须落在 (ix,iz) 这一格的承重投影里——这就是柱轴离格心只取
  // 0.30cs（= 距墙面 0.20cs）而不是真的悬在墙外 0.3 格的原因：再往外挪，
  // 柱脚就踩空了，「必然连通」当场失效。z2 里的塔是圆的所以管子看着在轮廓外，
  // 我们的格是方的，贴着立面就是能做到的最像。
  {
    const supportMat = materials.iron ?? materials.ink ?? materials.trim;
    let supportCount = 0;
    // 扁方管截面 0.10（切向宽）× 0.05（径向厚），长边朝外
    const TUBE_W = 0.10;
    const TUBE_T = 0.05;
    const COL_OFFSET = cs * 0.30; // 柱轴离格心（承重侧方向）
    const COL_HALF_SPAN = cs * 0.31; // 两柱间距 0.62cs 的一半
    const BEAM_H = 0.09;
    const _supportGeoCache = new Map();
    const barGeometry = (w, h, d) => {
      const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}`;
      let geo = _supportGeoCache.get(key);
      if (!geo) { geo = new THREE.BoxGeometry(w, h, d); _supportGeoCache.set(key, geo); }
      return geo;
    };
    // 局部坐标系：+X = 朝承重侧（外），+Z = 切向，y = 世界 y（组不平移 y）
    const addBar = (parent, part, w, h, d, x, y, z, tiltZ = 0) => {
      const bar = mesh(barGeometry(w, h, d), supportMat, "town-support-edge", 0.008);
      bar.position.set(x, y, z);
      if (tiltZ) bar.rotation.x = tiltZ;
      bar.userData.supportPart = part;
      parent.add(bar);
      return bar;
    };

    for (const [key, char] of grid) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (!want(ix, iy, iz)) continue;
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

      // 承重侧：优先同层实体邻居（体块就是从那儿挑出来的），否则下一层邻居；
      // 都没有就按格坐标定一个稳定方向（禁止 Math.random）。
      let bearing = null;
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, iy, iz) !== ".") { bearing = [dx, dz]; break; }
      }
      if (!bearing) {
        for (const [dx, dz] of DIRS) {
          if (at(ix + dx, iy - 1, iz) !== ".") { bearing = [dx, dz]; break; }
        }
      }
      if (!bearing) bearing = DIRS[(ix * 3 + iz * 5 + iy) & 3];

      const supportModule = townscaperModuleSelection(
        ix,
        iy,
        iz,
        char,
        supportTop,
        openMaskFor(ix, iy, iz)
      );

      const yBot = supportTop * ch;
      const yTop = iy * ch;
      const h = yTop - yBot;

      const support = new THREE.Group();
      support.name = "town-support-pillar";
      support.userData.supportShape = "twin-flat-tube";
      support.userData.townModule = {
        family: "support",
        variant: TOWNSCAPER_MODULE_FAMILIES.support[supportModule.support],
        ix,
        iy,
        iz,
        catalogSize: TOWNSCAPER_MODULE_VARIANTS,
      };

      // ① 两根扁方管竖柱：柱顶顶到横梁底、柱脚落在承重面
      const colH = h - BEAM_H;
      for (const sign of [-1, 1]) {
        addBar(support, "column", TUBE_T, colH, TUBE_W, COL_OFFSET, yBot + colH / 2, sign * COL_HALF_SPAN);
      }
      // ② 顶部水平横梁：连两柱 + 托住体块底面
      addBar(support, "beam", TUBE_T, BEAM_H, COL_HALF_SPAN * 2 + TUBE_W, COL_OFFSET, yTop - BEAM_H / 2, 0);
      // ③ λ 斜撑（悬空 > 2 层）：两根斜杆自两柱下段升到中轴同一点
      if (pillarH > 2) {
        const yFoot = yBot + colH * 0.30;
        const yApex = yBot + colH * 0.60;
        const dz = COL_HALF_SPAN;
        const dy = yApex - yFoot;
        const len = Math.hypot(dz, dy);
        for (const sign of [-1, 1]) {
          // 竖杆绕 X 轴倾斜到 (0, dy, -sign*dz) 方向：长度沿自身 Y
          const brace = addBar(
            support,
            "brace",
            TUBE_T,
            len,
            TUBE_W * 0.8,
            COL_OFFSET,
            (yFoot + yApex) / 2,
            (sign * dz) / 2,
            // 杆自身长轴是局部 +Y；绕 X 转 θ 后指向 (0, cosθ, sinθ)。
            // 要从柱脚 z=sign*dz 指到中轴顶点 z=0，方向是 (0, dy, −sign*dz)/len。
            -sign * Math.atan2(dz, dy)
          );
          brace.userData.supportPart = "brace";
        }
      }

      support.position.set(cx(ix), 0, cz(iz));
      support.rotation.y = Math.atan2(-bearing[1], bearing[0]);
      // 归属必须落到杆件网格自身：增量重建摘旧网格只看 o.isMesh，
      // 只标 Group 的话杆件永远摘不掉，格删了支架还悬在半空。
      support.traverse((o) => {
        if (o.isMesh) o.userData.cell = { ix, iy, iz, char };
      });
      levelGroups[iy].add(support);
      supportCount++;
      registerModule(
        "support",
        ix,
        iy,
        iz,
        TOWNSCAPER_MODULE_FAMILIES.support[supportModule.support],
        support
      );
    }
    if (supportCount > 0) stats.supportCount = supportCount;
  }

  // ---------- 规则 7：晾衣绳（Townscaper Italian wires）----------
  {
    const houses = housesOf();
    const tall = houses.filter((h) => h.floors >= 3);
    const used = new Set();
    let wires = 0;
    const clothColors = [0xf2f4f4, 0xd5dbdb, 0xe8f8f5, 0xfcf3cf, 0xd5dbdb];
    for (let i = 0; i < tall.length && wires < 5; i++) {
      for (let j = i + 1; j < tall.length && wires < 5; j++) {
        const a = tall[i];
        const b = tall[j];
        const gap = Math.abs(a.ix - b.ix) + Math.abs(a.iz - b.iz);
        if (gap < 2 || gap > 4) continue;
        if (Math.abs(a.top - b.top) > 1) continue;
        const pair = `${Math.min(a.ix, b.ix)},${Math.min(a.iz, b.iz)}-${Math.max(a.ix, b.ix)},${Math.max(a.iz, b.iz)}`;
        if (used.has(pair)) continue;
        const midX = (a.ix + b.ix) / 2;
        const midZ = (a.iz + b.iz) / 2;
        const iy = Math.min(a.top, b.top);
        if (at(Math.round(midX), iy, Math.round(midZ)) !== ".") continue;
        used.add(pair);
        wires++; // 预算与 dirty 无关：选哪 5 对必须只由布局决定
        // 只有「发不发」受 dirty 影响。此前把 want() 门放在选对之前，增量模式
        // 会跳过非 dirty 的对、让后面的对补进 5 根的预算 —— 于是增量选出的 5 根
        // 和全量选出的 5 根不是同一组，旧的没摘、新的又挂（2026-09-04 实测 +500 tris）。
        const wireIy = Math.min(a.top, b.top);
        if (!ownSpanning([`${a.ix},${wireIy},${a.iz}`, `${b.ix},${wireIy},${b.iz}`])) continue;
        const p0 = new THREE.Vector3(cx(a.ix), (iy + 0.82) * ch, cz(a.iz));
        const p2 = new THREE.Vector3(cx(b.ix), (iy + 0.82) * ch, cz(b.iz));
        const p1 = p0.clone().lerp(p2, 0.5);
        p1.y -= 0.28;
        const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 8, 0.018, 4, false),
          materials.ink
        );
        tube.name = "town-clothesline";
        levelGroups[iy].add(tube);
        for (let k = 0; k < 3; k++) {
          const u = 0.25 + k * 0.22;
          const pt = curve.getPoint(u);
          const cloth = mesh(
            new THREE.BoxGeometry(0.22, 0.28, 0.04),
            materials[CITADEL_PALETTE[k + 3]?.char] ?? materials.wood,
            "town-cloth",
            0.006
          );
          cloth.material = cloth.material.clone();
          cloth.material.color.setHex(clothColors[k % clothColors.length]);
          cloth.position.copy(pt);
          cloth.position.y -= 0.16;
          levelGroups[iy].add(cloth);
        }
      }
    }
    ownNone();
    stats.clotheslineCount = wires;
  }

  // ---------- 规则 6：临水防波堤（Townscaper 岸石裙）----------
  // 底层外露格贴空格（运河/海）→ 厚石阶下切水面；整岛再垫一层石基，
  // 岸线连成一圈，像原版岛城的砌石裙。
  {
    const skirtMat = materials.weatherStone ?? materials.plazaStone ?? materials.A ?? trimMat;
    const skirtGeo = new THREE.BoxGeometry(cs * 1.08, 1.15, 0.5);
    const plinthGeo = new THREE.BoxGeometry(cs * 1.14, 0.85, cs * 1.14);
    let skirtCount = 0;
    for (const [key, char] of grid) {
      const [ix, iy, iz] = key.split(",").map(Number);
      if (!want(ix, iy, iz)) continue;
      if (iy !== 0) continue;
      ownCell(ix, iy, iz, char);
      const base = mesh(plinthGeo, skirtMat, "town-seawall-plinth", 0.02);
      base.position.set(cx(ix), -0.52, cz(iz));
      levelGroups[0].add(base);
      for (const [dx, dz] of DIRS) {
        if (at(ix + dx, 0, iz + dz) !== ".") continue;
        const skirt = mesh(skirtGeo, skirtMat, "town-seawall", 0.018);
        skirt.position.set(
          cx(ix) + dx * (cs / 2 + 0.2),
          -0.58,
          cz(iz) + dz * (cs / 2 + 0.2)
        );
        skirt.rotation.y = Math.atan2(dx, dz);
        levelGroups[0].add(skirt);
        skirtCount++;
      }
    }
    ownNone();
    stats.seawallCount = skirtCount;
  }

  stats.gridSize = { cols, rows, levels: levels.length };
  if (!skipDecor) {
    decorateTown({
      grid,
      at,
      want,
      own: { cell: ownCell, spanning: ownSpanning, none: ownNone },
      levelGroups,
      ctx,
      materials,
      mesh,
      stats,
      cs,
      ch,
      cx,
      cy,
      cz,
      skipDecor,
    });
  }
  // 归属拦截只在本次装配内有效：增量重建第 3 步会往这些层组挂新网格，
  // 那时 _ownerCell 已是陈旧值，必须还原原生 add。
  ownNone();
  for (const group of levelGroups) group.userData.restoreAdd?.();

  return { levels: levelGroups, stats };
}
