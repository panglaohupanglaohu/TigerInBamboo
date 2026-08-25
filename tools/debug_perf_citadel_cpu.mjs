// =====================================================================
// 高山城堡区域 CPU 侧每帧开销 profiling（Node 桩环境）
//   1) saihojiPhalanx.update 平均耗时（白天整队 / 鲸起战斗 / 深夜木马）
//   2) updateCitadelNightWindows 404 窗口遍历耗时（白天 / 夜晚+威胁）
//   3) 圣城 scene.traverse 全场景遍历耗时（updateIsland 每帧做两次）
// 运行：node tools/debug_perf_citadel_cpu.mjs
// =====================================================================
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()), createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { WORLD_RADIUS } = await import(new URL("src/world/worldScale.js", BASE).href);
const { SAIHOJI_HUB, latLonToGardenDir } = await import(new URL("src/world/saihoji.js", BASE).href);
const { createSaihojiPhalanxBattle } = await import(new URL("src/world/saihojiPhalanx.js", BASE).href);
const { buildOdysseyCitadel } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { updateCitadelNightWindows } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const R = WORLD_RADIUS;
const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();

const measure = (label, frames, fn) => {
  fn(); // warmup
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) fn(i);
  const dt = performance.now() - t0;
  console.log(`  ${label}: ${(dt / frames).toFixed(3)} ms/帧 (${frames} 帧)`);
  return dt / frames;
};

// ---------- 1. phalanx ----------
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
  const tramCar = new THREE.Group();
  tramCar.position.copy(hubDir).multiplyScalar(R + 1).addScaledVector(hubEast, 24);
  scene.add(tramCar);
  let whaleUp = false;
  const ph = createSaihojiPhalanxBattle({ scene, isWhaleRisen: () => whaleUp, getSquad: () => squad, getTram: () => ({ redTram: tramCar, blueTram: null }) });
  // 白天部署 60s
  for (let i = 0; i < 600; i++) ph.update(0.1, i * 0.1);
  console.log("[1] saihojiPhalanx.update 每帧耗时");
  measure("  白天驻军巡查（60s 后）", 600, (i) => ph.update(0.1, 60 + i * 0.1));
  whaleUp = true;
  measure("  鲸起战斗整队", 600, (i) => ph.update(0.1, 61 + i * 0.1));
  const soldiers = ph.root.children.filter((c) => c.userData?.phalanxRole);
  console.log(`  士兵对象数: ${soldiers.length}`);
}

// ---------- 2. 圣城窗口 ----------
{
  const castle = buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  let windows = castle.userData.latestDesignWindows || [];
  const allWindows = [];
  castle.traverse((o) => {
    if (o.isMesh && (o.userData.citadelDesignWindow || o.name?.includes("window"))) allWindows.push(o);
  });
  console.log(`[2] updateCitadelNightWindows（窗口 mesh ${allWindows.length}）`);
  const threats = Array.from({ length: 30 }, () => new THREE.Vector3((Math.random() - 0.5) * 4, R + 2, (Math.random() - 0.5) * 4));
  measure("  白天 phase=0.5", 300, () => updateCitadelNightWindows(castle, 0.5));
  measure("  夜晚 phase=0.9（30 士兵威胁 × 窗口）", 300, () => updateCitadelNightWindows(castle, 0.9, { threats, threatRadius: 3.8 }));
  measure("  夜晚 phase=0.9（无威胁）", 300, () => updateCitadelNightWindows(castle, 0.9));
}

// ---------- 3. traverse ----------
{
  const castle = buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const scene = new THREE.Scene();
  scene.add(castle);
  console.log("[3] scene.traverse 全场景遍历");
  measure("  traverse（圣城 1152 mesh）", 300, () => {
    scene.traverse((o) => { if (o.userData?.kind === "moebius-swamp" || o.userData?.kind === "moebius-airship") o.userData.update?.(0.016, 0, {}); });
  });
}
