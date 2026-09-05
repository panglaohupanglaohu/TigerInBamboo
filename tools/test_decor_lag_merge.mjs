// =====================================================================
// C8 · 滞后合并：去抖到期先并体块，下一帧再并装饰
// 用法：node tools/test_decor_lag_merge.mjs
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
const { isDecorName } = await import(new URL("src/world/citadel/decoratePass.js", BASE).href);

const inLevelGroup = (o) => {
  for (let n = o, i = 0; n && i < 8; n = n.parent, i++) {
    if (/^town-terrace-\d+-level-\d+$/.test(n.name || "")) return true;
  }
  return false;
};

function census(root) {
  let bodyUnmerged = 0;
  let decorUnmerged = 0;
  let bodyMerged = 0;
  let decorMerged = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (!inLevelGroup(o)) return;
    const merged = o.userData?.mergedGeometry === true;
    const decor = o.userData?.mergedDecor === true || isDecorName(o.name);
    if (merged) {
      if (o.userData?.mergedDecor) decorMerged++;
      else bodyMerged++;
    } else if (decor) decorUnmerged++;
    else if (o.name !== "town-window" && !o.userData?.citadelWindow) bodyUnmerged++;
  });
  return { bodyUnmerged, decorUnmerged, bodyMerged, decorMerged };
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
const before = census(castle);
assert.ok(before.decorUnmerged > 0, "去抖未到期时应有未合并装饰");
assert.ok(before.bodyUnmerged > 0, "去抖未到期时应有未合并体块");
assert.equal(castle.userData.pendingMerge != null, true, "应挂起合并");

castle.update?.(0.5);
const afterBody = census(castle);
assert.equal(castle.userData.pendingMerge, null, "去抖到期后 pendingMerge 应清空");
assert.ok(castle.userData.pendingDecorMerge, "体块合并后应挂起装饰合并");
assert.ok(afterBody.bodyMerged > 0, "第一帧应有体块合并网格");
assert.equal(afterBody.decorMerged, 0, "第一帧不得并装饰");
assert.ok(afterBody.decorUnmerged > 0, "第一帧装饰仍应独立");
assert.ok(afterBody.bodyUnmerged < before.bodyUnmerged, "第一帧体块应被吸收");

castle.update?.(0.016);
const afterDecor = census(castle);
assert.equal(castle.userData.pendingDecorMerge, null, "第二帧装饰合并应落地");
assert.ok(afterDecor.decorMerged > 0, "第二帧应有装饰合并网格");
assert.equal(afterDecor.decorUnmerged, 0, "第二帧独立装饰应被吸收");

console.log(
  `去抖前 bodyU=${before.bodyUnmerged} decorU=${before.decorUnmerged} · ` +
  `体块帧 bodyM=${afterBody.bodyMerged} decorU=${afterBody.decorUnmerged} · ` +
  `装饰帧 decorM=${afterDecor.decorMerged} decorU=${afterDecor.decorUnmerged}`
);
console.log("✅ test_decor_lag_merge");
