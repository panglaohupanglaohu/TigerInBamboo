# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()
MARK = "// ---------------------------------------------------------------- ⑥"
if MARK in s:
    print("已存在"); raise SystemExit
tail = 'console.log("✅ test_fleet_cohesion'
i = s.index(tail)
add = '''// ---------------------------------------------------------------- ⑥
{
  // 苔庭鲸对抗期让路：鲸起时机队归 whaleLock 管（压在鲸背上方被绳索拽），
  // 作战锁**不许**在那时候把机队抢走；鲸的戏一落幕（whaleLock 关）才接管——
  // 那一刻正是主人说的「aircraft 被打走」的瞬间。
  const w = makeWorld();
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  // 鲸戏进行中：外部关掉 missionLock 并打开 whaleLock → 作战锁必须让路
  w.fleet.userData.whaleLock = { active: true };
  (w.fleet.userData.members || []).forEach((m) => { m.userData.missionLock.active = false; });
  a.update(0.25, 1200);
  assert.equal(lockedCount(w), 0, "鲸对抗期作战锁必须让路给 whaleLock");

  // 鲸戏落幕 → 作战锁立刻接管，机队不许自己飞走
  w.fleet.userData.whaleLock.active = false;
  a.update(0.25, 1201);
  assert.equal(lockedCount(w), 3, "鲸戏落幕后作战锁必须马上接住机队");
  console.log("  ✓ ⑥ 鲸对抗期让路 / 落幕即接管");
}

'''
s = s[:i] + add + s[i:]
io.open(P, "w", encoding="utf-8").write(s)
print("已追加 ⑥")
