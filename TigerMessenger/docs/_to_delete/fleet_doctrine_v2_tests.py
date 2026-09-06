# -*- coding: utf-8 -*-
"""test_fleet_cohesion 改成新契约（主人 2026-09-06 第二轮）：
   · 对主舰只读不写（不要 missionLock）
   · 只有主舰挨打才空降
   · 泡机的重甲兵落到攻击者附近
"""
import io, os, re
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

def swap(tag, body):
    """替换 `// ---- tag` 到下一个 `// ---- ` 之间的整块"""
    global s
    head = "// ---------------------------------------------------------------- " + tag + "\n"
    i = s.index(head)
    j = s.index("// ---------------------------------------------------------------- ", i + len(head))
    s = s[:i] + head + body + "\n" + s[j:]

# ---------------- 助手：从「驻留请求」改成「一个字节都不许写」 ----------------
a = s.index("/**\n * 被请求驻留的机队成员数。")
b = s.index("/** 喂帧让主舰读起来「停稳」")
s = s[:a] + """/**
 * 主舰身上被登陆队动过的痕迹数（成员 + squad 一起数）。
 *
 * 主人 2026-09-06：**「不要 missionlock」**。
 * 上一版这里验的是「只请求驻留（hold），不写航向（active/hubDir）」——
 * 主人直接把整个机制否掉了：哪怕只是「请主舰多留一会儿」，也仍然是地面部队
 * 伸手去动主舰的状态。主舰身上同时还有 whaleLock 和 patrol，多一个写者
 * 就多一次「下一帧它到底听谁的」，而那正是「主舰飞走了别人不跟」的根。
 *
 * 现在的契约只有一句：**登陆队对主舰只读不写**。所以这个数必须恒为 0。
 */
const fleetTouched = (w) => {
  const list = [w.fleet, ...(w.fleet?.userData?.members || [])].filter(Boolean);
  return list.filter((m) => m.userData?.missionLock !== undefined).length;
};

""" + s[b:]

# ---------------- ① ----------------
swap("①", """{
  const w = makeWorld();
  const a = buildAssault(w);
  assert.ok(a.begin(w.hub), "begin 应成功");
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert", "approach 应走完");
  assert.equal(fleetTouched(w), 0, "approach 段不许碰主舰");

  for (let i = 0; i < 40 && a.phase() === "insert"; i++) a.update(0.25, i * 0.25);
  assert.equal(fleetTouched(w), 0, "insert 段不许碰主舰");

  runWhile(a, "insert");
  assert.equal(a.phase(), "combat", "insert 应走到 combat");
  for (let i = 0; i < 40; i++) a.update(0.25, 900 + i * 0.25);
  assert.equal(fleetTouched(w), 0,
    "combat 段也不许碰主舰——士兵在地面上不是让主舰等他们的理由。" +
    "主舰打完自己的驻留就走，地面部队跟着撤（主人 2026-09-06：不要 missionlock）");
  console.log("  ✓ ① 全程对主舰只读不写（approach / insert / combat 三段抽查）");
}
""")

# ---------------- ② ----------------
rep("""  assert.equal(a.phase(), "done", "打完必须回 done，不许直接续下一站");
  assert.equal(hijacked(w), false, "收队后更不该留着航向");
  assert.equal(squadHeld(w), false,
    "收队后必须放开 squad 上的驻留请求，否则主舰会一直停着等一支已经走了的部队");

  // 冷却：主舰还停在原地，怎么问都不许再落一批
  settleFleet(a, 6);
  for (let i = 0; i < 5; i++) {
    assert.equal(a.requestStation(w.hub), false, "同一个地方冷却期内不许再开局");
  }""",
"""  assert.equal(a.phase(), "done", "打完必须回 done，不许直接续下一站");
  assert.equal(fleetTouched(w), 0, "收队后主舰身上更不该留下任何痕迹");

  // 冷却：主舰还停在原地，怎么问都不许再落一批
  settleFleet(a, 6);
  for (let i = 0; i < 5; i++) {
    assert.equal(a.requestStation(), false, "同一个地方冷却期内不许再开局");
  }""",
    "② 冷却")

# ---------------- ⑥：鲸对抗期 ----------------
swap("⑥", """{
  // 苔庭鲸对抗期：机队归 whaleLock 管（压在鲸背上方被绳索拽升拽降）。
  //
  // 上一版这里验的是「作战锁要给 whaleLock 让路、鲸戏落幕再接管」。
  // 现在根本没有作战锁了（主人 2026-09-06：不要 missionlock），
  // 于是这一块改验更强的一条：**鲸的故事线是主舰身上唯一的外来权威**，
  // 登陆队从头到尾一个字节都不写，自然也就没有让路不让路的问题。
  const w = makeWorld();
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  w.fleet.userData.whaleLock = { active: true, hubDir: w.hub.clone(), hoverRadius: 12 };
  const snapshot = JSON.stringify(w.fleet.userData.whaleLock.hubDir.toArray());
  for (let i = 0; i < 40; i++) a.update(0.25, 1200 + i * 0.25);
  assert.equal(fleetTouched(w), 0, "鲸对抗期同样不许碰主舰");
  assert.equal(w.fleet.userData.whaleLock.active, true,
    "登陆队不许关掉鲸的锁——那条故事线归 saihojiGarden 管");
  assert.equal(JSON.stringify(w.fleet.userData.whaleLock.hubDir.toArray()), snapshot,
    "更不许改鲸锁里的方向");
  console.log("  ✓ ⑥ 鲸对抗期：主舰身上只剩 whaleLock 一个外来权威，登陆队全程不写");
}
""")

