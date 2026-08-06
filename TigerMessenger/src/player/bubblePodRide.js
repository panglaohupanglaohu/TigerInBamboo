// =====================================================================
//  气泡艇搭乘 · 十字准星瞄准 · [G] 发射气泡弹 · 海水湖潜行
//  - 靠近气泡艇 [F] 登艇 / 下艇
//  - WASD 驾驶 · Space 上浮 · Shift/C 潜行（水晶城海水湖内可下潜）
//  - 鼠标 / 游戏手柄右摇杆 / 触控环视 → 十字光标瞄准
//  - [G] 或手柄 RT → 发射气泡弹
// =====================================================================
import * as THREE from "three";
import {
  createBubbleShot,
  updateBubbleShot,
  findNearestBubblePod,
} from "../assets/bubblePod.js";
import { quatYToDir } from "../world/sphereMath.js";

const BOARD_RANGE = 5.2;
const FIRE_COOLDOWN = 0.42;
const AIM_MOUSE_SENS = 0.00165;
const AIM_STICK_SPEED = 1.85;
const AIM_LIMIT = 0.82;
const DEADZONE = 0.14;

const FLY_SPEED = 11;
const FLY_SPEED_DIVE = 7.5;
const VERT_SPEED = 6.5;
const TURN_SPEED = 1.65;
/** 空中最低离地高度（非湖内） */
const AIR_MIN_HOVER = 2.2;
/** 空中最高高度 */
const AIR_MAX_HOVER = 55;

const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _q0 = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();

/**
 * @param {object} deps
 * @param {THREE.PerspectiveCamera} deps.camera
 * @param {object} deps.cameraRig
 * @param {object} deps.player
 * @param {THREE.Object3D} [deps.playerGroup]
 * @param {() => THREE.Object3D|null} deps.getFleet
 * @param {() => object|null} [deps.getSeaLake] 水晶城海水湖（含 containsWorldPos / maxDive）
 * @param {THREE.Scene} deps.scene
 * @param {number} deps.planetRadius
 * @param {Record<string, boolean>} [deps.keys]
 * @param {HTMLElement|null} [deps.elHint]
 * @param {HTMLElement|null} [deps.elCrosshair]
 * @param {HTMLElement|null} [deps.elDiveTint] 潜行青蓝滤镜
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 * @param {() => void} [deps.exitOtherRides]
 */
