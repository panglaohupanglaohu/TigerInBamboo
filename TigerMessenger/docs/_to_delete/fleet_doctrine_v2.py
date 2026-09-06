# -*- coding: utf-8 -*-
"""主人 2026-09-06（第二轮）：
    「围绕主舰进行战略打击，苔庭只是其中一个战役，一切以主舰为主。不要 missionlock
      只有莫比斯 aircraft 受到攻击才会产生空降」

三条，逐条落到代码上：

  1) **不要 missionLock**。vanguardAssault 从此一个字节都不往主舰身上写。
     上一轮我留了个「驻留请求」（missionLock.hold），想让主舰多等一会儿——
     那仍然是登陆队伸手去动主舰的状态，主人直接否掉了。删干净。
     主舰只按自己的航线飞；它在哪，战场就在哪；它走了，地面部队立刻跟着撤。

  2) **只有主舰挨打才空降**。saihojiPhalanx 每帧调 requestStation 的那条线砍掉——
     那是「重甲兵反复空降」的最后一台发动机，也是把苔庭当成固定战役的根源。
     现在唯一的开局入口是 onFleetUnderAttack：有人打主舰，舰队才落地还击。

  3) **苔庭只是其中一个战役**。开局方向不再回退到 st.homeHub（苔庭），
     一律取主舰当前的地面投影。主舰巡到哪儿挨打，就在哪儿打。

顺带把上一轮欠的 H 做完：泡机的 6 名重甲兵空降到**攻击者附近**（不是中枢的
固定三点），落地即接敌，靠格斗解决。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

def cut(old, why):
    rep(old, "", why)

# ============ 1) 删掉 holdFleetOnStation / releaseFleetHold ============
i = s.index("  /**\n   * 请求主舰在原地多留一会儿")
j = s.index("  /** 这个地方最近打过吗")
s = s[:i] + """  // ⚠️ 这里曾经有 holdFleetOnStation / releaseFleetHold：登陆队往主舰身上写
  //    missionLock.hold，请它「把这次驻留再延长一会儿」。
  //
  //    主人 2026-09-06 明确否掉：「不要 missionlock」。哪怕只是「请求驻留」，
  //    也仍然是地面部队伸手去动主舰的状态——主舰身上同时还有 whaleLock 和
  //    patrol，多一个写者就多一次「下一帧它到底听谁的」。主人反复看到的
  //    「主舰飞走了别人不跟」，根子就在这种多头写。
  //
  //    现在的关系干净了，一句话：**主舰只按自己的航线飞**。
  //      · 它在哪 → 战场就在哪（requestStation 取它的地面投影）；
  //      · 它走了 → fleetLeftStation 立刻把地面部队转入 withdraw 跟着撤。
  //    地面部队对主舰**只读不写**。
  //
  //    代价是一场作战的时长被主舰的驻留时长框住（P.aircraftHoldSec，默认 36s）。
  //    要打得更从容就调那个参数——那是主舰自己的参数，不是一把锁。

""" + s[j:]

# ---- 三处调用点 ----
cut("""
    // 舰队随行：机队锁定在编队正上方，与泡机/气垫艇同步开赴战场
    holdFleetOnStation({ yieldToWhale: true });""", "approach 调用点")
cut("""
    // 舰队随行：离场时机队锁定在编队正上方一起飞——aircraft 飞哪泡机伴哪
    holdFleetOnStation({ yieldToWhale: true });""", "extract 调用点")
rep("""    // ---- 主舰驻留请求（主人 2026-09-06：主舰主导）---------------------------
    // 士兵在地面的整段时间里，只做一件事：请主舰把这次驻留再延长一会儿。
    // 不改它的航向、不挑它的站点——那是主舰自己的事。延长有上限，
    // 主舰终究会走；一走 fleetLeftStation 就把地面部队收回来（下面那段）。
    if (st.phase === "insert" || st.phase === "combat" || st.phase === "withdraw") {
      holdFleetOnStation({ yieldToWhale: true });
    }
    // 每帧跟踪主舰是否停稳""",
"""    // 主人 2026-09-06：**对主舰只读不写**。这里原来每帧发一次驻留请求，
    // 现在一行都没有——主舰的航线是主舰自己的事。
    // 每帧跟踪主舰是否停稳""",
    "update 调用点")

