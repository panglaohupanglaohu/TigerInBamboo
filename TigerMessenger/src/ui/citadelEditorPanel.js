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
  levelsToGrid,
  gridToLevels,
  setCell,
  clearCell,
} from "../world/citadelTown.js";
import { CITADEL, CITADEL_TERRAIN_KEY } from "../world/odysseyCitadel.js";
import { makePanelDraggable } from "./dragPanel.js";

const MAX_COORD = 23; // ix/iz ∈ [0, 23]（24×24 网格，滚轮缩放平面图）
const MAX_LEVEL = 9;
const DEFAULT_GRID_PX = 13; // 平面图默认每格像素（24×13 = 312）
const POS_KEY = "tm.citadelEditor.pos";
const COLLAPSE_KEY = "tm.citadelEditor.collapsed";
const DROP_KEY = "tm.citadelEditor.dropToGround";
const PANEL_CHARS = { W: "#e5eff2", L: "#d9cfac", B: "#caa88c", D: "#8b5a2b" };
const CHAR_NAMES = { W: "白石", L: "浅砂石", B: "淡砖", D: "正门" };
const CELL = CITADEL_TOWN_SPEC.cellSize;
const CELL_H = CITADEL_TOWN_SPEC.cellHeight;

/**
 * @param {object} opts
 * @param {(levels: string[][], stats?: object) => void} opts.onApply 布局变更回调
 * @param {(activeLayer: number, hideAbove: boolean) => void} [opts.onLayerVisibility]
 *        当前层 / 隐藏高层变化（开关面板时也会回调，关闭时强制全部可见）
 * @param {(action: "center"|"orbitL"|"orbitR"|"top") => void} [opts.onViewAction]
 *        视角行按钮：居中 / 绕圣城 90° / 到顶
 * @param {(contour: object) => void} [opts.onTerrainChange] 台地参数变更（地形地貌编辑器）
 * @param {(ix: number, iz: number) => number} [opts.getSupportLevel]
 *        土坡支撑探测：返回该柱可落块的层级，-1 = 无承重土坡（默认 0 = 全可放）
 * @param {(msg: string, dur?: number) => void} [opts.toast]
 * @returns {{
 *   open(): void, close(): void, toggle(): void, isOpen(): boolean, element: HTMLElement,
 *   getState(): { activeChar: string, activeLayer: number, hideAbove: boolean, dropToGround: boolean },
 *   applySceneEdit(target: {ix:number,iy:number,iz:number}, mode: "place"|"erase"): boolean,
 *   cellCenter(ix: number, iy: number, iz: number): {x:number,y:number,z:number},
 *   cellAtLocal(x: number, z: number, iy: number): {ix:number,iy:number,iz:number}|null,
 *   dropTarget(ix: number, iz: number): {ix:number,iy:number,iz:number}|null, // null = 无土坡承重
 *   maxLevel: number, maxCoord: number,
 * }}
 */
