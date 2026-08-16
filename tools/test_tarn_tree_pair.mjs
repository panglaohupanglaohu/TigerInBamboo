// 港口参天大树 + 第二棵巨松 定点验收（node 直跑）
// 运行：node tools/test_tarn_tree_pair.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// ---- DOM 桩（同 test_citadel_range.mjs）----
if (!globalThis.document) {
  const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
  globalThis.document = { getElementById: el, querySelector: el, createElement: el };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.window = globalThis;
  globalThis.window.addEventListener = () => {};
  globalThis.document.createElement = (tag) => {
    if (tag === "canvas") {
      const ctx2d = new Proxy({}, {
        get(t, k) {
          if (k === "canvas") return { width: 256, height: 256 };
          if (k === "createLinearGradient" || k === "createRadialGradient") {
            return () => ({ addColorStop() {} });
          }
          if (k === "measureText") return () => ({ width: 0 });
          if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
          if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
          return typeof k === "string" ? () => {} : undefined;
        },
      });
      return { width: 256, height: 256, getContext: () => ctx2d };
    }
    return el();
  };
}

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildCitadelRange, citadelSiteDir } = await import(new URL("src/world/citadelRange.js", BASE).href);

const R = 160;
const scene = new THREE.Scene();
const range = buildCitadelRange(scene, R);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

// ---- 1. 港口双株：参天大树 + 第二棵巨松 ----
const elder = range.sacredTarnTree;
const comp = range.tarnCompanionPine;
assert(elder?.isGroup, "参天大树缺失");
assert(comp?.isGroup, "第二棵巨松缺失");
assert.equal(comp.name, "citadel-tarn-companion-pine");

// 间距：两树干底半径约 1.8，间距取 3~10 单位（树冠交错、树干不叠）
const a = elder.userData.rangeLocal;
const b = comp.userData.rangeLocal;
const d = Math.hypot(a.lx - b.lx, a.lz - b.lz);
assert(d > 3 && d < 10, `间距 ${d.toFixed(2)} 应在 3~10`);
ok(`双株间距 ${d.toFixed(2)}（参天树 ${a.lx},${a.lz} ↔ 巨松 ${b.lx},${b.lz}）`);

// 偏转交错：第二棵绕地表法向再转 ~1.05 rad
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
elder.getWorldQuaternion(qa);
comp.getWorldQuaternion(qb);
const ang = qa.angleTo(qb);
assert(ang > 0.4 && ang < 2.4, `偏转 ${ang.toFixed(2)} rad 应体现交错（0.4~2.4）`);
ok(`第二棵偏转 ${ang.toFixed(2)} rad 与第一棵交错对生`);

// 世界位：两株都应落在港口深潭岸地（R 附近、站点侧）
const we = new THREE.Vector3();
const wc = new THREE.Vector3();
elder.getWorldPosition(we);
comp.getWorldPosition(wc);
assert(Math.abs(we.length() - R) < 2, `参天树世界半径 ${we.length().toFixed(2)}`);
assert(Math.abs(wc.length() - R) < 2, `第二棵世界半径 ${wc.length().toFixed(2)}`);
const siteDir = citadelSiteDir(new THREE.Vector3());
assert(we.clone().normalize().dot(siteDir) > 0.9, "双株应位于站点方向半球");
ok(`双株贴地：半径 ${wc.length().toFixed(2)} ≈ R=${R}`);

// 网格构成：第二棵 = createColossalVernacularTree（合并后少量绘制）
let compMeshes = 0;
comp.traverse((o) => { if (o.isMesh) compMeshes++; });
assert(compMeshes >= 2 && compMeshes <= 16,
  `第二棵巨木合并后网格数应 2~16（实际 ${compMeshes}）`);
ok(`第二棵巨木 ${compMeshes} 个合并网格（三股干+爆炸枝+伞冠）`);
assert.equal(comp.userData.assetType, "colossalVernacularTree", "第二棵应为港口专用地标巨木");
ok("第二棵为 createColossalVernacularTree 港口专用地标");

// ---- 2. 工笔古樟结构：双干合生 + 云片伞冠 ----
const { createColossalVernacularTree } = await import(new URL("src/assets/ancient.js", BASE).href);
const probe = createColossalVernacularTree({ seed: 4242, merge: false, namePrefix: "probe" });
let trunks = 0, branches = 0, crowns = 0, fills = 0, clouds = 0;
probe.traverse((o) => {
  if (o.isPointLight) fills++;
  if (o.isGroup && /cloud-/.test(o.name || "")) clouds++;
  if (!o.isMesh || o.userData.isOutline) return;
  const nm = o.name || "";
  if (nm.includes("trunk-") && nm.endsWith("-shaft")) trunks++;
  else if (nm.includes("branch-")) branches++;
  else if (nm.includes("crown-")) crowns++;
});
assert.equal(trunks, 3, `合生树干应为 3（实际 ${trunks}）`);
assert.equal(branches, 4, `藏冠骨干应为 4（实际 ${branches}）`);
assert.equal(clouds, 8, `云片团应为 8（实际 ${clouds}）`);
assert(crowns >= 60 && crowns <= 90, `云片叶团应 60–90（实际 ${crowns}）`);
assert.equal(fills, 1, "应有局部补光");
assert.equal(probe.userData.style, "gongbi-courtyard-camphor");
assert.equal(probe.userData.cloudPads, 8);
assert(probe.userData.canopyBands.dark > 0);
assert(probe.userData.canopyBands.mid > 0);
assert(probe.userData.canopyBands.light > 0);
ok(`工笔结构 3干+8云片+${crowns}叶团 三色齐全`);

const box = new THREE.Box3().setFromObject(probe);
const size = box.getSize(new THREE.Vector3());
assert(size.y >= 26, `总高度应 ≥26（实际 h=${size.y.toFixed(1)}）`);
assert(size.y < 42, `高度应 <42（实际 h=${size.y.toFixed(1)}）`);
assert(size.x > 20 && size.z > 14, `伞冠应宽于树干，实际 ${size.x.toFixed(1)}×${size.z.toFixed(1)}`);
ok(`体量 ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}（庭院古樟）`);

assert.equal(elder.userData.assetType, "colossalVernacularTree");
assert.equal(elder.userData.style, "gongbi-courtyard-camphor");
assert.equal(elder.userData.trunkCount, 3);
assert.equal(elder.userData.cloudPads, 8);
ok("港口双株同为工笔古樟");

console.log(`\n结果：${pass} 项通过`);
process.exit(0);