export function createBubblePodRide({
  camera,
  cameraRig,
  player,
  playerGroup = null,
  getFleet,
  getSeaLake = () => null,
  scene,
  planetRadius,
  keys = null,
  elHint = null,
  elCrosshair = null,
  elDiveTint = null,
  toast = () => {},
  exitOtherRides = () => {},
}) {
  let riding = false;
  let pod = null;
  let fireCd = 0;
  let prevCamDist = 0;
  let yaw = 0;
  let hover = 8; // 相对当地地表的高度（或潜深时为 surfaceR 之下）
  let submerged = false;
  let wasSubmerged = false;
  const aim = { x: 0, y: 0 };
  const shots = [];
  let pointerLocked = false;

  window.addEventListener("mousemove", (e) => {
    if (!riding) return;
    if (pointerLocked) {
      aim.x = THREE.MathUtils.clamp(aim.x + e.movementX * AIM_MOUSE_SENS, -AIM_LIMIT, AIM_LIMIT);
      aim.y = THREE.MathUtils.clamp(aim.y - e.movementY * AIM_MOUSE_SENS, -AIM_LIMIT, AIM_LIMIT);
    } else {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      aim.x = THREE.MathUtils.clamp(((e.clientX - cx) / cx) * 0.9, -AIM_LIMIT, AIM_LIMIT);
      aim.y = THREE.MathUtils.clamp((-(e.clientY - cy) / cy) * 0.9, -AIM_LIMIT, AIM_LIMIT);
    }
    syncCrosshairDom();
  });

  window.addEventListener("mousedown", (e) => {
    if (!riding || e.button !== 0) return;
    const canvas = document.querySelector("canvas");
    if (canvas && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement != null;
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyG") return;
    if (!riding) return;
    e.preventDefault();
    tryFire();
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyF") return;
    if (riding) {
      e.preventDefault();
      dismount();
      return;
    }
    const fleet = getFleet?.();
    const near = findNearestBubblePod(fleet, player.position, BOARD_RANGE);
    if (!near) return;
    e.preventDefault();
    mount(near);
  });

  function setHint(html) {
    if (!elHint) return;
    if (html) {
      elHint.innerHTML = html;
      elHint.classList.add("show");
    } else {
      elHint.classList.remove("show");
    }
  }

  function syncCrosshairDom() {
    if (!elCrosshair) return;
    if (!riding) {
      elCrosshair.classList.remove("show");
      return;
    }
    elCrosshair.classList.add("show");
    const px = (aim.x * 0.5 + 0.5) * 100;
    const py = (-aim.y * 0.5 + 0.5) * 100;
    elCrosshair.style.left = `${px}%`;
    elCrosshair.style.top = `${py}%`;
  }

  function showCrosshair(on) {
    if (!elCrosshair) return;
    elCrosshair.classList.toggle("show", !!on);
    if (on) syncCrosshairDom();
  }

  function setDiveTint(amount) {
    if (!elDiveTint) return;
    const a = THREE.MathUtils.clamp(amount, 0, 1);
    elDiveTint.style.opacity = String(a * 0.72);
    elDiveTint.classList.toggle("show", a > 0.02);
  }

  function captureYaw(fromPod) {
    _up.copy(fromPod.position).normalize();
    _m.extractRotation(fromPod.matrixWorld);
    _fwd.set(0, 0, 1).applyMatrix4(_m);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    // 相对「正东切向」的近似偏航
    _right.crossVectors(_up, new THREE.Vector3(0, 1, 0));
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
    _right.normalize();
    const north = new THREE.Vector3().crossVectors(_right, _up).normalize();
    return Math.atan2(_fwd.dot(_right), _fwd.dot(north));
  }

  function mount(target) {
    exitOtherRides();
    pod = target;
    riding = true;
    player.riding = true;
    player.velocity.set(0, 0, 0);
    pod.userData.piloted = true;
    pod.userData._pilotBase = null; // 自由驾驶，不再锁巡游点
    aim.x = 0;
    aim.y = 0;
    yaw = captureYaw(pod);
    hover = Math.max(AIR_MIN_HOVER, pod.position.length() - planetRadius);
    submerged = false;
    wasSubmerged = false;
    prevCamDist = cameraRig?.getDist ? cameraRig.getDist() : 0;
    if (cameraRig?.setDist) cameraRig.setDist(2.2);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    if (playerGroup) playerGroup.visible = false;
    showCrosshair(true);
    setHint(hintHtml(false));
    toast("登上气泡艇 · WASD 驾驶 · 海水湖 [Shift] 潜行 · [G] 气泡弹", 3.6);
  }

  function hintHtml(isDive) {
    if (isDive) {
      return (
        "[<kbd>Space</kbd>] 上浮 · [<kbd>WASD</kbd>] 潜航 · [<kbd>G</kbd>] 气泡弹 · [<kbd>F</kbd>] 下艇"
      );
    }
    return (
      "[<kbd>WASD</kbd>] 驾驶 · [<kbd>Space</kbd>/<kbd>Shift</kbd>] 升/潜 · " +
      "[<kbd>G</kbd>] 气泡弹 · 准星瞄准 · [<kbd>F</kbd>] 下艇"
    );
  }

  function dismount() {
    if (pod) {
      pod.userData.piloted = false;
      pod.userData._pilotBase = null;
      // 潜行中下艇：抬到水面附近再落地
      const sea = getSeaLake?.();
      let exitPos = pod.position.clone();
      if (sea?.containsWorldPos?.(exitPos) && exitPos.length() < sea.surfaceR - 0.5) {
        exitPos.normalize().multiplyScalar(sea.surfaceR + 1.2);
      }
      const up = exitPos.clone().normalize();
      player.position.copy(exitPos).addScaledVector(up, -0.6);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(pod.quaternion);
      side.addScaledVector(up, -side.dot(up));
      if (side.lengthSq() > 1e-6) {
        side.normalize();
        player.position.addScaledVector(side, 1.5);
      }
      // 放回巡游高度附近（空闲艇恢复花厅巡游）
      if (pod.userData.orbit) {
        // 不强制瞬移，下一帧 updateBubblePodPatrol 会拉回轨道
      }
    }
    pod = null;
    riding = false;
    player.riding = false;
    player.velocity.set(0, 0, 0);
    submerged = false;
    setDiveTint(0);
    if (playerGroup) playerGroup.visible = true;
    if (cameraRig?.setDist && prevCamDist) cameraRig.setDist(prevCamDist);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    showCrosshair(false);
    setHint(null);
    if (document.pointerLockElement) document.exitPointerLock?.();
    toast("已离开气泡艇", 1.8);
  }

  function forceExit() {
    if (riding) dismount();
  }

  function pollGamepad(dt) {
    if (!riding) return;
    const pads = navigator.getGamepads?.() || [];
    let pad = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) return;

    let rx = pad.axes[2] ?? 0;
    let ry = pad.axes[3] ?? pad.axes[5] ?? 0;
    if (Math.hypot(rx, ry) < DEADZONE) {
      rx = 0;
      ry = 0;
    } else {
      const len = Math.hypot(rx, ry);
      const scale = (len - DEADZONE) / (1 - DEADZONE);
      rx = (rx / len) * scale;
      ry = (ry / len) * scale;
    }
    aim.x = THREE.MathUtils.clamp(aim.x + rx * AIM_STICK_SPEED * dt, -AIM_LIMIT, AIM_LIMIT);
    aim.y = THREE.MathUtils.clamp(aim.y - ry * AIM_STICK_SPEED * dt, -AIM_LIMIT, AIM_LIMIT);
    syncCrosshairDom();

    const fireBtn =
      pad.buttons[7]?.pressed ||
      pad.buttons[5]?.pressed ||
      (pad.buttons[7]?.value ?? 0) > 0.55;
    if (fireBtn) tryFire();

    // 左摇杆辅助转向/推进（可选）
    // 已用 keys WASD；手柄左摇杆映射到虚拟键在此不写，保持键盘为主
  }

  function aimByDelta(dx, dy) {
    if (!riding) return;
    aim.x = THREE.MathUtils.clamp(aim.x + dx * 0.9, -AIM_LIMIT, AIM_LIMIT);
    aim.y = THREE.MathUtils.clamp(aim.y - dy * 0.9, -AIM_LIMIT, AIM_LIMIT);
    syncCrosshairDom();
  }

  function tryFire() {
    if (!riding || !pod || fireCd > 0) return false;
    fireCd = FIRE_COOLDOWN;

    _ndc.set(aim.x, aim.y);
    _ray.setFromCamera(_ndc, camera);
    _dir.copy(_ray.ray.direction).normalize();

    const muzzle = pod.userData.muzzle;
    if (muzzle) {
      pod.updateWorldMatrix(true, false);
      muzzle.getWorldPosition(_muzzle);
    } else {
      _muzzle.copy(camera.position).addScaledVector(_dir, 1.2);
    }
    _muzzle.addScaledVector(_dir, 0.85);

    let color = pod.userData.accentColor || 0x8effd8;
    pod.traverse((c) => {
      if (c.name === "cockpit-panel" && c.material?.color) {
        color = c.material.color.getHex();
      }
    });

    shots.push(createBubbleShot(scene, _muzzle, _dir, color));
    return true;
  }

  /**
   * 驾驶 + 潜行 + 相机
   * @returns {boolean}
   */
  function update(dt) {
    if (fireCd > 0) fireCd = Math.max(0, fireCd - dt);
    for (let i = shots.length - 1; i >= 0; i--) {
      if (!updateBubbleShot(shots[i], dt, planetRadius)) shots.splice(i, 1);
    }

    if (!riding) {
      if (elHint) {
        const fleet = getFleet?.();
        const near =
          !player.riding && findNearestBubblePod(fleet, player.position, BOARD_RANGE);
        setHint(
          near
            ? "[<kbd>F</kbd>] 登上气泡艇 · 海水湖可潜行 · [<kbd>G</kbd>] 气泡弹"
            : null
        );
      }
      setDiveTint(0);
      return false;
    }

    if (!pod || !pod.parent) {
      forceExit();
      return false;
    }

    pollGamepad(dt);

    const sea = getSeaLake?.() || null;
    const overSea = !!(sea && sea.containsWorldPos(pod.position));

    // ---------- 驾驶输入 ----------
    const k = keys || {};
    const turn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    yaw += turn * TURN_SPEED * dt;
    const thrust = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let riseIn = k.Space ? 1 : 0;
    let diveIn = k.ShiftLeft || k.ShiftRight || k.KeyC ? 1 : 0;
    // 手柄：LT/LB 潜行，左摇杆 Y 也可升降
    const pads = navigator.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad) continue;
      if (pad.buttons[4]?.pressed) diveIn = 1;
      if (pad.buttons[6]?.pressed || (pad.buttons[6]?.value ?? 0) > 0.4) diveIn = 1;
      const ly = pad.axes[1] ?? 0;
      if (ly < -0.45) riseIn = 1;
      if (ly > 0.45) diveIn = 1;
    }

    // ---------- 高度 / 潜深 ----------
    // hover = 相对球心的海拔偏移（position.length - planetRadius）
    // 在海水湖内：可降到 surfaceLift - maxDive
    const surfaceLift = sea ? sea.waterLift : 0.14;
    const minHover = overSea ? surfaceLift - (sea?.maxDive ?? 10) : AIR_MIN_HOVER;
    const maxHover = AIR_MAX_HOVER;

    hover += (riseIn - diveIn) * VERT_SPEED * dt;
    hover = THREE.MathUtils.clamp(hover, minHover, maxHover);

    // 若试图在非海水区下潜到地表以下 → 钳到 AIR_MIN
    if (!overSea && hover < AIR_MIN_HOVER) hover = AIR_MIN_HOVER;

    submerged = overSea && hover < surfaceLift - 0.35;
    if (submerged && !wasSubmerged) {
      toast("气泡艇潜行 · 海水培育区", 2.2);
    }
    if (!submerged && wasSubmerged && overSea) {
      toast("浮出水面", 1.4);
    }
    wasSubmerged = submerged;

    // 潜行滤镜强度
    if (submerged && sea) {
      const depth = Math.max(0, surfaceLift - hover);
      setDiveTint(0.25 + (depth / Math.max(sea.maxDive, 1)) * 0.75);
    } else {
      setDiveTint(0);
    }

    // ---------- 球面运动 ----------
    _up.copy(pod.position).normalize();
    quatYToDir(_up, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    pod.quaternion.copy(_q0).multiply(_qYaw);

    _fwd.set(0, 0, 1).applyQuaternion(pod.quaternion);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
    else _fwd.set(0, 0, 1);

    const speed = submerged ? FLY_SPEED_DIVE : FLY_SPEED;
    _pos.copy(_up).multiplyScalar(planetRadius + hover);
    if (thrust !== 0) {
      _pos.addScaledVector(_fwd, thrust * speed * dt);
      _pos.normalize().multiplyScalar(planetRadius + hover);
    }
    pod.position.copy(_pos);
    _up.copy(pod.position).normalize();
    quatYToDir(_up, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    pod.quaternion.copy(_q0).multiply(_qYaw);

    // 潜行时轻微俯仰
    if (submerged) {
      pod.rotateX(0.12 + Math.sin(performance.now() * 0.002) * 0.03);
    }

    // ---------- 相机 ----------
    const anchor = pod.userData.cockpitAnchor;
    pod.updateWorldMatrix(true, false);
    if (anchor) anchor.getWorldPosition(camera.position);
    else camera.position.copy(pod.position);

    camera.up.copy(_up);
    _m.extractRotation(pod.matrixWorld);
    _fwd.set(0, 0, 1).applyMatrix4(_m).normalize();
    camera.lookAt(camera.position.clone().add(_fwd));
    camera.updateMatrixWorld(true);

    _ndc.set(aim.x, aim.y);
    _ray.setFromCamera(_ndc, camera);
    camera.lookAt(
      camera.position.clone().addScaledVector(_ray.ray.direction, 12)
    );

    // FOV：潜行略宽、略暗感
    const targetFov = submerged ? 74 : 68;
    if (Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 4));
      camera.updateProjectionMatrix();
    }

    player.position.copy(pod.position);
    player.velocity.set(0, 0, 0);

    setHint(hintHtml(submerged));
    syncCrosshairDom();
    return true;
  }

  return {
    update,
    forceExit,
    isRiding: () => riding,
    isSubmerged: () => submerged,
    aimByDelta,
    tryFire,
  };
}
