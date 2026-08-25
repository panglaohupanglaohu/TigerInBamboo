// =====================================================================
//  高山圣城 · 游戏内 3D 直编辑（townscaper.html 的场景编辑能力搬进主场景）
//  - 搭建面板打开且满足 canEdit（已开局）时生效：
//      左键点体块顶面 → 向上叠块 · 点侧面 → 改色 · 点当前层空地 → 加块
//      右键点体块 → 删除整个 WFC 单元并留下空槽 · 悬停显示幽灵块预览
//  - 只负责射线拾取与坐标换算，布局读写全部走面板的 applySceneEdit，
//    与 2D 平面图共用同一份撤销栈 / 存档 / 即时重建。
// =====================================================================
import * as THREE from "three";
import {
  CITADEL_TOWN_SPEC,
  citadelGridCellCenter,
  CITADEL_PALETTE,
  CITADEL_GATE_CHAR,
  CITADEL_GATE_COLOR,
  citadelPaletteIndexOfChar,
} from "../world/citadelTown.js?v=20260825-highland-obelisk-stone-v3";

/** Resolve a ray hit on any nested mesh/outline back to its tower/tree root. */
export function citadelTerrainObjectFromHits(hits = []) {
  for (const hit of hits) {
    let object = hit?.object;
    while (object) {
      if (object.userData?.terrainObjectId) {
        return {
          id: object.userData.terrainObjectId,
          type: object.userData.terrainObjectType,
          object,
        };
      }
      object = object.parent;
    }
  }
  return null;
}

/**
 * 合并几何上的体块反查：town 体块按材质合并后（geometryMerge），
 * 命中合并网格时用 hit.faceIndex（非索引几何 = 三角形序号）查
 * userData.faceToCell 面区间映射，还原 cell 数据。
 * @returns {object|null} cell（含 ix/iy/iz/char/terraceIndex）或 null
 */
export function lookupMergedCell(hit) {
  const obj = hit?.object;
  const map = obj?.userData?.faceToCell;
  if (!map || !Number.isFinite(hit.faceIndex)) return null;
  const tri = hit.faceIndex;
  for (const entry of map) {
    if (tri >= entry.triStart && tri < entry.triStart + entry.triCount) {
      return entry.cell;
    }
  }
  return null;
}

/**
 * 高山圣城 Townscaper 单元拾取。空槽由不可见 pick plane 提供稳定 ID；
 * 已有建筑从任意子网格向上追溯 townscaperUnit。返回值与旧五台地格网
 * 完全分离，避免最新山谷设计再次落回台地坐标系。
 */
export function highlandUnitFromHits(hits = []) {
  for (const hit of hits) {
    const slotId = hit?.object?.userData?.highlandSlotUnitId;
    if (slotId) {
      return { unitId: slotId, unit: null, empty: true, top: true, hit };
    }
    let object = hit?.object;
    while (object) {
      const unit = object.userData?.townscaperUnit;
      if (unit?.id) {
        let top = true;
        if (hit.face && hit.object?.matrixWorld) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
            object.getWorldQuaternion(new THREE.Quaternion())
          );
          const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          // 坡屋顶也属于“顶面”；侧墙法线与当地 up 几乎垂直。
          top = normal.dot(up) > 0.42;
        }
        return {
          unitId: unit.id,
          unit,
          empty: unit.occupied === false,
          top,
          hit,
        };
      }
      object = object.parent;
    }
  }
  return null;
}

/**
 * 3D 编辑幽灵块颜色：Townscaper 15 色 + 正门 G。
 * 与 citadelTown.js 的 CITADEL_PALETTE 同源（编辑器/主场景单一真相）。
 */
const CHAR_COLORS = {};
for (const entry of CITADEL_PALETTE) CHAR_COLORS[entry.char] = entry.color;
CHAR_COLORS[CITADEL_GATE_CHAR] = CITADEL_GATE_COLOR;
CHAR_COLORS.W = CHAR_COLORS["0"];
CHAR_COLORS.L = CHAR_COLORS["2"];
CHAR_COLORS.B = CHAR_COLORS["6"];
CHAR_COLORS.D = CHAR_COLORS[CITADEL_GATE_CHAR];
const CLICK_SLOP_PX = 6; // 按下到抬起位移小于此值才算点击（区分相机拖拽）

