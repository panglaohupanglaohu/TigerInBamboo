// =====================================================================
// C13-4 · 屋顶檐口三层色带（PLAN §10.4，证据 docs/z1.png）
//
// z1 的檐口剖面自上而下是 **瓦面橙 → 白色檐板 → 暗红封檐**，出挑约 0.04 格；
// 屋脊是一条暗红压顶。我们原来的 makeGableRoofGeometry 只有两片坡面 + 山墙三角，
// 檐口是一条硬边，所以屋顶看起来像纸片。
//
// 本测试对每一片人字坡顶断言：
//   ① 该格同时存在 town-roof（瓦）/ town-roof-fascia（檐板）/ town-roof-bargeboard（封檐）
//   ② Y 顺序正确：封檐顶面 ≤ 檐板底面，檐板顶面 ≤ 瓦面根部（baseY）
//   ③ 檐板出挑 = 0.04 格（外沿 0.60cs，坡面半宽 0.56cs）
//   ④ 每片坡顶恰好两条檐口（落水侧 ±，山墙侧不出）
//   ⑤ 屋脊压顶与封檐同材质（暗红），不再是木线脚色
//
// 运行：node tools/test_roof_eave_profile.mjs
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
// 材质用具名 stub，才能断言「屋脊 = 封檐色」
const MATS = new Map();
const namedMat = (k) => {
  let m = MATS.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial(); m.name = `mat:${String(k)}`; MATS.set(k, m); }
  return m;
};
const mkCtx = () => ({
  mesh: (geo, mat, name) => { const m = new THREE.Mesh(geo, mat || namedMat("fallback")); m.name = name; return m; },
  materials: new Proxy({}, { get: (_t, k) => (k === "shade" ? undefined : namedMat(k)) }),
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
const collect = (town, name) => {
  const out = [];
  town.levels.forEach((g, iy) => g.traverse((o) => {
    if (o.isMesh && o.name === name) {
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      out.push({ iy, o, p, halfY: (bb.max.y - bb.min.y) / 2, mat: o.material?.name ?? "?" });
    }
  }));
  return out;
};

// 一条 4 格直线条带 → strip 人字坡（屋脊沿 X）
const L = ["......", ".0000.", "......", "......", "......", "......"];
const town = build([L]);

const tiles = collect(town, "town-roof");
const fascias = collect(town, "town-roof-fascia");
const barges = collect(town, "town-roof-bargeboard");
const ridges = collect(town, "town-roof-ridge");

// ---- ① 三个分组都在（檐口按整条屋脊出一根：±Z 各一条，不逐格）
assert.ok(tiles.length >= 4, `条带应出 4 片瓦面，实得 ${tiles.length}`);
assert.equal(fascias.length, 2, `一条屋脊两条檐板（落水侧 ±Z），实得 ${fascias.length}`);
assert.equal(barges.length, 2, `一条屋脊两条封檐，实得 ${barges.length}`);

const baseY = 1 * CH; // iy=0 顶面

// ---- ② Y 顺序：封檐顶 ≤ 檐板底，檐板顶 ≤ 瓦面根部
for (const f of fascias) {
  const top = f.p.y + f.halfY;
  const bot = f.p.y - f.halfY;
  assert.ok(Math.abs(top - baseY) < 1e-6, `檐板顶面应与瓦面根部齐平：${top} vs ${baseY}`);
  assert.ok(Math.abs((top - bot) - CH * 0.03) < 1e-6, `檐板高应为 0.03ch，实得 ${(top - bot).toFixed(4)}`);
}
for (const b of barges) {
  const top = b.p.y + b.halfY;
  const bot = b.p.y - b.halfY;
  assert.ok(Math.abs((top - bot) - CH * 0.02) < 1e-6, `封檐高应为 0.02ch，实得 ${(top - bot).toFixed(4)}`);
  const fasciaBottom = baseY - CH * 0.03;
  assert.ok(top <= fasciaBottom + 1e-6, `封檐必须在檐板之下：${top} > ${fasciaBottom}`);
}
// 三层严格递减（用中心 Y 表述验收口径里的「Y 顺序正确」）
const yTile = baseY; // 瓦面根部
const yFascia = fascias[0].p.y;
const yBarge = barges[0].p.y;
assert.ok(yTile > yFascia && yFascia > yBarge, `Y 顺序应为 瓦 > 檐板 > 封檐，实得 ${yTile} / ${yFascia} / ${yBarge}`);

// ---- ③ 出挑 0.04 格：檐板外沿 = 0.60cs，落水侧朝 ±Z（屋脊沿 X）
const tileZ = tiles[0].p.z;
for (const f of fascias) {
  const dz = Math.abs(f.p.z - tileZ);
  assert.ok(Math.abs(dz - CS * 0.56) < 1e-6, `檐板中心应在坡面半宽处 0.56cs，实得 ${(dz / CS).toFixed(4)}cs`);
  f.o.geometry.computeBoundingBox();
  const bb = f.o.geometry.boundingBox;
  const outer = dz + (bb.max.z - bb.min.z) / 2;
  assert.ok(Math.abs(outer - CS * 0.60) < 1e-6, `檐板外沿应为 0.60cs（出挑 0.04cs），实得 ${(outer / CS).toFixed(4)}cs`);
}

// ---- ④ 两条檐口一正一负，且沿脊向完整盖住每一片瓦面（不留缺口）
{
  const signs = new Set(fascias.map((f) => Math.sign(f.p.z - tileZ)));
  assert.deepEqual([...signs].sort(), [-1, 1], "两条檐口必须一正一负（落水侧）");
  for (const f of fascias) {
    f.o.geometry.computeBoundingBox();
    const bb = f.o.geometry.boundingBox;
    const x0 = f.p.x + bb.min.x;
    const x1 = f.p.x + bb.max.x;
    for (const t of tiles) {
      assert.ok(
        x0 <= t.p.x - CS * 0.54 + 1e-6 && x1 >= t.p.x + CS * 0.54 - 1e-6,
        `檐口应盖住瓦面 x=${t.p.x}，实得区间 [${x0.toFixed(3)}, ${x1.toFixed(3)}]`
      );
    }
  }
}

// ---- ⑤ 屋脊压顶 = 封檐色（暗红），檐板 = fascia 色
assert.ok(ridges.length >= 1, "条带屋顶应有屋脊压顶");
for (const r of ridges) assert.equal(r.mat, "mat:bargeboard", `屋脊应用封檐暗红，实得 ${r.mat}`);
for (const f of fascias) assert.equal(f.mat, "mat:fascia", `檐板应用白檐板材质，实得 ${f.mat}`);
for (const b of barges) assert.equal(b.mat, "mat:bargeboard", `封檐应用暗红材质，实得 ${b.mat}`);

console.log(`C13-4 檐口三层色带 OK：瓦 ${tiles.length} 片 / 檐板 ${fascias.length} / 封檐 ${barges.length} / 屋脊 ${ridges.length}`);
console.log(`  剖面 Y：瓦根 ${yTile.toFixed(4)} > 檐板 ${yFascia.toFixed(4)} > 封檐 ${yBarge.toFixed(4)}`);
console.log(`  出挑：坡面半宽 0.5600cs → 檐板外沿 0.6000cs（+0.0400cs）`);
