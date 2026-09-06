# -*- coding: utf-8 -*-
"""① 编辑器画面冻死（WebGLAttributes 抛错）②舰队卡在 withdraw 不跟走。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 匹配到多处：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ==================================================== ① 合并块压缩：别换 array
edit("TigerMessenger/src/world/citadel/mergedCellPatch.js", [
("""  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const size = attr.itemSize;
    const next = new attr.array.constructor(keptTris * 3 * size);
    let head = 0;
    for (const [a, b] of keep) {
      const from = a * 3 * size;
      const to = b * 3 * size;
      next.set(attr.array.subarray(from, to), head);
      head += to - from;
    }
    attr.array = next;
    attr.count = keptTris * 3;
    attr.needsUpdate = true;
  }""",
"""  // 压缩必须**原地**做，绝不能换掉 attr.array（主人 2026-09-05：
  // 「系统播放声音，但是无法继续编辑，画面不动了」+ 控制台每帧刷
  //  THREE.WebGLAttributes: The size of the buffer attribute's array buffer
  //  does not match the original size. Resizing buffer attributes is not supported.）
  //
  // 原因：three 在首次上传时按 array.byteLength 记下了 GPU buffer 的大小
  // （WebGLAttributes 的 data.size）。之后每次 needsUpdate，它拿
  // `data.size !== attribute.array.byteLength` 做校验——我们换上一条更短的
  // 数组，这一条就永远不相等，于是 **每一帧 render 都 throw**。
  // 抛在 projectObject 里，等于整个 render 半途中断：音频线程照跑（有声音），
  // 画面停在最后一帧、编辑器也点不动。这就是主人看到的「冻住」。
  //
  // 正解是保持缓冲区长度不变、只把要留的三角形往前挪，然后用 count +
  // drawRange 把尾巴切掉。byteLength 不变 → 校验通过 → needsUpdate 正常生效；
  // 尾部那段废数据既不画也不参与包围盒（都按 count 走）。
  // 顺带还省掉一次分配——增量编辑是热路径，每次 edit 都重开几 MB 才是真浪费。
  //
  // subarray 与目标同属一个 ArrayBuffer，但 TypedArray.prototype.set 规范上
  // 对同 buffer 的重叠拷贝有定义（等价于先克隆源），且 head <= from 始终成立，
  // 所以这里是安全的前向压缩。
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const size = attr.itemSize;
    let head = 0;
    for (const [a, b] of keep) {
      const from = a * 3 * size;
      const to = b * 3 * size;
      if (head !== from) attr.array.set(attr.array.subarray(from, to), head);
      head += to - from;
    }
    attr.count = keptTris * 3;
    attr.needsUpdate = true;
  }""",
 "原地压缩"),
])

# ==================================================== ② 撤离阶段的硬截止
edit("TigerMessenger/src/world/vanguardAssault.js", [
("  withdrawTimeout: 45,",
 """  withdrawTimeout: 45,
  // 机队已经走了却还在撤离 → 用更短的截止。主人 2026-09-05 的
  // `__tm.fleet()` 抓到 phase 一直是 'withdraw'、troopers 还 deployed：
  // 舰队早飞到湖沼，登陆队还在苔庭滩头慢慢走回艇上。
  withdrawChaseTimeout: 12,""",
 "撤离追赶截止"),

("""    if (!allAboard && st.withdrawT > VANGUARD_ASSAULT.withdrawTimeout) {
      for (const tr of aliveTroopers()) {
        if (tr.userData.aboard) continue;
        tr.userData.aboard = true;
        tr.visible = false;
      }
      allAboard = true;
    }""",
"""    // 截止时间：机队还在头顶就按正常节奏收（45s），机队已经飞走就只给 12s
    // ——「跟着走」是主人定的第一原则，撤离动画再好看也不能让舰队散架。
    const chasing = st.sawFleet && (!fleetAlive() || fleetLeftStation());
    const limit = chasing
      ? VANGUARD_ASSAULT.withdrawChaseTimeout
      : VANGUARD_ASSAULT.withdrawTimeout;
    const overdue = st.withdrawT > limit;
    if (!allAboard && overdue) {
      for (const tr of aliveTroopers()) {
        if (tr.userData.aboard) continue;
        tr.userData.aboard = true;
        tr.visible = false;
      }
      allAboard = true;
    }
    // ⚠️ 超时也必须放行 rampsReady。旧代码只强制上人、不管坡门：
    // 只要有一艘艇飞不回滩头（retArrived 永远 false，比如滩头方向被
    // 场景切换改脏），rampsReady 就永远是 false，withdraw 这一段
    // **没有任何出口**——phase 永久停在 'withdraw'。而 onMission 为真
    // 时 update() 不调 releasePods()/enforceOffstage()，于是三台泡机
    // 挂在 scene 下不伴飞、运输艇不巡航、重甲兵留在原地。
    // 主人反复报的「泡机和登陆艇没去伴飞」「重甲兵源源不断」就是这个死角。
    if (overdue) {
      st.haulers.forEach((h) => {
        h.retArrived = true;
        h.ramp = 1;
      });
      rampsReady = true;
    }""",
 "撤离超时放行"),

# ---- 提炼 finishMission，并在 extract 末尾复用
("""      // 任务结束：泡机归队（世界变换保留，escort update 下帧接管）；机队解锁回航线
      releasePods();
      const fleet = typeof getFleet === "function" ? getFleet() : null;
      (fleet?.userData?.members || []).forEach((m) => {
        if (m.userData.missionLock) m.userData.missionLock.active = false;
      });
      st.haulers.forEach((h) => { h.craft.visible = false; });
      squad.visible = false;
      st.phase = "done";""",
"""      // 任务结束：泡机归队（世界变换保留，escort update 下帧接管）；机队解锁回航线
      finishMission();""",
 "extract 末尾"),

("""  // ------------------------------------------- 扫描烧灰 + GatePod 麻醉炮 --""",
"""  /**
   * 收队：把舰队恢复成「跟着 aircraft 走」的常态（幂等，可以从任何阶段调）。
   *
   * 以前这段只写在 `updateExtract` 的成功出口上。任务有五个阶段、每个阶段
   * 都可能提前夭折（机队被打走、场景切换、存档重载、某艘艇飞不回来），
   * 少一条出口就会留下一支半截舰队：泡机停在半空、运输艇停在滩头、
   * 重甲兵站在原地当靶子。所以它必须是一个能被任何人调用的收尾函数。
   */
  function finishMission() {
    releasePods();
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    (fleet?.userData?.members || []).forEach((m) => {
      if (m.userData?.missionLock) m.userData.missionLock.active = false;
    });
    for (const tr of aliveTroopers()) {
      tr.userData.aboard = true;
      tr.visible = false;
    }
    st.haulers.forEach((h) => { if (h.craft) h.craft.visible = false; });
    if (squad) squad.visible = false;
    st.phase = "done";
  }

  // ------------------------------------------- 扫描烧灰 + GatePod 麻醉炮 --""",
 "finishMission"),

