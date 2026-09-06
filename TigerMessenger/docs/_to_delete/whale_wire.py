# -*- coding: utf-8 -*-
"""苔庭之鲸参战（主人 2026-09-06）：
   1）被渔网束缚后的挣扎
   2）张开大嘴把重甲兵吸入腹中、再排出去；吸入时挣扎，排出后军服变土黄

这一步把三处接起来：
  A) vanguardTrooper.js：新增 soilVanguardUniform —— 军服换成土黄的一套材质；
  B) vanguardAssault.js：被吞的人不算「在场作战」，别让战斗逻辑一边把他往前推、
     鲸一边把他往嘴里吸；
  C) saihojiPhalanx.js：造 whaleMaw、每帧驱动、决定什么时候撒网 / 什么时候开吞。
"""
import io, os

# ================= A) 军服变土黄 =================
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardTrooper.js")
s = io.open(P, encoding="utf-8").read()

anchor = "export function createVanguardSquad("
assert s.count(anchor) == 1
block = '''/**
 * 军服糊成土黄（主人 2026-09-06：重甲兵「拉出去后，军服变成土黄色」）。
 *
 * 做法是**换材质引用**，不是改颜色值：`toonMat` 是按 (颜色, 选项) 缓存的，
 * 全场 27 名重甲兵共用同一批材质实例，直接 `material.color.set(...)`
 * 会把没被吞的人也一起染了。
 *
 * 换过去的那一套同样走 toonMat 缓存——所以无论多少人被吞过，
 * 全场也只多出这四个材质实例，draw call 不涨。
 * 只染军服（装甲主色 / 卡其副板 / 内衬 / 大腿红条），
 * 关节和枪身不动：那是装备，不是军服。
 */
let _soilMap = null;
function soilMap() {
  if (_soilMap) return _soilMap;
  const opt = { flatShading: true };
  _soilMap = new Map([
    [toonMat(0x4a4f55, opt), toonMat(0x8a7434, opt)], // 深灰装甲 → 土黄
    [toonMat(0x8d8375, opt), toonMat(0xa89250, opt)], // 卡其副板 → 更黄
    [toonMat(0x3a4550, opt), toonMat(0x6b5a2c, opt)], // 靛灰内衬 → 土褐
    [toonMat(0xb2402f, opt), toonMat(0x8a6a34, opt)], // 大腿红条 → 一并糊掉
  ]);
  return _soilMap;
}

/**
 * @param {THREE.Object3D} trooper 一名重甲兵
 * @returns {boolean} 是否真的染上了（已经染过的返回 false）
 */
export function soilVanguardUniform(trooper) {
  if (!trooper || trooper.userData?.uniformSoiled) return false;
  const map = soilMap();
  trooper.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const next = map.get(o.material);
    if (next) o.material = next;
  });
  trooper.userData.uniformSoiled = true;
  return true;
}

'''
s = s.replace(anchor, block + anchor, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardTrooper.js（soilVanguardUniform）")

# ================= B) 被吞的人退出战斗逻辑 =================
P2 = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P2, encoding="utf-8").read()
old = "  const aliveTroopers = () => troopersOf().filter((tr) => tr.visible && !tr.userData.dead);"
new = '''  // ⚠️ `swallowed` 也要滤掉（主人 2026-09-06：鲸会把重甲兵吸进肚子里）。
  // 光靠 `visible` 不够：被吸进去的那两三秒人还在画面上挣扎，
  // 这边的推进逻辑一边把他往敌人那儿挪、鲸那边一边把他往嘴里拽，
  // 两个作者抢同一个 position，人就会在半空抽搐着原地不动。
  const aliveTroopers = () =>
    troopersOf().filter((tr) => tr.visible && !tr.userData.dead && !tr.userData.swallowed);'''
assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P2, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（swallowed 退出战斗）")

# ================= C) 接进苔庭方阵 =================
P3 = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/saihojiPhalanx.js")
s = io.open(P3, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# import
imp = 'import { PLANET_RADIUS } from "./planet.js";'
if imp in s:
    rep(imp, imp + '\nimport { createWhaleMaw } from "./whaleMaw.js";', "import")
else:
    # 退回到第一处 import 之后插入
    i = s.index("\n", s.index("import "))
    s = s[:i + 1] + 'import { createWhaleMaw } from "./whaleMaw.js";\n' + s[i + 1:]

# 造对象：挂在绳索小队那一段之前（同属「红盔对鲸的手段」）
anchor2 = "  // ---------- 绳索小队：告警后抛绳挂鲸身、拔河式拉回地面 ----------"
rep(anchor2, '''  // ---------- 苔庭之鲸参战（主人 2026-09-06）----------
  //  在此之前鲸是**被动**的：红盔用绳索把它往下拽、机队用光束把它往上吸，
  //  它自己一句话都没有。现在它有两手——被网住时挣扎，谁凑到嘴边就吞下去。
  //  具体动作全在 whaleMaw.js；这里只负责「什么时候撒网 / 什么时候开吞」。
  const whaleMaw = createWhaleMaw({
    scene,
    getWhale: () => scene.getObjectByName("leviathanGroup"),
    getTroopers: () => liveVanguards,
    groundHeightAt: (dir) => groundHeightAt(dir),
    spawnSmoke,
  });
  /** 撒网的时机：绳索小队已经挂上、鲸又挣了一会儿，红盔才把渔网罩上来 */
  let netDelay = 0;
  /** 开吞的节流：由 whaleMaw 自己的冷却兜底，这里只是别每帧敲门 */
  let mawPoke = 0;

''' + anchor2, "造 whaleMaw")

# 每帧驱动：紧跟 updateRopeTeams
rep("""    updateRopeTeams(dt, t);""",
"""    updateRopeTeams(dt, t);

    // ---------- 鲸的反击 ----------
    // ⚠️ 必须排在鲸自己的 update 之后。leviathanIsland 每帧
    // `group.quaternion.copy(poseQ)` 把姿态复位，挣扎的甩动写在它前面会被抹掉。
    // 本文件的 update 由场景在 leviathan.update 之后调用，所以这里是安全的。
    {
      // 撒网：绳索已经挂上、拔河进行了一会儿，红盔才把渔网罩上去。
      // 鲸落地（whaleUp 转 false）就收网——躺在地上的鲸不需要再网。
      if (whaleUp && ropesDispatched) {
        netDelay += dt;
        if (netDelay > 6 && !whaleMaw.isNetted()) whaleMaw.castNet();
      } else {
        netDelay = 0;
        if (whaleMaw.isNetted()) whaleMaw.releaseNet();
      }
      // 开吞：网住之后才动嘴——先被激怒，再还手，读起来才有因果。
      // 够不够得着由 whaleMaw 自己判断（嘴前方 + 射程内），这里只定节奏。
      mawPoke -= dt;
      if (whaleMaw.isNetted() && mawPoke <= 0) {
        mawPoke = 2.0;
        whaleMaw.swallow();
      }
      whaleMaw.update(dt, t);
    }""",
    "每帧驱动")

# 对外暴露（控制台/测试可驱动验收）
rep("    root.userData.groundHeightAt = groundHeightAt;",
    "    root.userData.groundHeightAt = groundHeightAt;\n    root.userData.whaleMaw = whaleMaw; // 控制台/测试可驱动：castNet() / swallow() / stats()",
    "暴露句柄")

io.open(P3, "w", encoding="utf-8").write(s)
print("patched saihojiPhalanx.js（撒网 / 开吞 / 逐帧）")
