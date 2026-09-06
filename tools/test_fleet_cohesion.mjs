// =====================================================================
// 陆海空舰队是一个整体（主人 2026-09-05 报的三条）
//
//   ① 「莫比斯 aircraft 被打走了，为啥伴飞的泡机 + 运输艇不跟着飞走」
//      → 作战全程（insert / combat / withdraw）机队必须被 missionLock 钉在
//        编队上空。原来只有 approach / extract 两段锁，中间整场战斗机队会掉回
//        whaleLock 或巡逻航线自己飞走，把登陆队撂在原地。
//   ② 「仍然有重甲士兵源源不断地赶来」
//      → 首站打完（sweptHome）之后再被打，**不许原地空投第二批**，
//        必须整队开赴巡演下一站。
//   ③ 「这 3 艘泡艇也不发动攻击，原设定过他们可以使用麻醉弹进行攻击」
//      → 不在任务中时泡机也要还击**正在攻击机队的人**（threats）。
//
//   ④ 机队真的没了（被移出场景）→ 地面部队立刻收队，不留在原地当活靶。
//   ⑤ 反向保险：**没接机队**的桩场景（不传 getFleet）不许被 ④ 误伤，
//      任务必须照常从 approach 走到 insert。这是 ④ 第一版踩过的坑。
//
// 运行：node tools/test_fleet_cohesion.mjs
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
const { createVanguardAssault } = await import(new URL("src/world/vanguardAssault.js", BASE).href);
const { createVanguardSquad } = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
const { createSoccoCraft } = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);

const R = 160;
const GROUND = R + 0.5;
const gh = () => GROUND;

function makeWorld({ defenders = 8, withFleet = true } = {}) {
  const scene = new THREE.Scene();
  const squad = createVanguardSquad();
  scene.add(squad);
  const haulers = [0, 1, 2].map((i) => {
    const c = createSoccoCraft();
    c.name = `vanguard-hauler-${i}`;
    c.visible = false;
    scene.add(c);
    return c;
  });
  const wing = new THREE.Group();
  wing.name = "gate-pod-escort";
  const pods = [];
  for (let i = 0; i < 3; i++) {
    const pod = new THREE.Group();
    pod.name = `gate-pod-escort-${i}`;
    const muzzle = new THREE.Object3D();
    muzzle.name = "tranq-muzzle";
    pod.add(muzzle);
    pod.userData.tranqMuzzle = muzzle;
    wing.add(pod);
    pods.push(pod);
  }
  scene.add(wing);

  const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();

  // 机队：一组 aircraft 成员，结构照 moebiusAircraft 的 squad.userData.members
  let fleet = null;
  if (withFleet) {
    fleet = new THREE.Group();
    fleet.name = "moebius-aircraft-squad";
    const members = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Group();
      m.userData = { uid: i };
      m.position.copy(hub).multiplyScalar(R + 60);
      fleet.add(m);
      members.push(m);
    }
    fleet.userData.members = members;
    scene.add(fleet);
  }

  const defendersLive = [];
  for (let i = 0; i < defenders; i++) {
    const d = new THREE.Group();
    d.userData = { uid: 100 + i };
    d.position.copy(hub).multiplyScalar(GROUND).add(new THREE.Vector3(i * 1.2 - 4, 0, -4));
    scene.add(d);
    defendersLive.push(d);
  }
  return {
    scene, squad, haulers, wing, pods, hub, fleet, defendersLive,
    getDefenders: () => defendersLive.filter((d) => d.parent),
  };
}

function buildAssault(w, extra = {}) {
  return createVanguardAssault({
    scene: w.scene,
    squad: w.squad,
    R,
    getPods: () => w.pods,
    getHaulers: () => w.haulers,
    getFleet: () => w.fleet,
    getGroundHeightAt: () => gh,
    getDefenders: w.getDefenders,
    ...extra,
  });
}

const runWhile = (assault, phase, maxFrames = 9000, dt = 0.25) => {
  let n = 0;
  while (assault.phase() === phase && n < maxFrames) { assault.update(dt, n * dt); n++; }
  return n;
};

/**
 * 主舰身上被登陆队动过的痕迹数（成员 + squad 一起数）。
 *
 * 主人 2026-09-06：**「不要 missionlock」**。
 * 上一版这里验的是「只请求驻留（hold），不写航向（active/hubDir）」——
 * 主人直接把整个机制否掉了：哪怕只是「请主舰多留一会儿」，也仍然是地面部队
 * 伸手去动主舰的状态。主舰身上同时还有 whaleLock 和 patrol，多一个写者
 * 就多一次「下一帧它到底听谁的」，而那正是「主舰飞走了别人不跟」的根。
 *
 * 现在的契约只有一句：**登陆队对主舰只读不写**。所以这个数必须恒为 0。
 */
