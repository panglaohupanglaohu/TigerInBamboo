# -*- coding: utf-8 -*-
"""test_moon_orb ⑤：月海从「压扁球」改成「球冠」之后的断言。

截图实锤了压扁球的两个毛病：球的边缘从月亮的轮廓线上戳出去（底下缺了一口），
掠射角下又会退化成一条亮边。球冠是从同一个球心切出来的面片，半径只比本体
大 0.3%，任何角度都严丝合缝——所以断言也要跟着换：不再验「埋进去多深」，
改验「所有顶点都贴在球面上、永远不破轮廓」。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_moon_orb.mjs")
s = io.open(P, encoding="utf-8").read()

old = s[s.index("// ---- ⑤ 月海"):s.index("// ---- ⑥ 昼夜")]
new = '''// ---- ⑤ 月海：球冠贴面，任何角度都不破轮廓 ----
{
  const patches = orb.maria.children;
  assert.ok(patches.length >= 5, `月海应有 5 块以上，实得 ${patches.length}`);
  let maxR = 0;
  for (const p of patches) {
    // 球冠以球心为原点，靠 quaternion 转到法线上——位置必须留在原点
    assert.ok(p.position.length() < 1e-6,
      "月海是球冠，位置留在球心，靠朝向定位；挪出去就说明又变回「贴片」了");
    const pos = p.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
  }
  // 关键的一条：月海最远的顶点也只比本体大一点点 —— 永远不会从轮廓线上戳出去。
  // 第一版用压扁的小球半埋进本体，截图上月亮底下缺了一口，就是这里没管住。
  const over = maxR / MOON_ORB.radius;
  assert.ok(over > 1.0 && over < 1.02,
    `月海必须严丝合缝贴着球面（半径比 1.000~1.020），实测 ${over.toFixed(4)}——` +
    "大了会破轮廓，小了会被本体吃掉");
  console.log(`  ✓ ⑤ 月海 ${patches.length} 块 · 球冠贴面（半径比 ${over.toFixed(4)}，不破轮廓）`);
}

'''
s = s.replace(old, new, 1)
s = s.replace("✅ test_moon_orb（月亮湖的月亮：和湖同宽 · 对岸看 27° · 走不进去 · 确定性 · 昼夜 · 月光路朝人）",
              "✅ test_moon_orb（月亮湖的月亮：和湖同宽 · 对岸看 30° · 走不进去 · 确定性 · 月海贴面 · 昼夜 · 月光路朝人）")
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_moon_orb.mjs（⑤ 球冠）")
