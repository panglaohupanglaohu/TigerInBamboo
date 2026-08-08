// =====================================================================
//  渔船驾驶：靠近船体按 [F] 上船 · WASD 驾驶 · [F] 下船
//  船体初始挂在码头场景下；第一次上船时转为世界根节点，之后可停在任意水面位置。
// =====================================================================
import * as THREE from "three";

const BOARD_RANGE = 4.2;
const SPEED = 6.5;
const TURN_SPEED = 1.45;
const CAMERA_DIST = 6.2;
const BOAT_EYE_HEIGHT = 0.72;
const EXIT_SIDE = 1.65;

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _next = new THREE.Vector3();
const _boatWorld = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _z = new THREE.Vector3();
const _seat = new THREE.Vector3();

/**
 * @param {object} deps
 * @param {THREE.Scene} deps.scene
 * @param {object} deps.player
 * @param {THREE.Object3D|null} [deps.playerGroup]
 * @param {() => THREE.Object3D|null} deps.getBoat
 * @param {object} deps.cameraRig
 * @param {Record<string, boolean>} deps.keys
 * @param {HTMLElement|null} [deps.elHint]
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 * @param {() => void} [deps.exitOtherRides]
 */
export function createBoatRide({
  scene,
  player,
  playerGroup = null,
  getBoat,
  cameraRig,
  keys,
  elHint = null,
  toast = () => {},
  exitOtherRides = () => {},
}) {
  let riding = false;
  let boat = null;
  let surfaceRadius = 0;
  let prevCamDist = 0;

  function getWorldPosition(target) {
    const b = getBoat?.() || null;
    if (!b) return null;
    b.getWorldPosition(target);
    return b;
  }

  function nearBoat() {
    const b = getWorldPosition(_boatWorld);
    return !!b && player.position.distanceTo(_boatWorld) <= BOARD_RANGE;
  }

  function setHint(html) {
    if (!elHint) return;
    if (html) {
      elHint.innerHTML = html;
      elHint.classList.add("show");
    } else {
      elHint.classList.remove("show");
    }
  }

  function projectTangent(vector, up) {
    vector.addScaledVector(up, -vector.dot(up));
    if (vector.lengthSq() < 1e-6) vector.set(1, 0, 0).addScaledVector(up, -up.x);
    return vector.normalize();
  }

  /** 船体局部 +X 是船头，局部 +Y 是球面法线。 */
  function orientBoat() {
    _up.copy(boat.position).normalize();
    projectTangent(_fwd, _up);
    _z.crossVectors(_fwd, _up).normalize();
    _basis.makeBasis(_fwd, _up, _z);
    boat.quaternion.setFromRotationMatrix(_basis);
  }

  function captureForward() {
    _fwd.set(1, 0, 0).applyQuaternion(boat.quaternion);
    _up.copy(boat.position).normalize();
    projectTangent(_fwd, _up);
  }

  function mount(target) {
    if (!target || riding || player.riding) return false;
    exitOtherRides();
    boat = target;
    // 保持当前世界姿态，把船从码头层级中解出，之后开到哪里都不会被码头变换限制。
    scene.attach(boat);
    boat.userData.piloted = true;
    surfaceRadius = boat.position.length();
    captureForward();
    riding = true;
    player.riding = true;
    player.velocity.set(0, 0, 0);
    prevCamDist = cameraRig?.getDist?.() ?? 0;
    cameraRig?.setDist?.(CAMERA_DIST);
    if (playerGroup) playerGroup.visible = false;
    player.position.copy(boat.position).addScaledVector(_up, BOAT_EYE_HEIGHT);
    player.position.setLength(surfaceRadius + BOAT_EYE_HEIGHT);
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    setHint("[<kbd>WASD</kbd>] 驾驶 · [<kbd>F</kbd>] 下船");
    toast("已登上渔船 · WASD 驾驶 · F 下船", 3.2);
    return true;
  }

  function dismount() {
    if (!boat) return;
    _up.copy(boat.position).normalize();
    _fwd.set(1, 0, 0).applyQuaternion(boat.quaternion);
    projectTangent(_fwd, _up);
    _side.crossVectors(_up, _fwd).normalize();
    _seat.copy(boat.position)
      .addScaledVector(_up, 0.7)
      .addScaledVector(_side, EXIT_SIDE);
    _seat.setLength(surfaceRadius + 0.7);
    player.position.copy(_seat);
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    player.velocity.set(0, 0, 0);
    boat.userData.piloted = false;
    boat = null;
    riding = false;
    player.riding = false;
    if (playerGroup) playerGroup.visible = true;
    if (prevCamDist) cameraRig?.setDist?.(prevCamDist);
    setHint(null);
    toast("已离开渔船", 1.8);
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyF") return;
    if (riding) {
      e.preventDefault();
      dismount();
      return;
    }
    if (!player.riding && nearBoat()) {
      e.preventDefault();
      mount(getBoat?.() || null);
    }
  });

  function update(dt) {
    if (!riding) {
      const otherRideActive = !!player.riding;
      if (!otherRideActive) player.riding = false;
      const b = getWorldPosition(_boatWorld);
      setHint(
        !otherRideActive && b && player.position.distanceTo(_boatWorld) <= BOARD_RANGE
          ? "[<kbd>F</kbd>] 上船 · WASD 驾驶"
          : null
      );
      return false;
    }

    if (!boat || !boat.parent) {
      dismount();
      return false;
    }

    _up.copy(boat.position).normalize();
    const k = keys || {};
    const turn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    const thrust = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    if (turn) _fwd.applyAxisAngle(_up, turn * TURN_SPEED * dt);
    projectTangent(_fwd, _up);

    if (thrust) {
      _next.copy(_up).multiplyScalar(surfaceRadius).addScaledVector(_fwd, thrust * SPEED * dt);
      _next.normalize().multiplyScalar(surfaceRadius);
      boat.position.copy(_next);
    }
    orientBoat();

    _up.copy(boat.position).normalize();
    player.position.copy(boat.position).addScaledVector(_up, BOAT_EYE_HEIGHT);
    player.position.setLength(surfaceRadius + BOAT_EYE_HEIGHT);
    player.velocity.set(0, 0, 0);
    player.riding = true;
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    setHint("[<kbd>WASD</kbd>] 驾驶 · [<kbd>F</kbd>] 下船");
    return true;
  }

  return {
    update,
    forceExit: () => { if (riding) dismount(); },
    isRiding: () => riding,
  };
}
