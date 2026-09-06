// =====================================================================
// 苔庭之战 · 先锋重甲兵 ×20（用户 2026-09-04 需求，参考概念图形体）
//
// 用户定的**不对称伤害**是这场仗的题眼，所以它是本测试的主体：
//   弓箭 20 支 / 标枪 10 支 → 才损伤先锋兵一次
//   先锋兵激光刀 1 刀 / 闪电枪 2 枪 → 就损伤一名普通士兵
//
//   ① 模型：低模、有描边、形体对得上概念图（护目镜/背包/激光刀/闪电枪）
//   ② 中队 20 人，各自有身份与独立战斗账
//   ③ 打先锋兵：第 19 箭不伤、第 20 箭伤一次并清零；标枪同理 9/10
//   ④ 箭与标枪**各记各的账**（不是换算成同一种伤害点数）
//   ⑤ 生命耗尽才算阵亡；死后再挨打不再计数
//   ⑥ 先锋兵打士兵：刀第 1 下就成立；枪第 1 枪不成立、第 2 枪成立
//   ⑦ updateVanguardCombat：近身只挥刀、远处只开枪，不会同一帧双重打击
//   ⑧ 伴飞/落地两个状态：aboard 不进目标池，deployed 才进
//   ⑨ 确定性：两次构建包围盒一致（禁止 Math.random）
//
// 运行：node tools/test_vanguard_trooper.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const V = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
const {
  createVanguardTrooper, createVanguardSquad, deployVanguardSquad,
  updateVanguardCombat, updateVanguardAboard, applyVanguardHit,
  vanguardStrikeLands, vanguardAliveCount,
  VANGUARD_COMBAT, VANGUARD_SQUAD_SIZE, VANGUARD_FORMATION, vanguardRosterSlot,
} = V;

// ---- ① 模型
const tr = createVanguardTrooper();
{
  assert.equal(tr.name, "vanguard-trooper");
  let tris = 0, outlines = 0;
  tr.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
    if (o.userData.isOutline) outlines++;
  });
  assert.ok(tris > 300 && tris < 6000, `低模预算：单兵应 300~6000 三角，实得 ${tris}`);
  assert.ok(outlines > 0, "装甲件必须有描边（与场景其他低模单位同风格）");
  const box = new THREE.Box3().setFromObject(tr);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.y > 1.2 && size.y < 2.0, `身高应在 1.2~2.0（纸士兵约 1.33），实得 ${size.y.toFixed(3)}`);
  // 概念图的三件标志物都在
  assert.ok(tr.getObjectByName("vanguard-laser-blade"), "右手必须有激光刀");
  assert.ok(tr.getObjectByName("vanguard-bolt-gun"), "左手必须有闪电枪");
  const p = tr.userData.parts;
  assert.ok(p.head && p.armL && p.armR && p.legL && p.legR, "头/双臂/双腿分组齐备（后续可做动作）");
  // 刀刃不能长过身体：概念图是一把刀，不是一根杆
  const blade = tr.getObjectByName("vanguard-laser-blade");
  const bladeLen = new THREE.Box3().setFromObject(blade).getSize(new THREE.Vector3()).length();
  assert.ok(bladeLen < size.y, `刀长应短于身高，实得 ${bladeLen.toFixed(2)} vs ${size.y.toFixed(2)}`);
  console.log(`  单兵：${tris} 三角 · 身高 ${size.y.toFixed(2)} · 刀长 ${bladeLen.toFixed(2)}`);
}

// ---- ② 中队 27 人（2026-09-06 舰队编成：24 战斗 + 3 看护，每艇留守 1）
const squad = createVanguardSquad();
// 主人 2026-09-06 定的舰队编成：
//   泡机 3 台 × 2 名 = 6（快速突击型，每台一前一后）
//   登陆艇 3 艘 × 7 名 = 21（每艘留守 1 名，参战 6 名 = 2 个三人小组）
// 合计 27 = 24 战斗 + 3 看护。这三个数字是编成口径，不是可以随手漂的实现细节。
assert.equal(VANGUARD_SQUAD_SIZE, 27, "3泡机×2 + 3艇×7 = 27");
assert.equal(
  VANGUARD_FORMATION.assaultPods * VANGUARD_FORMATION.perAssaultPod
  + VANGUARD_FORMATION.groups * VANGUARD_FORMATION.perHaulerSeats,
  VANGUARD_SQUAD_SIZE,
  "编成常量必须自洽：泡机席位 + 艇上席位 = 中队人数");