const fleetTouched = (w) => {
  const list = [w.fleet, ...(w.fleet?.userData?.members || [])].filter(Boolean);
  return list.filter((m) => m.userData?.missionLock !== undefined).length;
};

/** 喂帧让主舰读起来「停稳」（开局闸门要求连续驻留 STATION_SETTLE_TIME 秒） */
const settleFleet = (a, secs = 4) => {
  for (let i = 0; i < Math.ceil(secs / 0.25); i++) a.update(0.25, 1e4 + i * 0.25);
};

// ---------------------------------------------------------------- ①
{
  const w = makeWorld();
  const a = buildAssault(w);
  assert.ok(a.begin(w.hub), "begin 应成功");
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert", "approach 应走完");
  assert.equal(fleetTouched(w), 0, "approach 段不许碰主舰");

  for (let i = 0; i < 40 && a.phase() === "insert"; i++) a.update(0.25, i * 0.25);
  assert.equal(fleetTouched(w), 0, "insert 段不许碰主舰");

  runWhile(a, "insert");
  assert.equal(a.phase(), "combat", "insert 应走到 combat");
  for (let i = 0; i < 40; i++) a.update(0.25, 900 + i * 0.25);
  assert.equal(fleetTouched(w), 0,
    "combat 段也不许碰主舰——士兵在地面上不是让主舰等他们的理由。" +
    "主舰打完自己的驻留就走，地面部队跟着撤（主人 2026-09-06：不要 missionlock）");
  console.log("  ✓ ① 全程对主舰只读不写（approach / insert / combat 三段抽查）");
}

// ---------------------------------------------------------------- ④
{
  const w = makeWorld();
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");
  assert.equal(a.fleetAlive(), true, "机队应在场");
  // 机队被移出场景 = 真的飞走了
  w.fleet.removeFromParent();
  a.update(0.25, 1000);
  assert.equal(a.phase(), "withdraw", "机队没了，地面部队必须立刻收队跟走");
  console.log("  ✓ ④ 机队离场 → 地面部队立刻转 withdraw");
}

// ---------------------------------------------------------------- ⑤
{
  const w = makeWorld({ withFleet: false });
  const a = createVanguardAssault({
    scene: w.scene, squad: w.squad, R,
    getPods: () => w.pods, getHaulers: () => w.haulers,
    getGroundHeightAt: () => gh, getDefenders: w.getDefenders,
  });
  a.begin(w.hub);
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert",
    "没接机队的桩场景不许被「机队没了」误伤（④ 的第一版就是这么把测试打红的）");
  console.log("  ✓ ⑤ 无机队桩场景不被误判");
}

// ---------------------------------------------------------------- ②
{
  // 打完一站必须**收干净**回 done，并给这个地方上冷却。
  //
  // 旧版这里验的是相反的事：extract 末尾直接 setupMission(下一站)，
  // 整支登陆队连同主舰一起被挪走。那是主人 2026-09-06 否掉的反向指挥，
  // 也是「重甲兵反复空降」的主发动机——站与站之间没有一帧停顿。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");
  runWhile(a, "withdraw");
  runWhile(a, "extract");
  assert.equal(a.phase(), "done", "打完必须回 done，不许直接续下一站");
  assert.equal(fleetTouched(w), 0, "收队后主舰身上更不该留下任何痕迹");

  // 冷却：主舰还停在原地，怎么问都不许再落一批
  settleFleet(a, 6);
  for (let i = 0; i < 5; i++) {
    assert.equal(a.requestStation(), false, "同一个地方冷却期内不许再开局");
  }
  assert.equal(a.phase(), "done", "被拒之后不该改变阶段");
  console.log("  ✓ ② 打完回 done + 同点冷却（拆掉了「打完立刻开赴下一站」的传送口）");
}

// ---------------------------------------------------------------- ②b
{
  // 受击**不是**第二条开局路径。
  //
  // 红盔会一直朝天上放箭，旧代码在 idle/done 分支里直接 begin(home)，
  // 于是每 3 秒（retaliateCd）就能触发一次空投——「重甲兵源源不断赶来」的
  // 另一台发动机。现在它必须走 requestStation 的同一道闸。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");

  settleFleet(a, 6);
  for (let i = 0; i < 10; i++) {
    a.onFleetUnderAttack(w.defendersLive[0], w.hub.clone());
    a.update(0.25, 2e4 + i * 0.25);
  }
  assert.equal(a.phase(), "done",
    "刚打完的地方，挨多少箭都不许再空投一批——这正是主人反复报的「源源不断」");
  console.log("  ✓ ②b 受击不再是第二条开局路径（走同一道闸）");
}

