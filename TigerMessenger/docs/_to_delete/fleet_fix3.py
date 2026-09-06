# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

rep("""    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    st.tranq.pool.push(m);""",
"""    m.name = `tranq-dart-${i}`; // 命名不是装饰：测试与调试要认得出在飞的弹丸
    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    st.tranq.pool.push(m);""",
"弹丸命名")

rep("""      const shooters = onMission
        ? st.pods.filter((p) => p.state !== "form" && p.state !== "move" && p.pod?.parent)
          .map((p) => p.pod)
        : ((typeof getPods === "function" ? getPods() : []) || []).filter((p) => p?.parent);
      // 巡航期泡机挂在机队编队里，离地面比悬停时远得多，射程口径要放宽
      const range = onMission ? 40 : 140;""",
"""      // 泡机只要在场就能开火——**不再要求它先飞到悬停位**。
      // 原来的 `state !== form/move` 过滤把整个 approach 段排除在外，
      // 于是「护送进场的一路上三台泡机一炮不发」，正是主人截屏里的样子。
      const shooters = onMission
        ? st.pods.filter((p) => p.pod?.parent).map((p) => p.pod)
        : ((typeof getPods === "function" ? getPods() : []) || []).filter((p) => p?.parent);
      // 射程按泡机离地远近分档：悬停/作战时贴得近，进场与巡航时高得多
      const range = (st.phase === "insert" || st.phase === "combat") ? 60 : 140;""",
"放开射手")

io.open(P, "w", encoding="utf-8").write(s)
print("ok")
