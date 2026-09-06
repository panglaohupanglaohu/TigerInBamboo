# -*- coding: utf-8 -*-
"""G：给 D（麻醉坠地）/ E（登陆艇撞飞）/ F（侦察机随舰队）各补一条回归测试。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

# ============================================================ ⑬⑭ 进 fleet_cohesion
P = R + "tools/test_fleet_cohesion.mjs"
s = io.open(P, encoding="utf-8").read()
anchor = 'console.log("✅ test_fleet_cohesion'
assert anchor in s

block = '''// ---------------------------------------------------------------- ⑬
{
  // 主人 2026-09-06：「空中生物让 gatePodCraft 麻醉后坠地解决」。
  //
  // 改之前只写了 downed/paralyzed 两个标志就完事：地面红盔靠 saihojiPhalanx 的
  // _fallT 会自己倒下去，**飞行生物没有任何东西让它掉下来**——它带着 downed
  // 继续飞，而 downed 又把它从目标池里摘掉了，等于白麻醉。
  const w = makeWorld({ defenders: 0 });
  const a = buildAssault(w);

  // 造一只在天上的生物，登记成战场目标
  const bird = new THREE.Group();
  bird.name = "swamp-flyer";
  bird.userData = { uid: 900, wildCreature: true, combatant: true };
  bird.position.copy(w.hub).multiplyScalar(GROUND + 30);
  w.scene.add(bird);

  const a2 = buildAssault(w, { getTourTargets: () => [bird] });
  a2.begin(w.hub);
  runWhile(a2, "approach");

  // 喂到麻醉打满 5 发
  for (let i = 0; i < 900 && (bird.userData.tranqHits || 0) < 5; i++) {
    a2.update(0.25, i * 0.25);
  }
  assert.ok((bird.userData.tranqHits || 0) >= 5,
    `泡机应把空中生物打满麻醉，实得 ${bird.userData.tranqHits || 0} 发`);

  // 打满之后必须**掉下来**，不是继续飞
  const before = bird.position.length();
  for (let i = 0; i < 400 && bird.position.length() > GROUND + 0.5; i++) {
    a2.update(0.25, 1e3 + i * 0.25);
  }
  assert.ok(bird.position.length() < before - 5,
    `麻醉满额后必须坠落：${before.toFixed(1)} → ${bird.position.length().toFixed(1)}`);
  assert.ok(bird.position.length() <= GROUND + 0.6,
    `必须真的落到地面，实得 r=${bird.position.length().toFixed(2)}（地表 ${GROUND}）`);
  assert.equal(bird.userData.tranqGrounded, true, "落地后要标记，好交给重甲兵解决");

  // 「解决」这一步：躺在地上的目标必须还在重甲兵的打击池里
  assert.ok(a2.tourTargets().includes(bird),
    "瘫在地上的目标必须留在重甲兵的打击池里——不然它就永远躺在那儿没人管");
  console.log("  ✓ ⑬ 空中生物麻醉满额 → 坠地 → 仍在重甲兵打击池（麻醉后坠地解决）");
}

// ---------------------------------------------------------------- ⑭
{
  // 主人 2026-09-06：登陆艇「用体重撞飞攻击者」。
  // 改之前 gateHaulerCraft.js 里连 ram 这个词都搜不到，这个动作一行代码都没有。
  const w = makeWorld({ defenders: 1 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  // 把红盔挪到某艘登陆艇的艇体外缘以内
  const victim = w.defendersLive[0];
  const craft = w.haulers.find((c) => c.parent && c.visible) || w.haulers[0];
  craft.updateWorldMatrix(true, false);
  const cp = craft.getWorldPosition(new THREE.Vector3());
  victim.position.copy(cp).add(new THREE.Vector3(1.2, 0, 0));
  const r0 = victim.position.length();
  const d0 = victim.position.distanceTo(cp);

  let launched = false;
  for (let i = 0; i < 60 && !launched; i++) {
    a.update(0.25, 3e3 + i * 0.25);
    if (victim.userData.rammedAir || victim.userData.tranqGrounded) launched = true;
  }
  assert.ok(launched, "贴到艇体外缘的攻击者必须被撞飞");

  // 撞飞 = 被甩开 + 最后倒地（非致命，交给重甲兵解决）
  for (let i = 0; i < 120 && !victim.userData.tranqGrounded; i++) {
    a.update(0.25, 4e3 + i * 0.25);
  }
  assert.equal(victim.userData.tranqGrounded, true, "撞飞后应落地击倒");
  assert.equal(victim.userData.downed, true, "击倒（非致命，收尾交给重甲兵）");
  assert.ok(victim.position.distanceTo(cp) > d0 + 2,
    `应被甩离艇体：${d0.toFixed(1)} → ${victim.position.distanceTo(cp).toFixed(1)}`);
  assert.ok(Math.abs(victim.position.length() - r0) < 8,
    "撞飞是切向甩出去 + 抛物线落回地面，不是往天上/地心里塞");
  console.log("  ✓ ⑭ 登陆艇用体重撞飞攻击者 → 落地击倒，交给重甲兵解决");
}

'''
s = s.replace(anchor, block + anchor, 1)

# makeWorld / buildAssault 要支持 getTourTargets 注入
old = """function buildAssault(w, extra = {}) {
  return createVanguardAssault({"""
new = """function buildAssault(w, extra = {}) {
  return createVanguardAssault({"""
assert old in s
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs（⑬⑭）")

# ============================================================ 侦察机随舰队
P2 = R + "tools/test_scout_defense.mjs"
t = io.open(P2, encoding="utf-8").read()
tail = t.rstrip().rsplit("\n", 1)
last = tail[1]
assert last.startswith("console.log"), last[:80]

block2 = '''
// ---------------------------------------------------------------- 舰队分队
// 主人 2026-09-06 的舰队阵容里 scoutDefense 是一员：前出侦查、环绕战场飞行、
// 曳光弹指示目标，并且和泡机/登陆艇一样**随主舰移动**。
// 改之前它跟舰队毫无关系：5 架驻守水晶城，18 秒在「城 / 门」两区换一次岗。
{
  const anchor = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  let anchorDir = anchor.clone();
  const designated = [];

  const prey = new THREE.Group();
  prey.name = "designate-me";
  prey.userData = { uid: 77 };
  prey.position.copy(anchor).multiplyScalar(RADIUS + 8);
  scene.add(prey);

  const squad = createScoutDefenseSquad({
    scene,
    radius: RADIUS,
    moebius,
    abandonedGate,
    getCityBirdFlocks: () => null,
    getGateBirdVortex: () => null,
    count: 5,
    fleetCount: 3,
    getFleetAnchor: () => anchorDir,
    getFleetTargets: () => [prey],
    onDesignate: (o) => designated.push(o),
  });

  assert.equal(squad.getStatus().fleetCount, 3, "应有 3 架编入舰队");
  assert.equal(squad.fleetUnits().length, 3, "fleetUnits 应返回这 3 架");

  const distToAnchor = (u, dir) => {
    const p = u.group.position.clone().normalize();
    return p.distanceTo(dir) * RADIUS;
  };

  // 跑一段：3 架应当聚到战场上空，另外 2 架留在水晶城
  for (let i = 0; i < 400; i++) squad.update(0.05, i * 0.05);
  const fleetUnits = squad.fleetUnits();
  const homeUnits = squad.units.filter((u) => u.index >= 3);
  for (const u of fleetUnits) {
    assert.ok(distToAnchor(u, anchorDir) < 90,
      `编入舰队的机应在战场上空盘旋，实测离战场中心 ${distToAnchor(u, anchorDir).toFixed(0)}`);
  }
  assert.equal(homeUnits.length, 2, "水晶城应留 2 架守原岗");

  // 曳光指示：目标必须被推给舰队（分工制——侦察机只标记，不负责击杀）
  assert.ok(designated.length > 0, "曳光弹必须把目标指示给舰队");
  assert.ok(designated.includes(prey), "指示的应当就是战场上那个目标");
  assert.ok(!prey.userData.dead, "分工制：侦察机只标记，击杀交给舰队其它成员");

  // 随主舰移动：主舰飞走 → 这 3 架必须跟过去
  const before = fleetUnits.map((u) => distToAnchor(u, anchorDir));
  anchorDir = new THREE.Vector3(-0.62, 0.48, 0.62).normalize();
  prey.position.copy(anchorDir).multiplyScalar(RADIUS + 8);
  for (let i = 0; i < 900; i++) squad.update(0.05, 1e3 + i * 0.05);
  for (let k = 0; k < fleetUnits.length; k++) {
    const now = distToAnchor(fleetUnits[k], anchorDir);
    assert.ok(now < 120,
      `主舰飞走后侦察机必须跟过去（第 ${k} 架离新战场 ${now.toFixed(0)}，" +
      "原地不动就是主人反复报的「主舰移动其他不跟随」）`);
  }
  void before;
  console.log("  ✓ 舰队分队：3 架随主舰前出、环绕战场、曳光指示；水晶城留守 2 架");
}

'''
t = t.replace(last, block2 + last, 1)
io.open(P2, "w", encoding="utf-8").write(t)
print("patched test_scout_defense.mjs（舰队分队）")
