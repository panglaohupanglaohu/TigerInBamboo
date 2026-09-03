// =====================================================================
// 竖向叠加验收（2026-09-03，主人截屏：单独建直立建筑，下层墙壁消失）
//
// 症状特征：窗/窗台还悬在半空，墙体没了。窗是 citadelTownMergeSkip 里唯一
// 不参与合并的网格 —— 合并块被整块删掉时，独立窗反而幸存，于是「窗浮空」。
// 所以这条断言直接盯症状：有窗的格子，必须有墙。
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

const key = (c) => `${c.ix},${c.iy},${c.iz}`;

/** 每个 cell 的墙体三角形数：独立网格 + 合并块 faceToCell 区间都算进来。 */
function wallTrisByCell(root) {
  const byCell = new Map();
  const add = (cell, n) => {
    if (!cell || !n) return;
    const k = key(cell);
    byCell.set(k, (byCell.get(k) ?? 0) + n);
  };
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const faceToCell = o.userData?.faceToCell;
    if (faceToCell) {
      for (const seg of faceToCell) add(seg.cell, seg.triCount);
      return;
    }
    // 窗/窗台/门楣是装饰，不算墙
    if (o.name === "town-window" || o.userData?.citadelWindow === true) return;
    if (o.userData?.decorKind) return;
    const p = o.geometry?.attributes?.position;
    if (!p) return;
    add(o.userData?.cell, Math.floor((o.geometry.index?.count ?? p.count) / 3));
  });
  return byCell;
}

/** 有窗的格子集合——窗不参与合并，永远是独立网格。 */
function cellsWithWindows(root) {
  const cells = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const isWindow = o.name === "town-window" || o.userData?.citadelWindow === true;
    if (!isWindow) return;
    const cell = o.userData?.cell ?? o.userData?.townModule;
    if (cell) cells.add(key(cell));
  });
  return cells;
}

const totalTris = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const p = o.geometry?.attributes?.position;
    if (p) n += Math.floor((o.geometry.index?.count ?? p.count) / 3);
  });
  return n;
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const setCell = (spec, { ix, iy, iz }, ch) => {
  const rows = spec.terraces[0].levels[iy];
  const row = String(rows[iz]).split("");
  row[ix] = ch;
  rows[iz] = row.join("");
};

// ---- 找一根「单独直立」的空柱：底层有地、上面全空 ----
const probe = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const baseSpec = probe.userData.townSpec;
const levels = baseSpec.terraces[0].levels;
const empty = (iy, ix, iz) => (String(levels[iy]?.[iz] ?? "")[ix] ?? ".") === ".";

let column = null;
outer:
for (let iz = 3; iz < 20; iz++) {
  for (let ix = 3; ix < 20; ix++) {
    let ok = true;
    for (let iy = 0; iy < 4; iy++) if (!empty(iy, ix, iz)) { ok = false; break; }
    if (ok && String(levels[0]?.[iz] ?? "")[ix] !== undefined) { column = { ix, iz }; break outer; }
  }
}
assert.ok(column, "布局里应能找到一根空柱用于叠加测试");

const STACK = [0, 1, 2, 3];
const finalSpec = clone(baseSpec);
for (const iy of STACK) setCell(finalSpec, { ix: column.ix, iy, iz: column.iz }, "#");

// ---- A) 增量：一格一格往上叠（主人的操作） ----
const inc = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let cur = clone(inc.userData.townSpec);
for (const iy of STACK) {
  const next = clone(cur);
  setCell(next, { ix: column.ix, iy, iz: column.iz }, "#");
  const dirty = m.computeCitadelDirtyCells(m.diffCitadelLayouts(cur, next));
  const r = m.rebuildCitadelTownIncremental(inc, next, [...dirty], { debounceMs: 0 });
  assert.ok(r.ok, `第 ${iy} 层增量应成功：${r.error ?? ""}`);
  cur = next;
}

// ---- B) 全量：同一个最终布局 ----
const full = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
m.rebuildCitadelTown(full, finalSpec);

// 断言 1：叠加过程中不得丢几何（±5%，与 test_merged_mesh_recycle 同口径）
const incTris = totalTris(inc);
const fullTris = totalTris(full);
const drift = Math.abs(incTris - fullTris) / fullTris;
console.log(`叠 ${STACK.length} 层后 增量 ${incTris} tris / 全量 ${fullTris} tris / 偏差 ${(drift * 100).toFixed(1)}%`);
assert.ok(drift <= 0.05, `竖向叠加后增量与全量偏差 ${(drift * 100).toFixed(1)}% > 5%`);

// 断言 2（盯截屏症状）：有窗的格子必须有墙，否则就是「窗浮空」
const walls = wallTrisByCell(inc);
const orphanWindows = [...cellsWithWindows(inc)].filter((k) => !(walls.get(k) > 0));
if (orphanWindows.length) {
  console.log("窗浮空的格子：", orphanWindows.slice(0, 12).join(" | "), `（共 ${orphanWindows.length}）`);
}
assert.equal(orphanWindows.length, 0, `有 ${orphanWindows.length} 个格子只剩窗、墙不见了`);

// 断言 3：新叠的柱子本身每层都得有墙
for (const iy of STACK) {
  const k = `${column.ix},${iy},${column.iz}`;
  assert.ok(walls.get(k) > 0, `新叠的第 ${iy} 层 (${k}) 没有墙体几何`);
}

console.log(`✅ test_stack_column_walls（柱 ix=${column.ix} iz=${column.iz}）`);
