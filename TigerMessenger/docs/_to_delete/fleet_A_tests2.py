# -*- coding: utf-8 -*-
"""test_vanguard_assault 跟进 27 人编成。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_vanguard_assault.mjs")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""//   ① 编成：总员 22 = 20 战斗（2 组 × 10 三三制）+ 2 看护留守飞行器旁
//      乘坐：GatePodCraft 3 台各索降 2（6）+ gateHaulerCraft 3 台各卸 6 实载 6/6/4（16）""",
"""//   ① 编成（主人 2026-09-06 舰队编成）：总员 27 = 24 战斗 + 3 看护
//      GatePodCraft 3 台各载 2 名索降（6，前后型突击对，全员参战）
//      gateHaulerCraft 3 艘各载 7 名（21），每艘留守 1 名 → 参战 18 = 6 个三人小组""",
"抬头 ①")

rep("""//   ⑤ 撤离：三艇回滩头放坡，全部存活兵**从后舱门走回腹内**（aboard = 22），贴海离场，泡机归队""",
"""//   ⑤ 撤离：三艇回滩头放坡，艇兵**从后舱门走回腹内**，索降兵由本泡机绳索收回，贴海离场""",
"抬头 ⑤")

rep("""  assert.equal(VANGUARD_SQUAD_SIZE, 22, "总员 22 = 20 战斗 + 2 看护");
  assert.equal(groups.length, 2, "2 组");
  for (const g of groups) {
    assert.equal(g.all.length, 10, "每组 10 人");
    assert.equal(g.leader?.userData?.role, "leader", "每组 1 名组长");
    assert.equal(g.teams.length, 3, "每组 3 个子小组");
    for (const team of g.teams) assert.equal(team.length, 3, "子小组 3 人（三三制）");
  }
  console.log("  ① 编成：22 = 2 组 × 10（三三制）+ 2 看护 ✓");""",
"""  assert.equal(VANGUARD_SQUAD_SIZE, 27, "总员 27 = 24 战斗 + 3 看护");
  assert.equal(groups.length, 3, "一艇一组，共 3 组");
  for (const g of groups) {
    assert.equal(g.all.length, 6, "每艇 6 名参战（第 7 名留守）");
    assert.equal(g.leader?.userData?.role, "leader", "每组 1 名组长");
    assert.equal(g.teams.length, 2, "每艇 2 个三人小组");
    for (const team of g.teams) assert.equal(team.length, 3, "三三制：每小组 3 人");
  }
  assert.equal(sq.userData.troopers.filter((t) => t.userData.vehicleGuard).length, 3,
    "每艘登陆艇留守 1 名");
  console.log("  ① 编成：27 = 泡机 3×2 前后型 + 登陆艇 3×(6 参战 + 1 留守) ✓");""",
"编成断言")

rep("""  // insert：索降 6 + 艇卸 16 → 全员落地（含 2 看护到位）""",
"""  // insert：索降 6 + 艇卸 21 → 全员落地（含 3 名看护各就各位）""",
"insert 注释")

rep("""  assert.equal(st.onGround, 22, `全员 onGround（含 2 看护），实得 ${st.onGround}`);""",
"""  assert.equal(st.onGround, 27, `全员 onGround（含 3 看护），实得 ${st.onGround}`);""",
"onGround 22")

rep("""  console.log(`  ②③ approach→insert→combat：6 索降 + 16 艇卸（6/6/4）全员逐人贴地（r=${GROUND}）✓`);""",
"""  console.log(`  ②③ approach→insert→combat：6 索降 + 21 艇卸（7/7/7）全员逐人贴地（r=${GROUND}）✓`);""",
"文案")

rep("""  assert.equal(assault.stats().aboard, 22, "22 名全部从后舱门回艇腹（含 2 看护）");""",
"""  assert.equal(assault.stats().aboard, 27, "27 名全部收回载具（艇兵走后舱门，索降兵走绳索）");""",
"aboard")

rep("""  console.log("  ⑤⑥ withdraw→extract→done：22 人后舱门回艇腹、贴海离场、泡机归队 ✓");""",
"""  console.log("  ⑤⑥ withdraw→extract→done：27 人全部收回、贴海离场、泡机归队 ✓");""",
"文案 ⑤⑥")

rep("""  assert.equal(assault.stats().onGround, 22, `实得 ${frames * 0.25}s 时 onGround=${assault.stats().onGround}`);""",
"""  assert.equal(assault.stats().onGround, 27, `实得 ${frames * 0.25}s 时 onGround=${assault.stats().onGround}`);""",
"onGround 兜底")

rep("""console.log(`✅ test_vanguard_assault（22 = 20三三制 + 2看护 · 3泡机索降6 + 3艇卸16 · approach→insert→combat→withdraw→extract · 逐人贴地 · 后舱门回艇腹）`);""",
"""console.log(`✅ test_vanguard_assault（27 = 泡机6前后型 + 艇21（每艇留守1）· approach→insert→combat→withdraw→extract · 逐人贴地）`);""",
"结尾")

io.open(P, "w", encoding="utf-8").write(s)
print("patched test_vanguard_assault.mjs")
