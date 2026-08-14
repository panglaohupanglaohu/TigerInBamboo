// =====================================================================
//  球面第三人称相机：up = 球面法线，身后跟随 + 缩放/环绕
// =====================================================================
import * as THREE from "three";
import {
  CAMERA_DIST_MIN,
  CAMERA_DIST_MAX,
  CAMERA_HEIGHT,
  CAMERA_LOOK_Y,
} from "./constants.js";
import { P } from "./params.js";
import { surfaceNormal } from "../world/sphereMath.js";

const PITCH_MIN = -0.8;
const PITCH_MAX = 1.0;
const SPRING_BACK = 3; // 松手后环绕/俯仰回弹速率

export function createCameraRig(camera, player) {
  const camTarget = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  const lookAtPoint = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _upSmooth = new THREE.Vector3(); // 平滑翻转的相机 Up（snapToPlayer 时初始化）
  const _back = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _offset = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  let camOrbit = 0; // 绕法线的环绕角（yaw）
  let camPitch = 0; // 俯仰角（pitch）
  let camDist = P.camDist;
  /** 第一人称：贴眼向前看（飞艇驾驶员等），不走身后高位俯视 */
  let firstPerson = false;
  const defaultFov = camera.fov;
  let midDrag = false;
  let rightDrag = false;

  function clampDist(d) {
    return Math.min(CAMERA_DIST_MAX, Math.max(CAMERA_DIST_MIN, d));
  }
  /**
   * @param {number} d
   * @param {{ force?: boolean }} [opts] force=true 时允许低于 CAMERA_DIST_MIN（驾驶员第一人称）
   */
  function setDist(d, opts = {}) {
    if (opts?.force) {
      camDist = Math.max(0.05, Math.min(CAMERA_DIST_MAX, Number(d) || 0.05));
    } else {
      camDist = clampDist(d);
    }
  }
  /**
   * 第一人称模式：相机在眼位，沿 player.forward 看向远方（不看地面）。
   * @param {boolean} on
   */
  function setFirstPerson(on) {
    firstPerson = !!on;
    if (firstPerson) {
      camOrbit = 0;
      camPitch = 0;
      camDist = 0.08;
    }
  }
  function zoomBy(delta) {
    if (firstPerson) return; // 第一人称不滚轮拉距
    camDist = clampDist(camDist + delta);
  }
  function setFov(fov) {
    camera.fov = THREE.MathUtils.clamp(fov, 35, 90);
    camera.updateProjectionMatrix();
  }
  function setMidDrag(on) {
    midDrag = !!on;
  }
  function setRightDrag(on) {
    rightDrag = !!on;
  }
  function orbitBy(dx) {
    camOrbit -= dx;
  }
  function orbitPitchBy(dy) {
    camPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, camPitch + dy));
  }

  function update(dt) {
    const orbiting = midDrag || rightDrag;
    const up = surfaceNormal(player.position, _up);

    // 相机 Up 平滑追踪球面法线
    if (_upSmooth.lengthSq() < 1e-6) _upSmooth.copy(up);
    _upSmooth.lerp(up, 1 - Math.exp(-P.upLerp * dt));
    if (_upSmooth.lengthSq() < 1e-6) _upSmooth.copy(up);
    _upSmooth.normalize();

    const t = 1 - Math.exp(-(orbiting ? 12 : P.camLerp) * dt);

    // ---------- 第一人称：贴眼、沿 forward 看向远方（飞艇驾驶员） ----------
    if (firstPerson) {
      const rawFwd = player.forward || player.facing || new THREE.Vector3(0, 0, 1);
      _fwd.copy(rawFwd);
      // 压到切平面：水平向前，不朝球心/地面
      _fwd.addScaledVector(up, -_fwd.dot(up));
      if (_fwd.lengthSq() < 1e-6) {
        _fwd.set(0, 0, 1).addScaledVector(up, -up.z);
      }
      _fwd.normalize();
      // 极轻抬头，地平线略低于画面中心
      _fwd.addScaledVector(_upSmooth, 0.04).normalize();

      // 眼位 = 玩家位置（已是驾驶员眼高）
      camDesired.copy(player.position);
      camera.position.lerp(camDesired, Math.min(1, t * 1.4));
      camera.up.copy(_upSmooth);
      // 看向正前方远处
      lookAtPoint.copy(player.position).addScaledVector(_fwd, 40);
      camTarget.lerp(lookAtPoint, Math.min(1, t * 1.4));
      camera.lookAt(camTarget);
      return;
    }

    // ---------- 第三人称：身后跟随 ----------
    // 松手后 yaw / pitch 平滑回弹到默认斜后方视角
    if (!orbiting) {
      const k = 1 - Math.exp(-SPRING_BACK * dt);
      camOrbit -= camOrbit * k;
      camPitch -= camPitch * k;
    }

    // 背后：-forward 切向，再绕 up 旋转 camOrbit
    const fwd = player.forward || player.facing || new THREE.Vector3(0, 0, 1);
    _back.copy(fwd).multiplyScalar(-1);
    _back.addScaledVector(up, -_back.dot(up));
    if (_back.lengthSq() < 1e-6) _back.set(0, 0, 1).addScaledVector(up, -up.z);
    _back.normalize();
    _right.crossVectors(up, _back).normalize();

    const c = Math.cos(camOrbit);
    const s = Math.sin(camOrbit);
    const bx = _back.x * c + _right.x * s;
    const by = _back.y * c + _right.y * s;
    const bz = _back.z * c + _right.z * s;
    _back.set(bx, by, bz).normalize();

    const height = CAMERA_HEIGHT * (0.45 + 0.55 * (camDist / 7.5));
    camDesired
      .copy(player.position)
      .addScaledVector(up, height)
      .addScaledVector(_back, camDist);

    // pitch：相机偏移绕切平面右向轴俯仰
    if (camPitch !== 0) {
      _offset.copy(camDesired).sub(player.position);
      _offset.applyAxisAngle(_right, camPitch);
      camDesired.copy(player.position).add(_offset);
    }

    camera.position.lerp(camDesired, t);
    camera.up.copy(_upSmooth);

    lookAtPoint.copy(player.position).addScaledVector(_upSmooth, CAMERA_LOOK_Y);
    camTarget.lerp(lookAtPoint, t);
    camera.lookAt(camTarget);
  }

  function snapToPlayer() {
    const up = surfaceNormal(player.position, _up);
    _upSmooth.copy(up); // 初始/复位时 Up 直接就位
    const fwd = player.forward || new THREE.Vector3(0, 0, 1);
    _back.copy(fwd).multiplyScalar(-1).addScaledVector(up, 0);
    _back.addScaledVector(up, -_back.dot(up));
    if (_back.lengthSq() < 1e-6) _back.set(0, 0, 1);
    _back.normalize();
    camera.position
      .copy(player.position)
      .addScaledVector(up, CAMERA_HEIGHT)
      .addScaledVector(_back, camDist);
    camera.up.copy(_upSmooth);
    camTarget.copy(player.position).addScaledVector(up, CAMERA_LOOK_Y);
    camera.lookAt(camTarget);
  }

  return {
    update,
    snapToPlayer,
    setDist,
    setFirstPerson,
    isFirstPerson: () => firstPerson,
    zoomBy,
    setMidDrag,
    setRightDrag,
    orbitBy,
    orbitPitchBy,
    setFov,
    getFov: () => camera.fov,
    getDefaultFov: () => defaultFov,
    getDist: () => camDist,
    getYaw: () => camOrbit,
    getOrbit: () => ({ yaw: camOrbit, pitch: camPitch }), // 验收用
  };
}
