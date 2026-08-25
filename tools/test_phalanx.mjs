// 西芳寺士兵方阵故事线验收：
//  - 鼓声控制发兵（高山圣城）→ 运河交汇处城堡 → 苔庭下岸整队
//  - 白天电车运兵源源不断：电车掠过苔庭附近时下车、步行入阵
//  - 故事部署期战船每 30s 补给一小队
//  - 苔庭方阵原本红盔；鲸归撤阵（whaleReturned）→ 完成任务者换蓝盔返城攻城
//  - 攻城：红盔守军路口死守 + 红盔战船经运河不限量增援，长弓箭雨击杀
//  - 深夜：木马腹中红盔兵巡查驱赶蓝盔残部，驱离殆尽即收队落幕（不等黎明）
// 运行：node tools/test_phalanx.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
});
globalThis.document = {
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { WORLD_RADIUS } = await import(new URL("src/world/worldScale.js", BASE).href);
const { SAIHOJI_HUB, latLonToGardenDir } = await import(new URL("src/world/saihoji.js", BASE).href);
const { createSaihojiPhalanxBattle } = await import(new URL("src/world/saihojiPhalanx.js", BASE).href);

const R = WORLD_RADIUS;
let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();

console.log("[1] 白天电车运兵：电车掠近 → 下车 → 步行入阵 → 驻军就位");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  // 伪电车：悬停在苔庭旁 24 单位（航线最近 ~27）
  const tramCar = new THREE.Group();
  tramCar.position.copy(hubDir).multiplyScalar(R + 1).addScaledVector(hubEast, 24);
  scene.add(tramCar);
  let whaleUp = false;
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => whaleUp,
    getSquad: () => squad,
    getTram: () => ({ redTram: tramCar, blueTram: null }),
  });
  // 鼓息（stub 恒 false）：5s 后第一次电车检查 → 下车；60s 后驻军成流
  for (let i = 0; i < 600; i++) ph.update(0.1, i * 0.1);
  assert(ph.root.userData.assembled === true, "电车驻军下车后应视为就位");
  const soldiers = ph.root.children.filter((c) => c.userData?.phalanxRole);
  assert(soldiers.length >= 10, `驻军 ${soldiers.length} 不足（源源不断 ≥10）`);
  // 鲸未升起：落位士兵在苔庭内分散巡查（板内 ≤15，且持续移动）
  // 只查先到的 4 队（后队仍在行军途中）
  const landDir = hubDir.clone().addScaledVector(hubEast, 0.11).normalize();
  const landingWorld = landDir.clone().multiplyScalar(R);
  let maxD = 0;
  for (const s of soldiers.slice(0, 20)) {
    maxD = Math.max(maxD, s.position.distanceTo(landingWorld));
  }
  assert(maxD <= 15, `巡查应在苔庭内（最远 ${maxD.toFixed(1)}）`);
  const s0 = soldiers[0];
  const p0 = s0.position.clone();
  for (let i = 0; i < 10; i++) ph.update(0.1, 60 + i * 0.1);
  assert(s0.position.distanceTo(p0) > 0.2, "巡查中的士兵应持续移动");
  ok(`电车驻军 ${soldiers.length} 名 · 苔庭内巡查（最远 ${maxD.toFixed(1)}）`);
  // 鲸起 → 告警整队：全营奔向北翼列阵（长弓两列 19/22 + 矛盾护壁 27/30，
  // 全部在鲸身侧缘 17.6 之外、护壁最远 ~42）
  whaleUp = true;
  for (let i = 0; i < 200; i++) ph.update(0.1, 61 + i * 0.1);
  maxD = 0;
  let northMin = Infinity;
  const ringNorth = new THREE.Vector3().crossVectors(landDir, hubEast).normalize();
  for (const s of soldiers) {
    maxD = Math.max(maxD, s.position.distanceTo(landingWorld));
    northMin = Math.min(northMin, s.position.clone().normalize().dot(ringNorth) * R);
  }
  assert(maxD > 17 && maxD < 44, `鲸起后应奔向北翼列阵（最远 ${maxD.toFixed(1)}）`);
  assert(northMin > 15, `北翼列阵应整体在北侧（最近北距 ${northMin.toFixed(1)}）`);
  ok(`鲸起整队：最远 ${maxD.toFixed(1)} · 北翼最近 ${northMin.toFixed(1)}（长弓两列 + 护壁）`);
}

