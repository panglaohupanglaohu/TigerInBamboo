// =====================================================================
// C6 · WFC 选型接线：默认关时几何不改；打开后顶格角色来自 solveTownSelection
// 用法：node tools/test_wfc_town_wiring.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const {
  makeTownRoleOracle, partitionRoofComponent, resolveTownSelection,
} = await import(new URL("world/citadel/wfcTownWiring.js", SRC).href);

const off = makeTownRoleOracle(null);
assert.equal(off.enabled, false);
const cells = [[0, 0], [1, 0], [2, 0]];
const passthrough = partitionRoofComponent(cells, 3, off);
assert.equal(passthrough.slopedGroups.length, 1);
assert.equal(passthrough.flatGroups.length, 0);
assert.deepEqual(passthrough.slopedGroups[0], cells);

const fake = makeTownRoleOracle({
  ok: true,
  roleAt: (ix, iy, iz) => {
    if (iy !== 1) return "body";
    if (ix <= 1) return "gable";
    return "terrace";
  },
});
assert.equal(fake.enabled, true);
const split = partitionRoofComponent([[0, 0], [1, 0], [2, 0], [3, 0]], 1, fake);
assert.equal(split.slopedGroups.length, 1);
assert.equal(split.slopedGroups[0].length, 2);
assert.equal(split.flatGroups.length, 1);
assert.equal(split.flatGroups[0].length, 2);
console.log("✓ partitionRoofComponent 关=原样 / 开=坡平拆开");

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
const town = await import(new URL("src/world/citadelTown.js", BASE).href);

assert.equal(P.wfcTownV1, false, "默认必须关");
P.wfcTownV1 = true;
console.log("building with wfcTownV1=1 …");
const onCastle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const onStats = onCastle.userData.townStats ?? {};
assert.equal(onStats.wfcTown?.enabled, true);
assert.equal(onStats.wfcTown?.ok, true, `WFC 求解失败 unresolved=${onStats.wfcTown?.unresolved}`);
assert.equal(onStats.wfcTown?.unresolved, 0);

const layout = town.normalizeCitadelTerraceLayout(town.HIGHLAND_TOWNSCAPER_TOWN_SPEC, 12);
const grid = town.levelsToGrid(layout.levels ?? layout.terraces?.[0]?.levels ?? layout);
const solved = resolveTownSelection(grid, { seed: 1 });
assert.equal(solved.ok, true);
let sloped = 0, flat = 0, garden = 0;
for (const [id, cell] of Object.entries(solved.byCell)) {
  const iy = Number(id.split(",")[1]);
  const role = cell.variant;
  const top = grid.has(id) && !grid.has(`${id.split(",")[0]},${iy + 1},${id.split(",")[2]}`);
  if (!top) continue;
  if (role === "gable" || role === "hip" || role === "cone") sloped++;
  if (role === "terrace" || role === "flat" || role === "garden") flat++;
  if (role === "garden") garden++;
}
console.log(
  `✓ 打开 ok hash=${onStats.wfcTown.hash} ms=${onStats.wfcTown.ms} ` +
  `顶格坡=${sloped} 平=${flat} 花园角色=${garden} ` +
  `几何 roof=${onStats.roofCount} garden=${onStats.gardenCount} steeple=${onStats.steepleCount}`
);
assert.ok(sloped + flat > 0, "顶格应有坡或平角色");
P.wfcTownV1 = false;
console.log("✅ test_wfc_town_wiring");
