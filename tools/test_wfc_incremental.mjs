// =====================================================================
// WFC 增量重解（G-10）
// ① region 外逐格不变  ② 20 次连续编辑 vs 全量 hash（只打印）  ③ P50
// 用法：node tools/test_wfc_incremental.mjs
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

const ct = await import(new URL("src/world/citadelTown.js", BASE).href);
const { solveTownSelection } = await import(new URL("src/world/citadel/wfcTownSelection.js", BASE).href);
const { resolveIncremental } = await import(new URL("src/world/citadel/wfcIncremental.js", BASE).href);

const { HIGHLAND_TOWNSCAPER_TOWN_SPEC, levelsToGrid, clearCell, TOWNSCAPER_MODULE_FAMILIES } = ct;

// 2026-09-04：原来这里用「六面 connector 全 any」的占位原型。C5 交付真原型后
// 占位原型会被 townBanPolicy 全数 ban 掉（它按 tags / SKY 面判顶格，占位原型
// 两样都没有）→ unsatisfiable。增量传播必须在**真约束**下验证才有意义，
// 否则 outsideChanged=0 只是因为压根没有约束在传播。
function cloneGrid(grid) {
  return new Map(grid);
}

const { TOWN_MODULE_PROTOTYPES: protos } = await import(new URL("src/world/citadel/townModulePrototypes.js", BASE).href);
const layout = ct.normalizeCitadelTerraceLayout(HIGHLAND_TOWNSCAPER_TOWN_SPEC, 12);
const base = levelsToGrid(layout.levels ?? layout.terraces?.[0]?.levels ?? layout);
const seed = 7;
const full0 = solveTownSelection({ grid: base, prototypes: protos, seed });
assert.ok(full0.ok, `full solve failed: ${full0.failure?.reason}`);

const targets = [...base.keys()].filter((k) => {
  const [, iy] = k.split(",").map(Number);
  return iy >= 1 && iy <= 4;
}).slice(0, 20);
assert.ok(targets.length >= 20, `need 20 cells, got ${targets.length}`);

const grid1 = cloneGrid(base);
clearCell(grid1, ...targets[0].split(",").map(Number));
const inc1 = resolveIncremental({
  grid: grid1,
  prototypes: protos,
  seed,
  previous: full0.byCell,
  dirtyKeys: [targets[0]],
  ring: 2,
});
assert.ok(inc1.ok, `incremental failed: ${inc1.failure?.reason}`);
const region = new Set(inc1.region);
const outsideChanged = [];
for (const [id] of grid1) {
  if (region.has(id)) continue;
  if (inc1.byCell[id]?.key !== full0.byCell[id]?.key) outsideChanged.push(id);
}
assert.equal(outsideChanged.length, 0, `传播锥外变化: ${outsideChanged.slice(0, 10)}`);

const times = [];
let grid = cloneGrid(base);
let previous = full0.byCell;
for (let n = 0; n < 20; n++) {
  const key = targets[n];
  const [ix, iy, iz] = key.split(",").map(Number);
  clearCell(grid, ix, iy, iz);
  const t0 = performance.now();
  const r = resolveIncremental({
    grid,
    prototypes: protos,
    seed,
    previous,
    dirtyKeys: [key],
    ring: 2,
  });
  times.push(performance.now() - t0);
  assert.ok(r.ok, `edit ${n + 1} failed: ${r.failure?.reason}`);
  previous = r.byCell;
}

times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length / 2)];

const fullEnd = solveTownSelection({ grid, prototypes: protos, seed });
assert.ok(fullEnd.ok);
let same = 0;
let diff = 0;
for (const [id] of grid) {
  if (previous[id]?.key === fullEnd.byCell[id]?.key) same++;
  else diff++;
}
console.log(
  `outsideChanged=0 ring=${inc1.ringUsed} soakSame=${same} soakDiff=${diff} ` +
    `hashInc=${fullEnd.hash === previous ? "n/a-bycell" : "compared-bycell"} ` +
    `fullHash=${fullEnd.hash} P50=${p50.toFixed(1)}ms`
);
console.log("✅ test_wfc_incremental");
