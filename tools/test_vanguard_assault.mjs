// =====================================================================
// 苔庭之战 · 先锋重甲兵到场—作战—撤离任务状态机（主人 2026-09-05 修订剧本验收）
//
//   ① 编成（主人 2026-09-06 舰队编成）：总员 27 = 24 战斗 + 3 看护
//      GatePodCraft 3 台各载 2 名索降（6，前后型突击对，全员参战）
//      gateHaulerCraft 3 艘各载 7 名（21），每艘留守 1 名 → 参战 18 = 6 个三人小组
//   ② 阶段机：begin → approach（泡机护送、气垫艇贴海楔形）→ insert（索降 + 开尾门放出）
//      → combat（三三制推进）→ withdraw（苔庭上空收绳）→ extract（贴海离场）→ done
//   ③ **落点铁律**：全员落地后每人 |position| ≈ 苔庭地表半径（逐人采样），
//      绝不允许回到「站在树顶」的悬空状态
//   ④ combat 期阵型向守军推进；看护（vehicleGuard）不进阵、留在艇旁
//   ⑤ 撤离：三艇回滩头放坡，艇兵**从后舱门走回腹内**，索降兵由本泡机绳索收回，贴海离场
//   ⑥ controlsPods：任务中 true（护航跟位让位），结束后 false
//   ⑦ 确定性：同输入重跑，落地坐标逐位一致（禁 Math.random）
//   ⑧ 泡机缺编兜底：没分到泡机的兵改走艇腹，任务照常完成
//
// 运行：node tools/test_vanguard_assault.mjs
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
const VA = await import(new URL("src/world/vanguardAssault.js", BASE).href);
const VT = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
const { createVanguardAssault, VANGUARD_ASSAULT } = VA;
const { createVanguardSquad, assignVanguardFireteams, VANGUARD_SQUAD_SIZE } = VT;
const { createSoccoCraft } = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);

const R = 160;
const GROUND = R + 0.5; // 假苔庭地表（含脚底偏移）
const gh = (dir) => GROUND; // 确定性平地：贴地采样就是它

function makeWorld({ defenders = 6 } = {}) {
  const scene = new THREE.Scene();
  const squad = createVanguardSquad();
  scene.add(squad);
  // 三台 gateHaulerCraft（初始隐藏，随队参战——门口已不再停运兵艇）
  const haulers = [0, 1, 2].map((i) => {
    const c = createSoccoCraft();
    c.name = `vanguard-hauler-${i}`;
    c.visible = false;
    scene.add(c);
    return c;
  });
  // 三台伴飞泡机（挂在翼下，模拟 gate-pod-escort 结构）
  const wing = new THREE.Group();
  wing.name = "gate-pod-escort";
  const pods = [];
  for (let i = 0; i < 3; i++) {
    const pod = new THREE.Group();
    pod.name = `gate-pod-escort-${i}`;
    wing.add(pod);
    pods.push(pod);
  }
  scene.add(wing);
  // 红盔守军（活的假人，摆在苔庭附近）
  const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  const defendersLive = [];
  for (let i = 0; i < defenders; i++) {
    const d = new THREE.Group();
    d.userData = { uid: 100 + i };
    d.position.copy(hub).multiplyScalar(GROUND).add(new THREE.Vector3(i * 1.2 - 3, 0, -4));
    scene.add(d);
    defendersLive.push(d);
  }
  return {
    scene, squad, haulers, wing, pods, hub,
    defendersLive,
    getDefenders: () => defendersLive.filter((d) => d.parent),
  };
}

function buildAssault(w, ghFn = gh) {
  return createVanguardAssault({
    scene: w.scene,
    squad: w.squad,
    R,
    getPods: () => w.pods,
    getHaulers: () => w.haulers,
    getGroundHeightAt: () => ghFn,
    getDefenders: w.getDefenders,
  });
}

function runTo(w, assault, phase, maxFrames = 9000, dt = 0.25) {
  let frames = 0;
  while (assault.phase() === phase && frames < maxFrames) { assault.update(dt, frames * dt); frames++; }
  return frames;
}

