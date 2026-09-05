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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const VA = await import(new URL("src/world/vanguardAssault.js", BASE).href);
const VT = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
const GH = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);

const R = 160;
const scene = new THREE.Scene();
const squad = VT.createVanguardSquad(); scene.add(squad);
const haulers = [0, 1, 2].map((i) => { const c = GH.createSoccoCraft(); c.visible = false; scene.add(c); return c; });
const wing = new THREE.Group(); scene.add(wing);
const pods = [];
for (let i = 0; i < 3; i++) { const p = new THREE.Group(); wing.add(p); pods.push(p); }
const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
const defs = [];
for (let i = 0; i < 6; i++) { const d = new THREE.Group(); d.userData = { uid: 100 + i }; d.position.copy(hub).multiplyScalar(R + 0.5); scene.add(d); defs.push(d); }
const assault = VA.createVanguardAssault({
  scene, squad, R,
  getPods: () => pods, getHaulers: () => haulers,
  getGroundHeightAt: () => ((dir) => R + 0.5),
  getDefenders: () => defs.filter((d) => d.parent),
  getTourAnchor: () => hub.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2).normalize(),
  getTourTargets: () => [],
});

// ---- 场景 1：idle 受击 → 开战
assault.onFleetUnderAttack(null, hub.clone());
console.log("1 idle受击 ->", assault.phase(), "(应 approach)");

// ---- 场景 2：approach/insert 中反复受击 → 不重置，正常推进到 combat
assault.begin(hub);
let resets = 0, lastPhase = assault.phase();
for (let i = 0; i < 9000; i++) {
  assault.update(0.1, i * 0.1);
  if (assault.phase() === "combat") break;
  // 模拟红盔每 0.3s 一箭命中机队（比 3s 节流密得多）
  if (i % 3 === 0) assault.onFleetUnderAttack(null, hub.clone());
  if (assault.phase() !== lastPhase && (lastPhase === "approach" || lastPhase === "insert") && assault.phase() === "approach") resets++;
  lastPhase = assault.phase();
}
console.log("2 密集受击下推进 ->", assault.phase(), "异常重置次数:", resets, "(应 combat / 0)");
console.log("   stats:", JSON.stringify(assault.stats()));

// ---- 场景 3：巡演中受击 → 中断回防
assault.triggerWithdraw();
for (let i = 0; i < 12000 && assault.phase() === "withdraw"; i++) assault.update(0.25, i * 0.25);
for (let i = 0; i < 4000 && assault.phase() === "extract"; i++) assault.update(0.25, i * 0.25);
console.log("3 extract 后 ->", assault.phase(), "(tour 重入应为 approach)");
assault.onFleetUnderAttack(null, hub.clone());
console.log("   巡演中受击 ->", assault.phase(), "(回防装填后 approach)");
for (let i = 0; i < 9000 && assault.phase() !== "combat"; i++) assault.update(0.25, i * 0.25);
console.log("   回防后推进 ->", assault.phase(), "(应 combat) stats:", JSON.stringify(assault.stats()));
