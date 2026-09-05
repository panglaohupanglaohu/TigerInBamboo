// =====================================================================
// C9 角柱进生产：`?cornerModules=1` 的生产路径验收（2026-09-05）
//
// 测的是**行为**不是函数签名——`cornerAssembly.js` 的内部 API 还在动
// （本会话就被同机另一个会话重写过一次），所以断言全部走
// `buildOdysseyCitadel` + `P.cornerModulesV1` 的 A/B，内部怎么实现都不管。
//
// 每条断言都对应一个**实测过的**失效模式，见 TODOS C9 那一节：
//   ① 归属：角柱跨格必须 ownSpanning，门 A 不得倒退
//   ② 替换而非叠加：flag 开则 town-cell 必须消失
//   ③ 基座只在地面层：mask 不含层号，选件层不加约束就会撒到楼上
//   ④ 竖向覆盖：角柱节点从 iy=0 起会在地面留半层洞
//   ⑤ 基座不与规则 3.6 的墙裙重影
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
const { P } = await import(new URL("src/core/params.js", BASE).href);

let pass = 0;
const ok = (msg) => { console.log(`  ✓ ${msg}`); pass++; };

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

/** 建一座城并把层组网格摊开（debounceMs>0 跳过合并，否则构件已被吸收） */
function survey(cornerOn) {
  P.cornerModulesV1 = cornerOn;
  const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const spec = citadel.userData.townSpec;
  const allCells = [];
  for (const terrace of spec.terraces ?? []) {
    (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
      String(row).split("").forEach((ch, ix) => { if (ch !== ".") allCells.push(`${ix},${iy},${iz}`); });
    }));
  }
  m.rebuildCitadelTownIncremental(citadel, spec, allCells, { debounceMs: 400 });
  citadel.updateMatrixWorld(true);

  const out = {
    citadel,
    byName: new Map(),
    corner: [],
    cornerPlinth: [],
    townCell: [],
    townPlinth: [],
    ownedTris: 0,
    orphanTris: 0,
    orphanNames: new Map(),
    shellMinY: Infinity,
    shellMaxY: -Infinity,
  };
  const box = new THREE.Box3();
  citadel.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline || o.userData?.mergedGeometry) return;
    if (!inLevelGroup(o)) return;
    const name = String(o.name || "");
    out.byName.set(name, (out.byName.get(name) ?? 0) + 1);
    if (ownerOf(o)) out.ownedTris += tri(o);
    else {
      out.orphanTris += tri(o);
      const k = name.replace(/-\d+(?=-|$)/g, "-N") || "(匿名)";
      out.orphanNames.set(k, (out.orphanNames.get(k) ?? 0) + 1);
    }
    if (name.startsWith("town-corner-")) {
      out.corner.push(o);
      if (name.startsWith("town-corner-plinth")) out.cornerPlinth.push(o);
    }
    if (name === "town-cell") out.townCell.push(o);
    if (name === "town-plinth") out.townPlinth.push(o);
    // 竖向外壳范围：墙/格体这类承重面，不含屋顶装饰
    if (name === "town-cell" || /^town-corner-(wall|body|plinth|soffit|setback|floor-slab)/.test(name)) {
      box.setFromObject(o);
      if (box.min.y < out.shellMinY) out.shellMinY = box.min.y;
      if (box.max.y > out.shellMaxY) out.shellMaxY = box.max.y;
    }
  });
  return out;
}

console.log("[A] 基线：flag 关（生产默认）");
const off = survey(false);
assert.equal(off.corner.length, 0, `flag 关时不得出现角柱网格，实际 ${off.corner.length}`);
assert.ok(off.townCell.length > 0, "flag 关时应有 town-cell 格体");
assert.equal(off.orphanTris, 0, `基线就有 ${off.orphanTris} tris 无主几何——不是本刀的问题，先查门 A`);
ok(`town-cell ${off.townCell.length} 个 · 角柱 0 · 无主 0 · 外壳 y ∈ [${off.shellMinY.toFixed(2)}, ${off.shellMaxY.toFixed(2)}]`);

console.log("[B] flag 开：?cornerModules=1");
const on = survey(true);
assert.ok(on.corner.length > 0, "flag 开时必须出现 town-corner-* 网格，否则开关没接上");
ok(`角柱网格 ${on.corner.length} 个（零件名 ${[...new Set(on.corner.map((o) => o.name))].length} 种）`);