// ---------------------------------------------------------------- ③
{
  const w = makeWorld();
  const a = buildAssault(w);
  // 不开局：phase 停在 idle。红盔打机队 → 登记威胁
  const shooter = w.defendersLive[0];
  // 把泡机放到威胁附近（巡航期泡机挂在机队编队里，射程口径已放宽到 140）
  w.pods.forEach((p, i) => p.position.copy(w.hub).multiplyScalar(R + 24).add(new THREE.Vector3(i, 0, 0)));
  w.wing.updateMatrixWorld(true);
  const threats0 = a.threatTargets().length;
  a.onFleetUnderAttack(shooter, w.hub.clone());
  assert.ok(a.threatTargets().length > threats0, "受击应登记威胁");
  // 受击会把 idle 直接推进到 approach（首站还没扫过）；把它压回不影响本条：
  // 这里只验「泡机会开火」——跑若干帧后应有麻醉弹在飞或已命中计数
  let fired = false;
  for (let i = 0; i < 40 && !fired; i++) {
    a.update(0.25, i * 0.25);
    a.root.traverse((o) => { if (o.isMesh && o.visible && /tranq/i.test(o.name || "")) fired = true; });
    if ((shooter.userData.tranqHits || 0) > 0) fired = true;
  }
  assert.ok(fired, "泡机必须对攻击机队的人发麻醉弹（主人截屏：三台泡机在旁边干看着）");
  console.log(`  ✓ ③ 泡机麻醉炮开火（命中计数 ${shooter.userData.tranqHits || 0}）`);
}

// ---------------------------------------------------------------- ⑥
{
  // 苔庭鲸对抗期：机队归 whaleLock 管（压在鲸背上方被绳索拽升拽降）。
  //
  // 上一版这里验的是「作战锁要给 whaleLock 让路、鲸戏落幕再接管」。
  // 现在根本没有作战锁了（主人 2026-09-06：不要 missionlock），
  // 于是这一块改验更强的一条：**鲸的故事线是主舰身上唯一的外来权威**，
  // 登陆队从头到尾一个字节都不写，自然也就没有让路不让路的问题。
  const w = makeWorld();
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  w.fleet.userData.whaleLock = { active: true, hubDir: w.hub.clone(), hoverRadius: 12 };
  const snapshot = JSON.stringify(w.fleet.userData.whaleLock.hubDir.toArray());
  for (let i = 0; i < 40; i++) a.update(0.25, 1200 + i * 0.25);
  assert.equal(fleetTouched(w), 0, "鲸对抗期同样不许碰主舰");
  assert.equal(w.fleet.userData.whaleLock.active, true,
    "登陆队不许关掉鲸的锁——那条故事线归 saihojiGarden 管");
  assert.equal(JSON.stringify(w.fleet.userData.whaleLock.hubDir.toArray()), snapshot,
    "更不许改鲸锁里的方向");
  console.log("  ✓ ⑥ 鲸对抗期：主舰身上只剩 whaleLock 一个外来权威，登陆队全程不写");
}

// ---------------------------------------------------------------- ⑦
{
  // 撤离途中挨箭**不许**掉头重装填。红盔会一直朝天上放箭，原来每 3 秒就把
  // 整支登陆队弹回进场起点重来一遍，运输艇一波接一波开进来、永远撤不走
  // （主人 2026-09-05 第二张截屏）。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");
  a.onFleetUnderAttack(w.defendersLive[0], w.hub.clone());
  assert.ok(["withdraw", "extract"].includes(a.phase()),
    `撤离途中受击后应继续撤离，实得 ${a.phase()}`);
  console.log("  ✓ ⑦ 撤离途中挨箭不重装填（不再无限刷运输艇）");
}

// ---------------------------------------------------------------- ⑧
{
  // 任务收尾后三台泡机必须回到僚机翼去伴飞。setupMission 会把它们
  // scene.attach 出来自己开，只还在 extract 末尾那一个出口上——任务一旦
  // 半途夭折就永远留在 scene 下，updateGatePodEscort 遍历 wing.children
  // 看不见它们，于是停在原地一动不动（主人：「别一直停在哪里，也去伴飞吧」）。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  // 任务中泡机确实被摘出僚机翼自己开
  assert.ok(w.pods.some((p) => p.parent !== w.wing), "任务期泡机应脱离僚机翼");
  runWhile(a, "insert"); runWhile(a, "combat"); runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done", "无巡演站 → 收队");
  a.update(0.25, 5000); // 收队后的第一帧兜底
  for (const p of w.pods) {
    assert.equal(p.parent, w.wing, `泡机 ${p.name} 收队后必须挂回僚机翼才会伴飞`);
  }
  console.log("  ✓ ⑧ 收队后泡机挂回僚机翼（恢复伴飞）");
}