assert.equal(squad.userData.troopers.length, 27, `中队应 27 人，实得 ${squad.userData.troopers.length}`);
assert.equal(vanguardAliveCount(squad), 27);
{
  const uids = new Set(squad.userData.troopers.map((t) => t.userData.uid));
  assert.equal(uids.size, 27, "每人一个独立 uid");
  // 战斗账互相独立
  applyVanguardHit(squad.userData.troopers[0], "arrow");
  assert.equal(squad.userData.troopers[0].userData.arrowHits, 1);
  assert.equal(squad.userData.troopers[1].userData.arrowHits, 0, "别人的箭不该记在我头上");
}

// ---- ③ 20 箭 = 1 次损伤；10 标枪 = 1 次损伤
{
  const a = createVanguardTrooper();
  for (let i = 1; i < VANGUARD_COMBAT.arrowsPerWound; i++) {
    const r = applyVanguardHit(a, "arrow");
    assert.equal(r.wounded, false, `第 ${i} 箭不该造成损伤`);
    assert.equal(r.life, VANGUARD_COMBAT.vanguardLife, "未满 20 箭生命不该掉");
  }
  const r20 = applyVanguardHit(a, "arrow");
  assert.equal(r20.wounded, true, `第 ${VANGUARD_COMBAT.arrowsPerWound} 箭必须造成一次损伤`);
  assert.equal(r20.life, VANGUARD_COMBAT.vanguardLife - 1, "损伤一次掉一点生命");
  assert.equal(r20.arrowHits, 0, "计数必须清零重新攒");

  const b = createVanguardTrooper();
  for (let i = 1; i < VANGUARD_COMBAT.javelinsPerWound; i++) {
    assert.equal(applyVanguardHit(b, "javelin").wounded, false, `第 ${i} 标枪不该造成损伤`);
  }
  assert.equal(applyVanguardHit(b, "javelin").wounded, true, `第 ${VANGUARD_COMBAT.javelinsPerWound} 标枪必须造成一次损伤`);
}

// ---- ④ 箭与标枪各记各的账
{
  const c = createVanguardTrooper();
  for (let i = 0; i < 19; i++) applyVanguardHit(c, "arrow");
  for (let i = 0; i < 9; i++) applyVanguardHit(c, "javelin");
  assert.equal(c.userData.wounds, 0, "19 箭 + 9 标枪都没满，不该有任何损伤（不是加起来算）");
  assert.equal(applyVanguardHit(c, "javelin").wounded, true, "第 10 支标枪独立成立");
  assert.equal(c.userData.arrowHits, 19, "标枪满格不该清掉箭的账");
}

// ---- ⑤ 生命耗尽才阵亡
{
  const d = createVanguardTrooper();
  const perWound = VANGUARD_COMBAT.arrowsPerWound;
  for (let w = 0; w < VANGUARD_COMBAT.vanguardLife; w++) {
    for (let i = 0; i < perWound; i++) applyVanguardHit(d, "arrow");
  }
  assert.equal(d.userData.dead, true, `${VANGUARD_COMBAT.vanguardLife} 次损伤后应阵亡`);
  assert.equal(d.userData.life, 0);
  const total = perWound * VANGUARD_COMBAT.vanguardLife;
  const after = applyVanguardHit(d, "arrow");
  assert.equal(after.wounded, false, "死后再挨箭不再计数");
  console.log(`  打先锋兵：${perWound} 箭 = 1 次损伤；共 ${total} 箭才放倒一个（生命 ${VANGUARD_COMBAT.vanguardLife}）`);
}

// ---- ⑥ 先锋兵打士兵：刀 1 下、枪 2 枪
{
  const s1 = new THREE.Group(); s1.userData = {};
  assert.equal(vanguardStrikeLands(s1, "blade"), true, "激光刀第 1 刀就该成立");
  const s2 = new THREE.Group(); s2.userData = {};
  assert.equal(vanguardStrikeLands(s2, "bolt"), false, "闪电枪第 1 枪不成立");
  assert.equal(vanguardStrikeLands(s2, "bolt"), true, "闪电枪第 2 枪成立");
  assert.equal(vanguardStrikeLands(s2, "bolt"), false, "成立后重新攒");
  const dead = new THREE.Group(); dead.userData = { dead: true };
  assert.equal(vanguardStrikeLands(dead, "blade"), false, "已阵亡的士兵不再挨打");
}