console.log("[2] 鼓声发兵 → 运河交汇 → 下岸整队 → 战船补给 → 鲸归撤兵");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  let whaleUp = false;
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => whaleUp,
    getSquad: () => squad,
  });
  // 鼓息 2s → 发船；运兵 55s（第二船 16s 后发、34s 航程）→ 下岸
  for (let i = 0; i < 20; i++) ph.update(0.1, i * 0.1);
  for (let i = 0; i < 550; i++) ph.update(0.1, 2 + i * 0.1);
  assert.equal(ph.root.userData.phase, "fight", "两船下岸后应进入 fight");
  assert(ph.root.userData.assembled === true, "整队后 assembled");
  // 战船补给：每 30s 一小队（waves > 2）
  for (let i = 0; i < 400; i++) ph.update(0.1, 44 + i * 0.1);
  const boats = ph.root.children.filter((c) => c.name?.startsWith("saihoji-troopship")).length;
  assert(boats >= 3, `战船补给未生效（船 ${boats}）`);
  // 苔庭方阵原本就是红盔：fight 阶段全员红盔（完成任务返城攻城时才换蓝盔）
  const redCohorts = ph.root.children.filter((c) => c.name?.startsWith("saihoji-cohort"));
  assert(redCohorts.length > 0, "应有方阵 cohort");
  for (const c of redCohorts) {
    assert(
      c.children.every((s) => s.userData.helmSide === "red"),
      "苔庭方阵出征/作战期必须全员红盔"
    );
  }
  ok(`fight · 补给后船队 ${boats} 艘 · 方阵全员红盔`);
  // 鲸恢复原位 → 撤阵经运河返城 → 换蓝盔攻打高山圣城，红盔路口死守
  whaleUp = false;
  ph.root.userData.whaleReturned();
  for (let i = 0; i < 10; i++) ph.update(0.1, 84 + i * 0.1);
  assert.equal(ph.root.userData.phase, "return", "鲸归后应撤阵登船");
  // 苔庭战役一结束（撤阵登船时）就换好蓝盔：多少人参战多少人换盔
  let earlyBlue = 0;
  for (const c of ph.root.children.filter((c) => c.name?.startsWith("saihoji-cohort"))) {
    for (const s of c.children) if (s.userData.helmSide === "blue") earlyBlue++;
  }
  assert(earlyBlue >= 4, `撤阵登船时就应换好蓝盔（实际 ${earlyBlue}）`);
  ok(`鲸归撤阵 · 登船即换蓝盔 ×${earlyBlue}`);
  // 甲板桨手（船自带 warship-crew）同步换蓝缨：盔体仍青铜、缨穗变蓝
  let crewBlue = 0;
  for (const b of ph.root.children.filter((c) => c.name?.startsWith("saihoji-troopship"))) {
    if (b.userData.crewCrestSide !== "blue") continue;
    b.traverse((o) => {
      if (o.name === "crew-crest" && o.material?.color?.getHex() === 0x2563eb) crewBlue++;
    });
  }
  assert(crewBlue >= 2, `战船桨手缨穗应同步换蓝（实际 ${crewBlue} 艘）`);
  ok(`鲸归撤阵 · 战船桨手换蓝缨 ×${crewBlue} 艘（盔体仍青铜）`);
  for (let i = 0; i < 420; i++) ph.update(0.1, 86 + i * 0.1);
  assert.equal(ph.root.userData.phase, "siege", `返城后应进入攻城：${ph.root.userData.phase}`);
  assert.equal(ph.root.userData.helmSide, "blue", "攻城方必须换蓝盔");
  const reds = ph.root.getObjectByName("citadel-red-garrison");
  assert(reds?.children?.length >= 8, "高山圣城应有红盔守军");
  let blueHelm = 0;
  for (const wName of ph.root.children.filter((c) => c.name?.startsWith("saihoji-cohort"))) {
    wName.traverse((o) => {
      if (o.userData?.helmSide === "blue") blueHelm++;
    });
  }
  assert(blueHelm >= 4, "蓝盔攻城部队应上岸");
  ok("鲸归撤阵 · 蓝盔攻城 · 红盔路口死守");
}

