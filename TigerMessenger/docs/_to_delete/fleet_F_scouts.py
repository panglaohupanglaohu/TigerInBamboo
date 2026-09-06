# -*- coding: utf-8 -*-
"""F：抽 3 架侦察机编入莫比斯舰队 —— 前出侦查、环绕战场、曳光弹指示目标。

主人 2026-09-06 的舰队阵容里 scoutDefense 是一员，动作是「前出侦查，环绕战场
飞行」+「曳光弹指示需要攻击的物体」，并且和其它成员一样**随主舰移动**。

改之前它跟舰队一点关系都没有：5 架驻守水晶城母塔与子塔之间，在「城 / 门」
两个区之间每 18 秒换一次岗，猎中型灰鸟；它的曳光弹是直接击杀弹，不是指示。

按主人选的方案：抽 3 架编入舰队，水晶城留 2 架守原岗；分工制——侦察机只标记，
标出来的东西交给舰队各打各的（空中生物给泡机麻醉、地面给重甲兵、贴到艇边的
给登陆艇撞）。所以舰队目标的 hit 回调不再造成伤害，只把目标推进舰队的优先
打击名单。
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

edit("TigerMessenger/src/world/scoutDefense.js", [
# ---------------- 常量 ----------------
("const BIRD_COOLDOWN = 6.5;",
 """const BIRD_COOLDOWN = 6.5;

