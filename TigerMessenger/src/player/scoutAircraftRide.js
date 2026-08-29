// =====================================================================
//  小型侦察飞行器驾驶
//  F 登机 / 下机 · WASD 前后转向 · Space/Ctrl 升降
//  操作语义与 airshipRide 一致，但直接驾驶被选中的一架侦察机。
// =====================================================================
import * as THREE from "three";

const BOARD_RANGE = 11;
const SPEED = 15;
const TURN_SPEED = 1.65;
const VERT_SPEED = 8;
const HOVER_MIN = 7;
const HOVER_MAX = 78;
const PILOT_FOV = 72;

const _pos = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _anchor = new THREE.Vector3();

function projectTangent(vector, up, fallback = null) {
  vector.addScaledVector(up, -vector.dot(up));
  if (vector.lengthSq() < 1e-8 && fallback) vector.copy(fallback);
  if (vector.lengthSq() < 1e-8) vector.set(0, 0, 1).addScaledVector(up, -up.z);
  if (vector.lengthSq() < 1e-8) vector.set(1, 0, 0).addScaledVector(up, -up.x);
  return vector.normalize();
}

/**
 * @param {{
 *   player: object,
 *   playerGroup?: THREE.Object3D,
 *   camera: THREE.Camera,
 *   cameraRig?: object,
 *   planetRadius?: number,
 *   keys: Record<string, boolean>,
 *   getSquad: () => object|null,
 *   exitOtherRides?: () => void,
 *   elHint?: HTMLElement|null,
 *   toast?: (message: string, duration?: number) => void,
 * }} deps
 */
