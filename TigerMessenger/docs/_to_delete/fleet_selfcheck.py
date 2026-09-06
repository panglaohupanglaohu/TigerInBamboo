# -*- coding: utf-8 -*-
"""舰队自检：一行命令看清 aircraft / 泡机 / 运输艇 / 重甲兵各在哪、跟没跟上。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/main.js")
s = io.open(P, encoding="utf-8").read()

old = """window.__tm = {
  THREE, // 控制台调试用：new __tm.THREE.Raycaster() 等"""
new = """/**
 * 舰队自检（主人 2026-09-05 反复反馈「没形成以 aircraft 为主导的舰队 / 没伴飞」）。
 *
 * 之前每轮都是「我改代码 → 主人看画面 → 还是不像」，没有中间那把尺子，
 * 谁也说不清是逻辑没接上、还是浏览器还在跑旧模块、还是当下正处在任务的某一段。
 * 这个函数就是那把尺子：**只读**，按名字从场景里现取，不依赖任何内部句柄。
 *
 *   __tm.fleet()
 *
 * 读法：
 *   · aircraft.n  = 0            → 机队根本没建，后面都不用看
 *   · pods.strayed > 0           → 泡机掉在 scene 下没回僚机翼，不会伴飞
 *   · haulers.visible = 0 且 phase 为 idle/done → 运输艇没在随队巡航
 *   · haulers.dist 很大且不收敛   → 跟位没生效
 *   · phase 一直停在某一段         → 任务卡住了，去看 vanguardAssault
 */
function fleetSelfCheck() {
  const V3 = THREE.Vector3;
  const squad = scene.getObjectByName("moebius-aircraft-squad");
  const members = (squad?.userData?.members || []).filter((m) => m?.parent);
  const wing = squad?.userData?.gatePodEscort || null;
  const pods = [];
  scene.traverse((o) => { if (o.userData?.escortSlot) pods.push(o); });
  const haulers = [];
  scene.traverse((o) => { if (/^vanguard-hauler-/.test(o.name || "")) haulers.push(o); });
  const troops = scene.getObjectByName("vanguard-squad");

  const center = new V3();
  for (const m of members) center.add(m.getWorldPosition(new V3()));
  if (members.length) center.multiplyScalar(1 / members.length);
  const groundTrack = members.length
    ? center.clone().normalize().multiplyScalar(PLANET_RADIUS)
    : null;
  const dist = (o) => (groundTrack ? +o.getWorldPosition(new V3()).distanceTo(groundTrack).toFixed(1) : null);

  // messenger 是 sceneHandles 里的场景句柄，vanguardAssault 挂在它身上（main.js:1780 已注明）
  const assault = messenger?.vanguardAssault || messenger?.combatPack?.vanguardAssault || null;
  return {
    phase: assault?.phase?.() ?? "(无 vanguardAssault)",
    aircraft: { n: members.length, center: center.toArray().map((v) => +v.toFixed(1)) },
    pods: {
      n: pods.length,
      inWing: pods.filter((p) => wing && p.parent === wing).length,
      strayed: pods.filter((p) => !wing || p.parent !== wing).length,
      dist: pods.map(dist),
    },
    haulers: {
      n: haulers.length,
      visible: haulers.filter((h) => h.visible).length,
      dist: haulers.map(dist),
    },
    troopers: { visible: !!troops?.visible, state: troops?.userData?.state ?? "(无)" },
  };
}

window.__tm = {
  THREE, // 控制台调试用：new __tm.THREE.Raycaster() 等
  fleet: fleetSelfCheck, // 舰队自检：__tm.fleet()——见上方读法"""
assert old in s, "__tm 未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("__tm.fleet() 已加")
