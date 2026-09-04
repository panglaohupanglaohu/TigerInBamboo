// =====================================================================
// 从现有生产布局反向抽取家族×家族×六向邻接原始计数（G-04）
// 只统计，不生成规则。用法：node tools/extract_adjacency_stats.mjs
// =====================================================================
import fs from "node:fs";
import path from "node:path";
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

const {
  HIGHLAND_TOWNSCAPER_TOWN_SPEC,
  CANAL_JUNCTION_TOWN_SPEC,
  levelsToGrid,
  townscaperModuleSelection,
  TOWNSCAPER_MODULE_FAMILIES,
} = ct;

// 与 citadelTown.js:1403 openMaskFor 位序一致：DIRS = +x,-x,+z,-z
const OPEN_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DELTA = {
  N: [0, 0, -1],
  S: [0, 0, 1],
  W: [-1, 0, 0],
  E: [1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
};
const FAMILIES = Object.keys(TOWNSCAPER_MODULE_FAMILIES);

function openMaskFor(grid, ix, iy, iz) {
  let mask = 0;
  for (let i = 0; i < OPEN_DIRS.length; i++) {
    const [dx, dz] = OPEN_DIRS[i];
    if (!grid.has(`${ix + dx},${iy},${iz + dz}`)) mask |= 1 << i;
  }
  return mask;
}

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function emptyByFamily() {
  const out = {};
  for (const fam of FAMILIES) {
    out[fam] = {};
    for (const dir of Object.keys(DELTA)) out[fam][dir] = { air: 0 };
  }
  return out;
}

const specs = [
  { id: "highland-townscaper", spec: HIGHLAND_TOWNSCAPER_TOWN_SPEC },
  { id: "canal-junction", spec: CANAL_JUNCTION_TOWN_SPEC },
];

const counts = {};
const byFamily = emptyByFamily();
const specCells = {};
let totalCells = 0;

for (const { id, spec } of specs) {
  if (!Array.isArray(spec?.levels)) {
    console.error(`spec ${id} 没有 levels`);
    process.exit(1);
  }
  const grid = levelsToGrid(spec.levels);
  specCells[id] = grid.size;
  totalCells += grid.size;
  for (const [key, char] of grid) {
    const [ix, iy, iz] = key.split(",").map(Number);
    const a = townscaperModuleSelection(ix, iy, iz, char, 0, openMaskFor(grid, ix, iy, iz));
    for (const [dir, [dx, dy, dz]] of Object.entries(DELTA)) {
      const nk = `${ix + dx},${iy + dy},${iz + dz}`;
      const nc = grid.get(nk);
      if (!nc) {
        bump(counts, `*|${dir}|air`);
        for (const fam of FAMILIES) bump(byFamily[fam][dir], "air");
        continue;
      }
      const b = townscaperModuleSelection(
        ix + dx, iy + dy, iz + dz, nc, 0, openMaskFor(grid, ix + dx, iy + dy, iz + dz)
      );
      for (const fam of FAMILIES) {
        bump(counts, `${fam}.${a[fam]}|${dir}|${fam}.${b[fam]}`);
        bump(byFamily[fam][dir], fam);
      }
    }
  }
}

if (totalCells <= 0 || !Object.keys(counts).length) {
  console.error("adjacency stats empty");
  process.exit(1);
}

for (const fam of FAMILIES) {
  for (const dir of Object.keys(DELTA)) {
    if (!byFamily[fam][dir].air) {
      console.error(`${fam} ${dir} 缺少 air 计数`);
      process.exit(1);
    }
  }
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(outDir, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  specs: specCells,
  totalCells,
  families: FAMILIES,
  counts,
  byFamily,
};
fs.writeFileSync(path.join(outDir, "adjacency_stats.json"), JSON.stringify(payload));
console.log(
  `totalCells=${totalCells} highland=${specCells["highland-townscaper"]} ` +
    `canal=${specCells["canal-junction"]} countKeys=${Object.keys(counts).length}`
);
if (totalCells < 900) {
  console.error(`totalCells ${totalCells} < 900`);
  process.exit(1);
}
console.log("✅ extract_adjacency_stats");
