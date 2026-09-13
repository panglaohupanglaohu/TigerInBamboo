// =====================================================================
//  战船/渔船驾驶：靠近船体按 [F] 上船 · WASD 驾驶 · [F] 下船
//  - 码头古战船：第一次上船时从码头层级 attach 到场景根
//  - 运河巡游战船：上船暂停巡游（piloted），下船后继续沿运河巡航
// =====================================================================
import * as THREE from "three";
import { updateWarshipOars, applyBoatOarWobble } from "../assets/harbor.js";

const BOARD_RANGE = 5.2;
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
 * @param {() => THREE.Object3D|null} deps.getBoat 返回最近可登之船（码头 + 运河巡游）
 * @param {object} deps.cameraRig
 * @param {Record<string, boolean>} deps.keys
 * @param {HTMLElement|null} [deps.elHint]
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 * @param {() => void} [deps.exitOtherRides]
 * @param {(boat: THREE.Object3D) => void} [deps.onDismount] 下船回调（运河船吸附回航道）
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
  onDismount = () => {},
}) {
  let riding = false;
  let boat = null;
  let surfaceRadius = 0;
  let prevCamDist = 0;
  let crossing = null;
  let deckPosition = null;

  // The berth supplies a measured world-space route, ordered quay -> deck.
  // Keep this opt-in until the actual quay connector has been installed.
  function beginCrossing(target, leaving = false) {
    const route = target?.userData.boardingRoute;
    const gate = target?.userData.boardingGate;
    if (!route || !gate || crossing) return false;
    const points = route.map(p => p.clone());
    if (leaving) points.reverse();
    if (points.length < 2 || points.some(p => ![p.x,p.y,p.z].every(Number.isFinite))) return false;
    if (player.position.distanceTo(points[0]) > 1.6) return false;
    if (!gate.deploy({stopped:true})) return false;
    crossing = {target, gate, points:[player.position.clone(), ...points], index:1, leaving, entered:false};
    player.boardingOnFoot=true;player.onGround=true;
    target.userData.piloted = true;
    player.riding = true;
    player.velocity.set(0,0,0);
    if (playerGroup) playerGroup.visible = true;
    return true;
  }

  function updateCrossing(dt) {
    const c = crossing;
    c.gate.tick(dt);
    if (!c.entered) {
      if (c.gate.snapshot().phase !== 'deployed') return true;
      if (!c.gate.enter('player')) return true;
      c.entered = true;
    }
    let remaining = Math.max(0,dt) * 1.2;
    const before = player.position.clone();
    while (remaining > 0 && c.index < c.points.length) {
      const next = c.points[c.index], distance = player.position.distanceTo(next);
      if (distance <= remaining) {player.position.copy(next);remaining -= distance;c.index++;}
      else {player.position.lerp(next,remaining/distance);remaining=0;}
    }
    player.velocity.copy(player.position).sub(before).divideScalar(Math.max(dt,1e-6));
    if (player.velocity.lengthSq() > 1e-8) {
      player.forward.copy(player.velocity).normalize();player.facing.copy(player.forward);
    }
    setHint(c.leaving?'正在沿跳板下船':'正在沿跳板登船');
    if (c.index === c.points.length) {
      c.gate.leave('player');crossing=null;
      if (c.leaving) finishDismount(c.target,player.position.clone());
      else {
        player.riding=false;
        mount(c.target,player.position.clone());
        c.gate.retract();
      }
    }
    return true;
  }

  function getWorldPosition(target) {
    const b = getBoat?.() || null;
    if (!b) return null;
    b.getWorldPosition(target);
    return b;
  }

  function nearBoat() {
    const b = getWorldPosition(_boatWorld);
    const berth=b?.userData.frontHarborBerth;
    return !!b && (player.position.distanceTo(_boatWorld) <= BOARD_RANGE ||
      (b.userData.boardingRoute?.[0] && player.position.distanceTo(b.userData.boardingRoute[0])<=1.6) ||
      (berth&&_boatWorld.distanceTo(berth.position)<1&&player.position.distanceTo(berth.exit)<=1.6));
  }

  function boatLabel(target) {
    if (target?.userData?.oceanPatrol || target?.userData?.kind === "ocean-warship") return "海面战船";
    if (target?.userData?.canalPatrol) return "运河战船";
    if (target?.name === "fisher-boat") return "古战船";
    return "战船";
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

  function mount(target, deckPoint = null) {
    if (!target || riding || player.riding) return false;
    exitOtherRides();
    boat = target;
    // 保持当前世界姿态；码头船从 pier 层级解出，运河船已在场景根下。
    if (boat.parent !== scene) scene.attach(boat);
    boat.userData.piloted = true;
    surfaceRadius = boat.position.length();
    captureForward();
    riding = true;
    player.boardingOnFoot=!!deckPoint;
    player.riding = true;
    player.velocity.set(0, 0, 0);
    prevCamDist = cameraRig?.getDist?.() ?? 0;
    cameraRig?.setDist?.(CAMERA_DIST);
    deckPosition = deckPoint ? boat.worldToLocal(deckPoint.clone()) : null;
    if (playerGroup) playerGroup.visible = !!deckPosition;
    if (deckPosition) player.position.copy(deckPoint);
    else {
      player.position.copy(boat.position).addScaledVector(_up, BOAT_EYE_HEIGHT);
      player.position.setLength(surfaceRadius + BOAT_EYE_HEIGHT);
    }
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    setHint("[<kbd>WASD</kbd>] 驾驶 · [<kbd>F</kbd>] 下船");
    toast(`已登上${boatLabel(boat)} · WASD 驾驶 · F 下船`, 3.2);
    return true;
  }

  function dismount() {
    if (!boat) return;
    const left = boat;
    _up.copy(boat.position).normalize();
    _fwd.set(1, 0, 0).applyQuaternion(boat.quaternion);
    projectTangent(_fwd, _up);
    _side.crossVectors(_up, _fwd).normalize();
    _seat.copy(boat.position)
      .addScaledVector(_up, 0.7)
      .addScaledVector(_side, EXIT_SIDE);
    _seat.setLength(surfaceRadius + 0.7);
    const berth=left.userData.frontHarborBerth;
    if(berth&&left.position.distanceTo(berth.position)<1){
      _seat.copy(berth.exit).addScaledVector(berth.exit.clone().normalize(),.08);
    }
    finishDismount(left,_seat);
  }

  function finishDismount(left, position) {
    player.position.copy(position);
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    player.velocity.set(0, 0, 0);
    left.userData.piloted = false;
    boat = null;
    riding = false;
    player.boardingOnFoot=false;
    deckPosition = null;
    player.riding = false;
    if (playerGroup) playerGroup.visible = true;
    if (prevCamDist) cameraRig?.setDist?.(prevCamDist);
    setHint(null);
    onDismount(left);
    toast(`已离开${boatLabel(left)}`, 1.8);
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyF") return;
    if (crossing) {e.preventDefault();return;}
    if (riding) {
      e.preventDefault();
      if (boat.userData.boardingRoute) beginCrossing(boat,true);
      else dismount();
      return;
    }
    if (!player.riding && nearBoat()) {
      e.preventDefault();
      const target=getBoat?.() || null;
      if (target?.userData.boardingRoute) beginCrossing(target);
      else mount(target);
    }
  });

  function update(dt) {
    if (crossing) return updateCrossing(dt);
    if (!riding) {
      const otherRideActive = !!player.riding;
      if (!otherRideActive) player.riding = false;
      const b = getWorldPosition(_boatWorld);
      setHint(
        !otherRideActive && b && nearBoat()
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
    if (deckPosition) boat.userData.boardingGate?.tick(dt);
    const boardingLocked=boat.userData.boardingGate?.snapshot().canSail===false;
    const turn = boardingLocked?0:(k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    const thrust = boardingLocked?0:(k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    if (turn) _fwd.applyAxisAngle(_up, turn * TURN_SPEED * dt);
    projectTangent(_fwd, _up);

    if (thrust) {
      _next.copy(_up).multiplyScalar(surfaceRadius).addScaledVector(_fwd, thrust * SPEED * dt);
      _next.normalize().multiplyScalar(surfaceRadius);
      boat.position.copy(_next);
    }
    if(!boardingLocked)orientBoat();
    // 有前进/后退推力时双侧船桨划水；仅转向时轻划
    const row = thrust ? 1 : turn ? 0.35 : 0;
    updateWarshipOars(boat, dt, row);
    // 部分桨手麻醉 → 航向歪扭
    if(!boardingLocked)applyBoatOarWobble(boat, dt);

    _up.copy(boat.position).normalize();
    if (deckPosition) player.position.copy(boat.localToWorld(deckPosition.clone()));
    else {
      player.position.copy(boat.position).addScaledVector(_up, BOAT_EYE_HEIGHT);
      player.position.setLength(surfaceRadius + BOAT_EYE_HEIGHT);
    }
    player.velocity.set(0, 0, 0);
    player.riding = true;
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);
    setHint(boardingLocked?"跳板尚未收起，船舶保持停靠":"[<kbd>WASD</kbd>] 驾驶 · [<kbd>F</kbd>] 下船");
    return true;
  }

  return {
    update,
    forceExit: () => {
      if(crossing){const c=crossing;c.gate.leave('player');crossing=null;finishDismount(c.target,c.points[0]);}
      else if (riding) dismount();
    },
    isRiding: () => riding || !!crossing,
  };
}
