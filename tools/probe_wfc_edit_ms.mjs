// C7 门 D：WFC 路径下单次编辑耗时。用法：node tools/probe_wfc_edit_ms.mjs
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

P.wfcTownV1 = true;
const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec0 = castle.userData.townSpec;
const samples = [];
for (let i = 0; i < 8; i++) {
  const spec = structuredClone(spec0);
  const row = spec.terraces[0].levels[2][5 + i];
  const ix = [...row].findIndex((ch) => ch !== ".");
  if (ix < 0) continue;
  const next = row.slice(0, ix) + "." + row.slice(ix + 1);
  spec.terraces[0].levels[2][5 + i] = next;
  const dirty = m.computeCitadelDirtyCells([{
    ix, iy: 2, iz: 5 + i, before: row[ix], after: ".",
  }]);
  const t0 = performance.now();
  m.rebuildCitadelTownIncremental(castle, spec, [...dirty], { debounceMs: 400 });
  samples.push(performance.now() - t0);
}
samples.sort((a, b) => a - b);
const p50 = samples[Math.floor(samples.length * 0.5)];
const p90 = samples[Math.floor(samples.length * 0.9)];
console.log(`WFC 开：n=${samples.length} P50=${p50.toFixed(1)}ms P90=${p90.toFixed(1)}ms min=${samples[0].toFixed(1)} max=${samples[samples.length - 1].toFixed(1)}`);
console.log(`wfcTown ${JSON.stringify(castle.userData.townStats?.wfcTown)}`);
P.wfcTownV1 = false;