# ---------------- ⑩：requestStation 不再收方向 ----------------
rep("""  assert.equal(a.requestStation(w.hub), false, "主舰没停稳时不许开局");
  settleFleet(a, 4);
  assert.equal(a.requestStation(w.hub), true, "主舰停稳了，首战应该落");""",
"""  assert.equal(a.requestStation(), false, "主舰没停稳时不许开局");
  settleFleet(a, 4);
  assert.equal(a.requestStation(), true, "主舰停稳了，首战应该落");""",
    "⑩ 前两问")
rep("""  assert.equal(a.requestStation(w.hub), false, "刚打过的地方不许再落一批");""",
"""  assert.equal(a.requestStation(), false, "刚打过的地方不许再落一批");""",
    "⑩ 冷却")
rep("""  assert.equal(a.requestStation(far), false, "刚挪过去还没停稳，不许开局");
  settleFleet(a, 5);
  assert.equal(a.requestStation(far), true, "主舰在新地方停稳 → 战场跟着主舰走");""",
"""  assert.equal(a.requestStation(), false, "刚挪过去还没停稳，不许开局");
  settleFleet(a, 5);
  assert.equal(a.requestStation(), true, "主舰在新地方停稳 → 战场跟着主舰走");""",
    "⑩ 换地方")

# ---------------- 新增 ⑮ / ⑯ ----------------
anchor = 'console.log("✅ test_fleet_cohesion'
assert anchor in s
block = '''// ---------------------------------------------------------------- ⑮
{
  // 主人 2026-09-06：「**只有莫比斯 aircraft 受到攻击才会产生空降**」。
  //
  // 改之前 saihojiPhalanx 每帧调一次 requestStation：鲸一起、方阵一成形，
  // 主舰只要恰好在附近停稳、冷却又过了，登陆队就自己开一局——跟有没有人
  // 打主舰毫无关系。那是「重甲兵反复空降」的最后一台发动机，也是把苔庭钉成
  // 固定战役的根源（主人：「苔庭只是其中一个战役」）。
  const w = makeWorld({ defenders: 6 });
  const a = buildAssault(w);

  // 主舰停稳、地面上一堆红盔、冷却也没有——具备一切「值得打」的条件。
  settleFleet(a, 8);
  for (let i = 0; i < 200; i++) a.update(0.25, 5e4 + i * 0.25);
  assert.equal(a.phase(), "idle",
    "没人打主舰就不许空降——满地敌人也不行。舰队是围绕主舰的战略打击力量，" +
    "不是看见敌人就往下跳的清剿队");

  // 有人打主舰 → 立刻开局
  a.onFleetUnderAttack(w.defendersLive[0]);
  assert.notEqual(a.phase(), "idle", "主舰挨打就必须落地还击");
  console.log("  ✓ ⑮ 只有主舰挨打才空降（满地敌人也不主动开局）");
}

// ---------------------------------------------------------------- ⑯
{
  // 主人 2026-09-06：「泡机下来的重甲兵……空降到攻击者附近，多以格斗解决对手」。
  //
  // 改之前索降点是绕中枢横排的三个固定点（±8 米），跟敌人在哪毫无关系：
  // 6 名突击兵落地之后还得自己走过去，「突击」两个字就没了。
  const w = makeWorld({ defenders: 4 });
  const a = buildAssault(w);

  // 把红盔全挪到远离中枢的一侧（离中枢 ~26 米），看落点跟谁走
  const up = w.hub.clone();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up).normalize();
  w.defendersLive.forEach((d, i) => {
    d.position.copy(up).multiplyScalar(GROUND)
      .addScaledVector(east, 26 + i * 1.5).normalize().multiplyScalar(GROUND);
  });
  const attackers = w.defendersLive.map((d) => d.position.clone());
  const centroid = attackers
    .reduce((acc, p) => acc.add(p), new THREE.Vector3())
    .multiplyScalar(1 / attackers.length);

  // 受击开局（唯一入口），走完 approach，索降前会再对一次表
  settleFleet(a, 8);
  a.onFleetUnderAttack(w.defendersLive[0]);
  assert.equal(a.phase(), "approach", "受击应开局");
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  // 泡机下来的 6 名（uid 0..5）必须落在攻击者附近
  const podTroopers = w.troopers.filter((tr) => (tr.userData.uid ?? 99) < 6);
  assert.equal(podTroopers.length, 6, "泡机应带 6 名（3 台 × 2 名前后型）");
  const far = podTroopers
    .map((tr) => tr.position.distanceTo(centroid))
    .sort((x, y) => y - x)[0];
  assert.ok(far < 22,
    `泡机的突击兵必须落在攻击者附近，实测最远一名离攻击者质心 ${far.toFixed(1)} 米——` +
    "落在中枢等于让突击兵自己走过去，「突击」就没了");

  // 落点跟中枢**不是**一回事：这一条防止「凑巧敌人就在中枢」蒙混过关
  const hubPos = w.hub.clone().multiplyScalar(GROUND);
  assert.ok(centroid.distanceTo(hubPos) > 20, "这一块的前提：攻击者确实远离中枢");
  const nearHub = podTroopers.filter((tr) => tr.position.distanceTo(hubPos) < 12).length;
  assert.equal(nearHub, 0, "不许再落回中枢的固定三点");
  console.log(`  ✓ ⑯ 泡机突击兵空降到攻击者附近（最远 ${far.toFixed(1)} 米，无人落回中枢）`);
}

'''
s = s.replace(anchor, block + anchor, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs（新契约 + ⑮⑯）")
