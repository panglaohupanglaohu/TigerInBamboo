// =====================================================================
// 挖格后的内壁（主人 2026-09-05：「删除建筑单元后，留下来的灰色网孔是什么」）
//
// 这块地方有**两条独立的不变量**，缺一条就会看到那片灰色网孔，
// 而它们各自的失效方式完全不同，所以分开测：
//
//   ① 邻格要长出内墙。体块几何只画朝空邻的外露面（makeExposedCellGeometry）：
//      挖掉一格，它周围 6 个邻格朝这个洞的那一面就从「共享面」变成「外露面」。
//      长不出来 → 洞里是空壳。
//      （2026-09-05 实测这条**本来就是好的**：挖掉一个六面全包的内部格，
//        邻域三角 1684 → 1814。真正坏的是第 ② 条。）
//
//   ② 墙体材质必须双面。墙是**零厚度的单面 quad**——只要视线能看到墙的背面
//      （挖掉一片格之后到处都是这种剖面），FrontSide 把墙整片剔掉，
//      剩下 addOutline 那层向外扩的 BackSide 墨壳正对着你：灰蓝色、
//      还带着壳与壳互相穿插漏出的窟窿。那就是「灰色网孔」。
//
// 运行：node tools/test_inner_wall_growth.mjs
// =====================================================================
import assert from "node:assert/strict";
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

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec0 = JSON.parse(JSON.stringify(citadel.userData.townSpec));
const levels0 = spec0.terraces[0].levels;

const charAt = (lv, ix, iy, iz) => {
  const rows = lv[iy];
  if (!rows) return ".";
  const row = rows[iz];
  return typeof row === "string" ? (row[ix] ?? ".") : ".";
};
const solid = (lv, ix, iy, iz) => charAt(lv, ix, iy, iz) !== ".";

// ---------- ① 邻格长出内墙 ----------
{
  const SIX = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let target = null;
  outer:
  for (let iy = 1; iy < 9; iy++) {
    for (let iz = 2; iz < 20; iz++) {
      for (let ix = 2; ix < 20; ix++) {
        if (!solid(levels0, ix, iy, iz)) continue;
        if (SIX.every(([dx, dy, dz]) => solid(levels0, ix + dx, iy + dy, iz + dz))) { target = { ix, iy, iz }; break outer; }
      }
    }
  }
  assert.ok(target, "布局里应存在六面全被实心格包住的内部格（没有的话这条测试就失去意义）");

  const tri = (o) => {
    const p = o.geometry?.attributes?.position;
    return p ? Math.floor((o.geometry.index?.count ?? p.count) / 3) : 0;
  };
  const inRing = (cell, c) => cell &&
    Math.abs(cell.ix - c.ix) <= 1 && Math.abs(cell.iy - c.iy) <= 1 && Math.abs(cell.iz - c.iz) <= 1;
  // 体块基本都在合并块里，逐格信息在 faceToCell 区间表——只数独立网格会读出假数字
  const ringTris = (root, c) => {
    let t = 0;
    root.traverse((o) => {
      if (!o.isMesh || o.userData?.isOutline) return;
      if (o.userData?.mergedGeometry === true) {
        for (const seg of o.userData?.faceToCell ?? []) {
          const cell = typeof seg.cell === "string"
            ? (() => { const [a, b, d] = seg.cell.split(",").map(Number); return { ix: a, iy: b, iz: d }; })()
            : seg.cell;
          if (inRing(cell, c)) t += seg.triCount || 0;
        }
        return;
      }
      if (inRing(o.userData?.cell, c)) t += tri(o);
    });
    return t;
  };

  const before = ringTris(citadel, target);
  const next = JSON.parse(JSON.stringify(spec0));
  const rows = next.terraces[0].levels[target.iy];
  const row = rows[target.iz].split("");
  row[target.ix] = ".";
  rows[target.iz] = row.join("");
  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec0, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  assert.ok(r.ok, `增量失败：${r.error ?? ""}`);
  const after = ringTris(citadel, target);

  // 六个邻格各多一面 = 6 quad = 12 三角，是下限；实际还会带出窗/檐口等附属件
  assert.ok(after - before >= 12,
    `挖掉内部格 (${target.ix},${target.iy},${target.iz}) 后邻域三角 ${before} → ${after}（Δ ${after - before}）。\n` +
    `  邻格朝洞的那一面没长出来——洞里会是空壳。检查 makeExposedCellGeometry 的 expose 判定\n` +
    `  与 computeCitadelDirtyCells 的邻格扩张（挖一格必须把 6 个邻格一起标脏）。`);
  console.log(`  ✓ ① 挖内部格 (${target.ix},${target.iy},${target.iz}) → 邻域体块三角 ${before} → ${after}（+${after - before}），内墙长出来了`);
}

// ---------- ② 墙体材质双面 ----------
{
  const wall = m.makeCanalMat(0xe8cfa0, { pattern: "wall" });
  assert.equal(wall.side, THREE.DoubleSide,
    "墙体材质必须 DoubleSide。墙是零厚度单面 quad——单面时只要看到背面，\n" +
    "  墙整片被剔除，只剩 addOutline 向外扩的 BackSide 墨壳正对镜头，\n" +
    "  渲成一片灰蓝带窟窿的「网孔」（主人 2026-09-05 报的就是这个）。");

  // 屋顶不该跟着双面：它不会被从背面看到，而且本来就被 applyInkOutlines 跳过
  const roof = m.makeCanalMat(0xe8cfa0, { pattern: "roof" });
  assert.equal(roof.side, THREE.FrontSide, "屋顶不必双面，别顺手把 overdraw 摊到整个屋面上");
  console.log("  ✓ ② 墙体材质双面 / 屋顶保持单面");
}

console.log("✅ test_inner_wall_growth（挖格后邻格长内墙 · 墙体双面不露墨壳）");
