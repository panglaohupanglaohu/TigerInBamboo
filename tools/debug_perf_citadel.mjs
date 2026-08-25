// =====================================================================
// 高山城堡渲染负载统计（性能分析，Node 桩环境）
// 构建 latestDesign=true 的 odysseyCitadel，统计：
//   - 总 mesh / 描边壳 / draw call 数量
//   - 顶点与三角形总量
//   - 未合并的独立网格（按组）
//   - 窗口网格与材质
//   - 逐帧更新对象
// 运行：node tools/debug_perf_citadel.mjs
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
const { buildOdysseyCitadel } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { citadelSiteDir } = await import(new URL("src/world/citadelRange.js", BASE).href);

const castle = buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });

let meshes = 0, visibleMeshes = 0, outlines = 0, windows = 0, triangles = 0, vertices = 0, updaters = 0;
const byGroup = {};
const geometrySet = new Set();
const materialSet = new Set();
castle.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  if (o.visible !== false) visibleMeshes++;
  if (o.userData.isOutline) outlines++;
  if (o.userData.citadelDesignWindow || o.name?.includes("window")) windows++;
  const pos = o.geometry?.getAttribute?.("position");
  if (pos) {
    triangles += pos.count / 3;
    vertices += pos.count;
  }
  if (o.geometry) geometrySet.add(o.geometry);
  if (o.material) materialSet.add(o.material);
  const parent = o.parent?.name || "(root)";
  byGroup[parent] = (byGroup[parent] || 0) + 1;
  if (o.userData.update || typeof o.userData?.update === "function") updaters++;
});
const updaterObjects = [];
castle.traverse((o) => { if (o.userData?.update) updaterObjects.push(`${o.name || o.type}`); });

const mergedGeometry = [...geometrySet].filter((g) => g.index === null && g.getAttribute("position")?.count > 3000).length;
console.log("=== 高山圣城（latestDesign）渲染负载 ===");
console.log(`mesh 总数:        ${meshes}  (表面 ${meshes - outlines} + 描边壳 ${outlines})`);
console.log(`渲染 draw calls:  ≈${visibleMeshes}  (可见 mesh + InstancedMesh 计 1)`);
console.log(`窗口 mesh:        ${windows}`);
console.log(`三角形:           ${Math.round(triangles).toLocaleString()}`);
console.log(`顶点:             ${Math.round(vertices).toLocaleString()}`);
console.log(`独立 Geometry:    ${geometrySet.size}  (其中疑似合并大网格 ${mergedGeometry})`);
console.log(`独立 Material:    ${materialSet.size}`);
console.log(`每帧 update 对象: ${updaterObjects.length}  ${updaterObjects.slice(0, 10).join(", ")}`);
console.log("--- 按父组 mesh 数（Top 15）---");
Object.entries(byGroup).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));
console.log("--- 材质共享度（Top 8，mesh 数 per material）---");
const perMat = {};
castle.traverse((o) => { if (o.isMesh && o.material) perMat[o.material.uuid] = (perMat[o.material.uuid] || 0) + 1; });
Object.entries(perMat).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  mesh 共用`));
