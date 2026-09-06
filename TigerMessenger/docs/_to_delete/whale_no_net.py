# -*- coding: utf-8 -*-
"""去掉渔网，只留「被拉扯 / 挣脱」的手感（主人 2026-09-06）。

  「不必出现网，有那种被拉扯挣脱的感觉即可」

网本来就是我自己加的一个道具。场上**已经有**拉扯它的东西了——
saihojiPhalanx 的绳索小队每帧都在拔河，拉力还现成地汇总在
`root.userData.ropePull01` 里。与其再挂一张网，不如直接拿那股拉力当输入：
拉得越狠，鲸挣得越凶。少一个道具、少一批网线、少一个要维护的开关，
而且「被拉扯」这件事从此有了**真实来源**，不是凭空抖。

挣脱的手感靠三层叠出来：
  · **甩动**：横滚/俯仰/偏航三轴不同频的正弦，一阵一阵（原来就有）；
  · **拽沉**：整条鲸被往下拽一截又弹回来——这是「拉扯」最直接的读法；
  · **拍尾**：挣的那一下尾巴甩得最凶。
"""
import io, os

P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/whaleMaw.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 头注释 ----------------
rep("""//  在此之前鲸是**被动**的：红盔用绳索把它往下拽（saihojiPhalanx 的绳索小队）、
//  机队用光束把它往上吸，它自己一句话都没有。现在它有两手：
//    · 被网住时**挣扎**——整条鲸的甩动 + 网的绷紧回弹 + 拍尾；
//    · 谁凑到嘴边就**吞下去**，在肚子里走一趟，从尾根底下排出来，
//      出来时军服已经是一身土黄。""",
"""//  在此之前鲸是**被动**的：红盔用绳索把它往下拽（saihojiPhalanx 的绳索小队）、
//  机队用光束把它往上吸，它自己一句话都没有。现在它有两手：
//    · 被绳索拽住时**挣扎挣脱**——甩动 + 被拽沉再弹回 + 拍尾；
//    · 谁凑到嘴边就**吞下去**，在肚子里走一趟，从尾根底下排出来，
//      出来时军服已经是一身土黄。
//
//  ⚠️ 这里一度还有一张**渔网**（LineSegments 织的网罩在鲸背上）。
//  主人 2026-09-06：「不必出现网，有那种被拉扯挣脱的感觉即可」——
//  网是我自己加的道具，而场上本来就有拉扯它的东西（绳索小队的拔河，
//  拉力汇总在 saihojiPhalanx 的 root.userData.ropePull01）。
//  拿那股拉力当输入，「被拉扯」就有了真实来源，还省掉一整套网的开关与网线。""",
    "头注释")

# ---------------- 参数：删网、加拽沉 ----------------
old_par = s[s.index("export const WHALE_MAW = Object.freeze({"):s.index("  // ---- 挣扎 ----")]
new_par = """export const WHALE_MAW = Object.freeze({
"""
s = s.replace(old_par, new_par, 1)

rep("""  /** 甩动幅度（弧度）：横滚 / 俯仰 / 偏航 */
  rollAmp: 0.075,
  pitchAmp: 0.05,
  yawAmp: 0.085,""",
"""  /** 甩动幅度（弧度）：横滚 / 俯仰 / 偏航 */
  rollAmp: 0.075,
  pitchAmp: 0.05,
  yawAmp: 0.085,
  /**
   * 被拽沉的幅度（世界单位）：整条鲸被绳索拽下去一截，又挣着弹回来。
   * 这是「被拉扯」最直接的读法——只有转动的话，看起来像在原地扭，不像在被拽。
   */
  heaveAmp: 1.8,""",
    "拽沉参数")

# ---------------- 删掉 buildNet ----------------
a = s.index("/**\n * 织网：一整张 LineSegments。")
b = s.index("/**\n * 造嘴：")
s = s[:a] + s[b:]

# ---------------- applyWhaleCombatShake：加拽沉 ----------------
rep("""  whaleGroup.rotateZ(sh.roll);
  whaleGroup.rotateX(sh.pitch);
  whaleGroup.rotateY(sh.yaw);""",
"""  whaleGroup.rotateZ(sh.roll);
  whaleGroup.rotateX(sh.pitch);
  whaleGroup.rotateY(sh.yaw);
  // 拽沉：沿径向（当地的天）把整条鲸拉下去一截又弹回来。
  // 只有转动的话看起来像在原地扭；被拽下去再挣回来，才读得出「有东西在拉它」。
  if (sh.heave) {
    _shakeUp.copy(whaleGroup.position);
    if (_shakeUp.lengthSq() > 1e-8) {
      whaleGroup.position.addScaledVector(_shakeUp.normalize(), sh.heave);
    }
  }""",
    "拽沉")

rep("const _wmA = new THREE.Vector3();",
    "const _shakeUp = new THREE.Vector3();\nconst _wmA = new THREE.Vector3();",
    "临时向量")

# ---------------- 状态：netted → tug ----------------
rep("""  let whale = null;
  let net = null;
  let maw = null;
  let bulge = null;""",
"""  let whale = null;
  let maw = null;
  let bulge = null;""",
    "局部变量")

