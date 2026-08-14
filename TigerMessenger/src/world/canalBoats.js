// =====================================================================
//  运河巡游战船：复制古战船（createFisherBoat）沿星海运河闭合环线巡航
//  - 未搭乘时：沿 canal.curve 匀速前进，船头朝切向，吃水贴 canal.waterR
//  - 搭乘时：userData.piloted = true，本系统停更，改由 boatRide WASD 驾驶
//  - 下船后：从当前位置吸附回曲线最近点，继续巡游
// =====================================================================
import * as THREE from "three";
import {
  createFisherBoat,
  updateWarshipOars,
  applyBoatOarWobble,
} from "../assets/harbor.js";

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _z = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** 默认巡航艘数 */
export const CANAL_BOAT_COUNT = 10;
/** 闭合环一周基准耗时（秒）；各船略有速度差 */
const LAP_SECONDS = 180;
/** 略高于水面，避免与 canal-water z-fight */
const DRAFT_LIFT = 0.12;

/**
 * @param {THREE.Scene} scene
 * @param {{ curve: THREE.CatmullRomCurve3, waterR: number, bedR?: number }|null} canal
 * @param {object} [opts]
 * @param {number} [opts.count=10]
 * @param {number} [opts.scale=1.84] 战船整体放大一倍（含剪纸桨手）
 * @returns {{
 *   boats: THREE.Group[],
 *   update(dt: number): void,
 *   getNearestBoat(pos: THREE.Vector3, maxDist?: number): THREE.Object3D|null,
 *   getBoardableBoats(): THREE.Object3D[],
 * }}
 */
export function createCanalBoatPatrol(scene, canal, opts = {}) {
  const boats = [];
  if (!canal?.curve || !Number.isFinite(canal.waterR)) {
    return {
      boats,
      update() {},
      getNearestBoat() { return null; },
      getBoardableBoats: () => boats,
    };
  }

  const count = Math.max(1, Math.min(12, opts.count ?? CANAL_BOAT_COUNT));
  const scale = opts.scale ?? 1.84;
  const waterR = canal.waterR;
  const curve = canal.curve;
  const baseSpeed = 1 / LAP_SECONDS; // 参数 u 每秒增量

  for (let i = 0; i < count; i++) {
    const boat = createFisherBoat();
    boat.name = `canal-warship-${i}`;
    boat.scale.setScalar(scale);
    boat.userData.kind = "canal-warship";
    boat.userData.canalPatrol = true;
    boat.userData.piloted = false;
    // 均匀相位 + 轻微速度差，避免扎堆
    boat.userData.u = (i / count + 0.03 * i) % 1;
    boat.userData.speed = baseSpeed * (0.88 + (i % 3) * 0.08);
    placeOnCurve(boat, curve, waterR, boat.userData.u);
    scene.add(boat);
    boats.push(boat);
  }

  function placeOnCurve(boat, curveRef, r, u) {
    const uu = ((u % 1) + 1) % 1;
    curveRef.getPointAt(uu, _p);
    _up.copy(_p).normalize();
    curveRef.getTangentAt(uu, _t);
    _fwd.copy(_t).addScaledVector(_up, -_t.dot(_up));
    if (_fwd.lengthSq() < 1e-8) {
      _fwd.set(1, 0, 0).addScaledVector(_up, -_up.x);
    }
    _fwd.normalize();
    _z.crossVectors(_fwd, _up).normalize();
    // 船体局部 +X = 船头，+Y = 法线（与 boatRide 约定一致）
    _basis.makeBasis(_fwd, _up, _z);
    boat.quaternion.setFromRotationMatrix(_basis);
    boat.position.copy(_up).multiplyScalar(r + DRAFT_LIFT);
  }

  /** 世界位置 → 曲线最近参数 u（粗采样） */
  function nearestU(worldPos) {
    let bestU = 0;
    let bestD = Infinity;
    const steps = 96;
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      curve.getPointAt(u, _p);
      const d = _p.normalize().angleTo(worldPos.clone().normalize());
      if (d < bestD) {
        bestD = d;
        bestU = u;
      }
    }
    return bestU;
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const boat of boats) {
      if (boat.userData.piloted) {
        // 驾驶中由 boatRide 负责桨动画
        continue;
      }
      // 旧港物流接管：离港入河 / 护城河进港途中，位置由 harborLogistics 写
      if (boat.userData.harborMission || boat.userData.harborDocked) {
        continue;
      }
      // 运河—大湖落差互联（瀑布船道/升船机）接管：自驱动巡航与绕湖通航
      if (boat.userData.lakeLinkStep) {
        boat.userData.lakeLinkStep(boat, dt, { curve, waterR, place: placeOnCurve });
        continue;
      }
      // 若刚下船，从当前位置重新吸附到航道
      if (boat.userData.needsSnap) {
        boat.userData.u = nearestU(boat.position);
        boat.userData.needsSnap = false;
      }
      boat.userData.u = (boat.userData.u + boat.userData.speed * dt) % 1;
      placeOnCurve(boat, curve, waterR, boat.userData.u);
      // 巡航中双侧船桨划水（强度随船速）
      const rowStrength = Math.min(1, (boat.userData.speed / baseSpeed) * 0.95);
      updateWarshipOars(boat, dt, rowStrength);
      // 部分桨手被麻醉 → 船身歪扭
      applyBoatOarWobble(boat, dt);
    }
  }

  function getNearestBoat(pos, maxDist = 5.5) {
    if (!pos) return null;
    let best = null;
    let bestD = maxDist;
    for (const boat of boats) {
      const d = pos.distanceTo(boat.position);
      if (d < bestD) {
        bestD = d;
        best = boat;
      }
    }
    return best;
  }

  return {
    boats,
    update,
    getNearestBoat,
    getBoardableBoats: () => boats,
    /** 世界位置 → 曲线最近参数 u（旧港离港汇入运河用） */
    nearestU,
    /** 下船时调用，下一帧巡游从当前位置吸附回航道 */
    markNeedsSnap(boat) {
      if (boat?.userData?.canalPatrol) boat.userData.needsSnap = true;
    },
  };
}
