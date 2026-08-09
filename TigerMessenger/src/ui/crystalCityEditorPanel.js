// =====================================================================
//  水晶城 · 搭建面板（游戏内）
//  - 交互对齐「高山圣城 · 搭建」：可拖拽 / 收起 / 关闭
//  - 谷心俯视平面图：
//      · 左键拖动已有建筑 → 改位置（松手再重建 3D）
//      · 左键空地按下并拖动 → 放置当前工具并拖着定位
//      · 右键删除
//  - 「汇聚高地」一键生成较高山峦环带布局
//  - 松手 / 点选确认后 onApply 重建 3D；「保存」写 localStorage
// =====================================================================
import {
  CRYSTAL_CITY_LAYOUT_KEY,
  HIGH_RIDGE_RING,
  emptyCrystalLayout,
  generateHighRidgeLayout,
  loadCrystalLayoutFromStorage,
  normalizeCrystalLayout,
  saveCrystalLayoutToStorage,
  LAYOUT_CITY_FOOTPRINT,
  LAYOUT_BUILDING_SCALE,
} from "../world/crystalCityLayout.js";
import { makePanelDraggable } from "./dragPanel.js";

const POS_KEY = "tm.crystalCityEditor.pos";
const COLLAPSE_KEY = "tm.crystalCityEditor.collapsed";
const MAP = 312; // canvas px
const FOOT = LAYOUT_CITY_FOOTPRINT;

/**
 * @param {object} opts
 * @param {(layout: object) => object|void} opts.onApply
 * @param {(msg: string, dur?: number) => void} [opts.toast]
 */