// ---------------------------------------------------------------- ⑨
{
  // 主人 2026-09-05 的规矩，修订版。第一版我照字面理解成「不在任务中就隐身」，
  // 结果 aircraft 飞去湖沼、运输艇原地消失，主人当场指出：
  //   「重甲兵不下降作战了，但是泡机和登陆艇没去伴飞啊，aircraft 都到湖沼了」
  //
  // 正确的读法是：**「不要出现」要由「跟着走」实现，不是凭空消失。**
  // 运输艇是这支海陆空舰队的「海」那一路，它该贴着海面跟在机队地面投影后面
  // 巡航，而不是留在上一个战场、也不是原地隐身。真正不许发生的是
  // 「aircraft 走了、成员还杵在旧站点」。
  //
  //   · 有机队可跟 → 运输艇**可见**且跟着机队走
  //   · 没有机队   → 才收进后台（场景没加载 / 桩环境）
  //   · 重甲兵     → 不在任务中一律不可见（他们坐在艇腹里）
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);

  a.update(0.25, 0);
  assert.ok(!w.squad.visible, "不在任务中，重甲兵坐在艇腹里，不该出现在画面上");
  assert.ok(w.haulers.every((c) => c.visible), "有机队可跟时运输艇要在场随队巡航");

  // 跟得上：把机队挪到另一个方向，运输艇必须朝新的地面投影收敛
  const far = new THREE.Vector3(-0.5, 0.6, 0.62).normalize();
  w.fleet.userData.members.forEach((m) => m.position.copy(far).multiplyScalar(R + 60));
  w.fleet.updateMatrixWorld(true);
  const groundTrack = far.clone().multiplyScalar(R);
  const before = Math.min(...w.haulers.map((c) => c.position.distanceTo(groundTrack)));
  for (let i = 0; i < 120; i++) a.update(0.25, i * 0.25);
  const after = Math.min(...w.haulers.map((c) => c.position.distanceTo(groundTrack)));
  assert.ok(after < before - 1,
    `运输艇必须跟着机队走：离机队地面投影 ${before.toFixed(1)} → ${after.toFixed(1)}，没靠近`);
  assert.ok(!w.squad.visible, "巡航期重甲兵仍在艇腹里");

  // 没有机队可跟才收进后台
  w.fleet.removeFromParent();
  a.update(0.25, 9000);
  assert.ok(w.haulers.every((c) => !c.visible), "机队都不在了，运输艇不该单独留在场上");
  console.log(`  ✓ ⑨ 运输艇随机队贴海巡航（跟位 ${before.toFixed(0)} → ${after.toFixed(0)}），无机队才收场`);
}

// ---------------------------------------------------------------- ⑩
{
  // requestStation 是「要不要在这一站落」的唯一入口，现在要过三道闸。
  // 每一道都对应一个真实发生过的故障，见 vanguardAssault.requestStation 的注释。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);

  // 闸①②：主舰还没停稳就问，必须拒绝——否则就是往空气里空投
  assert.equal(a.requestStation(), false, "主舰没停稳时不许开局");
  settleFleet(a, 4);
  assert.equal(a.requestStation(), true, "主舰停稳了，首战应该落");

  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done");

  // 闸③：刚打过的地方要冷却
  settleFleet(a, 6);
  assert.equal(a.requestStation(), false, "刚打过的地方不许再落一批");

  // 闸②：主舰飞去别处并停稳 → 那里才是新战场（战场跟着主舰走）
  const far = new THREE.Vector3(-0.62, 0.48, 0.62).normalize();
  for (const m of w.fleet.userData.members) m.position.copy(far).multiplyScalar(R + 60);
  assert.equal(a.requestStation(), false, "刚挪过去还没停稳，不许开局");
  settleFleet(a, 5);
  assert.equal(a.requestStation(), true, "主舰在新地方停稳 → 战场跟着主舰走");
  console.log("  ✓ ⑩ 开局三道闸：主舰在场 · 主舰停稳 · 该地未在冷却");
}

