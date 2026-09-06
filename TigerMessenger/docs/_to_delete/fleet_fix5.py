# -*- coding: utf-8 -*-
"""撤离途中挨箭不许掉头重来；机队飞远了就跟着走；撤离有兜底超时。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- ① 同地不重装填
rep("""    // ⚠️ 苔庭任务进行中（approach/insert/combat，非巡演）：**已经在开战**，
    // 绝不重置——否则进场上空的箭会每 3 秒打断一次装填，任务永远进不了 combat。
    if (st.isTour || st.phase === "withdraw" || st.phase === "extract") {
      // 巡演站/撤离途中受击：中断当前动作，全军回防苔庭
      setupMission(home, false);
    }""",
"""    // ⚠️ 苔庭任务进行中（approach/insert/combat，非巡演）：**已经在开战**，
    // 绝不重置——否则进场上空的箭会每 3 秒打断一次装填，任务永远进不了 combat。
    //
    // ⚠️⚠️ 更要命的一条（主人 2026-09-05 第二张截屏）：**已经在这个地方了就别重装填**。
    // 原来 `withdraw` / `extract` 期间挨一箭就 `setupMission(home)`，可红盔本来就
    // 会一直朝天上放箭——于是每 3 秒把整支登陆队弹回进场起点重来一遍，
    // 运输艇一波接一波开进来，永远撤不走。撤离途中挨箭是常态，不是意外。
    const sameSpot = st.hub.lengthSq() > 1e-8 && st.hub.dot(home) > 0.995;
    if (sameSpot) return;
    if (st.isTour) {
      // 只有**人在别处**（巡演站）时挨打才值得中断当前动作、回防这一站
      setupMission(home, false);
    }""",
"同地不重装填")

# ---------------------------------------------------------------- ② 机队飞远就跟着走
rep("""  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */
  function fleetAlive() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    if (!fleet?.parent) return false;
    return (fleet.userData?.members || []).some((m) => m?.parent);
  }""",
"""  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */
  function fleetAlive() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    if (!fleet?.parent) return false;
    return (fleet.userData?.members || []).some((m) => m?.parent);
  }

  /**
   * 机队是否已经飞离本站（主人 2026-09-05：「莫比斯 aircraft 都飞走了，
   * GatePodCraft 和 gateHaulerCraft 及重甲兵为啥还源源不断到来，
   * 而不是尾随莫比斯 aircraft 走开」）。
   *
   * 光靠 missionLock 锁不住所有情况：苔庭鲸对抗期机队归 whaleLock 管，
   * 那条故事线可以把机队「打走」（moebiusAircraft 的 depart）。所以这里不猜
   * 状态机，直接量距离——机队中心离作战锚点超过 FLEET_ABANDON_DIST 就是走了。
   */
  function fleetLeftStation() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) return false;   // 没机队可跟，别误判
    if (st.hub.lengthSq() < 1e-8) return false;
    _o1.set(0, 0, 0);
    for (const m of members) _o1.add(m.getWorldPosition(_fleetDir));
    _o1.multiplyScalar(1 / members.length);
    _fleetDir.copy(st.anchor.lengthSq() > 1e-8 ? st.anchor : st.hub)
      .normalize().multiplyScalar(Math.max(st.baseRadius, R));
    return _o1.distanceTo(_fleetDir) > FLEET_ABANDON_DIST;
  }""",
"fleetLeftStation")

rep("""const FLEET_COMBAT_UP = 34; // = VANGUARD_ASSAULT.combatHoverUp（模块级常量，热路径不查表）""",
"""const FLEET_COMBAT_UP = 34; // = VANGUARD_ASSAULT.combatHoverUp（模块级常量，热路径不查表）
/** 机队中心离作战锚点超过这个距离（米）就判定为「已飞离本站」，地面部队跟着撤 */
const FLEET_ABANDON_DIST = 220;""",
"FLEET_ABANDON_DIST")

rep("""    if (onMission) {
      if (fleetAlive()) st.sawFleet = true;
      else if (st.sawFleet && st.phase !== "withdraw" && st.phase !== "extract") {
        st.phase = "withdraw";
      }
    }""",
"""    if (onMission) {
      if (fleetAlive()) st.sawFleet = true;
      const stranded = st.sawFleet && (!fleetAlive() || fleetLeftStation());
      if (stranded && st.phase !== "withdraw" && st.phase !== "extract") {
        // 机队走了 → 登陆队立刻收队尾随，绝不留在原地继续打
        st.phase = "withdraw";
      }
    }""",
"跟着走")

# ---------------------------------------------------------------- ③ 撤离兜底超时
rep("""    combatT: 0,
    extractArc: 0,""",
"""    combatT: 0,
    withdrawT: 0,  // 撤离兜底计时：有人卡住也不许把整支队困死在滩头
    extractArc: 0,""",
"withdrawT 字段")

rep("""  function updateWithdraw(dt) {""",
"""  function updateWithdraw(dt) {
    st.withdrawT += dt;""",
"withdrawT 累加")

rep("""    if (allAboard && rampsReady) {""",
"""    // 兜底：撤离超时就强制收队。地面上有一个人卡住（走不到跳板/被挤在坡沿）
    // 就能把整支队钉死在滩头，而红盔的箭不会停——那正是「撤不走」的另一种形态。
    if (!allAboard && st.withdrawT > VANGUARD_ASSAULT.withdrawTimeout) {
      for (const tr of aliveTroopers()) {
        if (tr.userData.aboard) continue;
        tr.userData.aboard = true;
        tr.visible = false;
      }
      allAboard = true;
    }
    if (allAboard && rampsReady) {""",
"撤离超时")

rep("""  maxCombatTime: 90,""",
"""  maxCombatTime: 90,
  /** 撤离兜底超时（秒）：超时强制收队，防一个人卡住钉死整支队 */
  withdrawTimeout: 45,""",
"withdrawTimeout 常量")

# setupMission 里复位
rep("""    st.isTour = isTour;
    st.sawFleet = false;""",
"""    st.isTour = isTour;
    st.sawFleet = false;
    st.withdrawT = 0;""",
"复位 withdrawT")

io.open(P, "w", encoding="utf-8").write(s)
print("ok")
