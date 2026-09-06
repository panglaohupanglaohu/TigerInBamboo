// 探针：走廊林带真的能跑并撒出树（node --check 查不出 import 错与签名错）
// 用法：node tools/probe_corridor_forest.mjs
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
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const SRC = new URL("src/", BASE);
const { decorateCorridorForests } = await import(new URL("world/nature.js", SRC).href);
const { groundLiftAt, CORRIDOR_FOREST_PATH } = await import(new URL("world/hills.js", SRC).href);
const { SEA_LEVEL } = await import(new URL("world/seaLevel.js", SRC).href);
const { PLANET_RADIUS } = await import(new URL("world/planet.js", SRC).href);

const R = PLANET_RADIUS;
const scene = new THREE.Scene();
const out = decorateCorridorForests(scene, R, {});
console.log(`走廊数=${CORRIDOR_FOREST_PATH.length}  撒出树=${out.meshes.length}  碰撞体=${out.colliders.length}`);

const byCorridor = new Map();
let minR = Infinity;
let below = 0;
for (const t of out.meshes) {
  const id = t.userData.corridorId ?? "?";
  byCorridor.set(id, (byCorridor.get(id) ?? 0) + 1);
  const r = t.position.length();
  if (r < minR) minR = r;
  if (r <= R + SEA_LEVEL) below++;
}
for (const [id, n] of byCorridor) console.log(`  ${id}: ${n} 棵`);
console.log(`最低树半径 ${minR.toFixed(3)}  海面 ${(R + SEA_LEVEL).toFixed(2)}  水下树=${below}`);

// 确定性：同 seed 再跑一次应完全一致
const scene2 = new THREE.Scene();
const out2 = decorateCorridorForests(scene2, R, {});
const same = out2.meshes.length === out.meshes.length
  && out.meshes.every((t, i) => t.position.distanceTo(out2.meshes[i].position) < 1e-9);
console.log(`确定性（同 seed 同结果）：${same ? "✓" : "❌"}`);

// 轨道净空生效性：传一条假轨道，应当筛掉一些树
const fakeCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(1, 0.2, 0).normalize().multiplyScalar(R),
  new THREE.Vector3(0.9, 0.3, 0.2).normalize().multiplyScalar(R),
  new THREE.Vector3(0.8, 0.4, 0.4).normalize().multiplyScalar(R),
], false);
const scene3 = new THREE.Scene();
const out3 = decorateCorridorForests(scene3, R, { trackCurves: [fakeCurve] });
console.log(`传入轨道后：${out3.meshes.length} 棵（无轨道 ${out.meshes.length}）→ 净空${out3.meshes.length <= out.meshes.length ? "生效" : "未生效"}`);
