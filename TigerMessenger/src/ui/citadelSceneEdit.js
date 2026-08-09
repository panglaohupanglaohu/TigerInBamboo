// =====================================================================
//  高山圣城 · 游戏内 3D 直编辑（townscaper.html 的场景编辑能力搬进主场景）
//  - 搭建面板打开且满足 canEdit（乘坐航空艇）时生效：
//      左键点体块顶面 → 向上叠块 · 点侧面 → 改色 · 点当前层空地 → 加块
//      右键点体块 → 删块 · 悬停显示幽灵块预览
//  - 只负责射线拾取与坐标换算，布局读写全部走面板的 applySceneEdit，
//    与 2D 平面图共用同一份撤销栈 / 存档 / 即时重建。
// =====================================================================
import * as THREE from "three";
import { CITADEL_TOWN_SPEC } from "../world/citadelTown.js";

const CHAR_COLORS = { W: 0xe5eff2, L: 0xd9cfac, B: 0xcaa88c, D: 0x8b5a2b };
const CLICK_SLOP_PX = 6; // 按下到抬起位移小于此值才算点击（区分相机拖拽）

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
  const tmpM = new THREE.Matrix4();
  const layerPlane = new THREE.Plane(upLocal, 0);

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

  /** 参考 level 组：体块局部坐标 → 世界坐标的变换基准（每次现取，重建后不失效）。 */
  function refGroup() {
    return getCitadel()?.getObjectByName("town-level-0") || null;
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
    const ref = refGroup();
    if (!ref) return null;
    const hits = ray.intersectObject(citadel, true);
    for (const hit of hits) {
      const cell = hit.object.userData.cell;
      if (!cell || !hit.face) continue;
      const up = upLocal.clone().applyQuaternion(ref.getWorldQuaternion(tmpQ));
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      return { cell, top: normal.dot(up) > 0.9 };
    }
    return null;
  }

  /** 拾取地板平面（level 组局部空间），落空返回 null。
   *  落地堆叠开启时打 0 层地面、落点自动堆到柱顶；关闭时打当前层平面。 */
  function castPlane(e) {
    const ray = castRay(e);
    const ref = refGroup();
    if (!ray || !ref) return null;
    ref.updateWorldMatrix(true, false);
    tmpM.copy(ref.matrixWorld).invert();
    const localRay = ray.ray.clone().applyMatrix4(tmpM);
    const st = panel.getState();
    layerPlane.constant = -(st.dropToGround ? 0 : st.activeLayer) * CELL_H;
    if (!localRay.intersectPlane(layerPlane, tmpV)) return null;
    const hit = panel.cellAtLocal(tmpV.x, tmpV.z, st.activeLayer);
    if (!hit) return null;
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
    const ref = refGroup();
    if (!target || !ref) {
      ghost.visible = false;
      return;
    }
    const c = panel.cellCenter(target.ix, target.iy, target.iz);
    ref.updateWorldMatrix(true, false);
    ghost.position.copy(ref.localToWorld(tmpV.set(c.x, c.y, c.z)));
    ghost.quaternion.copy(ref.getWorldQuaternion(tmpQ));
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
      if (hit && panel.applySceneEdit(hit.cell, "erase")) toast("已删除体块", 1.2);
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
