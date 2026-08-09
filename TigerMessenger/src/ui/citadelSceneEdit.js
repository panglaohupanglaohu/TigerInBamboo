// =====================================================================
//  高山圣城 · 游戏内 3D 直编辑（townscaper.html 的场景编辑能力搬进主场景）
//  - 搭建面板打开且满足 canEdit（乘坐航空艇）时生效：
//      左键点体块顶面 → 向上叠块 · 点侧面 → 改色 · 点当前层空地 → 加块
//      右键点体块 → 删块 · 悬停显示幽灵块预览
//  - 只负责射线拾取与坐标换算，布局读写全部走面板的 applySceneEdit，
//    与 2D 平面图共用同一份撤销栈 / 存档 / 即时重建。
// =====================================================================
import * as THREE from "three";
import {
  CITADEL_TOWN_SPEC,
  citadelGridCellCenter,
} from "../world/citadelTown.js";

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

const CHAR_COLORS = { W: 0xe5eff2, L: 0xd9cfac, B: 0xcaa88c, D: 0x8b5a2b };
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
  for (const hit of raycaster.intersectObjects(roots, false)) {
    if (!hit.face || !hit.object.userData.isCitadelTerrace) continue;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(up) > 0.75) return out.copy(hit.point);
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
 * @param {() => boolean} opts.canEdit 是否允许编辑（已开局且乘坐航空艇）
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
  const ndc = new THREE.Vector2();
  const upLocal = new THREE.Vector3(0, 1, 0);
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();

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

  /** 拾取体块：跳过窗/垛/穹顶等装饰件，返回格坐标与是否顶面命中。 */
  function castCell(e) {
    const ray = castRay(e);
    const citadel = getCitadel();
    if (!ray || !citadel) return null;
    const frame = editFrame();
    if (!frame) return null;
    const hits = ray.intersectObject(citadel, true);
    const activeTerrace = panel.getState().activeTerrace;
    for (const hit of hits) {
      const cell = hit.object.userData.cell;
      if (cell && hit.face && cell.terraceIndex === activeTerrace) {
        const up = upLocal.clone().applyQuaternion(frame.citadel.getWorldQuaternion(tmpQ));
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        return { cell, top: normal.dot(up) > 0.9 };
      }
      // A visible terrace surface is an occluder, not transparent picking
      // space. Stop here so a town cell hidden behind it cannot steal the
      // click; castPlane() will then resolve the selected terrace/grid cell.
      if (hit.object.userData.isCitadelTerrace) return null;
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

  /** 拾取当前台地真实顶面，落空返回 null。
   *  落地堆叠开启时自动堆到柱顶；关闭时仍用真实台面确定 x/z。 */
  function castPlane(e) {
    const ray = castRay(e);
    const frame = editFrame();
    if (!ray || !frame) return null;
    const st = panel.getState();
    const surfacePoint = raycastCitadelTerraceTop(
      frame.citadel,
      st.activeTerrace,
      ray,
      tmpV
    );
    if (!surfacePoint) return null;
    frame.citadel.worldToLocal(tmpV.copy(surfacePoint));
    const hit = panel.cellAtLocal(tmpV.x, tmpV.z, st.activeLayer);
    if (!hit) return null;
    if (!panel.supportsCell(hit.ix, hit.iz, st.activeTerrace)) {
      return { ...hit, iy: 0, unsupported: true };
    }
    if (st.dropToGround) {
      const t = panel.dropTarget(hit.ix, hit.iz);
      return t ?? { ...hit, iy: 0, unsupported: true }; // 无土坡承重的柱位
    }
    return hit;
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
      panel.getState().activeTerrace,
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
    showGhost(pickTarget(e));
  });

  dom.addEventListener("pointerup", (e) => {
    if (downButton === -1) return;
    const button = downButton;
    downButton = -1;
    const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    if (moved > CLICK_SLOP_PX || !editing()) return;

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
        panel.applySceneEdit(
          { ix: hit.cell.ix, iy: hit.cell.iy + 1, iz: hit.cell.iz },
          "place"
        );
      } else {
        panel.applySceneEdit(hit.cell, "place"); // 侧面/到顶 → 改色
      }
    } else {
      const target = castPlane(e);
      if (target?.unsupported) {
        toast("此处没有可承重的土坡，不可放置", 1.6);
      } else if (target) {
        panel.applySceneEdit(target, "place");
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
    /** 每帧兜底：面板关闭/落地后强制收起幽灵块。 */
    tick() {
      if (ghost.visible && !editing()) ghost.visible = false;
    },
  };
}