console.log("[1] 门 A 不倒退：角柱全部有主");
if (on.orphanTris > 0) {
  for (const [k, n] of [...on.orphanNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    无主 ×${n}  ${k}`);
  }
}
assert.equal(on.orphanTris, 0, `flag 开后 ${on.orphanTris} tris 无主几何（门 A 倒退）`);
// 角柱跨四格 → 必须是 cells 数组归属，不能是单格
const singleOwned = on.corner.filter((o) => o.userData?.cell && !o.userData?.cells);
assert.equal(singleOwned.length, 0, `${singleOwned.length} 个角柱用了单格归属，跨格构件必须 ownSpanning`);
const spanning = on.corner.filter((o) => Array.isArray(o.userData?.cells) && o.userData.cells.length > 0);
assert.equal(spanning.length, on.corner.length, "每个角柱都应带非空 userData.cells");
ok(`无主 0；${spanning.length} 个角柱全部走 ownSpanning`);

console.log("[2] 替换而非叠加：town-cell 必须让位");
assert.equal(on.townCell.length, 0, `flag 开后仍有 ${on.townCell.length} 个 town-cell，会与角柱重影`);
ok("town-cell 归零，角柱是替换不是叠加");

console.log("[3] 基座只在地面层");
// mask 只编码周围 8 个格心实不实，**不含层号**。选件层不加高度约束时，
// plinth.* 与 wall.* 被同一批 mask class 允许 → 实测基座裙撒到 iy=9。
const plinthOffGround = on.cornerPlinth.filter((o) => {
  const cells = o.userData?.cells ?? [];
  return !cells.some((k) => Number(k.split(",")[1]) === 0);
});
if (plinthOffGround.length) {
  const sample = plinthOffGround.slice(0, 5).map((o) => `${o.name}@${(o.userData.cells ?? []).join("|")}`);
  console.log(`    样例：${sample.join("  ")}`);
}
assert.equal(
  plinthOffGround.length,
  0,
  `${plinthOffGround.length}/${on.cornerPlinth.length} 个基座件不挨着地面层——` +
    "选件必须按 iy 约束（地面才用 plinth.*，楼上剔掉），否则楼层长出基座裙"
);
ok(`基座件 ${on.cornerPlinth.length} 个，全部挨着 iy=0`);

console.log("[4] 竖向覆盖：地面不留半层洞");
// 角柱节点 iy 覆盖「层 iy 心 → 层 iy+1 心」。图从 iy=0 起 → 地板面到层 0 心
// 那半层没有柱子。判据用 A/B：角柱外壳的底面不得高于格体外壳的底面。
const sink = on.shellMinY - off.shellMinY;
assert.ok(
  sink <= 1e-6,
  `角柱外壳底面比格体高 ${sink.toFixed(3)}（基线 ${off.shellMinY.toFixed(3)} → 现 ${on.shellMinY.toFixed(3)}）：` +
    "地面层下半留洞。角柱节点范围要下扩一层（iy=-1，形态 soffit），目录不用改"
);
ok(`外壳底面 ${on.shellMinY.toFixed(3)} ≤ 基线 ${off.shellMinY.toFixed(3)}，地面无洞`);

console.log("[5] 基座不与规则 3.6 的墙裙重影");
// 规则 3.6 已经在 iy=0 外露面出 `town-plinth` 墙裙。角柱若也出基座零件，
// 同一圈就有两层几何。二者必须只留一份。
if (on.cornerPlinth.length > 0 && on.townPlinth.length > 0) {
  assert.fail(
    `角柱基座 ${on.cornerPlinth.length} 个与规则 3.6 的 town-plinth ${on.townPlinth.length} 个同时存在：` +
      "同一圈两层几何。要么把 plinth 从角柱零件白名单里去掉，要么 flag 开时关掉规则 3.6 的墙裙"
  );
}
ok(`角柱基座 ${on.cornerPlinth.length} · 规则 3.6 墙裙 ${on.townPlinth.length}，无重影`);

console.log("[6] 几何账目（合并前，供 draw call 预算参考）");
console.log(`    flag 关：有主 ${off.ownedTris} tris`);
console.log(`    flag 开：有主 ${on.ownedTris} tris  Δ=${on.ownedTris - off.ownedTris}`);
assert.ok(on.ownedTris > 0, "flag 开后不应为空城");
ok("三角面账目已记录（fps 在自动化里测不出，只用 tris/calls 判）");

console.log(`\n全部通过：${pass} 项`);
P.cornerModulesV1 = false;
