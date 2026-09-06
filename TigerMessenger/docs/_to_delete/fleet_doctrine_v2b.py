# -*- coding: utf-8 -*-
"""不要 missionLock（第二部分）：把主舰这一侧的读取端也拆掉。

vanguardAssault 已经不再写 missionLock 了，moebiusAircraft 这边就成了三段死码：
盘旋块、回归过渡、驻留延长。留着最危险——下一个人看见它，会以为「主舰是可以被
锁的」，于是又写一个新的写者进去。整段删掉，主舰身上只剩两个权威：
  · whaleLock（鲸的故事线，saihojiGarden 写）
  · patrol（自己的航线）
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/assets/moebiusAircraft.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---- 整块切除：苔庭之战舰队模式（盘旋 + 回归过渡） ----
a = s.index("  // ---------- 苔庭之战舰队模式（2026-09-05）")
b = s.index("  // ---------- 苔庭鲸对抗期：俯冲吸食")
assert "missionReturnCenter" in s[a:b] and "missionLockActive" in s[a:b]
s = s[:a] + """  // ⚠️ 这里曾经有「苔庭之战舰队模式」：vanguardAssault 往每架机写
  //    missionLock = { active, hubDir, hoverRadius }，主舰就被拽到登陆队挑的
  //    站点上空小圈盘旋。主人 2026-09-06 否掉了整个机制——「不要 missionlock」。
  //
  //    连同上一版留下的「驻留延长请求」（missionLock.hold）一起拆干净。
  //    留着比删掉更危险：下一个人看见这段，会以为主舰是可以被别人锁的，
  //    于是又添一个写者，然后又是一轮「主舰飞走了别人不跟」。
  //
  //    主舰身上现在只剩两个权威：
  //      · whaleLock —— 鲸的故事线，saihojiGarden 写（写在 squad.userData 上）
  //      · patrol    —— 它自己的航线
  //    登陆队对主舰**只读不写**：主舰在哪，战场就在哪；主舰走了，地面部队跟着撤。

""" + s[b:]

# ---- 两处 !missionLockActive 条件 ----
rep("  if (!missionLockActive && wl?.active && wl.hubDir && Number.isFinite(wl.hoverRadius)) {",
    "  if (wl?.active && wl.hubDir && Number.isFinite(wl.hoverRadius)) {",
    "whaleLock 条件")
rep("  } else if (!missionLockActive && aircraft.userData.patrol) {",
    "  } else if (aircraft.userData.patrol) {",
    "patrol 条件")

# ---- 驻留延长分支 ----
a = s.index("    // 舰队驻留请求（主人 2026-09-06：主舰主导）")
b = s.index("    if (st.u >= 1) {", a)
assert "mlHold" in s[a:b]
s = s[:a] + """    // 驻留计时照常推进：**没有任何人能请求主舰多留一会儿**（主人 2026-09-06）。
    // 主舰打完这一段驻留就走，地面部队跟着撤——这就是「一切以主舰为主」。
    st.u += dt / (st.seg === 1 || st.seg === 3 ? Math.max(hold, 0.001) : legTime);
""" + s[b:]

# ---- 离队吸蜜的条件里那半句 ----
rep("""        !aircraft?.userData?.whaleLock?.active &&
        !aircraft?.userData?.missionLock?.active
      ) {""",
"""        !aircraft?.userData?.whaleLock?.active
      ) {""",
    "吸蜜条件")
rep("      // 苔庭鲸对抗期（whaleLock 锁定）与苔庭之战舰队期（missionLock）：禁止离队吸蜜",
    "      // 苔庭鲸对抗期（whaleLock 锁定）：禁止离队吸蜜",
    "吸蜜注释")

io.open(P, "w", encoding="utf-8").write(s)
print("patched moebiusAircraft.js（拆掉 missionLock 读取端）")
