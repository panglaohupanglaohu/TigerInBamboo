# -*- coding: utf-8 -*-
"""修一个**顺序**上的真错：挣扎会被鲸自己的 update 每帧抹掉。

场景是按 sceneHandles 的顺序逐个 update 的，默认顺序是 ["messenger", "saihoji"]：
  messenger → saihojiPhalanx → whaleMaw（写挣扎的甩动）
  saihoji   → leviathan.update → `group.quaternion.copy(poseQ)`（把姿态复位）
后者在后面，于是挣扎每一帧刚写上就被抹掉，画面上一动不动——
`node --check` 查不出来，测试里也查不出来（测试只跑 whaleMaw 一家，没有鲸的 update）。

解法不是去调场景顺序（那会牵动所有场景），而是把挣扎**发布**出来：
  · whaleMaw 每帧把甩动量写进 whale.userData.combatShake，并且自己先应用一次
    （没有别人接手时，比如测试桩，这一次就够了）；
  · saihojiGarden 在 `leviathan.update()` **之后**——也就是姿态刚被复位的那一刻——
    再应用一次。中间隔着一次复位，所以不会叠加成两倍。
两种加载组合（单 messenger / messenger+saihoji）下表现一致。
"""
import io, os

# ---------------- 1) whaleMaw：发布 + 自应用 ----------------
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/whaleMaw.js")
s = io.open(P, encoding="utf-8").read()

old = """    const s = st.struggle;
    if (s > 0.005) {
      // ⚠️ 用 rotateX/Y/Z（在**当前**姿态上叠加），不是写 rotation.x——
      // 鲸的姿态是 quaternion 摆的，直接写欧拉角会把它整条覆盖掉。
      whale.rotateZ(Math.sin(st.clock * 7.3) * WHALE_MAW.rollAmp * s);
      whale.rotateX(Math.sin(st.clock * 5.1 + 1.1) * WHALE_MAW.pitchAmp * s);
      whale.rotateY(Math.sin(st.clock * 3.7 + 0.4) * WHALE_MAW.yawAmp * s);
      // 拍尾：挣扎时尾巴甩得最凶（尾柄本来就有慢摆，这里叠上去）
      const tail = whale.getObjectByName("leviathan-tail-root");
      if (tail) tail.rotation.y += Math.sin(st.clock * 6.2) * 0.22 * s;
    }"""
new = """    const s = st.struggle;
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
        }
      : null;
    applyWhaleCombatShake(whale);"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

# 导出应用函数
anchor = "const _wmA = new THREE.Vector3();"
helper = '''/**
 * 把 whaleMaw 发布的挣扎甩动应用到鲸身上。
 *
 * **必须在鲸自己的 update 之后调用**——leviathanIsland 的 update 每帧
 * `group.quaternion.copy(poseQ)` 把姿态复位，在它之前写的甩动会被整条抹掉。
 * saihojiGarden 里紧跟 `leviathan.update(dt, t)` 调一次即可（那儿本来就有
 * 一处「落地震颤」的 rotateX/rotateZ，排在同一个位置）。
 *
 * 幂等的前提是「中间隔着一次复位」：连着调两次会叠加，别那么用。
 *
 * @param {THREE.Object3D|null} whaleGroup
 * @returns {boolean} 这一帧有没有挣扎
 */
export function applyWhaleCombatShake(whaleGroup) {
  const sh = whaleGroup?.userData?.combatShake;
  if (!sh) return false;
  // 用 rotateX/Y/Z（在**当前**姿态上叠加），不是写 rotation.x——
  // 鲸的姿态是 quaternion 摆的，直接写欧拉角会把它整条覆盖掉。
  whaleGroup.rotateZ(sh.roll);
  whaleGroup.rotateX(sh.pitch);
  whaleGroup.rotateY(sh.yaw);
  // 拍尾：挣扎时尾巴甩得最凶（尾柄本来就有慢摆，这里叠上去）
  const tail = whaleGroup.getObjectByName("leviathan-tail-root");
  if (tail) tail.rotation.y += sh.tailY;
  return true;
}

const _wmA = new THREE.Vector3();'''
assert s.count(anchor) == 1
s = s.replace(anchor, helper, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched whaleMaw.js（发布 + 自应用）")

# ---------------- 2) saihojiGarden：鲸 update 之后再应用一次 ----------------
P2 = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/scenes/saihojiGarden.js")
s = io.open(P2, encoding="utf-8").read()
old2 = "      leviathan.update(dt, t);"
assert s.count(old2) == 1
new2 = """      leviathan.update(dt, t);
      // 苔庭之鲸参战（主人 2026-09-06）：把 whaleMaw 发布的挣扎甩动补上。
      // ⚠️ 必须在这一行**之后**——leviathan.update 刚刚把姿态复位成 poseQ，
      // 写在它之前的甩动会被整条抹掉（场景更新顺序是 messenger 在前、saihoji 在后，
      // 而 whaleMaw 挂在 messenger 那一侧的苔庭方阵里）。
      applyWhaleCombatShake(leviathanGroup);"""
s = s.replace(old2, new2, 1)
imp = 'import { PLANET_RADIUS } from "../world/planet.js";'
assert s.count(imp) == 1
s = s.replace(imp, imp + '\nimport { applyWhaleCombatShake } from "../world/whaleMaw.js";', 1)
io.open(P2, "w", encoding="utf-8").write(s)
print("patched saihojiGarden.js（复位之后再应用）")
