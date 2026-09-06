# -*- coding: utf-8 -*-
"""B③：test_fleet_cohesion 换成「主舰主导」契约（按标记切片替换，避开长串精确匹配）。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

MARK = "// ---------------------------------------------------------------- "

def block(tag):
    """返回 (start, end)：某个编号块从它的分隔线到下一条分隔线之间。"""
    i = s.index(MARK + tag)
    j = s.index(MARK, i + len(MARK))
    return i, j

def swap(tag, body):
    global s
    i, j = block(tag)
    s = s[:i] + MARK + tag + "\n" + body + "\n" + s[j:]

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 助手 ----------------
rep("""const lockedCount = (w) =>
  (w.fleet?.userData?.members || []).filter((m) => m.userData?.missionLock?.active === true).length;""",
"""/**
 * 被请求驻留的机队成员数。
 *
 * 断言的是 `hold` 而不是 `active`：主人 2026-09-06 定的是「主舰主导」，
 * 登陆队只能请主舰**在原地多待一会儿**，绝不能改它的航向。
 * missionLock.active + hubDir 一旦被写，moebiusAircraft 里的 missionLockActive
 * 就会成立并压住 whaleLock 与 patrol——那等于登陆队在开这架飞机。
 */
const heldCount = (w) =>
  (w.fleet?.userData?.members || []).filter((m) => m.userData?.missionLock?.hold === true).length;

/** 机队有没有被「抢方向盘」：任何一个成员被写了航向就算 */
const hijacked = (w) =>
  (w.fleet?.userData?.members || []).some(
    (m) => m.userData?.missionLock?.active === true || !!m.userData?.missionLock?.hubDir);

/** 喂帧让主舰读起来「停稳」（开局闸门要求连续驻留 STATION_SETTLE_TIME 秒） */
const settleFleet = (a, secs = 4) => {
  for (let i = 0; i < Math.ceil(secs / 0.25); i++) a.update(0.25, 1e4 + i * 0.25);
};""",
"lockedCount → heldCount")

# ---------------- ① ----------------
swap("①", """{
  const w = makeWorld();
  const a = buildAssault(w);
  assert.ok(a.begin(w.hub), "begin 应成功");
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert", "approach 应走完");
  assert.equal(heldCount(w), 3, "approach 段应请求主舰驻留");
  assert.equal(hijacked(w), false, "approach 段不许给主舰写航向");

  // insert 段每帧都要续请求：跑一段，中途抽查
  for (let i = 0; i < 40 && a.phase() === "insert"; i++) a.update(0.25, i * 0.25);
  assert.equal(heldCount(w), 3, "insert 段驻留请求必须还在");

  runWhile(a, "insert");
  assert.equal(a.phase(), "combat", "insert 应走到 combat");
  // 外部把请求撤掉（鲸的故事线接管），下一帧必须重新请求上
  (w.fleet.userData.members || []).forEach((m) => { m.userData.missionLock.hold = false; });
  a.update(0.25, 999);
  assert.equal(heldCount(w), 3,
    "combat 段请求被撤掉后，下一帧必须重新请求——士兵还在地面，主舰不能说走就走");
  assert.equal(hijacked(w), false,
    "全程不许写 missionLock.active / hubDir——那会压住 whaleLock 与 patrol，" +
    "等于登陆队在开主舰（主人 2026-09-06：舰队围绕主舰，不是主舰围绕登陆队）");
  console.log("  ✓ ① 全程只请求主舰驻留，不抢方向盘（approach / insert / combat 三段抽查）");
}
""")

# ---------------- ② ----------------
swap("②", """{
  // 打完一站必须**收干净**回 done，并给这个地方上冷却。
  //
  // 旧版这里验的是相反的事：extract 末尾直接 setupMission(下一站)，
  // 整支登陆队连同主舰一起被挪走。那是主人 2026-09-06 否掉的反向指挥，
  // 也是「重甲兵反复空降」的主发动机——站与站之间没有一帧停顿。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");
  runWhile(a, "withdraw");
  runWhile(a, "extract");
  assert.equal(a.phase(), "done", "打完必须回 done，不许直接续下一站");
  assert.equal(hijacked(w), false, "收队后更不该留着航向");

  // 冷却：主舰还停在原地，怎么问都不许再落一批
  settleFleet(a, 6);
  for (let i = 0; i < 5; i++) {
    assert.equal(a.requestStation(w.hub), false, "同一个地方冷却期内不许再开局");
  }
  assert.equal(a.phase(), "done", "被拒之后不该改变阶段");
  console.log("  ✓ ② 打完回 done + 同点冷却（拆掉了「打完立刻开赴下一站」的传送口）");
}
""")

# ---------------- ②b ----------------
swap("②b", """{
  // 受击**不是**第二条开局路径。
  //
  // 红盔会一直朝天上放箭，旧代码在 idle/done 分支里直接 begin(home)，
  // 于是每 3 秒（retaliateCd）就能触发一次空投——「重甲兵源源不断赶来」的
  // 另一台发动机。现在它必须走 requestStation 的同一道闸。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");

  settleFleet(a, 6);
  for (let i = 0; i < 10; i++) {
    a.onFleetUnderAttack(w.defendersLive[0], w.hub.clone());
    a.update(0.25, 2e4 + i * 0.25);
  }
  assert.equal(a.phase(), "done",
    "刚打完的地方，挨多少箭都不许再空投一批——这正是主人反复报的「源源不断」");
  console.log("  ✓ ②b 受击不再是第二条开局路径（走同一道闸）");
}
""")

# ---------------- ⑩ ----------------
swap("⑩", """{
  // requestStation 是「要不要在这一站落」的唯一入口，现在要过三道闸。
  // 每一道都对应一个真实发生过的故障，见 vanguardAssault.requestStation 的注释。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);

  // 闸①②：主舰还没停稳就问，必须拒绝——否则就是往空气里空投
  assert.equal(a.requestStation(w.hub), false, "主舰没停稳时不许开局");
  settleFleet(a, 4);
  assert.equal(a.requestStation(w.hub), true, "主舰停稳了，首战应该落");

  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");

  // 闸③：刚打过的地方要冷却
  settleFleet(a, 6);
  assert.equal(a.requestStation(w.hub), false, "刚打过的地方不许再落一批");

  // 闸②：主舰飞去别处并停稳 → 那里才是新战场（战场跟着主舰走）
  const far = new THREE.Vector3(-0.62, 0.48, 0.62).normalize();
  for (const m of w.fleet.userData.members) m.position.copy(far).multiplyScalar(R + 60);
  assert.equal(a.requestStation(far), false, "刚挪过去还没停稳，不许开局");
  settleFleet(a, 5);
  assert.equal(a.requestStation(far), true, "主舰在新地方停稳 → 战场跟着主舰走");
  console.log("  ✓ ⑩ 开局三道闸：主舰在场 · 主舰停稳 · 该地未在冷却");
}
""")

io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs")
