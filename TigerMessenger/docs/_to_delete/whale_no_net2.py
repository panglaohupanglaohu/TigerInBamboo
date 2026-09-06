# -*- coding: utf-8 -*-
"""去网（第二段）：苔庭方阵这一侧改成「把拔河拉力喂给鲸」。

原来是绳索挂上 6 秒后「撒网」，网住了才动嘴。现在没有网了——
拉扯的来源就是绳索小队自己，拉力现成地汇总在 root.userData.ropePull01。
每帧把它喂进去：拉得越狠，鲸挣得越凶；被拽到一定程度才张嘴还击。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/saihojiPhalanx.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""  /** 撒网的时机：绳索小队已经挂上、鲸又挣了一会儿，红盔才把渔网罩上来 */
  let netDelay = 0;
  /** 开吞的节流：由 whaleMaw 自己的冷却兜底，这里只是别每帧敲门 */
  let mawPoke = 0;""",
"""  /** 开吞的节流：由 whaleMaw 自己的冷却兜底，这里只是别每帧敲门 */
  let mawPoke = 0;""",
    "去掉 netDelay")

rep("""    {
      // 撒网：绳索已经挂上、拔河进行了一会儿，红盔才把渔网罩上去。
      // 鲸落地（whaleUp 转 false）就收网——躺在地上的鲸不需要再网。
      if (whaleUp && ropesDispatched) {
        netDelay += dt;
        if (netDelay > 6 && !whaleMaw.isNetted()) whaleMaw.castNet();
      } else {
        netDelay = 0;
        if (whaleMaw.isNetted()) whaleMaw.releaseNet();
      }
      // 开吞：网住之后才动嘴——先被激怒，再还手，读起来才有因果。
      // 够不够得着由 whaleMaw 自己判断（嘴前方 + 射程内），这里只定节奏。
      mawPoke -= dt;
      if (whaleMaw.isNetted() && mawPoke <= 0) {
        mawPoke = 2.0;
        whaleMaw.swallow();
      }
      whaleMaw.update(dt, t);
    }""",
"""    {
      // 拉扯：**拉力就是绳索小队自己的拔河**（主人 2026-09-06：
      // 「不必出现网，有那种被拉扯挣脱的感觉即可」）。
      // ropePull01 是四队拉力的归一化汇总，本来就在算，直接喂进去——
      // 拉得越狠鲸挣得越凶，绳一松就平息，因果是现成的，不用再造道具。
      const pull = whaleUp ? (root.userData.ropePull01 || 0) : 0;
      whaleMaw.setTug(pull);
      // 开吞：被拽到一定程度才动嘴——先被激怒，再还手，读起来才有因果。
      // 够不够得着由 whaleMaw 自己判断（嘴前方 + 射程内），这里只定节奏。
      mawPoke -= dt;
      if (pull > 0.35 && mawPoke <= 0) {
        mawPoke = 2.0;
        whaleMaw.swallow();
      }
      whaleMaw.update(dt, t);
    }""",
    "喂拉力")

io.open(P, "w", encoding="utf-8").write(s)
print("patched saihojiPhalanx.js（拔河拉力 → 鲸的挣扎）")
