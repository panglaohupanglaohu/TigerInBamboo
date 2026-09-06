# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()
old = """    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) {
      // 没有机队可跟 → 才真的收进后台（场景没加载 / 桩环境）
      for (const c of haulers) if (c && c.visible) c.visible = false;
      return;
    }"""
new = """    // 「有没有机队可跟」必须与 fleetAlive 用同一把尺子：机队整组被移出场景时，
    // 成员的 .parent 仍然指向那个已脱离场景的 Group，光看成员会误判成「还在」。
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleetAlive() ? (fleet.userData.members || []).filter((m) => m?.parent) : [];
    if (!members.length) {
      // 没有机队可跟 → 才真的收进后台（场景没加载 / 桩环境 / 机队已离场）
      for (const c of haulers) if (c && c.visible) c.visible = false;
      return;
    }"""
assert old in s, "未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("ok")
