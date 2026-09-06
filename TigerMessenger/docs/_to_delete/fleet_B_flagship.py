# -*- coding: utf-8 -*-
"""B：主舰主导。战场由主舰所在决定，登陆队不再把主舰拽着走。

旧模型是反的：vanguardAssault 自己挑站点，再用 missionLock 把主舰**钉**过去
（updateFleetLock 每帧写 ml.hubDir）。于是同一架飞机上坐着三个人在开——
missionLock、whaleLock、patrol 互相抢方向盘。主人反复看到的「主舰飞走了别人
不跟」不是谁忘了跟随，是两个权威在打架。

新模型：
  · 主舰按自己的航线飞（patrol：城 ↔ 店，两端各驻留 aircraftHoldSec 秒）；
  · 登陆队**只在主舰驻留时**、**就在主舰正下方**开局；
  · 士兵在地面期间，登陆队只请求主舰「把这次驻留延长一会儿」（冻结驻留计时），
    绝不改它的航向；延长有上限，主舰永远能走；
  · 主舰一走，地面部队立刻收队跟走（fleetLeftStation → withdraw，已有）。

顺带根治「重甲兵反复空降」：旧代码里 saihojiPhalanx 每帧调 requestStation，
任务一进 done 下一帧就 setupMission(下一站)，中间没有停留、没有等主舰到位；
而多数站点 getTourTargets() 是空的 → 落地、没敌人、撤离、再落下一站，无限循环。
现在开局要过三道闸：主舰在场 → 主舰驻留够久 → 这个地方最近没打过。
"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 多处匹配：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ==================================================== ① 主舰：驻留可被请求延长
edit("TigerMessenger/src/assets/moebiusAircraft.js", [
("""    st.u += dt / (st.seg === 1 || st.seg === 3 ? Math.max(hold, 0.001) : legTime);""",
 """    // 舰队驻留请求（主人 2026-09-06：主舰主导）。地面部队在下面打的时候，
    // 登陆队会把 missionLock.hold 置起来，请求主舰**把这次驻留延长**——
    // 注意是延长驻留，不是改航向：主舰停在哪一直是主舰自己的事。
    //
    // 旧做法是登陆队直接写 missionLock.hubDir 把主舰拽到它挑的站点上空，
    // 那等于第二个人来抢方向盘，whaleLock / patrol 全被压住。
    //
    // 延长有上限（holdExtendMax）：无论下面打成什么样，主舰终究能走，
    // 走了地面部队就跟着撤——这才是「舰队围绕主舰」。
    const holdSeg = st.seg === 1 || st.seg === 3;
    const mlHold = aircraft.userData.missionLock;
    if (holdSeg && mlHold?.hold) {
      mlHold._holdT = (mlHold._holdT || 0) + dt;
      if (mlHold._holdT < (mlHold.holdExtendMax ?? 120)) {
        // 冻结驻留计时：这一帧不推进 st.u，主舰原地待命
        patrolMoving = true;
        aircraft.userData._patrolCenter = formationCenter.clone();
      } else {
        st.u += dt / Math.max(hold, 0.001);
      }
    } else {
      if (mlHold && !holdSeg) mlHold._holdT = 0;
      st.u += dt / (st.seg === 1 || st.seg === 3 ? Math.max(hold, 0.001) : legTime);
    }""",
 "驻留延长"),
])

# ==================================================== ② 登陆队：改成读主舰
edit("TigerMessenger/src/world/vanguardAssault.js", [

# ---- 常量
("""const FLEET_ABANDON_DIST = 220;""",
 """const FLEET_ABANDON_DIST = 220;
/** 主舰「停稳」判据：地面投影在这个半径内待满 STATION_SETTLE_TIME 秒 */
const STATION_SETTLE_RADIUS = 26;
const STATION_SETTLE_TIME = 3.0;
/** 同一个地方打完之后的冷却（秒）：期内不再开局，根治反复空降 */
const STATION_COOLDOWN = 150;
/** 「同一个地方」的判据：地面投影方向点积 */
const SAME_SPOT_DOT = 0.985;
/** 士兵在地面时最多能请求主舰延长驻留多久（秒） */
const HOLD_EXTEND_MAX = 120;""",
 "常量"),

# ---- st 字段
("""    lastPhase: "idle", // 看门狗：上一帧的阶段
    phaseT: 0,         // 看门狗：当前阶段已停留多久（秒）""",
 """    lastPhase: "idle", // 看门狗：上一帧的阶段
    phaseT: 0,         // 看门狗：当前阶段已停留多久（秒）
    // 主舰驻留跟踪（主人 2026-09-06「主舰主导」）：只有主舰在一个地方停稳了，
    // 才允许开局——否则就是往空气里空投，也就是反复空降的来源。
    settleDir: null,   // 主舰地面投影的驻留中心
    settleT: 0,        // 已经在这个中心附近待了多久
    sweptSpots: [],    // [{dir, t}] 最近打过的地方，冷却期内不再开局""",
 "st 字段"),

