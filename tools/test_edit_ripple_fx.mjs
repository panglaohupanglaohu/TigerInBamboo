// =====================================================================
// C13-5 · 编辑涟漪（PLAN §10.5，证据 sheetA 2s / sheet_0）
//
// Townscaper 每次加/删格都在落点发一个一次性的扩散环 + 一小撮白水花。
// 它是**纯表现层**，所以本测试考的不是它好不好看，而是它有没有污染管线：
//   ① 一次编辑恰好产生 1 个涟漪对象（`citadel-edit-ripple`）
//   ② 1.2s 后自动回收（对象移除、材质 dispose），生命期内不提前消失
//   ③ **不进合并块**：mergeStaticGroup 必须把整棵 transientFx 子树跳过，
//      合并后涟漪网格仍在原地、且没有被烘进任何 mergedGeometry
//   ④ 共享几何不被 dispose（回收的是材质，不是常量几何）
//   ⑤ 连点有上限：超过 maxLive 时回收最老的，不无限堆
//   ⑥ 确定性：同一次 spawn 两次播放逐帧一致（禁止 Math.random）
//
// 运行：node tools/test_edit_ripple_fx.mjs
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
const { createCitadelEditFx, EDIT_RIPPLE_LIFE, EDIT_SPLASH_COUNT } =
  await import(new URL("src/world/citadelEditFx.js", BASE).href);
const { mergeStaticGroup } = await import(new URL("src/world/geometryMerge.js", BASE).href);

const countByName = (root, name) => { let n = 0; root.traverse((o) => { if (o.name === name) n++; }); return n; };

// ------------------------------------------------------------------
// ① 一次编辑 = 1 个涟漪对象
// ------------------------------------------------------------------
const scene = new THREE.Scene();
const fx = createCitadelEditFx(THREE, scene, { radius: 1 });
assert.equal(fx.liveCount(), 0, "初始应无涟漪");
const ripple = fx.spawn(3, 2, -1);
assert.equal(fx.liveCount(), 1, "一次编辑恰好 1 个涟漪对象");
assert.equal(countByName(scene, "citadel-edit-ripple"), 1, "场景里恰好 1 个 citadel-edit-ripple");
assert.equal(countByName(scene, "citadel-edit-ripple-ring"), 1, "1 个扩散环");
assert.equal(countByName(scene, "citadel-edit-splash"), EDIT_SPLASH_COUNT, `${EDIT_SPLASH_COUNT} 片白水花`);
assert.deepEqual([ripple.position.x, ripple.position.y, ripple.position.z], [3, 2, -1], "涟漪落在编辑格世界坐标");

// ------------------------------------------------------------------
// ② 1.2s 生命期：期内不消失，到点回收
// ------------------------------------------------------------------
const ringMat = ripple.children[0].material;
let disposed = false;
const origDispose = ringMat.dispose.bind(ringMat);
ringMat.dispose = () => { disposed = true; origDispose(); };

let t = 0;
const STEP = 1 / 60;
while (t < EDIT_RIPPLE_LIFE - STEP) {
  fx.update(STEP);
  t += STEP;
  assert.equal(fx.liveCount(), 1, `t=${t.toFixed(3)}s 时涟漪不应提前消失`);
}
// 越过 1.2s
fx.update(STEP * 2);
assert.equal(fx.liveCount(), 0, `${EDIT_RIPPLE_LIFE}s 后必须自动回收`);
assert.equal(countByName(scene, "citadel-edit-ripple"), 0, "回收后场景里不留对象");
assert.ok(disposed, "回收时必须 dispose 材质（每次 spawn 都新建材质，不释放就是泄漏）");

// ------------------------------------------------------------------
// ④ 共享几何不被 dispose
// ------------------------------------------------------------------
{
  const r2 = fx.spawn(0, 0, 0);
  const geo = r2.children[0].geometry;
  let geoDisposed = false;
  geo.addEventListener?.("dispose", () => { geoDisposed = true; });
  fx.update(EDIT_RIPPLE_LIFE + 0.1);
  assert.equal(fx.liveCount(), 0);
  assert.ok(!geoDisposed, "共享几何是常量，回收单个涟漪时不能 dispose");
  // 再 spawn 一次仍能用同一份几何
  const r3 = fx.spawn(1, 1, 1);
  assert.equal(r3.children[0].geometry, geo, "涟漪应复用同一份共享几何");
  fx.update(EDIT_RIPPLE_LIFE + 0.1);
}