// ---------------------------------------------------------------- ⑪
{
  // 主人 2026-09-05 的 `__tm.fleet()` 现场：
  //   { phase: 'withdraw', aircraft:{n:5}, pods:{n:3, inWing:0, strayed:3},
  //     haulers:{n:3,visible:3}, troopers:{visible:true, state:'deployed'} }
  // 机队早飞到湖沼了，登陆队还停在苔庭：phase 永久卡在 withdraw。
  //
  // 根因是 withdraw 那一段**没有出口**。收尾条件是 `allAboard && rampsReady`，
  // 而超时兜底只强制 allAboard、不管 rampsReady：只要有一艘艇的 retArrived
  // 永远为 false（飞不回滩头），rampsReady 就永远是 false。
  // 更糟的是 onMission 为真时 update() 不会调 releasePods()/enforceOffstage()，
  // 于是三台泡机挂在 scene 下不伴飞、运输艇不巡航、重甲兵留在原地——
  // 主人反复报的「泡机和登陆艇没去伴飞」「重甲兵源源不断」全从这一个死角来。
  //
  // 这里把那艘飞不回来的艇造出来：冻住它的 position，chaseObj 永远到不了。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");

  // 一艘艇彻底不动了（位置写不进去）——现实里对应滩头方向被场景切换改脏
  const stuck = w.haulers[0];
  const p = stuck.position;
  for (const k of ["copy", "set", "lerp", "add", "addScaledVector", "sub", "lerpVectors"]) {
    p[k] = () => p;
  }
  // 机队同时飞走：这时舰队跟走的优先级最高，撤离动画再好看也得让路
  for (const m of w.fleet.userData.members) m.position.set(0, R + 900, 0);

  // withdrawChaseTimeout = 12s，给 40s 足够宽的余量
  for (let i = 0; i < 160 && a.phase() === "withdraw"; i++) a.update(0.25, 9000 + i * 0.25);
  assert.notEqual(a.phase(), "withdraw",
    "一艘艇回不了滩头就把 phase 永久钉在 withdraw——舰队从此散在原地，这是那个死角");

  // 走完剩下的路，回到常态：泡机归翼、兵与艇收进后台
  runWhile(a, "extract");
  a.update(0.25, 12000);
  assert.equal(a.phase(), "done", "撤离超时后必须能一路收到 done");
  for (const pod of w.pods) {
    assert.equal(pod.parent, w.wing, "收队后泡机必须挂回僚机翼才会伴飞");
  }
  assert.equal(w.squad.visible, false, "重甲兵收队后不该留在画面里");
  console.log("  \u2713 \u246A 撤离有硬截止：一艘艇卡住也不许把舰队钉死在原地");
}

// ---------------------------------------------------------------- ⑫
{
  // 主人 2026-09-06：「索降 重甲士兵 + 绳索回收 重甲士兵
  //                （不要出现半空索降时就离开的情况）」
  //
  // 改之前这里有两个洞：
  //   ① 撤离时索降兵根本没有回收路径——代码把他们「就近挂到一艘艇」，
  //      让人徒步走去登陆艇的后舱门，可泡机明明配着绳索；
  //   ② insert 段被打断时（机队飞走 → stranded → 直接转 withdraw），
  //      正挂在绳上的人被当成地面兵处理，从半空弹到地面。
  //
  // 这一条就卡在最难看的那一瞬间下手：**趁人还在绳子中间，把机队抽走**。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  assert.equal(a.phase(), "insert");

  const podTroopers = () =>
    w.squad.userData.troopers.filter((t) => t.userData.vehicleSlot?.kind === "pod");

  // 喂到「有人正挂在绳上」：离地了、还没落地、也还没上机
  let airborne = 0;
  for (let i = 0; i < 200 && airborne === 0; i++) {
    a.update(0.25, i * 0.25);
    airborne = podTroopers().filter(
      (t) => t.visible && !t.userData.dead && !t.userData.aboard &&
             t.userData.onGround === false && t.position.length() > gh() + 1.0
    ).length;
  }
  assert.ok(airborne > 0, "应当能抓到「正挂在绳上」的那一瞬间，否则这条测试没测到东西");

  // 就在这一刻，机队飞走
  w.fleet.removeFromParent();

  // 全程盯着：任何一帧都不许有人离地、没上机、却一根绳子都没连着
  const ropesVisible = () => {
    let n = 0;
    a.root.traverse((o) => { if (o.visible && /rope/i.test(o.name || "")) n++; });
    return n;
  };
  let worst = null;
  for (let i = 0; i < 600 && a.phase() !== "done"; i++) {
    a.update(0.25, 1000 + i * 0.25);
    const hanging = podTroopers().filter(
      (t) => t.visible && !t.userData.dead && !t.userData.aboard &&
             t.userData.onGround === false && t.position.length() > gh() + 1.0
    );
    if (hanging.length && ropesVisible() === 0) { worst = hanging.length; break; }
  }
  assert.equal(worst, null,
    `有 ${worst} 名索降兵吊在半空却没有任何绳子连着——这就是「半空索降就离开」`);

  // 收尾：泡机那 6 个人必须是被**绞回泡机**的，不是走去登陆艇的
  for (const tr of podTroopers()) {
    if (tr.userData.dead) continue;
    assert.equal(tr.userData.aboard, true,
      `索降兵 uid=${tr.userData.uid} 没被收回——绳索回收是主人点名要的动作`);
    assert.equal(tr.visible, false, "收回后应在泡机腹内，不该还站在画面里");
    assert.ok(tr.position.length() > gh() + 1.0,
      "收回后人在泡机上（离地），不是被丢在地面等着走回登陆艇");
  }
  console.log(`  ✓ ⑫ 索降中途机队飞走：${podTroopers().length} 名索降兵全部绳索绞回，无一半空遗弃`);
}

