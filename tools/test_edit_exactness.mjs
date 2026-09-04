// =====================================================================
// 单次编辑精确性验收（2026-09-04）
//
// 比 test_edit_soak 敏感得多的不变量：**一次编辑之后，增量结果必须与同布局
// 全量重建逐格相等**（按 faceToCell / userData 归属聚合，不比对顶点顺序）。
//
// 它专抓「某个规则块漏了 want() 门，非 dirty 格也重发一遍」这类错——
// 实测屋顶 strip 分支就漏了，每次编辑给每个长屋顶分量多发 12 tris，
// 20 次累积到 +8%。soak 的 ±5% 阈值抓不住单次 0.2% 的漏，这条能。
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

/** 按归属聚合三角形数：合并块读 faceToCell 区间，散网格读自身归属。 */
function claimed(root) {
  const bag = new Map();
  const add = (key, n) => { if (key && n) bag.set(key, (bag.get(key) ?? 0) + n); };
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const f2c = o.userData?.faceToCell;
    if (f2c) {
      for (const seg of f2c) {
        add(seg.cell ? `cell:${seg.cell.ix},${seg.cell.iy},${seg.cell.iz}` : `span:${seg.cells?.join("+")}`, seg.triCount);
      }
      return;
    }
    const own = o.userData?.cell ?? o.userData?.townModule;
    if (own) add(`cell:${own.ix},${own.iy},${own.iz}`, tri(o));
    else if (o.userData?.cells) add(`span:${o.userData.cells.join("+")}`, tri(o));
  });
  return bag;
}

function runOne(label, mutate) {
  const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));
  const next = JSON.parse(JSON.stringify(spec));
  const target = mutate(next);
  assert.ok(target, `${label}：找不到可编辑的格`);

  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  assert.ok(r.ok, `${label}：增量失败 ${r.error ?? ""}`);

  const ref = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  m.rebuildCitadelTown(ref, next);

  const got = claimed(citadel);
  const want = claimed(ref);
  let extra = 0, missing = 0;
  const worst = [];
  for (const key of new Set([...got.keys(), ...want.keys()])) {
    const d = (got.get(key) ?? 0) - (want.get(key) ?? 0);
    if (!d) continue;
    if (d > 0) extra += d; else missing += -d;
    worst.push([key, d]);
  }
  worst.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (worst.length) {
    console.log(`  ${label} 差异 TOP：`);
    worst.slice(0, 5).forEach(([k, d]) => console.log(`    ${d > 0 ? "+" : ""}${d}  ${k.slice(0, 64)}`));
  }
  console.log(`  ${label}（${target.ix},${target.iy},${target.iz}）多出 ${extra} · 缺少 ${missing}`);
  assert.equal(extra, 0, `${label}：增量比全量多 ${extra} tris——某个规则块漏了 want() 门，非 dirty 格被重发`);
  assert.equal(missing, 0, `${label}：增量比全量少 ${missing} tris——摘除口径比重建口径宽，几何被误删`);
}

console.log("单次编辑 vs 同布局全量重建：");

runOne("删格", (s) => {
  const lv = s.terraces[0].levels;
  for (let iy = 2; iy < 6; iy++) {
    for (let iz = 4; iz < 12; iz++) {
      const row = String(lv[iy]?.[iz] ?? "");
      for (let ix = 4; ix < 12; ix++) {
        if ((row[ix] ?? ".") !== ".") {
          const rows = lv[iy]; const r = String(rows[iz]).split("");
          r[ix] = "."; rows[iz] = r.join("");
          return { ix, iy, iz };
        }
      }
    }
  }
  return null;
});

runOne("加格", (s) => {
  const lv = s.terraces[0].levels;
  for (let iy = 2; iy < 6; iy++) {
    for (let iz = 4; iz < 12; iz++) {
      const row = String(lv[iy]?.[iz] ?? "");
      for (let ix = 4; ix < 12; ix++) {
        if ((row[ix] ?? ".") === ".") {
          const rows = lv[iy]; const r = String(rows[iz]).split("");
          r[ix] = "5"; rows[iz] = r.join("");
          return { ix, iy, iz };
        }
      }
    }
  }
  return null;
});

console.log("✅ test_edit_exactness");
