# -*- coding: utf-8 -*-
"""舰队是一个整体：aircraft 走了，泡机/运输艇/重甲兵不许留在场上。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/")

# ============================================================ vanguardAssault
P = R + "world/vanguardAssault.js"
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---- ① 下场即隐身 ----
rep("""    st.t = t;
    const onMission = st.phase !== "idle" && st.phase !== "done";
    // 不在任务中 → 泡机必须回到僚机翼去伴飞，一帧都不许滞留在 scene 下
    if (!onMission) releasePods();""",
"""    st.t = t;
    const onMission = st.phase !== "idle" && st.phase !== "done";
    // 不在任务中 → 泡机必须回到僚机翼去伴飞，一帧都不许滞留在 scene 下
    if (!onMission) { releasePods(); enforceOffstage(); }""",
"下场即隐身调用")

rep("""  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */""",
"""  /**
   * 不在任务中时，舰队的地面/海面成员一律不出现在画面里（主人 2026-09-05 定的规矩）：
   *
   *   「莫比斯 aircraft + GatePodCraft + gateHaulerCraft + 重甲兵是一个团队
   *     （海陆空舰队），随莫比斯 aircraft 扫荡式移动。只要 aircraft 移动走了，
   *     场景中就不要出现舰队相应成员。」
   *
   * 泡机是例外：它本来就挂在机队僚机翼下，跟着 aircraft 飞就是「跟着走」，
   * 不需要隐身（`releasePods` 负责把它送回翼下）。
   *
   * 这里做的是**兜底**，不是主逻辑：正常收队路径在 `updateExtract` 末尾已经
   * 隐了艇与兵。但任务可能从任何一个岔路提前结束（机队飞走、场景切换、
   * 存档重载），少一条出口就会在苔庭留下一排空运输艇。所以每帧钉一次。
   */
  function enforceOffstage() {
    const haulers = (typeof getHaulers === "function" ? getHaulers() : []) || [];
    for (const c of haulers) if (c && c.visible) c.visible = false;
    if (squad && squad.visible) squad.visible = false;
  }

  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */""",
"enforceOffstage")

# ---- ② 单一入口：这一站要不要落 ----
rep("""  function triggerWithdraw() {""",
"""  /**
   * 「舰队要不要在这一站落地」的**唯一入口**。
   *
   * 原来 saihojiPhalanx 每帧直接调 `begin(hd)`，而 `begin` 只挡「任务进行中」，
   * 于是任务一走到 done、只要鲸还浮着、方阵还成形，下一帧就又整队空投一批——
   * 主人看到的「重甲兵源源不断赶来」有一半来自这里（另一半是撤离途中受击重装填，
   * 已在 onFleetUnderAttack 里堵掉）。
   *
   * 现在把「首站 / 已扫荡过 / 进行中」三种情况收进一个地方判：
   *   · idle              → 落（首战）
   *   · done + 没扫过首站  → 落（上一轮没打完）
   *   · done + 已扫过首站  → **不再原地重来**，有下一站就开赴下一站，没有就按兵不动
   *   · 其它（进行中）     → 忽略
   */
  function requestStation(hubDir) {
    if (!hubDir) return false;
    if (st.phase !== "idle" && st.phase !== "done") return false;
    if (st.phase === "done" && st.sweptHome) {
      const next = typeof getTourAnchor === "function" ? getTourAnchor() : null;
      if (next && next.lengthSq() > 1e-8) return setupMission(next, true);
      return false;
    }
    return begin(hubDir);
  }

  function triggerWithdraw() {""",
"requestStation")

rep("""    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive, releasePods,""",
"""    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive, releasePods,
    requestStation, enforceOffstage,""",
"导出")

io.open(P, "w", encoding="utf-8").write(s)
print("vanguardAssault.js 已改")

# ============================================================ saihojiPhalanx
P2 = R + "world/saihojiPhalanx.js"
s2 = io.open(P2, encoding="utf-8").read()
old = """      const hd = hubDir(_tmp).clone();
      if (vanguardAssault?.begin) {
        vanguardAssault.begin(hd);
      } else {"""
new = """      const hd = hubDir(_tmp).clone();
      if (vanguardAssault?.requestStation) {
        // 走舰队自己的判断，不再每帧硬 begin：打完苔庭之后它会开赴巡演下一站，
        // 而不是就地再空投一批（主人 2026-09-05）。
        vanguardAssault.requestStation(hd);
      } else if (vanguardAssault?.begin) {
        vanguardAssault.begin(hd);
      } else {"""
assert old in s2, "saihojiPhalanx 触发点未匹配"
s2 = s2.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s2)
print("saihojiPhalanx.js 已改")
