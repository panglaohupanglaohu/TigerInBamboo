# -*- coding: utf-8 -*-
"""⑪ withdraw 必须有出口：一艘艇回不了滩头也不许把整支舰队钉死在原地。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

anchor = 'console.log("✅ test_fleet_cohesion'
assert anchor in s

block = '''// ---------------------------------------------------------------- ⑪
{
  // 主人 2026-09-05 的 `__tm.fleet()` 现场：
  //   { phase: 'withdraw', aircraft:{n:5}, pods:{n:3, inWing:0, strayed:3},
  //     haulers:{n:3,visible:3}, troopers:{visible:true, state:'deployed'} }
  // 机队早飞到湖沼了，登陆队还停在苔庭：phase 永久卡在 withdraw。
  //
  // 根因是 withdraw 那一段**没有出口**。收尾条件是 `allAboard && rampsReady`，
  // 而超时兜底只强制 allAboard、不管 rampsReady：只要有一艘艇的 retArrived
  // 永远为 false（飞不回滩头），rampsReady 就永远是 false。
  // 更糟的是 onMission 为真时 update() 不会调 releasePods()/enforceOffstage()，
  // 于是三台泡机挂在 scene 下不伴飞、运输艇不巡航、重甲兵留在原地——
  // 主人反复报的「泡机和登陆艇没去伴飞」「重甲兵源源不断」全从这一个死角来。
  //
  // 这里把那艘飞不回来的艇造出来：冻住它的 position，chaseObj 永远到不了。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");

  // 一艘艇彻底不动了（位置写不进去）——现实里对应滩头方向被场景切换改脏
  const stuck = w.haulers[0];
  const p = stuck.position;
  for (const k of ["copy", "set", "lerp", "add", "addScaledVector", "sub", "lerpVectors"]) {
    p[k] = () => p;
  }
  // 机队同时飞走：这时舰队跟走的优先级最高，撤离动画再好看也得让路
  for (const m of w.fleet.userData.members) m.position.set(0, R + 900, 0);

  // withdrawChaseTimeout = 12s，给 40s 足够宽的余量
  for (let i = 0; i < 160 && a.phase() === "withdraw"; i++) a.update(0.25, 9000 + i * 0.25);
  assert.notEqual(a.phase(), "withdraw",
    "一艘艇回不了滩头就把 phase 永久钉在 withdraw——舰队从此散在原地，这是那个死角");

  // 走完剩下的路，回到常态：泡机归翼、兵与艇收进后台
  runWhile(a, "extract");
  a.update(0.25, 12000);
  assert.equal(a.phase(), "done", "撤离超时后必须能一路收到 done");
  for (const pod of w.pods) {
    assert.equal(pod.parent, w.wing, "收队后泡机必须挂回僚机翼才会伴飞");
  }
  assert.equal(w.squad.visible, false, "重甲兵收队后不该留在画面里");
  console.log("  \\u2713 \\u246A 撤离有硬截止：一艘艇卡住也不许把舰队钉死在原地");
}

'''
s = s.replace(anchor, block + anchor, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_fleet_cohesion.mjs")
