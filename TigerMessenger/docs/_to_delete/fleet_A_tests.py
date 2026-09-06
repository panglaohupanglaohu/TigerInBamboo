# -*- coding: utf-8 -*-
"""A 的测试跟进：27 人编成 + 花名册映射。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

P = R + "tools/test_vanguard_trooper.mjs"
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""  VANGUARD_COMBAT, VANGUARD_SQUAD_SIZE,""",
    """  VANGUARD_COMBAT, VANGUARD_SQUAD_SIZE, VANGUARD_FORMATION, vanguardRosterSlot,""",
    "import")

rep("""// ---- ② 中队 22 人（2026-09-05 修订：20 战斗 + 2 看护留守飞行器）""",
    """// ---- ② 中队 27 人（2026-09-06 舰队编成：24 战斗 + 3 看护，每艇留守 1）""",
    "标题")

rep("""assert.equal(VANGUARD_SQUAD_SIZE, 22, "2026-09-05 修订：3泡机×2索降 + 3艇×6卸载（6/6/4），总 22 = 20 战斗 + 2 看护");
assert.equal(squad.userData.troopers.length, 22, `中队应 22 人，实得 ${squad.userData.troopers.length}`);
assert.equal(vanguardAliveCount(squad), 22);""",
    """// 主人 2026-09-06 定的舰队编成：
//   泡机 3 台 × 2 名 = 6（快速突击型，每台一前一后）
//   登陆艇 3 艘 × 7 名 = 21（每艘留守 1 名，参战 6 名 = 2 个三人小组）
// 合计 27 = 24 战斗 + 3 看护。这三个数字是编成口径，不是可以随手漂的实现细节。
assert.equal(VANGUARD_SQUAD_SIZE, 27, "3泡机×2 + 3艇×7 = 27");
assert.equal(
  VANGUARD_FORMATION.assaultPods * VANGUARD_FORMATION.perAssaultPod
  + VANGUARD_FORMATION.groups * VANGUARD_FORMATION.perHaulerSeats,
  VANGUARD_SQUAD_SIZE,
  "编成常量必须自洽：泡机席位 + 艇上席位 = 中队人数");
assert.equal(squad.userData.troopers.length, 27, `中队应 27 人，实得 ${squad.userData.troopers.length}`);
assert.equal(vanguardAliveCount(squad), 27);""",
    "人数断言")

rep("""  assert.equal(uids.size, 22, "每人一个独立 uid");""",
    """  assert.equal(uids.size, 27, "每人一个独立 uid");""",
    "uid 数")

# 新增：花名册映射 + 编组
anchor = "console.log(`✅ test_vanguard_trooper"
assert anchor in s
block = '''// ---- ②b 花名册映射：谁上哪台车、坐第几个位子、谁留守 ----
//
// 这个映射是撤离与回收的地基：「回自己乘来的那艘艇」「谁归哪台泡机的绳子」
// 都靠它。旧口径把看护定义成 `uid >= 20`，跟载具无关，两件事永远对不上号。
{
  const { assignVanguardFireteams } = await import(
    new URL("../TigerMessenger/src/world/vanguardTrooper.js", import.meta.url).href);
  const sq = createVanguardSquad();
  const { groups, assault } = assignVanguardFireteams(sq);

  // 泡机 6 名：3 台 × 2，每台一前一后
  assert.equal(assault.length, 6, "泡机突击兵应 6 名");
  for (let pod = 0; pod < 3; pod++) {
    const pair = assault.filter((t) => t.userData.pod === pod);
    assert.equal(pair.length, 2, `第 ${pod} 台泡机应载 2 名`);
    assert.equal(pair.filter((t) => t.userData.slot === 0).length, 1, "每对必须一前");
    assert.equal(pair.filter((t) => t.userData.slot === 1).length, 1, "每对必须一后");
    assert.ok(pair.every((t) => t.userData.role === "assault"), "泡机兵不进三三制方阵");
    assert.ok(pair.every((t) => !t.userData.vehicleGuard), "泡机兵全部参战，没有留守");
  }

  // 登陆艇：3 组，每组 6 名参战 = 2 个三人小组；另有 3 名看护不入组
  assert.equal(groups.length, 3, "一艇一组");
  for (const g of groups) {
    assert.equal(g.all.length, 6, `第 ${g.index} 艇应有 6 名参战兵`);
    assert.equal(g.teams.length, 2, "每艇 2 个三人小组");
    for (const team of g.teams) assert.equal(team.length, 3, "三三制：每小组 3 人");
    assert.equal(g.leader?.userData?.role, "leader", "每艇 1 名组长");
    assert.ok(g.all.includes(g.leader), "组长必须是小组的一员，不是飘在阵型外的一个点");
  }

  const guards = sq.userData.troopers.filter((t) => t.userData.vehicleGuard);
  assert.equal(guards.length, 3, "每艘登陆艇留守 1 名，共 3 名");
  assert.deepEqual(
    guards.map((t) => t.userData.group).sort(),
    [0, 1, 2],
    "三名看护必须分属三条不同的艇——留守的是自己那条艇");

  // 映射本身：座位号能反推载具
  assert.deepEqual(vanguardRosterSlot(0), { kind: "pod", vehicle: 0, seat: 0, lead: true, guard: false });
  assert.deepEqual(vanguardRosterSlot(5), { kind: "pod", vehicle: 2, seat: 1, lead: false, guard: false });
  assert.deepEqual(vanguardRosterSlot(6), { kind: "hauler", vehicle: 0, seat: 0, lead: true, guard: false });
  assert.deepEqual(vanguardRosterSlot(12), { kind: "hauler", vehicle: 0, seat: 6, lead: false, guard: true });
  assert.deepEqual(vanguardRosterSlot(26), { kind: "hauler", vehicle: 2, seat: 6, lead: false, guard: true });

  // 参战人数：24 = 6 突击 + 18 三三制
  const fighters = sq.userData.troopers.filter((t) => !t.userData.vehicleGuard);
  assert.equal(fighters.length, 24, "参战 24 名");
  console.log("  ✓ 花名册：泡机 3×2 前后型 · 登陆艇 3×(6 参战 + 1 留守) · 三三制 6 个三人小组");
}

'''
s = s.replace(anchor, block + anchor, 1)

rep("""console.log(`✅ test_vanguard_trooper（22 人 = 20 战斗 + 2 看护""",
    """console.log(`✅ test_vanguard_trooper（27 人 = 24 战斗 + 3 看护""",
    "结尾文案")

io.open(P, "w", encoding="utf-8").write(s)
print("patched test_vanguard_trooper.mjs")
