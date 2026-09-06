# -*- coding: utf-8 -*-
"""坐在载具上不该还能按 E 跟地面上的人交互。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, f"{rel} 未匹配：{why}"
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ---------------------------------------------------------------- main.js
edit("main.js", [
("""// ---------- 任务（依赖平台；无 messenger 场景时任务仍可创建但不贴台） ----------
const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
});""",
"""/**
 * 送信人是否正在**驾驶载具**（飞艇 / 飞行器 / 侦察机 / 气泡艇 / 小船）。
 *
 * 为什么所有 E 键交互都要过这道闸：搭乘期间 `player.position` 被载具接管
 * （`airshipRide` 每帧 `player.position.copy(seat)`），于是「离 NPC 多近」量的
 * 其实是**座位**离 NPC 多近。飞艇停在村口、人坐在船上，按 E 就能隔着船舷跟
 * 地上的居民接信送信——主人 2026-09-05 报的就是这个。
 *
 * **电车不算**：那是公共交通，玩家是乘客不是驾驶员，阿狸还会跟着上车卧在
 * 身旁，车上聊天是原本就有的设计，不能顺手一起封掉。
 *
 * 写成函数声明（会提升）而不是 const 箭头：`quest` 在这些 ride 之前就构造了，
 * 只有提升过的函数名才能被它安全地闭包捕获。
 */
function isPlayerPilotingVehicle() {
  const air = airshipRide?.getState?.();
  if (air && air !== "idle") return true;
  if (aircraftRide?.isRiding?.()) return true;
  if (scoutAircraftRide?.isRiding?.()) return true;
  if (bubblePodRide?.isRiding?.()) return true;
  if (boatRide?.isRiding?.()) return true;
  return false;
}

// ---------- 任务（依赖平台；无 messenger 场景时任务仍可创建但不贴台） ----------
const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
  isBusyRiding: isPlayerPilotingVehicle,
});""", "quest 注入"),

("""  elHint: document.getElementById("elder-hint"),
  isGameStarted: () => gameStarted,
});""",
"""  elHint: document.getElementById("elder-hint"),
  isGameStarted: () => gameStarted,
  isBusyRiding: isPlayerPilotingVehicle,
});""", "elderMusic 注入"),

("""  camera,
  isGameStarted: () => gameStarted,
  elHint: document.getElementById("fox-hint"),
  planetRadius: PLANET_RADIUS,""",
"""  camera,
  isGameStarted: () => gameStarted,
  isBusyRiding: isPlayerPilotingVehicle,
  elHint: document.getElementById("fox-hint"),
  planetRadius: PLANET_RADIUS,""", "foxNpc 注入"),
])

# ---------------------------------------------------------------- questSystem
edit("quest/questSystem.js", [
("export function createQuestSystem({ scene, platforms, player, messengerMesh, holdAura, camera, isGameStarted }) {",
 "export function createQuestSystem({\n"
 "  scene, platforms, player, messengerMesh, holdAura, camera, isGameStarted,\n"
 "  /** 送信人是否正在驾驶载具——是则不许接信/送信（见 main.js 的同名闸） */\n"
 "  isBusyRiding = () => false,\n"
 "}) {", "签名"),
("""  function currentTarget() {
    const q = QUEST_DEFS[questIndex];
    if (!q) return null;""",
 """  function currentTarget() {
    // 坐在飞艇/飞行器/小船上不算「站在居民面前」：搭乘期 player.position 是座位，
    // 载具停在村口就会落进 talkRange，隔着船舷接信送信。
    // 闸放在这里而不是 keydown 里：提示气泡与「[E] 与居民交谈」一并跟着消失。
    if (isBusyRiding()) return null;
    const q = QUEST_DEFS[questIndex];
    if (!q) return null;""", "currentTarget 闸"),
])

# ---------------------------------------------------------------- elderMusic
edit("world/elderMusic.js", [
("export function createElderMusicInteraction({ player, elder: elderInit, elHint, isGameStarted }) {",
 "export function createElderMusicInteraction({\n"
 "  player, elder: elderInit, elHint, isGameStarted,\n"
 "  /** 送信人是否正在驾驶载具——是则不许隔着船舷听八音盒 */\n"
 "  isBusyRiding = () => false,\n"
 "}) {", "签名"),
("""  function nearElder() {
    // 老人可能挂在码头等子节点下，须用世界坐标判断近身
    if (!elder) return false;""",
 """  function nearElder() {
    // 老人可能挂在码头等子节点下，须用世界坐标判断近身
    if (!elder) return false;
    if (isBusyRiding()) return false; // 坐在载具上不算近身（见 main.js 的同名闸）""", "nearElder 闸"),
])

# ---------------------------------------------------------------- foxNpc
edit("world/foxNpc.js", [
("""  isElderNear = () => false,
  isQuestNear = () => false,
  isPlayerOnTram = () => false,""",
 """  isElderNear = () => false,
  isQuestNear = () => false,
  /** 送信人是否正在**驾驶**载具——电车不算（阿狸会跟着上车卧在身旁） */
  isBusyRiding = () => false,
  isPlayerOnTram = () => false,""", "签名"),
("""  function nearTalk() {
    const range = P.talkRange ? Math.max(P.talkRange, TALK_RANGE) : TALK_RANGE;
    return distToPlayer() <= range;
  }""",
 """  function nearTalk() {
    // 驾驶载具时不算近身：座位落进 talkRange 会让人在飞艇上跟阿狸对话。
    // 电车不在此列——那是公共交通，阿狸本来就会跟上车。
    if (isBusyRiding()) return false;
    const range = P.talkRange ? Math.max(P.talkRange, TALK_RANGE) : TALK_RANGE;
    return distToPlayer() <= range;
  }""", "nearTalk 闸"),
])
print("done")
