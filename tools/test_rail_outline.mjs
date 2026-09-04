// =====================================================================
// C13-3 · 平台轮廓护栏（PLAN §10.3，证据 docs/sheetA.jpg 2s/13s/17s/**18s**）
//
// 录像里的三条事实：
//   ① 单格落地就有一圈女儿墙；加/删格后护栏沿**新轮廓**重新流动
//   ② 轮廓内凹（17s 的 V 形缺口）时护栏跟着凹进去
//   ③ **平台中间挖洞（18s），洞口内轮廓也镶一圈护栏**
//
// 这里守的是「护栏 = 轮廓函数」这条不变量：护栏件数必须等于**边界边数**×3
// （每条边 2 根立柱 + 1 根横杆），内轮廓（洞）与外轮廓一视同仁。
//
// 背景（2026-09-04 修掉的两个 bug，见 PLAN §10.3 / TODOS C13-3）：
//   · `classifyRoofComponent` 把**任何实心块**判成十字教堂（内部格四邻皆有 → cross），
//     于是整片广场长满屋顶还插尖塔，护栏一根都没有；
//   · 花园分支有一条「不贴墙但 ≥3 格也铺草」，把开阔平台整片铺成草地——
//     与 S20⑥ *can only exist … next to a wall* 相悖。
//
// 运行：node tools/test_rail_outline.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);

const mkCtx = () => ({
  mesh: (geo, mat, name) => { const m = new THREE.Mesh(geo, mat || new THREE.MeshBasicMaterial()); m.name = name; return m; },
  materials: new Proxy({}, { get: (_t, k) => (k === "shade" ? undefined : new THREE.MeshBasicMaterial()) }),
  random: () => 0.5,
  archWindowGeometry: new THREE.BoxGeometry(0.3, 0.5, 0.05),
  buildHalfDome: () => new THREE.Mesh(new THREE.SphereGeometry(0.4)),
  buildShrub: () => new THREE.Group(),
  buildTopiary: () => new THREE.Group(),
  finialHeight: 0.4,
});
const build = (levels) => ct.buildCitadelTown({ cellSize: 2, cellHeight: 1.6, gridSize: levels[0].length, levels }, mkCtx());
const countName = (town, name) => {
  let n = 0;
  for (const g of town.levels) g.traverse((o) => { if (o.isMesh && o.name === name) n++; });
  return n;
};
/** 单层布局的边界边数：非空格的四邻里有几个是空 */
const boundaryEdges = (rows) => {
  const at = (x, z) => (rows[z]?.[x] ?? ".");
  let n = 0;
  for (let z = 0; z < rows.length; z++) {
    for (let x = 0; x < rows[z].length; x++) {
      if (at(x, z) === ".") continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (at(x + dx, z + dz) === ".") n++;
      }
    }
  }
  return n;
};

const solid = ["0000000", "0000000", "0000000", "0000000", "0000000", "0000000", "0000000"];
const holed = solid.map((r, i) => (i === 3 ? "000.000" : r));
const notched = solid.map((r, i) => (i === 0 ? "00...00" : r));

// ---- ① 开阔平台必须有一圈护栏，且件数 = 边界边数 × 3（2 柱 + 1 杆）
{
  const t = build([solid]);
  const fence = countName(t, "town-fence");
  const edges = boundaryEdges(solid);
  console.log(`① 7×7 开阔平台：边界边 ${edges} · 护栏件 ${fence}（= ${edges}×3 = ${edges * 3}）`);
  assert.equal(fence, edges * 3,
    `开阔平台的护栏件数 ${fence} ≠ 边界边 ${edges} × 3。若为 0，多半是 classifyRoofComponent 又把实心块判成了 cross/教堂`);
  assert.equal(countName(t, "town-garden-grass"), 0,
    "不贴墙的开阔平台不该铺草（S20⑥：花园只在贴墙处成立）");
}

// ---- ② 内部挖洞：洞的内轮廓也要镶一圈（这是 sheetA 18s 的画面）
{
  const a = build([solid]);
  const b = build([holed]);
  const d = countName(b, "town-fence") - countName(a, "town-fence");
  console.log(`② 正中挖一格洞：护栏 +${d}（洞 4 条边 × 3 = 12）`);
  assert.equal(d, 12, `挖洞后护栏只多了 ${d} 件：洞的内轮廓没有护栏（S23 sheetA 18s）`);
  assert.equal(countName(b, "town-fence"), boundaryEdges(holed) * 3, "带洞布局的护栏件数与边界边数对不上");
}

// ---- ③ 轮廓内凹（V 形缺口）时护栏跟着凹进去
{
  const t = build([notched]);
  assert.equal(countName(t, "town-fence"), boundaryEdges(notched) * 3,
    "凹角轮廓的护栏件数与边界边数对不上（S23 sheetA 17s）");
  console.log(`③ 顶边 V 形缺口：边界边 ${boundaryEdges(notched)} · 护栏件 ${countName(t, "town-fence")}`);
}

console.log("✅ test_rail_outline");
