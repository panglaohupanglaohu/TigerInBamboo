// =====================================================================
//  第三人称跟随相机（阻尼插值 + 滚轮/中键缩放与环绕）
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

export function createCameraRig(camera, player) {
  const camTarget = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  const lookAtPoint = new THREE.Vector3();
  let camYaw = 0; // 相机环绕角，跟随玩家朝向略滞后
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
    camYaw -= dx;
  }

  function update(dt) {
    // 中键拖动环绕时减弱自动追玩家朝向，避免抢方向
    const followRate = midDrag ? 0.6 : 4;
    let dy = player.yaw - camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    camYaw += dy * Math.min(1, followRate * dt);

    // 角色 yaw=0 面朝 +Z，相机落在身后（-Z 侧）；拉远时略抬高机位
    const height = CAMERA_HEIGHT * (0.55 + 0.45 * (camDist / CAMERA_DIST));
    const backX = -Math.sin(camYaw) * camDist;
    const backZ = -Math.cos(camYaw) * camDist;
    camDesired.set(
      player.position.x + backX,
      player.position.y + height,
      player.position.z + backZ
    );

    const t = 1 - Math.exp(-CAMERA_LERP * dt);
    camera.position.lerp(camDesired, t);

    lookAtPoint.set(
      player.position.x,
      player.position.y + CAMERA_LOOK_Y,
      player.position.z
    );
    camTarget.lerp(lookAtPoint, t);
    camera.lookAt(camTarget);
  }

  // 初始相机目标：直接放到玩家身后，避免开场长距离拉镜
  function snapToPlayer() {
    camTarget.copy(player.position).add(new THREE.Vector3(0, CAMERA_LOOK_Y, 0));
    camera.position.set(
      player.position.x - Math.sin(player.yaw) * camDist,
      player.position.y + CAMERA_HEIGHT,
      player.position.z - Math.cos(player.yaw) * camDist
    );
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
    getYaw: () => camYaw,
  };
}
