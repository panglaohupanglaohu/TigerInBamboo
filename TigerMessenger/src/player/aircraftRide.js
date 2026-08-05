// 水晶城巡逻飞行器 · 第一人称驾驶舱视角接管
// 按 V 进入/退出：相机贴到编队领头机的驾驶舱锚点，朝机头方向看出去。
// 与飞艇搭乘互斥：进入飞船驾驶时自动退出飞艇骑乘。

import * as THREE from "three";

export function createAircraftRide({ camera, cameraRig, getSquad, exitAirshipRide }) {
  let riding = false;

  function toggle() {
    const squad = getSquad && getSquad();
    if (!squad || squad.children.length === 0) return false;
    if (riding) {
      riding = false;
      camera.fov = 55;
      camera.updateProjectionMatrix();
      return false;
    }
    // 互斥：进入飞船驾驶前，确保飞艇骑乘已退出
    if (exitAirshipRide) exitAirshipRide();
    riding = true;
    camera.fov = 70; // 驾驶舱稍窄视野，更有座舱感
    camera.updateProjectionMatrix();
    return true;
  }

  const _anchorW = new THREE.Vector3();
  const _fwdW = new THREE.Vector3();
  const _upW = new THREE.Vector3();
  const _m = new THREE.Matrix4();

  function update() {
    if (!riding) return false;
    const squad = getSquad && getSquad();
    if (!squad || squad.children.length === 0) {
      riding = false;
      return false;
    }
    const lead = squad.children[0]; // 领头机
    const anchor = lead.userData.cockpitAnchor;
    if (!anchor) return false;

    // 确保世界矩阵已刷新（主循环渲染前此帧可能尚未更新）
    lead.updateWorldMatrix(true, false);

    // 驾驶舱眼位（世界坐标）
    anchor.getWorldPosition(_anchorW);

    // 飞船局部坐标系在世界中的旋转
    _m.extractRotation(lead.matrixWorld);
    _fwdW.set(1, 0, 0).applyMatrix4(_m).normalize(); // 机头 = 局部 +X
    _upW.set(0, 1, 0).applyMatrix4(_m).normalize(); // 上 = 局部 +Y

    // 相机贴到眼位
    camera.position.copy(_anchorW);
    camera.up.copy(_upW);
    camera.lookAt(_anchorW.clone().add(_fwdW));

    return true; // 占用相机，跳过玩家控制
  }

  return { toggle, update, isRiding: () => riding };
}
