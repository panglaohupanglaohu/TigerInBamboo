// =====================================================================
// 连续编辑累积验收（2026-09-03，C4 已知回归的守门）
//
// C4 把整块删换成区间压缩后，单次编辑几何正确、P50 从 558ms 降到 ~95ms。
// 但连续编辑下几何会缓慢累积：20 次编辑（每次都是**挖掉**一格，几何本应减少）
// 之后，增量结果比同布局全量重建多约 8%，合并块 385 → 418。
//
// 成因（实测）：
//   · 已认领几何也在增长（每次约 +540 tris，而删格本应 −)
//   · faceToCell 覆盖率缓慢退化 99.7% → 99.0%（每次约 120~240 tris 变成
//     永远压缩不掉的无主区间）
//
// 这条测试不假装问题已解决，它把**今天的数字**钉成天花板，防止继续恶化；
// 目标值写在 CITADEL_BUILD_PIPELINE_TODOS.md C4 未尽项里。
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

const tri = (o) => {
  const p = o.geometry?.attributes?.position;
  return p ? Math.floor((o.geometry.index?.count ?? p.count) / 3) : 0;
};
const stat = (root) => {
  let tris = 0, blocks = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    tris += tri(o);
    if (o.userData?.mergedGeometry === true) blocks++;
  });
  return { tris, blocks };
};

const EDITS = 20;
const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));

const levels = spec.terraces[0].levels;
const targets = [];
for (let iy = 1; iy < 6; iy++) {
  for (let iz = 3; iz < 9; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 3; ix < 9; ix++) if ((row[ix] ?? ".") !== ".") targets.push({ ix, iy, iz });
  }
}
assert.ok(targets.length >= EDITS, `需要至少 ${EDITS} 个可编辑格，实际 ${targets.length}`);

const editMs = [];
for (let n = 0; n < EDITS; n++) {
  const t = targets[n];
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[t.iy];
  const row = String(rows[t.iz]).split("");
  row[t.ix] = ".";
  rows[t.iz] = row.join("");
  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const t0 = performance.now();
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  editMs.push(performance.now() - t0);
  assert.ok(r.ok, `第 ${n + 1} 次增量失败：${r.error ?? ""}`);
  spec = next;
}

// 同布局全量重建 = 真实目标值
const ref = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
m.rebuildCitadelTown(ref, spec);

const got = stat(citadel);
const want = stat(ref);
const drift = (got.tris / want.tris - 1) * 100;
editMs.sort((a, b) => a - b);
const p50 = editMs[Math.floor(EDITS / 2)];

console.log(`${EDITS} 次连续编辑（每次挖一格）`);
console.log(`  增量 ${got.tris} tris / ${got.blocks} 合并块`);
console.log(`  全量 ${want.tris} tris / ${want.blocks} 合并块`);
console.log(`  累积偏差 ${drift.toFixed(1)}%  ·  合并块净增 ${got.blocks - want.blocks}  ·  edit P50 ${p50.toFixed(1)}ms`);

// 天花板 = 2026-09-04 实测值（+3.5% / +33 块）留一点余量；目标见 TODOS C4 未尽项。
// 单次编辑已做到 0 误差（加/删皆然），残余只在多次编辑相互重叠时累积。
assert.ok(drift <= 5, `连续编辑累积 ${drift.toFixed(1)}% > 5%（今日实测 3.5%，不得继续恶化）`);
assert.ok(got.blocks - want.blocks <= 45, `合并块净增 ${got.blocks - want.blocks} > 45（今日实测 33）`);
assert.ok(drift >= -5, `增量比全量少 ${(-drift).toFixed(1)}%，说明在丢几何`);
assert.ok(p50 <= 150, `连续编辑 P50 ${p50.toFixed(1)}ms > 150`);

console.log("✅ test_edit_soak");
