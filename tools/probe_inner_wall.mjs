// =====================================================================
// 删格后邻格会不会长出内墙（主人 2026-09-05）
//
// Townscaper 的做法：格是体素，几何只画**朝空邻的外露面**。挖掉一格，
// 它周围 6 个邻格朝这个洞的那一面就从「共享面」变成「外露面」，必须长出墙。
// 长不出来，看到的就是屋子内壁 / 描边壳——也就是主人截屏里那片灰色网孔。
//
// 本探针不看画面，只数面：挑一个**六面全被实心格包住**的内部格（它自己
// 一个外露面都没有），挖掉它，再数它周围那一圈的三角数。
//   · 长出来了 → 周围三角数增加（每个邻格 +1 面 = +2 三角）
//   · 没长出来 → 周围三角数不变甚至减少 → 那个洞是空壳
//
// 运行：node tools/probe_inner_wall.mjs
// =====================================================================
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec0 = JSON.parse(JSON.stringify(citadel.userData.townSpec));
const levels0 = spec0.terraces[0].levels;

const charAt = (levels, ix, iy, iz) => {
  const rows = levels[iy];
  if (!rows) return ".";
  const row = rows[iz];
  if (typeof row !== "string") return ".";
  return row[ix] ?? ".";
};
const solid = (levels, ix, iy, iz) => charAt(levels, ix, iy, iz) !== ".";

// ---- 找一个六面全实心的内部格 ----
let target = null;
outer:
for (let iy = 1; iy < 9; iy++) {
  for (let iz = 2; iz < 20; iz++) {
    for (let ix = 2; ix < 20; ix++) {
      if (!solid(levels0, ix, iy, iz)) continue;
      const six = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      if (six.every(([dx,dy,dz]) => solid(levels0, ix+dx, iy+dy, iz+dz))) {
        target = { ix, iy, iz };
        break outer;
      }
    }
  }
}
if (!target) { console.log("找不到六面全包的内部格（城本身就没那么厚）"); process.exit(0); }
console.log(`目标内部格 (${target.ix},${target.iy},${target.iz})：六面全被实心格包住`);

const tri = (o) => {
  const p = o.geometry?.attributes?.position;
  if (!p) return 0;
  return Math.floor((o.geometry.index?.count ?? p.count) / 3);
};

/**
 * 数「这一圈」的体块三角。两条来源都要算，少一条就会读出假数字：
 *   ① 独立网格：`userData.cell`
 *   ② 合并块：几何已经烘进整层大网格，逐格信息在 `userData.faceToCell`
 *      的区间表里（{ triStart, triCount, cell }）——体块基本都在这一路。
 */
const inRing = (cell, c) => cell &&
  Math.abs(cell.ix - c.ix) <= 1 && Math.abs(cell.iy - c.iy) <= 1 && Math.abs(cell.iz - c.iz) <= 1;

const ringTris = (root, c) => {
  let t = 0;
  const names = new Map();
  const bump = (k, n) => { t += n; names.set(k, (names.get(k) || 0) + n); };
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (o.userData?.mergedGeometry === true) {
      const map = o.userData?.faceToCell;
      if (!Array.isArray(map)) return;
      for (const seg of map) {
        const cell = typeof seg.cell === "string"
          ? (() => { const [a, b, d] = seg.cell.split(",").map(Number); return { ix: a, iy: b, iz: d }; })()
          : seg.cell;
        if (!inRing(cell, c)) continue;
        bump("〔合并块〕", seg.triCount || 0);
      }
      return;
    }
    if (!inRing(o.userData?.cell, c)) return;
    bump(o.name || "(无名)", tri(o));
  });
  return { t, names };
};

const before = ringTris(citadel, target);
console.log(`挖之前：邻域体块三角 ${before.t}`);

// ---- 挖掉它 ----
const next = JSON.parse(JSON.stringify(spec0));
{
  const rows = next.terraces[0].levels[target.iy];
  const row = rows[target.iz].split("");
  row[target.ix] = ".";
  rows[target.iz] = row.join("");
}
const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec0, next))].map(String);
const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
console.log("增量：", r.ok ? "ok" : r.error, "· dirty", dirty.length);

const after = ringTris(citadel, target);
console.log(`挖之后：邻域体块三角 ${after.t}   （Δ ${after.t - before.t >= 0 ? "+" : ""}${after.t - before.t}）`);

console.log("\n邻域按网格名（挖后 / 挖前）：");
const keys = new Set([...before.names.keys(), ...after.names.keys()]);
for (const k of [...keys].sort()) {
  const b = before.names.get(k) || 0;
  const a = after.names.get(k) || 0;
  if (a === b) continue;
  console.log(`  ${k.padEnd(28)} ${String(b).padStart(6)} → ${String(a).padStart(6)}  (${a - b >= 0 ? "+" : ""}${a - b})`);
}

// ---- 结论 ----
// 六个邻格各多一面 = 6 quad = 12 三角（合并/去重后可能略少），
// 同时被挖那格自己的几何消失。只要邻域净变化明显 > 「被挖格原有三角」的负值，
// 就说明内墙确实长出来了。
console.log(`\n判读：邻格朝洞的那一面若长出来了，邻域三角应**增加**约 12（6 面 × 2 三角）。`);
