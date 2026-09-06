# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

start = s.index("// ---------------------------------------------------------------- ⑨")
end = s.index("// ---------------------------------------------------------------- ⑩")
new = '''// ---------------------------------------------------------------- ⑨
{
  // 主人 2026-09-05 的规矩，修订版。第一版我照字面理解成「不在任务中就隐身」，
  // 结果 aircraft 飞去湖沼、运输艇原地消失，主人当场指出：
  //   「重甲兵不下降作战了，但是泡机和登陆艇没去伴飞啊，aircraft 都到湖沼了」
  //
  // 正确的读法是：**「不要出现」要由「跟着走」实现，不是凭空消失。**
  // 运输艇是这支海陆空舰队的「海」那一路，它该贴着海面跟在机队地面投影后面
  // 巡航，而不是留在上一个战场、也不是原地隐身。真正不许发生的是
  // 「aircraft 走了、成员还杵在旧站点」。
  //
  //   · 有机队可跟 → 运输艇**可见**且跟着机队走
  //   · 没有机队   → 才收进后台（场景没加载 / 桩环境）
  //   · 重甲兵     → 不在任务中一律不可见（他们坐在艇腹里）
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);

  a.update(0.25, 0);
  assert.ok(!w.squad.visible, "不在任务中，重甲兵坐在艇腹里，不该出现在画面上");
  assert.ok(w.haulers.every((c) => c.visible), "有机队可跟时运输艇要在场随队巡航");

  // 跟得上：把机队挪到另一个方向，运输艇必须朝新的地面投影收敛
  const far = new THREE.Vector3(-0.5, 0.6, 0.62).normalize();
  w.fleet.userData.members.forEach((m) => m.position.copy(far).multiplyScalar(R + 60));
  w.fleet.updateMatrixWorld(true);
  const groundTrack = far.clone().multiplyScalar(R);
  const before = Math.min(...w.haulers.map((c) => c.position.distanceTo(groundTrack)));
  for (let i = 0; i < 120; i++) a.update(0.25, i * 0.25);
  const after = Math.min(...w.haulers.map((c) => c.position.distanceTo(groundTrack)));
  assert.ok(after < before - 1,
    `运输艇必须跟着机队走：离机队地面投影 ${before.toFixed(1)} → ${after.toFixed(1)}，没靠近`);
  assert.ok(!w.squad.visible, "巡航期重甲兵仍在艇腹里");

  // 没有机队可跟才收进后台
  w.fleet.removeFromParent();
  a.update(0.25, 9000);
  assert.ok(w.haulers.every((c) => !c.visible), "机队都不在了，运输艇不该单独留在场上");
  console.log(`  ✓ ⑨ 运输艇随机队贴海巡航（跟位 ${before.toFixed(0)} → ${after.toFixed(0)}），无机队才收场`);
}

'''
s = s[:start] + new + s[end:]
io.open(P, "w", encoding="utf-8").write(s)
print("⑨ 已改写为「跟着走」")