/** Current selected terrace's local build-plane elevation. */
export function citadelEditBaseY(citadel, terraceIndex = 0) {
  const value = citadel?.userData?.townBaseYs?.[terraceIndex]
    ?? citadel?.userData?.townBaseY;
  return Number.isFinite(value) ? value : null;
}

/** Canonical local centre of a 3D editor ghost/building cell. */
export function citadelEditCellLocalPosition(
  citadel,
  terraceIndex,
  target,
  out = new THREE.Vector3()
) {
  const baseY = citadelEditBaseY(citadel, terraceIndex);
  if (baseY == null) return null;
  const c = citadelGridCellCenter(target.ix, target.iy, target.iz);
  return out.set(c.x, baseY + c.y, c.z);
}

/**
 * Intersect only one selected terrace's true upward-facing surface. This is
 * intentionally independent of all generated town/decorative objects.
 */
export function raycastCitadelTerraceTop(
  citadel,
  terraceIndex,
  raycaster,
  out = new THREE.Vector3()
) {
  const terrain = citadel?.userData?.outerTerrainSystem;
  if (!terrain || !raycaster) return null;
  const roots = [
    terrain.getObjectByName(`contour-step-${terraceIndex}`),
    terrain.getObjectByName(`contour-step-${terraceIndex}-core`),
  ].filter(Boolean);
  if (!roots.length) return null;
  citadel.updateWorldMatrix(true, true);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
    citadel.getWorldQuaternion(new THREE.Quaternion())
  );
  for (const hit of raycaster.intersectObjects(roots, true)) {
    const terrace = hit.object.userData.isCitadelTerrace
      || hit.object.name?.startsWith("contour-step-");
    if (!terrace) continue;
    if (hit.face) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (normal.dot(up) > 0.75) return out.copy(hit.point);
    }
    // 斜视角打到拾取垫侧面：投影到该台地建块平面
    const baseY = citadelEditBaseY(citadel, terraceIndex) ?? 0;
    const planePt = citadel.localToWorld(new THREE.Vector3(0, baseY, 0));
    const denom = raycaster.ray.direction.dot(up);
    if (Math.abs(denom) > 1e-6) {
      const t = planePt.sub(raycaster.ray.origin).dot(up) / denom;
      if (t > 0) return out.copy(raycaster.ray.at(t, out));
    }
  }
  return null;
}

/**
 * 射线穿过的最近一层台地顶面（不限当前选中台地）。
 * 3D 直编辑据此「点到哪层编辑哪层」，避免点其它台地空地毫无反应。
 */
export function raycastNearestCitadelTerraceTop(citadel, raycaster, out = new THREE.Vector3()) {
  if (!citadel || !raycaster) return null;
  const p = new THREE.Vector3();
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < 5; i++) {
    if (!raycastCitadelTerraceTop(citadel, i, raycaster, p)) continue;
    const d = raycaster.ray.origin.distanceTo(p);
    if (d < bestD) {
      bestD = d;
      best = i;
      out.copy(p);
    }
  }
  return best < 0 ? null : { terraceIndex: best, point: out };
}

/**
 * 射线落在层叠梯湖（白石岸/水面）上时，返回归属落点。
 * 湖椭圆是逻辑承重面（isCitadelCascadePoolSupported），但其下台地顶面被
 * 瀑布缺口切掉，真实顶面拾取永远落空——这里用湖体网格补上拾取；
 * 落点不取网格命中点（斜视角命中的常是湖岸壁面，x/z 会偏到邻层），
 * 而是取射线与「池归属台地建块平面」的交点：即用户视线里看到的湖面处。
 */
