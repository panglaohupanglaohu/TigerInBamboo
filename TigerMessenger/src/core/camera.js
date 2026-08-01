// =====================================================================
//  球面第三人称相机：up = 球面法线，身后跟随 + 缩放/环绕
// =====================================================================
import * as THREE from "three";
import {
  CAMERA_DIST,
  CAMERA_DIST_MIN,
  CAMERA_DIST_MAX,
  CAMERA_HEIGHT,
  CAMERA_LOOK_Y,
  CAMERA_LERP,
} from "./constants.js";
import { surfaceNormal } from "../world/sphereMath.js";

export function createCameraRig(camera, player) {
  const camTarget = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  const lookAtPoint = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _back = new THREE.Vector3();
  const _right = new THREE.Vector3();
  let camOrbit = 0; // 绕法线的环绕角
  let camDist = CAMERA_DIST;
  let midDrag = false;

  function clampDist(d) {
    return Math.min(CAMERA_DIST_MAX, Math.max(CAMERA_DIST_MIN, d));
  }
  function setDist(d) {
    camDist = clampDist(d);
  }
  function zoomBy(delta) {
    camDist = clampDist(camDist + delta);
  }
  function setMidDrag(on) {
    midDrag = !!on;
  }
  function orbitBy(dx) {
    camOrbit -= dx;
  }

  function update(dt) {
    const up = surfaceNormal(player.position, _up);

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

    const height = CAMERA_HEIGHT * (0.45 + 0.55 * (camDist / CAMERA_DIST));
    camDesired
      .copy(player.position)
      .addScaledVector(up, height)
      .addScaledVector(_back, camDist);

    const t = 1 - Math.exp(-(midDrag ? 12 : CAMERA_LERP) * dt);
    camera.position.lerp(camDesired, t);
    camera.up.copy(up);

    lookAtPoint.copy(player.position).addScaledVector(up, CAMERA_LOOK_Y);
    camTarget.lerp(lookAtPoint, t);
    camera.lookAt(camTarget);
  }

  function snapToPlayer() {
    const up = surfaceNormal(player.position, _up);
    const fwd = player.forward || new THREE.Vector3(0, 0, 1);
    _back.copy(fwd).multiplyScalar(-1).addScaledVector(up, 0);
    _back.addScaledVector(up, -_back.dot(up));
    if (_back.lengthSq() < 1e-6) _back.set(0, 0, 1);
    _back.normalize();
    camera.position
      .copy(player.position)
      .addScaledVector(up, CAMERA_HEIGHT)
      .addScaledVector(_back, camDist);
    camera.up.copy(up);
    camTarget.copy(player.position).addScaledVector(up, CAMERA_LOOK_Y);
    camera.lookAt(camTarget);
  }

  return {
    update,
    snapToPlayer,
    setDist,
    zoomBy,
    setMidDrag,
    orbitBy,
    getDist: () => camDist,
    getYaw: () => camOrbit,
  };
}
