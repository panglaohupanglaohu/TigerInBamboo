// 圣城城镇合并验收：网格数骤降 + cell 面映射可用 + 窗口保留（node 直跑）
// 运行：node tools/probe_town_merge.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
globalThis.document = { getElementById: el, querySelector: el, createElement: el };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.document.createElement = (tag) => {
  if (tag === "canvas") {
    const ctx2d = new Proxy({}, { get(t, k) {
      if (k === "canvas") return { width: 256, height: 256 };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      return typeof k === "string" ? () => {} : undefined;
    }});
    return { width: 256, height: 256, getContext: () => ctx2d };
  }
  return el();
};

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildOdysseyCitadel, rebuildCitadelTown } = await import(
  new URL("src/world/odysseyCitadel.js", BASE).href
);
const { lookupMergedCell } = await import(new URL("src/ui/citadelSceneEdit.js", BASE).href);

const countMeshes = (root) => {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n++; });
  return n;
};

const citadel = buildOdysseyCitadel({ seed: 20260808, planetRadius: 160, place: false });
const total = countMeshes(citadel);
console.log("合并后圣城总网格:", total);
assert(total < 400, `合并后应 <400（实际 ${total}）`);

// 窗口保留独立（夜间切换材质）
let windows = 0;
citadel.traverse((o) => { if (o.isMesh && o.name === "town-window") windows++; });
assert(windows >= 100, `窗口应保留独立网格（实际 ${windows}）`);
console.log("窗口独立网格:", windows);

// cell 面映射可用
let mappedCells = 0;
let mergedWithMap = 0;
const seenCells = new Set();
citadel.traverse((o) => {
  if (o.isMesh && o.userData?.faceToCell) {
    mergedWithMap++;
    for (const e of o.userData.faceToCell) {
      mappedCells++;
      seenCells.add(`${e.cell.ix},${e.cell.iy},${e.cell.iz}`);
    }
  }
});
console.log(`faceToCell 映射: ${mergedWithMap} 个合并网格 / ${mappedCells} 段 / ${seenCells.size} 个唯一 cell`);
assert(mergedWithMap >= 1, "应有合并网格带 faceToCell");
assert(mappedCells >= 150, `映射段应覆盖大部分体块（实际 ${mappedCells}）`);

// lookupMergedCell 反查：对每个映射段取中间三角形，应还原出 cell
let lookupOK = 0;
citadel.traverse((o) => {
  if (!o.isMesh || !o.userData?.faceToCell) return;
  for (const e of o.userData.faceToCell) {
    const midTri = e.triStart + Math.floor(e.triCount / 2);
    const cell = lookupMergedCell({ object: o, faceIndex: midTri });
    if (cell && cell.ix === e.cell.ix && cell.iz === e.cell.iz) lookupOK++;
  }
});
assert(lookupOK === mappedCells, `lookupMergedCell 应全部还原（${lookupOK}/${mappedCells}）`);
console.log("lookupMergedCell 反查:", `${lookupOK}/${mappedCells}`);

// 世界包围盒（逐顶点）与合并前对比——用 rebuild 生成未合并版本对照？
// 简化：验证合并后网格的包围盒落在城堡域内（半径 < 80、y 合理）
const v = new THREE.Vector3();
const box = new THREE.Box3();
citadel.traverse((m) => {
  if (!m.isMesh) return;
  const p = m.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
    box.expandByPoint(v);
  }
});
const size = box.max.clone().sub(box.min);
console.log("合并后包围盒:", box.min.toArray().map((x) => x.toFixed(1)), "~", box.max.toArray().map((x) => x.toFixed(1)), "size:", size.toArray().map((x) => x.toFixed(1)));
assert(size.x < 120 && size.z < 120, "城堡应落在合理域内");

// 幂等：rebuild 后再次合并不炸
const spec = citadel.userData.townSpec;
rebuildCitadelTown(citadel, spec);
const afterRebuild = countMeshes(citadel);
assert(afterRebuild < 400, `rebuild 后应保持合并（实际 ${afterRebuild}）`);
console.log("rebuild 热重建后网格:", afterRebuild);

console.log("\n结果：全部通过");
process.exit(0);