rep("""  const st = {
    netted: false,
    netT: 0,
    struggle: 0,""",
"""  const st = {
    /** 0..1，外面每帧喂进来的拉扯强度（绳索小队的拔河拉力） */
    tug: 0,
    struggle: 0,""",
    "状态")

rep("""    if (whale === w && net?.parent) return true;
    whale = w;
    if (!net) net = buildNet();""",
"""    if (whale === w && maw?.hinge?.parent === w) return true;
    whale = w;""",
    "attach 开头")

rep("""    if (net.parent !== whale) whale.add(net);
    if (bulge.parent !== whale) whale.add(bulge);
    net.visible = st.netted;
    return true;""",
"""    if (bulge.parent !== whale) whale.add(bulge);
    return true;""",
    "attach 结尾")

# ---------------- castNet / releaseNet → setTug ----------------
old_cast = s[s.index("  /** 撒网：红盔把渔网罩上来 */"):s.index("  /** 开吞：把够得着的重甲兵吸进来 */")]
new_cast = """  /**
   * 喂拉扯强度（0..1）。绳索小队的拔河拉力直接接到这里。
   * 从「没被拉」到「被拉住」的那一下，先给一记猛挣——被套住的第一反应。
   */
  function setTug(k) {
    const next = Math.max(0, Math.min(1, Number(k) || 0));
    if (next > 0.05 && st.tug <= 0.05) {
      st.struggle = 1;        // 刚被拽住：猛地一挣
      st.struggleClock = 0;
    }
    st.tug = next;
    return st.tug;
  }

"""
s = s.replace(old_cast, new_cast, 1)

# ---------------- update 里的挣扎段 ----------------
old_upd = s[s.index("    // ---------- 挣扎 ----------"):s.index("    // ---------- 吞吐状态机 ----------")]
new_upd = """    // ---------- 挣扎 ----------
    // 被绳索拽住 = 一阵一阵地挣：猛地一挣（struggle→1），指数衰减下去，
    // 隔 struggleGap 秒再来一阵。永远匀速抖动的东西读起来像机器，不像活物。
    // 挣的力度乘上当前的拉扯强度：拉得越狠挣得越凶，松了就平息。
    if (st.tug > 0.05) {
      st.struggleClock += dt;
      if (st.struggleClock >= WHALE_MAW.struggleGap) {
        st.struggleClock = 0;
        st.struggle = 1;
      }
      st.struggle *= Math.exp(-dt / WHALE_MAW.struggleTau);
    } else {
      st.struggle *= Math.exp(-dt / (WHALE_MAW.struggleTau * 0.5));
    }
    const s = st.struggle * (0.35 + 0.65 * st.tug);
    // ⚠️ 挣扎不能只在这里写一次就完事，会被鲸自己的 update 抹掉。
    // 场景按 sceneHandles 顺序更新，默认 ["messenger", "saihoji"]：
    //   messenger → saihojiPhalanx → 本函数（写甩动）
    //   saihoji   → leviathan.update → `group.quaternion.copy(poseQ)`（复位）
    // 后者在后面。所以这里把甩动量**发布**到 whale.userData.combatShake，
    // 由 saihojiGarden 在 leviathan.update **之后**再应用一次
    // （见 applyWhaleCombatShake）。这里自己也先应用一次：
    // 没有别人接手时（测试桩、只加载 messenger）这一次就够了，
    // 而有人接手时中间隔着一次复位，不会叠加成两倍。
    whale.userData.combatShake = s > 0.005
      ? {
          roll: Math.sin(st.clock * 7.3) * WHALE_MAW.rollAmp * s,
          pitch: Math.sin(st.clock * 5.1 + 1.1) * WHALE_MAW.pitchAmp * s,
          yaw: Math.sin(st.clock * 3.7 + 0.4) * WHALE_MAW.yawAmp * s,
          tailY: Math.sin(st.clock * 6.2) * 0.22 * s,
          // 拽沉：被拉下去一截又弹回来。基准偏下（−0.55），叠一层挣扎的回弹，
          // 读起来是「一直被往下拽、时不时挣起来一下」。
          heave: WHALE_MAW.heaveAmp * s * (-0.55 + 0.45 * Math.sin(st.clock * 4.1)),
        }
      : null;
    applyWhaleCombatShake(whale);

"""
s = s.replace(old_upd, new_upd, 1)

# ---------------- 出口 ----------------
rep("""    setTug,
    swallow,""", """    setTug,
    swallow,""", "占位（不改）") if False else None
old_ret = s[s.index("  return {\n    update,"):s.index("    stats: () => ({")]
new_ret = """  return {
    update,
    setTug,
    swallow,
    tug: () => st.tug,
    phase: () => st.phase,
    mouthWorld,
    ventWorld,
    parts: () => { attach(); return { maw, bulge, hinge: maw?.hinge || null }; },
"""
s = s.replace(old_ret, new_ret, 1)

rep("""    stats: () => ({
      netted: st.netted,
      struggle: +st.struggle.toFixed(3),""",
"""    stats: () => ({
      tug: +st.tug.toFixed(3),
      struggle: +st.struggle.toFixed(3),""",
    "stats")

io.open(P, "w", encoding="utf-8").write(s)
print("patched whaleMaw.js（去网 · 拉扯挣脱）")
