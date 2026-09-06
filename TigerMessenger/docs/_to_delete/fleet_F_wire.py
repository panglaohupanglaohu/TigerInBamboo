# -*- coding: utf-8 -*-
"""F②：把 3 架侦察机接进舰队（战场中心 = 主舰地面投影；曳光指示 → 优先打击名单）。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/scenes/messengerIsland.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("""    const scoutDefense = createScoutDefenseSquad({
      scene,
      radius: R,
      moebius: moebiusPack.moebius,""",
"""    // 舰队分队的两个后期绑定：combatPack 在下面才创建，先留个引用槽。
    // 侦察机每帧才去读它，所以「创建顺序」和「使用顺序」可以错开——
    // 硬要把 scoutDefense 挪到 combatPack 之后会打乱废弃之门那一块的装配顺序。
    let combatPackRef = null;
    /** 战场中心 = 主舰（莫比斯机队）的地面投影。「随主舰移动」在侦察机这一侧的落点 */
    const fleetAnchorDir = (() => {
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
    })();

    const scoutDefense = createScoutDefenseSquad({
      scene,
      radius: R,
      moebius: moebiusPack.moebius,""",
 "前置绑定")

rep("""      surfacePosition: tripleGateSample?.position,
      count: 5,
    });""",
"""      surfacePosition: tripleGateSample?.position,
      count: 5,
      // 主人 2026-09-06：抽 3 架编入莫比斯舰队（前出侦查 + 曳光指示），
      // 水晶城留 2 架守原岗——两条故事线都保住。
      fleetCount: 3,
      getFleetAnchor: fleetAnchorDir,
      getFleetTargets: () => combatPackRef?.vanguardAssault?.tourTargets?.() || [],
      // 分工制：曳光只标记，标出来的东西推进舰队的优先打击名单，
      // 由泡机（麻醉）/ 重甲兵（射击格斗）/ 登陆艇（撞飞）各打各的。
      onDesignate: (object) => {
        combatPackRef?.vanguardAssault?.onFleetUnderAttack?.(object, null);
      },
    });""",
 "舰队选项")

rep("""    const combatPack = loadCitadelCombat({""",
"""    // eslint-disable-next-line prefer-const
    const combatPack = loadCitadelCombat({""",
 "combatPack 标注")

rep("""      vanguardAssault: combatPack.vanguardAssault, // 控制台可经 __tm 句柄驱动验收""",
"""      vanguardAssault: combatPack.vanguardAssault, // 控制台可经 __tm 句柄驱动验收""",
 "锚点（不改）")

io.open(P, "w", encoding="utf-8").write(s)

# combatPackRef 赋值：紧跟 combatPack 创建之后
s = io.open(P, encoding="utf-8").read()
i = s.index("    const combatPack = loadCitadelCombat({")
j = s.index("\n", s.index("});", i))
s = s[:j + 1] + "    combatPackRef = combatPack; // 侦察机的舰队分队从这一刻起能读到任务状态\n" + s[j + 1:]
io.open(P, "w", encoding="utf-8").write(s)
print("patched messengerIsland.js")