export function createCitadelEditorPanel({
  onApply,
  onLayerVisibility = () => {},
  onViewAction = () => {},
  onTerrainChange = () => {},
  getSupportLevel = () => 0,
  toast = () => {},
}) {
  // ---------- 状态 ----------
  let grid = loadGrid();
  let activeChar = "W";
  let activeLayer = 0;
  let hideAbove = false;
  let dropToGround = true; // 空地加块自动堆到柱顶（落地），关闭则悬在当前层
  let gridPx = DEFAULT_GRID_PX;
  let undoStack = [];
  let redoStack = [];
  let open = false;
  let dirty = false; // 有未保存改动（编辑实时进 3D，保存才落盘）
  try {
    dropToGround = localStorage.getItem(DROP_KEY) !== "0";
  } catch { /* private mode */ }

  function loadGrid() {
    try {
      const saved = JSON.parse(localStorage.getItem(CITADEL_LEVELS_KEY) || "null");
      if (Array.isArray(saved) && saved.length) return levelsToGrid(saved);
    } catch { /* 损坏存档回落 SPEC */ }
    return levelsToGrid(CITADEL_TOWN_SPEC.levels);
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
    <div id="ce-body" style="padding:10px 12px 12px;">
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:8px;" id="ce-palette"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <button type="button" id="ce-prev" title="上一层（Q）">◀</button>
        <span>第 <b id="ce-layer">0</b> 层</span>
        <button type="button" id="ce-next" title="下一层（E）">▶</button>
        <button type="button" id="ce-hide" title="隐藏更高层（H）">隐藏高层</button>
        <button type="button" id="ce-drop"
          title="落地堆叠：3D 空地加块自动堆到该柱最高块之上（无块落到 0 层，匹配地势）；关闭则悬在当前层">落地</button>
        <span style="flex:1"></span>
        <button type="button" id="ce-undo" title="撤销（Ctrl+Z）">撤销</button>
        <button type="button" id="ce-redo" title="重做">重做</button>
      </div>
      <div style="max-width:100%;overflow:auto;">
        <canvas id="ce-canvas" width="312" height="312"
          style="display:block;border:1px solid #d5dce2;border-radius:6px;cursor:crosshair;"></canvas>
      </div>
      <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">
        <button type="button" id="ce-save" title="保存布局到存档（Ctrl+S）">保存</button>
        <button type="button" id="ce-reset" title="恢复内置布局">重置为 SPEC</button>
        <button type="button" id="ce-clear" title="清空全部体块">清空</button>
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
      <div style="margin-top:8px;border-top:1px solid #dbe2e8;padding-top:6px;">
        <div id="ce-terrain-head" style="cursor:pointer;user-select:none;font-weight:600;">
          <span id="ce-terrain-arrow">▸</span> 地形地貌（台地土坡）
        </div>
        <div id="ce-terrain-body" style="display:none;margin-top:6px;">
          <div id="ce-terrain-sliders"></div>
          <div style="display:flex;gap:6px;margin-top:5px;align-items:center;">
            <button type="button" id="ce-terrain-reset" title="恢复内置台地参数">重置地形</button>
            <span style="color:#8a96a1;font:10px/1.4 monospace;">层数固定 5（石阶为五段手工布局）· 改动即时重建并自动保存</span>
          </div>
        </div>
      </div>
      <div id="ce-stats" style="margin-top:7px;color:#4a5560;font:11px/1.5 monospace;"></div>
      <div style="margin-top:4px;color:#8a96a1;font:10px/1.5 monospace;">
        平面图：左键 放块/改色 · 右键 删块 · 滚轮 缩放网格 · 图顶=后排 图底=前排（正门）<br/>
        3D 直编辑：左键 点顶面叠块/侧面改色/空地加块 · 右键 删块 · H 隐藏高层<br/>
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
    onLayerVisibility(activeLayer, hideAbove);
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

  // ---------- 地形地貌编辑器（台地土坡参数 → 即时重建外围地势） ----------
  const TERRAIN_DEFAULTS = { ...CITADEL.contourTerrain };
  let terrain = loadTerrain();
  function loadTerrain() {
    try {
      const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_KEY) || "null");
      if (saved && Number.isFinite(saved.baseRadius)) return { ...TERRAIN_DEFAULTS, ...saved };
    } catch { /* 损坏存档回落默认 */ }
    return { ...TERRAIN_DEFAULTS };
  }
  function persistTerrain() {
    try {
      localStorage.setItem(CITADEL_TERRAIN_KEY, JSON.stringify(terrain));
    } catch { /* private mode */ }
  }
  const terrainHead = panel.querySelector("#ce-terrain-head");
  const terrainBody = panel.querySelector("#ce-terrain-body");
  const terrainArrow = panel.querySelector("#ce-terrain-arrow");
  terrainHead.onclick = () => {
    const show = terrainBody.style.display === "none";
    terrainBody.style.display = show ? "block" : "none";
    terrainArrow.textContent = show ? "▾" : "▸";
  };
  const TERRAIN_FIELDS = [
    { key: "baseRadius", label: "基底半径", min: 16, max: 32, step: 1 },
    { key: "layerHeight", label: "层高", min: 1.4, max: 2.6, step: 0.1 },
    { key: "shrink", label: "收分", min: 0.78, max: 0.95, step: 0.01 },
    { key: "coreRadius", label: "核心半径", min: 6, max: 12, step: 0.5 },
  ];
  const slidersEl = panel.querySelector("#ce-terrain-sliders");
  let terrainTimer = 0;
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
    input.value = terrain[f.key];
    input.style.flex = "1";
    input.dataset.terrainKey = f.key;
    const val = document.createElement("span");
    val.style.cssText = "width:34px;text-align:right;font:11px monospace;";
    val.textContent = String(terrain[f.key]);
    input.addEventListener("input", () => {
      terrain = { ...terrain, [f.key]: Number(input.value) };
      val.textContent = input.value;
      persistTerrain();
      clearTimeout(terrainTimer); // 拖动防抖，松手 150ms 后重建
      terrainTimer = setTimeout(() => onTerrainChange({ ...terrain }), 150);
    });
    row.append(label, input, val);
    slidersEl.appendChild(row);
  }
  panel.querySelector("#ce-terrain-reset").onclick = () => {
    terrain = { ...TERRAIN_DEFAULTS };
    slidersEl.querySelectorAll("input").forEach((input) => {
      input.value = terrain[input.dataset.terrainKey];
      input.nextElementSibling.textContent = input.value;
    });
    try {
      localStorage.removeItem(CITADEL_TERRAIN_KEY);
    } catch { /* private mode */ }
    clearTimeout(terrainTimer);
    onTerrainChange({ ...terrain });
    toast("已恢复内置台地地形", 1.6);
  };

  // ---------- 保存（编辑实时进 3D，点保存才写存档） ----------
  function applyDirty() {
    btnSave.textContent = dirty ? "保存 ●" : "保存";
    btnSave.style.background = dirty ? "#2a2b2d" : "#fff";
    btnSave.style.color = dirty ? "#fff" : "#2a2b2d";
    btnSave.title = dirty ? "有未保存改动（Ctrl+S 保存）" : "布局已保存（Ctrl+S）";
  }
  function save() {
    try {
      localStorage.setItem(CITADEL_LEVELS_KEY, JSON.stringify(gridToLevels(grid)));
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
    undoStack.push(JSON.stringify([...grid]));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }

  /** 布局变更统一出口：回调上层即时重建 3D → 重画面板 → 标脏（保存才落盘） */
  function commit(markDirty = true) {
    const levels = gridToLevels(grid);
    const stats = onApply(levels);
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
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const char = grid.get(`${ix},${activeLayer},${iz}`);
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
    layerLabel.textContent = String(activeLayer);
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
    onLayerVisibility(activeLayer, hideAbove);
  }
  panel.querySelector("#ce-prev").onclick = () => stepLayer(-1);
  panel.querySelector("#ce-next").onclick = () => stepLayer(1);

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify([...grid]));
    grid = new Map(JSON.parse(undoStack.pop()));
    commit();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify([...grid]));
    grid = new Map(JSON.parse(redoStack.pop()));
    commit();
  }
  panel.querySelector("#ce-undo").onclick = undo;
  panel.querySelector("#ce-redo").onclick = redo;
  panel.querySelector("#ce-reset").onclick = () => {
    pushUndo();
    grid = levelsToGrid(CITADEL_TOWN_SPEC.levels);
    commit();
    toast("已恢复内置圣城布局", 1.6);
  };
  panel.querySelector("#ce-clear").onclick = () => {
    pushUndo();
    grid = new Map();
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
    let cols = 0;
    let rows = 0;
    for (const key of grid.keys()) {
      const [ix, , iz] = key.split(",").map(Number);
      if (ix + 1 > cols) cols = ix + 1;
      if (iz + 1 > rows) rows = iz + 1;
    }
    return { cols: Math.max(cols, 1), rows: Math.max(rows, 1) };
  }

  /** 格中心在 level 组局部坐标（未含 townBaseY 抬升，由调用方按参考组变换）。 */
  function cellCenter(ix, iy, iz) {
    const { cols, rows } = gridDims();
    return {
      x: (ix - (cols - 1) / 2) * CELL,
      y: (iy + 0.5) * CELL_H,
      z: (iz - (rows - 1) / 2) * CELL,
    };
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
    for (let iy = MAX_LEVEL - 1; iy >= 0; iy--) {
      if (grid.has(`${ix},${iy},${iz}`)) return { ix, iy: iy + 1, iz };
    }
    const support = getSupportLevel(ix, iz);
    if (support < 0 || support > MAX_LEVEL) return null;
    return { ix, iy: support, iz };
  }

  /**
   * 场景直编辑统一入口：place = 放块/改色（用当前材质），erase = 删块。
   * 无变化返回 false（不进撤销栈）；有变化走 commit 即时重建。
   */
  function applySceneEdit({ ix, iy, iz }, mode) {
    if (ix < 0 || ix > MAX_COORD || iz < 0 || iz > MAX_COORD) return false;
    if (iy < 0 || iy > MAX_LEVEL) return false;
    const existing = grid.get(`${ix},${iy},${iz}`);
    if (mode === "erase") {
      if (!existing) return false;
      pushUndo();
      clearCell(grid, ix, iy, iz);
    } else {
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
      commit(false); // 初次打开：同步一次当前布局与统计（不算未保存改动）
      applyHideAbove(); // 重新断言一次层可见性
    },
    close() {
      open = false;
      panel.style.display = "none";
      io.style.display = "none";
      onLayerVisibility(activeLayer, false); // 关面板恢复全楼可见
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    isOpen: () => open,
    getState: () => ({ activeChar, activeLayer, hideAbove, dropToGround }),
    applySceneEdit,
    cellCenter,
    cellAtLocal,
    dropTarget,
    maxLevel: MAX_LEVEL,
    maxCoord: MAX_COORD,
  };
  draw();
  return api;
}