// ---- 舰队分队（主人 2026-09-06）----------------------------------------
/** 编入舰队的机在战场上空的巡航高度（米，地表之上） */
const FLEET_SCOUT_ALT = 46;
/** 环绕战场的盘旋半径（米）——「环绕战场飞行」要看得出是在绕圈，不是悬停 */
const FLEET_ORBIT_RADIUS = 62;
/** 盘旋角速度（弧度/秒） */
const FLEET_ORBIT_SPEED = 0.42;
/** 同一个目标被重复指示的冷却（秒）：曳光是指示，不是刷屏 */
const DESIGNATE_COOLDOWN = 4.5;""",
 "舰队常量"),

# ---------------- 选项 ----------------
("""    count = DEFAULT_COUNT,
    onHit = () => {},
  } = options;""",
 """    count = DEFAULT_COUNT,
    onHit = () => {},
    // ---- 舰队分队（主人 2026-09-06）----
    /** 编入莫比斯舰队的架数；其余留守水晶城。0 = 全部留守（旧行为） */
    fleetCount = 0,
    /** 战场中心（主舰地面投影方向，单位向量）；null = 舰队不在场 */
    getFleetAnchor = () => null,
    /** 战场上待指示的目标（由 vanguardAssault 提供） */
    getFleetTargets = () => [],
    /** 曳光弹指示回调：把目标推给舰队的优先打击名单 */
    onDesignate = () => {},
  } = options;""",
 "舰队选项"),

# ---------------- 状态 ----------------
("""  const units = [];
  const shots = [];
  const targets = [];""",
 """  const units = [];
  const shots = [];
  const targets = [];
  /** 战场目标（舰队分队专用）。与 targets 分开：两支分队打的是两件事 */
  const fleetTargets = [];
  const nFleet = Math.max(0, Math.min(count | 0, fleetCount | 0));""",
 "舰队状态"),

# ---------------- 战场目标 + 盘旋位 ----------------
("""  function scan(time) {
    targets.length = 0;
    if (zone === "city") addCityTargets(getCityBirdFlocks?.(), time);
    else addGateTargets(getGateBirdVortex?.(), time);
    targetCursor = targets.length ? targetCursor % targets.length : 0;
  }""",
 """  /**
   * 战场目标 → 指示记录。
   *
   * hit 回调**不造成伤害**：主人 2026-09-06 选的是分工制——侦察机只标记，
   * 标出来的东西交给舰队各打各的（空中生物归泡机麻醉、地面归重甲兵、
   * 贴到艇边的归登陆艇撞）。这里只把目标推进优先打击名单。
   */
  function addFleetTargets(time) {
    const list = getFleetTargets?.() || [];
    for (const object of list) {
      if (!object?.parent || object.userData?.dead) continue;
      const ud = object.userData || {};
      if ((ud.scoutDesignatedUntil || 0) > time) continue; // 指示冷却中
      const position = new THREE.Vector3();
      object.getWorldPosition(position);
      fleetTargets.push({
        zone: "fleet",
        kind: "fleet-designated",
        object,
        position,
        hit: (at) => {
          object.userData.scoutDesignatedUntil = at + DESIGNATE_COOLDOWN;
          object.userData.scoutDesignated = true;
          onDesignate(object);
          return true;
        },
      });
    }
  }

  /**
   * 舰队分队的巡航位：绕**战场中心**盘旋（主人：「前出侦查，环绕战场飞行」）。
   *
   * 战场中心 = 主舰的地面投影。这是「随主舰移动」在侦察机这一侧的落点：
   * 主舰飞到哪，这三架就绕到哪，不再回水晶城换岗。
   */
  function fleetOrbitPosition(index, time, anchorDir, out = new THREE.Vector3()) {
    const up = _up.copy(anchorDir).normalize();
    // 切平面基底（球面世界的老规矩：先取一个不与 up 平行的参考轴）
    _forward.set(0, 1, 0);
    if (Math.abs(_forward.dot(up)) > 0.95) _forward.set(1, 0, 0);
    projectTangent(_forward, up);
    _right.crossVectors(up, _forward).normalize();
    // 三架机在同一个圈上均分相位，读起来是一队在绕，不是三架各转各的
    const phase = time * FLEET_ORBIT_SPEED + (index / Math.max(1, nFleet)) * Math.PI * 2;
    // 球面偏移铁律：**先乘半径再切向平移，最后归一化**
    out.copy(up).multiplyScalar(R + FLEET_SCOUT_ALT)
      .addScaledVector(_forward, Math.cos(phase) * FLEET_ORBIT_RADIUS)
      .addScaledVector(_right, Math.sin(phase) * FLEET_ORBIT_RADIUS);
    return out;
  }

  function scan(time) {
    targets.length = 0;
    if (zone === "city") addCityTargets(getCityBirdFlocks?.(), time);
    else addGateTargets(getGateBirdVortex?.(), time);
    targetCursor = targets.length ? targetCursor % targets.length : 0;
    // 舰队分队自己的目标池
    fleetTargets.length = 0;
    if (nFleet > 0 && getFleetAnchor?.()) addFleetTargets(time);
  }""",
 "战场目标 + 盘旋"),

# ---------------- updateUnits 分流 ----------------
("""  function updateUnits(dt, time) {
    const activeTargets = targets.filter((target) => !target.pending);
    const frame = zone === "city" ? cityHomeFrame() : gateHomeFrame();
    for (const unit of units) {
      unit.group.userData.update?.(time, dt);
      if (unit.manual) continue;
      unit.attackCd = Math.max(0, unit.attackCd - dt);
      unit.flashT = Math.max(0, unit.flashT - dt);
      const light = unit.group.userData.beaconLight;
      if (light) light.intensity = unit.flashT > 0 ? 1.4 : 0.55;

      if (activeTargets.length) {
        const target = activeTargets[
          (targetCursor + unit.index * 2 + volley) % activeTargets.length
        ];""",
 """  function updateUnits(dt, time) {
    const activeTargets = targets.filter((target) => !target.pending);
    const activeFleet = fleetTargets.filter((target) => !target.pending);
    const frame = zone === "city" ? cityHomeFrame() : gateHomeFrame();
    // 战场中心：有它，前 nFleet 架就是舰队分队；没有（舰队不在场）就全员守家
    const fleetAnchor = nFleet > 0 ? getFleetAnchor?.() : null;
    for (const unit of units) {
      unit.group.userData.update?.(time, dt);
      if (unit.manual) continue;
      unit.attackCd = Math.max(0, unit.attackCd - dt);
      unit.flashT = Math.max(0, unit.flashT - dt);
      const light = unit.group.userData.beaconLight;
      if (light) light.intensity = unit.flashT > 0 ? 1.4 : 0.55;

      // 编入舰队的那几架：目标池、巡航位都换成战场那一套
      const onFleet = !!fleetAnchor && unit.index < nFleet;
      unit.fleet = onFleet;
      const pool = onFleet ? activeFleet : activeTargets;

      if (pool.length) {
        const target = pool[
          (targetCursor + unit.index * 2 + volley) % pool.length
        ];""",
 "updateUnits 分流头"),

("""      } else {
        const home = homePosition(unit.index, _desired, zone);
        moveUnit(unit, home, dt, SCOUT_SPEED * 0.7);
      }
    }
    if (activeTargets.length) {
      targetCursor = (targetCursor + Math.max(1, Math.floor(dt * 3))) % activeTargets.length;
      volley = (volley + 1) % Math.max(1, activeTargets.length);
    }""",
 """      } else if (onFleet) {
        // 没有待指示的目标 → 继续绕战场巡航（前出侦查）
        const orbit = fleetOrbitPosition(unit.index, time, fleetAnchor, _desired);
        moveUnit(unit, orbit, dt, SCOUT_SPEED * 0.9);
      } else {
        const home = homePosition(unit.index, _desired, zone);
        moveUnit(unit, home, dt, SCOUT_SPEED * 0.7);
      }
    }
    const cursorPool = Math.max(activeTargets.length, activeFleet.length);
    if (cursorPool) {
      targetCursor = (targetCursor + Math.max(1, Math.floor(dt * 3))) % cursorPool;
      volley = (volley + 1) % Math.max(1, cursorPool);
    }""",
 "updateUnits 分流尾"),

# ---------------- 对外状态 ----------------
("""  root.userData.getStatus = () => ({ zone, targetCount: targets.length, count: units.length });""",
 """  root.userData.getStatus = () => ({
    zone, targetCount: targets.length, count: units.length,
    fleetCount: nFleet, fleetTargets: fleetTargets.length,
  });""",
 "状态 userData"),

("""    getStatus: () => ({ zone, targetCount: targets.length, count: units.length }),""",
 """    getStatus: () => ({
      zone, targetCount: targets.length, count: units.length,
      fleetCount: nFleet, fleetTargets: fleetTargets.length,
    }),
    /** 编入舰队的那几架（测试/调试用） */
    fleetUnits: () => units.filter((u) => u.index < nFleet),""",
 "状态 返回值"),
])
print("F（scoutDefense）完成")