// ---------------------------------------------------------------- ⑬
{
  // 主人 2026-09-06：「空中生物让 gatePodCraft 麻醉后坠地解决」。
  //
  // 改之前只写了 downed/paralyzed 两个标志就完事：地面红盔靠 saihojiPhalanx 的
  // _fallT 会自己倒下去，**飞行生物没有任何东西让它掉下来**——它带着 downed
  // 继续飞，而 downed 又把它从目标池里摘掉了，等于白麻醉。
  const w = makeWorld({ defenders: 0 });

  // 造一只在天上的生物，登记成战场目标
  const bird = new THREE.Group();
  bird.name = "swamp-flyer";
  bird.userData = { uid: 900, wildCreature: true, combatant: true };
  bird.position.copy(w.hub).multiplyScalar(GROUND + 30);
  w.scene.add(bird);

  const a = buildAssault(w, { getTourTargets: () => [bird] });
  a.begin(w.hub);
  runWhile(a, "approach");

  // 喂到麻醉打满 5 发。
  // 每帧顺手把它指示一次（模拟侦察机的曳光指示）：这样任务结束、
  // 泡机回到巡航态之后，它仍然在 threats 池里，泡机会继续对它开火——
  // 这正是主人要的「空中生物交给泡机」的常态，不只是任务期间。
  for (let i = 0; i < 900 && (bird.userData.tranqHits || 0) < 5; i++) {
    a.designateTarget(bird);
    a.update(0.25, i * 0.25);
  }
  assert.ok((bird.userData.tranqHits || 0) >= 5,
    `泡机应把空中生物打满麻醉，实得 ${bird.userData.tranqHits || 0} 发`);

  // 打满之后必须**掉下来**，不是继续飞
  const before = bird.position.length();
  // 跑到「落地并标记完成」为止——不能只看高度：标记发生在最后一步落定的那一帧，
  // 按高度收手会正好停在前一帧，测出「掉下来了但没标记」的假象。
  for (let i = 0; i < 400 && !bird.userData.tranqGrounded; i++) {
    a.update(0.25, 1e3 + i * 0.25);
  }
  assert.ok(bird.position.length() < before - 5,
    `麻醉满额后必须坠落：${before.toFixed(1)} → ${bird.position.length().toFixed(1)}`);
  assert.ok(bird.position.length() <= GROUND + 0.8,
    `必须真的落到地面，实得 r=${bird.position.length().toFixed(2)}（地表 ${GROUND}）`);
  assert.equal(bird.userData.tranqGrounded, true, "落地后要标记，好交给重甲兵解决");

  // 「解决」这一步：躺在地上的目标必须还在重甲兵的打击池里
  assert.ok(a.tourTargets().includes(bird),
    "瘫在地上的目标必须留在重甲兵的打击池里——不然它就永远躺在那儿没人管");
  console.log("  ✓ ⑬ 空中生物麻醉满额 → 坠地 → 仍在重甲兵打击池（麻醉后坠地解决）");
}

