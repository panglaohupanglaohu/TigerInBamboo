# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

old = """  function updateFleetLock(centerDir, hoverRadius) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];
    for (const m of members) {"""
new = """  function updateFleetLock(centerDir, hoverRadius, { yieldToWhale = false } = {}) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];
    // 苔庭鲸对抗期让路（主人 2026-09-05）：鲸起时机队要压在鲸背正上方被绳索
    // 拽扯，那是另一条故事线。作战期的舰队锁只在**鲸的戏演完之后**接管——
    // 那一刻正好就是主人说的「aircraft 被打走」的时刻，接住它即可。
    if (yieldToWhale) {
      const squadWl = fleet?.userData?.whaleLock;
      if (squadWl?.active) return;
      if (members.some((m) => m?.userData?.whaleLock?.active)) return;
    }
    for (const m of members) {"""
assert old in s, "updateFleetLock 未匹配"
s = s.replace(old, new, 1)

old2 = """        updateFleetLock(_fleetDir, Math.max(st.baseRadius, R) + FLEET_COMBAT_UP);"""
new2 = """        updateFleetLock(_fleetDir, Math.max(st.baseRadius, R) + FLEET_COMBAT_UP,
          { yieldToWhale: true });"""
assert old2 in s, "combat 锁调用未匹配"
s = s.replace(old2, new2, 1)

io.open(P, "w", encoding="utf-8").write(s)
print("ok")
