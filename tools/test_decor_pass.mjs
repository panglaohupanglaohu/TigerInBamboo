// =====================================================================
// G-11 · 装饰 pass：skipDecor 体块逐字相等；门 A 不倒退；装饰有主
// 用法：node tools/test_decor_pass.mjs
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

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { isDecorName, DECOR_MESH_NAMES } = await import(new URL("src/world/citadel/decoratePass.js", BASE).href);

const tri = (o) => {
  const p = o.geometry?.attributes?.position;
  return p ? Math.floor((o.geometry.index?.count ?? p.count) / 3) : 0;
};
const ownerOf = (o) => o.userData?.cell ?? o.userData?.townModule ?? o.userData?.cells ?? null;
const inLevelGroup = (o) => {
  for (let n = o, i = 0; n && i < 8; n = n.parent, i++) {
    if (/^town-terrace-\d+-level-\d+$/.test(n.name || "")) return true;
  }
  return false;
};

function allCells(spec) {
  const keys = [];
  for (const terrace of spec.terraces ?? []) {
    (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
      String(row).split("").forEach((ch, ix) => { if (ch !== ".") keys.push(`${ix},${iy},${iz}`); });
    }));
  }
  return keys;
}

function unmerged(castle) {
  const spec = castle.userData.townSpec;
  m.rebuildCitadelTownIncremental(castle, spec, allCells(spec), {
    debounceMs: 400,
    skipDecor: castle.userData.skipDecor === true,
  });
  return castle;
}

function hasDecorAncestor(o) {
  for (let n = o, i = 0; n && i < 10; n = n.parent, i++) {
    if (isDecorName(n.name)) return true;
  }
  return false;
}

function bodySignature(root) {
  const names = [];
  const trisByName = new Map();
  const poses = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
    if (!inLevelGroup(o)) return;
    if (isDecorName(o.name) || hasDecorAncestor(o)) return;
    names.push(o.name || "?");
    trisByName.set(o.name, (trisByName.get(o.name) || 0) + tri(o));
    const p = o.position;
    poses.push(`${o.name}:${Number(p.x).toFixed(4)},${Number(p.y).toFixed(4)},${Number(p.z).toFixed(4)}:${tri(o)}`);
  });
  names.sort();
  poses.sort();
  return { names, tris: [...trisByName.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)), poses };
}

function decorMeshes(root) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (isDecorName(o.name)) out.push(o);
  });
  return out;
}

function censusUnowned(root) {
  const bad = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
    if (!inLevelGroup(o)) return;
    if (!ownerOf(o)) bad.push(o.name);
  });
  return bad;
}

function cellProjectionContains(owner, point, cs, gs) {
  const half = (gs - 1) / 2;
  const cells = owner.cells
    ? owner.cells.map((k) => {
        const [ix, , iz] = String(k).split(",").map(Number);
        return { ix, iz };
      })
    : [{ ix: owner.ix, iz: owner.iz }];
  return cells.some(({ ix, iz }) => {
    const cx = (ix - half) * cs;
    const cz = (iz - half) * cs;
    return Math.abs(point.x - cx) <= cs * 0.75 && Math.abs(point.z - cz) <= cs * 0.75;
  });
}

const withDecor = unmerged(m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808, skipDecor: false }));
const noDecor = unmerged(m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808, skipDecor: true }));

const bodyA = bodySignature(withDecor);
const bodyB = bodySignature(noDecor);
assert.deepEqual(bodyB.names, bodyA.names, "skipDecor 体块名字多重集必须相等");
assert.deepEqual(bodyB.tris, bodyA.tris, "skipDecor 体块各名三角形数必须相等");
assert.deepEqual(bodyB.poses, bodyA.poses, "skipDecor 体块位置签名必须相等");

const unowned = censusUnowned(withDecor);
assert.equal(unowned.length, 0, `装饰开时无主: ${unowned.slice(0, 8)}`);

const decor = decorMeshes(withDecor);
assert.ok(decor.length > 0, "skipDecor=false 应有装饰网格");
const none = decorMeshes(noDecor);
assert.equal(none.length, 0, `skipDecor=true 仍有装饰: ${none.slice(0, 8).map((o) => o.name)}`);

const cs = withDecor.userData.townSpec?.cellSize ?? 2.0;
const gs = withDecor.userData.townSpec?.gridSize ?? 25;
let outside = 0;
for (const o of decor.slice(0, 80)) {
  const owner = ownerOf(o);
  if (!owner || Array.isArray(owner) && !owner.length) { outside++; continue; }
  const cell = Array.isArray(owner) ? { cells: owner } : owner.ix != null ? owner : { cells: owner };
  o.updateWorldMatrix?.(true, false);
  const pos = o.getWorldPosition?.(new (o.position.constructor)()) ?? o.position;
  const box = { x: pos.x, z: pos.z };
  if (!cellProjectionContains(cell.cells ? cell : cell, box, cs, gs)) outside++;
}
assert.ok(outside / Math.min(80, decor.length) < 0.25, `装饰中心落在所属格外 ${outside}`);

console.log(
  `bodyNames=${bodyA.names.length} decor=${decor.length} skipDecorDecor=0 ` +
  `unowned=0 catalog=${DECOR_MESH_NAMES.size}`
);
console.log("✅ test_decor_pass");