// ---- ⑦ / ⑧ 伴飞 vs 落地
{
  const sq = createVanguardSquad({ count: 4 });
  assert.equal(sq.userData.state, "aboard", "初始是伴飞状态");
  assert.equal(sq.visible, false, "未随队出行时不出现");
  // aboard 时 updateVanguardCombat 什么都不做（还没落地，打不着人）
  const soldier = new THREE.Group(); soldier.userData = {};
  const scene = new THREE.Scene(); scene.add(soldier); scene.add(sq);
  soldier.position.set(0, 0, 0);
  assert.deepEqual(updateVanguardCombat(sq, 1, 0, { soldiers: [soldier] }), { blade: 0, bolt: 0, wounds: 0 },
    "伴飞状态不该出手");

  // 落地
  const hub = new THREE.Vector3(0, 1, 0);
  deployVanguardSquad(sq, hub, 100);
  assert.equal(sq.userData.state, "deployed");
  assert.equal(sq.visible, true);
  const ys = sq.userData.troopers.map((t) => t.position.length());
  for (const y of ys) assert.ok(Math.abs(y - 100) < 3, `落地点应贴着 r=100 的地面，实得 ${y.toFixed(2)}`);
  const xs = new Set(sq.userData.troopers.map((t) => t.position.x.toFixed(3)));
  assert.ok(xs.size > 1, "应排成横队而不是叠在一个点");

  // 近身：只挥刀不开枪
  const foe = new THREE.Group(); foe.userData = {};
  foe.position.copy(sq.userData.troopers[0].position);
  scene.add(foe);
  scene.updateMatrixWorld(true);
  const near = updateVanguardCombat(sq, 5, 0, { soldiers: [foe] });
  assert.ok(near.blade > 0, "近身必须挥刀");
  assert.equal(near.bolt, 0, "近身不该同时开枪（避免同一帧双重打击）");
  assert.ok(near.wounds > 0, "刀 1 下就该造成损伤");

  // 远处：只开枪不挥刀
  const far = new THREE.Group(); far.userData = {};
  far.position.copy(sq.userData.troopers[0].position).addScaledVector(hub.clone().normalize(), 0)
    .add(new THREE.Vector3(8, 0, 0));
  const sq2 = createVanguardSquad({ count: 2 });
  scene.add(sq2);
  deployVanguardSquad(sq2, hub, 100);
  sq2.userData.troopers.forEach((t) => { t.position.set(0, 100, 0); });
  far.position.set(8, 100, 0);
  scene.add(far);
  scene.updateMatrixWorld(true);
  const shot = updateVanguardCombat(sq2, 5, 0, { soldiers: [far] });
  assert.equal(shot.blade, 0, "远处不该挥刀");
  assert.ok(shot.bolt > 0, "远处必须开枪");
  console.log(`  先锋兵出手：近身刀 ${near.blade} 次 / 远处枪 ${shot.bolt} 次`);

  // onWound 回调拿得到武器种类（真正扣血交给 saihojiPhalanx）
  const seenWeapons = [];
  const foe2 = new THREE.Group(); foe2.userData = {};
  foe2.position.set(0, 100, 0);
  scene.add(foe2); scene.updateMatrixWorld(true);
  updateVanguardCombat(sq2, 5, 0, { soldiers: [foe2], onWound: (_s, w) => seenWeapons.push(w) });
  assert.ok(seenWeapons.length > 0 && seenWeapons.every((w) => w === "blade" || w === "bolt"),
    `onWound 必须报告武器种类，实得 ${seenWeapons}`);
}

// ---- ⑨ 确定性
{
  const boxOf = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
  const a = boxOf(createVanguardTrooper({ seed: 3 }));
  const b = boxOf(createVanguardTrooper({ seed: 3 }));
  assert.deepEqual(a.min.toArray().map((v) => v.toFixed(6)), b.min.toArray().map((v) => v.toFixed(6)));
  assert.deepEqual(a.max.toArray().map((v) => v.toFixed(6)), b.max.toArray().map((v) => v.toFixed(6)));
}