# ---- 阶段看门狗
("""    switch (st.phase) {
      case "approach": updateApproach(dt); break;""",
"""    // 阶段看门狗：任何一段卡死超过 MISSION_STALL_LIMIT 秒就强制收队。
    // 上面 withdraw 的硬截止修的是**已知**的那个死角；这条守的是还没被发现的
    // 那些——舰队散在半路不动，是主人这几天反复看到的同一种画面，
    // 与其等下一次再抓一遍 `__tm.fleet()`，不如让状态机自己爬出来。
    if (onMission) {
      if (st.phase !== st.lastPhase) { st.lastPhase = st.phase; st.phaseT = 0; }
      else st.phaseT += dt;
      if (st.phaseT > MISSION_STALL_LIMIT) {
        finishMission();
        st.lastPhase = st.phase;
        st.phaseT = 0;
        return;
      }
    } else { st.lastPhase = st.phase; st.phaseT = 0; }

    switch (st.phase) {
      case "approach": updateApproach(dt); break;""",
 "看门狗"),

("const FLEET_ABANDON_DIST = 220;",
 """const FLEET_ABANDON_DIST = 220;
/** 单个阶段最长滞留（秒）。超了就强制收队——舰队散在原地比动画不完整难看得多。 */
const MISSION_STALL_LIMIT = 120;""",
 "看门狗常量"),

("""    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）""",
 """    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）
    lastPhase: "idle", // 看门狗：上一帧的阶段
    phaseT: 0,         // 看门狗：当前阶段已停留多久（秒）""",
 "看门狗状态"),
])

# ==================================================== ③ 缓存戳
edit("TigerMessenger/index.html", [
("./src/main.js?v=20260905-fleet-selfcheck-v1",
 "./src/main.js?v=20260905-freeze-fleet-v2", "cache-buster"),
])
print("done")
