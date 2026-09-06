# -*- coding: utf-8 -*-
"""⑥ 飞行姿态：standoff + 高度下限 + 机头跟速度矢量（主人 2026-09-06 截屏否决后补）。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_scout_fleet_wing.mjs")
s = io.open(P, encoding="utf-8").read()
anchor = 'console.log("✅ test_scout_fleet_wing'
assert anchor in s

block = '''// ---- ⑥ 飞行姿态：不许贴地、不许贴脸、机头要跟着速度走 ----
{
  // 主人 2026-09-06 截屏：三架侦察机贴着地面、夹在红盔堆里、机身水平。
  // 那是武装直升机扫射的姿态。业界侦察机三条常识：standoff、保持高度、
  // 机头跟速度矢量（协调转弯）。这一块把三条各钉一颗钉子。
  anchorDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  prey.position.copy(anchorDir).multiplyScalar(R + 0.4); // 目标趴在地面上
  for (let i = 0; i < 400; i++) squad.update(0.05, 3e3 + i * 0.05);

  let minAlt = Infinity;
  let minStandoff = Infinity;
  let maxPitch = 0;
  let sawBank = false;
  for (let i = 0; i < 600; i++) {
    squad.update(0.05, 4e3 + i * 0.05);
    for (const u of squad.fleetUnits()) {
      minAlt = Math.min(minAlt, u.group.position.length() - R);
      minStandoff = Math.min(minStandoff, u.group.position.distanceTo(prey.position));
      // 机体 +Z 是机头，+Y 是机背（orientAircraft 的 makeBasis 顺序）
      const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(u.group.quaternion);
      const back = new THREE.Vector3(0, 1, 0).applyQuaternion(u.group.quaternion);
      const up = u.group.position.clone().normalize();
      maxPitch = Math.max(maxPitch, Math.abs(Math.asin(THREE.MathUtils.clamp(nose.dot(up), -1, 1))));
      if (Math.abs(back.dot(up)) < 0.985) sawBank = true; // 机背偏离天顶 = 压坡度
    }
  }

  // ① 保持高度：绝不下到地面
  assert.ok(minAlt > 25,
    `侦察机全程不许掉到地面高度，实测最低 ${minAlt.toFixed(1)} 米——` +
    "贴地悬停在敌群里是截屏里那张，不是侦察机");
  // ② standoff：不进入目标近距
  assert.ok(minStandoff > 30,
    `必须保持 standoff，实测最近曾到 ${minStandoff.toFixed(1)} 米——` +
    "侦察机靠射程指示，不靠飞到目标头上");
  // ③ 姿态：转弯压坡度；俯仰有，但被限幅（不做垂直机动）
  assert.ok(sawBank, "盘旋转弯必须压坡度，机身永远水平就是在地面上滑行");
  assert.ok(maxPitch < 0.45,
    `俯仰要限幅（≈23°），实测 ${(maxPitch * 180 / Math.PI).toFixed(0)}°——侦察机不做垂直机动`);
  console.log(
    `  ✓ ⑥ 飞行姿态：最低 ${minAlt.toFixed(0)} 米 · standoff ≥ ${minStandoff.toFixed(0)} 米 · ` +
    `压坡度 · 俯仰 ≤ ${(maxPitch * 180 / Math.PI).toFixed(0)}°`);
}

'''
s = s.replace(anchor, block + anchor, 1)
s = s.replace(
  '✅ test_scout_fleet_wing（3 架编入舰队 · 环绕战场 · 曳光只指示 · 随主舰移动 · 留守 2 架）',
  '✅ test_scout_fleet_wing（3 架编入舰队 · 环绕战场 · 曳光只指示 · 随主舰移动 · 留守 2 架 · 飞行姿态）')
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_scout_fleet_wing.mjs（⑥）")
