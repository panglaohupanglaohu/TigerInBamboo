// =====================================================================
// 支架孤儿验收（2026-09-03，C2）
//
// 症状：格删了，支架还悬在半空。
// 成因：归属标签打在 THREE.Group（town-support-pillar）上，而增量重建摘旧网格的
//       判据是 o.isMesh && (userData.cell || userData.townModule)——杆件网格
//       （town-support-edge）自身没有标签，永远摘不掉。
//
// 注意（PLAN §4 N3）：Oskar 的悬空支架是 WFC 对细长结构静默失败后被接受的结果；
// 我们的支架是确定性构造、必然连通。这里修的是**回收**，不是把支架塞进 WFC。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const clone = (o) => JSON.parse(JSON.stringify(o));
const setCell = (spec, { ix, iy, iz }, ch) => {
  const rows = spec.terraces[0].levels[iy];
  const row = String(rows[iz]).split("");
  row[ix] = ch;
  rows[iz] = row.join("");
};

/** 每格的支架杆件三角形数（只认网格自身的归属标签，与增量摘除判据同口径）。 */
function supportTrisByCell(root) {
  const byCell = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (o.name !== "town-support-edge") return;
    const cell = o.userData?.cell ?? o.userData?.townModule;
    const key = cell ? `${cell.ix},${cell.iy},${cell.iz}` : "(无主)";
    const p = o.geometry?.attributes?.position;
    const n = p ? Math.floor((o.geometry.index?.count ?? p.count) / 3) : 0;
    byCell.set(key, (byCell.get(key) ?? 0) + n);
  });
  return byCell;
}

const countEdges = (root) => {
  let n = 0;
  root.traverse((o) => { if (o.isMesh && o.name === "town-support-edge") n++; });
  return n;
};

const c = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = c.userData.townSpec;

// 支架参与合并，构建后已被吸收进合并块。用 debounceMs>0 跳过合并，
// 让第 3 步挂上的网格保持独立——这正是「摘旧网格」判据实际面对的形态。
const allCells = [];
for (const terrace of spec.terraces ?? []) {
  (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
    String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
  }));
}
m.rebuildCitadelTownIncremental(c, spec, allCells, { debounceMs: 400 });

// ---- 1. 支架杆件必须自带归属，不能只挂在父 Group 上 ----
const before = supportTrisByCell(c);
assert.ok(before.size > 0, "布局里应存在悬空格及其支架");
assert.ok(!before.has("(无主)"),
  `支架杆件必须自带 userData.cell/townModule；当前有 ${before.get("(无主)") ?? 0} tris 无主，` +
  "标签打在 THREE.Group 上时增量重建摘不掉，格删了支架还在");

// ---- 2. 找一个真有支架的悬空格 ----
const target = [...before.keys()][0].split(",").map(Number);
const cell = { ix: target[0], iy: target[1], iz: target[2] };
const key = `${cell.ix},${cell.iy},${cell.iz}`;
const edgesBefore = countEdges(c);
console.log(`悬空格 ${key} 支架 ${before.get(key)} tris · 全城杆件 ${edgesBefore} 根`);

// ---- 3. 删掉它：该格支架必须归零 ----
const edited = clone(spec);
setCell(edited, cell, ".");
const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, edited))].map(String);
const r = m.rebuildCitadelTownIncremental(c, edited, dirty, { debounceMs: 400 });
assert.ok(r.ok, `增量重建应成功：${r.error ?? ""}`);

const after = supportTrisByCell(c);
assert.ok(!after.has("(无主)"), "重建后仍不得出现无主支架杆件");
assert.equal(after.get(key) ?? 0, 0,
  `格 ${key} 已删除，其支架必须一起消失，实际残留 ${after.get(key)} tris（这就是主人看到的悬空支架）`);

// ---- 4. 别的格的支架不许被误删 ----
for (const [k, v] of before) {
  if (k === key) continue;
  if (!(after.get(k) > 0)) {
    // 删一格会改变承重关系，邻近格支架合法地消失/出现；只守非邻近格
    const [ix, iy, iz] = k.split(",").map(Number);
    const near = Math.abs(ix - cell.ix) <= 1 && Math.abs(iz - cell.iz) <= 1 && Math.abs(iy - cell.iy) <= 2;
    assert.ok(near, `非邻近格 ${k} 的支架不该消失（原 ${v} tris）`);
  }
}

console.log(`✅ test_support_orphan（删 ${key} 后支架归零，杆件 ${edgesBefore} → ${countEdges(c)}）`);