export function createCrystalCityEditorPanel({ onApply, toast = () => {} }) {
  let layout = loadCrystalLayoutFromStorage() || generateHighRidgeLayout();
  layout = normalizeCrystalLayout(layout);
  let activeTool = "crystal"; // 'crystal' | 'grand' | 'gold'
  let open = false;
  let dirty = false;
  let undoStack = [];
  let redoStack = [];

  const panel = document.createElement("div");
  panel.id = "crystal-city-editor";
  panel.style.cssText =
    "position:fixed;right:16px;top:64px;z-index:40;width:352px;display:none;" +
    "background:rgba(255,255,255,.94);border:1px solid #c3ccd4;border-radius:10px;" +
    "box-shadow:0 6px 24px rgba(30,40,50,.18);font:13px/1.5 -apple-system,'PingFang SC',sans-serif;" +
    "color:#2a2b2d;overflow:hidden;";
  panel.innerHTML = `
    <div id="xc-head" style="display:flex;align-items:center;gap:6px;padding:7px 10px;
      background:#1a3a4a;color:#fff;border-radius:10px 10px 0 0;">
      <strong style="flex:1;font-size:13px;">水晶城 · 搭建</strong>
      <button type="button" id="xc-collapse" title="收起/展开"
        style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;">▾</button>
      <button type="button" id="xc-close" title="关闭"
        style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;">✕</button>
    </div>
    <div id="xc-body" style="padding:10px 12px 12px;">
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:8px;flex-wrap:wrap;" id="xc-palette"></div>
      <canvas id="xc-canvas" width="${MAP}" height="${MAP}"
        style="display:block;border:1px solid #d5dce2;border-radius:6px;cursor:grab;background:#eef4f6;touch-action:none;"></canvas>
      <div style="margin-top:6px;color:#5a6570;font-size:11px;">
        拖动建筑改位置 · 空地拖出新建筑 · 右键删除 · 绿环 = 较高山峦
      </div>
      <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">
        <button type="button" id="xc-ridge" title="重新生成高地汇聚布局">汇聚高地</button>
        <button type="button" id="xc-save" title="保存布局（Ctrl+S）">保存</button>
        <button type="button" id="xc-undo" title="撤销">撤销</button>
        <button type="button" id="xc-redo" title="重做">重做</button>
        <button type="button" id="xc-reset" title="恢复默认高地布局">重置</button>
        <button type="button" id="xc-clear" title="清空">清空</button>
      </div>
      <div id="xc-stats" style="margin-top:7px;color:#4a5560;font:11px/1.5 monospace;"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector("#xc-body");
  const canvas = panel.querySelector("#xc-canvas");
  const ctx = canvas.getContext("2d");
  const elStats = panel.querySelector("#xc-stats");
  const btnSave = panel.querySelector("#xc-save");

  const btnStyle =
    "border:1px solid #9aa4ad;background:#fff;border-radius:6px;padding:2px 9px;cursor:pointer;font:inherit;";
  panel.querySelectorAll("button").forEach((b) => {
    if (b.id === "xc-collapse" || b.id === "xc-close") return;
    b.style.cssText = btnStyle;
  });

  // 调色板
  const tools = [
    { id: "grand", label: "母皇花厅", color: "#d4af37" },
    { id: "gold", label: "金鳞花厅", color: "#c9a227" },
    { id: "crystal", label: "晶体", color: "#7eb0ff" },
  ];
  const palette = panel.querySelector("#xc-palette");
  for (const t of tools) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.tool = t.id;
    b.style.cssText = btnStyle;
    b.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.color};margin-right:4px;vertical-align:middle"></span>${t.label}`;
    b.addEventListener("click", () => {
      activeTool = t.id;
      paintPalette();
    });
    palette.appendChild(b);
  }
  function paintPalette() {
    palette.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.tool === activeTool;
      b.style.background = on ? "#1a3a4a" : "#fff";
      b.style.color = on ? "#fff" : "#2a2b2d";
    });
  }
  paintPalette();

  makePanelDraggable(panel, panel.querySelector("#xc-head"), POS_KEY);
  try {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") body.style.display = "none";
  } catch { /* */ }

  function setDirty(v) {
    dirty = v;
    btnSave.textContent = dirty ? "保存 ●" : "保存";
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(layout));
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
  }

  function applyNow() {
    try {
      onApply?.(normalizeCrystalLayout(layout));
    } catch (e) {
      console.warn("[crystalCityEditor] onApply", e);
      toast("重建失败", 2);
    }
    updateStats();
    draw();
  }

  function updateStats() {
    elStats.textContent =
      `花厅 ${layout.halls.length} · 晶体 ${layout.crystals.length}` +
      (dirty ? " · 未保存" : " · 已同步");
  }

  // ----- 坐标：canvas ↔ 局部角坐标 -----
  function toLocal(mx, my) {
    const s = (FOOT * 2.2) / MAP; // 略留边
    const lx = (mx - MAP / 2) * s;
    const lz = (my - MAP / 2) * s;
    return { lx, lz };
  }
  function toCanvas(lx, lz) {
    const s = MAP / (FOOT * 2.2);
    return { x: MAP / 2 + lx * s, y: MAP / 2 + lz * s };
  }

  function hitTest(lx, lz, rad = 0.04) {
    for (let i = layout.halls.length - 1; i >= 0; i--) {
      const h = layout.halls[i];
      if (Math.hypot(h.lx - lx, h.lz - lz) < rad * 1.5) return { type: "hall", index: i };
    }
    for (let i = layout.crystals.length - 1; i >= 0; i--) {
      const c = layout.crystals[i];
      if (Math.hypot(c.lx - lx, c.lz - lz) < rad) return { type: "crystal", index: i };
    }
    return null;
  }

  function getDragTarget(drag) {
    if (!drag) return null;
    if (drag.type === "hall") return layout.halls[drag.index] || null;
    return layout.crystals[drag.index] || null;
  }

  /** 拖动中的建筑：{ type, index, isNew, moved, pointerId } */
  let drag = null;

  function pointerToLocal(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * MAP;
    const my = ((e.clientY - rect.top) / rect.height) * MAP;
    return toLocal(mx, my);
  }

  function clampLocal(lx, lz) {
    // 略放宽到足迹外缘，仍以城市域为主
    const maxR = FOOT * 1.05;
    const rho = Math.hypot(lx, lz);
    if (rho <= maxR || rho < 1e-8) return { lx, lz };
    return { lx: (lx / rho) * maxR, lz: (lz / rho) * maxR };
  }

  function drawCrystal(p, highlight = false) {
    ctx.fillStyle = highlight ? "#a8d4ff" : "#7eb0ff";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 7);
    ctx.lineTo(p.x + 5, p.y + 6);
    ctx.lineTo(p.x - 5, p.y + 6);
    ctx.closePath();
    ctx.fill();
    if (highlight) {
      ctx.strokeStyle = "#1a3a4a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawHall(h, p, highlight = false) {
    const r = h.kind === "grand" ? 9 : 7;
    ctx.fillStyle = highlight
      ? h.kind === "grand"
        ? "#e8c84a"
        : "#e0bf3a"
      : h.kind === "grand"
        ? "#d4af37"
        : "#c9a227";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = highlight ? "#1a3a4a" : "#2a2b2d";
    ctx.lineWidth = highlight ? 2 : 1;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, MAP, MAP);
    // 高地环带
    const s = MAP / (FOOT * 2.2);
    ctx.save();
    ctx.translate(MAP / 2, MAP / 2);
    ctx.strokeStyle = "#b8c8c0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, FOOT * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(85,135,95,0.14)";
    ctx.beginPath();
    ctx.arc(0, 0, HIGH_RIDGE_RING.outer * s, 0, Math.PI * 2);
    ctx.arc(0, 0, HIGH_RIDGE_RING.inner * s, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,110,70,0.45)";
    ctx.beginPath();
    ctx.arc(0, 0, HIGH_RIDGE_RING.outer * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, HIGH_RIDGE_RING.inner * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < layout.crystals.length; i++) {
      const c = layout.crystals[i];
      const p = toCanvas(c.lx, c.lz);
      const hi = drag?.type === "crystal" && drag.index === i;
      drawCrystal(p, hi);
    }
    for (let i = 0; i < layout.halls.length; i++) {
      const h = layout.halls[i];
      const p = toCanvas(h.lx, h.lz);
      const hi = drag?.type === "hall" && drag.index === i;
      drawHall(h, p, hi);
    }
  }

  function placeNewAt(lx, lz) {
    const pos = clampLocal(lx, lz);
    if (activeTool === "crystal") {
      layout.crystals.push({
        id: `c-${Date.now()}`,
        lx: pos.lx,
        lz: pos.lz,
        r: (0.55 + Math.random() * 0.7) * LAYOUT_BUILDING_SCALE,
        hMul: 0.85 + Math.random() * 0.4,
        seg: 4 + ((Math.random() * 3) | 0),
        tx: (Math.random() - 0.5) * 0.2,
        tz: (Math.random() - 0.5) * 0.2,
      });
      return { type: "crystal", index: layout.crystals.length - 1, isNew: true };
    }
    if (activeTool === "grand") {
      layout.halls = layout.halls.filter((h) => h.kind !== "grand");
    }
    layout.halls.push({
      id: `hall-${Date.now()}`,
      kind: activeTool === "gold" ? "gold" : "grand",
      lx: pos.lx,
      lz: pos.lz,
      scale: activeTool === "gold" ? 0.45 : 1,
      seed: 700 + ((Math.random() * 200) | 0),
    });
    return { type: "hall", index: layout.halls.length - 1, isNew: true };
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    const { lx, lz } = pointerToLocal(e);
    if (e.button === 2) {
      if (drag) return;
      const hit = hitTest(lx, lz);
      if (!hit) return;
      pushUndo();
      if (hit.type === "hall") layout.halls.splice(hit.index, 1);
      else layout.crystals.splice(hit.index, 1);
      setDirty(true);
      applyNow();
      return;
    }
    if (e.button !== 0) return;

    const hit = hitTest(lx, lz);
    pushUndo();
    if (hit) {
      // 拖动已有建筑
      drag = { ...hit, isNew: false, moved: false, pointerId: e.pointerId };
    } else {
      // 空地：生成新建筑并进入拖动定位
      const created = placeNewAt(lx, lz);
      drag = { ...created, moved: false, pointerId: e.pointerId };
      setDirty(true);
    }
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) {
      // 悬停反馈
      if (!drag) {
        const { lx, lz } = pointerToLocal(e);
        canvas.style.cursor = hitTest(lx, lz) ? "grab" : "crosshair";
      }
      return;
    }
    const { lx, lz } = pointerToLocal(e);
    const pos = clampLocal(lx, lz);
    const target = getDragTarget(drag);
    if (!target) return;
    target.lx = pos.lx;
    target.lz = pos.lz;
    drag.moved = true;
    setDirty(true);
    draw(); // 拖动中只刷新 2D，松手再重建 3D
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const wasNew = drag.isNew;
    const moved = drag.moved;
    try {
      canvas.releasePointerCapture(drag.pointerId);
    } catch { /* already released */ }
    drag = null;
    canvas.style.cursor = "grab";
    // 新放或移动过：重建场景
    if (wasNew || moved) {
      applyNow();
      if (moved && !wasNew) toast("已移动建筑", 1.0);
    } else {
      // 点了已有建筑但没拖：撤销多余 undo 栈，并提示
      if (undoStack.length) {
        // 未改坐标，弹掉刚才 push 的快照
        undoStack.pop();
      }
      draw();
      toast("拖动可改位置 · 右键删除", 1.4);
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", (e) => {
    // 捕获中离开画布仍继续拖；未捕获则复位光标
    if (!drag) canvas.style.cursor = "grab";
  });

  panel.querySelector("#xc-ridge").addEventListener("click", () => {
    pushUndo();
    layout = generateHighRidgeLayout((Math.random() * 1e9) | 0);
    setDirty(true);
    applyNow();
    toast("已汇聚到较高山峦环带", 2);
  });
  panel.querySelector("#xc-save").addEventListener("click", () => {
    saveCrystalLayoutToStorage(layout);
    setDirty(false);
    updateStats();
    toast("水晶城布局已保存", 1.8);
  });
  panel.querySelector("#xc-undo").addEventListener("click", () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(layout));
    layout = normalizeCrystalLayout(JSON.parse(undoStack.pop()));
    setDirty(true);
    applyNow();
  });
  panel.querySelector("#xc-redo").addEventListener("click", () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(layout));
    layout = normalizeCrystalLayout(JSON.parse(redoStack.pop()));
    setDirty(true);
    applyNow();
  });
  panel.querySelector("#xc-reset").addEventListener("click", () => {
    pushUndo();
    layout = generateHighRidgeLayout();
    setDirty(true);
    applyNow();
    toast("已恢复默认高地布局", 1.8);
  });
  panel.querySelector("#xc-clear").addEventListener("click", () => {
    pushUndo();
    layout = emptyCrystalLayout();
    setDirty(true);
    applyNow();
  });
  panel.querySelector("#xc-close").addEventListener("click", () => close());
  panel.querySelector("#xc-collapse").addEventListener("click", () => {
    const collapsed = body.style.display === "none";
    body.style.display = collapsed ? "" : "none";
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch { /* */ }
  });

  window.addEventListener("keydown", (e) => {
    if (!open) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveCrystalLayoutToStorage(layout);
      setDirty(false);
      updateStats();
      toast("水晶城布局已保存", 1.5);
    }
  });

  function openPanel() {
    open = true;
    panel.style.display = "block";
    draw();
    updateStats();
  }
  function close() {
    open = false;
    panel.style.display = "none";
  }

  draw();
  updateStats();

  return {
    open: openPanel,
    close,
    toggle() {
      if (open) close();
      else openPanel();
    },
    isOpen: () => open,
    element: panel,
    getLayout: () => normalizeCrystalLayout(layout),
    setLayout(next) {
      layout = normalizeCrystalLayout(next);
      setDirty(true);
      draw();
      updateStats();
    },
  };
}

export { CRYSTAL_CITY_LAYOUT_KEY };
