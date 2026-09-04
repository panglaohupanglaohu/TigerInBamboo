// =====================================================================
// 合并块 faceToCell 与摘旧网格判据覆盖同一批格（G-01）
// 差集不为空 = 重影或丢几何。不在测试里过滤差集。
// 用法：node tools/test_face_to_cell_parity.mjs
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

function townLevelGroups(castle) {
  const groups = [];
  castle.traverse((o) => {
    if (/^town-terrace-\d+-level-\d+$/.test(o.name || "")) groups.push(o);
  });
  return groups;
}

function cellKeysOf(seg) {
  const keys = [];
  if (seg?.cell) {
    const c = seg.cell;
    if (c.ix != null) keys.push(`${c.ix},${c.iy},${c.iz}`);
    else keys.push(String(c));
  }
  if (seg?.cells) for (const k of seg.cells) keys.push(String(k));
  return keys;
}

function collectExtractKeys(castle) {
  const A = new Set();
  for (const level of townLevelGroups(castle)) {
    level.traverse((o) => {
      if (!o.isMesh) return;
      const u = o.userData ?? {};
      if (u.cell) A.add(`${u.cell.ix},${u.cell.iy},${u.cell.iz}`);
      else if (u.townModule) A.add(`${u.townModule.ix},${u.townModule.iy},${u.townModule.iz}`);
      else if (u.cells) for (const k of u.cells) A.add(String(k));
    });
  }
  return A;
}

function collectFaceKeys(castle) {
  const B = new Set();
  castle.traverse((o) => {
    if (!o.isMesh || o.userData?.mergedGeometry !== true) return;
    for (const seg of o.userData.faceToCell ?? []) {
      for (const k of cellKeysOf(seg)) B.add(k);
    }
  });
  return B;
}

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = castle.userData.townSpec;
const allCells = [];
for (const terrace of spec.terraces ?? []) {
  (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
    String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
  }));
}
m.rebuildCitadelTownIncremental(castle, spec, allCells, { debounceMs: 400 });

const A = collectExtractKeys(castle);
castle.update?.(1);

const B = collectFaceKeys(castle);
const onlyA = [...A].filter((k) => !B.has(k));
const onlyB = [...B].filter((k) => !A.has(k));
console.log(`A=${A.size} B=${B.size} onlyA=${onlyA.length} onlyB=${onlyB.length}`);
if (onlyA.length) console.log(`onlyA sample: ${onlyA.slice(0, 20).join(" | ")}`);
if (onlyB.length) {
  console.log(`onlyB sample: ${onlyB.slice(0, 20).join(" | ")}`);
  const byY = new Map();
  for (const k of onlyB) {
    const y = String(k).split(",")[1] ?? "?";
    byY.set(y, (byY.get(y) || 0) + 1);
  }
  console.log(`onlyB by iy: ${[...byY.entries()].map(([y, n]) => `y${y}:${n}`).join(" ")}`);
}

assert.equal(onlyA.length, 0, `摘得到但合并块没登记（会重影）: ${onlyA.slice(0, 10)}`);
assert.equal(onlyB.length, 0, `合并块登记了但摘不到（会丢几何）: ${onlyB.slice(0, 10)}`);
console.log("✅ test_face_to_cell_parity");
