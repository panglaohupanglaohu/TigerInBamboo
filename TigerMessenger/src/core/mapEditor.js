// =====================================================================
//  地图编辑器（开发者 🤖 菜单 · Map）
//  - 顶视平面图选中 / 拖动建筑
//  - 复制实例、从目录放置到任意位置
//  - 贴球面 + 高度场；碰撞体同步；布局写 localStorage
// =====================================================================
import * as THREE from "three";
import { placeObjectOnSphere } from "../world/sphereMath.js";
import { groundLiftAt, ISLAND_BASE_LIFT, worldToFlatXZ } from "../world/hills.js";
import { PLANET_RADIUS } from "../world/planet.js";
import { getBuildingDef, listBuildingTypes } from "./buildingCatalog.js";

const STORAGE_KEY = "tm.mapEditor.placements.v1";
const MAP_EXTENT = 20; // 平面图半宽（世界 flat 单位）

/**
 * @param {object} opts
 * @param {import("three").Scene} opts.scene
 * @param {number} [opts.planetRadius]
 * @param {object[]} opts.colliders  可写数组（push / 改 position）
 * @param {(msg: string, dur?: number) => void} [opts.toast]
 */
export function createMapEditor({
  scene,
  planetRadius = PLANET_RADIUS,
  colliders,
  toast = () => {},
}) {
  /** @type {MapPlacement[]} */
  const placements = [];
  let selectedUid = null;
  let placeModeType = null; // 点击地图放置的类型
  let dragging = false;
  let open = false;
  let uidSeq = 1;

  // ---------- UI ----------
  const overlay = document.createElement("div");
  overlay.id = "map-editor";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="map-editor-card">
      <div class="map-editor-head">
        <strong>地图编辑 · 建筑</strong>
        <button type="button" id="map-editor-close" title="关闭">✕</button>
      </div>
      <p class="map-editor-hint">
        点选标记拖动移动 · 「复制」克隆 · 下方选类型后点地图放置 · 自动贴地
      </p>
      <canvas id="map-canvas" width="360" height="360" aria-label="主岛平面图"></canvas>
      <div class="map-editor-coords"><span id="map-cursor">x: —  z: —</span>
        <span id="map-selected">未选中</span></div>
      <div class="map-editor-tools">
        <button type="button" id="map-btn-copy" disabled>复制</button>
        <button type="button" id="map-btn-delete" disabled>删除</button>
        <label class="map-yaw">朝向
          <input type="range" id="map-yaw" min="-3.14" max="3.14" step="0.05" value="0" disabled>
        </label>
      </div>
      <div class="map-editor-group">放置类型</div>
      <div class="map-palette" id="map-palette"></div>
      <div class="map-editor-group">已放置</div>
      <ul class="map-list" id="map-list"></ul>
      <div class="map-editor-foot">
        <button type="button" id="map-btn-save">保存布局</button>
        <button type="button" id="map-btn-clear-place">取消放置模式</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector("#map-canvas");
  const ctx = canvas.getContext("2d");
  const elCursor = overlay.querySelector("#map-cursor");
  const elSelected = overlay.querySelector("#map-selected");
  const elList = overlay.querySelector("#map-list");
  const elPalette = overlay.querySelector("#map-palette");
  const btnCopy = overlay.querySelector("#map-btn-copy");
  const btnDelete = overlay.querySelector("#map-btn-delete");
  const yawSlider = overlay.querySelector("#map-yaw");

  // 调色板
  for (const def of listBuildingTypes()) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "map-palette-item";
    b.dataset.type = def.id;
    b.innerHTML = `<i style="background:${def.color || "#888"}"></i>${def.label}`;
    b.title = `放置：${def.label}`;
    b.addEventListener("click", () => {
      placeModeType = def.id;
      selectedUid = null;
      [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
        el.classList.toggle("active", el.dataset.type === def.id)
      );
      toast(`放置模式：${def.label}（点地图落点）`, 1.6);
      redraw();
      refreshList();
      syncTools();
    });
    elPalette.appendChild(b);
  }

  overlay.querySelector("#map-editor-close").addEventListener("click", () => setOpen(false));
  overlay.querySelector("#map-btn-clear-place").addEventListener("click", () => {
    placeModeType = null;
    [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
      el.classList.remove("active")
    );
    toast("已退出放置模式", 1.2);
  });
  overlay.querySelector("#map-btn-save").addEventListener("click", () => {
    persist();
    toast("布局已保存到本机", 1.5);
  });

  btnCopy.addEventListener("click", () => {
    const p = getSelected();
    if (!p) return;
    const copy = spawnPlacement(p.type, p.x + 1.2, p.z + 1.2, p.yaw + 0.2);
    if (copy) {
      selectedUid = copy.uid;
      placeModeType = null;
      toast(`已复制 ${copy.label}`, 1.4);
      redraw();
      refreshList();
      syncTools();
      persist();
    }
  });

  btnDelete.addEventListener("click", () => {
    const p = getSelected();
    if (!p) return;
    removePlacement(p.uid);
    selectedUid = null;
    toast("已删除", 1.2);
    redraw();
    refreshList();
    syncTools();
    persist();
  });

  yawSlider.addEventListener("input", () => {
    const p = getSelected();
    if (!p) return;
    p.yaw = Number(yawSlider.value);
    applyPose(p);
    redraw();
    persist();
  });

  // 地图交互
  canvas.addEventListener("pointerdown", (e) => {
    const { x, z } = canvasToFlat(e);
    if (placeModeType) {
      const p = spawnPlacement(placeModeType, x, z, getBuildingDef(placeModeType)?.defaultYaw ?? 0);
      if (p) {
        selectedUid = p.uid;
        placeModeType = null;
        [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
          el.classList.remove("active")
        );
        toast(`已放置 ${p.label}`, 1.3);
        persist();
      }
      redraw();
      refreshList();
      syncTools();
      return;
    }
    const hit = pickNearest(x, z, 1.6);
    selectedUid = hit ? hit.uid : null;
    dragging = !!hit;
    if (hit) canvas.setPointerCapture(e.pointerId);
    redraw();
    refreshList();
    syncTools();
  });

  canvas.addEventListener("pointermove", (e) => {
    const { x, z } = canvasToFlat(e);
    elCursor.textContent = `x: ${x.toFixed(1)}  z: ${z.toFixed(1)}`;
    if (dragging && selectedUid) {
      const p = getSelected();
      if (p) {
        p.x = x;
        p.z = z;
        applyPose(p);
        redraw();
      }
    } else {
      redraw(x, z);
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (dragging) {
      dragging = false;
      persist();
      refreshList();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    elCursor.textContent = "x: —  z: —";
  });

  // ---------- 逻辑 ----------

  /**
   * @typedef {object} MapPlacement
   * @property {string} uid
   * @property {string} type
   * @property {string} label
   * @property {number} x
   * @property {number} z
   * @property {number} yaw
   * @property {import("three").Object3D} object
   * @property {{position: THREE.Vector3, radius: number} | null} collider
   */

  function canvasToFlat(e) {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    // 画布中心 = 原点；y 向下 → z 向上（地图常用）
    const x = ((px / canvas.width) * 2 - 1) * MAP_EXTENT;
    const z = (1 - (py / canvas.height) * 2) * MAP_EXTENT;
    return { x, z };
  }

  function flatToCanvas(x, z) {
    const px = ((x / MAP_EXTENT + 1) / 2) * canvas.width;
    const py = ((1 - z / MAP_EXTENT) / 2) * canvas.height;
    return { px, py };
  }

  function liftAt(x, z) {
    try {
      return groundLiftAt(x, z);
    } catch {
      return ISLAND_BASE_LIFT;
    }
  }

  function applyPose(p) {
    const lift = liftAt(p.x, p.z);
    placeObjectOnSphere(p.object, p.x, p.z, lift, planetRadius);
    p.object.rotateY(p.yaw);
    if (p.collider) {
      p.collider.position.copy(p.object.position);
    }
  }

  function spawnPlacement(typeId, x, z, yaw = 0) {
    const def = getBuildingDef(typeId);
    if (!def) {
      toast(`未知建筑类型：${typeId}`, 1.5);
      return null;
    }
    const object = def.create();
    object.userData.mapEditable = true;
    object.userData.mapType = typeId;
    const uid = `b${uidSeq++}`;
    object.userData.mapUid = uid;
    scene.add(object);

    let collider = null;
    const cr = object.userData.collideRadius ?? def.collideRadius ?? 0;
    if (cr >= 0.15 && colliders) {
      collider = { position: object.position.clone(), radius: cr * (object.scale?.x || 1) };
      colliders.push(collider);
    }

    /** @type {MapPlacement} */
    const p = {
      uid,
      type: typeId,
      label: def.label,
      x,
      z,
      yaw,
      object,
      collider,
    };
    applyPose(p);
    placements.push(p);
    return p;
  }

  function removePlacement(uid) {
    const i = placements.findIndex((p) => p.uid === uid);
    if (i < 0) return;
    const p = placements[i];
    if (p.object?.parent) p.object.parent.remove(p.object);
    if (p.collider && colliders) {
      const ci = colliders.indexOf(p.collider);
      if (ci >= 0) colliders.splice(ci, 1);
    }
    placements.splice(i, 1);
  }

  function getSelected() {
    return placements.find((p) => p.uid === selectedUid) || null;
  }

  function pickNearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of placements) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * 登记场景里已有的建筑（如书店），纳入编辑器
   * @param {string} typeId
   * @param {import("three").Object3D} object
   * @param {number} x
   * @param {number} z
   * @param {number} [yaw]
   * @param {{position:THREE.Vector3,radius:number}|null} [collider]
   */
  function registerExisting(typeId, object, x, z, yaw = 0, collider = null) {
    const def = getBuildingDef(typeId);
    const uid = object.userData.mapUid || `b${uidSeq++}`;
    object.userData.mapEditable = true;
    object.userData.mapType = typeId;
    object.userData.mapUid = uid;
    const p = {
      uid,
      type: typeId,
      label: def?.label || typeId,
      x,
      z,
      yaw,
      object,
      collider,
    };
    placements.push(p);
    return p;
  }

  function redraw(hoverX, hoverZ) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // 背景
    ctx.fillStyle = "#e8f0e8";
    ctx.fillRect(0, 0, w, h);
    // 主岛圆
    const c = flatToCanvas(0, 0);
    const rPx = (18 / MAP_EXTENT) * (w / 2);
    ctx.beginPath();
    ctx.arc(c.px, c.py, rPx, 0, Math.PI * 2);
    ctx.fillStyle = "#7db88a";
    ctx.fill();
    ctx.strokeStyle = "#3d6b48";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 网格
    ctx.strokeStyle = "rgba(26,38,56,0.12)";
    ctx.lineWidth = 1;
    for (let i = -MAP_EXTENT; i <= MAP_EXTENT; i += 5) {
      const a = flatToCanvas(i, -MAP_EXTENT);
      const b = flatToCanvas(i, MAP_EXTENT);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
      const c0 = flatToCanvas(-MAP_EXTENT, i);
      const c1 = flatToCanvas(MAP_EXTENT, i);
      ctx.beginPath();
      ctx.moveTo(c0.px, c0.py);
      ctx.lineTo(c1.px, c1.py);
      ctx.stroke();
    }
    // 出生点
    const spawn = flatToCanvas(0, 6);
    ctx.fillStyle = "#2f8f7a";
    ctx.beginPath();
    ctx.arc(spawn.px, spawn.py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a2638";
    ctx.font = "10px sans-serif";
    ctx.fillText("出生", spawn.px + 7, spawn.py + 3);

    // 建筑
    for (const p of placements) {
      const def = getBuildingDef(p.type);
      const { px, py } = flatToCanvas(p.x, p.z);
      const sel = p.uid === selectedUid;
      ctx.beginPath();
      ctx.arc(px, py, sel ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = def?.color || "#555";
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // 朝向小刺
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.sin(p.yaw) * 12, py - Math.cos(p.yaw) * 12);
      ctx.strokeStyle = "#1a2638";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 放置预览
    if (placeModeType != null && hoverX != null) {
      const { px, py } = flatToCanvas(hoverX, hoverZ);
      const def = getBuildingDef(placeModeType);
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.strokeStyle = def?.color || "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function refreshList() {
    elList.innerHTML = "";
    for (const p of placements) {
      const li = document.createElement("li");
      li.className = p.uid === selectedUid ? "active" : "";
      li.textContent = `${p.label}  (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
      li.addEventListener("click", () => {
        selectedUid = p.uid;
        placeModeType = null;
        redraw();
        refreshList();
        syncTools();
      });
      elList.appendChild(li);
    }
    if (!placements.length) {
      elList.innerHTML = `<li class="muted">暂无建筑</li>`;
    }
  }

  function syncTools() {
    const p = getSelected();
    btnCopy.disabled = !p;
    btnDelete.disabled = !p;
    yawSlider.disabled = !p;
    if (p) {
      yawSlider.value = String(p.yaw);
      elSelected.textContent = `选中：${p.label}`;
    } else {
      elSelected.textContent = placeModeType
        ? `放置中：${getBuildingDef(placeModeType)?.label || placeModeType}`
        : "未选中";
    }
  }

  function persist() {
    const data = placements.map((p) => ({
      type: p.type,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      uid: p.uid,
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* private mode */
    }
  }

  function loadPersisted(skipUids = new Set()) {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let list;
    try {
      list = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item?.type || skipUids.has(item.uid)) continue;
      // 已登记的同类型同位置跳过（避免和场景内置书店重复）
      const near = placements.some(
        (p) => p.type === item.type && Math.hypot(p.x - item.x, p.z - item.z) < 0.4
      );
      if (near) continue;
      const p = spawnPlacement(item.type, item.x, item.z, item.yaw ?? 0);
      if (p && item.uid) {
        // 保持 uid 尽量稳定
      }
    }
  }

  function setOpen(next) {
    open = !!next;
    overlay.style.display = open ? "flex" : "none";
    if (open) {
      redraw();
      refreshList();
      syncTools();
    }
  }

  function toggle() {
    setOpen(!open);
  }

  // 初始画一次
  redraw();

  return {
    setOpen,
    toggle,
    isOpen: () => open,
    registerExisting,
    loadPersisted,
    getPlacements: () => placements.slice(),
    /** 从世界物体反推 flat 并登记 */
    registerFromWorld(typeId, object, yaw = 0, collider = null) {
      const flat = worldToFlatXZ(object.position, planetRadius);
      if (!flat) {
        // 半球守卫失败时用简易经纬反推
        const dir = object.position.clone().normalize();
        const latDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)));
        const theta = THREE.MathUtils.degToRad(90 - latDeg);
        const phi = Math.atan2(dir.z, dir.x);
        return registerExisting(
          typeId,
          object,
          Math.cos(phi) * theta * planetRadius,
          Math.sin(phi) * theta * planetRadius,
          yaw,
          collider
        );
      }
      return registerExisting(typeId, object, flat.x, flat.z, yaw, collider);
    },
  };
}
