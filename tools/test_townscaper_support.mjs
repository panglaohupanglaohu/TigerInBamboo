// 悬空支撑支架（Townscaper flying buildings）单元测试
// 验证：删除中间层后上层悬浮，下方自动生成八面体式四支柱边框
// 运行：node tools/test_townscaper_support.mjs
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
const { buildCitadelTownAssembly } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

let pass = 0, fail = 0;
const t = (cond, msg) => { if (cond) { console.log(`  ✓ ${msg}`); pass++; } else { console.log(`  ✗ ${msg}`); fail++; } };
// 验证：删除中间层后上层悬浮，下方自动生成支撑柱 + 斜撑

// 布局：一柱 3 层（y0/y1/y2），删除 y1 后 y2 悬空
const FLOATING = {
  cellSize: 2.0,
  cellHeight: 2.0,
  gridSize: 25,
  levels: [
    // y0：柱底
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
    // y1：空（被删除）
    Array.from({ length: 25 }, () => ".".repeat(25)),
    // y2：悬浮块
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
  ],
};
{
  const assembly = buildCitadelTownAssembly(FLOATING, { baseY: 0 });
  const stats = assembly.stats;
  assert(stats.cellCount === 2, `2 格（y0+y2，中间层已删）——实际 ${stats.cellCount}`);
  assert((stats.supportCount ?? 0) >= 1, `悬空块长出支撑支架（实际 ${stats.supportCount ?? 0}）`);
  // 检查支撑柱存在于场景
  let pillars = 0, edges = 0, invalidShape = 0;
  assembly.group.traverse((o) => {
    if (o.name === "town-support-pillar") pillars++;
    if (o.name === "town-support-edge") edges++;
    if (o.name === "town-support-pillar" && o.userData?.supportShape !== "octahedral-four-edge") {
      invalidShape++;
    }
  });
  assert.equal(pillars, 4, `四个八面体环向支柱（实际 ${pillars}）`);
  assert.equal(edges, 8, `四个支柱各含上下两条边（实际 ${edges}）`);
  assert.equal(invalidShape, 0, "支架不退化为棱锥中央柱");
}

// 布局：完整 3 层柱（无悬空）→ 无支架
const SOLID = {
  cellSize: 2.0,
  cellHeight: 2.0,
  gridSize: 25,
  levels: [
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
  ],
};
{
  const assembly = buildCitadelTownAssembly(SOLID, { baseY: 0 });
  const stats = assembly.stats;
  let supports = 0;
  assembly.group.traverse((o) => {
    if (o.name === "town-support-pillar" || o.name === "town-support-strut") supports++;
  });
  assert(supports === 0, `实心柱无支架（实际 ${supports}）`);
  assert((stats.supportCount ?? 0) === 0, "实心柱 supportCount=0");
}

// 布局：y2 完全悬空（y0/y1 都删）→ 悬空 2 层 → 应有斜撑
const FULL_FLOAT = {
  cellSize: 2.0,
  cellHeight: 2.0,
  gridSize: 25,
  levels: [
    Array.from({ length: 25 }, () => ".".repeat(25)),
    Array.from({ length: 25 }, () => ".".repeat(25)),
    Array.from({ length: 25 }, (_, iz) =>
      Array.from({ length: 25 }, (_, ix) => (iz === 12 && ix === 12 ? "0" : ".")).join("")
    ),
  ],
};
{
  const assembly = buildCitadelTownAssembly(FULL_FLOAT, { baseY: 0 });
  let pillars = 0, edges = 0;
  assembly.group.traverse((o) => {
    if (o.name === "town-support-pillar") pillars++;
    if (o.name === "town-support-edge") edges++;
  });
  t(pillars === 4, `完全悬空 2 层仍保持四个八面体支柱（实际 ${pillars}）`);
  t(edges === 8, `完全悬空 2 层八面体边数为 8（实际 ${edges}）`);
}

console.log(`\n结果：${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
