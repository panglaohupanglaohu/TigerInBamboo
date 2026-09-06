# -*- coding: utf-8 -*-
"""运输艇是舰队的「海」那一路：不在任务中要贴海随队巡航，而不是原地隐身。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- 状态位
rep("""    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）""",
"""    sawFleet: false,  // 本轮任务里是否真见过机队（没接机队的桩场景不许触发"机队没了"）
    cruiseDir: null,  // 巡航期机队中心的上一帧方向，用来求航向切向
    cruiseFwd: null,  // 巡航期航向（切向单位向量），机队几乎静止时沿用上一帧""",
"巡航状态")

# ---------------------------------------------------------------- enforceOffstage → 随队巡航
rep("""  function enforceOffstage() {
    const haulers = (typeof getHaulers === "function" ? getHaulers() : []) || [];
    for (const c of haulers) if (c && c.visible) c.visible = false;
    if (squad && squad.visible) squad.visible = false;
  }""",
"""  function enforceOffstage(dt = 0) {
    // 重甲兵不在任务中就是**坐在艇腹里**，不该出现在画面上
    if (squad && squad.visible) squad.visible = false;

    const haulers = (typeof getHaulers === "function" ? getHaulers() : []) || [];
    if (!haulers.length) return;
    const fleet = typeof getFleet === "function" ? getFleet() : null;
    const members = (fleet?.userData?.members || []).filter((m) => m?.parent);
    if (!members.length) {
      // 没有机队可跟 → 才真的收进后台（场景没加载 / 桩环境）
      for (const c of haulers) if (c && c.visible) c.visible = false;
      return;
    }

    // 机队中心的地面投影 = 舰队这一刻在哪
    _o1.set(0, 0, 0);
    for (const m of members) _o1.add(m.getWorldPosition(_fleetDir));
    _o1.multiplyScalar(1 / members.length);
    if (_o1.lengthSq() < 1e-8) return;
    _fleetDir.copy(_o1).normalize();

    // 航向：取机队中心方向的逐帧位移在球面上的切向。机队悬停时位移趋零，
    // 这时沿用上一帧的航向，避免艇头乱转。
    if (!st.cruiseDir) st.cruiseDir = _fleetDir.clone();
    if (!st.cruiseFwd) st.cruiseFwd = new THREE.Vector3();
    _c2.copy(_fleetDir).sub(st.cruiseDir);
    _c2.addScaledVector(_fleetDir, -_c2.dot(_fleetDir)); // 投影到切平面
    if (_c2.lengthSq() > 1e-10) st.cruiseFwd.copy(_c2).normalize();
    if (st.cruiseFwd.lengthSq() < 1e-8) {
      // 首帧兜底：拿任一成员的机头方向
      members[0].getWorldQuaternion(_cQ);
      st.cruiseFwd.set(0, 0, 1).applyQuaternion(_cQ);
      st.cruiseFwd.addScaledVector(_fleetDir, -st.cruiseFwd.dot(_fleetDir));
      if (st.cruiseFwd.lengthSq() < 1e-8) st.cruiseFwd.set(1, 0, 0);
      st.cruiseFwd.normalize();
    }
    st.cruiseDir.copy(_fleetDir);

    // 楔形阵位：右舷 = fwd × up
    _c3.crossVectors(st.cruiseFwd, _fleetDir).normalize();
    const k = dt > 0 ? dt : 0.016;
    haulers.forEach((craft, i) => {
      if (!craft?.parent) return;
      craft.visible = true;
      const slot = VANGUARD_ASSAULT.haulerSlots[i % VANGUARD_ASSAULT.haulerSlots.length];
      // 球面偏移铁律：先乘半径，再切向平移
      _c4.copy(_fleetDir).multiplyScalar(seaR + SOCCO.skimHeight)
        .addScaledVector(_c3, slot.side)
        .addScaledVector(st.cruiseFwd, slot.back - CRUISE_TRAIL);
      chaseObj(craft, _c4, k, 1.1, 0.5);
      _c5.copy(craft.position).normalize();
      orientCraft(craft, st.cruiseFwd, _c5);
      updateSoccoSeaSkim(craft, { t: st.t, seaRadius: seaR, speed: 0.6 });
    });
  }""",
"随队巡航")

# ---------------------------------------------------------------- 常量与临时量
rep("""const FLEET_ABANDON_DIST = 220;""",
"""const FLEET_ABANDON_DIST = 220;
/** 巡航时运输艇整体落在机队地面投影之后这么远（米）——是舰队不是并排飞行表演 */
const CRUISE_TRAIL = 26;
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();
const _c5 = new THREE.Vector3();
const _cQ = new THREE.Quaternion();""",
"巡航临时量")

# ---------------------------------------------------------------- 传 dt
rep("""    if (!onMission) { releasePods(); enforceOffstage(); }""",
"""    if (!onMission) { releasePods(); enforceOffstage(dt); }""",
"传 dt")

io.open(P, "w", encoding="utf-8").write(s)
print("运输艇随队巡航已加")