# ---- finishMission 里的两处 ----
rep("""    if (st.hub.lengthSq() > 1e-8) markSwept(st.hub);
    releaseFleetHold();
    releasePods();
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    (fleet?.userData?.members || []).forEach((m) => {
      if (m.userData?.missionLock) m.userData.missionLock.active = false;
    });
""",
"""    if (st.hub.lengthSq() > 1e-8) markSwept(st.hub);
    releasePods();
    // 收队时不需要「解锁主舰」了：从来就没锁过它（主人 2026-09-06「不要 missionlock」）
""",
    "finishMission 解锁")

# ============ 2) requestStation：主舰的位置就是战场，不再对表调用方 ============
rep("""  function requestStation(hubDir) {
    if (!hubDir || hubDir.lengthSq() < 1e-8) return false;
    if (st.phase !== "idle" && st.phase !== "done") return false;

    // ① 主舰在场
    const here = fleetGroundDir(_o3);
    if (!here) return false;

    // ② 主舰就在这儿，而且已经停稳
    _a1.copy(hubDir).normalize();
    if (here.dot(_a1) < SAME_SPOT_DOT) return false;   // 主舰不在这儿 → 不在这儿开打
    // 「停稳」必须当场核对，不能只信 settleT 这个累计值：
    // trackSettle 每帧才更新一次，主舰刚被挪走、update 还没跑的那一瞬间，
    // settleT 仍是上一处累积的大数——照信不误就会在刚飞到的地方立刻空投。
    if (!st.settleDir) return false;
    if (st.settleDir.distanceTo(here) * R > STATION_SETTLE_RADIUS) return false;
    if (st.settleT < STATION_SETTLE_TIME) return false; // 还在飞，没停稳

    // ③ 冷却
    if (recentlySwept(_a1)) return false;

    // 战场取**主舰的地面投影**，不是调用方给的方向：一切以主舰所在为准
    return begin(here.clone());
  }""",
"""  function requestStation() {
    if (st.phase !== "idle" && st.phase !== "done") return false;

    // ① 主舰在场。没机队还空投，等于把人扔进空气里
    const here = fleetGroundDir(_o3);
    if (!here) return false;

    // ② 主舰**停稳了**。这一条是「不空降到主舰屁股后头」的保险：
    // 主舰不再为我们停留（主人否掉了 missionLock），所以只在它自己选择
    // 驻留的时候落地；它正在转场就别扔人下去，落地即被抛下。
    // 「停稳」必须当场核对，不能只信 settleT 这个累计值：
    // trackSettle 每帧才更新一次，主舰刚被挪走、update 还没跑的那一瞬间，
    // settleT 仍是上一处累积的大数——照信不误就会在刚飞到的地方立刻空投。
    if (!st.settleDir) return false;
    if (st.settleDir.distanceTo(here) * R > STATION_SETTLE_RADIUS) return false;
    if (st.settleT < STATION_SETTLE_TIME) return false; // 还在飞，没停稳

    // ③ 这个地方刚打过就别再落一批（「重甲兵反复空降」的最后一道闸）
    if (recentlySwept(here)) return false;

    // 战场 = **主舰的地面投影**，没有第二个来源。
    // 主人 2026-09-06：「苔庭只是其中一个战役，一切以主舰为主」——
    // 所以这里既不看调用方给的方向，也不回退到 st.homeHub（苔庭）。
    return begin(here.clone());
  }""",
    "requestStation")

# ============ 3) onFleetUnderAttack：唯一的开局入口 ============
rep("""  function onFleetUnderAttack(attacker = null, hubDir = null) {""",
"""  function onFleetUnderAttack(attacker = null, _hubDir = null) {""",
    "签名")
rep("""    if (st.retaliateCd > 0) return;
    st.retaliateCd = 3;
    const home = hubDir || st.homeHub;
    // ⚠️ home 必须是有效单位向量：st.hub 未初始化时是 (0,0,0)，用它装填会让整个
    // 任务坐标系退化到原点（艇飞进球心、east/north 全零）——2026-09-05 探针实锤。
    if (!home || home.lengthSq() < 1e-8) {
      console.warn("[assault] 受击警报缺苔庭方向，忽略本次触发");
      return;
    }
    if (st.phase === "idle" || st.phase === "done") {""",
"""    if (st.retaliateCd > 0) return;
    st.retaliateCd = 3;
    // ⚠️ 第二个参数（旧的 hubDir）现在被忽略。主人 2026-09-06：
    // 「苔庭只是其中一个战役，一切以主舰为主」——开局方向只能是主舰的地面投影，
    // 不再回退到 st.homeHub（苔庭）。调用方还在传是为了不破坏既有签名。
    if (st.phase === "idle" || st.phase === "done") {""",
    "开局方向")
