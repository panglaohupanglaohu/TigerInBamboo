// =====================================================================
// 归属缺口审计（2026-09-03，C1）
//
// 合并块要支持按 faceToCell 区间局部替换，前提是层组内每个网格都能声明
// 自己属于哪一格。判据必须与增量重建第 2 步「摘旧网格」逐字一致：
//   o.isMesh && (o.userData.cell || o.userData.townModule)
// 认领得比摘除得少 → 差集留在合并块里、第 3 步再造一份 → 重影。
//
// 用法：
//   node tools/audit_cell_ownership.mjs            # 清单
//   node tools/audit_cell_ownership.mjs --gate     # 无主 > 0 则非零退出（CI 门 A）
//   node tools/audit_cell_ownership.mjs --by-level # 附按层分布
// =====================================================================
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

const argv = new Set(process.argv.slice(2));
const GATE = argv.has("--gate");
const BY_LEVEL = argv.has("--by-level");

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const tri = (o) => {
  const p = o.geometry?.attributes?.position;
  return p ? Math.floor((o.geometry.index?.count ?? p.count) / 3) : 0;
};
/** 与增量重建第 2 步摘旧网格逐字同口径：只看网格自身，不看父组。 */
const ownerOf = (o) => o.userData?.cell ?? o.userData?.townModule ?? o.userData?.cells ?? null;

// town-shrub-20-trunk / town-courtyard-tree-50-trunk 这类实例序号归并成一类，
// 否则清单散成几百行，看不出该先修哪个创建点。
const normalizeName = (name) => String(name).replace(/-\d+(?=-|$)/g, "-N");

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = citadel.userData.townSpec;

// 支架等构件参与合并，构建后已被吸收。用 debounceMs>0 跳过合并，
// 让第 3 步挂上的网格保持独立——这才是「摘旧网格」实际面对的形态。
const allCells = [];
for (const terrace of spec.terraces ?? []) {
  (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
    String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
  }));
}
m.rebuildCitadelTownIncremental(citadel, spec, allCells, { debounceMs: 400 });

const inLevelGroup = (o) => {
  for (let n = o, i = 0; n && i < 8; n = n.parent, i++) {
    if (/^town-terrace-\d+-level-\d+$/.test(n.name || "")) return n.name;
  }
  return null;
};

const owned = new Map();     // name -> { n, t }
const orphan = new Map();
const orphanByLevel = new Map();
citadel.traverse((o) => {
  if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
  const level = inLevelGroup(o);
  if (!level) return;
  const bucket = ownerOf(o) ? owned : orphan;
  const name = normalizeName(o.name || `(匿名·父=${o.parent?.name || "?"})`);
  const e = bucket.get(name) ?? { n: 0, t: 0 };
  e.n++; e.t += tri(o);
  bucket.set(name, e);
  if (!ownerOf(o)) orphanByLevel.set(level, (orphanByLevel.get(level) ?? 0) + tri(o));
});

const sum = (map) => [...map.values()].reduce((a, e) => a + e.t, 0);
const T = sum(owned);
const U = sum(orphan);
const total = T + U;
const pct = total ? (U / total * 100) : 0;

console.log(`层组内网格几何：有主 ${T} tris · 无主 ${U} tris · 无主占 ${pct.toFixed(1)}%`);

if (U > 0) {
  const rows = [...orphan.entries()].sort((a, b) => b[1].t - a[1].t);
  const shown = argv.has("--all") ? rows : rows.slice(0, 20);
  console.log(`\n无主几何（按三角形降序，${shown.length}/${rows.length} 类；--all 看全部）：`);
  console.log("   tris    占比   网格数  名称");
  for (const [name, e] of shown) {
    console.log(`  ${String(e.t).padStart(6)}  ${(e.t / U * 100).toFixed(1).padStart(5)}%  ×${String(e.n).padStart(5)}  ${name}`);
  }
  const rest = rows.slice(shown.length).reduce((a, [, e]) => a + e.t, 0);
  if (rest) console.log(`  ${String(rest).padStart(6)}  ${(rest / U * 100).toFixed(1).padStart(5)}%          （其余 ${rows.length - shown.length} 类合计）`);
  if (BY_LEVEL) {
    console.log("\n按层分布：");
    for (const [lv, t] of [...orphanByLevel.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(t).padStart(6)} tris  ${lv}`);
    }
  }
}

if (GATE && U > 0) {
  console.error(`\n❌ 门 A 未过：层组内仍有 ${U} tris（${pct.toFixed(1)}%）无主几何。` +
    "\n   合并块无法按格局部替换，增量编辑只能整层重来。");
  process.exit(1);
}
console.log(U === 0 ? "\n✅ 门 A：无主几何 = 0" : "\n（清单模式，未设门；加 --gate 可作 CI 门 A）");
