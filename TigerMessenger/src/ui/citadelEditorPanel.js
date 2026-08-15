// =====================================================================
//  高山圣城 · Townscaper 搭建面板（游戏内）
//  - 已开局时用鼠标点选圣城弹出（main.js 接线）
//  - 标题栏可拖拽（位置记忆）· 可收起成一条标题 · 可关闭
//  - 分层 2D 平面图点格编辑，onApply 回调驱动场景 3D 即时重建
//  - 场景 3D 直编辑：点块顶面叠块 / 侧面改色 / 空地加块 / 右键删块
//    （由 citadelSceneEdit.js 通过 applySceneEdit / cellCenter 接入）
//  - 隐藏更高层（H）· 导出 / 导入 ASCII 布局
//  - 编辑即时预览 3D；「保存台地配置」/「保存全部」（Ctrl+S）才写 localStorage
//    （城堡 CITADEL_LEVELS_KEY · 台地/护城河 CITADEL_TERRAIN_KEY · 地貌对象），
//    有未保存改动时两个保存按钮都带 ● 标记
// =====================================================================
import {
  CITADEL_TOWN_SPEC,
  CITADEL_LEVELS_KEY,
  CITADEL_TERRACE_COUNT,
  CITADEL_CASTLE_FLOORS,
  CITADEL_GRID_SIZE,
  normalizeCitadelTerraceLayout,
  levelsToGrid,
  gridToLevels,
  setCell,
  clearCell,
  resolveCitadelDropTarget,
  citadelGridCellCenter,
  citadelLevelsKey,
} from "../world/citadelTown.js";
import {
  CITADEL,
  CITADEL_TERRAIN_KEY,
  CITADEL_TERRAIN_OBJECTS_KEY,
  CITADEL_MIN_TERRACE_HEIGHT,
  normalizeCitadelTerrain,
  citadelTerraceMetrics,
  normalizeCitadelTerrainObjects,
  citadelTerrainPointSupported,
  isCitadelCascadeEnabled,
  isCitadelCascadePoolsEnabled,
  citadelTerrainKey,
  citadelTerrainObjectsKey,
} from "../world/odysseyCitadel.js";
import { CITADEL_CASCADE_MARKER } from "../world/citadelRange.js";
import { CANAL_WATER_LIFT } from "../world/canalSystem.js";
import { makePanelDraggable } from "./dragPanel.js";

const MAX_COORD = CITADEL_GRID_SIZE - 1;
const DEFAULT_GRID_PX = 12;
const POS_KEY = "tm.citadelEditor.pos";
const COLLAPSE_KEY = "tm.citadelEditor.collapsed";
const DROP_KEY = "tm.citadelEditor.dropToGround";
const PANEL_CHARS = {
  0: "#e8e4da", 1: "#e9ddc0", 2: "#d8c08a", 3: "#d4b450", 4: "#c67a3f",
  5: "#a8543c", 6: "#b06a4a", 7: "#8a5a3a", 8: "#6a4a33", 9: "#7c8a93",
  A: "#5f6b73", B: "#5a7d9e", C: "#3e5368", D: "#4d8f84", E: "#4f7755",
  G: "#8b5a2b",
};
const CHAR_NAMES = {
  0: "白", 1: "米白", 2: "沙黄", 3: "柠黄", 4: "橙", 5: "砖红", 6: "陶土",
  7: "褐", 8: "深褐", 9: "蓝灰", A: "石板灰", B: "蓝", C: "藏青", D: "青",
  E: "松绿", G: "正门",
};
const PALETTE_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "G"];
const CELL = CITADEL_TOWN_SPEC.cellSize;
const CELL_H = CITADEL_TOWN_SPEC.cellHeight;

/** Human-readable name for a terrain-object type. */
export function objectTypeName(type) {
  return type === "watchtower" ? "瞭望塔"
    : type === "trojanHorse" ? "特洛伊木马"
    : type === "cascade" ? "层叠瀑布"
    : "参天树";
}

/** Immutable removal helper shared by map/3D right-click paths and tests. */
export function removeCitadelTerrainObjectPlacement(objects, id) {
  const source = Array.isArray(objects) ? objects : [];
  const index = source.findIndex((object) => object?.id === id);
  if (index < 0) return { objects: source, removed: null };
  return {
    objects: [...source.slice(0, index), ...source.slice(index + 1)],
    removed: source[index],
  };
}

/**
 * @param {object} opts
 * @param {(levels: string[][], stats?: object) => void} opts.onApply 布局变更回调
 * @param {(activeTerrace: number, activeLayer: number, hideAbove: boolean) => void} [opts.onLayerVisibility]
 *        当前层 / 隐藏高层变化（开关面板时也会回调，关闭时强制全部可见）
 * @param {(action: "center"|"orbitL"|"orbitR"|"top") => void} [opts.onViewAction]
 *        视角行按钮：居中 / 绕圣城 90° / 到顶
 * @param {(contour: object) => void} [opts.onTerrainChange] 台地参数变更（地形地貌编辑器）
 * @param {(objects: object[]) => void} [opts.onTerrainObjectsChange] 瞭望塔/参天树变更
 * @param {(ix: number, iz: number, terraceIndex: number) => number} [opts.getSupportLevel]
 *        土坡支撑探测：返回该柱可落块的层级，-1 = 无承重土坡（默认 0 = 全可放）
 * @param {(msg: string, dur?: number) => void} [opts.toast]
 * @param {() => void} [opts.onOpen] 打开搭建面板（可收起鸟群等）
 * @param {() => void} [opts.onClose] 关闭搭建面板
 * @returns {{
 *   open(): void, close(): void, toggle(): void, isOpen(): boolean, element: HTMLElement,
 *   getState(): { activeChar: string, activeTerrace: number, activeLayer: number, hideAbove: boolean, dropToGround: boolean },
 *   applySceneEdit(target: {ix:number,iy:number,iz:number}, mode: "place"|"erase"): boolean,
 *   cellCenter(ix: number, iy: number, iz: number): {x:number,y:number,z:number},
 *   cellAtLocal(x: number, z: number, iy: number): {ix:number,iy:number,iz:number}|null,
 *   dropTarget(ix: number, iz: number): {ix:number,iy:number,iz:number}|null, // null = 无土坡承重
   *   supportsCell(ix: number, iz: number, terraceIndex?: number): boolean,
   *   deleteTerrainObject(id: string): boolean,
 *   maxLevel: number, maxCoord: number,
 * }}
 */
