// =====================================================================
// C9 / C11 接线：角柱装配与 stencil 挖窗（均默认关）
// 用法：node tools/test_corner_stencil_wiring.mjs
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

const { P } = await import(new URL("src/core/params.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

assert.equal(P.cornerModulesV1, false);
assert.equal(P.stencilWindowsV1, false);

function countNamed(root, pred) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh && pred(o)) n++; });
  return n;
}

{
  const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  assert.equal(countNamed(castle, (o) => String(o.name).startsWith("town-corner-")), 0);
  assert.equal(countNamed(castle, (o) => o.name === "town-window-stencil-cutter"), 0);
  console.log("✓ 默认关：无角柱零件、无 stencil cutter");
}

{
  P.cornerModulesV1 = true;
  const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const spec = castle.userData.townSpec;
  const allCells = [];
  for (const terrace of spec.terraces ?? []) {
    (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
      String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
    }));
  }
  m.rebuildCitadelTownIncremental(castle, spec, allCells, { debounceMs: 400 });
  const parts = countNamed(castle, (o) => String(o.name).startsWith("town-corner-"));
  const tops = countNamed(castle, (o) => /town-corner-(eave|terrace-slab|roof-slope|rail|garden|flat-slab|gable-face)/.test(o.name || ""));
  const cells = countNamed(castle, (o) => o.name === "town-cell");
  const plinth = countNamed(castle, (o) => o.name === "town-plinth");
  const roofs = countNamed(castle, (o) => o.name === "town-roof");
  assert.ok(parts > 0, "打开角柱后应有 town-corner-*");
  assert.ok(tops > 0, `应发出顶面/屋顶零件，parts=${parts}`);
  assert.equal(cells, 0, "角柱路径不应再发 town-cell");
  assert.equal(plinth, 0, "角柱路径不应再发 town-plinth");
  assert.equal(roofs, 0, "角柱路径不应再发手写 town-roof");
  let unowned = 0;
  castle.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
    const u = o.userData ?? {};
    if (u.cell || u.townModule || u.cells) return;
    for (let n = o, i = 0; n && i < 8; n = n.parent, i++) {
      if (/^town-terrace-\d+-level-\d+$/.test(n.name || "")) { unowned++; break; }
    }
  });
  assert.equal(unowned, 0, `角柱网格无主 ${unowned}`);
  console.log(`✓ 角柱开：parts=${parts} town-cell=0 plinth=0 unowned=0 stats=${castle.userData.townStats?.cornerPartCount}`);
  P.cornerModulesV1 = false;
}

{
  P.stencilWindowsV1 = true;
  const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const cutters = countNamed(castle, (o) => o.name === "town-window-stencil-cutter");
  const reveals = countNamed(castle, (o) => o.name === "town-window-stencil-reveal");
  assert.ok(cutters > 0, "打开 stencil 后应有 cutter");
  assert.equal(cutters, reveals, "cutter 与 reveal 应成对");
  assert.equal(typeof castle.userData.stencilWindowCleanup, "function");
  castle.userData.stencilWindowCleanup();
  assert.equal(countNamed(castle, (o) => o.name === "town-window-stencil-cutter"), 0);
  console.log(`✓ stencil 开：cutters=${cutters} reveals=${reveals} 卸载可逆`);
  P.stencilWindowsV1 = false;
}

console.log("✅ test_corner_stencil_wiring");
