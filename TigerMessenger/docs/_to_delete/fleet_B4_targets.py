# -*- coding: utf-8 -*-
"""B④：目标池合一 —— 「一次打击，解决地面所有问题」。

旧代码把战斗分成两种口味：苔庭站打红盔（getDefenders），巡演站打野生生物
（getTourTargets），由 st.isTour 切换。这个开关是「谁把任务开起来的」的副产品，
不是「地上有什么」的判断——同一片地上如果既有红盔又有野兽，总有一半打不着。

主人 2026-09-06：「目标完成一次打击，解决地面所有问题」。所以目标池合一：
守军 ∪ 巡演目标，谁在这儿谁就是目标。isTour 这个开关随之整个拆掉——
巡演本身已经改由主舰的航线承担（见 B②）。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- liveTargets 合一 ----------------
rep("""    if (st.isTour) {
      const list = (typeof getTourTargets === "function" ? getTourTargets() : []) || [];
      return list.filter((s) => s?.parent && !s.userData?.dead && !s.userData?.downed);
    }
    return liveDefenders();""",
"""    // 目标池合一（主人 2026-09-06：「一次打击，解决地面所有问题」）：
    // 守军（红盔）∪ 战场生物。旧代码按 st.isTour 二选一，那个开关取决于
    // 「谁把这次任务开起来的」，而不是「地上到底有什么」——同一片地上
    // 既有红盔又有野兽时，总有一半打不着。
    const out = [];
    const seen = new Set();
    const push = (list) => {
      for (const s of list || []) {
        if (!s?.parent || s.userData?.dead || s.userData?.downed) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
      }
    };
    push(liveDefenders());
    push(typeof getTourTargets === "function" ? getTourTargets() : []);
    return out;""",
    "liveTargets")

# ---------------- updateCombat 去 isTour ----------------
rep("""    const threats = st.isTour ? [] : liveThreats();
    const aim = threats.length ? threats : targets;
    const c = aim.length ? targetsCentroid(aim) : null;
    // 苔庭：无守军立即撤；巡演站：无目标也驻留（降落—警戒—到点离开，不鬼畜拔营）
    if (!c && !st.isTour) { st.phase = "withdraw"; return; }
    let near = 0;
    if (c && !st.isTour) {
      _a1.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
      const ds = (typeof getDefenders === "function" ? getDefenders() : []) || [];
      for (const s of ds) {
        if (!s?.parent || s.userData?.dead) continue;
        if (s.getWorldPosition(_a2).distanceTo(_a1) <= VANGUARD_ASSAULT.withdrawRadius) near++;
      }
    }
    const fighters = aliveTroopers().filter((tr) => !tr.userData.vehicleGuard).length;
    // 撤离判定：苔庭按守军清空/超时/折损；巡演站按停留时长（到点全体上艇去下一站）
    const timeUp = st.isTour
      ? st.combatT >= VANGUARD_ASSAULT.tour.holdTime
      : st.combatT > VANGUARD_ASSAULT.maxCombatTime;
    if ((!st.isTour && near <= VANGUARD_ASSAULT.withdrawDefenders) || timeUp ||
        fighters <= 10) {""",
"""    const threats = liveThreats();
    const aim = threats.length ? threats : targets;
    const c = aim.length ? targetsCentroid(aim) : null;
    // 地上清空了就撤——这是「一次打击解决所有问题」的收尾条件。
    if (!c) { st.phase = "withdraw"; return; }
    // 阵型附近还剩几个目标（守军 + 生物一起数，口径与目标池一致）
    let near = 0;
    {
      _a1.copy(st.anchor).normalize().multiplyScalar(st.baseRadius);
      for (const s of targets) {
        if (s.getWorldPosition(_a2).distanceTo(_a1) <= VANGUARD_ASSAULT.withdrawRadius) near++;
      }
    }
    const fighters = aliveTroopers().filter((tr) => !tr.userData.vehicleGuard).length;
    const timeUp = st.combatT > VANGUARD_ASSAULT.maxCombatTime;
    // 折损阈值随编成走：参战 24 人，打剩不到一半就收队
    if (near <= VANGUARD_ASSAULT.withdrawDefenders || timeUp ||
        fighters <= VANGUARD_ASSAULT.withdrawFighters) {""",
    "updateCombat")

rep("""    // 三三制：阵型中心沿地表向守军质心缓慢推进（速度 = VANGUARD_FORMATION.advanceSpeed）；
    // 巡演站暂无目标 → 阵型原地警戒（仍逐帧贴地）""",
"""    // 三三制：阵型中心沿地表向目标质心缓慢推进（速度 = VANGUARD_FORMATION.advanceSpeed）""",
    "推进注释")

# ---------------- 折损阈值参数化 ----------------
rep("""  /** 撤离触发：锚点附近存活守军 ≤ 此数，或战斗超时，或本队折损过半 */
  withdrawDefenders: 2,""",
"""  /** 撤离触发：锚点附近存活目标 ≤ 此数，或战斗超时，或本队折损过半 */
  withdrawDefenders: 2,
  /** 折损撤离线：参战兵（24 名）掉到这个数以下就收队 */
  withdrawFighters: 12,""",
    "withdrawFighters")

# ---------------- 拆掉 tour 配置 ----------------
rep("""  /** 巡演循环（主人 2026-09-05）：苔庭之战结束后舰队开赴下一站（湖沼），降落 →
   *  屠杀非保护生物 → 停留 → 上艇离开 → 再赴下一站，周而复始。
   *  白名单（湖沼之虎 / 红狐）永不被选为目标。 */
  tour: Object.freeze({
    enabled: true,
    /** 巡演战场的屠杀停留时长（秒），到点全体上艇离开 */
    holdTime: 30,
  }),""",
"""  // 「巡演」这个配置块 2026-09-06 整个拆掉了。
  //
  // 它原本让登陆队自己排班：打完一站 → 挑下一站 → 把主舰一起拽过去。
  // 主人定的是反过来的：舰队围绕主舰。现在扫荡由主舰自己的航线完成——
  // 主舰飞到哪、在哪驻留，登陆队就在哪开局（见 requestStation 的三道闸）。
  // 白名单（湖沼之虎 / 红狐）仍然生效，由 getTourTargets 在场景侧过滤。""",
    "tour 配置")

# ---------------- setupMission 去 isTour ----------------
rep("""   * @param {boolean} isTour 是否巡演站（战斗目标走 getTourTargets，撤离走 holdTime）
   */
  function setupMission(centerDir, isTour = false) {
    st.isTour = isTour;""",
"""   */
  function setupMission(centerDir) {""",
    "setupMission 签名")

rep("""    if (!st.homeHub || !isTour) st.homeHub = st.hub.clone();""",
"""    if (!st.homeHub) st.homeHub = st.hub.clone();""",
    "homeHub")

rep("""      if (!st.isTour) st.sweptHome = true; // 首站（苔庭）已扫荡过一轮""",
"""      st.sweptHome = true; // 打过一轮了（配合 sweptSpots 的冷却）""",
    "sweptHome")

rep("""    const sameSpot = st.hub.lengthSq() > 1e-8 && st.hub.dot(home) > 0.995;
    if (sameSpot) return;
    if (st.isTour) {
      // 只有**人在别处**（巡演站）时挨打才值得中断当前动作、回防这一站
      setupMission(home, false);
    }""",
"""    // 任务进行中挨箭是常态，不是意外：绝不重置任务。
    // 旧代码在「人在巡演站」时会 setupMission(home) 把整支队弹回苔庭重来一遍，
    // 那是登陆队自己排班时代的补丁；现在站点由主舰决定，这条整个不需要了。
    // 该还击的由重甲兵的优先打击名单（st.threats）负责，已经在上面登记过。""",
    "onFleetUnderAttack 尾")

rep("""    return st.isTour ? liveTargets() : [];""",
"""    return liveTargets();""",
    "导出 targets")

# ---------------- getTourAnchor 参数下线 ----------------
rep(""" * @param {()=>(THREE.Vector3|null)} [getTourAnchor] 巡演下一站方向（湖沼）；null = 不巡演""",
""" * （getTourAnchor 于 2026-09-06 下线：下一站由主舰的航线决定，不再由登陆队排班）""",
    "JSDoc")

rep("""  getTourAnchor = null,
""", "", "参数")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（B④）")
