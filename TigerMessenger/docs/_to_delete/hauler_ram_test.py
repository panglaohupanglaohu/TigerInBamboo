# -*- coding: utf-8 -*-
"""⑭ 重写：撞击只在离场时用、有伤害、有动画。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

head = "// ---------------------------------------------------------------- ⑭\n"
i = s.index(head)
j = s.index("// ---------------------------------------------------------------- ", i + len(head))

body = '''{
  // 主人 2026-09-06：登陆艇「用体重撞飞攻击者」；
  //   「添加撞击损伤能力，但**只是离开战场时使用**」；
  //   「离开战场前将敌人撞飞，**要有动画**」。
  //
  // 三条各钉一颗钉子：作战期不许撞、离场期撞了要死人、撞的时候画面上要有东西。
  const w = makeWorld({ defenders: 1 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  const victim = w.defendersLive[0];
  const craft = w.haulers.find((c) => c.parent && c.visible) || w.haulers[0];
  const stick = () => {
    craft.updateWorldMatrix(true, false);
    const cp = craft.getWorldPosition(new THREE.Vector3());
    victim.position.copy(cp).add(new THREE.Vector3(1.2, 0, 0));
    return cp;
  };

  // ---- ① 作战期贴到艇体上也不许被撞 ----
  stick();
  for (let i = 0; i < 30; i++) { a.update(0.1, 3e3 + i * 0.1); stick(); }
  assert.notEqual(victim.userData.rammedAir, true,
    "combat 段不许撞——撞击是走人时顺手掀翻挡道的，不是一门整场都在用的武器");

  // ---- ② 离场期：撞飞 + 伤害 + 动画 ----
  // 直接推到 extract（撤离/装载的细节由 ⑪⑫ 管，这里只验撞击）
  let guard = 0;
  while (a.phase() !== "extract" && guard++ < 4000) a.update(0.25, 4e3 + guard * 0.25);
  assert.equal(a.phase(), "extract", "应能进入离场段");

  const cp = stick();
  const d0 = victim.position.distanceTo(cp);
  const r0 = victim.position.length();
  let launched = false;
  let sawRing = false;
  let sawPose = false;
  for (let i = 0; i < 120 && !launched; i++) {
    a.update(0.1, 5e3 + i * 0.1);
    if (victim.userData.rammedAir) launched = true;
    else stick();
  }
  assert.ok(launched, "离场时贴到艇体外缘的攻击者必须被撞飞");

  // 伤害：一撞即毙（口径 = saihojiPhalanx 的 KILL_MELEE = 2 点近战）
  assert.ok((victim.userData.meleeHits || 0) >= 2,
    `撞击必须记伤害，实得 ${victim.userData.meleeHits || 0} 点近战`);
  assert.equal(victim.userData.dead, true, "登陆艇是拿体重撞的，一撞即毙");

  // 动画：撞点冲击波环 + 艇体撞击姿态
  for (let i = 0; i < 40; i++) {
    a.update(0.05, 6e3 + i * 0.05);
    a.root.traverse?.((o) => { if (o.name === "vanguard-ram-ring" && o.visible) sawRing = true; });
    const body = craft.userData?.hullPivot || craft;
    if (Math.abs(body.rotation.z) > 0.02 || Math.abs(body.rotation.x) > 0.02) sawPose = true;
  }
  assert.ok(sawRing, "撞点要有冲击波环——「要有动画」不是把人弹开就完事");
  assert.ok(sawPose, "艇体要有撞击姿态（侧倾+低头）：用体重撞，艇自己得动");

  // 撞飞的轨迹：切向甩出去 + 抛物线落回地面
  for (let i = 0; i < 300 && !victim.userData.tranqGrounded; i++) a.update(0.25, 7e3 + i * 0.25);
  assert.equal(victim.userData.tranqGrounded, true, "撞飞后应落地");
  assert.ok(victim.position.distanceTo(cp) > d0 + 2,
    `应被甩离艇体：${d0.toFixed(1)} → ${victim.position.distanceTo(cp).toFixed(1)}`);
  assert.ok(Math.abs(victim.position.length() - r0) < 12,
    "撞飞是切向甩出去 + 抛物线落回地面，不是往天上或地心里塞");

  // 环用完要收干净：一场仗撞五个人不能留五个网格在场上
  let leftover = 0;
  for (let i = 0; i < 60; i++) a.update(0.1, 8e3 + i * 0.1);
  a.root.traverse?.((o) => { if (o.name === "vanguard-ram-ring") leftover++; });
  assert.equal(leftover, 0, "冲击波环用完必须移除并 dispose（性能这条线上有前科）");
  console.log("  ✓ ⑭ 撞击：作战期不撞 · 离场时一撞即毙 · 艇体姿态+冲击波环 · 用完收干净");
}

'''
s = s[:i] + head + body + s[j:]
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs（⑭ 重写）")
