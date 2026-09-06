# -*- coding: utf-8 -*-
"""几何预算收紧：把这一轮压下来的数字锁住，别再慢慢漂回去。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_geom_leak_budget.mjs")
s = io.open(P, encoding="utf-8").read()

old = s[s.index("assert.ok(afterBuild <= 2000,"):s.index("`游离几何 ${orphan} > 2000——有一批几何既不在场景里也没释放`);") + len("`游离几何 ${orphan} > 2000——有一批几何既不在场景里也没释放`);")]
new = """// 天花板按 2026-09-05 实测值 + 约 20% 余量定死。当天的三步：
//   ① geometryMerge.bake 里 toNonIndexed 的中间几何没 dispose（漏最多的一处）
//   ② buildCitadelTown 的 ~40 个共享原型，dirty 增量时绝大多数没网格用
//   ③ 屋顶/拱廊/水道/广场/小船/水门拱窗这几条规则的原型压根没登记进清扫表
// 建城 13334 → 1153，每次编辑 +918 → +27，游离 → 272。
// 数字掉这么多不是玄学，是三处具体的「造了没人用也没释放」。
// 谁把它顶回去，先用 `TRACE=1 node tools/probe_geom_leak.mjs` 看出生地排行榜。
assert.ok(afterBuild <= 1400,
  `建城后存活几何 ${afterBuild} > 1400——建城阶段又开始漏了`);
assert.ok(perEdit <= 60,
  `每次编辑净增 ${perEdit.toFixed(1)} 个几何 > 60。\\n` +
  `  编辑器卡死的根子就是这个：几何越攒越多，帧时间跟着涨到 1.5s。\\n` +
  `  用 TRACE=1 node tools/probe_geom_leak.mjs 看是谁又开始漏。`);
assert.ok(orphan <= 600,
  `游离几何 ${orphan} > 600——有一批几何既不在场景里也没释放`);"""
assert old in s
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched test_geom_leak_budget.mjs")
