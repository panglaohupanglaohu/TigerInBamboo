# -*- coding: utf-8 -*-
"""把月亮接进月亮湖（主人 2026-09-06：「在地标月亮湖构建如图所示那么大的月亮模型」）。

三处改动：
  1) lake.js：createMoonLake 里造月亮，随 lake 一起返回；
  2) lake.js：updateLakeFx 里驱动它（浮沉/昼夜/月光路朝观察者）；
  3) updateIsland.js：**把 updateLakeFx 接上主循环**——
     这个函数原来全仓库没有一个调用点，湖里的涟漪、涉水水花、倒影呼吸
     写好了却从来没跑过。月亮的逐帧要挂在这儿，顺手把那三样一起救活。
"""
import io, os

# ---------------- 1) lake.js ----------------
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/lake.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep('import { WORLD_SCALE } from "./worldScale.js";',
    'import { WORLD_SCALE } from "./worldScale.js";\nimport { createMoonOrb } from "./moonOrb.js";',
    "import")

rep("""  scene.add(g);

  // 深水碰撞体（世界坐标，切向阻挡与资产同一套）""",
"""  // 月亮：湖的同名主角（主人 2026-09-06）。挂在 g 下——g 已经把
  // 「径向 = 局部 +Y、切平面 = 局部 XZ」摆好了，月亮用平面坐标即可。
  // 尺寸/站位/张角的推导见 moonOrb.js 顶部注释。
  const moonOrb = createMoonOrb(g);

  scene.add(g);

  // 深水碰撞体（世界坐标，切向阻挡与资产同一套）""",
    "造月亮")

rep("""    ripples,
    splashes,
    reflect,
    _splashCooldown: 0,
  };""",
"""    ripples,
    splashes,
    reflect,
    moonOrb,
    _splashCooldown: 0,
  };""",
    "返回值")

rep("""export function updateLakeFx(lake, player, t, dt) {
  if (!lake) return;
""",
"""export function updateLakeFx(lake, player, t, dt) {
  if (!lake) return;

  // 月亮：浮沉呼吸 + 昼夜强度 + 月光路朝观察者铺开。
  // 玩家坐标要换到湖局部（月光路是在切平面里摆的）——下面涉水水花那段
  // 也要做同一次换算，所以这里先算一次，两边共用。
  let viewerLocal = null;
  if (player?.position) {
    _quatInv.copy(lake.group.quaternion).invert();
    viewerLocal = _local.copy(player.position).sub(lake.group.position).applyQuaternion(_quatInv);
  }
  lake.moonOrb?.update?.(t, dt, viewerLocal);
""",
    "月亮逐帧")

# 涉水水花那段原本没有 player 空值保护；updateLakeFx 现在真的会被每帧调用了，
# 加载途中 player 还没就位的那几帧不能让它抛。
rep("""  // 涉水水花：在浅水且移动时从池中取粒子
  const wading = (player.wadeFactor || 1) < 0.99;""",
"""  // 涉水水花：在浅水且移动时从池中取粒子
  // ⚠️ player 可能还没就位（场景装配途中、桩环境）：这个函数以前全仓库
  // 没有调用点，所以从没被这种情况打到过；现在接上主循环了，必须防。
  const wading = ((player?.wadeFactor) || 1) < 0.99;""",
    "player 空值保护")

io.open(P, "w", encoding="utf-8").write(s)
print("patched lake.js")

# ---------------- 2) updateIsland.js ----------------
P2 = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/scenes/messenger/updateIsland.js")
s = io.open(P2, encoding="utf-8").read()
assert 'import { updateClouds } from "../../assets/lowPoly.js";' in s
s = s.replace('import { updateClouds } from "../../assets/lowPoly.js";',
              'import { updateClouds } from "../../assets/lowPoly.js";\nimport { updateLakeFx } from "../../world/lake.js";', 1)

old = """  s.canalLakeLink?.update?.(dt, t);"""
new = """  // 月亮湖：月亮的浮沉/昼夜/月光路，外加涟漪、涉水水花、倒影呼吸。
  // ⚠️ updateLakeFx 在 2026-09-06 之前**全仓库没有一个调用点**——
  // 涟漪、水花、倒影三样都写好了却从来没跑过。接月亮的时候顺手接上。
  if (s.moonLake) updateLakeFx(s.moonLake, runtime?.player, t, dt);

  s.canalLakeLink?.update?.(dt, t);"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s)
print("patched updateIsland.js")
