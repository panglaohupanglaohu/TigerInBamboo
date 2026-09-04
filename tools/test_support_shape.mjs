// =====================================================================
// C13-6 · 钢支架双扁方管（PLAN §10.6，证据 docs/z2.png）
//
// z2 的读数：**两根扁方管竖柱**贴着承重侧（不是四根、也不是从格心发散的桁架）、
// 顶部一道**水平横梁**托住体块底面、悬空高时中段一道 **λ 斜撑**。
//
// 本测试断言的是「形变了、构造式没变」：
//   ① 每组支架恰 2 根竖柱 + 1 道横梁；悬空 > 2 层时再加 2 根斜撑
//   ② 截面是扁方管 0.10 × 0.05（长边朝外，即切向宽 > 径向厚）
//   ③ 两柱间距 0.62cs、柱轴离格心 0.30cs，且**两根柱脚都落在 (ix,iz) 的承重投影里**
//      —— 这条就是「必然连通」：支架仍是算出来的，不是搜出来的
//   ④ 柱脚 y = 承重面、梁顶 y = 体块底面（上下端点都咬死，没有悬空杆件）
//   ⑤ λ 斜撑两根交于中轴同一点（z=0），不是各飘各的
//
// 运行：node tools/test_support_shape.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);

const CS = 2;
const CH = 1.6;
const mkCtx = () => ({
  mesh: (geo, mat, name) => { const m = new THREE.Mesh(geo, mat || new THREE.MeshBasicMaterial()); m.name = name; return m; },
  materials: new Proxy({}, { get: (_t, k) => (k === "shade" ? undefined : new THREE.MeshBasicMaterial()) }),
  random: () => 0.5,
  archWindowGeometry: new THREE.BoxGeometry(0.3, 0.5, 0.05),
  buildHalfDome: () => new THREE.Mesh(new THREE.SphereGeometry(0.4)),
  buildShrub: () => new THREE.Group(),
  buildTopiary: () => new THREE.Group(),
  finialHeight: 0.4,
});
const build = (levels) => ct.buildCitadelTown(
  { cellSize: CS, cellHeight: CH, gridSize: levels[0].length, levels },
  mkCtx()
);
const groups = (town) => {
  const out = [];
  town.levels.forEach((g) => g.traverse((o) => { if (o.isGroup && o.name === "town-support-pillar") out.push(o); }));
  return out;
};
const parts = (grp) => {
  const by = { column: [], beam: [], brace: [] };
  grp.traverse((o) => { if (o.isMesh && by[o.userData.supportPart]) by[o.userData.supportPart].push(o); });
  return by;
};
const worldBox = (o) => { const b = new THREE.Box3().setFromObject(o); return b; };

// ------------------------------------------------------------------
// 场景 A：柱高 2（无斜撑）。第 3 层挑出一格，其下第 2 层被挖空。
//   行 = z，列 = x。x=1 有实心柱，x=2 只有顶层 → 悬空
// ------------------------------------------------------------------
const row = (s) => s;
const A = [
  [row("....."), row(".00.."), row(".....")],  // iy=0
  [row("....."), row(".0..."), row(".....")],  // iy=1（x=2 挖空）
  [row("....."), row(".00.."), row(".....")],  // iy=2 → (2,2,1) 悬空
];
const ta = build(A);
const ga = groups(ta);
assert.equal(ga.length, 1, `场景 A 应恰好一组支架，实得 ${ga.length}`);
{
  const g = ga[0];
  assert.equal(g.userData.supportShape, "twin-flat-tube", "支架形状标记应为 twin-flat-tube");
  const p = parts(g);
  // ---- ① 2 柱 + 1 梁，柱高 2 不出斜撑
  assert.equal(p.column.length, 2, `恰 2 根竖柱，实得 ${p.column.length}`);
  assert.equal(p.beam.length, 1, `恰 1 道横梁，实得 ${p.beam.length}`);
  assert.equal(p.brace.length, 0, `悬空 2 层不出斜撑，实得 ${p.brace.length}`);

  // ---- ② 扁方管：切向宽 0.10 > 径向厚 0.05
  for (const c of p.column) {
    c.geometry.computeBoundingBox();
    const bb = c.geometry.boundingBox;
    const t = bb.max.x - bb.min.x;
    const w = bb.max.z - bb.min.z;
    assert.ok(Math.abs(t - 0.05) < 1e-6, `径向厚应 0.05，实得 ${t.toFixed(4)}`);
    assert.ok(Math.abs(w - 0.10) < 1e-6, `切向宽应 0.10，实得 ${w.toFixed(4)}`);
    assert.ok(w > t, "长边必须朝外（切向宽 > 径向厚）");
  }

  // ---- ③ 间距 0.62cs、离格心 0.30cs、柱脚落在承重投影里
  const cxCell = (2 - (5 - 1) / 2) * CS; // ix=2, gridSize=5
  const czCell = (1 - (3 - 1) / 2) * CS; // iz=1, levels[0].length=3
  const cols = p.column.map((c) => { const v = new THREE.Vector3(); c.getWorldPosition(v); return v; });
  const span = cols[0].distanceTo(cols[1]);
  assert.ok(Math.abs(span - CS * 0.62) < 1e-6, `两柱间距应 0.62cs，实得 ${(span / CS).toFixed(4)}cs`);
  for (const v of cols) {
    // 柱脚必须在 (ix,iz) 的格投影内 —— 「构造式、必然连通」的机器化表述
    assert.ok(
      Math.abs(v.x - cxCell) <= CS * 0.5 + 1e-6 && Math.abs(v.z - czCell) <= CS * 0.5 + 1e-6,
      `柱脚必须落在承重格投影里：柱 (${v.x.toFixed(3)}, ${v.z.toFixed(3)}) vs 格心 (${cxCell}, ${czCell})`
    );
  }
  // 两柱中点应沿承重方向偏离格心 0.30cs
  const mid = cols[0].clone().add(cols[1]).multiplyScalar(0.5);
  const off = Math.hypot(mid.x - cxCell, mid.z - czCell);
  assert.ok(Math.abs(off - CS * 0.30) < 1e-6, `柱轴离格心应 0.30cs，实得 ${(off / CS).toFixed(4)}cs`);
  // 偏向承重侧：x=1 有实体，所以应朝 −X
  assert.ok(mid.x < cxCell - 1e-6, `柱应贴在承重侧（−X），实得 mid.x=${mid.x.toFixed(3)} 格心 ${cxCell}`);

  // ---- ④ 上下端点咬死：柱脚 y = 承重面(1*CH)、梁顶 y = 体块底面(2*CH)
  const colBox = worldBox(p.column[0]);
  assert.ok(Math.abs(colBox.min.y - 1 * CH) < 1e-6, `柱脚应落在承重面 y=${1 * CH}，实得 ${colBox.min.y.toFixed(4)}`);
  const beamBox = worldBox(p.beam[0]);
  assert.ok(Math.abs(beamBox.max.y - 2 * CH) < 1e-6, `梁顶应顶住体块底面 y=${2 * CH}，实得 ${beamBox.max.y.toFixed(4)}`);
  assert.ok(Math.abs(beamBox.min.y - colBox.max.y) < 1e-6, "梁底与柱顶必须接上（无缝）");
  // 横梁横跨两柱
  assert.ok(beamBox.getSize(new THREE.Vector3()).length() > 0, "梁应有实体尺寸");
}

