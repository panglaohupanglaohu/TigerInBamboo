# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()
if "// ---------------------------------------------------------------- ⑨" in s:
    print("已存在"); raise SystemExit
tail = 'console.log("✅ test_fleet_cohesion'
i = s.index(tail)
add = '''// ---------------------------------------------------------------- ⑨
{
  // 主人 2026-09-05 定的规矩：「莫比斯 aircraft + GatePodCraft + gateHaulerCraft
  // + 重甲兵是一个团队（海陆空舰队），随 aircraft 扫荡式移动。只要 aircraft
  // 移动走了，场景中就不要出现舰队相应成员。」
  //
  // 落成断言：**不在任务中 ⇒ 运输艇与重甲兵一律不可见**。
  // 泡机是例外——它挂在僚机翼下跟着 aircraft 飞，那本来就是「跟着走」。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  // 开局前
  a.update(0.25, 0);
  assert.ok(w.haulers.every((c) => !c.visible), "开局前运输艇不该在场上");
  assert.ok(!w.squad.visible, "开局前重甲兵不该在场上");

  a.begin(w.hub);
  runWhile(a, "approach");
  assert.ok(w.haulers.some((c) => c.visible), "任务期运输艇当然要出场");

  runWhile(a, "insert"); runWhile(a, "combat"); runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");
  a.update(0.25, 9000);
  assert.ok(w.haulers.every((c) => !c.visible),
    "收队后运输艇必须离场——不许在苔庭留下一排空艇");
  assert.ok(!w.squad.visible, "收队后重甲兵必须离场");

  // 兜底要顶得住：外部把它们强行点亮，下一帧也得按回去
  w.haulers.forEach((c) => { c.visible = true; });
  w.squad.visible = true;
  a.update(0.25, 9001);
  assert.ok(w.haulers.every((c) => !c.visible) && !w.squad.visible,
    "enforceOffstage 必须每帧兜底：任何一条提前结束的岔路都不能在场上留成员");
  console.log("  ✓ ⑨ aircraft 不在这一站 → 运输艇/重甲兵一律不出现");
}

// ---------------------------------------------------------------- ⑩
{
  // requestStation 是「要不要在这一站落」的唯一入口。saihojiPhalanx 原来每帧
  // 直接调 begin()，任务一到 done 就又整队空投一批——「重甲兵源源不断赶来」
  // 有一半来自这里。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w); // 没给 getTourAnchor → 没有下一站
  assert.equal(a.requestStation(w.hub), true, "首战应该落");
  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");
  assert.equal(a.sweptHome(), true);
  assert.equal(a.requestStation(w.hub), false,
    "首站已扫荡且无下一站 → 不许原地再落一批");
  assert.equal(a.phase(), "done", "被拒之后不该改变阶段");
  console.log("  ✓ ⑩ 扫荡过的站不再重复空投（requestStation 是唯一入口）");
}

'''
s = s[:i] + add + s[i:]
io.open(P, "w", encoding="utf-8").write(s)
print("已追加 ⑨⑩")
