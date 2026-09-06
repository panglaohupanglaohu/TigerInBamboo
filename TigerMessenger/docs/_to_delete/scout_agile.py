# -*- coding: utf-8 -*-
"""侦察机「轻灵迅捷」+ 战场中心低通（主人 2026-09-06）。

  「scoutDefense 是侦察机，轻灵迅捷，标记打击目标，在空中发射曳光弹标记，
    而不是近身标记，环绕飞行」

standoff 盘旋和空中曳光指示已经做了（见 fleetOrbitPosition / DESIGNATE_RANGE）。
这一刀补两处：
  · **轻灵迅捷**：编入舰队的机比守家的快一档、转向更利落——三个舰种的
    质感要拉开：气垫船稳重、武装直升机沉着、侦察机轻快。
  · **战场中心低通**：盘旋圈的圆心取自主舰的地面投影。苔庭鲸把主舰拽得
    上下俯冲时，那个投影每帧都在跳，圆心跟着跳，侦察机就跟着癫狂——
    跟气垫艇那边是同一个病。滤掉高频，转场（低频）照样跟得上。
"""
import io, os

# ---------------- ① scoutDefense：速度与转向 ----------------
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/scoutDefense.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why, txt=None):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("const SCOUT_TURN_ACCEL = 30; // 转向加速度上限（u/s²）：产生大半径滑翔弧线，而非苍蝇抖动",
    "const SCOUT_TURN_ACCEL = 38; // 转向加速度上限（u/s²）：滑翔弧线；侦察机「轻灵迅捷」，比运输/攻击平台利落",
    "转向加速度")
rep("const FLEET_ORBIT_SPEED = 0.42;",
    "const FLEET_ORBIT_SPEED = 0.55;",
    "盘旋角速度")
rep("        moveUnit(unit, orbit, dt, SCOUT_SPEED * 0.9, FLEET_MIN_AGL);",
    """        // 「轻灵迅捷」：编入舰队的机比守家的快一档。三个舰种的质感要拉开——
        // 气垫船稳重如山、武装直升机沉着悬停、侦察机轻快地绕着圈跑。
        moveUnit(unit, orbit, dt, SCOUT_SPEED * 1.25, FLEET_MIN_AGL);""",
    "巡航速度")
io.open(P, "w", encoding="utf-8").write(s)
print("patched scoutDefense.js（轻灵迅捷）")

# ---------------- ② 战场中心低通 ----------------
P2 = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/scenes/messengerIsland.js")
s = io.open(P2, encoding="utf-8").read()
old = """    const fleetAnchorDir = (() => {
      const acc = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      return () => {
        const members = (skyPack.aircraftSquad?.userData?.members || []).filter((m) => m?.parent);
        if (!members.length) return null;
        acc.set(0, 0, 0);
        for (const m of members) acc.add(m.getWorldPosition(tmp));
        acc.multiplyScalar(1 / members.length);
        return acc.lengthSq() > 1e-8 ? acc.clone().normalize() : null;
      };
    })();"""
new = """    const fleetAnchorDir = (() => {
      const acc = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      const smooth = new THREE.Vector3();
      let primed = false;
      let lastT = 0;
      return () => {
        const members = (skyPack.aircraftSquad?.userData?.members || []).filter((m) => m?.parent);
        if (!members.length) { primed = false; return null; }
        acc.set(0, 0, 0);
        for (const m of members) acc.add(m.getWorldPosition(tmp));
        acc.multiplyScalar(1 / members.length);
        if (acc.lengthSq() < 1e-8) return null;
        acc.normalize();
        // ---- 低通：圆心不许跟着主舰的高频动作跳（主人 2026-09-06）----
        // 苔庭鲸把主舰拽得上下俯冲时，瞬时地面投影每帧都在动；侦察机的盘旋圆心
        // 照着它走，三架机就跟着抽——「跟着莫比斯 aircraft 拉扯癫狂」在侦察机
        // 这一侧的样子。滤掉高频，主舰真正转场（低频）时照样跟得过去。
        const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
        const dt = primed ? Math.max(0, Math.min(0.25, now - lastT)) : 0;
        lastT = now;
        if (!primed) { smooth.copy(acc); primed = true; return smooth.clone(); }
        smooth.lerp(acc, 1 - Math.exp(-dt / 2.2)).normalize();
        return smooth.clone();
      };
    })();"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s)
print("patched messengerIsland.js（战场中心低通）")
