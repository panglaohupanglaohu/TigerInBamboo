# -*- coding: utf-8 -*-
"""侦察机飞行姿态（第二段）：standoff——编入舰队的机永远在圈上，绝不下去贴脸。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/scoutDefense.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""      const pool = onFleet ? activeFleet : activeTargets;

      if (pool.length) {""",
"""      const pool = onFleet ? activeFleet : activeTargets;

      if (onFleet) {
        // ================= 编入舰队的侦察机：standoff 盘旋 =================
        // 业界 ISR 机的基本盘：**在目标外侧保持一个盘旋圈，传感器内指**，
        // 机身自始至终不进入对方的近距。这里就是那个圈——不管圈里有没有目标，
        // 航迹都是同一个圈，指示靠射程（DESIGNATE_RANGE），不靠飞过去。
        //
        // 旧代码在这儿走的是水晶城猎鸟那套「飞到目标身上打」，
        // 目标又趴在地上，于是侦察机一头扎进红盔堆里贴地悬停（主人 2026-09-06 截屏）。
        const orbit = fleetOrbitPosition(unit.index, time, fleetAnchor, _desired);
        // 僚机间隔：在圈上也要互相让开，别叠在一起
        for (const other of units) {
          if (other === unit || !other.fleet) continue;
          _axis.subVectors(unit.group.position, other.group.position);
          const gap = _axis.length();
          if (gap > 1e-5 && gap < MIN_FORMATION_GAP) {
            orbit.addScaledVector(_axis.normalize(), (MIN_FORMATION_GAP - gap) * 1.8);
          }
        }
        moveUnit(unit, orbit, dt, SCOUT_SPEED * 0.9, FLEET_MIN_AGL);
        // 曳光指示：够得着就打，够不着就等下一圈转过来——不许为了打而下高度
        if (unit.attackCd <= 0 && pool.length) {
          const target = pool[(targetCursor + unit.index * 2 + volley) % pool.length];
          if (target && unit.group.position.distanceTo(target.position) <= DESIGNATE_RANGE) {
            makeShot(unit, target, time);
          }
        }
        continue;
      }

      if (pool.length) {""",
    "舰队分队 standoff")

# 旧的「没有目标 → 绕战场巡航」分支已被上面接管，收掉它
rep("""      } else if (onFleet) {
        // 没有待指示的目标 → 继续绕战场巡航（前出侦查）
        const orbit = fleetOrbitPosition(unit.index, time, fleetAnchor, _desired);
        moveUnit(unit, orbit, dt, SCOUT_SPEED * 0.9);
      } else {""",
"""      } else {""",
    "收掉旧的舰队巡航分支")

io.open(P, "w", encoding="utf-8").write(s)
print("patched scoutDefense.js（standoff）")
