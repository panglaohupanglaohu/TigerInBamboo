// =====================================================================
// 编辑器几何泄漏天花板（主人 2026-09-05：搭建面板用着用着就卡死，
// 声音还在放但画面几乎不动。HUD：fps 11.9 / geoms 12922 / calls 3686 /
// hitch 844 worst 1582.6ms，对照 test_perf_budget 的预算三项全部大幅超标）
//
// 实测根因（tools/probe_geom_leak.mjs 定位，三处，全部是「造了不放」）：
//   ① geometryMerge.bake()：clone → applyMatrix4 → toNonIndexed，中间那个
//      clone 当场没人要；烘焙结果被 mergeGroup 整块拷进合并几何后也没人要。
//      这两批都没 dispose，占泄漏总量 90%。
//   ② buildCitadelTown 开头急切造 ~40 个共享原型几何；增量 dirty build 里
//      绝大多数一个网格都用不上，既不在场景里也进不了合并回收清单。
//   ③ 增量重建丢弃的那份装配（本测试之外，见 odysseyCitadel 的清扫段）。
//
// 这条测试**不测帧率**（机器相关），只钉「每次编辑净增多少个活着的几何」——
// 泄漏是线性累积的，帧率只是它的后果。数字是 2026-09-05 修完之后的实测值，
// 留了余量；要放宽必须先解释为什么。
//
// 运行：node tools/test_geom_leak_budget.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);

// 记账：所有 BufferGeometry 的生死
const live = new Set();
{
  const proto = THREE.BufferGeometry.prototype;
  const origDispose = proto.dispose;
  proto.dispose = function patched(...a) { live.delete(this); return origDispose.apply(this, a); };
  const origSet = proto.setAttribute;
  proto.setAttribute = function patched(n, at) { live.add(this); return origSet.call(this, n, at); };
}

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const EDITS = 12;
const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));
const afterBuild = live.size;

const levels = spec.terraces[0].levels;
const targets = [];
for (let iy = 1; iy < 6; iy++) {
  for (let iz = 3; iz < 9; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 3; ix < 9; ix++) if ((row[ix] ?? ".") !== ".") targets.push({ ix, iy, iz });
  }
}
assert.ok(targets.length >= EDITS, `需要至少 ${EDITS} 个可编辑格，实际 ${targets.length}`);

for (let n = 0; n < EDITS; n++) {
  const t = targets[n];
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[t.iy];
  const row = String(rows[t.iz]).split("");
  row[t.ix] = ".";
  rows[t.iz] = row.join("");
  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  assert.ok(r.ok, `第 ${n + 1} 次增量失败：${r.error ?? ""}`);
  spec = next;
}

const afterEdits = live.size;
const perEdit = (afterEdits - afterBuild) / EDITS;

// 游离几何 = 没挂在场景里、也没 dispose，纯泄漏
const inScene = new Set();
citadel.traverse((o) => { if (o.geometry) inScene.add(o.geometry); });
let orphan = 0;
for (const g of live) if (!inScene.has(g)) orphan++;

console.log(`建城后存活几何 ${afterBuild}`);
console.log(`${EDITS} 次编辑后 ${afterEdits}（每次 +${perEdit.toFixed(1)}）`);
console.log(`游离几何 ${orphan}`);

// ---- 天花板（2026-09-05 实测：建城 1215 · 每次 +90.9 · 游离 1098）----
// 天花板按 2026-09-05 实测值 + 约 20% 余量定死。当天的三步：
//   ① geometryMerge.bake 里 toNonIndexed 的中间几何没 dispose（漏最多的一处）
//   ② buildCitadelTown 的 ~40 个共享原型，dirty 增量时绝大多数没网格用
//   ③ 屋顶/拱廊/水道/广场/小船/水门拱窗这几条规则的原型压根没登记进清扫表
// 建城 13334 → 1153，每次编辑 +918 → +27，游离 → 272。
// 数字掉这么多不是玄学，是三处具体的「造了没人用也没释放」。
// 谁把它顶回去，先用 `TRACE=1 node tools/probe_geom_leak.mjs` 看出生地排行榜。
assert.ok(afterBuild <= 1400,
  `建城后存活几何 ${afterBuild} > 1400——建城阶段又开始漏了`);
assert.ok(perEdit <= 60,
  `每次编辑净增 ${perEdit.toFixed(1)} 个几何 > 60。\n` +
  `  编辑器卡死的根子就是这个：几何越攒越多，帧时间跟着涨到 1.5s。\n` +
  `  用 TRACE=1 node tools/probe_geom_leak.mjs 看是谁又开始漏。`);
assert.ok(orphan <= 600,
  `游离几何 ${orphan} > 600——有一批几何既不在场景里也没释放`);

console.log(`✅ test_geom_leak_budget（建城 ${afterBuild} · 每次编辑 +${perEdit.toFixed(1)} · 游离 ${orphan}）`);
