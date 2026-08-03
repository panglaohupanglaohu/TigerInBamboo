// =====================================================================
//  电车搭乘：F 上车/下车 · C 切换乘客窗景 / 司机视野
//  车体约定（createChristchurchTram）：长轴 +X 为车头，±Z 为侧窗
//  轨上姿态：电车 local +Z ≈ 轨道右侧（窗朝外）
// =====================================================================
import * as THREE from "three";

export const TRAM_BOARD_RANGE = 3.0;
const BOARD_TIME = 0.85;
const RIDE_DIST = 9.5; // 乘客第三人称：略远，好看见窗外
const DRIVER_DIST = 0.35; // 司机视野：贴驾驶室，近乎第一人称
const DRIVER_FOV = 78; // 深峡谷进城段使用广角，强化城市揭幕与桥面速度感

// 窗边座位：车内、贴右侧窗（local +Z 为窗外方向）
const SEAT_LOCAL = new THREE.Vector3(0.35, 0.78, 0.36);
// 驾驶位：车头驾驶室、略抬高（智能体眼高）
const DRIVER_SEAT_LOCAL = new THREE.Vector3(1.72, 1.02, 0.0);
// 侧门上车点（右舷）
const DOOR_LOCAL = new THREE.Vector3(0.7, 0.28, 0.9);
// 窗外方向（车体右侧）
const LOOK_OUT = new THREE.Vector3(0, 0, 1);
// 车头前进方向
const LOOK_AHEAD = new THREE.Vector3(1, 0, 0);

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
 * @param {(tram:import("three").Object3D) => void} [deps.onBoard]
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 */
export function createTramRide({ player, getTram, cameraRig, elHint, onBoard, toast = () => {} }) {
  /** @type {'idle'|'boarding'|'riding'} */
  let state = "idle";
  /** @type {'passenger'|'driver'} 乘客窗景 / 司机视野 */
  let viewMode = "passenger";
  let boardT = 0;
  let prevDist = 0;
  let prevFov = 60;
  let lookPhase = 0;
  let activeTram = null;

  function tram() {
    if (state !== "idle" && activeTram) return activeTram;
    return getTram ? getTram() : null;
  }

  function nearTram() {
    const t = tram();
    if (!t) return false;
    return player.position.distanceTo(t.position) <= TRAM_BOARD_RANGE;
  }

  /** 车窗朝外的世界方向（切平面内） */
  function windowOutDir(t, up, out) {
    out.copy(LOOK_OUT).applyQuaternion(t.quaternion);
    out.addScaledVector(up, -out.dot(up));
    if (out.lengthSq() < 1e-6) {
      out.copy(_seat).sub(t.position);
      out.addScaledVector(up, -out.dot(up));
    }
    if (out.lengthSq() > 1e-6) out.normalize();
    else out.set(1, 0, 0);
    return out;
  }

  /** 车头前进世界方向（切平面内） */
  function trackFwdDir(t, up, out) {
    out.copy(LOOK_AHEAD).applyQuaternion(t.quaternion);
    out.addScaledVector(up, -out.dot(up));
    if (out.lengthSq() > 1e-6) out.normalize();
    else out.set(0, 0, 1);
    return out;
  }

  function applyCameraForView() {
    if (!cameraRig?.setDist) return;
    if (viewMode === "driver") {
      cameraRig.setDist(DRIVER_DIST);
      cameraRig.setFov?.(DRIVER_FOV);
    } else {
      cameraRig.setDist(RIDE_DIST);
      cameraRig.setFov?.(prevFov);
    }
  }

  function setViewMode(mode) {
    if (mode !== "passenger" && mode !== "driver") return;
    if (viewMode === mode) return;
    viewMode = mode;
    applyCameraForView();
    if (mode === "driver") {
      toast("司机视野 · 再按 C 回到窗边乘客视角", 2.4);
    } else {
      toast("乘客窗景 · 再按 C 切换司机视野", 2.2);
    }
    refreshRideHint();
  }

  function toggleDriverView() {
    if (state !== "riding" && state !== "boarding") return;
    // 上车动画中也允许预切，但正式生效在 riding
    setViewMode(viewMode === "driver" ? "passenger" : "driver");
  }

  function refreshRideHint() {
    if (!elHint || state === "idle") return;
    elHint.classList.add("show");
    if (viewMode === "driver") {
      elHint.innerHTML =
        "[<kbd>C</kbd>] 乘客窗景 · [<kbd>F</kbd>] 下车";
    } else {
      elHint.innerHTML =
        "[<kbd>C</kbd>] 司机视野 · [<kbd>F</kbd>] 下车";
    }
  }

  function alight() {
    const t = tram();
    state = "idle";
    viewMode = "passenger";
    player.riding = false;
    if (cameraRig.setDist && prevDist) cameraRig.setDist(prevDist);
    cameraRig.setFov?.(prevFov);
    if (t) {
      _up.copy(t.position).normalize();
      _tmp.copy(DOOR_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      _tmp.addScaledVector(_up, 0.15);
      windowOutDir(t, _up, _out);
      _tmp.addScaledVector(_out, 1.1);
      player.position.copy(_tmp);
      player.position.setLength(player.position.length());
      player.forward.copy(_out);
      player.facing.copy(_out);
    }
    player.velocity.set(0, 0, 0);
    activeTram = null;
    if (elHint) elHint.classList.remove("show");
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    // C：仅在车上切换司机/乘客视野
    if (e.code === "KeyC") {
      if (state === "idle") return;
      e.preventDefault();
      toggleDriverView();
      return;
    }

    if (e.code !== "KeyF") return;
    if (state === "idle") {
      if (!nearTram()) return;
      state = "boarding";
      activeTram = tram();
      boardT = 0;
      viewMode = "passenger";
      prevDist = cameraRig.getDist ? cameraRig.getDist() : 0;
      prevFov = cameraRig.getFov?.() ?? cameraRig.getDefaultFov?.() ?? 60;
      if (cameraRig.setDist) cameraRig.setDist(RIDE_DIST);
      player.riding = true;
      onBoard?.(activeTram);
    } else {
      alight();
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
        if (show) {
          elHint.innerHTML = "[<kbd>F</kbd>] 上车 · 窗边看风景";
        }
      }
      return false;
    }

    if (!t) {
      state = "idle";
      viewMode = "passenger";
      player.riding = false;
      activeTram = null;
      if (elHint) elHint.classList.remove("show");
      return false;
    }

    _up.copy(t.position).normalize();

    if (state === "boarding") {
      if (elHint) elHint.classList.remove("show");
      boardT += dt;
      const u = Math.min(1, boardT / BOARD_TIME);
      _tmp.copy(DOOR_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      // 若已切司机，进站过程结束坐驾驶位
      const targetSeat = viewMode === "driver" ? DRIVER_SEAT_LOCAL : SEAT_LOCAL;
      _seat.copy(targetSeat).applyQuaternion(t.quaternion).add(t.position);
      player.position.lerpVectors(_tmp, _seat, u * u);
      player.velocity.set(0, 0, 0);

      if (viewMode === "driver") {
        trackFwdDir(t, _up, _out);
        player.forward.copy(_out);
      } else {
        windowOutDir(t, _up, _out);
        _along.copy(t.position).sub(player.position);
        _along.addScaledVector(_up, -_along.dot(_up));
        if (_along.lengthSq() > 1e-6) _along.normalize();
        player.forward.lerpVectors(_along, _out, u).normalize();
      }
      player.facing.copy(player.forward);
      if (boardT >= BOARD_TIME) {
        state = "riding";
        lookPhase = 0;
        applyCameraForView();
        refreshRideHint();
        if (viewMode === "passenger") {
          toast("已上车 · 坐在窗边 · 按 C 切换司机视野 · F 下车", 3.2);
        }
      }
      return true;
    }

    // ---------- riding ----------
    refreshRideHint();
    player.velocity.set(0, 0, 0);
    player.riding = true;

    if (viewMode === "driver") {
      // 司机位：坐驾驶室，面朝车头/轨道前方
      _seat.copy(DRIVER_SEAT_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      player.position.copy(_seat);
      trackFwdDir(t, _up, _out);
      // 轻微随轨道起伏抬头看远
      lookPhase += dt * 0.35;
      _look.copy(_out).addScaledVector(_up, 0.04 + 0.02 * Math.sin(lookPhase));
      _look.addScaledVector(_up, -_look.dot(_up) * 0.2);
      if (_look.lengthSq() > 1e-6) _look.normalize();
      else _look.copy(_out);
      player.forward.copy(_look);
      player.facing.copy(_look);
    } else {
      // 乘客：窗内侧，面朝窗外
      _seat.copy(SEAT_LOCAL).applyQuaternion(t.quaternion).add(t.position);
      player.position.copy(_seat);
      windowOutDir(t, _up, _out);
      lookPhase += dt * 0.45;
      const sway = Math.sin(lookPhase) * 0.22;
      _along.crossVectors(_up, _out).normalize();
      _look.copy(_out).addScaledVector(_along, sway);
      _look.addScaledVector(_up, 0.08 + 0.04 * Math.sin(lookPhase * 0.7));
      _look.addScaledVector(_up, -_look.dot(_up) * 0.15);
      if (_look.lengthSq() > 1e-6) _look.normalize();
      else _look.copy(_out);
      player.forward.copy(_look);
      player.facing.copy(_look);
    }

    return true;
  }

  return {
    update,
    isRiding: () => state !== "idle",
    getState: () => state,
    getViewMode: () => viewMode,
    isDriverView: () => viewMode === "driver" && state !== "idle",
    toggleDriverView,
  };
}
