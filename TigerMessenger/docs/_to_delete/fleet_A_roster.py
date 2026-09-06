# -*- coding: utf-8 -*-
"""A：编成改成主人 2026-09-06 定的 27 人。

  泡机 3 台 × 2 名 = 6   —— 快速突击型，每台一前一后（前后型战斗）
  登陆艇 3 艘 × 7 名 = 21 —— 每艘留守 1 名，参战 6 名 = 2 个三人小组（三三制）
  合计 27 = 24 参战 + 3 看护

旧编成是 22（2 组 × 10 三三制 + 2 名按 uid>=20 挑出来的看护）。旧口径有两个
结构性毛病，这次一并去掉：
  · 看护是按「uid 大于某个数」挑的，跟他坐哪条艇没关系——撤离时"回自己乘来的
    那艘艇"就对不上号；
  · 索降下去的 6 个人混在三三制方阵里，没有「突击对」这个概念。
现在改成按**载具**编组：uid 段直接决定他上哪台泡机/哪条艇、坐第几个位子。
"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 多处匹配：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ============================================================ vanguardTrooper.js
edit("TigerMessenger/src/world/vanguardTrooper.js", [
("export const VANGUARD_SQUAD_SIZE = 22;",
 """export const VANGUARD_SQUAD_SIZE = 27;

/**
 * 花名册版图（主人 2026-09-06 定的舰队编成）——**唯一真相**。
 *
 *   uid  0.. 5：泡机突击兵。3 台 × 2 名，每台一前一后（前后型快速突击）
 *   uid  6..26：登陆艇兵。3 艘 × 7 名，每艘第 7 名（seat 6）留守看护
 *
 * 谁上哪台车、坐第几个位子，全部由 uid 一次算出。这不是为了好看：撤离时
 * 「回自己乘来的那艘艇」、回收时「谁归哪台泡机的绳子」都要靠这个映射，
 * 旧口径把看护定义成「uid ≥ 20」，跟载具无关，于是这两件事永远对不上号。
 *
 * @param {number} uid
 * @returns {{kind:"pod"|"hauler", vehicle:number, seat:number, lead:boolean, guard:boolean}}
 */
