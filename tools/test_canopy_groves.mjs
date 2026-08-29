// =====================================================================
// 参考图植被 + 贴崖云验收（2026-08-28 瓦片星球俯瞰参考图）：
//  · 树冠群落：InstancedMesh 单 draw call、确定性、避开城址/水/港台、
//    冠块坐地（y≈terrain）、鼠尾草色调；
//  · 山体配色：暖沙崖壁（mountain 色系替换冷蓝灰）；
//  · 云：山脊链贴地收紧（terrain+2.4）+ 侧坡低雾带（terrain+1.7）。
// 运行：node tools/test_canopy_groves.mjs
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
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "", appendChild() {}, addEventListener() {},
  querySelector: () => stubEl(), querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64; el.height = 64;
  el.getContext = () => ({
    canvas: el, fillRect() {}, clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {}, drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [],
  body: { appendChild() {} }, addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  compileHighlandCanopyGroves, buildHighlandCanopyGroves, mountHighlandCanopyGroves,
  highlandTerrainSurfaceHeight, HIGHLAND_CITADEL_DESIGN_PALETTE, HIGHLAND_HARBOR_COVE,
} = await import(new URL("src/world/highlandCitadelDesign.js", BASE).href);
let pass = 0;
const ok = (message) => { pass += 1; console.log(`  ✓ ${message}`); };

// --- 1. 布局确定性 + 数量 ----------------------------------------------
const a = compileHighlandCanopyGroves();
const b = compileHighlandCanopyGroves();
assert.ok(a.centers.length >= 12, `群落中心 ${a.centers.length}`);
assert.ok(a.canopies.length >= 90, `冠块 ${a.canopies.length}`);
assert.deepEqual(a.centers, b.centers, "群落中心确定性");
assert.equal(a.canopies.length, b.canopies.length, "冠块数量确定性");
ok(`布局：${a.centers.length} 群落 / ${a.canopies.length} 冠块，确定性`);

// --- 2. 排除区：城址/水面/港台 ------------------------------------------
const inTown = (x, z) => Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5) < 1.1;
const inCove = (x, z) => x >= HIGHLAND_HARBOR_COVE.xMin && x <= HIGHLAND_HARBOR_COVE.xMax && z >= HIGHLAND_HARBOR_COVE.zMin && z <= HIGHLAND_HARBOR_COVE.zMax;
for (const c of [...a.centers, ...a.canopies]) {
  assert.ok(!inTown(c.x, c.z), `避开城址 (${c.x.toFixed(1)},${c.z.toFixed(1)})`);
  assert.ok(!inCove(c.x, c.z), `避开港台 (${c.x.toFixed(1)},${c.z.toFixed(1)})`);
}
ok("全部群落/冠块避开城址与港台（水域由 cutout 编译期排除）");

// --- 3. 冠块坐地 + 鼠尾草色调 -------------------------------------------
const sages = [0x7fa89b, 0x94b5a5, 0x86ad9f, 0x6f9c8c];
for (const canopy of a.canopies) {
  const terrain = highlandTerrainSurfaceHeight(canopy.x, canopy.z);
  assert.ok(Math.abs(canopy.y - (terrain + 0.72 * canopy.size)) < 0.01, `冠贴地形 (${canopy.x.toFixed(1)},${canopy.z.toFixed(1)})`);
  assert.ok(sages.includes(canopy.tone.getHex()), "色调在鼠尾草盘内");
}
ok(`冠块全部坐地（terrain + 0.72×size），色调鼠尾草盘`);

// --- 4. InstancedMesh 单 draw call + 实例矩阵 ---------------------------
const parent = new THREE.Group();
const instanced = mountHighlandCanopyGroves(THREE, parent);
assert.equal(instanced.isInstancedMesh, true, "InstancedMesh");
assert.equal(instanced.count, a.canopies.length, "实例数 = 编译数");
assert.ok(instanced.instanceColor, "逐实例着色");
const m4 = new THREE.Matrix4();
instanced.getMatrixAt(0, m4);
assert.ok(Number.isFinite(m4.elements[12]), "实例矩阵有效");
ok(`InstancedMesh 单 draw call：${instanced.count} 冠`);

// --- 5. 山体配色：暖沙崖壁 ---------------------------------------------
assert.equal(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainFace, 0xd3c3a0, "崖面 = 暖沙");
assert.equal(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainDeep, 0xc0ae86, "崖影 = 深沙");
assert.equal(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainSnow, 0xf2efe2, "峰顶 = 米白");
assert.equal(HIGHLAND_CITADEL_DESIGN_PALETTE.foliageMid, 0x84b09e, "植被 = 鼠尾草");
ok("山体配色：暖沙崖壁 + 鼠尾草植被（参考图色）");

// --- 6. 云贴崖：山脊链收紧 + 侧坡低雾带 ---------------------------------
const citadelModule = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = citadelModule.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const blobGroup = castle.getObjectByName("highland-hero-cloud-blobs");
assert.ok(blobGroup, "体积云团层已挂载");
const ridges = blobGroup.children.filter((c) => c.userData.heroRole === "ridge");
for (const ridge of ridges) {
  const terrain = highlandTerrainSurfaceHeight(ridge.position.x, ridge.position.z);
  assert.ok(ridge.position.y - terrain <= 2.4 + 1.35 + 2.5, `山脊云贴脊 (距地 ${(ridge.position.y - terrain).toFixed(1)})`);
}
const mists = blobGroup.children.filter((c) => c.userData.heroRole === "flank-mist");
assert.ok(mists.length >= 6, `侧坡低雾带 ${mists.length} 团`);
for (const mist of mists) {
  const terrain = highlandTerrainSurfaceHeight(mist.position.x, mist.position.z);
  assert.ok(mist.position.y - terrain <= 1.7 + 2.2, `雾贴坡 (距地 ${(mist.position.y - terrain).toFixed(1)})`);
}
ok(`云贴崖：山脊链 ${ridges.length} 团（距地≤~3.7）+ 侧坡雾 ${mists.length} 团（距地≤~2）`);

// --- 7. 圣城集成：植被层挂载 -------------------------------------------
const grovesMounted = castle.getObjectByName("highland-canopy-groves");
assert.ok(grovesMounted?.isInstancedMesh, "圣城已挂树冠群落层");
assert.ok(grovesMounted.count >= 90, `圣城冠块 ${grovesMounted.count}`);
assert.ok(grovesMounted.userData.presentationOnly, "独立视觉层（不进道具统计）");
ok(`圣城集成：树冠群落 ${grovesMounted.count} 冠（${grovesMounted.userData.groveCount} 群落）挂载于山地系统`);

console.log(`\n✅ 参考图植被/地势/云：暖沙崖壁 + ${instanced.count} 冠群落 + 贴崖云全过`);
console.log(`全部通过：${pass} 组验收`);