export function createScoutAircraftRide({
  player,
  playerGroup = null,
  camera,
  cameraRig = null,
  planetRadius = 160,
  keys,
  getSquad,
  exitOtherRides = () => {},
  elHint = null,
  toast = () => {},
}) {
  const R = Math.max(1, Number(planetRadius) || 160);
  let riding = false;
  let selected = null;
  let hover = HOVER_MIN;
  let prevDist = 0;
  let prevFov = camera?.fov ?? 60;

  function members() {
    const squad = getSquad?.();
    return Array.isArray(squad?.userData?.members) ? squad.userData.members : [];
  }

  function nearest() {
    if (!player?.position) return null;
    let best = null;
    let bestD = BOARD_RANGE;
    for (const member of members()) {
      if (!member?.visible || member.userData?.manualPilot) continue;
      const d = member.position.distanceTo(player.position);
      if (d < bestD) {
        bestD = d;
        best = member;
      }
    }
    return best;
  }

  function setHint(html) {
    if (!elHint) return;
    elHint.innerHTML = html;
    elHint.classList.toggle("show", !!html);
  }

  function refreshHint() {
    if (riding) {
      setHint(
        "[<kbd>F</kbd>] 下机 · [<kbd>W</kbd>][<kbd>S</kbd>] 进退 · " +
          "[<kbd>A</kbd>][<kbd>D</kbd>] 转向 · [<kbd>Space</kbd>/<kbd>Ctrl</kbd>] 升/降"
      );
      return;
    }
    if (player?.riding) {
      setHint(null);
      return;
    }
    const target = nearest();
    setHint(target ? "[<kbd>F</kbd>] 驾驶小型侦察飞行器" : null);
  }

  function orientAircraft() {
    if (!selected) return;
    _up.copy(selected.position).normalize();
    _forward.copy(selected.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);
    _right.crossVectors(_up, _forward).normalize();
    _basis.makeBasis(_right, _up, _forward);
    selected.quaternion.setFromRotationMatrix(_basis);
    selected.userData.forward = _forward.clone();
  }

  function capturePose() {
    if (!selected) return;
    hover = THREE.MathUtils.clamp(selected.position.length() - R, HOVER_MIN, HOVER_MAX);
    _up.copy(selected.position).normalize();
    _forward.copy(selected.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);
    selected.userData.forward = _forward.clone();
  }

  function board(target) {
    if (!target || riding || player?.riding) return false;
    exitOtherRides();
    selected = target;
    capturePose();
    getSquad?.()?.userData?.setPilot?.(selected, true);
    riding = true;
    player.riding = true;
    player.velocity?.set(0, 0, 0);
    if (playerGroup) playerGroup.visible = false;
    prevFov = camera.fov;
    prevDist = cameraRig?.getDist?.() || 0;
    cameraRig?.setFirstPerson?.(true);
    cameraRig?.setFov?.(PILOT_FOV);
    toast("已驾驶小型侦察飞行器 · WASD 驾驶 · Space/Ctrl 升降 · F 下机", 3.2);
    refreshHint();
    return true;
  }

  function dismount() {
    if (!riding) return false;
    const aircraft = selected;
    riding = false;
    selected = null;
    player.riding = false;
    if (aircraft) {
      getSquad?.()?.userData?.setPilot?.(aircraft, false);
      _up.copy(aircraft.position).normalize();
      player.position.copy(aircraft.position).addScaledVector(_up, -1.2);
    }
    if (playerGroup) playerGroup.visible = true;
    cameraRig?.setFirstPerson?.(false);
    if (prevDist && cameraRig?.setDist) cameraRig.setDist(prevDist);
    cameraRig?.setFov?.(prevFov);
    setHint(null);
    toast("已下机 · 小心脚下", 1.8);
    return true;
  }

  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.code !== "KeyF") return;
    if (riding) {
      event.preventDefault();
      dismount();
      return;
    }
    const target = nearest();
    if (!target || player?.riding) return;
    event.preventDefault();
    board(target);
  });

  function updateCamera() {
    if (!selected) return;
    selected.updateWorldMatrix?.(true, false);
    const anchor = selected.userData.cockpitAnchor;
    if (anchor?.getWorldPosition) anchor.getWorldPosition(_anchor);
    else _anchor.copy(selected.position);
    _up.copy(selected.position).normalize();
    _forward.copy(selected.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);
    camera.position.copy(_anchor);
    camera.up.copy(_up);
    camera.lookAt(_anchor.clone().addScaledVector(_forward, 40));
  }

  function update(dt = 0.016) {
    if (!riding) {
      refreshHint();
      return false;
    }
    if (!selected?.parent) {
      dismount();
      return false;
    }

    const delta = Math.min(0.05, Math.max(0, Number(dt) || 0));
    _up.copy(selected.position).normalize();
    _forward.copy(selected.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);

    const turn = (keys?.KeyA ? 1 : 0) - (keys?.KeyD ? 1 : 0);
    if (turn) _forward.applyAxisAngle(_up, turn * TURN_SPEED * delta);
    projectTangent(_forward, _up);
    const vertical =
      (keys?.Space ? 1 : 0) -
      ((keys?.ControlLeft || keys?.ControlRight) ? 1 : 0);
    hover = THREE.MathUtils.clamp(hover + vertical * VERT_SPEED * delta, HOVER_MIN, HOVER_MAX);

    const thrust = (keys?.KeyW ? 1 : 0) - (keys?.KeyS ? 1 : 0);
    if (thrust) {
      _pos.copy(selected.position).addScaledVector(_forward, thrust * SPEED * delta);
      selected.position.copy(_pos.normalize().multiplyScalar(R + hover));
    } else {
      selected.position.normalize().multiplyScalar(R + hover);
    }
    selected.userData.forward = _forward.clone();
    orientAircraft();
    _up.copy(selected.position).normalize();
    player.position.copy(selected.position).addScaledVector(_up, 0.15);
    player.forward.copy(_forward);
    player.facing.copy(_forward);
    player.velocity?.set(0, 0, 0);
    updateCamera();
    refreshHint();
    return true;
  }

  function forceExit() {
    if (riding) dismount();
  }

  return {
    update,
    forceExit,
    isRiding: () => riding,
    getAircraft: () => selected,
  };
}
