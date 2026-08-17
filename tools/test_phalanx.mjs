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
  // 鼓息（stub 恒 false）：5s 后第一次电车检查 → 下车；60s 后两队驻军到位
  for (let i = 0; i < 600; i++) ph.update(0.1, i * 0.1);
  assert(ph.root.userData.assembled === true, "电车驻军下车后应视为就位");
  const soldiers = ph.root.children.filter((c) => c.userData?.phalanxRole);
  assert(soldiers.length >= 10, `驻军 ${soldiers.length} 不足（源源不断 ≥10）`);
  // 先头小队应已走到自己的环绕槽位（内圈半径 ~20）
  const landDir = hubDir.clone().addScaledVector(hubEast, 0.11).normalize();
  const landingWorld = landDir.clone().multiplyScalar(R);
  const oldest = soldiers.slice(0, 5);
  let oldestMax = 0;
  for (const s of oldest) {
    oldestMax = Math.max(oldestMax, s.position.distanceTo(landingWorld));
  }
  assert(oldestMax > 17 && oldestMax < 24, `先头小队应在环绕槽位（最远 ${oldestMax.toFixed(1)}）`);
  // 排布不重复：两队的中心点应分处不同槽位（黄金角散列，间距 > 8）
  const c0 = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  for (const s of soldiers.slice(0, 5)) c0.add(s.position);
  for (const s of soldiers.slice(5, 10)) c1.add(s.position);
  c0.multiplyScalar(1 / 5);
  c1.multiplyScalar(1 / 5);
  const slotGap = c0.distanceTo(c1);
  assert(slotGap > 8, `两队槽位应不重复（间距 ${slotGap.toFixed(1)}）`);
  ok(`电车驻军 ${soldiers.length} 名 · 环绕槽位 ${oldestMax.toFixed(1)} · 队间间距 ${slotGap.toFixed(1)}`);
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
