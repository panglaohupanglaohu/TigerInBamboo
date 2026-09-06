# -*- coding: utf-8 -*-
"""test_fleet_own_style ①：泡机从「武装直升机（独立平台）」改回**僚机**。

主人 2026-09-06：「泡机是僚机，不是挂件，业界有僚机的做法，你来参考。
主舰拉扯，僚机需要保持飞行姿态来进行保护」。

所以这一块要同时钉住两头，缺一头都是错：
  ①a 长机平稳转弯 → 僚机在密集队形里**跟着一起压坡度**（不然像三架无人机）；
  ①b 长机被鲸拽得天翻地覆 → 僚机拉开到掩护轮、**保持自己的飞行姿态**，
      但**不许飘走**（保护是要待在够得着的地方）。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_own_style.mjs")
s = io.open(P, encoding="utf-8").read()

a = s.index("// =====================================================================\n// ① 泡机 = 武装直升机")
b = s.index("// =====================================================================\n// ② 气垫艇")

block = '''// =====================================================================
// ① 泡机 = 僚机：平稳时贴翼同压坡度，长机被拽时拉开掩护、自己保持姿态
// =====================================================================
{
  const scene = new THREE.Scene();
  const centerDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  const squad = createMoebiusAircraftSquad(centerDir, R, { count: 3 });
  scene.add(squad);
  const wing = mountGatePodEscort(squad, { scale: 1 });
  assert.ok(wing && wing.children.length >= 3, "应挂上僚机");
  const members = squad.userData.members || [];
  assert.ok(members.length >= 3, "机队应有成员");

  /** 给长机摆一个姿态：绕当地天转 yaw、绕机头轴压 roll、绕横轴带 pitch */
  const poseHost = (m, tt, roll, pitch, rBase, rWob) => {
    const up = m.position.clone().normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(up, tt * 0.25);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
    m.quaternion.copy(q);
    m.position.copy(up).multiplyScalar(rBase + rWob);
  };

  const podState = (pod) => {
    const p = pod.getWorldPosition(new THREE.Vector3());
    const q = pod.getWorldQuaternion(new THREE.Quaternion());
    const up = p.clone().normalize();
    const back = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    return { p, up, back, side, tilt: Math.acos(THREE.MathUtils.clamp(back.dot(up), -1, 1)) };
  };

  // ---- ①a 密集队形：长机缓缓压 30° 坡度盘旋，僚机必须跟着压 ----
  // 这一条防的是「矫枉过正」：为了不跟着癫狂就把僚机做成各飞各的无人机，
  // 编队转弯时长机压坡、僚机机翼笔直，看起来就不是一个编队了。
  const HOST_ROLL = 0.52; // ≈30°
  for (let i = 0; i < 900; i++) {
    const tt = i * 0.05;
    for (const m of members) poseHost(m, tt, HOST_ROLL, 0.06, R + 40, 0);
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
  }
  let paradeTilt = 0;
  let paradeGap = 0;
  for (const pod of wing.children) {
    const s0 = podState(pod);
    paradeTilt = Math.max(paradeTilt, s0.tilt);
    const host = members[pod.userData.escortSlot.member % members.length];
    paradeGap = Math.max(paradeGap, s0.p.distanceTo(host.getWorldPosition(new THREE.Vector3())));
  }
  assert.ok(paradeTilt * DEG > 12,
    `长机压 ${(HOST_ROLL * DEG).toFixed(0)}° 坡度盘旋时，僚机必须跟着压坡度，` +
    `实测才 ${(paradeTilt * DEG).toFixed(0)}°——机翼笔直就不是一个编队了，是三架无人机`);
  assert.ok(paradeTilt * DEG < 45,
    `密集队形的坡度也要在自己的包线内，实测 ${(paradeTilt * DEG).toFixed(0)}°`);
  assert.ok(paradeGap < 26,
    `密集队形要贴得住，实测离长机 ${paradeGap.toFixed(1)} 米`);
  console.log(`  ✓ ①a 密集队形：长机压 30° 盘旋 → 僚机同压 ${(paradeTilt * DEG).toFixed(0)}° · 离长机 ${paradeGap.toFixed(1)} 米`);

  // ---- ①b 掩护轮：苔庭鲸把长机拽得天翻地覆 ----
  // 旧代码 pod.quaternion.copy(host.quaternion)，僚机会跟着原样倒扣。
  // 现在要的是：拉开、稳住、绕着它转（主人：「保持飞行姿态来进行保护」）。
  squad.userData.whaleLock = { active: true };
  let maxTilt = 0;
  let maxJump = 0;
  let maxRange = 0;
  const prev = new Map();
  for (let i = 0; i < 900; i++) {
    const tt = 100 + i * 0.05;
    for (const m of members) {
      // 横滚到倒扣、俯仰到垂直、上下窜 ±18 米——鲸的反复拉扯
      poseHost(m, tt, Math.sin(tt * 3.1) * 2.6, Math.sin(tt * 2.3) * 1.4,
        R + 40, Math.sin(tt * 4.1) * 18);
    }
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
    if (i < 120) continue; // 让队形切换与阻尼跟位先收敛
    for (const pod of wing.children) {
      const s0 = podState(pod);
      maxTilt = Math.max(maxTilt, s0.tilt);
      const host = members[pod.userData.escortSlot.member % members.length];
      maxRange = Math.max(maxRange, s0.p.distanceTo(host.getWorldPosition(new THREE.Vector3())));
      const last = prev.get(pod);
      if (last) maxJump = Math.max(maxJump, s0.p.distanceTo(last));
      prev.set(pod, s0.p);
    }
  }

  assert.ok(maxTilt * DEG < 45,
    `长机被拽翻时，僚机必须保持自己的飞行姿态，实测最大倾角 ${(maxTilt * DEG).toFixed(0)}°——` +
    "跟着倒扣就是挂件，不是僚机，也没法保护谁");
  assert.ok(maxRange < 60,
    `掩护是要待在够得着的地方，实测离长机最远 ${maxRange.toFixed(1)} 米——` +
    "拉开不等于飞走");
  assert.ok(maxRange > 12,
    `掩护轮必须真的**拉开**，实测最远才 ${maxRange.toFixed(1)} 米——` +
    "还贴在翼侧就等于没换队形");
  assert.ok(maxJump < 6,
    `跟位是阻尼的，实测单帧最大位移 ${maxJump.toFixed(2)} 米`);
  console.log(`  ✓ ①b 掩护轮：长机翻天覆地 → 僚机倾角 ≤ ${(maxTilt * DEG).toFixed(0)}° · 拉开到 ${maxRange.toFixed(0)} 米绕飞 · 单帧位移 ≤ ${maxJump.toFixed(2)} 米`);

  // ---- ①c 归队：鲸戏落幕、长机重新平飞 → 僚机回到密集队形 ----
  squad.userData.whaleLock.active = false;
  for (let i = 0; i < 900; i++) {
    const tt = 300 + i * 0.05;
    for (const m of members) poseHost(m, tt, HOST_ROLL, 0.06, R + 40, 0);
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
  }
  let rejoinGap = 0;
  for (const pod of wing.children) {
    const host = members[pod.userData.escortSlot.member % members.length];
    rejoinGap = Math.max(rejoinGap,
      pod.getWorldPosition(new THREE.Vector3())
        .distanceTo(host.getWorldPosition(new THREE.Vector3())));
  }
  assert.ok(rejoinGap < 26,
    `长机重新平飞后僚机必须归队，实测仍在 ${rejoinGap.toFixed(1)} 米外——` +
    "掩护轮是临时的，不是从此各飞各的");
  console.log(`  ✓ ①c 归队：长机恢复平飞 → 僚机回到密集队形（${rejoinGap.toFixed(1)} 米）`);
}

'''

s = s[:a] + block + s[b:]
s = s.replace(
  "✅ test_fleet_own_style（各舰种维持自身战斗方式：泡机=武装直升机 · 艇=气垫船 · 都不跟主舰癫狂）",
  "✅ test_fleet_own_style（泡机=僚机：贴翼同压坡度 / 长机被拽时拉开掩护并保持姿态 · 艇=气垫船稳重如山）")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_own_style.mjs（①a/①b/①c 僚机两档队形）")