console.log("[3] 红盔战船增援 · 深夜木马红盔兵驱赶蓝盔残部 → 驱离即落幕（不等黎明）");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  // 城堡朝向：局部 +Y 沿径向（台地法向）、局部 +Z 切向（瀑布正立面）——
  // 与真实场景一致，否则 castleFwdWorld=(0,0,1) 在攀爬点近乎径向，攻城永远到不了位
  castle.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    castle.position.clone().normalize()
  );
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  // 木马：停在圣城前（巡查兵出腹点）
  const horse = new THREE.Group();
  horse.name = "citadel-trojan-horse";
  horse.position
    .copy(castle.position)
    .addScaledVector(hubEast, 6)
    .normalize()
    .multiplyScalar(R + 0.1);
  scene.add(horse);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  // 桩星面：半径 R 的球面网格，让攻城行军贴地/台地台面射线有真实命中，
  // advance → climb → capture 全链路在桩环境也可验（梯子与瀑布道同规则）
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 24),
    new THREE.MeshBasicMaterial()
  );
  planet.name = "planet-surface";
  scene.add(planet);
  let tod = 0.45; // 白天
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => squad,
    getTimeOfDay: () => tod,
  });
  // 快进：鼓息发船 → 运兵下岸 → 鲸归撤阵 → 战船抵纳沃纳广场（攻城开始即停表）
  for (let i = 0; i < 20; i++) ph.update(0.1, i * 0.1);
  for (let i = 0; i < 550; i++) ph.update(0.1, 2 + i * 0.1);
  ph.root.userData.whaleReturned();
  let guard = 0;
  while (ph.root.userData.phase !== "siege" && guard++ < 600) {
    ph.update(0.1, 84 + guard * 0.1);
  }
  assert.equal(ph.root.userData.phase, "siege", "应进入攻城阶段");
  // 集结点与攻城梯：战船泊纳沃纳广场，瀑布缺口架起 6 架攻城梯
  //（首波 4 架覆盖四层落差 + 第二波蓝盔增援专属 2 架，总攻画面）
  const ladders = ph.root.getObjectByName("siege-ladders");
  assert(ladders?.children?.length === 6, "瀑布缺口应有 6 架攻城梯");
  const coveredWaterfalls = new Set(
    ladders.children.map((ladder) => ladder.userData?.cascadeSequence)
  );
  assert.deepEqual(
    [...coveredWaterfalls].sort((a, b) => a - b),
    [0, 1, 2, 3],
    "四个相邻瀑布落差之间都必须有攻城梯"
  );
  const allBlues = ph.root.children
    .filter((c) => c.name?.startsWith("saihoji-cohort"))
    .flatMap((c) => c.children);
  assert(
    allBlues.every((s) => s.userData.siegeStage === "gather"),
    "上岸后应先在纳沃纳广场集结（gather）"
  );
  // 瀑布攀爬道：攻城梯每梯排满 8 人后，其余蓝盔改走瀑布（无攻城梯也能攀上城）
  const wfAssigned = allBlues.filter((s) => (s.userData.waterfall ?? -1) >= 0);
  assert(
    wfAssigned.length > 0,
    "攻城梯排满后应有蓝盔分到瀑布攀爬道（无攻城梯也能沿瀑布攀上城）"
  );
  assert(
    wfAssigned.every((s) => s.userData.ladder === -1),
    "瀑布攀爬者不应占用攻城梯梯位"
  );
  const wfLanes = new Set(wfAssigned.map((s) => s.userData.waterfall));
  assert(wfLanes.size >= 2, "瀑布攀爬者应分散到多条攀爬道");
  // 红盔守军含少量长弓手（4 名居高俯射）
  const garrison = ph.root.getObjectByName("citadel-red-garrison");
  const redBows = garrison.children.filter((s) => s.userData.phalanxRole === "longbow");
  assert.equal(redBows.length, 4, "红盔应配 4 名长弓手防守");
  // 近战数值：1 击瘫倒、2 击击杀 —— 把一名蓝盔长弓手隔离到方阵外，
  // 再让一名红盔贴脸（长弓手不近战反击，其他蓝盔够不到红盔）
  const victim = allBlues.find(
    (s) => s.userData.phalanxRole === "longbow" && s.visible && !s.userData.downed
  );
  const red0 = garrison.children.find((s) => s.userData.phalanxRole === "spear");
  victim.position.addScaledVector(hubEast, 25); // 隔离出方阵
  red0.position
    .copy(victim.position)
    .add(new THREE.Vector3(0.4, 0.2, 0.3))
    .normalize()
    .multiplyScalar(victim.position.length());
  red0.userData._meleeCd = 0;
  ph.update(0.1, 126);
  assert((victim.userData.meleeHits || 0) >= 1, "贴身近战应命中蓝盔");
  assert(
    victim.userData.downed === true && victim.userData.dead !== true,
    "1 次近战应瘫倒（未死）"
  );
  const redTool =
    red0.userData.equipment?.spear?.visible !== false
      ? red0.userData.equipment?.spear
      : red0.userData.equipment?.gladius;
  const redWorld = red0.getWorldPosition(new THREE.Vector3());
  const victimWorld = victim.getWorldPosition(new THREE.Vector3());
  const toolWorld = redTool?.getWorldPosition(new THREE.Vector3());
  const toolTip = redTool?.localToWorld(new THREE.Vector3(0, 1, 0));
  const toolDir = toolTip?.sub(toolWorld).normalize();
  const targetDir = victimWorld.sub(redWorld).normalize();
  assert(toolDir && toolDir.dot(targetDir) > 0.75, "近战作战工具应朝向当前目标");
  red0.userData._meleeCd = 0;
  ph.update(0.1, 126.1);
  assert(victim.userData.dead === true, "2 次近战应击杀（补刀瘫倒目标）");
  ok("集结广场 · 攻城梯×6 · 红盔长弓×4 · 近战 1 击瘫倒 / 2 击击杀");
  // 红盔战船不限量增援：攻城 32s 内应有援军战船抵达，守军人数增加
  const redBefore = garrison.children.length;
  for (let i = 0; i < 320; i++) ph.update(0.1, 126 + i * 0.1);
  const redShipBoats = ph.root.children.filter((c) => c.name?.startsWith("red-reinforce-ship"));
  assert(redShipBoats.length >= 1, "运河上应有红盔援军战船开来");
  assert(
    garrison.children.length > redBefore,
    `战船到岸应增援守军（${redBefore} → ${garrison.children.length}）`
  );
  // 第二波蓝盔增援（攻城 16s 生成，22s 航程）：专属梯位 4/5，有自己的突破方向
  const wave200 = ph.root.getObjectByName("saihoji-cohort-200");
  const wave201 = ph.root.getObjectByName("saihoji-cohort-201");
  assert(wave200 && wave201, "攻城 16s 后应生成两船蓝盔增援（cohort 200/201）");
  assert(
    wave200.children.every((s) => s.userData.ladder === 4) &&
      wave201.children.every((s) => s.userData.ladder === 5),
    "第二波蓝盔应分到自己的专属攻城梯（4 号/5 号）"
  );
  // 集结 5s 后中央突破：蓝盔离开广场奔向瀑布攻城梯（advance/climb/capture）
  const staged = allBlues.filter((s) => (s.userData.siegeStage || "gather") !== "gather");
  assert(staged.length > 0, "集结后蓝盔应发起中央突破（离开 gather 阶段）");
  assert.equal(ph.root.userData.siegeAssaultBgm, true, "开始进攻时应起播攻城 BGM");
  // 箭雨数值：2 支瘫倒 / 4 支击杀 —— 32s 箭雨 + 梯顶近战必有战损
  const arrowHitRed = garrison.children.some((s) => (s.userData.arrowHits || 0) >= 1);
  const downedOrDead = garrison.children.some((s) => s.userData.downed || s.userData.dead);
  assert(arrowHitRed, "箭雨应命中红盔（arrowHits ≥ 1）");
  assert(downedOrDead, "应有红盔瘫倒/阵亡（2 箭瘫倒 / 4 箭或 2 刀击杀）");
  ok(`红盔战船经运河增援 · 守军 ${redBefore} → ${garrison.children.length} · 中央突破 ${staged.length} 人已动 · 箭雨/近战出伤害`);
  // 瀑布攀爬实战：桩星面（planet-surface 球）让行军贴地/台面射线有真实命中，
  // 再推 45 秒（集结 5s + 行军 + 潭边排队 + 攀瀑 6.5s/人），分到瀑布道的
  // 蓝盔应有人正在攀瀑（climb）或已登上一台地（capture）
  const wfLanesData = ph.root.userData.siegeWaterfallClimbs || [];
  assert(wfLanesData.length === 3, "应生成 3 条瀑布攀爬道");
  for (let i = 0; i < 450; i++) ph.update(0.1, 158 + i * 0.1);
  const wfUp = allBlues.filter(
    (s) =>
      (s.userData.waterfall ?? -1) >= 0 &&
      (s.userData.siegeStage === "climb" || s.userData.siegeStage === "capture")
  );
  assert(wfUp.length > 0, "瀑布攀爬道的蓝盔应沿瀑布水帘攀城（climb/capture）");
  const wfCaptured = wfUp.filter((s) => s.userData.siegeStage === "capture").length;
  ok(`瀑布攀爬：${wfAssigned.length} 人分 ${wfLanesData.length} 条道 · ${wfUp.length} 人攀瀑中/已登台（capture ${wfCaptured}）`);
  // 入深夜：主力隐入夜色，残部滞留，木马兵出腹巡查
  tod = 0.92;
  for (let i = 0; i < 60; i++) ph.update(0.1, 158 + i * 0.1);
  assert.equal(ph.root.userData.phase, "siegeNight", "深夜应进入 siegeNight");
  const patrol = ph.root.getObjectByName("trojan-night-patrol");
  assert(patrol, "深夜应出现木马巡查兵");
  assert.equal(patrol.children.length, 6, "木马巡查兵应为 6 名");
  const countStragglers = () => {
    let n = 0;
    for (const c of ph.root.children) {
      if (!c.name?.startsWith("saihoji-cohort")) continue;
      c.traverse((o) => {
        if (o.userData?.straggler && o.visible && !o.userData.dead) n++;
      });
    }
    return n;
  };
  const initialStragglers = countStragglers();
  assert(initialStragglers > 0 && initialStragglers <= 5, `蓝盔残部应滞留 1~5 名（实际 ${initialStragglers}）`);
  ok(`深夜清场 · 木马兵 ×6 出腹 · 蓝盔残部 ${initialStragglers} 名滞留`);
  // 驱赶：残部被逐向运河交汇，逃远没入夜色
  for (let i = 0; i < 400; i++) ph.update(0.1, 164 + i * 0.1);
  assert.equal(countStragglers(), 0, "残部应被驱赶殆尽（没入夜色）");
  ok("木马兵驱赶：蓝盔残部全部逃离圣城");
  // 驱离即落幕：保持深夜（tod=0.92 不变），残部清空后巡查兵立即回木马腹收队
  for (let i = 0; i < 90; i++) ph.update(0.1, 204 + i * 0.1);
  assert.equal(
    ph.root.userData.phase,
    "done",
    `残部驱离殆尽即应落幕（不等黎明）：${ph.root.userData.phase}`
  );
  const visiblePatrol = patrol.children.filter((s) => s.visible).length;
  assert.equal(visiblePatrol, 0, "巡查兵应全部回到木马腹");
  ok("残部驱离 · 木马兵回腹 · 深夜落幕（不等黎明）");
}