export function createCitadelEditorPanel({
  onApply,
  onLayerVisibility = () => {},
  onViewAction = () => {},
  onTerrainChange = () => {},
  onTerrainObjectsChange = () => {},
  getSupportLevel = () => 0,
  toast = () => {},
  onOpen = () => {},
  onClose = () => {},
  getInstanceId = () => null,
  getTargets = () => [], // [{ id, name }]，id=null 为高山圣城默认实例
  onTargetChange = () => {},
}) {
  /** 当前目标城堡层数上限（高山 5 层 / 运河交汇古堡 12 层）。 */
  function currentMaxLevel() {
    const id = getInstanceId();
    try {
      const t = getTargets().find((x) => (x.id ?? null) === id);
      const floors = t?.floors ?? CITADEL_CASTLE_FLOORS;
      return Math.max(0, floors - 1);
    } catch {
      return CITADEL_CASTLE_FLOORS - 1;
    }
  }

  // ---------- 实例化：存档键跟随当前目标城堡（null=高山圣城默认 / 运河交汇等实例） ----------
  function instanceStorageKeys() {
    const id = getInstanceId() ?? null;
    return {
      levels: citadelLevelsKey(id),
      terrain: citadelTerrainKey(id),
      objects: citadelTerrainObjectsKey(id),
      id,
    };
  }

  // ---------- 状态 ----------
  let terraceGrids = loadTerraceGrids();
  let activeTerrace = 0; // 0 = 台地 1（最高）
  let grid = terraceGrids[activeTerrace];
  let activeChar = "0";
  let activeLayer = 0;
  let hideAbove = false;
  let dropToGround = true; // 空地加块自动堆到柱顶（落地），关闭则悬在当前层
  let gridPx = DEFAULT_GRID_PX;
  let undoStack = [];
  let redoStack = [];
  let open = false;
  let dirty = false; // 有未保存改动（编辑实时进 3D，保存才落盘）
  let terrainObjects = loadTerrainObjects();
  let terrainObjectTool = null;
  let terrainObjectSequence = terrainObjects.length;
  try {
    dropToGround = localStorage.getItem(DROP_KEY) !== "0";
  } catch { /* private mode */ }

  /** 无存档时各实例的默认布局：高山圣城用内置 SPEC；运河交汇古堡为空地基（玩家自建）。 */
  function defaultGridSpec() {
    return getInstanceId() === "canal-junction" ? { terraces: [] } : CITADEL_TOWN_SPEC;
  }

  function loadTerraceGrids() {
    try {
      const saved = JSON.parse(localStorage.getItem(instanceStorageKeys().levels) || "null");
      if (saved) {
        return normalizeCitadelTerraceLayout(saved).terraces.map((entry) =>
          levelsToGrid(entry.levels)
        );
      }
    } catch { /* 损坏存档回落默认布局 */ }
    return normalizeCitadelTerraceLayout(defaultGridSpec()).terraces.map((entry) =>
      levelsToGrid(entry.levels)
    );
  }

  function loadTerrainObjects() {
    try {
      return normalizeCitadelTerrainObjects(
        JSON.parse(localStorage.getItem(instanceStorageKeys().objects) || "[]")
      );
    } catch {
      return [];
    }
  }

  function persistTerrainObjects() {
    try {
      localStorage.setItem(instanceStorageKeys().objects, JSON.stringify(terrainObjects));
    } catch { /* private mode */ }
  }

  /** Delete one tower/tree, persist immediately, and hot-rebuild the 3D group. */
  function deleteTerrainObject(id) {
    const result = removeCitadelTerrainObjectPlacement(terrainObjects, id);
    if (!result.removed) return false;
    terrainObjects = result.objects;
    persistTerrainObjects();
    onTerrainObjectsChange([...terrainObjects]);
    drawTerrainMap();
    return true;
  }

  function gridToFixedLevels(sourceGrid) {
    return Array.from({ length: CITADEL_CASTLE_FLOORS }, (_, floor) =>
      Array.from({ length: CITADEL_GRID_SIZE }, (_, iz) => {
        let row = "";
        for (let ix = 0; ix < CITADEL_GRID_SIZE; ix++) {
          row += sourceGrid.get(`${ix},${floor},${iz}`) ?? ".";
        }
        return row;
      })
    );
  }

  function serializeLayout() {
    return {
      version: 2,
      gridSize: CITADEL_GRID_SIZE,
      terraces: terraceGrids.map((terraceGrid, terraceIndex) => ({
        terraceIndex,
        levels: gridToFixedLevels(terraceGrid),
      })),
    };
  }

  // ---------- DOM ----------
  const panel = document.createElement("div");
  panel.id = "citadel-editor";
  panel.style.cssText =
    "position:fixed;right:16px;top:64px;z-index:40;width:352px;display:none;" +
    "background:rgba(255,255,255,.94);border:1px solid #c3ccd4;border-radius:10px;" +
    "box-shadow:0 6px 24px rgba(30,40,50,.18);font:13px/1.5 -apple-system,'PingFang SC',sans-serif;" +
    "color:#2a2b2d;overflow:hidden;";
  panel.innerHTML = `
    <div id="ce-head" style="display:flex;align-items:center;gap:6px;padding:7px 10px;
      background:#2a2b2d;color:#fff;border-radius:10px 10px 0 0;">
      <strong style="flex:1;font-size:13px;">古堡 · 搭建</strong>
      <select id="ce-target" title="切换要编辑的古堡实例（高山圣城 / 运河交汇古堡等）"
        style="font:12px/1.2 -apple-system,'PingFang SC',sans-serif;color:#2a2b2d;border-radius:4px;padding:2px 4px;max-width:180px;"></select>
      <button type="button" id="ce-collapse" title="收起/展开"
        style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;">▾</button>
      <button type="button" id="ce-close" title="关闭"
        style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;">✕</button>
    </div>
    <div id="ce-body" style="padding:10px 12px 12px;max-height:calc(100vh - 118px);overflow-y:auto;">
      <div style="font-weight:700;margin-bottom:5px;">1）台地层 · 地形地貌</div>
      <div id="ce-terrace-tabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;"></div>
      <canvas id="ce-terrain-map" width="312" height="190"
        style="display:block;border:1px solid #d5dce2;border-radius:6px;background:#f7f4ea;cursor:pointer;margin-bottom:6px;"></canvas>
      <div id="ce-terrain-sliders"></div>
      <div style="border:1px solid #d5dce2;border-radius:7px;padding:6px 8px;margin-bottom:7px;background:#f3f7fa;">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:5px;">
          护城河等高线
          <span id="ce-moat-readout" style="font:10px monospace;color:#3a6ea5;font-weight:400;"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <label style="font:11px monospace;color:#4a5560;">内径
            <input id="ce-moat-inner" type="number" min="10" max="60" step="0.5" style="width:54px;font:11px monospace;">
          </label>
          <label style="font:11px monospace;color:#4a5560;">外径
            <input id="ce-moat-outer" type="number" min="12" max="80" step="0.5" style="width:54px;font:11px monospace;">
          </label>
          <label style="font:11px monospace;color:#4a5560;" title="水面相对当地地表抬升；默认与运河齐平">高度
            <input id="ce-moat-watery" type="number" min="-10" max="10" step="0.05" style="width:54px;font:11px monospace;">
          </label>
          <label style="font:11px monospace;color:#4a5560;" title="0=平面环带 · 1=完全贴合球面曲率 · &gt;1 略夸张下弯">曲率
            <input id="ce-moat-curvature" type="number" min="0" max="2" step="0.05" style="width:54px;font:11px monospace;">
          </label>
          <button type="button" id="ce-moat-reset" title="恢复内置护城河 内38/外46/高=运河水位/曲率1（需再点保存才写入存档）">重置</button>
          <span style="font:10px monospace;color:#71808a;">高度默认对齐运河水面 · 曲率控制贴地 · 改完请点「保存台地配置」</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin:5px 0 9px;align-items:center;flex-wrap:wrap;">
        <button type="button" id="ce-terrain-save" title="保存台地层 / 地形地貌 / 护城河等高线到存档（Ctrl+S）">保存台地配置</button>
        <button type="button" id="ce-terrain-reset" title="恢复内置台地参数（需再点保存才写入存档）">重置台地</button>
        <span style="color:#5d7569;font:10px/1.4 monospace;">✓ 层间楼梯默认生成　✓ 层叠瀑布可删可加　✓ 相邻台地至少相差 1 个建筑层 · 改动先预览，点保存落盘</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:-2px 0 9px;">
        <strong style="font-size:12px;color:#4a5560;">地貌对象</strong>
        <button type="button" id="ce-object-cascade" title="层叠瀑布+梯湖：点一次添加/已有则提示；用删除工具点蓝色瀑布标记可移除（移除后台地缺口关闭，前缘可建城堡）">层叠瀑布</button>
        <button type="button" id="ce-object-pools" title="梯湖开关：关 = 瀑布独立挂帘、台地不建白石梯湖，台面全部让给建筑">台地湖</button>
        <button type="button" id="ce-object-watchtower" title="选择后在上方鸟瞰图点击落点">瞭望塔</button>
        <button type="button" id="ce-object-tree" title="选择后在上方鸟瞰图点击落点">参天树</button>
        <button type="button" id="ce-object-horse" title="选择后在上方鸟瞰图点击落点；放好后按住木马标记左键拖拽平移，右键删除">木马</button>
        <button type="button" id="ce-object-delete" title="选择后点击鸟瞰图中的对象标记删除（含层叠瀑布）">删除对象</button>
        <span style="font:10px monospace;color:#71808a;">层叠瀑布=五湖四帘+窄扇区缺口；删掉后完整台面可建 · 台地湖=瀑布独立化开关（关湖省台面） · 其他对象点鸟瞰图放置 · 木马：左键拖拽平移 / 右键删除</span>
      </div>
      <div style="border-top:1px solid #dbe2e8;padding-top:7px;font-weight:700;margin-bottom:5px;">
        2）城堡层 <span id="ce-castle-context" style="font-weight:400;color:#687681;"></span>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:8px;" id="ce-palette"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <button type="button" id="ce-prev" title="上一层（Q）">◀</button>
        <span>城堡第 <b id="ce-layer">1</b> / <b id="ce-layer-total">5</b> 层</span>
        <button type="button" id="ce-next" title="下一层（E）">▶</button>
        <button type="button" id="ce-hide" title="隐藏更高层（H）">隐藏高层</button>
        <button type="button" id="ce-drop"
          title="落地堆叠：3D 空地加块自动堆到该柱最高块之上（无块落到 0 层，匹配地势）；关闭则悬在当前层">落地</button>
        <span style="flex:1"></span>
        <button type="button" id="ce-undo" title="撤销（Ctrl+Z）">撤销</button>
        <button type="button" id="ce-redo" title="重做">重做</button>
      </div>
      <div style="max-width:100%;overflow:auto;">
        <canvas id="ce-canvas" width="300" height="300"
          style="display:block;border:1px solid #d5dce2;border-radius:6px;cursor:crosshair;"></canvas>
      </div>
      <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">
        <button type="button" id="ce-save" title="保存城堡布局 + 台地/护城河配置到存档（Ctrl+S）">保存全部</button>
        <button type="button" id="ce-reset" title="恢复内置布局">重置为 SPEC</button>
        <button type="button" id="ce-clear" title="清空当前台地的五层城堡">清空当前台地</button>
        <button type="button" id="ce-export" title="导出 ASCII 布局">导出</button>
        <button type="button" id="ce-import" title="导入 ASCII 布局">导入</button>
      </div>
      <div style="display:flex;gap:5px;margin-top:6px;align-items:center;">
        <span style="color:#4a5560;">视角</span>
        <button type="button" id="ce-view-center" title="飞艇转到圣城正面居中">居中</button>
        <button type="button" id="ce-view-l" title="绕圣城左转 90°（环视四周）">⟲</button>
        <button type="button" id="ce-view-r" title="绕圣城右转 90°（环视四周）">⟳</button>
        <button type="button" id="ce-view-top" title="升到圣城顶端俯瞰">到顶</button>
      </div>
      <div id="ce-stats" style="margin-top:7px;color:#4a5560;font:11px/1.5 monospace;"></div>
      <div style="margin-top:4px;color:#8a96a1;font:10px/1.5 monospace;">
        平面图：左键 放块/改色 · 右键 删块 · 滚轮 缩放网格 · 图顶=后排 图底=前排（正门）<br/>
        3D 直编辑：左键 点顶面叠块/侧面改色/空地加块 · 右键 删块 · H 隐藏高层<br/>
        台地 1 = 鸟瞰图第一层（最高层）· 五座台地共用台地 1 的中心<br/>
        台地/护城河/城堡改动都即时预览 3D · 必须点「保存台地配置」或「保存全部」（Ctrl+S）才写入存档
      </div>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector("#ce-body");
  const paletteEl = panel.querySelector("#ce-palette");
  const layerLabel = panel.querySelector("#ce-layer");
  const statsEl = panel.querySelector("#ce-stats");
  const canvasEl = panel.querySelector("#ce-canvas");
  const ctx2d = canvasEl.getContext("2d");
  const btnCollapse = panel.querySelector("#ce-collapse");
  const btnHide = panel.querySelector("#ce-hide");
  const btnSave = panel.querySelector("#ce-save");
  const btnTerrainSave = panel.querySelector("#ce-terrain-save");

  const btnCss =
    "border:1px solid #9aa4ad;background:#fff;border-radius:6px;padding:2px 9px;cursor:pointer;font:inherit;";
  panel.querySelectorAll("#ce-body button").forEach((b) => (b.style.cssText = btnCss));

  for (const char of PALETTE_ORDER) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.char = char;
    b.title = `${CHAR_NAMES[char]}（${PALETTE_ORDER.indexOf(char) + 1}）`;
    b.innerHTML =
      `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;` +
      `vertical-align:-1px;border:1px solid rgba(0,0,0,.3);` +
      `background:${PANEL_CHARS[char]}"></span><span style="font-size:11px;">${CHAR_NAMES[char]}</span>`;
    b.onclick = () => selectChar(char);
    paletteEl.appendChild(b);
  }

  // ---------- 导出 / 导入弹窗 ----------
  const io = document.createElement("div");
  io.id = "ce-io";
  io.style.cssText =
    "position:fixed;inset:0;z-index:60;display:none;background:rgba(20,24,28,.45);" +
    "font:13px/1.5 -apple-system,'PingFang SC',sans-serif;color:#2a2b2d;";
  io.innerHTML = `
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:min(560px,90vw);background:#fff;border-radius:10px;padding:14px;">
      <div id="ce-io-title" style="margin-bottom:6px;font-weight:600;">导出</div>
      <textarea id="ce-io-text" spellcheck="false"
        style="width:100%;height:300px;box-sizing:border-box;font:12px/1.45 monospace;white-space:pre;"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
        <button type="button" id="ce-io-copy">复制</button>
        <button type="button" id="ce-io-apply" style="display:none">应用导入</button>
        <button type="button" id="ce-io-close">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(io);
  io.querySelectorAll("button").forEach((b) => (b.style.cssText = btnCss + "padding:4px 12px;"));
  const ioTitle = io.querySelector("#ce-io-title");
  const ioText = io.querySelector("#ce-io-text");
  const ioCopy = io.querySelector("#ce-io-copy");
  const ioApply = io.querySelector("#ce-io-apply");

  function exportText() {
    const levels = gridToLevels(grid);
    const blocks = levels.map((rows, iy) => {
      const bodyRows = rows.map((r) => `      "${r}",`).join("\n");
      return `    // Level ${iy}\n    Object.freeze([\n${bodyRows}\n    ]),`;
    });
    return `levels: Object.freeze([\n${blocks.join("\n")}\n  ]),`;
  }

  function parseImport(text) {
    // 优先解析导出的 Object.freeze([...]) 块；否则按空行分块、每块逐行 ASCII。
    const levels = [];
    const blocks = [...text.matchAll(/Object\.freeze\(\s*\[([\s\S]*?)\]\s*\)/g)];
    if (blocks.length) {
      for (const b of blocks) {
        const rows = [...b[1].matchAll(/"([.A-Za-z]+)"/g)].map((m) => m[1]);
        if (rows.length) levels.push(rows);
      }
    } else {
      for (const chunk of text.split(/\n\s*\n/)) {
        const rows = chunk
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^[.A-Za-z]+$/.test(l));
        if (rows.length) levels.push(rows);
      }
    }
    if (!levels.length) throw new Error("未识别到任何 ASCII 层");
    return levels;
  }

  panel.querySelector("#ce-export").onclick = () => {
    ioTitle.textContent = "导出 —— 粘贴替换 citadelTown.js 中 CITADEL_TOWN_SPEC 的 levels";
    ioText.value = exportText();
    ioText.readOnly = true;
    ioCopy.style.display = "";
    ioApply.style.display = "none";
    io.style.display = "block";
  };
  panel.querySelector("#ce-import").onclick = () => {
    ioTitle.textContent = "导入 —— 粘贴逐层 ASCII（或导出的 levels 字面量）";
    ioText.value = "";
    ioText.readOnly = false;
    ioCopy.style.display = "none";
    ioApply.style.display = "";
    io.style.display = "block";
  };
  ioCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(ioText.value);
    } catch {
      ioText.select();
      document.execCommand("copy");
    }
  };
  ioApply.onclick = () => {
    try {
      const levels = parseImport(ioText.value);
      pushUndo();
      grid = levelsToGrid(levels);
      terraceGrids[activeTerrace] = grid;
      io.style.display = "none";
      commit();
      toast("已导入圣城布局", 1.6);
    } catch (err) {
      ioTitle.textContent = `导入失败：${err.message}`;
    }
  };
  io.querySelector("#ce-io-close").onclick = () => {
    io.style.display = "none";
  };

  // ---------- 拖拽 / 收起 ----------
  makePanelDraggable(panel, panel.querySelector("#ce-head"), POS_KEY);
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch { /* private mode */ }
  function applyCollapsed() {
    body.style.display = collapsed ? "none" : "";
    btnCollapse.textContent = collapsed ? "▸" : "▾";
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch { /* private mode */ }
  }
  btnCollapse.onclick = () => {
    collapsed = !collapsed;
    applyCollapsed();
  };
  applyCollapsed();

  // ---------- 隐藏更高层 ----------
  function applyHideAbove() {
    btnHide.style.background = hideAbove ? "#2a2b2d" : "#fff";
    btnHide.style.color = hideAbove ? "#fff" : "#2a2b2d";
    onLayerVisibility(activeTerrace, activeLayer, hideAbove);
  }
  btnHide.onclick = () => {
    hideAbove = !hideAbove;
    applyHideAbove();
  };

  // ---------- 落地堆叠开关 ----------
  const btnDrop = panel.querySelector("#ce-drop");
  function applyDrop() {
    btnDrop.textContent = dropToGround ? "落地" : "悬空";
    btnDrop.style.background = dropToGround ? "#2a2b2d" : "#fff";
    btnDrop.style.color = dropToGround ? "#fff" : "#2a2b2d";
    try {
      localStorage.setItem(DROP_KEY, dropToGround ? "1" : "0");
    } catch { /* private mode */ }
  }
  btnDrop.onclick = () => {
    dropToGround = !dropToGround;
    applyDrop();
  };
  applyDrop();

  // ---------- 视角行（飞艇居中 / 环视 / 到顶） ----------
  panel.querySelector("#ce-view-center").onclick = () => onViewAction("center");
  panel.querySelector("#ce-view-l").onclick = () => onViewAction("orbitL");
  panel.querySelector("#ce-view-r").onclick = () => onViewAction("orbitR");
  panel.querySelector("#ce-view-top").onclick = () => onViewAction("top");

  // ---------- 台地层：五层独立半径 / 层高，台地 1 永远是最高层 ----------
  const TERRAIN_DEFAULTS = normalizeCitadelTerrain(CITADEL.contourTerrain);
  let terrain = loadTerrain();
  function loadTerrain() {
    try {
      const saved = JSON.parse(localStorage.getItem(instanceStorageKeys().terrain) || "null");
      if (saved) {
        const normalized = normalizeCitadelTerrain(saved);
        normalized.moat = normalizeMoatSpec(saved.moat);
        // cascadeEnabled 由 normalize 规范化（缺省 true；显式 false 保留）
        return normalized;
      }
    } catch { /* 损坏存档回落默认 */ }
    const fallback = normalizeCitadelTerrain(TERRAIN_DEFAULTS);
    fallback.moat = normalizeMoatSpec(null);
    return fallback;
  }

  /** 护城河规格归一化：内径/外径/高度/曲率。高度=相对地表，默认与运河齐平。 */
  function normalizeMoatSpec(raw) {
    // 默认高度 = 运河水面抬升，保证护城河/运河交接同一水平面
    const defaults = { inner: 38, outer: 46, waterY: CANAL_WATER_LIFT, curvature: 1 };
    if (!raw || !Number.isFinite(raw.inner) || !Number.isFinite(raw.outer)) {
      return { ...defaults };
    }
    let inner = Math.min(60, Math.max(10, Number(raw.inner)));
    let outer = Math.min(80, Math.max(12, Number(raw.outer)));
    if (outer <= inner) outer = inner + 2;
    // 旧存档 waterY=0.16 是错误的「浅水位」默认；若仍是 0.16 则升级为运河水位
    let waterY = Number.isFinite(raw.waterY) ? Number(raw.waterY) : CANAL_WATER_LIFT;
    if (Math.abs(waterY - 0.16) < 1e-6) waterY = CANAL_WATER_LIFT;
    waterY = Math.min(10, Math.max(-10, waterY));
    const curvature = Math.min(2, Math.max(0, Number.isFinite(raw.curvature) ? Number(raw.curvature) : 1));
    return { inner, outer, waterY, curvature };
  }

  /** 开关层叠瀑布：写 contour、重建台地缺口 + 水系，标脏待保存。 */
  function setCascadeEnabled(enabled) {
    const next = normalizeCitadelTerrain({
      ...terrain,
      cascadeEnabled: Boolean(enabled),
    });
    if (terrain.moat) next.moat = terrain.moat;
    terrain = next;
    markDirty();
    clearTimeout(terrainTimer);
    drawTerrainMap();
    draw();
    onTerrainChange({ ...terrain });
    refreshCascadeButton();
  }

  function refreshCascadeButton() {
    const btn = terrainObjectButtons.get("cascade");
    if (!btn) return;
    const on = isCitadelCascadeEnabled(terrain);
    // 工具选中态由 selectTerrainObjectTool 管；这里只标「水系已存在」提示色边
    btn.style.outline = on ? "2px solid #3a8fd0" : "none";
    btn.title = on
      ? "层叠瀑布已启用（蓝框）。选「删除对象」后点鸟瞰图蓝色瀑布标记可移除，前缘台地缺口会关闭"
      : "层叠瀑布未启用。点此工具再点鸟瞰图即可添加（会开窄扇区缺口 + 五湖四帘）";
  }

  /** 开关梯湖（瀑布独立化）：写 contour、重建水系，标脏待保存。 */
  function setPoolsEnabled(enabled) {
    const next = normalizeCitadelTerrain({
      ...terrain,
      cascadePoolsEnabled: Boolean(enabled),
    });
    if (terrain.moat) next.moat = terrain.moat;
    terrain = next;
    markDirty();
    clearTimeout(terrainTimer);
    drawTerrainMap();
    draw();
    onTerrainChange({ ...terrain });
    refreshPoolsButton();
  }

  function refreshPoolsButton() {
    const btn = terrainObjectButtons.get("pools");
    if (!btn) return;
    const on = isCitadelCascadePoolsEnabled(terrain);
    btn.style.outline = on ? "2px solid #3a8fd0" : "none";
    btn.style.background = on ? "#fff" : "#e8ecef";
    btn.title = on
      ? "梯湖已启用（蓝框）：五台地各有一座白石梯湖，瀑布落在湖面。点此关闭 → 瀑布独立挂帘、台面全部让给建筑"
      : "梯湖已关闭：瀑布独立挂帘、台地不建湖，台面全部可建。点此恢复五湖四帘";
  }
  function persistTerrain() {
    try {
      localStorage.setItem(instanceStorageKeys().terrain, JSON.stringify(terrain));
    } catch { /* private mode */ }
  }
  const TERRAIN_FIELDS = [
    { key: "radius", label: "本层半径", min: 4, max: 36, step: 0.25 },
    {
      key: "height",
      label: "本层层高",
      min: CITADEL_MIN_TERRACE_HEIGHT,
      max: 5,
      step: 0.1,
    },
  ];
  const slidersEl = panel.querySelector("#ce-terrain-sliders");
  const terrainMapEl = panel.querySelector("#ce-terrain-map");
  const terrainMapCtx = terrainMapEl.getContext("2d");
  const terraceTabsEl = panel.querySelector("#ce-terrace-tabs");
  const castleContextEl = panel.querySelector("#ce-castle-context");
  const moatInnerEl = panel.querySelector("#ce-moat-inner");
  const moatOuterEl = panel.querySelector("#ce-moat-outer");
  const moatWaterYEl = panel.querySelector("#ce-moat-watery");
  const moatCurvatureEl = panel.querySelector("#ce-moat-curvature");
  const moatReadoutEl = panel.querySelector("#ce-moat-readout");
  const moatResetBtn = panel.querySelector("#ce-moat-reset");

  function refreshMoatInputs() {
    const moat = normalizeMoatSpec(terrain.moat);
    terrain.moat = moat;
    moatInnerEl.value = String(moat.inner);
    moatOuterEl.value = String(moat.outer);
    moatWaterYEl.value = String(moat.waterY);
    moatCurvatureEl.value = String(moat.curvature);
    moatReadoutEl.textContent =
      `内 ${moat.inner} / 外 ${moat.outer} / 高 ${moat.waterY} / 曲率 ${moat.curvature}`;
  }
  function commitMoat() {
    let inner = Number(moatInnerEl.value);
    let outer = Number(moatOuterEl.value);
    let waterY = Number(moatWaterYEl.value);
    let curvature = Number(moatCurvatureEl.value);
    if (!Number.isFinite(inner) || !Number.isFinite(outer) || !Number.isFinite(waterY)) return;
    if (!Number.isFinite(curvature)) curvature = 1;
    terrain.moat = normalizeMoatSpec({ inner, outer, waterY, curvature });
    moatInnerEl.value = String(terrain.moat.inner);
    moatOuterEl.value = String(terrain.moat.outer);
    moatWaterYEl.value = String(terrain.moat.waterY);
    moatCurvatureEl.value = String(terrain.moat.curvature);
    moatReadoutEl.textContent =
      `内 ${terrain.moat.inner} / 外 ${terrain.moat.outer} / 高 ${terrain.moat.waterY} / 曲率 ${terrain.moat.curvature}`;
    // 即时预览 3D，不落盘；点「保存台地配置」/「保存全部」才写存档
    markDirty();
    onTerrainChange(terrain);
    drawTerrainMap();
  }
  moatInnerEl.addEventListener("input", commitMoat);
  moatOuterEl.addEventListener("input", commitMoat);
  moatWaterYEl.addEventListener("input", commitMoat);
  moatCurvatureEl.addEventListener("input", commitMoat);
  moatResetBtn.onclick = () => {
    terrain.moat = normalizeMoatSpec(null);
    refreshMoatInputs();
    markDirty();
    onTerrainChange(terrain);
    drawTerrainMap();
  };
  refreshMoatInputs();
  const terrainObjectButtons = new Map([
    ["cascade", panel.querySelector("#ce-object-cascade")],
    ["pools", panel.querySelector("#ce-object-pools")],
    ["watchtower", panel.querySelector("#ce-object-watchtower")],
    ["elderTree", panel.querySelector("#ce-object-tree")],
    ["trojanHorse", panel.querySelector("#ce-object-horse")],
    ["delete", panel.querySelector("#ce-object-delete")],
  ]);
  // 地貌对象角度旋转：选中某对象标记后，输入角度（度）回车即绕 +Y 旋转。
  let selectedObjectId = null;
  const angleWrapEl = document.createElement("div");
  angleWrapEl.style.cssText = "display:flex;gap:5px;align-items:center;margin-top:4px;";
  const angleLabel = document.createElement("span");
  angleLabel.textContent = "角度°";
  angleLabel.style.cssText = "font:11px monospace;color:#4a5560;";
  const angleInput = document.createElement("input");
  angleInput.type = "number";
  angleInput.value = "0";
  angleInput.style.cssText = "width:58px;font:11px monospace;";
  angleInput.title = "选中地貌对象标记后输入朝向角度（绕 +Y 旋转），回车应用";
  const applyAngleBtn = document.createElement("button");
  applyAngleBtn.type = "button";
  applyAngleBtn.textContent = "应用";
  applyAngleBtn.style.cssText = "font-size:11px;";
  applyAngleBtn.title = "把当前角度应用到选中的地貌对象";
  angleWrapEl.append(angleLabel, angleInput, applyAngleBtn);
  // 插入到“地貌对象”行之后（delete 按钮所在行的父容器）
  document.querySelector("#ce-object-delete")?.closest("div")?.after(angleWrapEl);

  function selectTerrainObjectTool(tool) {
    terrainObjectTool = terrainObjectTool === tool ? null : tool;
    for (const [type, button] of terrainObjectButtons) {
      const active = type === terrainObjectTool;
      button.style.background = active ? "#2a2b2d" : "#fff";
      button.style.color = active ? "#fff" : "#2a2b2d";
    }
    terrainMapEl.style.cursor = terrainObjectTool ? "crosshair" : "pointer";
    // 切换工具时清掉选中
    if (tool !== null && tool !== "delete") selectedObjectId = null;
    refreshCascadeButton();
    refreshPoolsButton();
  }
  for (const [type, button] of terrainObjectButtons) {
    button.onclick = () => {
      // 层叠瀑布：按钮本身即可添加；已存在时进入工具态，方便配合删除
      if (type === "cascade") {
        if (!isCitadelCascadeEnabled(terrain)) {
          setCascadeEnabled(true);
          selectTerrainObjectTool(null);
          toast("已添加层叠瀑布：窄扇区缺口 + 五湖四帘（请保存台地配置）", 2.0);
          return;
        }
        toast("层叠瀑布已存在。选「删除对象」点蓝色标记，或右键蓝色标记可移除", 1.8);
        selectTerrainObjectTool("delete");
        return;
      }
      // 台地湖：纯开关（瀑布独立化），不进入工具态
      if (type === "pools") {
        const next = !isCitadelCascadePoolsEnabled(terrain);
        setPoolsEnabled(next);
        selectTerrainObjectTool(null);
        toast(
          next
            ? "已启用台地湖：五座白石梯湖 + 瀑布落湖（台面被湖占用）"
            : "已关闭台地湖：瀑布独立挂帘、台地不建湖，台面全部让给建筑",
          2.0
        );
        return;
      }
      selectTerrainObjectTool(type);
    };
  }

  /** 把角度输入应用到选中的地貌对象并重建 3D。 */
  function applySelectedYaw() {
    const target = selectedObjectId
      ? terrainObjects.find((object) => object.id === selectedObjectId)
      : null;
    if (!target) {
      toast("请先在鸟瞰图点击选中一个地貌对象标记", 1.4);
      return;
    }
    const deg = Number(angleInput.value);
    if (!Number.isFinite(deg)) {
      toast("请输入有效角度", 1.4);
      return;
    }
    target.yaw = (deg * Math.PI) / 180;
    persistTerrainObjects();
    onTerrainObjectsChange([...terrainObjects]);
    drawTerrainMap();
    toast(`${objectTypeName(target.type)} 已旋转 ${deg}°`, 1.3);
  }
  angleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); applySelectedYaw(); }
  });
  applyAngleBtn.onclick = applySelectedYaw;

  function selectTerrace(index) {
    activeTerrace = Math.min(CITADEL_TERRACE_COUNT - 1, Math.max(0, index));
    grid = terraceGrids[activeTerrace];
    drawTerraceTabs();
    refreshTerrainInputs();
    drawTerrainMap();
    draw();
    onLayerVisibility(activeTerrace, activeLayer, hideAbove);
  }

  function drawTerraceTabs() {
    terraceTabsEl.querySelectorAll("button").forEach((button) => {
      const selected = Number(button.dataset.terrace) === activeTerrace;
      button.style.background = selected ? "#2a2b2d" : "#fff";
      button.style.color = selected ? "#fff" : "#2a2b2d";
    });
    castleContextEl.textContent = `— 台地 ${activeTerrace + 1}${activeTerrace === 0 ? "（最高）" : ""}`;
  }
  for (let index = 0; index < CITADEL_TERRACE_COUNT; index++) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.terrace = String(index);
    button.textContent = index === 0 ? "台地1·最高" : `台地${index + 1}`;
    button.title = `编辑台地 ${index + 1} 的地貌和五层城堡`;
    button.onclick = () => selectTerrace(index);
    terraceTabsEl.appendChild(button);
  }

  /**
   * 鸟瞰顺序严格等于菜单顺序：台地 1 是最高、最内层；台地 5 最低、最外层。
   */
  function drawTerrainMap() {
    const ctx = terrainMapCtx;
    const W = terrainMapEl.width;
    const H = terrainMapEl.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f7f4ea";
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2 + 8;
    const moat = terrain.moat ?? { inner: 38, outer: 46 };
    // 缩放基准同时容纳护城河外径，确保环带不裁切出画布
    const maxRadius = Math.max(terrain.terraces.at(-1).radius, moat.outer);
    const maxDrawR = Math.min(W / 2 - 50, H / 2 - 16);
    const scale = maxDrawR / maxRadius;
    if (terrain.notchedLayers > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(143,199,214,0.20)";
      ctx.beginPath();
      const a0 = terrain.notchCenter - terrain.notchHalf - Math.PI / 2;
      const a1 = terrain.notchCenter + terrain.notchHalf - Math.PI / 2;
      ctx.arc(cx, cy, maxRadius * scale, a0, a1, false);
      ctx.arc(cx, cy, terrain.terraces[0].radius * scale, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const fills = [
      "rgba(226,220,183,0.94)",
      "rgba(216,207,166,0.88)",
      "rgba(205,196,150,0.82)",
      "rgba(193,185,140,0.76)",
      "rgba(178,174,132,0.70)",
    ];
    const metrics = citadelTerraceMetrics(terrain);
    for (let i = CITADEL_TERRACE_COUNT - 1; i >= 0; i--) {
      const radius = terrain.terraces[i].radius;
      const isActive = i === activeTerrace;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = fills[i];
      ctx.fill();
      ctx.strokeStyle = isActive ? "#e8862a" : "rgba(80,68,52,0.7)";
      ctx.lineWidth = isActive ? 3 : 1;
      ctx.stroke();
      const ang = -Math.PI / 4;
      const lx = cx + Math.cos(ang) * radius * scale + 7;
      const ly = cy + Math.sin(ang) * radius * scale;
      ctx.font = (isActive ? "bold " : "") + "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isActive ? "#c05e10" : "#3a3026";
      ctx.fillText(`台地${i + 1}${i === 0 ? "·最高" : ""}`, lx, ly);
      ctx.fillStyle = "#8a7a64";
      ctx.font = "9px monospace";
      ctx.fillText(`R${radius.toFixed(1)} H${metrics[i].top.toFixed(1)}`, lx + 48, ly);
    }
    // ---------- 护城河等高线环带（蓝）：环绕台地层之外的地表水圈 ----------
    if (moat.outer > moat.inner) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, moat.outer * scale, 0, Math.PI * 2);
      ctx.arc(cx, cy, moat.inner * scale, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(86,156,214,0.42)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(40,92,150,0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, moat.outer * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, moat.inner * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "9px monospace";
      ctx.fillStyle = "#1f5b8f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const curv = Number.isFinite(moat.curvature) ? moat.curvature : 1;
      ctx.fillText(
        `护城河 内${moat.inner}/外${moat.outer}/高${moat.waterY}/曲率${curv}`,
        cx,
        cy - moat.outer * scale - 7
      );
      ctx.restore();
    }
    // 层叠瀑布标记（系统对象，不占 terrainObjects 列表；删/加走 cascadeEnabled）
    if (isCitadelCascadeEnabled(terrain)) {
      const cpx = cx + CITADEL_CASCADE_MARKER.x * scale;
      const cpy = cy + CITADEL_CASCADE_MARKER.z * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cpx, cpy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(58,143,208,0.92)";
      ctx.fill();
      ctx.strokeStyle = "#e8f4ff";
      ctx.lineWidth = 2;
      ctx.stroke();
      // 简易水帘示意：三条竖线
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.2;
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(cpx + dx, cpy - 5);
        ctx.lineTo(cpx + dx, cpy + 5);
        ctx.stroke();
      }
      ctx.font = "9px monospace";
      ctx.fillStyle = "#1f5b8f";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("层叠瀑布", cpx + 10, cpy);
      ctx.restore();
    }
    // Editable terrain-object markers share the same local x/z origin as 3D.
    for (const object of terrainObjects) {
      const selected = object.terraceIndex === activeTerrace;
      const picked = object.id === selectedObjectId;
      const px = cx + object.x * scale;
      const py = cy + object.z * scale;
      ctx.beginPath();
      ctx.arc(px, py, picked ? 7 : selected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = object.type === "watchtower"
        ? "#687985"
        : object.type === "trojanHorse"
          ? "#8b5a2b"
          : object.grounded
            ? "#2d5a2d"
            : "#385e3e";
      ctx.fill();
      ctx.strokeStyle = picked ? "#ffd27a" : selected ? "#ffffff" : "rgba(255,255,255,.55)";
      ctx.lineWidth = picked ? 2.5 : selected ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(object.type === "watchtower" ? "塔"
        : object.type === "trojanHorse" ? "马" : "树", px, py);
    }
    // 城堡居中标记
    ctx.save();
    ctx.fillStyle = "#2a2b2d";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("城", cx, cy);
    ctx.restore();
    ctx.fillStyle = "#4a5560";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("鸟瞰 · 台地1最高 · 点选圆环切换台地", 6, 4);
    ctx.save();
    ctx.translate(W - 22, 18);
    ctx.fillStyle = "#6a7683";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, 0);
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(-4, 14);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- 木马左键拖拽平移：按住鸟瞰图上的木马标记拖动，落点实时预览 3D ----------
  let dragObjectId = null;
  let dragMoved = false;
  let suppressMapClick = false;
  let lastDragSync = 0;

  /** 画布像素 → 局部 x/z（与 drawTerrainMap 同一缩放基准，保证命中/拖拽贴合视觉）。 */
  function terrainMapToLocal(e) {
    const rect = terrainMapEl.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (terrainMapEl.width / rect.width);
    const py = (e.clientY - rect.top) * (terrainMapEl.height / rect.height);
    const cx = terrainMapEl.width / 2;
    const cy = terrainMapEl.height / 2 + 8;
    const moat = terrain.moat ?? { inner: 38, outer: 46 };
    const maxRadius = Math.max(terrain.terraces.at(-1).radius, moat.outer);
    const maxDrawR = Math.min(terrainMapEl.width / 2 - 50, terrainMapEl.height / 2 - 16);
    const scale = maxDrawR / maxRadius;
    return { x: (px - cx) / scale, z: (py - cy) / scale, rWorld: Math.hypot(px - cx, py - cy) / scale };
  }

  terrainMapEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const { x, z } = terrainMapToLocal(e);
    let horse = null;
    let nearest = Infinity;
    for (const object of terrainObjects) {
      if (object.type !== "trojanHorse" || object.terraceIndex !== activeTerrace) continue;
      const d = Math.hypot(object.x - x, object.z - z);
      if (d < nearest) { nearest = d; horse = object; }
    }
    if (!horse || nearest > 4) return;
    dragObjectId = horse.id;
    dragMoved = false;
    selectedObjectId = horse.id;
    angleInput.value = String(Math.round(((horse.yaw * 180) / Math.PI) * 10) / 10);
    terrainMapEl.setPointerCapture(e.pointerId);
    drawTerrainMap();
  });

  terrainMapEl.addEventListener("pointermove", (e) => {
    if (!dragObjectId) return;
    const object = terrainObjects.find((o) => o.id === dragObjectId);
    if (!object) { dragObjectId = null; return; }
    const { x, z } = terrainMapToLocal(e);
    if (Math.hypot(x - object.x, z - object.z) < 0.05) return;
    // 拖出当前台地可见顶面的落点直接丢弃，木马停留在最后一个合法位置
    if (!citadelTerrainPointSupported(terrain, x, z, activeTerrace)) return;
    object.x = Number(x.toFixed(3));
    object.z = Number(z.toFixed(3));
    dragMoved = true;
    drawTerrainMap();
    const now = performance.now();
    if (now - lastDragSync > 60) {
      lastDragSync = now;
      onTerrainObjectsChange([...terrainObjects]);
    }
  });

  function finishTerrainObjectDrag(e, cancelled) {
    if (!dragObjectId) return;
    dragObjectId = null;
    try { terrainMapEl.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
    if (cancelled) return;
    if (dragMoved) {
      suppressMapClick = true; // 拖拽后的 click 不再触发放置/选中/切台地
      persistTerrainObjects();
      onTerrainObjectsChange([...terrainObjects]);
      drawTerrainMap();
      toast("木马已移动到新位置", 1.2);
    } else {
      toast("已选中特洛伊木马：按住左键拖拽平移 · 右键删除 · 角度°旋转", 1.8);
    }
    dragMoved = false;
  }
  terrainMapEl.addEventListener("pointerup", finishTerrainObjectDrag);
  terrainMapEl.addEventListener("pointercancel", (e) => finishTerrainObjectDrag(e, true));

  /** 鸟瞰图点击圆环 → 切换该台地及其五层城堡。 */
  terrainMapEl.addEventListener("click", (e) => {
    if (suppressMapClick) { suppressMapClick = false; return; }
    const { x: localX, z: localZ, rWorld } = terrainMapToLocal(e);
    if (terrainObjectTool) {
      const cascadeDist = Math.hypot(
        localX - CITADEL_CASCADE_MARKER.x,
        localZ - CITADEL_CASCADE_MARKER.z
      );
      if (terrainObjectTool === "delete") {
        // 优先删层叠瀑布（系统对象）
        if (isCitadelCascadeEnabled(terrain) && cascadeDist <= 5) {
          setCascadeEnabled(false);
          toast("已删除层叠瀑布：台地前缘缺口关闭，五湖四帘已移除", 2.0);
          return;
        }
        let nearestIndex = -1;
        let nearestDistance = Infinity;
        terrainObjects.forEach((object, index) => {
          if (object.terraceIndex !== activeTerrace) return;
          const distance = Math.hypot(object.x - localX, object.z - localZ);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        if (nearestIndex >= 0 && nearestDistance <= 4) {
          const object = terrainObjects[nearestIndex];
          if (deleteTerrainObject(object.id)) toast("已删除地貌对象", 1.3);
        }
        return;
      }
      // 层叠瀑布：整套系统对象，点击鸟瞰图任意处即可添加（不占单格台面）
      if (terrainObjectTool === "cascade") {
        if (isCitadelCascadeEnabled(terrain)) {
          toast("层叠瀑布已存在。用「删除对象」点蓝色瀑布标记可移除", 1.8);
          return;
        }
        setCascadeEnabled(true);
        toast("已添加层叠瀑布：窄扇区缺口 + 五湖四帘（请保存台地配置）", 2.0);
        return;
      }
      if (!citadelTerrainPointSupported(terrain, localX, localZ, activeTerrace)) {
        toast("请在当前台地的可见顶面内放置", 1.5);
        return;
      }
      const type = terrainObjectTool;
      const placement = {
        id: `${type}-${activeTerrace}-${++terrainObjectSequence}`,
        type,
        terraceIndex: activeTerrace,
        x: Number(localX.toFixed(3)),
        z: Number(localZ.toFixed(3)),
        yaw: 0,
        scale: type === "watchtower" ? 0.42 : type === "trojanHorse" ? 0.9 : 0.45,
        grounded: type === "elderTree",
      };
      // One terrain object per immediate footprint; replacing a nearby marker
      // avoids interpenetrating towers/trees on the small upper terraces.
      terrainObjects = terrainObjects.filter((object) =>
        object.terraceIndex !== activeTerrace
        || Math.hypot(object.x - localX, object.z - localZ) > 4
      );
      terrainObjects.push(placement);
      persistTerrainObjects();
      onTerrainObjectsChange([...terrainObjects]);
      drawTerrainMap();
      // 放置木马后自动选中，便于立刻用“角度°”输入旋转
      if (type === "trojanHorse") {
        selectedObjectId = placement.id;
        angleInput.value = "0";
      }
      toast(type === "watchtower" ? "已放置瞭望塔"
        : type === "trojanHorse" ? "已放置特洛伊木马（左键拖拽平移 · 右键删除 · 角度°旋转）"
        : "已放置参天树（落地 + 随曲率倾斜）", 1.5);
      return;
    }
    // 未选任何放置工具时：点击已有地貌对象标记 → 选中（供“角度°”旋转）
    if (!terrainObjectTool) {
      let picked = null;
      let nearest = Infinity;
      for (const object of terrainObjects) {
        if (object.terraceIndex !== activeTerrace) continue;
        const d = Math.hypot(object.x - localX, object.z - localZ);
        if (d < nearest) { nearest = d; picked = object; }
      }
      if (picked && nearest <= 4) {
        selectedObjectId = picked.id;
        angleInput.value = String(Math.round(((picked.yaw * 180) / Math.PI) * 10) / 10);
        drawTerrainMap();
        toast(`已选中${objectTypeName(picked.type)}，可输入角度旋转`, 1.3);
        return;
      }
      selectedObjectId = null;
    }
    const terraceIndex = terrain.terraces.findIndex((entry) => rWorld <= entry.radius);
    if (terraceIndex < 0) return;
    selectTerrace(terraceIndex);
    toast(`已切到台地 ${terraceIndex + 1}${terraceIndex === 0 ? "（最高）" : ""}`, 1.4);
  });

  // 鸟瞰图右键：优先删层叠瀑布，否则删当前台地的塔/树/木马标记。
  terrainMapEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { x: localX, z: localZ } = terrainMapToLocal(e);
    const cascadeDist = Math.hypot(
      localX - CITADEL_CASCADE_MARKER.x,
      localZ - CITADEL_CASCADE_MARKER.z
    );
    if (isCitadelCascadeEnabled(terrain) && cascadeDist <= 5) {
      setCascadeEnabled(false);
      toast("已删除层叠瀑布：台地前缘缺口关闭", 1.8);
      return;
    }
    let nearest = null;
    let nearestDistance = Infinity;
    for (const object of terrainObjects) {
      if (object.terraceIndex !== activeTerrace) continue;
      const distance = Math.hypot(object.x - localX, object.z - localZ);
      if (distance < nearestDistance) {
        nearest = object;
        nearestDistance = distance;
      }
    }
    if (nearest && nearestDistance <= 4 && deleteTerrainObject(nearest.id)) {
      if (selectedObjectId === nearest.id) selectedObjectId = null;
      toast(`已删除${objectTypeName(nearest.type)}`, 1.3);
    }
  });

  let terrainTimer = 0;
  const terrainInputs = new Map();
  for (const f of TERRAIN_FIELDS) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;align-items:center;margin-bottom:4px;";
    const label = document.createElement("span");
    label.style.cssText = "width:60px;color:#4a5560;";
    label.textContent = f.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = f.min;
    input.max = f.max;
    input.step = f.step;
    input.value = terrain.terraces[activeTerrace][f.key];
    input.style.flex = "1";
    input.dataset.terrainKey = f.key;
    const val = document.createElement("span");
    val.style.cssText = "width:34px;text-align:right;font:11px monospace;";
    val.textContent = String(terrain.terraces[activeTerrace][f.key]);
    input.addEventListener("input", () => {
      const terraces = terrain.terraces.map((entry) => ({ ...entry }));
      let value = Number(input.value);
      if (f.key === "radius") {
        const min = activeTerrace === 0 ? 4 : terraces[activeTerrace - 1].radius + 0.5;
        const max = activeTerrace === CITADEL_TERRACE_COUNT - 1
          ? 36
          : terraces[activeTerrace + 1].radius - 0.5;
        value = Math.min(max, Math.max(min, value));
      }
      terraces[activeTerrace][f.key] = value;
      // 保留 moat 等附属字段：normalize 只规范 terraces
      const keptMoat = terrain.moat;
      terrain = normalizeCitadelTerrain({ ...terrain, terraces });
      if (keptMoat) terrain.moat = keptMoat;
      terrainObjects = terrainObjects.filter((object) => citadelTerrainPointSupported(
        terrain,
        object.x,
        object.z,
        object.terraceIndex
      ));
      onTerrainObjectsChange([...terrainObjects]);
      input.value = String(value);
      val.textContent = value.toFixed(f.key === "radius" ? 2 : 1);
      // 即时预览，不落盘（与城堡布局一致：保存按钮才写 localStorage）
      markDirty();
      drawTerrainMap();
      draw(); // 网格面板上的等高线叠随地形参数实时更新
      clearTimeout(terrainTimer); // 拖动防抖，松手 150ms 后重建
      terrainTimer = setTimeout(() => onTerrainChange({ ...terrain }), 150);
    });
    row.append(label, input, val);
    slidersEl.appendChild(row);
    terrainInputs.set(f.key, { input, val });
  }
  function refreshTerrainInputs() {
    for (const f of TERRAIN_FIELDS) {
      const refs = terrainInputs.get(f.key);
      if (!refs) continue;
      const value = terrain.terraces[activeTerrace][f.key];
      refs.input.value = String(value);
      refs.val.textContent = value.toFixed(f.key === "radius" ? 2 : 1);
    }
  }
  panel.querySelector("#ce-terrain-reset").onclick = () => {
    terrain = normalizeCitadelTerrain(TERRAIN_DEFAULTS);
    terrain.moat = normalizeMoatSpec(null);
    // 重置台地默认带回层叠瀑布（cascadeEnabled=true）
    refreshTerrainInputs();
    refreshMoatInputs();
    refreshCascadeButton();
    refreshPoolsButton();
    // 仅预览默认值，不立刻清存档；点保存后才覆盖 localStorage
    markDirty();
    clearTimeout(terrainTimer);
    drawTerrainMap();
    onTerrainChange({ ...terrain });
    terrainObjects = terrainObjects.filter((object) => citadelTerrainPointSupported(
      terrain,
      object.x,
      object.z,
      object.terraceIndex
    ));
    onTerrainObjectsChange([...terrainObjects]);
    toast("已恢复内置台地/护城河/层叠瀑布（点保存后写入存档）", 1.8);
  };
  drawTerraceTabs();
  refreshTerrainInputs();
  refreshCascadeButton();
  refreshPoolsButton();
  drawTerrainMap();

  // ---------- 保存（编辑实时进 3D，点保存才写存档） ----------
  // 台地层 / 地形地貌 / 护城河 / 城堡布局 共用同一套 dirty + 落盘。
  function styleSaveButton(btn, dirtyLabel, cleanLabel, dirtyTitle, cleanTitle) {
    if (!btn) return;
    btn.textContent = dirty ? dirtyLabel : cleanLabel;
    btn.style.background = dirty ? "#2a2b2d" : "#fff";
    btn.style.color = dirty ? "#fff" : "#2a2b2d";
    btn.title = dirty ? dirtyTitle : cleanTitle;
  }
  function applyDirty() {
    styleSaveButton(
      btnSave,
      "保存全部 ●",
      "保存全部",
      "有未保存改动（Ctrl+S：城堡+台地+护城河）",
      "城堡布局与台地/护城河已保存（Ctrl+S）"
    );
    styleSaveButton(
      btnTerrainSave,
      "保存台地配置 ●",
      "保存台地配置",
      "台地/护城河有未保存改动（Ctrl+S 也可保存全部）",
      "台地层 · 地形地貌 · 护城河已写入存档"
    );
  }
  function markDirty() {
    dirty = true;
    applyDirty();
  }
  function save() {
    try {
      localStorage.setItem(instanceStorageKeys().levels, JSON.stringify(serializeLayout()));
      // 台地层半径/层高 + 护城河等高线（内径/外径/高度）
      persistTerrain();
      // 瞭望塔 / 参天树 / 木马
      persistTerrainObjects();
    } catch {
      toast("保存失败：浏览器存档不可用", 2.0);
      return;
    }
    dirty = false;
    applyDirty();
    toast("已保存：城堡布局 · 台地层 · 地形地貌 · 护城河", 1.8);
  }
  btnSave.onclick = save;
  btnTerrainSave.onclick = save;
  applyDirty();

  // ---------- 编辑操作 ----------
  function selectChar(char) {
    activeChar = char;
    paletteEl.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.char === char;
      b.style.background = on ? "#2a2b2d" : "#fff";
      b.style.color = on ? "#fff" : "#2a2b2d";
    });
  }
  selectChar("0");

  function pushUndo() {
    undoStack.push(JSON.stringify({
      activeTerrace,
      terraces: terraceGrids.map((terraceGrid) => [...terraceGrid]),
    }));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }

  /** 布局变更统一出口：回调上层即时重建 3D → 重画面板 → 标脏（保存才落盘） */
  function commit(shouldMarkDirty = true) {
    terraceGrids[activeTerrace] = grid;
    const stats = onApply(serializeLayout());
    if (shouldMarkDirty) markDirty();
    draw();
    if (stats) {
      statsEl.textContent =
        `格 ${stats.cellCount} · 穹顶 ${stats.domeCount} · 塔顶 ${stats.towerCount}` +
        ` · 坡顶 ${stats.roofCount} · 教堂 ${stats.steepleCount ?? 0} · 旗杆 ${stats.flagCount ?? 0}` +
        ` · 拱 ${stats.archCount} · 拱窗 ${stats.windowCount} · 门 ${stats.doorCount ?? 0}` +
        ` · 城垛 ${stats.crenelCount} · 围栏 ${stats.fenceCount} · 绿植 ${stats.shrubCount}` +
        ` · 花园 ${stats.gardenCount ?? 0} · 广场 ${stats.plazaCount ?? 0}` +
        ` · 水道 ${stats.canalCount} · 水门 ${stats.waterGateCount}` +
        (stats.gate ? " · 正门✓" : " · 无正门");
    }
  }

  function draw() {
    const n = MAX_COORD + 1;
    ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx2d.fillStyle = "#f2f5f7";
    ctx2d.fillRect(0, 0, canvasEl.width, canvasEl.height);
    // 五层台地背景：所有城堡网格共享同一个固定中心。
    {
      // The terrain origin is the centre of grid cell (12, 12), not that
      // cell's top-left corner. The old MAX_COORD/2 formula shifted every
      // contour by half a cell and made map-edge cells disagree with 3D.
      const cx = (n * gridPx) / 2;
      const cy = cx;
      const scale = gridPx / CELL; // 世界单位→像素
      // 缺口扇区铺底
      if (terrain.notchedLayers > 0) {
        ctx2d.save();
        ctx2d.fillStyle = "rgba(143,199,214,0.20)";
        ctx2d.beginPath();
        const a0 = terrain.notchCenter - terrain.notchHalf - Math.PI / 2;
        const a1 = terrain.notchCenter + terrain.notchHalf - Math.PI / 2;
        ctx2d.arc(cx, cy, terrain.terraces.at(-1).radius * scale, a0, a1, false);
        ctx2d.arc(cx, cy, terrain.terraces[0].radius * scale, a1, a0, true);
        ctx2d.closePath();
        ctx2d.fill();
        ctx2d.restore();
      }
      for (let i = CITADEL_TERRACE_COUNT - 1; i >= 0; i--) {
        const rOuter = terrain.terraces[i].radius * scale;
        const rInner = i === 0 ? 0 : terrain.terraces[i - 1].radius * scale;
        ctx2d.beginPath();
        if (i > 0) {
          ctx2d.arc(cx, cy, rOuter, 0, Math.PI * 2);
          ctx2d.arc(cx, cy, rInner, 0, Math.PI * 2, true);
        } else {
          ctx2d.arc(cx, cy, rOuter, 0, Math.PI * 2);
        }
        ctx2d.closePath();
        ctx2d.fillStyle = i === activeTerrace
          ? "rgba(232,134,42,0.25)"
          : `rgba(196,196,148,${0.22 + i * 0.04})`;
        ctx2d.fill();
        const isActive = i === activeTerrace;
        ctx2d.strokeStyle = isActive ? "#e8862a" : "rgba(80,68,52,0.55)";
        ctx2d.lineWidth = isActive ? 2.4 : (i === CITADEL_TERRACE_COUNT - 1 ? 1.2 : 0.8);
        ctx2d.stroke();
      }
      // 城堡居中标记（"+城"）
      ctx2d.fillStyle = "rgba(42,43,45,0.7)";
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = "#fff";
      ctx2d.font = "bold 8px monospace";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText("城", cx, cy);
    }
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const char = grid.get(`${ix},${activeLayer},${iz}`);
        const supported = supportsCell(ix, iz, activeTerrace);
        if (!supported) {
          ctx2d.fillStyle = "rgba(86,107,122,0.12)";
          ctx2d.fillRect(ix * gridPx + 1, iz * gridPx + 1, gridPx - 2, gridPx - 2);
        }
        if (char) {
          ctx2d.fillStyle = PANEL_CHARS[char] ?? PANEL_CHARS.W;
          ctx2d.fillRect(ix * gridPx + 1, iz * gridPx + 1, gridPx - 2, gridPx - 2);
          if (char === "G") {
            ctx2d.fillStyle = "#3a2412";
            ctx2d.fillRect(ix * gridPx + gridPx / 2 - 1.5, iz * gridPx + 3, 3, gridPx - 6);
          }
        }
        ctx2d.strokeStyle = "#c9d2d9";
        ctx2d.strokeRect(ix * gridPx + 0.5, iz * gridPx + 0.5, gridPx, gridPx);
      }
    }
    layerLabel.textContent = String(activeLayer + 1);
    const totalEl = panel.querySelector("#ce-layer-total");
    if (totalEl) totalEl.textContent = String(currentMaxLevel() + 1);
  }

  canvasEl.addEventListener("pointerdown", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const ix = Math.floor((e.clientX - rect.left) / gridPx);
    const iz = Math.floor((e.clientY - rect.top) / gridPx);
    if (ix < 0 || ix > MAX_COORD || iz < 0 || iz > MAX_COORD) return;
    const existing = grid.get(`${ix},${activeLayer},${iz}`);
    if (e.button === 2) {
      if (!existing) return;
      pushUndo();
      clearCell(grid, ix, activeLayer, iz);
    } else if (e.button === 0) {
      if (existing === activeChar) return;
      // The map and 3D editor share the same support test. In particular,
      // after clearing a terrace its first block can be placed in every cell
      // whose centre lies on the selected terrace, and nowhere else.
      if (!existing && !supportsCell(ix, iz, activeTerrace)) {
        toast("该格不在当前台地可建面（土坡环带或层叠梯湖）内", 1.6);
        return;
      }
      pushUndo();
      setCell(grid, ix, activeLayer, iz, activeChar);
    } else {
      return;
    }
    commit();
  });
  canvasEl.addEventListener("contextmenu", (e) => e.preventDefault());

  // 滚轮缩放平面图网格（放大后可滚动查看）
  canvasEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      gridPx = Math.min(40, Math.max(8, gridPx * (e.deltaY > 0 ? 1 / 1.15 : 1.15)));
      const size = Math.round((MAX_COORD + 1) * gridPx);
      canvasEl.width = size;
      canvasEl.height = size;
      draw();
    },
    { passive: false }
  );

  function stepLayer(delta) {
    activeLayer = Math.min(currentMaxLevel(), Math.max(0, activeLayer + delta));
    draw();
    onLayerVisibility(activeTerrace, activeLayer, hideAbove);
  }
  panel.querySelector("#ce-prev").onclick = () => stepLayer(-1);
  panel.querySelector("#ce-next").onclick = () => stepLayer(1);

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify({
      activeTerrace,
      terraces: terraceGrids.map((terraceGrid) => [...terraceGrid]),
    }));
    const snapshot = JSON.parse(undoStack.pop());
    terraceGrids = snapshot.terraces.map((entries) => new Map(entries));
    activeTerrace = snapshot.activeTerrace;
    grid = terraceGrids[activeTerrace];
    drawTerraceTabs();
    commit();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify({
      activeTerrace,
      terraces: terraceGrids.map((terraceGrid) => [...terraceGrid]),
    }));
    const snapshot = JSON.parse(redoStack.pop());
    terraceGrids = snapshot.terraces.map((entries) => new Map(entries));
    activeTerrace = snapshot.activeTerrace;
    grid = terraceGrids[activeTerrace];
    drawTerraceTabs();
    commit();
  }
  panel.querySelector("#ce-undo").onclick = undo;
  panel.querySelector("#ce-redo").onclick = redo;
  panel.querySelector("#ce-reset").onclick = () => {
    pushUndo();
    // 按实例重置：高山圣城恢复内置 SPEC；运河交汇古堡清空为堤岸空地基（玩家自建）
    const isCanal = getInstanceId() === "canal-junction";
    terraceGrids = normalizeCitadelTerraceLayout(
      isCanal ? { terraces: [] } : CITADEL_TOWN_SPEC
    ).terraces.map((entry) => levelsToGrid(entry.levels));
    grid = terraceGrids[activeTerrace];
    commit();
    toast(isCanal ? "已清空运河古堡（堤岸方框即地基，可自由搭建）" : "已恢复内置圣城布局", 1.6);
  };
  panel.querySelector("#ce-clear").onclick = () => {
    pushUndo();
    grid = new Map();
    terraceGrids[activeTerrace] = grid;
    commit();
  };
  panel.querySelector("#ce-close").onclick = () => api.close();

  // 面板打开时的快捷键（1–4 材质 · Q/E 层 · H 隐藏高层 · Ctrl+Z 撤销）
  window.addEventListener("keydown", (e) => {
    if (!open || e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    // Townscaper 15 色 + 正门：数字键 1-9 → 色 0-8，0 → 色 9；
    // Shift+1..6 或字母 Y/U/I/O/P（补充 A-E）；G 键选正门
    const palette = {
      Digit1: "0", Digit2: "1", Digit3: "2", Digit4: "3", Digit5: "4",
      Digit6: "5", Digit7: "6", Digit8: "7", Digit9: "8", Digit0: "9",
    };
    const shiftPalette = { Digit1: "A", Digit2: "B", Digit3: "C", Digit4: "D", Digit5: "E", Digit6: "G" };
    if (e.shiftKey && shiftPalette[e.code]) selectChar(shiftPalette[e.code]);
    else if (palette[e.code]) selectChar(palette[e.code]);
    else if (e.code === "KeyG") selectChar("G");
    else if (e.code === "KeyQ") stepLayer(-1);
    else if (e.code === "KeyE") stepLayer(1);
    else if (e.code === "KeyH") btnHide.click();
  });

  // ---------- 场景 3D 直编辑 API（citadelSceneEdit.js 使用） ----------
  /** 栅格包围盒（与 citadelTown.js 的 cx/cz 居中约定一致，至少 1×1）。 */
  function gridDims() {
    return { cols: CITADEL_GRID_SIZE, rows: CITADEL_GRID_SIZE };
  }

  /** 格中心在 level 组局部坐标（未含 townBaseY 抬升，由调用方按参考组变换）。 */
  function cellCenter(ix, iy, iz) {
    const { cols } = gridDims();
    return citadelGridCellCenter(ix, iy, iz, CELL, CELL_H, cols);
  }

  /** level 组局部 x/z → 格坐标（越界返回 null）。 */
  function cellAtLocal(x, z, iy) {
    const { cols, rows } = gridDims();
    const ix = Math.round(x / CELL + (cols - 1) / 2);
    const iz = Math.round(z / CELL + (rows - 1) / 2);
    if (ix < 0 || ix > MAX_COORD || iz < 0 || iz > MAX_COORD) return null;
    return { ix, iy, iz };
  }

  /**
   * 落地堆叠目标：该柱最高块之上（封顶于 MAX_LEVEL）；空柱探测土坡支撑——
   * 有承重土坡落在其台面层级，无支撑（或台地超出可达层）返回 null = 不可放置。
   */
  function dropTarget(ix, iz, terraceIndex = activeTerrace) {
    const support = getSupportLevel(ix, iz, terraceIndex);
    return resolveCitadelDropTarget(grid, ix, iz, support, currentMaxLevel());
  }

  /** Single source of truth for 2D tinting/clicks and 3D plane placement. */
  function supportsCell(ix, iz, terraceIndex = activeTerrace) {
    return getSupportLevel(ix, iz, terraceIndex) >= 0;
  }

  /**
   * 场景直编辑统一入口：place = 放块/改色（用当前材质），erase = 删块。
   * 无变化返回 false（不进撤销栈）；有变化走 commit 即时重建。
   */
  function applySceneEdit({ ix, iy, iz, terraceIndex = activeTerrace }, mode) {
    if (terraceIndex !== activeTerrace) return false;
    if (ix < 0 || ix > MAX_COORD || iz < 0 || iz > MAX_COORD) return false;
    if (iy < 0 || iy > currentMaxLevel()) return false;
    const existing = grid.get(`${ix},${iy},${iz}`);
    if (mode === "erase") {
      if (!existing) return false;
      pushUndo();
      clearCell(grid, ix, iy, iz);
    } else {
      if (!existing && !supportsCell(ix, iz, terraceIndex)) return false;
      if (existing === activeChar) return false;
      pushUndo();
      setCell(grid, ix, iy, iz, activeChar);
    }
    commit();
    return true;
  }

  // ---------- 开关 ----------
  const api = {
    element: panel,
    open() {
      if (open) return;
      open = true;
      panel.style.display = "block";
      // 打开面板只改变 UI，不得重建或修改 3D 城堡。布局在每次真正编辑时
      // 已由 commit() 即时同步；这里调用 commit 会让一次普通点选变成场景写入。
      hideAbove = false;
      applyHideAbove(); // 每次打开先完整显示五座台地上的全部城堡层
      drawTerrainMap(); // 等高线高亮与当前层同步
      try {
        onOpen();
      } catch {
        /* ignore */
      }
    },
    close() {
      open = false;
      panel.style.display = "none";
      io.style.display = "none";
      onLayerVisibility(activeTerrace, activeLayer, false); // 关面板恢复全楼可见
      try {
        onClose();
      } catch {
        /* ignore */
      }
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    isOpen: () => open,
    getState: () => ({
      activeChar,
      activeTerrace,
      activeLayer,
      hideAbove,
      dropToGround,
      terrainObjectTool,
    }),
    applySceneEdit,
    cellCenter,
    cellAtLocal,
    dropTarget,
    supportsCell,
    setActiveTerrace: (index) => selectTerrace(index),
    deleteTerrainObject,
    /**
     * 台地缩放自动裁剪后同步面板内存布局：把重建后的五台地 levels
     * 回写 terraceGrids，2D 平面图不再显示已裁格子（不落盘——保存仍
     * 由用户显式触发，裁剪结果随「保存台地配置/保存全部」一并写入）。
     */
    syncTrimmedLayout(spec) {
      const next = normalizeCitadelTerraceLayout(spec ?? CITADEL_TOWN_SPEC);
      terraceGrids = next.terraces.map((entry) => levelsToGrid(entry.levels));
      grid = terraceGrids[activeTerrace];
      markDirty();
      draw();
      drawTerrainMap();
    },
    /**
     * 目标城堡切换（高山圣城 ⇄ 运河交汇古堡等实例）：
     * 按新实例的存档键重载布局/台地/地貌对象并重建 3D。
     * @param {(instanceId: string|null) => boolean} tryApply 返回是否已切换成功
     */
    switchTarget(tryApply) {
      if (!tryApply(getInstanceId())) return false;
      terraceGrids = loadTerraceGrids();
      terrain = loadTerrain();
      terrainObjects = loadTerrainObjects();
      grid = terraceGrids[activeTerrace];
      activeTerrace = 0;
      activeLayer = 0;
      hideAbove = false;
      refreshTerrainInputs();
      refreshMoatInputs();
      refreshCascadeButton();
      refreshPoolsButton();
      refreshTargetSelect(); // 点选命中切换后，下拉选中态同步
      drawTerraceTabs();
      drawTerrainMap();
      draw();
      applyHideAbove();
      markDirty();
      return true;
    },
    // 动态 getter：切换目标城堡（5↔12 层）后即时生效
    get maxLevel() {
      return currentMaxLevel();
    },
    maxCoord: MAX_COORD,
  };
  // ---------- 目标古堡切换（高山圣城 ⇄ 运河交汇古堡等） ----------
  const targetSelect = panel.querySelector("#ce-target");
  function refreshTargetSelect() {
    const targets = getTargets();
    const current = getInstanceId();
    targetSelect.innerHTML = "";
    for (const t of targets) {
      const opt = document.createElement("option");
      opt.value = t.id ?? "";
      opt.textContent = t.name;
      opt.selected = (t.id ?? null) === current;
      targetSelect.appendChild(opt);
    }
  }
  targetSelect.addEventListener("change", () => {
    const id = targetSelect.value === "" ? null : targetSelect.value;
    if ((id ?? null) === getInstanceId()) return;
    // 走 switchTarget 完整切换：上层先改目标（存档键/3D 目标），
    // 成功后按新实例键重载布局/台地/地貌对象并重建面板。
    api.switchTarget(() => {
      onTargetChange(id); // 上层切换目标实例（含存档键与 3D 目标）
      return true;
    });
  });
  refreshTargetSelect();

  // Keep the backing canvas exactly equal to the fixed 25×25 building grid.
  // This makes its visual centre identical to cellCenter(12, *, 12).
  canvasEl.width = Math.round((MAX_COORD + 1) * gridPx);
  canvasEl.height = canvasEl.width;
  draw();
  return api;
}
