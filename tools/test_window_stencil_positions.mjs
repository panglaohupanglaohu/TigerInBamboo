// =====================================================================
// G-19 · 门 L 部分：窗不跨格角；draw call +2/层；共享材质零污染
// 用法：node tools/test_window_stencil_positions.mjs
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

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const sw = await import(new URL("src/render/stencilWindows.js", BASE).href);

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const plan = sw.stencilWindowPlan(castle);
const withWindows = plan.levels.filter((l) => l.windows > 0);
const cs = castle.userData.townSpec?.cellSize ?? 2.0;
const gs = castle.userData.townSpec?.gridSize ?? 25;
assert.ok(plan.totals.windows > 0, "没找到窗");
assert.equal(plan.totals.drawCallPerLevel, 2, "draw call 增量必须是 +2/层");
assert.equal(plan.totals.drawCallDelta, withWindows.length * 2);
assert.equal(plan.sharedMaterialsMutated, 0);

let span = 0;
let worst = Infinity;
for (const w of plan.windows) {
  assert.ok(Number.isInteger(w.cell?.ix) && Number.isInteger(w.cell?.iz), `窗缺 cell: ${JSON.stringify(w.cell)}`);
  const r = sw.windowSpansCellCorner(
    { cell: w.cell, center: [w.position[0], w.position[2]], dir: w.dir, halfWidth: 0.19 },
    { cellSize: cs, gridSize: gs }
  );
  if (!r.ok) span++;
  if (r.overhang > worst || worst === Infinity) worst = r.overhang;
}
console.log(
  `窗=${plan.totals.windows} 跨格角=${span} 最大越界=${Number(worst).toFixed(4)} 格宽=${cs} ` +
  `drawCallΔ=${plan.totals.drawCallDelta}（${plan.totals.drawCallPerLevel}/层）`
);
assert.equal(span, 0, `${span} 扇窗跨格角`);

const before = new Map();
castle.traverse((o) => { if (o.isMesh) before.set(o, o.material); });
const snap = new Map();
for (const [, mat] of before) {
  if (!mat || Array.isArray(mat)) continue;
  if (!snap.has(mat)) {
    snap.set(mat, {
      stencilWrite: mat.stencilWrite, stencilFunc: mat.stencilFunc,
      stencilRef: mat.stencilRef, colorWrite: mat.colorWrite, depthWrite: mat.depthWrite,
    });
  }
}
const report = sw.applyStencilWindows(castle, THREE, { enabled: true });
assert.equal(report.cutters, withWindows.length);
assert.equal(report.reveals, withWindows.length);
let mutated = 0;
for (const [mat, s] of snap) {
  if (mat.stencilWrite !== s.stencilWrite || mat.stencilFunc !== s.stencilFunc
    || mat.stencilRef !== s.stencilRef || mat.colorWrite !== s.colorWrite
    || mat.depthWrite !== s.depthWrite) mutated++;
}
assert.equal(mutated, 0, `${mutated} 个共享材质被改`);
console.log(`✓ 共享材质零污染 ${snap.size} 件 · cutters=${report.cutters} reveals=${report.reveals}`);
console.log("✅ test_window_stencil_positions");


// ---------------------------------------------------------------------
// 门 L 前置：模板缓冲必须真的被申请
//
// 2026-09-05：本脚本与 probe_stencil_windows 都是无头的，拿不到真 GL 上下文，
// 所以「材质状态写对了」和「模板测试真的生效了」被它们混为一谈。实测发现
// 现网四处 `new THREE.WebGLRenderer` 全都没传 stencil，而 vendor 的 three
// （r163+）里这个参数默认 false —— gl.STENCIL_BITS = 0，模板测试恒真，
// P.stencilWindowsV1 打开也不挖洞。脚本判不了 GL，就退一步判源码。
// ---------------------------------------------------------------------
{
  const src = fs.readFileSync(new URL("../TigerMessenger/src/core/stage.js", import.meta.url), "utf8");
  const call = src.slice(src.indexOf("new THREE.WebGLRenderer"));
  const head = call.slice(0, call.indexOf(")") + 1);
  assert.ok(
    /stencil\s*:/.test(head),
    "src/core/stage.js 的 WebGLRenderer 必须显式传 stencil —— 否则模板挖窗全程空转"
  );
  console.log("  ✓ 门 L 前置：stage.js 已申请模板缓冲");
}
