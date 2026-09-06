# -*- coding: utf-8 -*-
"""不要 missionLock（第三部分）：砍掉 saihojiPhalanx 每帧的 requestStation。

主人 2026-09-06：「只有莫比斯 aircraft 受到攻击才会产生空降」。

这条线是「重甲兵反复空降」的最后一台发动机，也是把苔庭钉成固定战役的根源：
鲸一起、方阵一成形，就每帧问一次「要不要在苔庭落」。三道闸挡住了大部分，
但只要主舰恰好在苔庭上空停稳、冷却又过了，它就会自己开一局——
跟「有没有人打主舰」毫无关系。

现在苔庭跟别的地方一视同仁：主舰巡到那儿，红盔朝天上放箭打中机队
（saihojiPhalanx 的箭/标枪命中回调 → onFleetUnderAttack），舰队才落地还击。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/saihojiPhalanx.js")
s = io.open(P, encoding="utf-8").read()

old = """      const hd = hubDir(_tmp).clone();
      if (vanguardAssault?.requestStation) {
        // 走舰队自己的判断，不再每帧硬 begin：打完苔庭之后它会开赴巡演下一站，
        // 而不是就地再空投一批（主人 2026-09-05）。
        vanguardAssault.requestStation(hd);
      } else if (vanguardAssault?.begin) {
        vanguardAssault.begin(hd);
      } else {
        // 无突击模块（如 V3 后端）：退回旧的瞬时落地（已修球面浮高）
        const gr = groundHeightAt(hd) ?? PLANET_RADIUS + 0.3;
        deployVanguardSquad(vanguardRoot, hd, gr + 0.05);
      }
      logCommand("vanguardDeploy");"""
new = """      // ⚠️ 主人 2026-09-06：**这里不再开局**。
      //
      // 原来是「鲸起 + 方阵成形 = 苔庭之战开打」，每帧问一次 requestStation。
      // 那等于把苔庭钉成一个固定战役：主舰只要在附近停稳、冷却又过了，
      // 就会自己开一局，跟有没有人打主舰毫无关系——这是「重甲兵反复空降」
      // 的最后一台发动机。
      //
      // 现在苔庭跟别的地方一视同仁，是主舰航线上的一站。红盔朝天上放箭打中
      // 机队时，本文件的箭/标枪命中回调会调 onFleetUnderAttack，
      // 那是唯一的开局入口（「只有莫比斯 aircraft 受到攻击才会产生空降」）。
      if (!vanguardAssault?.requestStation) {
        // 无突击模块（如 V3 后端）：保留旧的瞬时落地，那条线上没有受击回调
        const hd = hubDir(_tmp).clone();
        if (vanguardAssault?.begin) {
          vanguardAssault.begin(hd);
        } else {
          const gr = groundHeightAt(hd) ?? PLANET_RADIUS + 0.3;
          deployVanguardSquad(vanguardRoot, hd, gr + 0.05);
        }
        logCommand("vanguardDeploy");
      }"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched saihojiPhalanx.js（砍掉每帧 requestStation）")
