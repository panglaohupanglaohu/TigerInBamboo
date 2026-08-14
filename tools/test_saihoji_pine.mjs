// 西芳寺主石之庭单株巨松验收（node 直跑）
// 运行：node tools/test_saihoji_pine.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

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
const { buildSaihojiPlanet } = await import(new URL("src/world/saihoji.js", BASE).href);

const scene = new THREE.Scene();
const built = buildSaihojiPlanet(scene, { seed: 884 });

// 主石之庭应只剩一株完整尺寸巨松（giantA），giantB 已移往圣城港口
let fullSize = 0;
let small = 0;
built.group.traverse((o) => {
  if (o.name === "giantTreeGroup") {
    if (Math.abs(o.scale.x - 1) < 0.01) fullSize++;
    else small++;
  }
});
assert.equal(fullSize, 1, `完整尺寸巨松应恰 1 株（实际 ${fullSize}）`);
assert(small >= 5, "庭园点缀小松应保留");
console.log(`  ✓ 主石之庭完整巨松 1 株（点缀小松 ${small} 株仍在）`);

// colliders 含该巨松（半径 2.6）
const masterColliders = built.colliders?.filter((c) => c.radius >= 2) || [];
assert.equal(masterColliders.length, 1, `巨松 collider 应恰 1 个（实际 ${masterColliders.length}）`);
console.log("  ✓ 巨松碰撞体 1 个（r=2.6）");

console.log("\n结果：2/2 通过");
process.exit(0);