console.log("[4] 深夜才抵达圣城：拨回傍晚，先演完集结与进攻");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  let tod = 0.93; // 返程结束已是深夜
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => squad,
    getTimeOfDay: () => tod,
  });
  for (let i = 0; i < 20; i++) ph.update(0.1, i * 0.1);
  for (let i = 0; i < 550; i++) ph.update(0.1, 2 + i * 0.1);
  ph.root.userData.whaleReturned();
  let guard = 0;
  while (ph.root.userData.phase !== "siege" && guard++ < 600) {
    ph.update(0.1, 84 + guard * 0.1);
  }
  assert.equal(ph.root.userData.phase, "siege", "深夜抵达仍应进入攻城（不得跳过）");
  const { P } = await import(new URL("src/core/params.js", BASE).href);
  assert(P.timeOfDay >= 0.55 && P.timeOfDay < 0.84, `应拨回傍晚，实际 ${P.timeOfDay}`);
  for (let i = 0; i < 80; i++) ph.update(0.1, 150 + i * 0.1);
  assert.equal(ph.root.userData.phase, "siege", "开打后 8s 不得立刻深夜清场");
  const blues = ph.root.children
    .filter((c) => c.name?.startsWith("saihoji-cohort"))
    .flatMap((c) => c.children)
    .filter((s) => s.visible && !s.userData.dead);
  assert(blues.length >= 4, "白天攻城窗口内蓝盔应仍在场");
  const leftGather = blues.some((s) => (s.userData.siegeStage || "gather") !== "gather");
  assert(leftGather, "应能看到广场集结后的中央突破");
  ok("深夜抵达 → 拨回傍晚 · 8s 内仍在攻城 · 蓝盔已开始突破");
}

