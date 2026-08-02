// =====================================================================
//  地图编辑器（开发者 🤖 菜单 · Map）
//  - 顶视平面图选中 / 拖动建筑
//  - 复制实例、从目录放置到任意位置
//  - 3D 场景点选 → 地图同步高亮选中
//  - 贴球面 + 高度场；碰撞体同步；布局写 localStorage
// =====================================================================
import * as THREE from "three";
import { placeObjectOnSphere } from "../world/sphereMath.js";
import { groundLiftAt, ISLAND_BASE_LIFT, worldToFlatXZ } from "../world/hills.js";
import { PLANET_RADIUS } from "../world/planet.js";
import { createCatalogObject, getBuildingDef, listBuildingTypes } from "./buildingCatalog.js";

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
  /** 放置模式默认朝向（度）；选中物体时控件改选中项，未选中时改此值 */
  let placeYawDeg = 0;
  let dragging = false;
  let open = false;
  let uidSeq = 1;
  const _yawQ = new THREE.Quaternion();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  /** @type {THREE.Object3D|null} 3D 选中高亮环 */
  let worldHighlight = null;

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
        点选拖动 · 复制/删除 · 所有放置类型均可旋转朝向（滑杆/度数/预设/滚轮）· 可贴地 · 书店可改招牌
      </p>
      <canvas id="map-canvas" width="360" height="360" aria-label="主岛平面图"></canvas>
      <div class="map-editor-coords"><span id="map-cursor">x: —  z: —</span>
        <span id="map-selected">未选中</span></div>
      <div class="map-editor-tools">
        <button type="button" id="map-btn-copy" disabled>复制</button>
        <button type="button" id="map-btn-delete" disabled>删除</button>
      </div>
      <div class="map-editor-group">建筑朝向</div>
      <div class="map-angle-row">
        <input type="range" id="map-yaw" min="0" max="360" step="1" value="0" disabled>
        <input type="number" id="map-yaw-deg" min="0" max="360" step="1" value="0" disabled>
        <span class="map-deg-unit">°</span>
      </div>
      <div class="map-angle-presets" id="map-angle-presets">
        <button type="button" data-deg="0" disabled>0°</button>
        <button type="button" data-deg="45" disabled>45°</button>
        <button type="button" data-deg="90" disabled>90°</button>
        <button type="button" data-deg="135" disabled>135°</button>
        <button type="button" data-deg="180" disabled>180°</button>
        <button type="button" data-deg="270" disabled>270°</button>
        <button type="button" id="map-yaw-ccw" disabled title="逆时针 15°">↺15°</button>
        <button type="button" id="map-yaw-cw" disabled title="顺时针 15°">↻15°</button>
      </div>
      <div class="map-editor-group">招牌文字</div>
      <div class="map-sign-fields" id="map-sign-fields">
        <label>第一行 <input type="text" id="map-sign-l1" maxlength="28" placeholder="HARD TO FIND" disabled></label>
        <label>第二行 <input type="text" id="map-sign-l2" maxlength="28" placeholder="BOOKSHOP" disabled></label>
        <button type="button" id="map-sign-apply" disabled>应用招牌</button>
      </div>
      <p class="map-editor-hint" id="map-sign-hint">选中带招牌的建筑（如书店）后可改文字</p>
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
  const yawDegInput = overlay.querySelector("#map-yaw-deg");
  const signL1 = overlay.querySelector("#map-sign-l1");
  const signL2 = overlay.querySelector("#map-sign-l2");
  const btnSignApply = overlay.querySelector("#map-sign-apply");
  const signHint = overlay.querySelector("#map-sign-hint");
  const anglePresetBtns = [...overlay.querySelectorAll("#map-angle-presets button")];

  function yawToDeg(yawRad) {
    let d = ((yawRad * 180) / Math.PI) % 360;
    if (d < 0) d += 360;
    return Math.round(d);
  }
  function degToYaw(deg) {
    let d = Number(deg);
    if (!Number.isFinite(d)) d = 0;
    d = ((d % 360) + 360) % 360;
    return (d * Math.PI) / 180;
  }
  function setYawUI(yawRadOrDeg, isDeg = false) {
    const d = isDeg ? (((Number(yawRadOrDeg) % 360) + 360) % 360) : yawToDeg(yawRadOrDeg);
    const rounded = Math.round(d);
    yawSlider.value = String(rounded);
    yawDegInput.value = String(rounded);
  }
  /** 所有放置类型通用：有选中则改选中；放置模式无选中则改下次落点朝向 */
  function applyYawFromDeg(deg) {
    let d = Number(deg);
    if (!Number.isFinite(d)) d = 0;
    d = ((d % 360) + 360) % 360;
    const p = getSelected();
    if (p) {
      p.yaw = degToYaw(d);
      applyPose(p);
      setYawUI(d, true);
      persist();
    } else {
      placeYawDeg = d;
      setYawUI(d, true);
    }
    redraw();
    syncTools();
  }

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
      // 用类型默认朝向作为放置起始角（仍可在落点前用角度控件改）
      placeYawDeg = yawToDeg(def.defaultYaw ?? 0);
      setYawUI(placeYawDeg, true);
      [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
        el.classList.toggle("active", el.dataset.type === def.id)
      );
      toast(`放置：${def.label} · 朝向 ${placeYawDeg}° · 点地图落点`, 1.8);
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
    // 复制时带上工厂参数（种子/缩放/招牌），保证与原件一致
    const fo = p.factoryOpts || p.object?.userData?.factoryOpts || {};
    const copy = spawnPlacement(p.type, p.x + 1.2, p.z + 1.2, p.yaw + 0.2, {
      ...fo,
      signLine1: p.signLine1 ?? fo.signLine1,
      signLine2: p.signLine2 ?? fo.signLine2,
      seed: fo.seed,
      scale: fo.scale,
    });
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

  yawSlider.addEventListener("input", () => applyYawFromDeg(yawSlider.value));
  yawDegInput.addEventListener("change", () => applyYawFromDeg(yawDegInput.value));
  yawDegInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyYawFromDeg(yawDegInput.value);
    }
  });
  for (const btn of anglePresetBtns) {
    if (btn.dataset.deg != null) {
      btn.addEventListener("click", () => applyYawFromDeg(btn.dataset.deg));
    }
  }
  overlay.querySelector("#map-yaw-ccw")?.addEventListener("click", () => {
    const p = getSelected();
    const cur = p ? yawToDeg(p.yaw) : placeYawDeg;
    applyYawFromDeg(cur - 15);
  });
  overlay.querySelector("#map-yaw-cw")?.addEventListener("click", () => {
    const p = getSelected();
    const cur = p ? yawToDeg(p.yaw) : placeYawDeg;
    applyYawFromDeg(cur + 15);
  });

  // 地图上滚轮：旋转当前选中（任意放置类型）
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!open) return;
      const p = getSelected();
      if (!p && !placeModeType) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : 15;
      const cur = p ? yawToDeg(p.yaw) : placeYawDeg;
      applyYawFromDeg(cur + (e.deltaY > 0 ? step : -step));
    },
    { passive: false }
  );

  btnSignApply.addEventListener("click", () => {
    const p = getSelected();
    if (!p || !p.object?.userData?.hasSign) {
      toast("请先选中带招牌的建筑（如书店）", 1.6);
      return;
    }
    const l1 = signL1.value.trim() || "HARD TO FIND";
    const l2 = signL2.value.trim() || "BOOKSHOP";
    if (typeof p.object.userData.setSignText === "function") {
      p.object.userData.setSignText(l1, l2);
    }
    p.signLine1 = l1;
    p.signLine2 = l2;
    toast("招牌已更新", 1.4);
    persist();
  });
  const onSignKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnSignApply.click();
    }
  };
  signL1.addEventListener("keydown", onSignKey);
  signL2.addEventListener("keydown", onSignKey);

  // 地图交互
  canvas.addEventListener("pointerdown", (e) => {
    const { x, z } = canvasToFlat(e);
    if (placeModeType) {
      // 所有放置类型统一使用当前角度控件的朝向
      const p = spawnPlacement(placeModeType, x, z, degToYaw(placeYawDeg));
      if (p) {
        selectByUid(p.uid);
        placeModeType = null;
        [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
          el.classList.remove("active")
        );
        toast(`已放置 ${p.label} · ${yawToDeg(p.yaw)}°`, 1.4);
        persist();
      }
      return;
    }
    const hit = pickNearest(x, z, 1.6);
    selectByUid(hit ? hit.uid : null);
    dragging = !!hit;
    if (hit) canvas.setPointerCapture(e.pointerId);
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

  /**
   * 贴球面后再绕局部 +Y（表面法线）旋转 yaw。
   * 所有放置类型共用：书店/房/松/花/杆/岩…
   */
  function applyPose(p) {
    if (!p?.object) return;
    const lift = liftAt(p.x, p.z);
    placeObjectOnSphere(p.object, p.x, p.z, lift, planetRadius);
    // 用四元数绕局部 Y 转，避免部分 Group 对 rotateY 不直观
    const yaw = Number.isFinite(p.yaw) ? p.yaw : 0;
    _yawQ.setFromAxisAngle(_yAxis, yaw);
    p.object.quaternion.multiply(_yawQ);
    p.object.userData.mapYaw = yaw;
    if (p.collider) {
      p.collider.position.copy(p.object.position);
    }
  }

  function nextUid() {
    return `b${uidSeq++}`;
  }

  /** 保证后续自动编号不与已恢复的 uid 冲突 */
  function bumpUidSeqFrom(uid) {
    if (typeof uid !== "string") return;
    const m = /^b(\d+)$/.exec(uid);
    if (m) uidSeq = Math.max(uidSeq, Number(m[1]) + 1);
  }

  function spawnPlacement(typeId, x, z, yaw = 0, extra = {}) {
    const def = getBuildingDef(typeId);
    if (!def) {
      toast(`未知建筑类型：${typeId}`, 1.5);
      return null;
    }
    // 与场景程序创建完全同一入口 createCatalogObject → assets 工厂
    const factoryOpts = {
      signLine1: extra.signLine1 ?? def.defaultSignLine1,
      signLine2: extra.signLine2 ?? def.defaultSignLine2,
      seed: extra.seed,
      scale: extra.scale,
      hue: extra.hue,
    };
    const object = createCatalogObject(typeId, factoryOpts);
    if (!object) return null;
    object.userData.mapEditable = true;
    const uid = extra.uid || nextUid();
    bumpUidSeqFrom(uid);
    object.userData.mapUid = uid;
    scene.add(object);

    let collider = null;
    // 碰撞半径以工厂 userData 为准（与 nature.pushCollider 一致）
    const cr = object.userData.collideRadius ?? def.collideRadius ?? 0;
    if (cr >= 0.15 && colliders) {
      const worldR = cr * Math.abs(object.scale?.x || 1);
      collider = { position: object.position.clone(), radius: worldR };
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
      signLine1: object.userData.signLine1 ?? factoryOpts.signLine1 ?? null,
      signLine2: object.userData.signLine2 ?? factoryOpts.signLine2 ?? null,
      factoryOpts: { ...factoryOpts },
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

  /** 地图 + 3D 共用选中：高亮列表/地图点 + 世界光环 */
  function selectByUid(uid, { toastPick = false } = {}) {
    selectedUid = uid || null;
    placeModeType = null;
    [...elPalette.querySelectorAll(".map-palette-item")].forEach((el) =>
      el.classList.remove("active")
    );
    redraw();
    refreshList();
    syncTools();
    updateWorldHighlight();
    if (toastPick && uid) {
      const p = getSelected();
      if (p) toast(`已选中 ${p.label}`, 1.1);
    }
  }

  function clearWorldHighlight() {
    if (worldHighlight?.parent) worldHighlight.parent.remove(worldHighlight);
    worldHighlight = null;
  }

  function updateWorldHighlight() {
    clearWorldHighlight();
    const p = getSelected();
    if (!p?.object) return;
    const cr = Math.max(0.6, (p.object.userData.collideRadius ?? 0.8) * 1.15);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(cr * 0.75, cr * 1.05, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.name = "map-select-highlight";
    ring.userData.isMapHighlight = true;
    // 脉冲层
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(cr * 1.05, cr * 1.22, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfff6c8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.04;
    pulse.userData.isMapHighlight = true;
    const wrap = new THREE.Group();
    wrap.name = "map-select-wrap";
    wrap.userData.isMapHighlight = true;
    wrap.add(ring, pulse);
    wrap.userData.pulse = pulse;
    wrap.userData.t0 = performance.now();
    p.object.add(wrap);
    worldHighlight = wrap;
  }

  /** 从点击网格向上找带 mapUid 的可编辑根 */
  function findPlacementRoot(obj) {
    let o = obj;
    while (o) {
      if (o.userData?.isMapHighlight) {
        o = o.parent;
        continue;
      }
      if (o.userData?.mapUid) return o;
      o = o.parent;
    }
    return null;
  }

  /** @type {{ camera: THREE.Camera, domElement: HTMLElement }|null} */
  let scenePickCtx = null;
  let scenePickBound = false;

  function onScenePointerDown(e) {
    // 双重保险：地图关闭时绝不拾取
    if (!open || !scenePickCtx || e.button !== 0) return;
    const { camera, domElement } = scenePickCtx;
    // 点在 UI 上则忽略
    const t = e.target;
    if (
      t instanceof Element &&
      (t.closest("#map-editor") ||
        t.closest("#dev-panel") ||
        t.closest("#dev-toggle") ||
        t.closest("#quest-panel") ||
        t.closest("#intro") ||
        t.closest("#journal-panel"))
    ) {
      return;
    }
    const rect = domElement.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, camera);
    _raycaster.params.Line = { threshold: 0.2 };
    _raycaster.params.Points = { threshold: 0.3 };

    const roots = placements.map((p) => p.object).filter(Boolean);
    if (!roots.length) return;
    const hits = _raycaster.intersectObjects(roots, true);
    if (!hits.length) {
      if (!placeModeType) selectByUid(null);
      return;
    }
    const root = findPlacementRoot(hits[0].object);
    if (!root?.userData?.mapUid) return;
    selectByUid(root.userData.mapUid, { toastPick: true });
    e.stopPropagation();
  }

  function enableScenePick() {
    if (!scenePickCtx?.domElement || scenePickBound) return;
    scenePickCtx.domElement.addEventListener("pointerdown", onScenePointerDown);
    scenePickBound = true;
  }

  function disableScenePick() {
    if (!scenePickCtx?.domElement || !scenePickBound) return;
    scenePickCtx.domElement.removeEventListener("pointerdown", onScenePointerDown);
    scenePickBound = false;
  }

  /**
   * 注册 3D 拾取目标（仅地图打开时挂监听）
   * @param {{ camera: THREE.Camera, domElement: HTMLElement }} deps
   */
  function bindScenePick({ camera, domElement }) {
    if (!camera || !domElement) return;
    // 若曾绑定过，先卸掉
    disableScenePick();
    scenePickCtx = { camera, domElement };
    // 仅当地图已打开时立即启用
    if (open) enableScenePick();
  }

  /** 主循环可调：高亮环轻微呼吸（地图关闭时无事可做） */
  function tickHighlight() {
    if (!open || !worldHighlight?.userData?.pulse) return;
    const t = (performance.now() - (worldHighlight.userData.t0 || 0)) * 0.003;
    const s = 1 + 0.06 * Math.sin(t);
    worldHighlight.userData.pulse.scale.set(s, s, s);
    if (worldHighlight.userData.pulse.material) {
      worldHighlight.userData.pulse.material.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t));
    }
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
    // 优先沿用物体上的稳定 uid（场景可设 world-bookshop）；否则自动编号
    const uid = object.userData.mapUid || nextUid();
    bumpUidSeqFrom(uid);
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
      signLine1: object.userData.signLine1 ?? def?.defaultSignLine1 ?? null,
      signLine2: object.userData.signLine2 ?? def?.defaultSignLine2 ?? null,
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

    // 放置预览（含朝向箭头，所有类型）
    if (placeModeType != null && hoverX != null) {
      const { px, py } = flatToCanvas(hoverX, hoverZ);
      const def = getBuildingDef(placeModeType);
      const yaw = degToYaw(placeYawDeg);
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.strokeStyle = def?.color || "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.sin(yaw) * 14, py - Math.cos(yaw) * 14);
      ctx.strokeStyle = def?.color || "#333";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function refreshList() {
    elList.innerHTML = "";
    for (const p of placements) {
      const li = document.createElement("li");
      li.className = p.uid === selectedUid ? "active" : "";
      li.textContent = `${p.label}  (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) · ${yawToDeg(p.yaw)}°`;
      li.addEventListener("click", () => {
        selectByUid(p.uid);
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
    // 选中任意类型 或 放置模式：都可调角度
    const canAngle = !!p || !!placeModeType;
    yawSlider.disabled = !canAngle;
    yawDegInput.disabled = !canAngle;
    for (const btn of anglePresetBtns) btn.disabled = !canAngle;

    const canSign = !!(p && p.object?.userData?.hasSign);
    signL1.disabled = !canSign;
    signL2.disabled = !canSign;
    btnSignApply.disabled = !canSign;
    if (signHint) {
      signHint.textContent = canSign
        ? "修改后点「应用招牌」或按 Enter"
        : "选中带招牌的建筑（如书店）后可改文字";
    }

    if (p) {
      setYawUI(p.yaw);
      elSelected.textContent = `选中：${p.label} · ${yawToDeg(p.yaw)}°`;
      if (canSign) {
        signL1.value = p.signLine1 ?? p.object.userData.signLine1 ?? "";
        signL2.value = p.signLine2 ?? p.object.userData.signLine2 ?? "";
      } else {
        signL1.value = "";
        signL2.value = "";
      }
    } else if (placeModeType) {
      setYawUI(placeYawDeg, true);
      const name = getBuildingDef(placeModeType)?.label || placeModeType;
      elSelected.textContent = `放置中：${name} · 朝向 ${placeYawDeg}°`;
      signL1.value = "";
      signL2.value = "";
    } else {
      elSelected.textContent = "未选中 · 选类型或点地图上的物体";
      signL1.value = "";
      signL2.value = "";
    }
  }

  function persist() {
    const data = placements.map((p) => ({
      type: p.type,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      uid: p.uid,
      signLine1: p.signLine1 ?? null,
      signLine2: p.signLine2 ?? null,
      seed: p.factoryOpts?.seed ?? p.object?.userData?.factorySeed ?? null,
      scale: p.factoryOpts?.scale ?? p.object?.userData?.factoryScale ?? null,
      hue: p.factoryOpts?.hue ?? null,
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* private mode */
    }
  }

  /**
   * 从 localStorage 完整恢复布局（有存档时存档为唯一真相，覆盖初始化布局）。
   * - 复用已登记物体（uid → 同类型最近），改到存档坐标/朝向/招牌
   * - 缺的生成，多余的（含未保存的默认建筑）删除
   * @param {Set<string>} [skipUids]
   * @returns {boolean} 是否应用了存档
   */
  function loadPersisted(skipUids = new Set()) {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
    // 无键 = 从未保存，保留场景初始化布局
    if (raw == null || raw === "") return false;
    let list;
    try {
      list = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!Array.isArray(list)) return false;

    /** @type {Set<object>} 被存档复用的 placement 引用 */
    const reused = new Set();

    for (const item of list) {
      if (!item?.type || (item.uid && skipUids.has(item.uid))) continue;
      if (!getBuildingDef(item.type)) continue;

      // 1) 精确 uid
      let match =
        item.uid != null
          ? placements.find((p) => p.uid === item.uid && !reused.has(p))
          : null;

      // 2) 同类型优先复用（场景默认书店等：uid 可能从 b1 变成 world-bookshop）
      if (!match) {
        const sameType = placements.filter((p) => p.type === item.type && !reused.has(p));
        if (sameType.length === 1) {
          match = sameType[0];
        } else if (sameType.length > 1) {
          let best = sameType[0];
          let bestD = Math.hypot(best.x - item.x, best.z - item.z);
          for (let i = 1; i < sameType.length; i++) {
            const p = sameType[i];
            const d = Math.hypot(p.x - item.x, p.z - item.z);
            if (d < bestD) {
              bestD = d;
              best = p;
            }
          }
          match = best;
        }
      }

      if (match) {
        reused.add(match);
        // 与存档 uid 对齐，保证下次仍能精确命中
        if (item.uid && item.uid !== match.uid) {
          match.uid = item.uid;
          if (match.object) match.object.userData.mapUid = item.uid;
        }
        bumpUidSeqFrom(match.uid);
        match.x = Number(item.x) || 0;
        match.z = Number(item.z) || 0;
        match.yaw = Number.isFinite(item.yaw) ? item.yaw : 0;
        if (item.signLine1 != null || item.signLine2 != null) {
          match.signLine1 = item.signLine1 ?? match.signLine1;
          match.signLine2 = item.signLine2 ?? match.signLine2;
          if (typeof match.object?.userData?.setSignText === "function") {
            match.object.userData.setSignText(match.signLine1, match.signLine2);
          }
        }
        if (item.seed != null || item.scale != null || item.hue != null) {
          match.factoryOpts = {
            ...(match.factoryOpts || {}),
            seed: item.seed ?? match.factoryOpts?.seed,
            scale: item.scale ?? match.factoryOpts?.scale,
            hue: item.hue ?? match.factoryOpts?.hue,
          };
        }
        applyPose(match);
        continue;
      }

      const spawned = spawnPlacement(item.type, Number(item.x) || 0, Number(item.z) || 0, item.yaw ?? 0, {
        uid: item.uid || undefined,
        signLine1: item.signLine1,
        signLine2: item.signLine2,
        seed: item.seed ?? undefined,
        scale: item.scale ?? undefined,
        hue: item.hue ?? undefined,
      });
      if (spawned) reused.add(spawned);
    }

    // 存档未包含的已登记物（含被用户删掉的默认建筑）：从场景移除
    for (const p of placements.slice()) {
      if (!reused.has(p)) removePlacement(p.uid);
    }

    redraw();
    refreshList();
    syncTools();
    return true;
  }

  function setOpen(next) {
    open = !!next;
    // 右侧栏：block 贴右，不遮罩全屏
    overlay.style.display = open ? "block" : "none";
    if (open) {
      enableScenePick(); // 仅打开地图时允许 3D 点选
      redraw();
      refreshList();
      syncTools();
      updateWorldHighlight();
      toast("地图已开：可在 3D 场景左键点选建筑，地图同步高亮", 2.2);
    } else {
      // 收起地图：立刻关闭 3D 选择能力，并清掉选中/高亮
      disableScenePick();
      selectedUid = null;
      placeModeType = null;
      dragging = false;
      clearWorldHighlight();
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
    selectByUid,
    bindScenePick,
    tickHighlight,
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
