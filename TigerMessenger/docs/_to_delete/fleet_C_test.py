# -*- coding: utf-8 -*-
"""⑫ 索降到一半机队飞走：任何一帧都不许有人吊在半空没有绳子，最后必须全部绞回泡机。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

anchor = 'console.log("✅ test_fleet_cohesion'
assert anchor in s

block = '''// ---------------------------------------------------------------- ⑫
{
  // 主人 2026-09-06：「索降 重甲士兵 + 绳索回收 重甲士兵
  //                （不要出现半空索降时就离开的情况）」
  //
  // 改之前这里有两个洞：
  //   ① 撤离时索降兵根本没有回收路径——代码把他们「就近挂到一艘艇」，
  //      让人徒步走去登陆艇的后舱门，可泡机明明配着绳索；
  //   ② insert 段被打断时（机队飞走 → stranded → 直接转 withdraw），
  //      正挂在绳上的人被当成地面兵处理，从半空弹到地面。
  //
  // 这一条就卡在最难看的那一瞬间下手：**趁人还在绳子中间，把机队抽走**。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert");

  const podTroopers = () =>
    w.squad.userData.troopers.filter((t) => t.userData.vehicleSlot?.kind === "pod");

  // 喂到「有人正挂在绳上」：离地了、还没落地、也还没上机
  let airborne = 0;
  for (let i = 0; i < 200 && airborne === 0; i++) {
    a.update(0.25, i * 0.25);
    airborne = podTroopers().filter(
      (t) => t.visible && !t.userData.dead && !t.userData.aboard &&
             t.userData.onGround === false && t.position.length() > gh() + 1.0
    ).length;
  }
  assert.ok(airborne > 0, "应当能抓到「正挂在绳上」的那一瞬间，否则这条测试没测到东西");

  // 就在这一刻，机队飞走
  w.fleet.removeFromParent();

  // 全程盯着：任何一帧都不许有人离地、没上机、却一根绳子都没连着
  const ropesVisible = () => {
    let n = 0;
    a.root.traverse((o) => { if (o.visible && /rope/i.test(o.name || "")) n++; });
    return n;
  };
  let worst = null;
  for (let i = 0; i < 600 && a.phase() !== "done"; i++) {
    a.update(0.25, 1000 + i * 0.25);
    const hanging = podTroopers().filter(
      (t) => t.visible && !t.userData.dead && !t.userData.aboard &&
             t.userData.onGround === false && t.position.length() > gh() + 1.0
    );
    if (hanging.length && ropesVisible() === 0) { worst = hanging.length; break; }
  }
  assert.equal(worst, null,
    `有 ${worst} 名索降兵吊在半空却没有任何绳子连着——这就是「半空索降就离开」`);

  // 收尾：泡机那 6 个人必须是被**绞回泡机**的，不是走去登陆艇的
  for (const tr of podTroopers()) {
    if (tr.userData.dead) continue;
    assert.equal(tr.userData.aboard, true,
      `索降兵 uid=${tr.userData.uid} 没被收回——绳索回收是主人点名要的动作`);
    assert.equal(tr.visible, false, "收回后应在泡机腹内，不该还站在画面里");
    assert.ok(tr.position.length() > gh() + 1.0,
      "收回后人在泡机上（离地），不是被丢在地面等着走回登陆艇");
  }
  console.log(`  ✓ ⑫ 索降中途机队飞走：${podTroopers().length} 名索降兵全部绳索绞回，无一半空遗弃`);
}

'''
s = s.replace(anchor, block + anchor, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs（⑫）")
