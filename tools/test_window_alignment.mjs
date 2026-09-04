// =====================================================================
// C13-2 · 窗三件套 + 竖列对齐 + 山墙菱形窗（PLAN §10.2，证据 docs/z1.png）
//
// z1.png 的三条读数：
//   ① 窗是**三件套**：白色厚外框（比洞大 12%、外凸）+ 中蓝玻璃 + 白色十字棂（2×2）
//   ② 同一面墙的窗**上下严格对齐成竖列**，层高恒定——一旦这面开窗，每层都有
//   ③ 山墙上是 **45° 菱形窗**（正方形转 45°，无棂），不是带十字棂的圆窗
//
// 此前 ② 不成立：窗密度里含 `street`（只在最低层为真），于是同一面墙
// 一层有窗二层没窗，立面像被虫蛀过。faceSeed 本来就不含 iy，改的是 faceDensity。
//
// 运行：node tools/test_window_alignment.mjs
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
const build = (levels) => ct.buildCitadelTown({ cellSize: 2, cellHeight: CH, gridSize: levels[0].length, levels }, mkCtx());
const collect = (town, name) => {
  const out = [];
  town.levels.forEach((g, iy) => g.traverse((o) => { if (o.isMesh && o.name === name) out.push({ iy, o }); }));
  return out;
};

// 一根 5 层高的孤立柱：四面全暴露，立面窗必须成规整竖列
const col = (n) => Array.from({ length: n }, () => ["00000", "00000", "00.00".replace(".", "0"), "00000", "00000"]);
const tower = [];
for (let iy = 0; iy < 5; iy++) tower.push(["...", ".0.", "..."]);
const t = build(tower);

// ---- ② 竖列对齐：同一面的窗，世界 X/Z 必须完全相同，Y 间距恒为 ch
{
  const wins = collect(t, "town-window");
  assert.ok(wins.length >= 3, `孤立 5 层柱应当开出多层窗，实得 ${wins.length}`);
  const byFace = new Map();
  for (const { iy, o } of wins) {
    const key = `${o.position.x.toFixed(4)}|${o.position.z.toFixed(4)}`;
    if (!byFace.has(key)) byFace.set(key, []);
    byFace.get(key).push({ iy, y: o.position.y });
  }
  // 至少有一面开了 ≥2 层的窗（这正是原来做不到的：street 让底层多一档密度）
  const stacks = [...byFace.values()].filter((a) => a.length >= 2);
  assert.ok(stacks.length >= 1,
    `没有任何一面开出 ≥2 层的竖列窗：立面还是「一层有一层没有」（faceDensity 仍含层号？）`);
  for (const stack of stacks) {
    stack.sort((a, b) => a.y - b.y);
    for (let i = 1; i < stack.length; i++) {
      const dy = stack[i].y - stack[i - 1].y;
      assert.ok(Math.abs(dy - CH * (stack[i].iy - stack[i - 1].iy)) < 1e-6,
        `同竖列窗的 Y 间距 ${dy.toFixed(4)} 不是层高的整数倍`);
    }
  }
  console.log(`② 竖列对齐：${wins.length} 扇窗 · ${stacks.length} 条竖列（最长 ${Math.max(...stacks.map((a) => a.length))} 层）`);
}

// ---- ① 三件套：每扇窗都要有外框与十字棂各就各位
{
  const glass = collect(t, "town-window");
  const frames = collect(t, "town-window-frame");
  const mullions = collect(t, "town-window-mullion");
  assert.equal(frames.length, glass.length, `外框 ${frames.length} ≠ 玻璃 ${glass.length}`);
  assert.equal(mullions.length, glass.length * 2, `窗棂 ${mullions.length} ≠ 玻璃 ${glass.length}×2（十字 = 竖+横）`);
  // 外框必须比玻璃大（z1：约大 12%）
  const fw = new THREE.Box3().setFromObject(frames[0].o).getSize(new THREE.Vector3());
  const gw = new THREE.Box3().setFromObject(glass[0].o).getSize(new THREE.Vector3());
  const ratio = Math.max(fw.x, fw.z) / Math.max(gw.x, gw.z);
  assert.ok(ratio > 1.05 && ratio < 1.25, `外框/玻璃 尺寸比 ${ratio.toFixed(3)} 不在 1.05–1.25（z1 读数 ≈1.12）`);
  console.log(`① 三件套：玻璃 ${glass.length} · 外框 ${frames.length} · 窗棂 ${mullions.length} · 框/玻比 ${ratio.toFixed(3)}`);
}

// ---- ③ 山墙菱形窗：条带屋顶的山墙端出菱形，且不再有圆窗十字棂
{
  const strip = [["00000", ".....", ".....", ".....", "....."]];
  const s = build(strip);
  const diamonds = collect(s, "town-gable-diamond");
  const oculus = collect(s, "town-gable-oculus");
  assert.equal(oculus.length, 0, "山墙上不该再有圆窗（town-gable-oculus 应已被菱形替换）");
  assert.ok(diamonds.length >= 1, `条带屋顶的山墙端没有菱形窗（实得 ${diamonds.length}）`);
  // 菱形 = 绕面法线转 45°
  for (const { o } of diamonds) {
    assert.ok(Math.abs(Math.abs(o.rotation.z) - Math.PI / 4) < 1e-6,
      `菱形窗没有转 45°（rotation.z=${o.rotation.z}）`);
  }
  console.log(`③ 山墙菱形窗：${diamonds.length} 扇 · 圆窗 ${oculus.length} 扇`);
}

console.log("✅ test_window_alignment");