rep("""      // 主人 2026-09-06：受击也走 requestStation 那三道闸，不再有第二条开局路径。
      // 旧代码在这儿直接 begin(home) / setupMission(下一站)，红盔每 3 秒放一箭
      // 就能触发一次——这是「重甲兵源源不断」的第二台发动机。
      // 现在主舰不在那儿、或没停稳、或刚打过，就一律不开局；
      // 该还击的由泡机麻醉炮和机队扫描负责，不必每次都投一支登陆队下去。
      requestStation(home);
      return;""",
"""      // 主人 2026-09-06（第二轮）：**这是唯一的开局入口**。
      // 「只有莫比斯 aircraft 受到攻击才会产生空降」——
      // saihojiPhalanx 那条每帧 requestStation 的线已经砍掉，
      // 苔庭不再是「一到就打」的固定战役，它只是主舰航线上的一站。
      // 三道闸仍在（主舰在场 / 停稳 / 冷却），挡住「反复空降」。
      requestStation();
      return;""",
    "唯一入口")

# ============ 4) H：泡机的重甲兵空降到攻击者附近 ============
rep("""    // 三台泡机的索降点：苔庭里横排三处
    st.drops = [-8, 0, 8].map((dx, i) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, i === 1 ? 4 : 0).normalize());""",
"""    // 三台泡机的索降点：**攻击者附近**（主人 2026-09-06）
    st.drops = podDropDirs(east, north);""",
    "drops")

rep("""  /** 这个地方最近打过吗""",
"""  /**
   * 泡机的索降点：**落到攻击者附近**（主人 2026-09-06：
   * 「泡机下来的重甲兵，是 2 制，前后型，突击作战，空降到攻击者附近，
   *   多以格斗解决对手」）。
   *
   * 旧做法是绕中枢横排三个固定点（±8 米），跟敌人在哪毫无关系——
   * 6 名突击兵落地之后还要自己走过去，「突击」两个字就没了。
   * 现在三台泡机围着威胁质心放：左 6 / 正前 / 右 6，正面那台再压近 5 米，
   * 落地就在刀口上，格斗距离（bladeRange=3）一步就到。
   *
   * 没有威胁记录（还没人开火）才退回中枢横排——那是兜底，不是常态。
   */
  function podDropDirs(east, north) {
    const list = liveThreats();
    const aim = list.length ? list : liveTargets();
    if (aim.length) {
      const c = targetsCentroid(aim);
      if (c.lengthSq() > 1e-8) {
        const cd = c.clone().normalize();
        const e = new THREE.Vector3().crossVectors(UP_Y, cd);
        if (e.lengthSq() < 1e-8) e.copy(east); else e.normalize();
        const nn = new THREE.Vector3().crossVectors(cd, e).normalize();
        // 球面偏移铁律：先乘半径再切向平移，最后归一化
        return [-6, 0, 6].map((dx, i) =>
          cd.clone().multiplyScalar(R)
            .addScaledVector(e, dx)
            .addScaledVector(nn, i === 1 ? -5 : 0)
            .normalize());
      }
    }
    return [-8, 0, 8].map((dx, i) =>
      st.hub.clone().multiplyScalar(R)
        .addScaledVector(east, dx).addScaledVector(north, i === 1 ? 4 : 0).normalize());
  }

  /**
   * 进场途中敌人会动。索降前重算一次落点，让「落到攻击者附近」在**落的那一刻**
   * 成立，而不是装填那一刻——装填到索降之间隔着整段 approach。
   */
  function refreshPodDrops() {
    if (st.hub.lengthSq() < 1e-8) return;
    const up = st.hub.clone();
    const east = new THREE.Vector3().crossVectors(UP_Y, up);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();
    st.drops = podDropDirs(east, north);
    st.pods.forEach((p, i) => { p.dropDir = st.drops[i % st.drops.length]; });
  }

  /** 这个地方最近打过吗""",
    "podDropDirs")

rep("""    if (k >= 1) st.phase = "insert";
  }

  // --------------------------------------------------------------- insert --""",
"""    if (k >= 1) {
      // 索降前最后一次对表：敌人在 approach 这一路上是会动的
      refreshPodDrops();
      st.phase = "insert";
    }
  }

  // --------------------------------------------------------------- insert --""",
    "approach→insert 重算落点")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（不要 missionLock · 受击才空降 · 落到攻击者附近）")
