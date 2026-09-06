# -*- coding: utf-8 -*-
"""陆海空舰队是一个整体：机队不许自己飞走、打完开赴下一站、泡机常态麻醉炮。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

P = R + "TigerMessenger/src/world/vanguardAssault.js"
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- 1. 临时向量
rep("""const _o1 = new THREE.Vector3();
const _o2 = new THREE.Vector3();""",
"""const _o1 = new THREE.Vector3();
const _o2 = new THREE.Vector3();
const _fleetDir = new THREE.Vector3(); // 全程锁机队用，禁止与 _a*/_o* 复用""",
"临时向量")

# ---------------------------------------------------------------- 2. 状态位
rep("""    homeHub: null,    // 回防点（首站中枢 = 苔庭）""",
"""    homeHub: null,    // 回防点（首站中枢 = 苔庭）
    sweptHome: false, // 首站是否已经打完一轮（打完就别再原地空投第二批）""",
"sweptHome")

# ---------------------------------------------------------------- 3. 全程锁机队
rep("""  // ---------------------------------------------------------------- update --
  function update(dt, t = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.t = t;
    switch (st.phase) {""",
"""  /** 机队还在不在（被移出场景 / 成员清空 = 舰队没了） */
  function fleetAlive() {
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    if (!fleet?.parent) return false;
    return (fleet.userData?.members || []).some((m) => m?.parent);
  }

  // ---------------------------------------------------------------- update --
  function update(dt, t = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    st.t = t;
    const onMission = st.phase !== "idle" && st.phase !== "done";

    // ---- 舰队是一个整体（主人 2026-09-05）---------------------------------
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
        updateFleetLock(_fleetDir, Math.max(st.baseRadius, R) + FLEET_COMBAT_UP);
      }
    }
    // 机队真的没了（被移出场景）：地面部队不许留在原地当活靶，立刻收队跟走
    if (onMission && !fleetAlive() && st.phase !== "withdraw" && st.phase !== "extract") {
      st.phase = "withdraw";
    }

    switch (st.phase) {""",
"全程锁机队")

rep("""  /** 离场：飞出这段弧长（弧度）后任务结束（泡机归队） */
  extractArc: 0.5,""",
"""  /** 离场：飞出这段弧长（弧度）后任务结束（泡机归队） */
  extractArc: 0.5,
  /** 作战期机队悬停在地面编队之上的高度（米）。approach/extract 段另有贴海口径 */
  combatHoverUp: 34,""",
"combatHoverUp")

rep("""const _fleetDir = new THREE.Vector3(); // 全程锁机队用，禁止与 _a*/_o* 复用""",
"""const _fleetDir = new THREE.Vector3(); // 全程锁机队用，禁止与 _a*/_o* 复用
const FLEET_COMBAT_UP = 34; // = VANGUARD_ASSAULT.combatHoverUp（模块级常量，热路径不查表）""",
"FLEET_COMBAT_UP")

# ---------------------------------------------------------------- 4. 打完开赴下一站
rep("""    if (st.phase === "idle" || st.phase === "done") {
      begin(home);
      return;
    }""",
"""    if (st.phase === "idle" || st.phase === "done") {
      // 首站已经扫过一轮就**不再原地空投第二批**——主人 2026-09-05：
      // 「我看到仍然有重甲士兵源源不断地赶来，而不是与莫比斯 aircraft 组成
      //   一个强大的陆海空舰队去扫荡一切景点」。红盔会一直朝天上放箭，
      //   而这条分支每次收队后都被箭重新触发一次，等于把苔庭刷成了刷兵点。
      // 现在：打完苔庭 → 整队开赴巡演下一站；只有还没打过才在这儿开局。
      const nextStop = st.sweptHome && typeof getTourAnchor === "function"
        ? getTourAnchor()
        : null;
      if (nextStop && nextStop.lengthSq() > 1e-8) setupMission(nextStop, true);
      else begin(home);
      return;
    }""",
"不再刷兵")

# 首站打完即标记
rep("""      st.extractArc = 0;
      st.phase = "extract";""",
"""      st.extractArc = 0;
      if (!st.isTour) st.sweptHome = true; // 首站（苔庭）已扫荡过一轮
      st.phase = "extract";""",
"标记 sweptHome")