// ---------------------------------------------------------------- ⑭
{
  // 主人 2026-09-06：登陆艇「用体重撞飞攻击者」；
  //   「添加撞击损伤能力，但**只是离开战场时使用**」；
  //   「离开战场前将敌人撞飞，**要有动画**」。
  //
  // 三条各钉一颗钉子：作战期不许撞、离场期撞了要死人、撞的时候画面上要有东西。
  const w = makeWorld({ defenders: 1 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  const victim = w.defendersLive[0];
  const craft = w.haulers.find((c) => c.parent && c.visible) || w.haulers[0];
  /** 战场上补一个活着的挡道者（前面那个多半已经被重甲兵解决了） */
  const freshFoe = () => {
    const d = new THREE.Group();
    d.userData = { uid: 700 + w.defendersLive.length };
    d.position.copy(w.hub).multiplyScalar(GROUND);
    w.scene.add(d);
    w.defendersLive.push(d);
    return d;
  };
  const stick = () => {
    craft.updateWorldMatrix(true, false);
    const cp = craft.getWorldPosition(new THREE.Vector3());
    victim.position.copy(cp).add(new THREE.Vector3(1.2, 0, 0));
    return cp;
  };

  // ---- ① 作战期贴到艇体上也不许被撞 ----
  stick();
  for (let i = 0; i < 30; i++) { a.update(0.1, 3e3 + i * 0.1); stick(); }
  assert.notEqual(victim.userData.rammedAir, true,
    "combat 段不许撞——撞击是走人时顺手掀翻挡道的，不是一门整场都在用的武器");

  // ---- ② 离场期：撞飞 + 伤害 + 动画 ----
  // 直接推到 extract（撤离/装载的细节由 ⑪⑫ 管，这里只验撞击）
  let guard = 0;
  while (a.phase() !== "extract" && guard++ < 4000) a.update(0.25, 4e3 + guard * 0.25);
  assert.equal(a.phase(), "extract", "应能进入离场段");

  // 作战打完之后原来那个多半已经躺下了：补一个活的挡在离场航路上
  const foe = victim.userData.dead || victim.userData.downed ? freshFoe() : victim;
  const stickFoe = () => {
    craft.updateWorldMatrix(true, false);
    const p = craft.getWorldPosition(new THREE.Vector3());
    foe.position.copy(p).add(new THREE.Vector3(1.2, 0, 0));
    return p;
  };
  const cp = stickFoe();
  const d0 = foe.position.distanceTo(cp);
  const r0 = foe.position.length();
  let launched = false;
  let sawRing = false;
  let sawPose = false;
  for (let i = 0; i < 120 && !launched; i++) {
    a.update(0.1, 5e3 + i * 0.1);
    if (foe.userData.rammedAir) launched = true;
    else stickFoe();
  }
  assert.ok(launched, "离场时贴到艇体外缘的攻击者必须被撞飞");

  // 伤害：一撞即毙（口径 = saihojiPhalanx 的 KILL_MELEE = 2 点近战）
  assert.ok((foe.userData.meleeHits || 0) >= 2,
    `撞击必须记伤害，实得 ${foe.userData.meleeHits || 0} 点近战`);
  assert.equal(foe.userData.dead, true, "登陆艇是拿体重撞的，一撞即毙");

  // 动画：撞点冲击波环 + 艇体撞击姿态
  for (let i = 0; i < 40; i++) {
    a.update(0.05, 6e3 + i * 0.05);
    a.root.traverse?.((o) => { if (o.name === "vanguard-ram-ring" && o.visible) sawRing = true; });
    const body = craft.userData?.hullPivot || craft;
    if (Math.abs(body.rotation.z) > 0.02 || Math.abs(body.rotation.x) > 0.02) sawPose = true;
  }
  assert.ok(sawRing, "撞点要有冲击波环——「要有动画」不是把人弹开就完事");
  assert.ok(sawPose, "艇体要有撞击姿态（侧倾+低头）：用体重撞，艇自己得动");

  // 撞飞的轨迹：切向甩出去 + 抛物线落回地面
  for (let i = 0; i < 300 && !foe.userData.tranqGrounded; i++) a.update(0.25, 7e3 + i * 0.25);
  assert.equal(foe.userData.tranqGrounded, true, "撞飞后应落地");
  assert.ok(foe.position.distanceTo(cp) > d0 + 2,
    `应被甩离艇体：${d0.toFixed(1)} → ${foe.position.distanceTo(cp).toFixed(1)}`);
  assert.ok(Math.abs(foe.position.length() - r0) < 12,
    "撞飞是切向甩出去 + 抛物线落回地面，不是往天上或地心里塞");

  // 环用完要收干净：一场仗撞五个人不能留五个网格在场上
  let leftover = 0;
  for (let i = 0; i < 60; i++) a.update(0.1, 8e3 + i * 0.1);
  a.root.traverse?.((o) => { if (o.name === "vanguard-ram-ring") leftover++; });
  assert.equal(leftover, 0, "冲击波环用完必须移除并 dispose（性能这条线上有前科）");
  console.log("  ✓ ⑭ 撞击：作战期不撞 · 离场时一撞即毙 · 艇体姿态+冲击波环 · 用完收干净");
}

// ---------------------------------------------------------------- ⑮
{
  // 主人 2026-09-06：「**只有莫比斯 aircraft 受到攻击才会产生空降**」。
  //
  // 改之前 saihojiPhalanx 每帧调一次 requestStation：鲸一起、方阵一成形，
  // 主舰只要恰好在附近停稳、冷却又过了，登陆队就自己开一局——跟有没有人
  // 打主舰毫无关系。那是「重甲兵反复空降」的最后一台发动机，也是把苔庭钉成
  // 固定战役的根源（主人：「苔庭只是其中一个战役」）。
  const w = makeWorld({ defenders: 6 });
  const a = buildAssault(w);

  // 主舰停稳、地面上一堆红盔、冷却也没有——具备一切「值得打」的条件。
  settleFleet(a, 8);
  for (let i = 0; i < 200; i++) a.update(0.25, 5e4 + i * 0.25);
  assert.equal(a.phase(), "idle",
    "没人打主舰就不许空降——满地敌人也不行。舰队是围绕主舰的战略打击力量，" +
    "不是看见敌人就往下跳的清剿队");

  // 有人打主舰 → 立刻开局
  a.onFleetUnderAttack(w.defendersLive[0]);
  assert.notEqual(a.phase(), "idle", "主舰挨打就必须落地还击");
  console.log("  ✓ ⑮ 只有主舰挨打才空降（满地敌人也不主动开局）");
}

// ---------------------------------------------------------------- ⑯
{
  // 主人 2026-09-06：「泡机下来的重甲兵……空降到攻击者附近，多以格斗解决对手」。
  //
  // 改之前索降点是绕中枢横排的三个固定点（±8 米），跟敌人在哪毫无关系：
  // 6 名突击兵落地之后还得自己走过去，「突击」两个字就没了。
  const w = makeWorld({ defenders: 4 });
  const a = buildAssault(w);

  // 把红盔全挪到远离中枢的一侧（离中枢 ~26 米），看落点跟谁走
  const up = w.hub.clone();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up).normalize();
  w.defendersLive.forEach((d, i) => {
    d.position.copy(up).multiplyScalar(GROUND)
      .addScaledVector(east, 26 + i * 1.5).normalize().multiplyScalar(GROUND);
  });
  const attackers = w.defendersLive.map((d) => d.position.clone());
  const centroid = attackers
    .reduce((acc, p) => acc.add(p), new THREE.Vector3())
    .multiplyScalar(1 / attackers.length);

  // 受击开局（唯一入口），走完 approach，索降前会再对一次表
  settleFleet(a, 8);
  a.onFleetUnderAttack(w.defendersLive[0]);
  assert.equal(a.phase(), "approach", "受击应开局");
  runWhile(a, "approach");
  runWhile(a, "insert");
  assert.equal(a.phase(), "combat");

  // 泡机下来的 6 名（uid 0..5）必须落在攻击者附近
  const podTroopers = w.squad.userData.troopers.filter((tr) => (tr.userData.uid ?? 99) < 6);
  assert.equal(podTroopers.length, 6, "泡机应带 6 名（3 台 × 2 名前后型）");
  const far = podTroopers
    .map((tr) => tr.position.distanceTo(centroid))
    .sort((x, y) => y - x)[0];
  assert.ok(far < 22,
    `泡机的突击兵必须落在攻击者附近，实测最远一名离攻击者质心 ${far.toFixed(1)} 米——` +
    "落在中枢等于让突击兵自己走过去，「突击」就没了");

  // 落点跟中枢**不是**一回事：这一条防止「凑巧敌人就在中枢」蒙混过关
  const hubPos = w.hub.clone().multiplyScalar(GROUND);
  assert.ok(centroid.distanceTo(hubPos) > 20, "这一块的前提：攻击者确实远离中枢");
  const nearHub = podTroopers.filter((tr) => tr.position.distanceTo(hubPos) < 12).length;
  assert.equal(nearHub, 0, "不许再落回中枢的固定三点");
  console.log(`  ✓ ⑯ 泡机突击兵空降到攻击者附近（最远 ${far.toFixed(1)} 米，无人落回中枢）`);
}

console.log("✅ test_fleet_cohesion（对主舰只读不写 · 只有主舰挨打才空降 · 开局三道闸 · 机队走则全队走 · 落到攻击者附近 · 离场撞击）");