// ---- ① 编成：三三制 + 看护
{
  const w = makeWorld();
  const sq = w.squad;
  const { groups } = assignVanguardFireteams(sq);
  assert.equal(VANGUARD_SQUAD_SIZE, 27, "总员 27 = 24 战斗 + 3 看护");
  assert.equal(groups.length, 3, "一艇一组，共 3 组");
  for (const g of groups) {
    assert.equal(g.all.length, 6, "每艇 6 名参战（第 7 名留守）");
    assert.equal(g.leader?.userData?.role, "leader", "每组 1 名组长");
    assert.equal(g.teams.length, 2, "每艇 2 个三人小组");
    for (const team of g.teams) assert.equal(team.length, 3, "三三制：每小组 3 人");
  }
  assert.equal(sq.userData.troopers.filter((t) => t.userData.vehicleGuard).length, 3,
    "每艘登陆艇留守 1 名");
  console.log("  ① 编成：27 = 泡机 3×2 前后型 + 登陆艇 3×(6 参战 + 1 留守) ✓");
}

// ---- ②③ 阶段机推进到 combat，落地必须逐人贴地（反「站在树顶」铁律）
{
  const w = makeWorld();
  const assault = buildAssault(w);
  assert.equal(assault.phase(), "idle");
  assert.equal(assault.controlsPods(), false, "idle 时不接管泡机");

  assert.equal(assault.begin(w.hub), true, "begin 开局");
  assert.equal(assault.begin(w.hub), false, "begin 幂等：进行中再调不重开局");
  assert.equal(assault.phase(), "approach");
  assert.equal(assault.controlsPods(), true, "任务中接管泡机");
  assert.equal(w.squad.visible, true, "任务开始中队可见");
  assert.equal(w.squad.userData.state, "assault", "退出旧机腹吊挂（updateVanguardAboard 让位）");
  for (const p of w.pods) assert.equal(p.parent, w.scene, "泡机应脱离机队、挂 scene");
  for (const h of w.haulers) assert.equal(h.visible, true, "气垫艇进场即出现（贴海飞行）");

  // approach：贴海进场
  runTo(w, assault, "approach", 600, 0.1);
  assert.equal(assault.phase(), "insert", "approach 应完成（贴海速度 12）");
  for (const h of w.haulers) {
    const r = h.position.length();
    // 2026-09-05 抬高 2.5：气垫裙/炮口不擦浪，跳板不再探进海里
    assert.ok(r > R && r < R + 7, `气垫艇贴海飞行：半径 ${r.toFixed(1)} 应在 ${R}~${R + 7}`);
  }

  // insert：索降 6 + 艇卸 21 → 全员落地（含 3 名看护各就各位）
  const frames = runTo(w, assault, "insert");
  assert.equal(assault.phase(), "combat", `insert 应全员到位（喂了 ${(frames * 0.25).toFixed(0)}s）`);
  const st = assault.stats();
  assert.equal(st.onGround, 27, `全员 onGround（含 3 看护），实得 ${st.onGround}`);
  assert.equal(st.guards, 3, "看护 3 名（每艘登陆艇留守 1）");
  assert.equal(w.squad.userData.state, "deployed", "落地后进 deployed（箭矢目标池接管）");
  // ③ 铁律：每人贴着假苔庭地表（±0.6），不是树顶
  for (const tr of w.squad.userData.troopers) {
    const r = tr.position.length();
    assert.ok(Math.abs(r - GROUND) < 0.6, `落地半径 ${r.toFixed(2)} 应 ≈ ${GROUND}（贴地采样，绝不悬空）`);
    assert.equal(tr.userData.onGround, true);
  }
  // ④ 看护留守自己那艘艇旁（不进战斗阵型）：每艇最后一个座位
  const fighters = w.squad.userData.troopers.filter((t) => !t.userData.vehicleGuard);
  assert.equal(fighters.length, 24, "战斗 24 人 = 泡机 6 + 艇上 18");
  for (const tr of w.squad.userData.troopers.filter((t) => t.userData.vehicleGuard)) {
    assert.equal(tr.userData.vehicleGuard, true, "看护标记");
  }
  console.log(`  ②③ approach→insert→combat：6 索降 + 21 艇卸（7/7/7）全员逐人贴地（r=${GROUND}）✓`);
}

