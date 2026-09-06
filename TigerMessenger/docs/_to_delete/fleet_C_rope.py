# -*- coding: utf-8 -*-
"""C：索降兵由**本泡机的绳索**收回，任何时候都不许半空遗弃。

主人 2026-09-06：「索降 重甲士兵 + 绳索回收 重甲士兵（不要出现半空索降时就
离开的情况）」。

改之前有两个洞：
  ① 撤离时索降兵没有回收路径——代码把他们「就近挂到一艘艇」，让他们走去
     登陆艇的后舱门。设定里泡机是有绳索的，这条路径根本不该存在。
  ② insert 段一旦被打断（机队飞走 → stranded → 直接转 withdraw），
     正挂在绳上的人会被当成地面兵处理，从半空弹到地面再走去登陆艇。
     那就是主人明令禁止的那一幕。

现在：泡机进 recover 态——飞回自己那批人上方、放绳、按索降的镜像把人绞上来。
insert 被打断也走这条路，所以「半空被丢下」在结构上不可能发生。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 参数 ----------------
rep("""  /** 索降：单兵滑降用时 / 人与人错相 */
  rappelTime: 2.2,
  rappelStagger: 0.5,""",
"""  /** 索降：单兵滑降用时 / 人与人错相 */
  rappelTime: 2.2,
  rappelStagger: 0.5,
  /** 绳索回收：单兵攀升用时（比滑降慢一点——重甲往上走费劲） */
  recoverTime: 2.6,
  recoverStagger: 0.45,""",
    "回收参数")

# ---------------- 撤离：泡机回收段（替换原来的「收拢到编队上空」） ----------------
rep("""    // 泡机：收拢到编队上空
    st.pods.forEach((p, i) => {
      if (!p.pod?.parent) return;
      const hc = st.haulers[i % Math.max(1, st.haulers.length)]?.craft;
      if (!hc?.parent) return;
      const slot = VANGUARD_ASSAULT.podSlots[i % VANGUARD_ASSAULT.podSlots.length];
      const up = _a5.copy(hc.position).normalize();
      const fwd = _a4.copy(st.start).projectOnPlane(up).normalize();
      const right = _a3.crossVectors(fwd, up).normalize();
      _a2.copy(hc.position)
        .addScaledVector(right, slot.side)
        .addScaledVector(up, slot.up)
        .addScaledVector(fwd, slot.back);
      chaseObj(p.pod, _a2, dt, 1.0, 0.6);
      orientCraft(p.pod, fwd, up);
      p.ropes.forEach((r) => { r.visible = false; });
    });""",
"""    // ---- 泡机：绳索回收自己那 2 名索降兵（主人 2026-09-06 的硬要求）
    //
    // 这是索降的镜像动作：飞回自己那批人正上方 → 放绳 → 逐个绞上来。
    // 「自己那批人」不是就近取——花名册（vanguardRosterSlot）里 uid 段直接
    // 决定他上的是哪台泡机，所以谁的人由谁收，永远对得上号。
    //
    // 旧代码在这里只是把泡机往编队上空收拢，索降兵则被丢进下面那个
    // 「就近挂到一艘艇」的分支，走去登陆艇的后舱门——泡机明明有绳索。
    let podsRecovered = true;
    for (const p of st.pods) {
      if (p.state === "recovered") continue;
      if (!p.pod?.parent) { p.state = "recovered"; continue; }
      const mine = p.troopers.filter((tr) => tr && !tr.userData.dead && !tr.userData.aboard);
      if (!mine.length) {
        p.state = "recovered";
        p.ropes.forEach((r) => { r.visible = false; });
        continue;
      }
      podsRecovered = false;

      // 悬停点：自己那批人的质心正上方
      _a1.set(0, 0, 0);
      for (const tr of mine) _a1.add(tr.position);
      _a1.multiplyScalar(1 / mine.length).normalize();
      const gr = gh(_a1);
      _a2.copy(_a1).multiplyScalar(gr + VANGUARD_ASSAULT.podHoverHeight);
      const overhead = chaseObj(p.pod, _a2, dt, 1.2, 0.6);
      // 绳子先垂下来：人还站在地上，但已经挂上了——画面上先有连接再有攀升
      const up = _a3.set(0, 1, 0).applyQuaternion(p.pod.quaternion).normalize();
      _a4.copy(p.pod.position).addScaledVector(up, -VANGUARD_ASSAULT.hangLength);
      if (!overhead) {
        p.troopers.forEach((tr, j) => {
          if (!tr || tr.userData.dead || tr.userData.aboard) return;
          setRope(p.ropes[j], p.pod.position, tr.position);
        });
        continue;
      }
      if (p.state !== "recover") { p.state = "recover"; p.recT = 0; }
      p.recT += dt;
      p.troopers.forEach((tr, j) => {
        if (!tr || tr.userData.dead || tr.userData.aboard) return;
        // 攀绳中不出手（updateVanguardAdvance 按 onGround === false 跳过）
        if (!tr.userData._recFrom) tr.userData._recFrom = tr.position.clone();
        const t0 = j * VANGUARD_ASSAULT.recoverStagger;
        const prog = Math.max(0, Math.min(1, (p.recT - t0) / VANGUARD_ASSAULT.recoverTime));
        if (prog <= 0) { setRope(p.ropes[j], p.pod.position, tr.position); return; }
        tr.userData.onGround = false;
        tr.userData.climbing = true;
        tr.position.lerpVectors(tr.userData._recFrom, _a4, prog);
        tr.visible = true;
        setRope(p.ropes[j], p.pod.position, tr.position);
        if (prog >= 1) {
          tr.userData.aboard = true;
          tr.userData.climbing = false;
          tr.visible = false;   // 收进泡机腹内
          tr.userData._recFrom = null;
          st.aboardCount++;
        }
      });
    }""",
    "泡机回收段")

# ---------------- 撤离：索降兵不再被塞进登陆艇 ----------------
rep("""      if (!h) {
        // 索降兵（没乘艇）：就近挂到一艘艇，集合点 = 该艇滩头岸上
        h = st.haulers[(tr.userData.uid ?? 0) % Math.max(1, st.haulers.length)];
        if (!h) continue;""",
"""      if (!h) {
        // 索降兵由**本泡机的绳索**收回（上面那段），不走登陆艇的后舱门。
        // 主人 2026-09-06 的设定里泡机就配着绳索，让他们徒步跑去登陆艇
        // 既不合设定，也正是「半空索降被丢下」那条故障的下游表现。
        if (tr.userData.vehicleSlot?.kind === "pod") continue;
        // 真正没有归属的（泡机缺编等兜底情形）才就近挂到一艘艇
        h = st.haulers[(tr.userData.uid ?? 0) % Math.max(1, st.haulers.length)];
        if (!h) continue;""",
    "索降兵不塞艇")

# ---------------- 收尾条件：加上泡机回收 ----------------
rep("""    if (allAboard && rampsReady) {""",
"""    if (allAboard && rampsReady && podsRecovered) {""",
    "收尾条件")

rep("""    if (overdue) {
      st.haulers.forEach((h) => {
        h.retArrived = true;
        h.ramp = 1;
      });
      rampsReady = true;
    }""",
"""    if (overdue) {
      st.haulers.forEach((h) => {
        h.retArrived = true;
        h.ramp = 1;
      });
      rampsReady = true;
      // 泡机也一样：超时就直接算收完，绝不让一根没绞完的绳子把舰队钉在原地。
      // 注意仍然是「收进机腹」而不是「丢在地上」——半空遗弃在任何路径上都不许发生。
      for (const p of st.pods) {
        for (const tr of p.troopers || []) {
          if (!tr || tr.userData.dead || tr.userData.aboard) continue;
          tr.userData.aboard = true;
          tr.userData.climbing = false;
          tr.visible = false;
          tr.userData._recFrom = null;
          st.aboardCount++;
        }
        p.state = "recovered";
        p.ropes.forEach((r) => { r.visible = false; });
      }
      podsRecovered = true;
    }""",
    "超时也收泡机")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（C）")
