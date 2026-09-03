// =====================================================================
// 合并网格回收验收（2026-09-03）
//
// 增量重建把每层网格烤成合并网格（mergeStaticGroup）。清理逻辑只回收
// dirtyLevels 里的合并网格：
//   if (child.isMesh && child.userData.mergedGeometry === true) { ... }
// 如果某层内容变了却没被算进 dirtyLevels，它的旧合并网格会留在场景里，
// 连同烘死在里面的旧墙旧窗——表现就是「删了格，屋顶和窗还浮着」。
//
// 判据用三角形总数：同一份布局，增量重建的结果不得比全量重建更重。
// 多出来的三角形只可能来自没被回收的旧网格。
// =====================================================================
import fs from "node:fs";
import assert from "node:assert/strict";
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

const tris = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    n += Math.floor((o.geometry.index?.count ?? pos.count) / 3);
  });
  return n;
};

const charAt = (spec, ix, iy, iz) => {
  const rows = spec?.terraces?.[0]?.levels?.[iy];
  return (rows?.[iz] || ".")[ix] || ".";
};
function withCell(spec, ix, iy, iz, char) {
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[iy];
  const row = String(rows[iz]).split("");
  row[ix] = char;
  rows[iz] = row.join("");
  return next;
}

const castleA = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const layout = castleA.userData.townSpec;

// 找一格实心的，把它挖掉
let target = null;
outer:
for (let iy = 1; iy < (layout.terraces[0].levels.length ?? 0); iy++) {
  for (let iz = 2; iz < 22; iz++) {
    for (let ix = 2; ix < 22; ix++) {
      if (charAt(layout, ix, iy, iz) !== ".") { target = { ix, iy, iz }; break outer; }
    }
  }
}
assert.ok(target, "找不到可挖的实心格");
const { ix, iy, iz } = target;
const edited = withCell(layout, ix, iy, iz, ".");

// A：增量路径（debounceMs=0 → 立即合并，与玩家停手后的最终状态一致）
const edits = m.diffCitadelLayouts(layout, edited);
const dirty = m.computeCitadelDirtyCells(edits);
const incr = m.rebuildCitadelTownIncremental(castleA, edited, [...dirty], { debounceMs: 0 });
assert.ok(incr.ok, `增量重建失败：${incr.error ?? "unknown"}`);
const incrTris = tris(castleA);

// B：全量路径（同一份布局的权威结果）
const castleB = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
m.rebuildCitadelTown(castleB, edited);
const fullTris = tris(castleB);

console.log(`挖掉 ${ix},${iy},${iz}`);
console.log(`增量三角形 ${incrTris}  全量三角形 ${fullTris}  差 ${incrTris - fullTris}`);

// 双向都要卡：偏大 = 旧网格没回收；偏小 = 新网格没挂回来（主人截屏里
// 「只剩屋顶和窗」就是后者）。2026-09-03 实测增量只有全量的 38%。
const ratio = fullTris > 0 ? incrTris / fullTris : 1;
assert.ok(
  ratio > 0.95 && ratio < 1.05,
  ratio < 1
    ? `增量重建丢失几何：三角形 ${incrTris} vs 全量 ${fullTris}（只剩 ${(ratio * 100).toFixed(1)}%）`
    : `增量重建残留旧网格：三角形 ${incrTris} vs 全量 ${fullTris}（${(ratio * 100).toFixed(1)}%）`
);

console.log("✅ test_merged_mesh_recycle");