export function raycastCascadePoolTop(scene, raycaster, out = new THREE.Vector3(), terraceFilter = null) {
  const waterSteps = scene?.getObjectByName?.("citadel-pilgrimage-water-steps");
  if (!waterSteps || !raycaster) return null;
  for (const hit of raycaster.intersectObjects(waterSteps.children, true)) {
    let o = hit.object;
    while (o && !o.userData?.composition) o = o.parent;
    const comp = o?.userData?.composition;
    if (!Number.isFinite(comp?.terraceIndex)) continue;
    // 选中台地优先拾取：跳过归属邻层的梯湖，继续找选中台地自己的湖面；
    // 无过滤时维持原行为（首个命中即返回）
    if (Number.isFinite(terraceFilter) && comp.terraceIndex !== terraceFilter) continue;
    let citadel = o.parent;
    while (citadel && !citadel.userData?.townBaseYs) citadel = citadel.parent;
    if (citadel) {
      // 当地“上”方向与建块平面高：射线与该平面的交点即逻辑落点
      const q = citadel.getWorldQuaternion(new THREE.Quaternion());
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const baseY = citadelEditBaseY(citadel, comp.terraceIndex) ?? 0;
      const planePt = citadel.localToWorld(new THREE.Vector3(0, baseY, 0));
      const denom = raycaster.ray.direction.dot(localUp);
      if (Math.abs(denom) > 1e-6) {
        const t = planePt.sub(raycaster.ray.origin).dot(localUp) / denom;
        if (t > 0) return { terraceIndex: comp.terraceIndex, point: out.copy(raycaster.ray.at(t, out)) };
      }
    }
    return { terraceIndex: comp.terraceIndex, point: out.copy(hit.point) };
  }
  return null;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.dom 渲染画布
 * @param {THREE.Camera} opts.camera
 * @param {THREE.Scene} opts.scene
 * @param {() => THREE.Group|null} opts.getCitadel 圣城 castleContainer
 * @param {ReturnType<import("./citadelEditorPanel.js").createCitadelEditorPanel>} opts.panel
 * @param {() => boolean} opts.canEdit 是否允许编辑（已开局即可）
 * @param {(e: PointerEvent) => boolean} opts.isUiEvent 点击落在 UI 上则忽略
 * @param {(msg: string, dur?: number) => void} [opts.toast]
 * @returns {{ tick(): void }}
 */
export function createCitadelSceneEdit({
  dom,
  camera,
  scene,
  getCitadel,
  panel,
  canEdit,
  isUiEvent,
  toast = () => {},
}) {
  const CELL = CITADEL_TOWN_SPEC.cellSize;
  const CELL_H = CITADEL_TOWN_SPEC.cellHeight;

  const raycaster = new THREE.Raycaster();
  raycaster.layers.enable(1);
  const ndc = new THREE.Vector2();
  const upLocal = new THREE.Vector3(0, 1, 0);
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  // 悬停幽灵块
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(CELL, CELL_H, CELL),
    new THREE.MeshBasicMaterial({
      color: CHAR_COLORS.W,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  ghost.name = "citadel-edit-ghost";
  ghost.visible = false;
  scene.add(ghost);

  function editing() {
    return panel.isOpen() && canEdit();
  }

  /**
   * Current terrace edit frame. It is derived from castleContainer itself,
   * never from a generated town-level group: an entirely cleared terrace must
   * retain exactly the same editable plane and coordinate origin.
   */
  function editFrame() {
    const state = panel.getState();
    const citadel = getCitadel();
    if (!citadel) return null;
    const baseY = citadelEditBaseY(citadel, state.activeTerrace);
    if (baseY == null) return null;
    return { citadel, baseY };
  }

  function castRay(e) {
    const citadel = getCitadel();
    if (!citadel) return null;
    const rect = dom.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  }

  /** 最新山谷城专用拾取：不经过旧台地/体素坐标换算。 */
  function castHighlandUnit(e) {
    if (!panel.usesHighlandUnitMap?.()) return null;
    const ray = castRay(e);
    const citadel = getCitadel();
    if (!ray || !citadel) return null;
    const hit = highlandUnitFromHits(ray.intersectObject(citadel, true));
    if (!hit) return null;
    const liveUnit = panel.getLatestUnits?.().find((unit) => unit.id === hit.unitId);
    return liveUnit ? { ...hit, unit: liveUnit, empty: liveUnit.occupied === false } : null;
  }

  /** 拾取体块：跳过窗/垛/穹顶等装饰件，返回格坐标与是否顶面命中。
   *  兼容合并几何：town 体块按材质合并后，cell 通过 userData.faceToCell
   *  （面区间 → cell）按 hit.faceIndex 反查。
   *  台地约束解除：命中任意台地的体块都自动切换编辑台地（不再只认当前台地）。 */
  function castCell(e) {
    const ray = castRay(e);
    const citadel = getCitadel();
    if (!ray || !citadel) return null;
    const frame = editFrame();
    if (!frame) return null;
    const hits = ray.intersectObject(citadel, true);
    const activeTerrace = panel.getState().activeTerrace;
    const gridTownscaper = citadel.userData?.skipOuterTerrain === true
      || citadel.userData?.highlandTownscaperGrid === true;
    // 选中台地归属梯湖的命中距离：水面在台壁之前时，台壁不得拦截拾取
    // （缺口内的梯湖本就压在邻层台壁后方，否则水面永远点不到）
    const poolSel = raycastCascadePoolTop(scene, ray, tmpV2, activeTerrace);
    const dPoolSel = poolSel ? ray.ray.origin.distanceTo(poolSel.point) : Infinity;
    for (const hit of hits) {
      const cell = hit.object.userData?.cell ?? lookupMergedCell(hit);
      if (cell && hit.face) {
        // 点击其它台地已建体块：自动切换编辑台地（不弹回 castPlane）
        if (cell.terraceIndex !== activeTerrace && !gridTownscaper) {
          panel.setActiveTerrace(cell.terraceIndex);
          toast(`已切换到台地 ${cell.terraceIndex + 1}`, 1.0);
        }
        const up = upLocal.clone().applyQuaternion(frame.citadel.getWorldQuaternion(tmpQ));
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        return { cell, top: normal.dot(up) > 0.75 };
      }
      // 高山台地顶面挡住后面的楼。水上城堡的拾取垫不能挡楼——
      // 斜视角会先打到垫子侧/面，点屋顶就叠不上去。
      if (hit.object.userData.isCitadelTerrace && !gridTownscaper) {
        if (dPoolSel < hit.distance) break;
        return null;
      }
    }
    // 点到屋顶/窗/岸裙：按落点找柱，当作点在该柱最高块顶面 → 往上叠
    if (gridTownscaper) {
      for (const hit of hits) {
        if (hit.object.userData.isCitadelTerrace) continue;
        if (hit.object.userData.isOutline) continue;
        frame.citadel.worldToLocal(tmpV.copy(hit.point));
        const col = panel.cellAtLocal(tmpV.x, tmpV.z, 0);
        if (!col) continue;
        const next = panel.dropTarget(col.ix, col.iz, 0);
        if (next && next.iy > 0) {
          return { cell: { ix: next.ix, iy: next.iy - 1, iz: next.iz }, top: true };
        }
      }
    }
    return null;
  }

  /** Pick a nested tower/tree mesh before the generic building-cell eraser. */
  function castTerrainObject(e) {
    const ray = castRay(e);
    const citadel = getCitadel();
    if (!ray || !citadel) return null;
    return citadelTerrainObjectFromHits(ray.intersectObject(citadel, true));
  }

  /** 拾取落块平面：选中台地优先（顶面 → 归属梯湖 → 建块平面交点），
   *  全都接不住才退回最近面裁决（点击邻层台面自动切换）。
   *  落地堆叠开启时自动堆到柱顶；关闭时仍用真实台面确定 x/z。 */
  function castPlane(e) {
    const ray = castRay(e);
    const frame = editFrame();
    if (!ray || !frame) return null;
    const st = panel.getState();
    // 选中台地优先：射线只要碰到选中台地顶面或其归属梯湖，
    // 提示与落块都归选中台地（选台地 5 就给台地 5 的提示）；
    // 完全碰不到时才退回最近面裁决（点击邻层台面自动切换）。
    const poolV = new THREE.Vector3();
    const topSel = raycastCitadelTerraceTop(frame.citadel, st.activeTerrace, ray, tmpV2);
    const dTopSel = topSel ? ray.ray.origin.distanceTo(topSel) : Infinity;
    const poolSel = raycastCascadePoolTop(scene, ray, poolV, st.activeTerrace);
    const dPoolSel = poolSel ? ray.ray.origin.distanceTo(poolSel.point) : Infinity;
    let resolved = null;
    if (topSel || poolSel) {
      resolved = poolSel && dPoolSel < dTopSel
        ? poolSel
        : { terraceIndex: st.activeTerrace, point: topSel };
    } else {
      // 选中台地的顶面/梯湖都接不住射线（瀑布缺口水道无几何）：
      // 用射线与选中台地建块平面的交点作为落点补充，交点落在可建格内才接受。
      const q = frame.citadel.getWorldQuaternion(tmpQ);
      const localUp = upLocal.clone().applyQuaternion(q);
      const denom = ray.ray.direction.dot(localUp);
      if (Math.abs(denom) > 1e-6) {
        const planePt = frame.citadel.localToWorld(new THREE.Vector3(0, frame.baseY, 0));
        const tt = planePt.sub(ray.ray.origin).dot(localUp) / denom;
        if (tt > 0) {
          const p = ray.ray.at(tt, poolV);
          frame.citadel.worldToLocal(tmpV.copy(p));
          const c = panel.cellAtLocal(tmpV.x, tmpV.z, st.activeLayer);
          if (c && panel.supportsCell(c.ix, c.iz, st.activeTerrace)) {
            resolved = { terraceIndex: st.activeTerrace, point: p };
          }
        }
      }
      if (!resolved) {
        const top = raycastNearestCitadelTerraceTop(frame.citadel, ray, tmpV);
        const dTop = top ? ray.ray.origin.distanceTo(top.point) : Infinity;
        const pool = raycastCascadePoolTop(scene, ray, poolV);
        const dPool = pool ? ray.ray.origin.distanceTo(pool.point) : Infinity;
        if (top && pool) resolved = dPool < dTop ? pool : top;
        else resolved = top || pool;
      }
    }
    if (!resolved) return null;
    frame.citadel.worldToLocal(tmpV.copy(resolved.point));
    const hit = panel.cellAtLocal(tmpV.x, tmpV.z, st.activeLayer);
    if (!hit) return null;
    const terrace = resolved.terraceIndex;
    if (!panel.supportsCell(hit.ix, hit.iz, terrace)) {
      return { ...hit, iy: 0, terraceIndex: terrace, unsupported: true };
    }
    if (st.dropToGround) {
      const t = panel.dropTarget(hit.ix, hit.iz, terrace);
      return t
        ? { ...t, terraceIndex: terrace }
        : { ...hit, iy: 0, terraceIndex: terrace, unsupported: true }; // 无土坡承重的柱位
    }
    return { ...hit, terraceIndex: terrace };
  }

  /** 悬停目标：体块（顶面→上一格，侧面→本格）或地面落点（无支撑不出幽灵块）。 */
  function pickTarget(e) {
    const hit = castCell(e);
    if (hit) {
      return hit.top
        ? { ix: hit.cell.ix, iy: Math.min(hit.cell.iy + 1, panel.maxLevel), iz: hit.cell.iz }
        : { ix: hit.cell.ix, iy: hit.cell.iy, iz: hit.cell.iz };
    }
    const plane = castPlane(e);
    return plane?.unsupported ? null : plane;
  }

  function showGhost(target) {
    const frame = editFrame();
    if (!target || !frame) {
      ghost.visible = false;
      return;
    }
    frame.citadel.updateWorldMatrix(true, false);
    const localPosition = citadelEditCellLocalPosition(
      frame.citadel,
      target.terraceIndex ?? panel.getState().activeTerrace,
      target,
      tmpV
    );
    if (!localPosition) {
      ghost.visible = false;
      return;
    }
    ghost.position.copy(
      frame.citadel.localToWorld(localPosition)
    );
    ghost.quaternion.copy(frame.citadel.getWorldQuaternion(tmpQ));
    ghost.material.color.setHex(CHAR_COLORS[panel.getState().activeChar] ?? CHAR_COLORS.W);
    ghost.visible = true;
  }

  // ---------- 事件 ----------
  let downButton = -1;
  let downX = 0;
  let downY = 0;

  dom.addEventListener("pointerdown", (e) => {
    if (!editing() || isUiEvent(e)) return;
    if (e.button !== 0 && e.button !== 2) return;
    downButton = e.button;
    downX = e.clientX;
    downY = e.clientY;
  });

  dom.addEventListener("pointermove", (e) => {
    if (!editing() || downButton !== -1) {
      if (!editing()) ghost.visible = false;
      return;
    }
    if (panel.usesHighlandUnitMap?.()) {
      // 山谷建筑不是正交体素，不显示会误导位置的旧格网幽灵块。
      ghost.visible = false;
      return;
    }
    showGhost(pickTarget(e));
  });

  dom.addEventListener("pointerup", (e) => {
    if (downButton === -1) return;
    const button = downButton;
    downButton = -1;
    const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    if (moved > CLICK_SLOP_PX || !editing()) return;

    if (panel.usesHighlandUnitMap?.()) {
      const highlandHit = castHighlandUnit(e);
      if (!highlandHit) return;
      const action = button === 2
        ? "erase"
        : highlandHit.empty
          ? "place"
          : highlandHit.top
            ? "raise"
            : "paint";
      if (panel.applyHighlandAction?.(highlandHit.unitId, action)) {
        const labels = {
          place: "已扩建建筑单元",
          raise: `已增至 ${Math.min((highlandHit.unit.storeys || 1) + 1, highlandHit.unit.maxStoreys || 4)} 层`,
          paint: "已更新建筑颜色",
          erase: "已删除建筑单元 · 原位保留空洞",
        };
        toast(labels[action], 1.25);
      }
      ghost.visible = false;
      return;
    }

    const hit = castCell(e);
    if (button === 2) {
      const terrainObject = castTerrainObject(e);
      if (terrainObject && panel.deleteTerrainObject?.(terrainObject.id)) {
        toast(terrainObject.type === "watchtower" ? "已删除瞭望塔" : "已删除参天树", 1.2);
      } else if (hit && panel.applySceneEdit(hit.cell, "erase")) {
        toast("已删除体块", 1.2);
      }
    } else if (hit) {
      if (hit.top && hit.cell.iy < panel.maxLevel) {
        const ok = panel.applySceneEdit(
          { ix: hit.cell.ix, iy: hit.cell.iy + 1, iz: hit.cell.iz },
          "place"
        );
        if (!ok && hit.cell.iy + 1 > panel.maxLevel) {
          toast(`已经到顶（${panel.maxLevel + 1} 层）`, 1.4);
        }
      } else if (hit.top && hit.cell.iy >= panel.maxLevel) {
        toast(`已经到顶（${panel.maxLevel + 1} 层）`, 1.4);
      } else {
        panel.applySceneEdit(hit.cell, "place"); // 侧面/到顶 → 改色
      }
    } else {
      const target = castPlane(e);
      const gridTownscaper = getCitadel()?.userData?.skipOuterTerrain === true
        || getCitadel()?.userData?.highlandTownscaperGrid === true;
      if (target?.unsupported) {
        toast(gridTownscaper ? "此处是方尖碑保护核心，不能放置" : "此处没有可承重的土坡，不可放置", 1.6);
      } else if (target) {
        const st = panel.getState();
        if (!gridTownscaper && Number.isFinite(target.terraceIndex) && target.terraceIndex !== st.activeTerrace) {
          // 点到其它台地台面/梯湖：自动切换编辑台地再落块
          panel.setActiveTerrace(target.terraceIndex);
          toast(`已切换到台地 ${target.terraceIndex + 1} · 放置体块`, 1.6);
        }
        // 运河交汇锁在台地 0；高山则对齐当前选中台地
        const terraceIndex = gridTownscaper ? 0 : panel.getState().activeTerrace;
        panel.applySceneEdit({ ...target, terraceIndex }, "place");
      }
    }
    showGhost(pickTarget(e)); // 重建后立刻刷新预览
  });

  dom.addEventListener("pointerleave", () => {
    ghost.visible = false;
  });
  dom.addEventListener("contextmenu", (e) => {
    if (editing()) e.preventDefault();
  });

  return {
    /** 当前是否处于 3D 直编辑态（面板打开且可编辑）。 */
    isEditing: () => editing(),
    /** 每帧兜底：面板关闭/落地后强制收起幽灵块。 */
    tick() {
      if (ghost.visible && !editing()) ghost.visible = false;
    },
  };
}