console.log("[5] 无攻城梯：沿朝圣石阶逐层寻路登城");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  castle.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    castle.position.clone().normalize()
  );
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 24),
    new THREE.MeshBasicMaterial()
  );
  planet.name = "planet-surface";
  scene.add(planet);
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => squad,
    disableSiegeLadders: true,
  });
  ph.root.userData.debugSiege();
  const ladders = ph.root.getObjectByName("siege-ladders");
  assert.equal(ladders?.children?.length, 0, "无梯模式不得生成实体攻城梯");
  const route = ph.root.userData.siegeStairRoutes?.[0];
  assert(route?.points?.length >= 20, "无梯模式应生成跨五层台面的连续石阶点列");
  const blues = ph.root.children
    .filter((c) => c.name?.startsWith("saihoji-cohort"))
    .flatMap((c) => c.children)
    .filter((s) => s.visible && !s.userData.dead);
  assert(blues.length > 0 && blues.every((s) => s.userData.siegeRoute === "stairs"), "无梯士兵应全部选择 stairs 路线");
  for (let i = 0; i < 600; i++) ph.update(0.1, i * 0.1);
  const stairProgress = blues.filter(
    (s) => s.userData.siegeStage === "climb" || s.userData.siegeStage === "capture"
  );
  assert(stairProgress.length > 0, "无梯士兵应沿阶梯离开广场并开始逐层上行");
  assert(
    blues.some((s) => s.userData.siegeStage === "capture"),
    "无梯士兵走完石阶后应抵达台面并进入 capture"
  );
  ok(`无梯寻路 · 石阶点列 ${route.points.length} 个 · ${stairProgress.length} 名已上行/登台`);
}

