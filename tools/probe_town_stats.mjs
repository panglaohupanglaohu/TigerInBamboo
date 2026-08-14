// 圣城城镇网格构成统计（node 直跑）
// 运行：node tools/probe_town_stats.mjs
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
const { buildOdysseyCitadel } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const citadel = buildOdysseyCitadel({ seed: 20260808, planetRadius: 160, place: false });

const stats = {
  total: 0,
  cell: 0,          // userData.cell 存在（编辑器拾取）
  window: 0,        // citadelWindow（夜间切换材质）
  terrainObject: 0, // terrainObjectId（塔/树拾取）
  outline: 0,
  other: 0,
};
const byName = new Map();
citadel.traverse((o) => {
  if (!o.isMesh) return;
  stats.total++;
  if (o.userData.isOutline) stats.outline++;
  else if (o.userData.cell) stats.cell++;
  else if (o.userData.citadelWindow) stats.window++;
  else if (o.userData.terrainObjectId) stats.terrainObject++;
  else {
    stats.other++;
    const n = (o.name || "unnamed").replace(/-\d+$/, "");
    byName.set(n, (byName.get(n) || 0) + 1);
  }
});
console.log(JSON.stringify(stats, null, 2));
const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log("other 按名分布:", JSON.stringify(Object.fromEntries(top), null, 2));