// ------------------------------------------------------------------
// 场景 B：悬空 3 层 → λ 斜撑上场
// ------------------------------------------------------------------
// x=1 一根 4 层实心柱；x=2 只有顶层 → (2,3,1) 悬空 3 层，柱脚落在基座顶 y=0
const B = [
  [row("....."), row(".0..."), row(".....")],
  [row("....."), row(".0..."), row(".....")],
  [row("....."), row(".0..."), row(".....")],
  [row("....."), row(".00.."), row(".....")],
];
const tb = build(B);
const gb = groups(tb).filter((g) => parts(g).brace.length > 0);
assert.ok(gb.length >= 1, "悬空 3 层应出斜撑");
{
  const p = parts(gb[0]);
  // ---- ① 高柱：2 柱 + 1 梁 + 2 斜撑
  assert.equal(p.column.length, 2, `高柱仍是 2 根，实得 ${p.column.length}`);
  assert.equal(p.beam.length, 1, `高柱仍是 1 道横梁，实得 ${p.beam.length}`);
  assert.equal(p.brace.length, 2, `λ 斜撑恰 2 根，实得 ${p.brace.length}`);
  // ---- ⑤ 两根斜撑交于中轴同一点：顶端在局部 z=0，且两者顶端 y 相同
  const tops = p.brace.map((b) => {
    // 局部空间里算：杆长轴 +Y，顶端 = position + rot(+Y)*len/2
    b.geometry.computeBoundingBox();
    const len = b.geometry.boundingBox.max.y - b.geometry.boundingBox.min.y;
    const dir = new THREE.Vector3(0, 1, 0).applyEuler(b.rotation);
    return b.position.clone().addScaledVector(dir, len / 2);
  });
  assert.ok(Math.abs(tops[0].z) < 1e-6 && Math.abs(tops[1].z) < 1e-6, `斜撑顶端应交于中轴 z=0，实得 ${tops[0].z.toFixed(4)} / ${tops[1].z.toFixed(4)}`);
  assert.ok(Math.abs(tops[0].y - tops[1].y) < 1e-6, `两斜撑顶端应同高，实得 ${tops[0].y.toFixed(4)} / ${tops[1].y.toFixed(4)}`);
  // 斜撑底端应贴在两柱上（局部 z = ±0.31cs）
  const feet = p.brace.map((b) => {
    b.geometry.computeBoundingBox();
    const len = b.geometry.boundingBox.max.y - b.geometry.boundingBox.min.y;
    const dir = new THREE.Vector3(0, 1, 0).applyEuler(b.rotation);
    return b.position.clone().addScaledVector(dir, -len / 2);
  });
  for (const f of feet) {
    assert.ok(Math.abs(Math.abs(f.z) - CS * 0.31) < 1e-6, `斜撑柱脚应落在柱轴 ±0.31cs，实得 ${(f.z / CS).toFixed(4)}cs`);
  }
  console.log(`  λ 斜撑：顶点 z=0 y=${tops[0].y.toFixed(3)}，柱脚 z=±${Math.abs(feet[0].z).toFixed(3)}`);
}

// ------------------------------------------------------------------
// 场景 C：确定性 —— 同一布局连建两次，支架完全一致（禁止 Math.random）
// ------------------------------------------------------------------
{
  const sig = (t) => groups(t).map((g) => {
    const v = new THREE.Vector3();
    g.getWorldPosition(v);
    return `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)},${g.rotation.y.toFixed(4)},${g.children.length}`;
  }).sort().join("|");
  assert.equal(sig(build(B)), sig(build(B)), "支架必须是构造式确定量：同布局两次构建结果一致");
}

console.log(`✅ test_support_shape（双扁方管 2 柱 + 1 梁 + λ 斜撑；截面 0.05×0.10；间距 0.62cs；离心 0.30cs；柱脚在承重投影内）`);
