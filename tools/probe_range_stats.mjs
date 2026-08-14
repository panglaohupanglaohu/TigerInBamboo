// 圣城整体网格构成统计（node 直跑）
// 运行：node tools/probe_range_stats.mjs
import fs from "node:fs";
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
const { buildCitadelRange } = await import(new URL("src/world/citadelRange.js", BASE).href);

const scene = new THREE.Scene();
const range = buildCitadelRange(scene, 160);

// 统计 scene 里圣城域的所有网格（buildCitadelRange 只加圣城自己的东西）
const byName = new Map();
let total = 0;
let outline = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  total++;
  if (o.userData.isOutline) { outline++; return; }
  const n = (o.name || "unnamed").replace(/-\d+$/, "").replace(/-(\d+)$/, "");
  byName.set(n, (byName.get(n) || 0) + 1);
});
console.log(`total=${total} outline=${outline} surface=${total - outline}`);
const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(JSON.stringify(Object.fromEntries(top), null, 2));
