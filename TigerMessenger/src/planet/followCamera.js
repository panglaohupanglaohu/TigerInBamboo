// =====================================================================
//  球面第三人称跟随相机（独立模块）
//  - lerp 斜后方；lookAt 玩家；Up 平滑追踪法线
// =====================================================================
import * as THREE from "three";

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {object} player { position, forward }
 * @param {{ dist?: number, min?: number, max?: number }} [opts]
 */
export function createFollowCamera(camera, player, opts = {}) {
  let camDist = opts.dist ?? 12;
  const CAM_DIST_MIN = opts.min ?? 5;
  const CAM_DIST_MAX = opts.max ?? 28;
  let camOrbit = 0;
  let midDrag = false;

  const _camUp = new THREE.Vector3();
  const _upSmooth = new THREE.Vector3(0, 1, 0);
  const _camBack = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camDesired = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function zoomBy(d) {
    camDist = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, camDist + d));
  }
  function orbitBy(dx) {
    camOrbit -= dx;
  }
  function setMidDrag(on) {
    midDrag = !!on;
  }

  function update(dt) {
    _camUp.copy(player.position).normalize();
    _upSmooth.lerp(_camUp, 1 - Math.exp(-4 * dt));
    if (_upSmooth.lengthSq() < 1e-6) _upSmooth.copy(_camUp);
    _upSmooth.normalize();

    _camBack.copy(player.forward).multiplyScalar(-1);
    _camBack.addScaledVector(_camUp, -_camBack.dot(_camUp));
    if (_camBack.lengthSq() < 1e-6) _camBack.set(0, 0, 1);
    _camBack.normalize();
    _camRight.crossVectors(_camUp, _camBack).normalize();

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

    const t = 1 - Math.exp(-(midDrag ? 12 : 6) * dt);
    camera.position.lerp(_camDesired, t);
    camera.up.copy(_upSmooth);
    _look.copy(player.position).addScaledVector(_upSmooth, 0.6);
    camera.lookAt(_look);
  }

  function snap() {
    _upSmooth.copy(player.position).normalize();
    update(1);
  }

  return { update, snap, zoomBy, orbitBy, setMidDrag, getDist: () => camDist };
}
