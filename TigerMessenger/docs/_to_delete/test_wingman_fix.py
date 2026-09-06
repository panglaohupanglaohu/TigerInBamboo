# -*- coding: utf-8 -*-
"""修 test_fleet_own_style ① 的 poseHost：长机姿态要**相对当地球面坐标系**摆。

第一版直接 `m.quaternion.copy(yaw*roll*pitch)`，那是相对世界坐标系的姿态——
在球面世界里，世界 +Y 跟当地的天完全是两回事，于是「压 30° 坡度」被算成了
「机背偏离天顶 60 多度」，僚机判定长机在剧烈机动，一直待在掩护轮里。
测出来 cover=1.000、离长机 27 米，就是这么来的。

正确做法：先用当地的 up / fwd / side 搭出基底（与 gatePodCraft 里
makeBasis(side.negate(), up, fwd) 同约定），再绕机体自身的轴加 roll / pitch。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_own_style.mjs")
s = io.open(P, encoding="utf-8").read()

old = """  /** 给长机摆一个姿态：绕当地天转 yaw、绕机头轴压 roll、绕横轴带 pitch */
  const poseHost = (m, tt, roll, pitch, rBase, rWob) => {
    const up = m.position.clone().normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(up, tt * 0.25);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
    m.quaternion.copy(q);
    m.position.copy(up).multiplyScalar(rBase + rWob);
  };"""

new = """  /**
   * 给长机摆一个姿态：航向绕**当地的天**转，然后绕机体自身的轴加坡度/俯仰。
   *
   * ⚠️ 必须相对当地球面坐标系摆，不能直接写世界坐标系的四元数。
   * 球面世界里世界 +Y 跟当地的天是两回事：直接写世界四元数的话，
   * 「压 30° 坡度」会被算成「机背偏离天顶 60 多度」，僚机就一直以为
   * 长机在剧烈机动，永远待在掩护轮里（第一版就是这么写错的）。
   * 基底约定与 gatePodCraft 一致：makeBasis(side.negate(), up, fwd)。
   */
  const poseHost = (m, tt, roll, pitch, rBase, rWob) => {
    const up = m.position.clone().normalize();
    const fwd = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(up)) > 0.95) fwd.set(1, 0, 0);
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    fwd.applyAxisAngle(up, tt * 0.25); // 航向：绕当地的天缓缓盘旋
    const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
    m.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side.clone().negate(), up, fwd));
    m.rotateX(pitch);
    m.rotateZ(roll);
    m.position.copy(up).multiplyScalar(rBase + rWob);
  };"""

assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_own_style.mjs（poseHost 改为球面坐标系）")
