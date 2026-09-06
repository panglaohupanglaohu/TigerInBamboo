# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

old = """  function releasePods() {
    if (!st.escortWing) return;
    for (const p of st.pods) {
      const pod = p?.pod;
      if (pod?.parent && pod.parent !== st.escortWing) st.escortWing.attach(pod);
    }
  }"""
new = """  function releasePods() {
    const wing = (typeof getFleet === "function" ? getFleet() : null)
      ?.userData?.gatePodEscort || st.escortWing;
    if (!wing) return;
    for (const p of st.pods) {
      const pod = p?.pod;
      if (pod?.parent && pod.parent !== wing) wing.attach(pod);
    }
    // 再扫一遍场景：只认 st.pods 是不够的——上一轮任务可能根本没把泡机记进
    // st.pods（getPods() 那一刻返回空），或者中途换过机队引用，那些泡机就会
    // 一直挂在 scene 下、`updateGatePodEscort` 只遍历 wing.children 看不见它们，
    // 于是永远停在原地不伴飞（主人 2026-09-05 两次点名）。
    // 认得出泡机的唯一凭据是 `userData.escortSlot`（mountGatePodEscort 打的）。
    if (scene) {
      const strays = [];
      for (const child of scene.children) {
        if (child?.userData?.escortSlot && child !== wing) strays.push(child);
      }
      for (const pod of strays) wing.attach(pod);
    }
  }"""
assert old in s, "releasePods 未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("releasePods 加了场景兜底扫描")
