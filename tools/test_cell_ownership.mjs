// =====================================================================
// 层组归属完备性验收（2026-09-03，C3 门 A）
//
// 不变量：town 层组里每个网格都必须能说出自己属于哪一格（或哪几格）。
// 判据与增量重建第 2 步「摘旧网格」逐字一致：
//   o.isMesh && (userData.cell || userData.townModule || userData.cells)
//
// 认领得比摘除得少 → 差集留在合并块里、第 3 步再造一份 → 重影。
// 认领得比摘除得多也不行 → 会连带删掉不相干的几何。
//
// 这条测试守的是「以后新增规则块忘了声明归属」——那种错不会报错，
// 只会在某次编辑时悄悄丢几何或留下悬空构件。
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

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = citadel.userData.townSpec;

// 构件普遍参与合并，构建后已被吸收。debounceMs>0 跳过合并，让网格保持独立——
// 这才是「摘旧网格」实际面对的形态。
const allCells = [];
for (const terrace of spec.terraces ?? []) {
  (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
    String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
  }));
}
m.rebuildCitadelTownIncremental(citadel, spec, allCells, { debounceMs: 400 });

const orphan = new Map();
let ownedTris = 0;
let orphanTris = 0;
citadel.traverse((o) => {
  if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
  if (!inLevelGroup(o)) return;
  if (ownerOf(o)) { ownedTris += tri(o); return; }
  orphanTris += tri(o);
  const name = String(o.name || `(匿名·父=${o.parent?.name || "?"})`).replace(/-\d+(?=-|$)/g, "-N");
  const e = orphan.get(name) ?? { n: 0, t: 0 };
  e.n++; e.t += tri(o);
  orphan.set(name, e);
});

if (orphanTris > 0) {
  console.log("无主几何：");
  for (const [name, e] of [...orphan.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 12)) {
    console.log(`  ${String(e.t).padStart(6)} tris ×${String(e.n).padStart(5)}  ${name}`);
  }
}
assert.equal(orphanTris, 0,
  `层组内仍有 ${orphanTris} tris 无主几何（${orphan.size} 类）。` +
  "新增规则块必须用 ownCell()/ownSpanning() 声明归属；" +
  "跑 `node tools/audit_cell_ownership.mjs` 看完整清单");

// 跨格归属必须是非空字符串数组，否则摘除时无从匹配
let spanning = 0;
citadel.traverse((o) => {
  if (!o.isMesh || !o.userData?.cells) return;
  spanning++;
  assert.ok(Array.isArray(o.userData.cells) && o.userData.cells.length > 0,
    `${o.name} 的 userData.cells 必须是非空数组`);
  for (const k of o.userData.cells) {
    assert.match(String(k), /^-?\d+,-?\d+,-?\d+$/, `${o.name} 的跨格键 "${k}" 格式非法`);
  }
});

console.log(`✅ test_cell_ownership（有主 ${ownedTris} tris · 无主 0 · 跨格构件 ${spanning} 个）`);

{
  const THREE = await import(new URL("vendor/three.module.js", BASE).href);
  let guard = null;
  citadel.traverse((o) => {
    if (!guard && typeof o.userData?.stampOwner === "function") guard = o.userData.stampOwner;
  });
  assert.ok(typeof guard === "function", "层组必须保留 stampOwner 以便守门");
  const geo = new THREE.BoxGeometry(1, 1, 1);

  const bad = new THREE.Group();
  bad.name = "unowned-probe";
  bad.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
  bad.children[0].name = "unowned-probe-mesh";
  assert.throws(
    () => guard(bad),
    (err) => /无主|unowned-probe-mesh/.test(err?.message ?? ""),
    "无主网格必须在构建期抛错"
  );

  const good = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  good.name = "self-owned-probe";
  good.userData.cell = { ix: 0, iy: 0, iz: 0, char: "0" };
  guard(good);

  const empty = new THREE.Group();
  empty.name = "empty-probe";
  guard(empty);

  console.log("✅ test_cell_ownership throw 路径（无主网格抛 / 自声明与空组放行）");
}