// ------------------------------------------------------------------
// ③ 不进合并块 —— 关键项
// ------------------------------------------------------------------
{
  const root = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial();
  // 6 个普通静态网格，本该被合并成 1 个
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    m.position.x = i;
    root.add(m);
  }
  // 涟漪挂在**同一个 root 里**（最坏情况），仍必须整棵被跳过
  const fx2 = createCitadelEditFx(THREE, root, { radius: 1 });
  fx2.spawn(0, 5, 0);
  const rippleMeshesBefore = countByName(root, "citadel-edit-ripple-ring") + countByName(root, "citadel-edit-splash");
  assert.equal(rippleMeshesBefore, 1 + EDIT_SPLASH_COUNT);

  const res = mergeStaticGroup(root, { mergedTag: "ripple-test" });
  assert.equal(res.removedSurfaces, 6, `只该合并 6 个静态网格，实得 ${res.removedSurfaces}`);
  assert.equal(res.surfaces.length, 1, `应合出 1 个合并块，实得 ${res.surfaces.length}`);
  // 涟漪网格一个不少地留在原地
  const rippleMeshesAfter = countByName(root, "citadel-edit-ripple-ring") + countByName(root, "citadel-edit-splash");
  assert.equal(rippleMeshesAfter, rippleMeshesBefore, "涟漪网格必须原样留在场景里，不被摘走");
  // 合并块里没有涟漪的三角形：6 个 Box = 6×12 = 72 三角
  const merged = res.surfaces[0];
  const tri = merged.geometry.getAttribute("position").count / 3;
  assert.equal(tri, 72, `合并块应恰好是 6 个 Box 的 72 个三角，实得 ${tri}（多出来的就是被烘进去的涟漪）`);
  // 涟漪网格自身没有被打上合并标记
  root.traverse((o) => {
    if (o.name === "citadel-edit-ripple-ring" || o.name === "citadel-edit-splash") {
      assert.ok(!o.userData.mergedGeometry, "涟漪网格不得带 mergedGeometry 标记");
    }
  });
  console.log(`  合并：静态 6 → 1 块 / ${tri} 三角；涟漪 ${rippleMeshesAfter} 个网格原地未动`);
}

// ------------------------------------------------------------------
// ⑤ 连点上限：超过 maxLive 回收最老的
// ------------------------------------------------------------------
{
  const s = new THREE.Scene();
  const f = createCitadelEditFx(THREE, s, { radius: 1, maxLive: 3 });
  for (let i = 0; i < 8; i++) f.spawn(i, 0, 0);
  assert.equal(f.liveCount(), 3, `maxLive=3 时最多 3 个在播，实得 ${f.liveCount()}`);
  assert.equal(countByName(s, "citadel-edit-ripple"), 3, "场景里也只剩 3 个");
  // 留下的应是最新的三个（x = 5,6,7）
  const xs = [];
  s.traverse((o) => { if (o.name === "citadel-edit-ripple") xs.push(o.position.x); });
  assert.deepEqual(xs.sort((a, b) => a - b), [5, 6, 7], `应回收最老的，实得 ${xs}`);
}

// ------------------------------------------------------------------
// ⑥ 确定性：同样的 spawn + 同样的时间步，逐帧一致
// ------------------------------------------------------------------
{
  const sig = () => {
    const s = new THREE.Scene();
    const f = createCitadelEditFx(THREE, s, { radius: 1 });
    const g = f.spawn(0, 0, 0);
    const frames = [];
    for (let i = 0; i < 30; i++) {
      f.update(1 / 60);
      frames.push(g.children.map((c) =>
        `${c.position.x.toFixed(5)},${c.position.y.toFixed(5)},${c.position.z.toFixed(5)},${c.scale.x.toFixed(5)},${c.material.opacity.toFixed(5)}`
      ).join(";"));
    }
    return frames.join("|");
  };
  assert.equal(sig(), sig(), "涟漪必须是确定量：同样的 spawn 两次播放逐帧一致");
}

console.log(`✅ test_edit_ripple_fx（1 次编辑 = 1 涟漪 + ${EDIT_SPLASH_COUNT} 水花；${EDIT_RIPPLE_LIFE}s 回收；不进合并块；连点有上限；确定性）`);
