# -*- coding: utf-8 -*-
"""B②：把三处调用、开局闸门、巡演传送口接到「主舰主导」上。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 三处调用 ----------------
rep("    updateFleetLock(_a1, seaR + SOCCO.skimHeight + 2.5 + 16);",
    "    holdFleetOnStation({ yieldToWhale: true });",
    "approach 调用")

rep("    updateFleetLock(_a1, seaR + SOCCO.skimHeight + 16);",
    "    holdFleetOnStation({ yieldToWhale: true });",
    "extract 调用")

rep("""    // ---- 舰队是一个整体（主人 2026-09-05）---------------------------------
    // 原来只有 approach 与 extract 两段调 updateFleetLock，insert / combat /
    // withdraw 三段不锁。这三段恰好是整场战斗，机队于是掉回 whaleLock 或巡逻
    // 航线自己管自己：苔庭鲸的故事一落幕，aircraft 就爬升归队飞走，把伴飞泡机、
    // 气垫运输艇、地面上的重甲兵整支登陆队撂在原地——主人看到的
    // 「莫比斯 aircraft 被打走了，为啥泡机 + 运输艇不跟着飞走」就是这一段空档。
    // 现在只要地面部队还在场，机队就钉在编队正上方，走要一起走。
    if (st.phase === "insert" || st.phase === "combat" || st.phase === "withdraw") {
      _fleetDir.copy(st.anchor.lengthSq() > 1e-8 ? st.anchor : st.hub);
      if (_fleetDir.lengthSq() > 1e-8) {
        _fleetDir.normalize();
        updateFleetLock(_fleetDir, Math.max(st.baseRadius, R) + FLEET_COMBAT_UP,
          { yieldToWhale: true });
      }
    }""",
"""    // ---- 主舰驻留请求（主人 2026-09-06：主舰主导）---------------------------
    // 士兵在地面的整段时间里，只做一件事：请主舰把这次驻留再延长一会儿。
    // 不改它的航向、不挑它的站点——那是主舰自己的事。延长有上限，
    // 主舰终究会走；一走 fleetLeftStation 就把地面部队收回来（下面那段）。
    if (st.phase === "insert" || st.phase === "combat" || st.phase === "withdraw") {
      holdFleetOnStation({ yieldToWhale: true });
    }
    // 每帧跟踪主舰是否停稳——开局闸门要用，非任务期也要连续记
    trackSettle(dt);""",
    "update 内锁块")

# ---------------- 巡演传送口拆掉 ----------------
rep("""      // 巡演循环：还有下一站（湖沼）→ 整队再装填，直接开赴下一站；否则收队
      const tourAnchor = (typeof getTourAnchor === "function" ? getTourAnchor() : null);
      if (VANGUARD_ASSAULT.tour.enabled && tourAnchor) {
        setupMission(tourAnchor, true);
        return;
      }
      // 任务结束：泡机归队（世界变换保留，escort update 下帧接管）；机队解锁回航线
      finishMission();""",
"""      // 任务结束。
      //
      // 这里原来有一个「巡演传送口」：extract 一走完就 setupMission(下一站)，
      // 把整支登陆队连同主舰一起挪到下一个景点。那是主人 2026-09-06 明确否掉的
      // 反向指挥——而且它是「重甲兵反复空降」的主发动机：站点之间没有停顿，
      // 一站打完下一站立刻空投，多数站点又没有敌人（getTourTargets 为空），
      // 于是落地→没敌人→撤离→再落，无限循环。
      //
      // 现在扫荡由主舰自己的航线完成：主舰飞到哪、在哪驻留，登陆队就在哪开局。
      finishMission();""",
    "巡演传送口")

# ---------------- finishMission：放开驻留 + 记冷却 ----------------
rep("""  function finishMission() {
    releasePods();""",
"""  function finishMission() {
    // 这个地方打过了：记一笔冷却，冷却期内不再开局。
    // 没有这条，主舰还停在原地时下一帧就能再空投一批——「重甲兵源源不断」。
    if (st.hub.lengthSq() > 1e-8) markSwept(st.hub);
    releaseFleetHold();
    releasePods();""",
    "finishMission")

# ---------------- requestStation：三道闸 ----------------
rep("""  function requestStation(hubDir) {
    if (!hubDir) return false;
    if (st.phase !== "idle" && st.phase !== "done") return false;
    if (st.phase === "done" && st.sweptHome) {
      const next = typeof getTourAnchor === "function" ? getTourAnchor() : null;
      if (next && next.lengthSq() > 1e-8) return setupMission(next, true);
      return false;
    }
    return begin(hubDir);
  }""",
"""  /**
   * 「要不要在这儿落」的唯一入口。saihojiPhalanx 每帧都会问一次。
   *
   * 主人 2026-09-06「主舰主导」之后，这里要过三道闸——三道都是为了根治
   * 「重甲兵反复空降」，而且每一道对应一个曾经真实发生过的故障：
   *
   *   ① 主舰得在场。没机队还空投，等于把人扔进空气里。
   *   ② 主舰得**就在这儿**、而且**停稳了**。旧代码拿调用方给的方向直接开局，
   *      主舰在不在那儿根本不问——于是登陆队先落地，再用 missionLock 把主舰
   *      拽过来。现在反过来：主舰停在哪，战场才在哪。
   *   ③ 这个地方最近没打过。旧代码 done 的下一帧就能再开一局，
   *      而 saihojiPhalanx 是**每帧**调这个函数的——一秒钟能开六十次。
   *
   * @param {THREE.Vector3} hubDir 调用方认为「这儿有敌人」的方向
   * @returns {boolean} 是否开局
   */
  function requestStation(hubDir) {
    if (!hubDir || hubDir.lengthSq() < 1e-8) return false;
    if (st.phase !== "idle" && st.phase !== "done") return false;

    // ① 主舰在场
    const here = fleetGroundDir(_o3);
    if (!here) return false;

    // ② 主舰就在这儿，而且已经停稳
    _a1.copy(hubDir).normalize();
    if (here.dot(_a1) < SAME_SPOT_DOT) return false;   // 主舰不在这儿 → 不在这儿开打
    if (st.settleT < STATION_SETTLE_TIME) return false; // 还在飞，没停稳

    // ③ 冷却
    if (recentlySwept(_a1)) return false;

    // 战场取**主舰的地面投影**，不是调用方给的方向：一切以主舰所在为准
    return begin(here.clone());
  }""",
    "requestStation")

# ---------------- onFleetUnderAttack：idle/done 走同一道闸 ----------------
rep("""      const nextStop = st.sweptHome && typeof getTourAnchor === "function"
        ? getTourAnchor()
        : null;
      if (nextStop && nextStop.lengthSq() > 1e-8) setupMission(nextStop, true);
      else begin(home);
      return;""",
"""      // 主人 2026-09-06：受击也走 requestStation 那三道闸，不再有第二条开局路径。
      // 旧代码在这儿直接 begin(home) / setupMission(下一站)，红盔每 3 秒放一箭
      // 就能触发一次——这是「重甲兵源源不断」的第二台发动机。
      // 现在主舰不在那儿、或没停稳、或刚打过，就一律不开局；
      // 该还击的由泡机麻醉炮和机队扫描负责，不必每次都投一支登陆队下去。
      requestStation(home);
      return;""",
    "受击开局")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（B②）")
