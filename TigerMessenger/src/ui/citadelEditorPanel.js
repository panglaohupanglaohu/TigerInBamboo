// =====================================================================
//  高山圣城 · Townscaper 搭建面板（游戏内）
//  - 乘坐航空艇时用鼠标点选圣城弹出（main.js 接线）
//  - 标题栏可拖拽（位置记忆）· 可收起成一条标题 · 可关闭
//  - 分层 2D 平面图点格编辑，onApply 回调驱动场景 3D 即时重建
//  - 场景 3D 直编辑：点块顶面叠块 / 侧面改色 / 空地加块 / 右键删块
//    （由 citadelSceneEdit.js 通过 applySceneEdit / cellCenter 接入）
//  - 隐藏更高层（H）· 导出 / 导入 ASCII 布局
//  - 编辑即时重建 3D 场景；「保存」按钮（Ctrl+S）才写 localStorage
//    （CITADEL_LEVELS_KEY，下次进游戏自动套用），有未保存改动时按钮带 ● 标记
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
} from "../world/odysseyCitadel.js";
import { makePanelDraggable } from "./dragPanel.js";

const MAX_COORD = CITADEL_GRID_SIZE - 1;
const MAX_LEVEL = CITADEL_CASTLE_FLOORS - 1;
const DEFAULT_GRID_PX = 12;
const POS_KEY = "tm.citadelEditor.pos";
const COLLAPSE_KEY = "tm.citadelEditor.collapsed";
const DROP_KEY = "tm.citadelEditor.dropToGround";
const PANEL_CHARS = { W: "#e5eff2", L: "#d9cfac", B: "#caa88c", D: "#8b5a2b" };
const CHAR_NAMES = { W: "白石", L: "浅砂石", B: "淡砖", D: "正门" };
const CELL = CITADEL_TOWN_SPEC.cellSize;
const CELL_H = CITADEL_TOWN_SPEC.cellHeight;

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
}) {
  // ---------- 状态 ----------
  let terraceGrids = loadTerraceGrids();
  let activeTerrace = 0; // 0 = 台地 1（最高）
  let grid = terraceGrids[activeTerrace];
  let activeChar = "W";
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

  function loadTerraceGrids() {
    try {
      const saved = JSON.parse(localStorage.getItem(CITADEL_LEVELS_KEY) || "null");
      if (saved) {
        return normalizeCitadelTerraceLayout(saved).terraces.map((entry) =>
          levelsToGrid(entry.levels)
        );
      }
    } catch { /* 损坏存档回落 SPEC */ }
    return normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC).terraces.map((entry) =>
      levelsToGrid(entry.levels)
    );
  }

  function loadTerrainObjects() {
    try {
      return normalizeCitadelTerrainObjects(
        JSON.parse(localStorage.getItem(CITADEL_TERRAIN_OBJECTS_KEY) || "[]")
      );
    } catch {
      return [];
    }
  }

  function persistTerrainObjects() {
    try {
      localStorage.setItem(CITADEL_TERRAIN_OBJECTS_KEY, JSON.stringify(terrainObjects));
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
      <strong style="flex:1;font-size:13px;">高山圣城 · 搭建</strong>
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
      <div style="display:flex;gap:6px;margin:5px 0 9px;align-items:center;">
        <button type="button" id="ce-terrain-reset" title="恢复内置台地参数">重置台地</button>
        <span style="color:#5d7569;font:10px/1.4 monospace;">✓ 层间楼梯/瀑布默认生成　✓ 相邻台地至少相差 1 个建筑层</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:-2px 0 9px;">
        <strong style="font-size:12px;color:#4a5560;">地貌对象</strong>
        <button type="button" id="ce-object-watchtower" title="选择后在上方鸟瞰图点击落点">瞭望塔</button>
        <button type="button" id="ce-object-tree" title="选择后在上方鸟瞰图点击落点">参天树</button>
        <button type="button" id="ce-object-delete" title="选择后点击鸟瞰图中的对象标记删除">删除对象</button>
        <span style="font:10px monospace;color:#71808a;">选择对象 → 点击鸟瞰图放置</span>
      </div>
      <div style="border-top:1px solid #dbe2e8;padding-top:7px;font-weight:700;margin-bottom:5px;">
        2）城堡层 <span id="ce-castle-context" style="font-weight:400;color:#687681;"></span>
      </div>
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:8px;" id="ce-palette"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <button type="button" id="ce-prev" title="上一层（Q）">◀</button>
        <span>城堡第 <b id="ce-layer">1</b> / 5 层</span>
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
        <button type="button" id="ce-save" title="保存布局到存档（Ctrl+S）">保存</button>
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
        改动即时重建到 3D 场景 · 点「保存」（Ctrl+S）写入存档
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

  const btnCss =
    "border:1px solid #9aa4ad;background:#fff;border-radius:6px;padding:2px 9px;cursor:pointer;font:inherit;";
  panel.querySelectorAll("#ce-body button").forEach((b) => (b.style.cssText = btnCss));

  for (const char of ["W", "L", "B", "D"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.char = char;
    b.title = `${CHAR_NAMES[char]}（${"WLBD".indexOf(char) + 1}）`;
    b.innerHTML =
      `<span style="display:inline-block;width:11px;height:11px;border-radius:3px;` +
      `margin-right:4px;vertical-align:-1px;border:1px solid rgba(0,0,0,.25);` +
      `background:${PANEL_CHARS[char]}"></span>${CHAR_NAMES[char]}`;
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
      const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_KEY) || "null");
      if (saved) return normalizeCitadelTerrain(saved);
    } catch { /* 损坏存档回落默认 */ }
    return normalizeCitadelTerrain(TERRAIN_DEFAULTS);
  }
  function persistTerrain() {
    try {
      localStorage.setItem(CITADEL_TERRAIN_KEY, JSON.stringify(terrain));
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
  const terrainObjectButtons = new Map([
    ["watchtower", panel.querySelector("#ce-object-watchtower")],
    ["elderTree", panel.querySelector("#ce-object-tree")],
    ["delete", panel.querySelector("#ce-object-delete")],
  ]);

  function selectTerrainObjectTool(tool) {
    terrainObjectTool = terrainObjectTool === tool ? null : tool;
    for (const [type, button] of terrainObjectButtons) {
      const active = type === terrainObjectTool;
      button.style.background = active ? "#2a2b2d" : "#fff";
      button.style.color = active ? "#fff" : "#2a2b2d";
    }
    terrainMapEl.style.cursor = terrainObjectTool ? "crosshair" : "pointer";
  }
  for (const [type, button] of terrainObjectButtons) {
    button.onclick = () => selectTerrainObjectTool(type);
  }

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
    const maxRadius = terrain.terraces.at(-1).radius;
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
    // Editable terrain-object markers share the same local x/z origin as 3D.
    for (const object of terrainObjects) {
      const selected = object.terraceIndex === activeTerrace;
      const px = cx + object.x * scale;
      const py = cy + object.z * scale;
      ctx.beginPath();
      ctx.arc(px, py, selected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = object.type === "watchtower" ? "#687985" : "#385e3e";
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffffff" : "rgba(255,255,255,.55)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(object.type === "watchtower" ? "塔" : "树", px, py);
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

  /** 鸟瞰图点击圆环 → 切换该台地及其五层城堡。 */
  terrainMapEl.addEventListener("click", (e) => {
    const rect = terrainMapEl.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (terrainMapEl.width / rect.width);
    const py = (e.clientY - rect.top) * (terrainMapEl.height / rect.height);
    const cx = terrainMapEl.width / 2;
    const cy = terrainMapEl.height / 2 + 8;
    const maxRadius = terrain.terraces.at(-1).radius;
    const maxDrawR = Math.min(terrainMapEl.width / 2 - 50, terrainMapEl.height / 2 - 16);
    const scale = maxDrawR / maxRadius;
    const rWorld = Math.hypot(px - cx, py - cy) / scale;
    if (terrainObjectTool) {
      const localX = (px - cx) / scale;
      const localZ = (py - cy) / scale;
      if (terrainObjectTool === "delete") {
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
        scale: type === "watchtower" ? 0.42 : 0.45,
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
      toast(type === "watchtower" ? "已放置瞭望塔" : "已放置参天树", 1.3);
      return;
    }
    const terraceIndex = terrain.terraces.findIndex((entry) => rWorld <= entry.radius);
    if (terraceIndex < 0) return;
    selectTerrace(terraceIndex);
    toast(`已切到台地 ${terraceIndex + 1}${terraceIndex === 0 ? "（最高）" : ""}`, 1.4);
  });

  // 鸟瞰图无需先切换“删除对象”工具：右键任意当前台地的塔/树标记即删。
  terrainMapEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = terrainMapEl.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (terrainMapEl.width / rect.width);
    const py = (e.clientY - rect.top) * (terrainMapEl.height / rect.height);
    const cx = terrainMapEl.width / 2;
    const cy = terrainMapEl.height / 2 + 8;
    const maxRadius = terrain.terraces.at(-1).radius;
    const maxDrawR = Math.min(terrainMapEl.width / 2 - 50, terrainMapEl.height / 2 - 16);
    const scale = maxDrawR / maxRadius;
    const localX = (px - cx) / scale;
    const localZ = (py - cy) / scale;
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
      toast(nearest.type === "watchtower" ? "已删除瞭望塔" : "已删除参天树", 1.3);
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
      terrain = normalizeCitadelTerrain({ ...terrain, terraces });
      terrainObjects = terrainObjects.filter((object) => citadelTerrainPointSupported(
        terrain,
        object.x,
        object.z,
        object.terraceIndex
      ));
      persistTerrainObjects();
      onTerrainObjectsChange([...terrainObjects]);
      input.value = String(value);
      val.textContent = value.toFixed(f.key === "radius" ? 2 : 1);
      persistTerrain();
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
    refreshTerrainInputs();
    try {
      localStorage.removeItem(CITADEL_TERRAIN_KEY);
    } catch { /* private mode */ }
    clearTimeout(terrainTimer);
    drawTerrainMap();
    onTerrainChange({ ...terrain });
    terrainObjects = terrainObjects.filter((object) => citadelTerrainPointSupported(
      terrain,
      object.x,
      object.z,
      object.terraceIndex
    ));
    persistTerrainObjects();
    onTerrainObjectsChange([...terrainObjects]);
    toast("已恢复内置台地地形", 1.6);
  };
  drawTerraceTabs();
  refreshTerrainInputs();
  drawTerrainMap();

  // ---------- 保存（编辑实时进 3D，点保存才写存档） ----------
  function applyDirty() {
    btnSave.textContent = dirty ? "保存 ●" : "保存";
    btnSave.style.background = dirty ? "#2a2b2d" : "#fff";
    btnSave.style.color = dirty ? "#fff" : "#2a2b2d";
    btnSave.title = dirty ? "有未保存改动（Ctrl+S 保存）" : "布局已保存（Ctrl+S）";
  }
  function save() {
    try {
      localStorage.setItem(CITADEL_LEVELS_KEY, JSON.stringify(serializeLayout()));
    } catch { /* private mode */ }
    dirty = false;
    applyDirty();
    toast("圣城布局已保存", 1.6);
  }
  btnSave.onclick = save;
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
  selectChar("W");

  function pushUndo() {
    undoStack.push(JSON.stringify({
      activeTerrace,
      terraces: terraceGrids.map((terraceGrid) => [...terraceGrid]),
    }));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }

  /** 布局变更统一出口：回调上层即时重建 3D → 重画面板 → 标脏（保存才落盘） */
  function commit(markDirty = true) {
    terraceGrids[activeTerrace] = grid;
    const stats = onApply(serializeLayout());
    if (markDirty) {
      dirty = true;
      applyDirty();
    }
    draw();
    if (stats) {
      statsEl.textContent =
        `格 ${stats.cellCount} · 穹顶 ${stats.domeCount} · 塔顶 ${stats.towerCount}` +
        ` · 坡顶 ${stats.roofCount} · 拱 ${stats.archCount} · 拱窗 ${stats.windowCount}` +
        ` · 城垛 ${stats.crenelCount} · 围栏 ${stats.fenceCount} · 绿植 ${stats.shrubCount}` +
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
          if (char === "D") {
            ctx2d.fillStyle = "#3a2412";
            ctx2d.fillRect(ix * gridPx + gridPx / 2 - 1.5, iz * gridPx + 3, 3, gridPx - 6);
          }
        }
        ctx2d.strokeStyle = "#c9d2d9";
        ctx2d.strokeRect(ix * gridPx + 0.5, iz * gridPx + 0.5, gridPx, gridPx);
      }
    }
    layerLabel.textContent = String(activeLayer + 1);
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
        toast("该格不在当前台地的可建面内", 1.6);
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
    activeLayer = Math.min(MAX_LEVEL, Math.max(0, activeLayer + delta));
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
    terraceGrids = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC).terraces.map((entry) =>
      levelsToGrid(entry.levels)
    );
    grid = terraceGrids[activeTerrace];
    commit();
    toast("已恢复内置圣城布局", 1.6);
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
    const palette = { Digit1: "W", Digit2: "L", Digit3: "B", Digit4: "D" };
    if (palette[e.code]) selectChar(palette[e.code]);
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
  function dropTarget(ix, iz) {
    const support = getSupportLevel(ix, iz, activeTerrace);
    return resolveCitadelDropTarget(grid, ix, iz, support, MAX_LEVEL);
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
    if (iy < 0 || iy > MAX_LEVEL) return false;
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
    },
    close() {
      open = false;
      panel.style.display = "none";
      io.style.display = "none";
      onLayerVisibility(activeTerrace, activeLayer, false); // 关面板恢复全楼可见
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
    deleteTerrainObject,
    maxLevel: MAX_LEVEL,
    maxCoord: MAX_COORD,
  };
  // Keep the backing canvas exactly equal to the fixed 25×25 building grid.
  // This makes its visual centre identical to cellCenter(12, *, 12).
  canvasEl.width = Math.round((MAX_COORD + 1) * gridPx);
  canvasEl.height = canvasEl.width;
  draw();
  return api;
}
