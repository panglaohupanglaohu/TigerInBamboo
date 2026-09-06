// =====================================================================
// 删格残留探针（主人 2026-09-05：「删除建筑单元后，留下来的灰色网孔是什么」）
//
// 删掉一整块格之后，把**仍然落在被删区域里**的东西全部点名：网格名、材质色、
// 三角数、以及它是不是合并块 / 描边壳。不猜，直接看留下来的是谁。
//
// 运行：node tools/probe_delete_residue.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));
const levels = spec.terraces[0].levels;

// 挖一整块：ix 5..9 × iz 5..9 × iy 1..6 全部清空（模拟主人「删掉一片建筑单元」）
const removed = new Set();
const next = JSON.parse(JSON.stringify(spec));
for (let iy = 1; iy <= 6; iy++) {
  const rows = next.terraces[0].levels[iy];
  if (!rows) continue;
  for (let iz = 5; iz <= 9; iz++) {
    if (typeof rows[iz] !== "string") continue;
    const row = rows[iz].split("");
    for (let ix = 5; ix <= 9; ix++) {
      if ((row[ix] ?? ".") === ".") continue;
      row[ix] = ".";
      removed.add(`${ix},${iy},${iz}`);
    }
    rows[iz] = row.join("");
  }
}
console.log(`挖掉 ${removed.size} 格（ix5-9 × iz5-9 × iy1-6）`);

const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
console.log("增量结果：", r.ok ? "ok" : r.error);
spec = next;

const hex = (mat) => {
  const c = mat?.color;
  return c ? "#" + c.getHexString() : "(无色)";
};
const tri = (o) => {
  const p = o.geometry?.attributes?.position;
  if (!p) return 0;
  return Math.floor((o.geometry.index?.count ?? p.count) / 3);
};

// ---- 谁还落在被删格上 ----
const hits = new Map(); // key: 名字|材质色|是否描边|是否合并 → {n, tris}
let mergedResidueTris = 0;
citadel.traverse((o) => {
  if (!o.isMesh) return;
  const cell = o.userData?.cell;
  const cells = o.userData?.cells;
  let inRemoved = false;
  if (cell) inRemoved = removed.has(`${cell.ix},${cell.iy},${cell.iz}`);
  else if (Array.isArray(cells)) inRemoved = cells.some((k) => removed.has(String(k)));
  if (!inRemoved) return;
  const key = [
    o.name || "(无名)",
    hex(o.material),
    o.userData.isOutline ? "描边壳" : "表面",
    o.userData.mergedGeometry ? "合并块" : "独立",
    o.visible ? "可见" : "隐藏",
  ].join(" | ");
  const e = hits.get(key) || { n: 0, tris: 0 };
  e.n++; e.tris += tri(o);
  hits.set(key, e);
});

// ---- 合并块里没被压缩掉的区间 ----
citadel.traverse((o) => {
  if (!o.isMesh || o.userData?.mergedGeometry !== true) return;
  const map = o.userData?.faceToCell;
  if (!Array.isArray(map)) return;
  for (const seg of map) {
    const c = seg.cell;
    if (!c) continue;
    const k = typeof c === "string" ? c : `${c.ix},${c.iy},${c.iz}`;
    if (removed.has(k)) mergedResidueTris += seg.triCount || 0;
  }
});

console.log("\n仍然落在被删格上的网格：");
if (!hits.size) console.log("  （无）");
for (const [k, v] of [...hits.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 20)) {
  console.log(`  ${String(v.n).padStart(4)} 个 / ${String(v.tris).padStart(6)} tris   ${k}`);
}
console.log(`\n合并块 faceToCell 里仍指向被删格的三角：${mergedResidueTris}`);

// ---- 被删区域周围还剩什么材质（找「灰色」）----
const grey = new Map();
citadel.traverse((o) => {
  if (!o.isMesh || !o.material?.color) return;
  const c = o.material.color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max - min > 0.06) return;          // 有色相的跳过
  if (max > 0.75 || max < 0.05) return;  // 太白 / 纯黑跳过
  const key = `${o.name || "(无名)"} | #${c.getHexString()} | ${o.userData.isOutline ? "描边" : "表面"}`;
  const e = grey.get(key) || { n: 0, tris: 0 };
  e.n++; e.tris += tri(o);
  grey.set(key, e);
});
// 顺带把每类灰色网格的**父链**打出来——名字为空时，只有父链能说明它是谁
const chain = (o) => {
  const out = [];
  let p = o.parent;
  for (let i = 0; i < 5 && p; i++) { if (p.name) out.push(p.name); p = p.parent; }
  return out.join(" < ") || "(无名父链)";
};
const greyWho = new Map();
citadel.traverse((o) => {
  if (!o.isMesh || !o.material?.color) return;
  const c = o.material.color;
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
  if (max - min > 0.06 || max > 0.75 || max < 0.05) return;
  const key = `#${c.getHexString()} | ${o.userData.isOutline ? "描边" : "表面"} | ${o.name || "(无名)"} < ${chain(o)}`;
  const e = greyWho.get(key) || { n: 0, tris: 0 };
  e.n++; e.tris += tri(o);
  greyWho.set(key, e);
});
console.log("\n灰色网格的出身（父链）：");
for (const [k, v] of [...greyWho.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 12)) {
  console.log(`  ${String(v.n).padStart(4)} 个 / ${String(v.tris).padStart(7)} tris`);
  console.log(`        ${k}`);
}

console.log("\n场景里所有「灰色」（低饱和、中等明度）网格 Top：");
for (const [k, v] of [...grey.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 12)) {
  console.log(`  ${String(v.n).padStart(4)} 个 / ${String(v.tris).padStart(7)} tris   ${k}`);
}
