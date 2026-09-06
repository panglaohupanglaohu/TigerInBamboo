# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

rep("""    sweptHome: false, // 首站是否已经打完一轮（打完就别再原地空投第二批）""",
"""    sweptHome: false, // 首站是否已经打完一轮（打完就别再原地空投第二批）
    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）""",
"sawFleet")

rep("""    // 机队真的没了（被移出场景）：地面部队不许留在原地当活靶，立刻收队跟走
    if (onMission && !fleetAlive() && st.phase !== "withdraw" && st.phase !== "extract") {
      st.phase = "withdraw";
    }""",
"""    // 机队真的没了（被移出场景）：地面部队不许留在原地当活靶，立刻收队跟走。
    // ⚠️ 必须先「见过」机队才算数——测试与无机队的桩场景根本不传 getFleet，
    // 一上来就判定「机队没了」会让任务在 approach 段直接 withdraw。
    if (onMission) {
      if (fleetAlive()) st.sawFleet = true;
      else if (st.sawFleet && st.phase !== "withdraw" && st.phase !== "extract") {
        st.phase = "withdraw";
      }
    }""",
"guard 收紧")

rep("""  function setupMission(centerDir, isTour = false) {
    st.isTour = isTour;""",
"""  function setupMission(centerDir, isTour = false) {
    st.isTour = isTour;
    st.sawFleet = false;""",
"重置 sawFleet")

io.open(P, "w", encoding="utf-8").write(s)
print("ok")
