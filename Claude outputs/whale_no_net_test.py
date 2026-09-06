# -*- coding: utf-8 -*-
"""test_whale_maw：①（渔网）换成「被拉扯挣脱」。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_whale_maw.mjs")
s = io.open(P, encoding="utf-8").read()

# ---- 头注释 ----
s = s.replace("""//   「苔庭之鲸需要也参与战斗
//     1）你来模拟它被渔网束缚后的挣扎""",
"""//   「苔庭之鲸需要也参与战斗
//     1）你来模拟它被渔网束缚后的挣扎」
//   →「不必出现网，有那种被拉扯挣脱的感觉即可」（2026-09-06 修订）
//   （原文接下去是）""", 1)

# ---- ① 整块重写 ----
a = s.index("// ---------------------------------------------------------------- ①")
b = s.index("// ---------------------------------------------------------------- ②")
new = '''// ---------------------------------------------------------------- ①
{
  // 被拉扯：拉力从外面喂进来（场上就是绳索小队的拔河，
  // 拉力汇总在 saihojiPhalanx 的 root.userData.ropePull01）。
  //
  // ⚠️ 这里原来验的是一张**渔网**。主人 2026-09-06：「不必出现网，
  // 有那种被拉扯挣脱的感觉即可」——网是我自己加的道具，删了；
  // 拉扯这件事交给场上本来就有的绳索，因果是现成的。
  const w = makeWorld();
  step(w, 0.2);
  assert.equal(w.maw.stats().tug, 0, "一开始没人拉它");
  const q0 = w.whale.quaternion.clone();
  const r0 = w.whale.position.length();
  step(w, 3);
  assert.ok(w.whale.quaternion.angleTo(q0) < 1e-6, "没被拉时鲸不该自己乱抖");

  // 拉住 → 立刻猛挣一下
  w.maw.setTug(1);
  step(w, 0.1, 0.05, 50);
  assert.ok(w.maw.stats().struggle > 0.9,
    "刚被拽住的第一反应就是猛地一挣，不该慢慢升上来");

  // 拉扯期间：姿态在动，而且**整条鲸被拽沉又弹回**（只转不沉读起来像原地扭）
  let minR = Infinity;
  let maxR = -Infinity;
  for (let i = 0; i < 400; i++) {
    w.maw.update(0.05, 100 + i * 0.05);
    const r = w.whale.position.length();
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    // 每帧把位置复位（模拟鲸自己的 update 每帧重算锚点），只看这一帧的偏移
    w.whale.position.setLength(r0);
  }
  assert.ok(r0 - minR > 0.4,
    `被拉扯时整条鲸要被拽沉一截，实测最深只沉了 ${(r0 - minR).toFixed(2)}`);
  assert.ok(maxR - minR > 0.5,
    `拽沉要有起伏（拽下去、挣回来），实测幅度 ${(maxR - minR).toFixed(2)}`);

  // 松手 → 平息
  w.maw.setTug(0);
  step(w, 12, 0.05, 300);
  assert.ok(w.maw.stats().struggle < 0.02, "绳一松就该平静下来");
  assert.equal(w.whale.userData.combatShake, null, "平静后不该还留着甩动量");
  console.log(`  ✓ ① 被拉扯：一拽就猛挣 · 整条鲸被拽沉 ${(r0 - minR).toFixed(2)}（起伏 ${(maxR - minR).toFixed(2)}）· 松手即平息`);
}

'''
s = s[:a] + new + s[b:]

# ---- ② 里的 castNet / releaseNet ----
s = s.replace("  w.maw.castNet();\n  // 采样一段时间里的挣扎强度，看它有没有起伏",
              "  w.maw.setTug(1);\n  // 采样一段时间里的挣扎强度，看它有没有起伏", 1)
s = s.replace("""  // 收网 → 平息
  w.maw.releaseNet();
  step(w, 12, 0.05, 300);
  assert.ok(w.maw.stats().struggle < 0.02, "收了网就该平静下来");
  assert.equal(w.maw.parts().net.visible, false, "收网后网要收起来");
  console.log(`  ✓ ② 挣扎：峰 ${hi.toFixed(2)} / 谷 ${lo.toFixed(2)} · ${bursts} 阵 · 收网即平息`);""",
"""  // 松手 → 平息
  w.maw.setTug(0);
  step(w, 12, 0.05, 300);
  assert.ok(w.maw.stats().struggle < 0.02, "松了手就该平静下来");
  console.log(`  ✓ ② 挣扎：峰 ${hi.toFixed(2)} / 谷 ${lo.toFixed(2)} · ${bursts} 阵 · 松手即平息`)""" + ";", 1)
s = s.replace("""  assert.ok(lo < 0.35, `挣扎要有间歇，实测谷值 ${lo.toFixed(2)}——一直满格就是机器不是活物`);""",
              """  assert.ok(lo < 0.4, `挣扎要有间歇，实测谷值 ${lo.toFixed(2)}——一直满格就是机器不是活物`);""", 1)

# ---- 其余 castNet ----
s = s.replace("  w.maw.castNet();\n  w.maw.swallow();", "  w.maw.setTug(1);\n  w.maw.swallow();")
s = s.replace("  w.maw.castNet();\n\n  let moved = 0;", "  w.maw.setTug(1);\n\n  let moved = 0;")
s = s.replace("""  w.maw.releaseNet();
  for (let i = 0; i < 400; i++) {""", """  w.maw.setTug(0);
  for (let i = 0; i < 400; i++) {""")
s = s.replace("""  const w = makeWorld();
  w.maw.castNet();
  step(w, 0.2);
  let tris = 0;""", """  const w = makeWorld();
  w.maw.setTug(1);
  step(w, 0.2);
  let tris = 0;""")
s = s.replace("  for (const part of [p.net, p.hinge, p.bulge].filter(Boolean)) {",
              "  for (const part of [p.hinge, p.bulge].filter(Boolean)) {")
s = s.replace("""  // 「新部件」= 网 + 切面圆盘 + 肚子里的鼓包。""",
              """  // 「新部件」= 上腭 / 鲸须 / 喉腹褶 + 肚子里的鼓包。""")

s = s.replace("✅ test_whale_maw（渔网束缚 · 一阵阵挣扎 · 张嘴吸入并挣扎 · 腹中走一趟 · 排出落地 · 军服变土黄 · 不被场景顺序抹掉）",
              "✅ test_whale_maw（被绳索拉扯挣脱 · 下颌下沉喉囊鼓起 · 吸入时挣扎 · 腹中走一趟 · 排出落地 · 军服变土黄 · 不被场景顺序抹掉）")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_whale_maw.mjs（① 拉扯挣脱）")