console.log("[6] 最新圣城：无瀑布，外部石阶接内部旋转楼梯收束到顶层");
{
  const scene = new THREE.Scene();
  const castle = new THREE.Group();
  castle.name = "castleContainer";
  castle.position.copy(hubDir).multiplyScalar(R).addScaledVector(hubEast, -80);
  castle.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    castle.position.clone().normalize()
  );
  castle.userData.highlandAssaultAnchors = {
    destination: "castle-top",
    keepTop: [0, 10.2, 2.2],
    stairRoute: [[-7, 0.3, 13], [-5, 3.2, 9], [-4, 6.8, 5], [0, 10.2, 2.2]],
    ladderPolicy: "disabled",
    ladderLanes: [],
    captureMode: "interior-rotating-stairs",
    interiorFloorRoutes: [{ floor: 0, points: [[0, 10.2, 2.2]] }],
  };
  scene.add(castle);
  const junction = new THREE.Group();
  junction.name = "canal-junction-box";
  junction.userData.up = hubDir.clone().multiplyScalar(R).addScaledVector(hubEast, 30).normalize();
  scene.add(junction);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 24),
    new THREE.MeshBasicMaterial()
  );
  planet.name = "planet-surface";
  scene.add(planet);
  const squad = new THREE.Group();
  squad.userData.members = [{ userData: { arrowHits: 0 } }];
  scene.add(squad);
  const ph = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => squad,
  });
  ph.root.userData.debugSiege();
  const ladders = ph.root.getObjectByName("siege-ladders");
  assert.equal(ladders.children.length, 0, "最新圣城不得生成实体攻城梯");
  assert.equal(ladders.userData.destination, "castle-top");
  assert.deepEqual(ladders.userData.waterfallCoverage, [], "最新圣城不得保留瀑布覆盖语义");
  assert.equal(ph.root.userData.siegeWaterfallClimbs.length, 0, "不得生成瀑布攀爬道");
  const stair = ph.root.userData.siegeStairRoutes[0];
  assert.equal(stair.destination, "castle-top");
  assert.deepEqual(stair.terraces, []);
  const blues = ph.root.children
    .filter((c) => c.name?.startsWith("saihoji-cohort"))
    .flatMap((c) => c.children);
  assert(blues.length > 0);
  assert(blues.every((s) => s.userData.siegeRoute === "stairs"));
  assert(blues.every((s) => s.userData.siegeRoute !== "waterfall"));
  const keepWorld = new THREE.Vector3(...castle.userData.highlandAssaultAnchors.keepTop)
    .applyQuaternion(castle.quaternion)
    .add(castle.position);
  assert(stair.capture.distanceTo(keepWorld) < 1e-6, "山路终点必须精确等于古堡顶层锚点");
  for (let i = 0; i < 300; i++) ph.update(0.1, i * 0.1);
  assert(blues.some((s) => (s.userData.siegeStage || "gather") !== "gather"), "士兵必须开始向城顶推进");
  ok("0 架攻城梯 · 外部石阶/内部旋梯 · 0 条瀑布路线 · 最终目标 castle-top");
}

console.log(`\n结果：${pass} 项断言 · 6 组验收通过`);
