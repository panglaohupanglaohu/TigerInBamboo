// =====================================================================
//  球面第三人称跟随相机（独立模块）
//  - lerp 斜后方；lookAt 玩家；Up 平滑追踪法线
//  - 右键/中键拖拽环视（yaw + pitch），松手后平滑回弹默认视角
//  - 平滑率/默认距离运行时每帧读 P（开发者面板实时可调）
// =====================================================================
import * as THREE from "three";
import { P } from "./params.js";

const PITCH_MIN = -0.8;
const PITCH_MAX = 1.0;
const SPRING_BACK = 3; // 回弹速率（越大回得越快）

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {object} player { position, forward }
 * @param {{ dist?: number, min?: number, max?: number }} [opts]
 */
export function createFollowCamera(camera, player, opts = {}) {
  let camDist = opts.dist ?? P.camDist;
  const CAM_DIST_MIN = opts.min ?? 5;
  const CAM_DIST_MAX = opts.max ?? 28;
  let camOrbit = 0; // 水平偏航（绕法线）
  let camPitch = 0; // 俯仰（绕切平面右向轴）
  let midDrag = false;
  let rightDrag = false;

  const _camUp = new THREE.Vector3();
  const _upSmooth = new THREE.Vector3(0, 1, 0);
  const _camBack = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camDesired = new THREE.Vector3();
  const _offset = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function clampDist(d) {
    return Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, d));
  }
  function zoomBy(d) {
    camDist = clampDist(camDist + d);
  }
  function setDist(d) {
    camDist = clampDist(d);
  }
  function orbitBy(dx) {
    camOrbit -= dx;
  }
  function orbitPitchBy(dy) {
    camPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, camPitch + dy));
  }
  function setMidDrag(on) {
    midDrag = !!on;
  }
  function setOrbitDrag(on) {
    rightDrag = !!on;
  }

  function update(dt) {
    const orbiting = midDrag || rightDrag;

    // 松手后 yaw / pitch 平滑回弹到默认斜后方视角
    if (!orbiting) {
      const k = 1 - Math.exp(-SPRING_BACK * dt);
      camOrbit -= camOrbit * k;
      camPitch -= camPitch * k;
    }

    _camUp.copy(player.position).normalize();
    _upSmooth.lerp(_camUp, 1 - Math.exp(-P.upLerp * dt));
    if (_upSmooth.lengthSq() < 1e-6) _upSmooth.copy(_camUp);
    _upSmooth.normalize();

    _camBack.copy(player.forward).multiplyScalar(-1);
    _camBack.addScaledVector(_camUp, -_camBack.dot(_camUp));
    if (_camBack.lengthSq() < 1e-6) _camBack.set(0, 0, 1);
    _camBack.normalize();
    _camRight.crossVectors(_camUp, _camBack).normalize();

    // yaw：绕法线旋转背后方向
    const cos = Math.cos(camOrbit);
    const sin = Math.sin(camOrbit);
    _camBack.set(
      _camBack.x * cos + _camRight.x * sin,
      _camBack.y * cos + _camRight.y * sin,
      _camBack.z * cos + _camRight.z * sin
    ).normalize();

    const height = 4 + camDist * 0.2;
    _camDesired
      .copy(player.position)
      .addScaledVector(_camUp, height)
      .addScaledVector(_camBack, camDist);

    // pitch：相机偏移绕切平面右向轴俯仰
    if (camPitch !== 0) {
      _offset.copy(_camDesired).sub(player.position);
      _offset.applyAxisAngle(_camRight, camPitch);
      _camDesired.copy(player.position).add(_offset);
    }

    const t = 1 - Math.exp(-(orbiting ? 12 : P.camLerp) * dt);
    camera.position.lerp(_camDesired, t);
    camera.up.copy(_upSmooth);
    _look.copy(player.position).addScaledVector(_upSmooth, 0.6);
    camera.lookAt(_look);
  }

  function snap() {
    _upSmooth.copy(player.position).normalize();
    update(1);
  }

  return {
    update,
    snap,
    zoomBy,
    setDist,
    orbitBy,
    orbitPitchBy,
    setMidDrag,
    setOrbitDrag,
    getDist: () => camDist,
    getOrbit: () => ({ yaw: camOrbit, pitch: camPitch }), // 验收用
  };
}
