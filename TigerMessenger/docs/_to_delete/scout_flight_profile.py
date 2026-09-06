# -*- coding: utf-8 -*-
"""侦察机飞行姿态：按业界 ISR 机的做法重做（主人 2026-09-06 截屏否决）。

截屏里三架侦察机贴着地面、夹在红盔堆里、机身水平不带坡度——那是武装直升机
扫射的姿态，不是侦察机。根因在 updateUnits：有目标时 `_desired` 直接取
`target.position + 编队偏移`，而目标就趴在地上，于是侦察机一头扎到地面高度，
停在敌群正中间打。ATTACK_RANGE=10.5 更是逼着它必须贴脸。

业界侦察机（MQ-9 的 "wheel"、AC-130 的 pylon turn、前进空中管制机的 lazy eight）
的三条常识，这次全部补上：
  ① **standoff**：不飞到目标头上。在目标外侧保持一个盘旋圈，传感器/曳光内指，
     机身始终不进入对方的近距。这里体现为：编入舰队的机**永远绕战场盘旋**，
     指示靠射程（DESIGNATE_RANGE）而不是靠贴近。
  ② **保持高度**：有一条硬性 AGL 下限，任何情况下不许俯冲到地面高度。
  ③ **机头跟着速度矢量**：爬升抬头、下降低头、转弯压坡度（协调转弯）。
     旧 orientAircraft 把 forward 完全投影到切平面，俯仰恒为 0——
     无论爬升还是俯冲，机身永远水平，这正是截屏里那种"贴地平移"的观感。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/scoutDefense.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 常量 ----------------
rep("""/** 同一个目标被重复指示的冷却（秒）：曳光是指示，不是刷屏 */
const DESIGNATE_COOLDOWN = 4.5;""",
"""/** 同一个目标被重复指示的冷却（秒）：曳光是指示，不是刷屏 */
const DESIGNATE_COOLDOWN = 4.5;
/**
 * 曳光指示的有效射程（米）。**这就是 standoff 的具体数值**：
 * 盘旋半径 ~52 + 高度 46 → 到战场中心的斜距约 70，到战场边缘约 85。
 * 给到 110 才能做到「在圈上指示、不下去贴脸」。
 * 对照：ATTACK_RANGE=10.5 是水晶城猎鸟用的**接敌**距离，两回事，别混。
 */
