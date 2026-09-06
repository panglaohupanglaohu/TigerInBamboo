# -*- coding: utf-8 -*-
"""gateHaulerCraft 按**气垫船**来开（主人 2026-09-06：「抢滩登陆，稳重如山」）。

跟位这一段原来是 k=1.1 的指数趋近，直接盯着机队中心的地面投影。
苔庭鲸把主舰拽得上下俯冲时，那个投影每一帧都在跳，气垫艇就跟着抽搐——
主人说的「跟着莫比斯 aircraft 拉扯癫狂」，在艇这一侧是这么来的。

气垫船（LCAC 那一类）的质量感来自两件事：
  · **它有几十吨**。航向和位置都不会突变，外面怎么闹它按自己的节奏推进；
  · **它贴着水面**。高度由海面决定，不由跟随目标决定。

所以这里加一道低通：跟的是机队中心的**平滑值**（时间常数 ~2.6s），
不是每帧的瞬时值；跟位增益也压到 0.55。主舰在天上翻跟头，艇在海面上照直开。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""    _o1.multiplyScalar(1 / members.length);
    if (_o1.lengthSq() < 1e-8) return;
    _fleetDir.copy(_o1).normalize();""",
"""    _o1.multiplyScalar(1 / members.length);
    if (_o1.lengthSq() < 1e-8) return;
    _fleetDir.copy(_o1).normalize();

    // ---- 低通：气垫船「稳重如山」的全部实现（主人 2026-09-06）----
    // 跟的是机队中心的**平滑值**，不是每帧的瞬时值。
    // 苔庭鲸把主舰拽得上下俯冲时，瞬时投影每帧都在跳；照着它开，
    // 几十吨的气垫艇就变成了被绳子牵着的浮标——「跟着莫比斯 aircraft 癫狂」。
    // 时间常数 CRUISE_SMOOTH_TAU 秒：主舰的高频动作被滤掉，
    // 真正的转场（低频）照样跟得上。
    if (!st.cruiseSmooth) st.cruiseSmooth = _fleetDir.clone();
    {
      const a = dt > 0 ? 1 - Math.exp(-dt / CRUISE_SMOOTH_TAU) : 1;
      st.cruiseSmooth.lerp(_fleetDir, a).normalize();
      _fleetDir.copy(st.cruiseSmooth);
    }""",
    "低通")

rep("      chaseObj(craft, _c4, k, 1.1, 0.5);",
    "      chaseObj(craft, _c4, k, CRUISE_FOLLOW_K, 0.5);",
    "跟位增益")

rep("const HOLD_EXTEND_MAX = 120;",
"""const HOLD_EXTEND_MAX = 120;
/** 气垫艇跟位的低通时间常数（秒）。主人 2026-09-06：「稳重如山」 */
const CRUISE_SMOOTH_TAU = 2.6;
/** 气垫艇跟位增益（1/s）。1.1 → 0.55：几十吨的东西不会说停就停 */
const CRUISE_FOLLOW_K = 0.55;""",
    "常量")

rep("    cruiseFwd: null,", "    cruiseFwd: null,\n    cruiseSmooth: null,", "st.cruiseSmooth")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（气垫船：低通 + 重增益）")
