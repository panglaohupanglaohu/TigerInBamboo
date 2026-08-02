// =====================================================================
//  电车搭乘：靠近按 F 上车 → 坐在窗内侧、面朝车外看风景 → 再按 F 下车
//  车体约定（createChristchurchTram）：长轴 +X 为车头，±Z 为侧窗
//  轨上姿态：电车 local +Z ≈ 轨道右侧（窗朝外）
// =====================================================================
import * as THREE from "three";

export const TRAM_BOARD_RANGE = 3.0;
const BOARD_TIME = 0.85;
const RIDE_DIST = 9.5; // 第三人称略远，好看见窗外

// 窗边座位：车内、贴右侧窗（local +Z 为窗外方向）
// y≈0.78：智能体缩放后头部位于窗带（~1.09）附近
const SEAT_LOCAL = new THREE.Vector3(0.35, 0.78, 0.36);
// 侧门上车点（右舷）
const DOOR_LOCAL = new THREE.Vector3(0.7, 0.28, 0.9);
// 窗外方向（车体右侧）
const LOOK_LOCAL = new THREE.Vector3(0, 0, 1);

const _seat = new THREE.Vector3();
const _up = new THREE.Vector3();
const _out = new THREE.Vector3();
const _along = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {() => import("three").Object3D|null} deps.getTram
 * @param {object} deps.cameraRig
 * @param {HTMLElement|null} deps.elHint
 * @param {() => void} [deps.onBoard]
 */
export function createTramRide({ player, getTram, cameraRig, elHint, onBoard }) {
  /** @type {'idle'|'boarding'|'riding'} */
  let state = "idle";
  let boardT = 0;
  let prevDist = 0;
  let lookPhase = 0;

  function tram() {
    return getTram ? getTram() : null;
  }

  function nearTram() {
    const t = tram();
    if (!t) return false;
    return player.position.distanceTo(t.position) <= TRAM_BOARD_RANGE;
  }

  /** 车窗朝外的世界方向（切平面内） */
  function windowOutDir(t, up, out) {
    // 车体 local +Z 经姿态变换 → 窗外
    out.copy(LOOK_LOCAL).applyQuaternion(t.quaternion);
    out.addScaledVector(up, -out.dot(up));
    if (out.lengthSq() < 1e-6) {
      // 兜底：座位相对车心的横向
      out.copy(_seat).sub(t.position);
      out.addScaledVector(up, -out.dot(up));
    }
    if (out.lengthSq() > 1e-6) out.normalize();
    else out.set(1, 0, 0);
    return out;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyF" || e.repeat) return;
    if (state === "idle") {
      if (!nearTram()) return;
      state = "boarding";
      boardT = 0;
      prevDist = cameraRig.getDist ? cameraRig.getDist() : 0;
      if (cameraRig.setDist) cameraRig.setDist(RIDE_DIST);
      player.riding = true;
      onBoard?.();
    } else {
      // 下车：放到车侧空地
      const t = tram();
      state = "idle";
      player.riding = false;
      if (cameraRig.setDist && prevDist) cameraRig.setDist(prevDist);
      if (t) {
        _up.copy(t.position).normalize();
        // 从右侧门附近下车
        _tmp.copy(DOOR_LOCAL).applyQuaternion(t.quaternion).add(t.position);
        _tmp.addScaledVector(_up, 0.15);
        // 再往窗外挪一步，避免卡在车里
        windowOutDir(t, _up, _out);
        _tmp.addScaledVector(_out, 1.1);
        player.position.copy(_tmp);
        player.position.setLength(player.position.length());
        player.forward.copy(_out);
        player.facing.copy(_out);
      }
      player.velocity.set(0, 0, 0);
    }
  });

  /**
   * 每帧调用。
   * @returns {boolean} 是否接管玩家控制
   */
  function update(dt) {
    const t = tram();

    if (state === "idle") {
      player.riding = false;
      if (elHint) {
        const show = !!t && nearTram();
        elHint.classList.toggle("show", show);
      }
      return false;
    }

    if (elHint) elHint.classList.remove("show");
    if (!t) {
      state = "idle";
      player.riding = false;
      return false;
    }

    _up.copy(t.position).normalize();

    if (state === "boarding") {
      boardT += dt;
      // 先到门边，再滑进座位
      const u = Math.min(1, boardT / BOARD_TIME);
      _tmp.copy(DOOR_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      _seat.copy(SEAT_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      player.position.lerpVectors(_tmp, _seat, u * u); // 加速进座
      player.velocity.set(0, 0, 0);
      // 上车过程：逐渐转向窗外
      windowOutDir(t, _up, _out);
      _along.copy(t.position).sub(player.position);
      _along.addScaledVector(_up, -_along.dot(_up));
      if (_along.lengthSq() > 1e-6) _along.normalize();
      player.forward.lerpVectors(_along, _out, u).normalize();
      player.facing.copy(player.forward);
      if (boardT >= BOARD_TIME) {
        state = "riding";
        lookPhase = 0;
      }
      return true;
    }

    // ---------- riding：坐在窗内侧，面朝窗外 ----------
    _seat.copy(SEAT_LOCAL).applyQuaternion(t.quaternion).add(t.position);
    player.position.copy(_seat);
    player.velocity.set(0, 0, 0);

    // 主朝向 = 窗外（local +Z）
    windowOutDir(t, _up, _out);
    // 轻微左右扫视（仍以朝外为主，不转回车内）
    lookPhase += dt * 0.45;
    const sway = Math.sin(lookPhase) * 0.22;
    _along.crossVectors(_up, _out).normalize(); // 沿车长方向
    _look.copy(_out).addScaledVector(_along, sway);
    // 略微抬头看远景
    _look.addScaledVector(_up, 0.08 + 0.04 * Math.sin(lookPhase * 0.7));
    _look.addScaledVector(_up, -_look.dot(_up) * 0.15); // 保持大致切向
    if (_look.lengthSq() > 1e-6) _look.normalize();
    else _look.copy(_out);

    player.forward.copy(_look);
    player.facing.copy(_look);
    player.riding = true;
    return true;
  }

  return {
    update,
    isRiding: () => state !== "idle",
    getState: () => state,
  };
}