const DESIGNATE_RANGE = 110;
/** 硬性最低离地高度（米）。侦察机不许俯冲到地面高度——截屏那种贴地是事故 */
const FLEET_MIN_AGL = 30;
/** 俯仰限幅（弧度，≈23°）：机头跟速度矢量走，但侦察机不做垂直机动 */
const SCOUT_PITCH_LIMIT = 0.40;""",
    "常量")

# ---------------- 盘旋位：加入半径/高度的缓慢起伏 ----------------
rep("""    const phase = time * FLEET_ORBIT_SPEED + (index / Math.max(1, nFleet)) * Math.PI * 2;
    // 球面偏移铁律：**先乘半径再切向平移，最后归一化**
    out.copy(up).multiplyScalar(R + FLEET_SCOUT_ALT)
      .addScaledVector(_forward, Math.cos(phase) * FLEET_ORBIT_RADIUS)
      .addScaledVector(_right, Math.sin(phase) * FLEET_ORBIT_RADIUS);
    return out;""",
"""    const phase = time * FLEET_ORBIT_SPEED + (index / Math.max(1, nFleet)) * Math.PI * 2;
    // 真实的侦察盘旋圈不是节拍器：半径与高度都有缓慢起伏（换个角度看同一片地）。
    // 系数取自 index，确定性，不用 Math.random。
    const wob = index * 1.7;
    const radius = FLEET_ORBIT_RADIUS * (1 + Math.sin(phase * 0.5 + wob) * 0.14);
    const alt = FLEET_SCOUT_ALT + Math.sin(phase * 0.37 + wob) * 7;
    // 球面偏移铁律：**先乘半径再切向平移，最后归一化**
    out.copy(up).multiplyScalar(R + alt)
      .addScaledVector(_forward, Math.cos(phase) * radius)
      .addScaledVector(_right, Math.sin(phase) * radius);
    return out;""",
    "盘旋起伏")

# ---------------- 机头跟速度矢量（俯仰）----------------
rep("""  function orientAircraft(aircraft, forwardHint = null, bank = 0) {
    _up.copy(aircraft.position).normalize();
    _forward.copy(forwardHint || aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
    projectTangent(_forward, _up);
    _right.crossVectors(_up, _forward).normalize();""",
"""  /**
   * 姿态：机头指速度矢量 + 协调转弯压坡度。
   *
   * 旧版把 forward 完全投影到切平面（projectTangent），俯仰恒为 0——
   * 爬升、俯冲、贴地平移，机身姿态一模一样，看起来就像在地面上滑行。
   * 现在保留一部分径向分量（限幅 SCOUT_PITCH_LIMIT ≈ 23°）：
   * 爬升抬头、下降低头，转弯时坡度和机头一起动，才像一架在飞的飞机。
   */
  function orientAircraft(aircraft, forwardHint = null, bank = 0) {
    _up.copy(aircraft.position).normalize();
    _forward.copy(forwardHint || aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
    if (_forward.lengthSq() < 1e-10) _forward.set(0, 0, 1);
    _forward.normalize();
    const vert = _forward.dot(_up);
    const maxVert = Math.sin(SCOUT_PITCH_LIMIT);
    if (Math.abs(vert) > maxVert) {
      // 削掉超限的那部分径向分量，再归一化 → 俯仰被夹在限幅内，航向不变
      _forward.addScaledVector(_up, Math.sign(vert) * maxVert - vert).normalize();
    }
    _right.crossVectors(_up, _forward);
    // forward 与 up 几乎共线时叉积退化：退回切平面版本，别让基底塌掉
    if (_right.lengthSq() < 1e-8) {
      _forward.copy(aircraft.userData.forward || new THREE.Vector3(0, 0, 1));
      projectTangent(_forward, _up);
      _right.crossVectors(_up, _forward);
    }
    _right.normalize();""",
    "orientAircraft 俯仰")

# ---------------- moveUnit：不再把速度压平；加 AGL 下限 ----------------
rep("""  function moveUnit(unit, desired, dt, speed = SCOUT_SPEED) {""",
"""  /**
   * @param {number} minAgl 硬性最低离地高度（米）。0 = 不限（水晶城守卫沿用旧行为）
   */
  function moveUnit(unit, desired, dt, speed = SCOUT_SPEED, minAgl = 0) {""",
    "moveUnit 签名")

rep("""    unit.group.position.addScaledVector(unit.velocity, dt);
    _up.copy(unit.group.position).normalize();
    _forward.copy(unit.velocity);
    projectTangent(_forward, _up, unit.group.userData.forward);
    _axis.crossVectors(unit.group.userData.forward || _forward, _forward);""",
"""    unit.group.position.addScaledVector(unit.velocity, dt);
    _up.copy(unit.group.position).normalize();

    // ---- 硬性 AGL 下限：侦察机不许掉到地面高度 ----
    // 主人 2026-09-06 的截屏就是这条缺失的后果：三架机贴着地面停在红盔堆里。
    // 撞到下限时把**向下的速度分量**抹掉（不是弹回去），飞机会自然改平。
    if (minAgl > 0) {
      const minR = R + minAgl;
      if (unit.group.position.length() < minR) {
        unit.group.position.setLength(minR);
        const sink = unit.velocity.dot(_up);
        if (sink < 0) unit.velocity.addScaledVector(_up, -sink);
      }
    }

    // 机头跟速度矢量走（不再压平）：爬升抬头、下降低头，俯仰由 orientAircraft 限幅
    _forward.copy(unit.velocity);
    if (_forward.lengthSq() < 1e-10) _forward.copy(unit.group.userData.forward || _up);
    _forward.normalize();
    // 坡度只看**航向**的变化率，别把爬升/下降算成转弯
    _axis.copy(unit.group.userData.forward || _forward);
    _axis.crossVectors(_axis, _forward);""",
    "moveUnit AGL + 俯仰")

io.open(P, "w", encoding="utf-8").write(s)
print("patched scoutDefense.js（飞行姿态第一段）")
