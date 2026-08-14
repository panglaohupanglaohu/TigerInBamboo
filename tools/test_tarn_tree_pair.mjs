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

// 网格构成：第二棵 = createAncientPineTree 资产（合并后按材质 ~6 组：
// bark/barkDark/inner/canopyA/canopyB + 描边；合并前为 130 个独立网格）
let compMeshes = 0;
comp.traverse((o) => { if (o.isMesh) compMeshes++; });
assert(compMeshes >= 3 && compMeshes <= 10,
  `第二棵巨松合并后网格数应 3~10（实际 ${compMeshes}）`);
ok(`第二棵巨松 ${compMeshes} 个合并网格（三段干+枝+云片冠，130→~6）`);

console.log(`\n结果：${pass}/4 通过`);
process.exit(0);
