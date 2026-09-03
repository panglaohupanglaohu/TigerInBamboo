// =====================================================================
// 装饰涟漪验收（2026-09-03）
//
// Oskar 原话（gamedeveloper.com 访谈）：
//   "when a block is removed, new constraints have been placed on
//    everything around it and they have to respect that change"
//
// 窗是【装饰遍】按「这一面朝不朝空气」贴上去的。所以在 A 格建楼，
// 邻格 B 朝 A 的那面墙不再朝空，B 的那扇窗必须消失；删掉 A，窗要回来。
// B 不是玩家点击的那一格 —— 这条规则考的正是增量重建的涟漪范围。
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

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const layout = castle.userData.townSpec;

const charAt = (spec, ix, iy, iz) => {
  const rows = spec?.terraces?.[0]?.levels?.[iy];
  return (rows?.[iz] || ".")[ix] || ".";
};

/** 深拷贝布局并把某格设成 char（"." = 挖空）。 */
function withCell(spec, ix, iy, iz, char) {
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[iy];
  const row = String(rows[iz]).split("");
  row[ix] = char;
  rows[iz] = row.join("");
  return next;
}

/** 数「属于 (ix,iy,iz) 这一格」的窗。 */
function windowsOfCell(root, ix, iy, iz) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.name !== "town-window") return;
    const c = o.userData?.cell || o.userData?.townModule;
    if (c && c.ix === ix && c.iy === iy && c.iz === iz) n++;
  });
  return n;
}

// 找一格：它自己是实心、朝 +z 的邻格是空、且它当前有窗
let target = null;
outer:
for (let iy = 1; iy < (layout.terraces[0].levels.length ?? 0); iy++) {
  for (let iz = 0; iz < 24; iz++) {
    for (let ix = 0; ix < 24; ix++) {
      if (charAt(layout, ix, iy, iz) === ".") continue;
      if (charAt(layout, ix, iy, iz + 1) !== ".") continue;
      if (windowsOfCell(castle, ix, iy, iz) === 0) continue;
      target = { ix, iy, iz };
      break outer;
    }
  }
}
assert.ok(target, "找不到「实心且朝空且有窗」的样本格");
const { ix, iy, iz } = target;
const before = windowsOfCell(castle, ix, iy, iz);
console.log(`样本格 ${ix},${iy},${iz} 初始窗数 ${before}`);

// 在 +z 邻格建楼：目标格那一面不再朝空 → 它的窗数必须下降
const filled = withCell(layout, ix, iy, iz + 1, "A");
m.rebuildCitadelTown(castle, filled);
const after = windowsOfCell(castle, ix, iy, iz);
console.log(`邻格建楼后 窗数 ${after}`);
assert.ok(after < before,
  `邻格被填实后，朝该邻格的那扇窗必须消失（${before} → ${after}）`);

// 挖回去：窗要回来
m.rebuildCitadelTown(castle, layout);
const restored = windowsOfCell(castle, ix, iy, iz);
console.log(`邻格挖回后 窗数 ${restored}`);
assert.equal(restored, before, "邻格挖空后窗必须回来");

// ---- 增量路径必须给出同样的结果：玩家实际用的是它，不是全量 ----
const edits = m.diffCitadelLayouts(layout, filled);
const dirty = m.computeCitadelDirtyCells(edits);
assert.ok(
  dirty.has(`${ix},${iy},${iz}`),
  `dirty 范围必须覆盖受影响的邻格 ${ix},${iy},${iz}——否则它的窗不会被重算`
);
const incr = m.rebuildCitadelTownIncremental(castle, filled, [...dirty], { debounceMs: 0 });
assert.ok(incr.ok, `增量重建失败：${incr.error ?? "unknown"}`);
const afterIncr = windowsOfCell(castle, ix, iy, iz);
console.log(`增量·邻格建楼后 窗数 ${afterIncr}`);
assert.ok(afterIncr < before,
  `增量路径同样必须让那扇窗消失（${before} → ${afterIncr}）`);

const backEdits = m.diffCitadelLayouts(filled, layout);
const backDirty = m.computeCitadelDirtyCells(backEdits);
const incrBack = m.rebuildCitadelTownIncremental(castle, layout, [...backDirty], { debounceMs: 0 });
assert.ok(incrBack.ok);
const restoredIncr = windowsOfCell(castle, ix, iy, iz);
console.log(`增量·邻格挖回后 窗数 ${restoredIncr}`);
assert.equal(restoredIncr, before, "增量路径挖回后窗必须回来");

console.log("✅ test_decor_ripple");
