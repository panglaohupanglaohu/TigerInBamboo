# -*- coding: utf-8 -*-
"""三台泡机停在原地不动：任务把它们从僚机翼摘走后没还回去。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/")

P = R + "world/vanguardAssault.js"
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- ① 翼引用要稳
rep("""    const pods = (typeof getPods === "function" ? getPods() : []).slice(0, VANGUARD_ASSAULT.pods);
    st.escortWing = pods[0]?.parent && pods[0].parent !== scene ? pods[0].parent : null;""",
"""    const pods = (typeof getPods === "function" ? getPods() : []).slice(0, VANGUARD_ASSAULT.pods);
    // 僚机翼引用必须**稳**：优先直接问机队要，其次看泡机现在挂在谁下面，
    // 最后沿用上一轮记下的。原来只有第二种——上一轮任务没走完、泡机还留在
    // scene 下时，这一轮就会记成 null，从此再也还不回去，三台泡机永久失联。
    const fleetWing = (typeof getFleet === "function" ? getFleet() : null)
      ?.userData?.gatePodEscort || null;
    st.escortWing = fleetWing
      || (pods[0]?.parent && pods[0].parent !== scene ? pods[0].parent : null)
      || st.escortWing;""",
"翼引用")

# ---------------------------------------------------------------- ② releasePods
rep("""  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */""",
"""  /**
   * 把泡机交还护航编队（幂等，可以每帧调）。
   *
   * `setupMission` 会 `scene.attach(pod)` 把三台泡机从僚机翼里摘出来自己开，
   * 而只有 `updateExtract` 一路走到最后才还回去。任务只要没走完就被打断
   * ——撤离途中挨箭重装填、机队提前飞走、场景切换——泡机就永远留在 scene 下。
   * `updateGatePodEscort` 只遍历 `wing.children`，看不见它们，于是三台泡机
   * 停在最后一次任务的位置一动不动（主人 2026-09-05 截屏：
   * 「让这三个 GatePodCraft 别一直停在哪里，也去伴飞吧」）。
   *
   * 所以还翼这件事不能只写在 extract 的末尾那一个出口上，得每帧兜底。
   */
  function releasePods() {
    if (!st.escortWing) return;
    for (const p of st.pods) {
      const pod = p?.pod;
      if (pod?.parent && pod.parent !== st.escortWing) st.escortWing.attach(pod);
    }
  }

  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */""",
"releasePods")

# ---------------------------------------------------------------- ③ 每帧兜底
rep("""    st.t = t;
    const onMission = st.phase !== "idle" && st.phase !== "done";""",
"""    st.t = t;
    const onMission = st.phase !== "idle" && st.phase !== "done";
    // 不在任务中 → 泡机必须回到僚机翼去伴飞，一帧都不许滞留在 scene 下
    if (!onMission) releasePods();""",
"每帧兜底")

# ---------------------------------------------------------------- ④ extract 出口复用
rep("""      st.pods.forEach((p) => {
        if (p.pod?.parent && st.escortWing && p.pod.parent !== st.escortWing) {
          st.escortWing.attach(p.pod);
        }
      });""",
"""      releasePods();""",
"extract 出口")

# ---------------------------------------------------------------- ⑤ 导出
rep("""    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive,
    sweptHome: () => st.sweptHome,""",
"""    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive, releasePods,
    sweptHome: () => st.sweptHome,""",
"导出")

io.open(P, "w", encoding="utf-8").write(s)
print("vanguardAssault.js 已改")

# ---------------------------------------------------------------- updateIsland 兜底
P2 = R + "scenes/messenger/updateIsland.js"
s2 = io.open(P2, encoding="utf-8").read()
old = """  const podsOnMission = s.vanguardAssault?.controlsPods?.() ?? false;
  if (!podsOnMission) updateGatePodEscort(s.aircraftSquad, t);"""
new = """  const podsOnMission = s.vanguardAssault?.controlsPods?.() ?? false;
  if (!podsOnMission) {
    // 双保险：任务半途夭折时泡机可能还挂在 scene 下，`updateGatePodEscort`
    // 只遍历 wing.children 看不见它们，会让三台泡机停在原地不动。
    s.vanguardAssault?.releasePods?.();
    updateGatePodEscort(s.aircraftSquad, t);
  }"""
assert old in s2, "updateIsland 未匹配"
s2 = s2.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s2)
print("updateIsland.js 已改")