# ---------------------------------------------------------------- 5. 泡机常态麻醉炮
rep("""  function updateTranq(dt) {
    const t = st.tranq;
    // 发射（仅 insert 悬停后 / combat；撤离停火）
    t.cd -= dt;
    if (t.cd <= 0 && (st.phase === "insert" || st.phase === "combat")) {
      const shooters = st.pods.filter((p) =>
        (p.state === "hover" || p.state === "rappel" || p.state === "done") && p.pod?.parent);
      const ds = liveTargets();
      if (shooters.length && ds.length) {
        const idx = Math.floor(vaHash(Math.floor(st.t * 3), 5) * shooters.length) % shooters.length;
        const pod = shooters[idx];
        if (!pod?.pod?.parent) {
          console.error("[tranq] bad shooter idx", idx, "len", shooters.length,
            "states", st.pods.map((p) => p.state).join(","));
          t.cd = 0.5;
          return;
        }
        pod.pod.getWorldPosition(_a1);
        let best = null;
        let bestD = Infinity;
        for (const d of ds) {
          const dDist = d.getWorldPosition(_a2).distanceTo(_a1);
          if (dDist < 40 && dDist < bestD) { bestD = dDist; best = d; }
        }
        if (best) {
          const muzzle = pod.pod.userData.tranqMuzzle;
          const from = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : _a1.clone();
          const mesh = t.pool.find((m) => !m.visible);
          if (mesh) {
            mesh.visible = true;
            mesh.position.copy(from);
            t.shots.push({ mesh, target: best, speed: 26, t: 0 });
          }
        }
        t.cd = 2.2;
      } else {
        t.cd = 1;
      }
    }""",
"""  function updateTranq(dt) {
    const t = st.tranq;
    t.cd -= dt;
    if (t.cd <= 0) {
      // 任务中：三台泡机对全体守军开火。
      // **不在任务中也要开火**（主人 2026-09-05 截屏：三台泡机在旁边干看着）——
      // 泡机本来就配麻醉炮，红盔在下面朝机队放箭时它们没有理由沉默。
      // 区别只在目标池：巡航期只打**正在攻击机队的人**（threats），不主动挑衅。
      const onMission = st.phase === "insert" || st.phase === "combat" ||
        st.phase === "approach" || st.phase === "withdraw";
      const shooters = onMission
        ? st.pods.filter((p) => p.state !== "form" && p.state !== "move" && p.pod?.parent)
          .map((p) => p.pod)
        : ((typeof getPods === "function" ? getPods() : []) || []).filter((p) => p?.parent);
      // 巡航期泡机挂在机队编队里，离地面比悬停时远得多，射程口径要放宽
      const range = onMission ? 40 : 140;
      const ds = onMission ? liveTargets() : liveThreats();
      if (shooters.length && ds.length) {
        const idx = Math.floor(vaHash(Math.floor(st.t * 3), 5) * shooters.length) % shooters.length;
        const pod = shooters[idx] || shooters[0];
        pod.getWorldPosition(_a1);
        let best = null;
        let bestD = Infinity;
        for (const d of ds) {
          if (!d?.parent || d.userData?.dead || d.userData?.downed) continue;
          const dDist = d.getWorldPosition(_a2).distanceTo(_a1);
          if (dDist < range && dDist < bestD) { bestD = dDist; best = d; }
        }
        if (best) {
          const muzzle = pod.userData?.tranqMuzzle;
          const from = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : _a1.clone();
          const mesh = t.pool.find((m) => !m.visible);
          if (mesh) {
            mesh.visible = true;
            mesh.position.copy(from);
            t.shots.push({ mesh, target: best, speed: 26, t: 0 });
          }
        }
        t.cd = onMission ? 2.2 : 1.6;
      } else {
        t.cd = 1;
      }
    }""",
"常态麻醉炮")

# 导出 fleetAlive 便于测试
rep("""  return { root, begin, update, phase, controlsPods, triggerWithdraw, stats, tourTargets, onFleetUnderAttack, threatTargets: liveThreats };""",
"""  return {
    root, begin, update, phase, controlsPods, triggerWithdraw, stats, tourTargets,
    onFleetUnderAttack, threatTargets: liveThreats, fleetAlive,
    sweptHome: () => st.sweptHome,
  };""",
"导出")

io.open(P, "w", encoding="utf-8").write(s)
print("vanguardAssault.js 已改")

# =====================================================================
# 巡演站改成一圈景点，而不是只有湖沼一站
# =====================================================================
P2 = R + "TigerMessenger/src/scenes/messenger/loadCitadel.js"
s2 = io.open(P2, encoding="utf-8").read()
old = """    getTourAnchor: () => {
      let sw = null;
      scene.traverse((o) => { if (!sw && o.userData?.kind === "moebius-swamp") sw = o; });
      return sw ? sw.position.clone().normalize() : null;
    },"""
new = """    // 巡演路线（主人 2026-09-05：「组成一个强大的陆海空舰队去扫荡一切景点」）：
    // 不再只有湖沼一站，而是按下面这一圈景点轮转，走完一圈从头再来。
    // 找不到的站自动跳过（场景没加载就当它不存在），一站都找不到才返回 null。
    getTourAnchor: (() => {
      const RING = ["moebius-swamp", "oldHarbor", "navona-canal-plaza", "moebius-green-hill-pad"];
      let cursor = 0;
      return () => {
        const found = new Map();
        scene.traverse((o) => {
          const k = o.userData?.kind;
          if (k && RING.includes(k) && !found.has(k)) found.set(k, o);
        });
        for (let i = 0; i < RING.length; i++) {
          const kind = RING[(cursor + i) % RING.length];
          const obj = found.get(kind);
          if (!obj) continue;
          const dir = obj.getWorldPosition(new THREE.Vector3());
          if (dir.lengthSq() < 1e-8) continue;
          cursor = (cursor + i + 1) % RING.length; // 下次从下一站开始找
          return dir.normalize();
        }
        return null;
      };
    })(),"""
assert old in s2, "getTourAnchor 未匹配"
s2 = s2.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s2)
print("loadCitadel.js 巡演路线已改")
