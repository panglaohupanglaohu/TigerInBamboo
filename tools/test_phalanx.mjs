// 西芳寺士兵方阵故事线验收：
//  - 鼓声控制发兵（高山圣城）→ 运河交汇处城堡 → 苔庭下岸整队
//  - 白天电车运兵源源不断：电车掠过苔庭附近时下车、步行入阵
//  - 故事部署期战船每 30s 补给一小队
//  - 鲸起才攒箭；鲸恢复原位（whaleReturned）→ 撤阵返回高山圣城
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
  ok(`fight · 补给后船队 ${boats} 艘`);
  // 鲸恢复原位 → 撤阵返城（含补给船）→ 回到城堡；鼓息 1.6s 后下一轮自动发兵
  whaleUp = false;
  ph.root.userData.whaleReturned();
  for (let i = 0; i < 420; i++) ph.update(0.1, 84 + i * 0.1);
  assert(
    ph.root.userData.phase === "atCastle" || ph.root.userData.phase === "sailOut",
    `返城后应回到 atCastle（新一轮可已发兵）：${ph.root.userData.phase}`
  );
  const visibleCohorts = ph.root.children.filter(
    (c) => c.name?.startsWith("saihoji-cohort") && c.visible
  ).length;
  assert.equal(visibleCohorts, 0, "撤阵后苔庭不得残留方阵");
  ok("鲸归撤阵 · 返城后新一轮自动发兵");
}

console.log(`\n结果：${pass} 项断言 · 2 组验收通过`);