# ---- updateFleetLock → holdFleetOnStation
("""  function updateFleetLock(centerDir, hoverRadius, { yieldToWhale = false } = {}) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];""",
 """  /**
   * 主舰地面投影（编队中心 → 球面方向）。「战场在哪」的唯一依据。
   * @returns {THREE.Vector3|null} 单位向量；没有机队时 null
   */
  function fleetGroundDir(out = new THREE.Vector3()) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) return null;
    out.set(0, 0, 0);
    for (const m of members) out.add(m.getWorldPosition(_o4));
    out.multiplyScalar(1 / members.length);
    if (out.lengthSq() < 1e-8) return null;
    return out.normalize();
  }

  /**
   * 请求主舰在原地多留一会儿——**只请求驻留，不改航向**。
   *
   * 旧的 updateFleetLock 每帧写 `ml.hubDir = 我们挑的站点`，等于把主舰拽过来。
   * 主舰身上同时还有 whaleLock（鲸的故事线）和 patrol（自己的航线），
   * 三个权威抢一个方向盘，谁也说不清下一帧它听谁的。
   *
   * 现在只置 hold 标志：主舰的 patrol 在驻留段看到它就不推进计时，停在原处；
   * 航向、站点、什么时候走，全是主舰自己的事。延长有上限，它终究会走，
   * 走了 fleetLeftStation 就会把地面部队收回来。
   */
  function holdFleetOnStation({ yieldToWhale = false } = {}) {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = fleet?.userData?.members || [];""",
 "holdFleetOnStation 头"),

("""    for (const m of members) {
      if (!m.userData.missionLock) {
        m.userData.missionLock = { active: true, blend: 1, az0: vaHash(m.userData.uid ?? 0, 3) * Math.PI * 2 };
      }
      const ml = m.userData.missionLock;
      ml.active = true;
      if (!(ml.hubDir instanceof THREE.Vector3)) ml.hubDir = new THREE.Vector3();
      ml.hubDir.copy(centerDir);
      ml.hoverRadius = hoverRadius;
      ml.blend = 1; // 已随队形态，不重复过渡
    }
  }""",
 """    for (const m of members) {
      if (!m.userData.missionLock) m.userData.missionLock = {};
      const ml = m.userData.missionLock;
      ml.hold = true;
      ml.holdExtendMax = HOLD_EXTEND_MAX;
      // ⚠️ 绝不写 hubDir / hoverRadius / active：那三样一写，
      // moebiusAircraft 的 missionLockActive 就会成立并压住 whaleLock 与 patrol，
      // 主舰立刻变成被登陆队开的飞机。这里要的只是「原地多待一会儿」。
      ml.active = false;
      ml.hubDir = null;
    }
  }

  /** 放开驻留请求：主舰恢复自己的航线节奏 */
  function releaseFleetHold() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    for (const m of fleet?.userData?.members || []) {
      const ml = m.userData?.missionLock;
      if (ml) { ml.hold = false; ml._holdT = 0; ml.active = false; }
    }
  }

  /** 这个地方最近打过吗（冷却期内不再开局） */
  function recentlySwept(dir) {
    for (const s of st.sweptSpots) {
      if (st.t - s.t < STATION_COOLDOWN && s.dir.dot(dir) > SAME_SPOT_DOT) return true;
    }
    return false;
  }

  /** 记一笔「这里打过了」，并淘汰过期条目 */
  function markSwept(dir) {
    st.sweptSpots = st.sweptSpots.filter((s) => st.t - s.t < STATION_COOLDOWN * 2);
    st.sweptSpots.push({ dir: dir.clone(), t: st.t });
  }

  /**
   * 每帧跟踪主舰是否「停稳」。停稳 = 地面投影在 STATION_SETTLE_RADIUS 米内
   * 连续待满 STATION_SETTLE_TIME 秒。主舰的 patrol 在两端各驻留
   * aircraftHoldSec（默认 36s），那就是它自己挑好的战场。
   */
  function trackSettle(dt) {
    const dir = fleetGroundDir(_o3);
    if (!dir) { st.settleDir = null; st.settleT = 0; return; }
    if (!st.settleDir) { st.settleDir = dir.clone(); st.settleT = 0; return; }
    const drift = st.settleDir.distanceTo(dir) * R;
    if (drift > STATION_SETTLE_RADIUS) {
      st.settleDir.copy(dir);
      st.settleT = 0;
    } else {
      st.settleT += dt;
    }
  }""",
 "holdFleetOnStation 体 + 驻留跟踪"),
])
print("B① 完成")