// ---- ②b 花名册映射：谁上哪台车、坐第几个位子、谁留守 ----
//
// 这个映射是撤离与回收的地基：「回自己乘来的那艘艇」「谁归哪台泡机的绳子」
// 都靠它。旧口径把看护定义成 `uid >= 20`，跟载具无关，两件事永远对不上号。
{
  const { assignVanguardFireteams } = await import(
    new URL("../TigerMessenger/src/world/vanguardTrooper.js", import.meta.url).href);
  const sq = createVanguardSquad();
  const { groups, assault } = assignVanguardFireteams(sq);

  // 泡机 6 名：3 台 × 2，每台一前一后
  assert.equal(assault.length, 6, "泡机突击兵应 6 名");
  for (let pod = 0; pod < 3; pod++) {
    const pair = assault.filter((t) => t.userData.pod === pod);
    assert.equal(pair.length, 2, `第 ${pod} 台泡机应载 2 名`);
    assert.equal(pair.filter((t) => t.userData.slot === 0).length, 1, "每对必须一前");
    assert.equal(pair.filter((t) => t.userData.slot === 1).length, 1, "每对必须一后");
    assert.ok(pair.every((t) => t.userData.role === "assault"), "泡机兵不进三三制方阵");
    assert.ok(pair.every((t) => !t.userData.vehicleGuard), "泡机兵全部参战，没有留守");
  }

  // 登陆艇：3 组，每组 6 名参战 = 2 个三人小组；另有 3 名看护不入组
  assert.equal(groups.length, 3, "一艇一组");
  for (const g of groups) {
    assert.equal(g.all.length, 6, `第 ${g.index} 艇应有 6 名参战兵`);
    assert.equal(g.teams.length, 2, "每艇 2 个三人小组");
    for (const team of g.teams) assert.equal(team.length, 3, "三三制：每小组 3 人");
    assert.equal(g.leader?.userData?.role, "leader", "每艇 1 名组长");
    assert.ok(g.all.includes(g.leader), "组长必须是小组的一员，不是飘在阵型外的一个点");
  }

  const guards = sq.userData.troopers.filter((t) => t.userData.vehicleGuard);
  assert.equal(guards.length, 3, "每艘登陆艇留守 1 名，共 3 名");
  assert.deepEqual(
    guards.map((t) => t.userData.group).sort(),
    [0, 1, 2],
    "三名看护必须分属三条不同的艇——留守的是自己那条艇");

  // 映射本身：座位号能反推载具
  assert.deepEqual(vanguardRosterSlot(0), { kind: "pod", vehicle: 0, seat: 0, lead: true, guard: false });
  assert.deepEqual(vanguardRosterSlot(5), { kind: "pod", vehicle: 2, seat: 1, lead: false, guard: false });
  assert.deepEqual(vanguardRosterSlot(6), { kind: "hauler", vehicle: 0, seat: 0, lead: true, guard: false });
  assert.deepEqual(vanguardRosterSlot(12), { kind: "hauler", vehicle: 0, seat: 6, lead: false, guard: true });
  assert.deepEqual(vanguardRosterSlot(26), { kind: "hauler", vehicle: 2, seat: 6, lead: false, guard: true });

  // 参战人数：24 = 6 突击 + 18 三三制
  const fighters = sq.userData.troopers.filter((t) => !t.userData.vehicleGuard);
  assert.equal(fighters.length, 24, "参战 24 名");
  console.log("  ✓ 花名册：泡机 3×2 前后型 · 登陆艇 3×(6 参战 + 1 留守) · 三三制 6 个三人小组");
}

console.log(`✅ test_vanguard_trooper（27 人 = 24 战斗 + 3 看护 · 箭 ${VANGUARD_COMBAT.arrowsPerWound} / 标枪 ${VANGUARD_COMBAT.javelinsPerWound} 伤一次 · 刀 ${VANGUARD_COMBAT.bladeHitsPerWound} / 枪 ${VANGUARD_COMBAT.boltHitsPerWound} 伤士兵 · 落地贴地）`);
