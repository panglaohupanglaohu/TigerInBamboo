// 一次性诊断：区分「增量丢几何」还是「全量多几何」
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const shown = (o, root) => {
  let n = o;
  while (n) { if (n.visible === false) return false; if (n === root) break; n = n.parent; }
  return true;
};
const tris = (r) => {
  let n = 0;
  r.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (!shown(o, r)) return;
    const p = o.geometry?.attributes?.position;
    if (!p) return;
    n += Math.floor((o.geometry.index?.count ?? p.count) / 3);
  });
  return n;
};
const meshes = (r) => { let n = 0; r.traverse((o) => { if (o.isMesh && shown(o, r)) n++; }); return n; };

const c = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
console.log("刚构建完        tris", tris(c), " meshes", meshes(c), " cellCount", c.userData.townStats?.cellCount);
const spec = c.userData.townSpec;
m.rebuildCitadelTown(c, spec);
console.log("全量重建同布局  tris", tris(c), " meshes", meshes(c), " cellCount", c.userData.townStats?.cellCount);
m.rebuildCitadelTown(c, spec);
console.log("再全量一次      tris", tris(c), " meshes", meshes(c), " cellCount", c.userData.townStats?.cellCount);

// 增量：分两段量，区分「挂载丢了」还是「合并吃掉了」
const c2 = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec2 = c2.userData.townSpec;
const levels = spec2.terraces[0].levels;
let cell = null;
outer:
for (let iy = 1; iy < levels.length; iy++) {
  for (let iz = 2; iz < 22; iz++) {
    const row = String(levels[iz] ? levels[iy][iz] : "");
    for (let ix = 2; ix < 22; ix++) {
      if ((row[ix] || ".") !== ".") { cell = { ix, iy, iz }; break outer; }
    }
  }
}
const edited = JSON.parse(JSON.stringify(spec2));
{
  const row = String(edited.terraces[0].levels[cell.iy][cell.iz]).split("");
  row[cell.ix] = ".";
  edited.terraces[0].levels[cell.iy][cell.iz] = row.join("");
}
const edits = m.diffCitadelLayouts(spec2, edited);
const dirty = m.computeCitadelDirtyCells(edits);

// A) debounceMs>0：跳过立即合并，只做「摘旧 + 挂新」
const r1 = m.rebuildCitadelTownIncremental(c2, edited, [...dirty], { debounceMs: 400 });
console.log("增量·未合并     tris", tris(c2), " meshes", meshes(c2), " ok", r1.ok);

// B) 再走一次 debounceMs=0：包含合并
const c3 = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const r2 = m.rebuildCitadelTownIncremental(c3, edited, [...dirty], { debounceMs: 0 });
console.log("增量·已合并     tris", tris(c3), " meshes", meshes(c3), " ok", r2.ok);
