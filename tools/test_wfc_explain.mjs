// =====================================================================
// 门 G：WFC 失败接到只读面板（G-08）
// 用法：node tools/test_wfc_explain.mjs
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
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  children: [],
  appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...nodes) { this.children = nodes; this.textContent = nodes.map((n) => n.textContent).join("\n"); },
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = {
  createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(),
  createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const { solveTownSelection } = await import(new URL("src/world/citadel/wfcTownSelection.js", BASE).href);
const { renderWfcFailure } = await import(new URL("src/ui/wfcFailurePanel.js", BASE).href);

const facesOf = (connector) => {
  const faces = {};
  for (const dir of ["N", "E", "S", "W", "U", "D"]) {
    faces[dir] = { connector, parity: "symmetric" };
  }
  return faces;
};

const protos = [
  { id: "block.alpha", family: "floor", weight: 1, orientationGroup: "NONE", builderKey: "alpha", faces: facesOf("alpha") },
  { id: "block.beta", family: "floor", weight: 1, orientationGroup: "NONE", builderKey: "beta", faces: facesOf("beta") },
];

const grid = new Map([
  ["0,0,0", "0"],
  ["1,0,0", "0"],
]);
const pins = [
  { cell: "0,0,0", variant: "block.alpha@r0" },
  { cell: "1,0,0", variant: "block.beta@r0" },
];

const r = solveTownSelection({ grid, prototypes: protos, seed: 1, pins });
assert.equal(r.ok, false, "不相容 pins 必须失败");
assert.ok(r.failure, "failure 非空");

const container = stubEl();
renderWfcFailure(container, r.failure);
const text = container.textContent || "";
const lines = (container.children?.length ? container.children.map((c) => c.textContent) : text.split("\n")).filter(Boolean);
assert.ok(lines.length >= 3, `至少 3 行，实际 ${lines.length}: ${text}`);
assert.ok(lines.some((t) => String(t).includes("empty cell")), `必须包含 empty cell: ${text}`);
assert.ok(!/重试|重启/.test(text), "禁止重试/重启按钮");
console.log(lines.join("\n"));
console.log("✅ test_wfc_explain");