export function vanguardRosterSlot(uid) {
  const i = Math.max(0, uid | 0);
  const podSeats = VANGUARD_FORMATION.assaultPods * VANGUARD_FORMATION.perAssaultPod; // 6
  if (i < podSeats) {
    const seat = i % VANGUARD_FORMATION.perAssaultPod;
    return {
      kind: "pod",
      vehicle: Math.floor(i / VANGUARD_FORMATION.perAssaultPod),
      seat,
      lead: seat === 0,   // 前位：突击对里冲在前面的那个
      guard: false,
    };
  }
  const k = i - podSeats;
  const per = VANGUARD_FORMATION.perHaulerSeats; // 7
  const seat = k % per;
  return {
    kind: "hauler",
    vehicle: Math.floor(k / per),
    seat,
    lead: seat === 0,     // 每艇第一个人当组长
    guard: seat === per - 1, // 最后一个位子＝留守看护
  };
}""",
 "SQUAD_SIZE + 花名册"),

("""export const VANGUARD_FORMATION = Object.freeze({
  groups: 2,
  perGroup: 10,
  teamsPerGroup: 3,
  perTeam: 3,""",
 """export const VANGUARD_FORMATION = Object.freeze({
  // 三三制的最小单位是**三人小组**。一艘登陆艇下 6 名参战兵 = 2 个三人小组，
  // 三艘艇就是 3 组 × 2 小组 = 18 人。按艇分组而不是按人数硬切，
  // 是为了让「哪条艇下来的人、撤离时回哪条艇」在编成上就成立。
  groups: 3,          // 一艇一组
  perGroup: 6,        // 每艇参战 6（第 7 名留守看护，不进阵型）
  teamsPerGroup: 2,
  perTeam: 3,
  /** 每艘登陆艇的实际座位数（含那名留守看护） */
  perHaulerSeats: 7,
  /** 泡机突击对：3 台 × 2 名，不进三三制方阵，另走前后型突击 */
  assaultPods: 3,
  perAssaultPod: 2,
  /** 突击对前出距离（米）：压在三三制阵列前方，先接敌 */
  assaultLead: 7.5,
  /** 突击对内前后两人的间距（米） */
  assaultPairGap: 2.6,""",
 "FORMATION"),

# ---------------- assignVanguardFireteams 重写 ----------------
("""export function assignVanguardFireteams(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  const { groups: G, perGroup, teamsPerGroup, perTeam } = VANGUARD_FORMATION;
  const groups = [];
  for (let g = 0; g < G; g++) {
    const slice = troopers.slice(g * perGroup, (g + 1) * perGroup);
    const teams = [];
    for (let ti = 0; ti < teamsPerGroup; ti++) teams.push([]);
    let leader = null;
    slice.forEach((tr, i) => {
      tr.userData.group = g;
      if (i === 0) {
        // 每组第一个人当组长
        tr.userData.role = "leader";
        tr.userData.team = -1;
        tr.userData.slot = -1;
        leader = tr;
        return;
      }
      const k = i - 1;                       // 0..8
      const ti = Math.floor(k / perTeam);    // 0/1/2
      const slot = k % perTeam;              // 0/1/2
      tr.userData.role = "member";
      tr.userData.team = ti;
      tr.userData.slot = slot;
      teams[ti].push(tr);
    });
    groups.push({ index: g, leader, teams, all: slice });
  }
  squadRoot.userData.formation = { groups };
  return { groups };""",
 """export function assignVanguardFireteams(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  const { groups: G, teamsPerGroup, perTeam } = VANGUARD_FORMATION;
  const groups = [];
  for (let g = 0; g < G; g++) {
    groups.push({ index: g, leader: null, teams: Array.from({ length: teamsPerGroup }, () => []), all: [] });
  }
  const assault = [];

  for (const tr of troopers) {
    const slot = vanguardRosterSlot(tr.userData.uid ?? 0);
    tr.userData.vehicleSlot = slot;
    // 看护身份在这里一次定死。旧代码写在 vanguardAssault.setupMission 里
    // （`uid >= 20`），跟他坐哪条艇无关——撤离时「回自己乘来的那艘艇」对不上号。
    tr.userData.vehicleGuard = slot.guard;

    if (slot.kind === "pod") {
      // 泡机突击兵：不进三三制方阵，走前后型突击对
      tr.userData.role = "assault";
      tr.userData.group = -1;
      tr.userData.team = -1;
      tr.userData.slot = slot.seat;
      tr.userData.pod = slot.vehicle;
      assault.push(tr);
      continue;
    }
    tr.userData.pod = -1;
    if (slot.guard) {
      // 留守看护：守在自己那艘艇旁，不进阵型（updateVanguardAdvance 会跳过）
      tr.userData.role = "guard";
      tr.userData.group = slot.vehicle;
      tr.userData.team = -1;
      tr.userData.slot = -1;
      continue;
    }
    const g = Math.min(G - 1, slot.vehicle);
    const ti = Math.floor(slot.seat / perTeam) % teamsPerGroup;
    const inner = slot.seat % perTeam;
    tr.userData.role = slot.lead ? "leader" : "member";
    tr.userData.group = g;
    tr.userData.team = ti;
    tr.userData.slot = inner;
    groups[g].teams[ti].push(tr);
    groups[g].all.push(tr);
    if (slot.lead) groups[g].leader = tr;
  }

  squadRoot.userData.formation = { groups, assault };
  return { groups, assault };""",
 "assignVanguardFireteams"),

# ---------------- vanguardFormationOffset ----------------
("""  const { teamSpacing, teamGap, groupGap } = VANGUARD_FORMATION;
  const g = trooper.userData.group ?? 0;
  const groupOff = (g - (VANGUARD_FORMATION.groups - 1) / 2) * groupGap;
  if (trooper.userData.role === "leader") {
    return { right: groupOff, forward: teamGap * 0.55 };
  }
  const ti = trooper.userData.team ?? 0;""",
 """  const { teamSpacing, teamGap, groupGap, assaultLead, assaultPairGap } = VANGUARD_FORMATION;
  // 泡机突击对（主人 2026-09-06：「快速突击型 前后型战斗」）：
  // 不进三三制方阵，三对人压在阵列前方横排，每对一前一后。
  // 前出是有战术含义的——他们是索降下来的，落点本就在敌人跟前。
  if (trooper.userData.role === "assault") {
    const pod = trooper.userData.pod ?? 0;
    const lead = (trooper.userData.slot ?? 0) === 0;
    return {
      right: (pod - (VANGUARD_FORMATION.assaultPods - 1) / 2) * assaultPairGap * 1.8,
      forward: assaultLead + (lead ? assaultPairGap * 0.5 : -assaultPairGap * 0.5),
    };
  }
  const g = trooper.userData.group ?? 0;
  const groupOff = (g - (VANGUARD_FORMATION.groups - 1) / 2) * groupGap;
  const ti = trooper.userData.team ?? 0;""",
 "offset 突击对"),

("""  return {
    right: groupOff + TEAM_ANCHOR.right + SLOT.right,
    forward: TEAM_ANCHOR.forward + SLOT.forward,
  };""",
 """  // 组长站在自己那个三人小组的位子上，只往前挪半步——他是小组的一员，
  // 不是飘在阵型外的一个点。旧写法把组长单独摆在组前方，于是 team 0
  // 永远缺一个人，三人小组的三角在画面上是残的。
  const leadBump = trooper.userData.role === "leader" ? teamSpacing * 0.45 : 0;
  return {
    right: groupOff + TEAM_ANCHOR.right + SLOT.right,
    forward: TEAM_ANCHOR.forward + SLOT.forward + leadBump,
  };""",
 "组长归位"),
])

# ============================================================ vanguardAssault.js
edit("TigerMessenger/src/world/vanguardAssault.js", [
("""  /** 气垫运输艇数；满载 6/艇，实载 6/6/4（总员 22 的"比 20 多 2 看护"口径） */
  haulers: 3,
  perHauler: 6,""",
 """  /** 气垫运输艇数；每艇 7 名（6 参战 + 1 留守看护），3 艇满载 21 名 */
  haulers: 3,
  perHauler: 7,""",
 "perHauler"),

("""    // 三三制编组（uid 顺序：0..5 索降、6..21 腹内；20/21 = 看护留守）
    assignVanguardFireteams(squad);
    troopersOf().forEach((tr) => {
      tr.userData.vehicleGuard = (tr.userData.uid ?? 0) >= 20;
    });""",
 """    // 编组（主人 2026-09-06 的舰队编成）：uid 0..5 泡机突击对、6..26 三艇各 7 名。
    // 看护身份由 assignVanguardFireteams 按「每艇最后一个座位」定死，
    // 这里不再另写一条 uid 阈值——两处各定一次，迟早对不上。
    assignVanguardFireteams(squad);""",
 "看护单一真相"),
])