// ---- ④ combat：阵型向守军推进、看护不随阵移动
{
  const w = makeWorld();
  const assault = buildAssault(w);
  assault.begin(w.hub);
  runTo(w, assault, "approach", 600, 0.1);
  runTo(w, assault, "insert");
  const guards = w.squad.userData.troopers.filter((t) => t.userData.vehicleGuard);
  const g0 = guards.map((g) => g.position.clone());
  const c0 = w.squad.userData.troopers.filter((t) => !t.userData.vehicleGuard)
    .reduce((acc, t) => acc.add(t.position), new THREE.Vector3()).multiplyScalar(1 / 20);
  for (let i = 0; i < 120; i++) assault.update(0.25, 1000 + i * 0.25); // 30s 推进
  const c1 = w.squad.userData.troopers.filter((t) => !t.userData.vehicleGuard)
    .reduce((acc, t) => acc.add(t.position), new THREE.Vector3()).multiplyScalar(1 / 20);
  const dHub = w.hub.clone().multiplyScalar(GROUND);
  assert.ok(c1.distanceTo(dHub) < c0.distanceTo(dHub) - 0.5,
    `三三制推进：阵型中心应靠近守军（${c0.distanceTo(dHub).toFixed(1)} → ${c1.distanceTo(dHub).toFixed(1)}）`);
  guards.forEach((g, i) => {
    assert.ok(g.position.distanceTo(g0[i]) < 0.2, "看护留守：不随战斗阵型移动");
  });
  // 推进期依然贴地
  for (const tr of w.squad.userData.troopers) {
    assert.ok(Math.abs(tr.position.length() - GROUND) < 0.6, "推进中每帧重新贴地");
  }
  console.log(`  ④ combat：30s 推进 ${c0.distanceTo(dHub).toFixed(1)}→${c1.distanceTo(dHub).toFixed(1)}，看护留守，全程贴地 ✓`);
}

// ---- ⑤ ⑥ 撤离：全员从后舱门回艇腹 → 贴海离场 → 泡机归队 → controlsPods 释放
{
  const w = makeWorld({ defenders: 1 }); // 守军打光 → 自动撤离
  const assault = buildAssault(w);
  assault.begin(w.hub);
  runTo(w, assault, "approach", 600, 0.1);
  runTo(w, assault, "insert");
  assault.triggerWithdraw();
  assert.equal(assault.phase(), "withdraw");
  const frames = runTo(w, assault, "withdraw", 12000);
  assert.equal(assault.phase(), "extract", `全员上艇后转 extract（${(frames * 0.25).toFixed(0)}s）`);
  assert.equal(assault.stats().aboard, 27, "27 名全部收回载具（艇兵走后舱门，索降兵走绳索）");
  for (const tr of w.squad.userData.troopers) assert.equal(tr.visible, false, "进腹后隐身");
  runTo(w, assault, "extract", 4000);
  assert.equal(assault.phase(), "done", "离场完成");
  assert.equal(assault.controlsPods(), false, "结束后释放泡机");
  for (const p of w.pods) assert.equal(p.parent, w.wing, "泡机归队（挂回伴飞翼）");
  for (const h of w.haulers) assert.equal(h.visible, false, "艇离场后隐身");
  console.log("  ⑤⑥ withdraw→extract→done：27 人全部收回、贴海离场、泡机归队 ✓");
}

// ---- ⑦ 确定性：两次完整落地，坐标逐位一致
{
  const run = () => {
    const w = makeWorld();
    const assault = buildAssault(w);
    assault.begin(w.hub);
    runTo(w, assault, "approach", 600, 0.1);
    runTo(w, assault, "insert");
    return w.squad.userData.troopers.map((t) => t.position.toArray().map((v) => v.toFixed(4)).join(",")).join("|");
  };
  const a = run();
  const b = run();
  assert.equal(a, b, "同输入重跑：落地坐标必须逐位一致（禁 Math.random）");
  console.log("  ⑦ 确定性：重跑落地坐标逐位一致 ✓");
}

// ---- ⑧ 泡机缺编兜底：没分到泡机的兵改走艇腹，任务照常完成
{
  const w = makeWorld();
  w.pods.length = 0; // 一台泡机都没有
  const assault = buildAssault(w);
  assault.begin(w.hub);
  runTo(w, assault, "approach", 600, 0.1);
  const frames = runTo(w, assault, "insert", 12000);
  assert.equal(assault.phase(), "combat", "无泡机时全员从艇卸下，任务照常");
  assert.equal(assault.stats().onGround, 27, `实得 ${frames * 0.25}s 时 onGround=${assault.stats().onGround}`);
  console.log("  ⑧ 兜底：泡机缺编时全员走艇腹，任务不卡死 ✓");
}

console.log(`✅ test_vanguard_assault（27 = 泡机6前后型 + 艇21（每艇留守1）· approach→insert→combat→withdraw→extract · 逐人贴地）`);
