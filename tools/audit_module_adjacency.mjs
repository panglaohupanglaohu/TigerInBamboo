// =====================================================================
// 模块邻接密度审计（2026-09-03，C5 前置）
//
// WFC 的价值在「选 A 格会缩小 B 格的可选集」。如果从现有布局反向抽取出来的
// 邻接关系是「任意变体都可与任意变体相邻」（密度 → 100%），那么规则表就是
// 空约束，变体级 WFC 加上去也不会改变任何输出。
//
// 这条审计就是在动手写 2450 条规则之前，先证明规则**存在**。
//
// 用法：node tools/audit_module_adjacency.mjs
// =====================================================================
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

const od = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);

const FAMILIES = ct.TOWNSCAPER_MODULE_FAMILIES;
const DIRS = [
  ["+x", 1, 0, 0], ["-x", -1, 0, 0],
  ["+z", 0, 0, 1], ["-z", 0, 0, -1],
  ["+y", 0, 1, 0],
];

const citadel = od.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });

// 模块标签只活在合并前的独立网格上：构建后已被吸收进合并块。
// 用 debounceMs>0 跳过合并，拿到完整的模块选型总体。
const spec = citadel.userData.townSpec;
const allCells = [];
for (const terrace of spec.terraces ?? []) {
  (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
    String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
  }));
}
od.rebuildCitadelTownIncremental(citadel, spec, allCells, { debounceMs: 400 });

// cell → family → variant（同格同族只会有一个选型，取第一个即可）
const byCell = new Map();
citadel.traverse((o) => {
  const tm = o.userData?.townModule;
  if (!tm?.family || tm.variant == null) return;
  const key = `${tm.ix},${tm.iy},${tm.iz}`;
  let fams = byCell.get(key);
  if (!fams) byCell.set(key, (fams = new Map()));
  if (!fams.has(tm.family)) fams.set(tm.family, tm.variant);
});

console.log(`带模块标签的格：${byCell.size}`);
console.log("\n族            变体  观察到的格  观察对  可能对  密度    随机基线  判断");

let anyConstrained = false;
for (const family of Object.keys(FAMILIES)) {
  const variants = FAMILIES[family];
  const seenVariants = new Set();
  const pairs = new Set();
  let cellsWith = 0;
  let observations = 0;

  for (const [key, fams] of byCell) {
    const a = fams.get(family);
    if (a == null) continue;
    cellsWith++;
    seenVariants.add(a);
    const [ix, iy, iz] = key.split(",").map(Number);
    for (const [name, dx, dy, dz] of DIRS) {
      const b = byCell.get(`${ix + dx},${iy + dy},${iz + dz}`)?.get(family);
      if (b == null) continue;
      observations++;
      pairs.add(`${name}|${a}|${b}`);
    }
  }
  if (!cellsWith) {
    console.log(`${family.padEnd(12)} ${String(variants.length).padStart(4)}  ${"—".padStart(9)}  ${"—".padStart(6)}  ${"—".padStart(6)}  ${"—".padStart(6)}  未出现`);
    continue;
  }
  const n = seenVariants.size;
  const possible = DIRS.length * n * n;
  const density = pairs.size / possible;
  // 采样基线：若变体完全随机，obs 次观察洒进 possible 个桶，
  // 期望填满率 = 1 - e^(-obs/possible)。低于它才是真约束，而不是样本不够。
  const expected = 1 - Math.exp(-observations / possible);
  const constrained = density < expected * 0.75;
  if (constrained) anyConstrained = true;
  console.log(
    `${family.padEnd(12)} ${String(variants.length).padStart(4)}  ${String(cellsWith).padStart(9)}  ` +
    `${String(pairs.size).padStart(6)}  ${String(possible).padStart(6)}  ` +
    `${(density * 100).toFixed(1).padStart(5)}%  ${(expected * 100).toFixed(1).padStart(6)}%  ${constrained ? "有约束" : "≈随机"}`
  );
}

console.log("\n判读：");
console.log("  密度 = 实际出现的 (方向, 变体A, 变体B) 组合 ÷ 全部可能组合。");
console.log("  接近 100% = 任意变体都能与任意变体相邻 → 规则表是空约束，");
console.log("  变体级 WFC 加上去不会改变任何输出。");
console.log(anyConstrained
  ? "\n⇒ 存在有约束的族，变体级规则表值得建。"
  : "\n⇒ 所有族都接近全兼容：变体级 WFC 无意义，真正需要约束求解的是**形状层**\n" +
    "   （屋顶分量分类 / 穹顶 / 塔楼 / 花园成立条件），见 PLAN §5 阶段 2。");
