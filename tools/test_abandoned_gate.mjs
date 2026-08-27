// 太古双子要塞巨门 验收：三重圆拱形状 / 双子夹道 / 高度 / 草地入谷 / 电车净空
// 运行：node tools/test_abandoned_gate.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify(
      {
        name: "three",
        version: "0.172.0-local-bridge",
        type: "module",
        main: "../../vendor/three.module.js",
      },
      null,
      2
    )
  );
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb) => setTimeout(() => cb(0), 16),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {} },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64;
  el.height = 64;
  el.getContext = () => ({
    canvas: el,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    filter: "",
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    ellipse() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    rect() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    transform() {},
    clip() {},
    drawImage() {},
    putImageData() {},
    fillText() {},
    strokeText() {},
    measureText: (s) => ({ width: String(s).length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    createImageData: (w, h) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) {
    return this._m.has(k) ? this._m.get(k) : null;
  },
  setItem(k, v) {
    this._m.set(k, String(v));
  },
  removeItem(k) {
    this._m.delete(k);
  },
};

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildChristchurchTramSystem } = await import(new URL("src/world/tramSystem.js", BASE).href);
const { canyonOffsetDir } = await import(new URL("src/world/canyon.js", BASE).href);
const { worldToFlatXZ, groundLiftAt } = await import(new URL("src/world/hills.js", BASE).href);
const {
  buildAbandonedGate,
  createGateShape,
  GATE,
  GATE_DEPTH,
} = await import(new URL("src/world/abandonedGate.js", BASE).href);

const R = 40;
const DECK_W = 3.35;
const PLAYER_H = 1.6;
const LANE_SPAN = 1.8;
// 叹息之门晚霞残垣色板（与 src/world/abandonedGate.js 同步锁定）
const RUIN_WALLS = [
  { main: 0x875044, roof: 0xa6664e }, // 风化砖红
  { main: 0x705458, roof: 0x93604e }, // 烟灰砖褐
  { main: 0x795342, roof: 0x9a6248 }, // 暗赭石
  { main: 0x68565a, roof: 0x88605b }, // 灰紫残墙
];
const RUIN_ARCH_HEX = "#746367"; // 拱门/矮墩：烟灰石
const RUBBLE_HEX = "#6F5D59"; // 乱石：暖灰褐
const toHex = (c) => `#${c.toString(16).toUpperCase().padStart(6, "0")}`;

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const scene = new THREE.Scene();
const curve = buildChristchurchTramSystem(scene, R, {}).curve;
const L = curve.getLength();
const gate = buildAbandonedGate({ curve, planetRadius: R, setback: 6 });
const M = gate.userData.metrics;
const seatRoot = gate.userData.seatRoot;

assert(gate.name === "cyber-megalithic-twin-gates", `组名应为 cyber-megalithic-twin-gates，实际 ${gate.name}`);
assert(seatRoot && seatRoot.name === "gate-seat-root", "缺少 gate-seat-root");
assert.equal(gate.userData.kind, "cyber-megalithic-twin-gates");
ok(`要塞 kind=${gate.userData.kind}，seatRoot 就绪`);

// ---------- 1. 三重圆拱形状锁死 ----------
console.log("[1] 三重圆拱形状（createGateShape 不变）");
const shape = createGateShape(GATE.passHalf);
assert(shape instanceof THREE.Shape, "不是 THREE.Shape");
assert.equal(shape.holes.length, 1, `应恰好 1 个券洞，实际 ${shape.holes.length}`);
ok("Shape 含 1 个半圆券洞");

const op = shape.getPoints(40).map((v) => ({ x: v.x, y: v.y }));
const hp = shape.holes[0].getPoints(40).map((v) => ({ x: v.x, y: v.y }));
const archH = Math.max(...op.map((v) => v.y)) - Math.min(...op.map((v) => v.y));
const wallW = Math.max(...op.map((v) => v.x)) - Math.min(...op.map((v) => v.x));
const passW = Math.max(...hp.map((v) => v.x)) - Math.min(...hp.map((v) => v.x));

// 拱墙轮廓顶 = archTop + plinth 埋深范围
assert(
  Math.abs(Math.max(...op.map((v) => v.y)) - GATE.archTop) < 0.01,
  `拱轮廓顶应=${GATE.archTop}，实际 ${Math.max(...op.map((v) => v.y))}`
);
assert(
  Math.abs(Math.min(...op.map((v) => v.y)) + GATE.plinthH) < 0.01,
  `拱轮廓底应=-plinthH，实际 ${Math.min(...op.map((v) => v.y))}`
);
ok(`拱墙轮廓高 ${archH.toFixed(1)}（archTop ${GATE.archTop} + plinth ${GATE.plinthH}）`);

assert(Math.abs(passW - GATE.passHalf * 2) < 0.05, `券洞净宽应≈${GATE.passHalf * 2}，实际 ${passW.toFixed(2)}`);
const wMult = passW / DECK_W;
assert(wMult >= 1.5 && wMult <= 2.5, `净宽应为桥面合理倍数，实际 ${wMult.toFixed(2)}`);
ok(`券洞净宽 ${passW.toFixed(1)} ≈ 桥面 ${wMult.toFixed(2)} 倍`);

assert(
  Math.abs(Math.max(...hp.map((v) => v.x)) + Math.min(...hp.map((v) => v.x))) < 1e-6,
  "券洞非左右对称"
);
ok("券洞左右对称（半圆拱）");

// seatRoot 内三重拱
const arches = seatRoot.children.filter((o) => o.isMesh && o.name.startsWith("gate-arch-"));
assert.equal(arches.length, 3, `应为三重拱，实际 ${arches.length}`);
assert.equal(gate.userData.arches, 3);
ok("恰好三重 gate-arch");
assert(
  arches[0].geometry === arches[1].geometry && arches[1].geometry === arches[2].geometry,
  "三重拱未共享 geometry"
);
ok("三重共享同一份 geometry");

// 沿轨等距
const zs = arches.map((a) => a.position.z).sort((a, b) => a - b);
const g1 = zs[1] - zs[0];
const g2 = zs[2] - zs[1];
assert(Math.abs(g1 - g2) < 0.05, `三重间距不均：${g1.toFixed(2)} vs ${g2.toFixed(2)}`);
assert(Math.abs(g1 - M.archPitch) < 0.05, `间距应≈archPitch ${M.archPitch}`);
ok(`三重沿轨等距（间距 ${g1.toFixed(1)} = archPitch）`);

// ---------- 2. 双子夹道 ----------
console.log("[2] 双子巨塔夹道一线天");
const left = seatRoot.getObjectByName("leftTowerGroup");
const right = seatRoot.getObjectByName("rightTowerGroup");
assert(left && right, "缺少 left/rightTowerGroup");
assert.equal(left.position.x, -GATE.towerOffset);
assert.equal(right.position.x, GATE.towerOffset);
ok(`左右塔偏置 ±${GATE.towerOffset} → 夹道宽 ${GATE.channelWidth}`);

const channel = right.position.x - left.position.x;
assert.equal(channel, GATE.channelWidth);
assert.equal(M.channelWidth, GATE.channelWidth);
ok(`通道宽 ${channel} = metrics.channelWidth`);

// 每塔 4 级阶梯
for (const tw of [left, right]) {
  const tiers = tw.children.filter((c) => c.name?.startsWith("tower-tier-"));
  assert.equal(tiers.length, 4, `${tw.name} 应有 4 级，实际 ${tiers.length}`);
  // 阶梯内缩：底层宽 > 顶层宽
  const w0 = tiers[0].geometry.parameters?.width ?? tiers[0].scale.x;
  // BoxGeometry after facet may lose parameters — use bounding box
  tiers.forEach((t) => t.geometry.computeBoundingBox());
  const widths = tiers.map((t) => t.geometry.boundingBox.max.x - t.geometry.boundingBox.min.x);
  assert(widths[0] > widths[3], `${tw.name} 未阶梯内缩：${widths.map((w) => w.toFixed(1)).join("→")}`);
}
ok("左右塔各 4 级阶梯，下粗上细");

// 科技刻线 + 乱石
const strips = [];
const rubble = [];
seatRoot.traverse((o) => {
  if (o.name === "mech-strip") strips.push(o);
  if (o.name === "rubble") rubble.push(o);
});
assert(strips.length >= 50, `刻线过少：${strips.length}`);
assert(rubble.length >= 16, `乱石过少：${rubble.length}`);
ok(`科技刻线 ${strips.length} 片 · 基座乱石 ${rubble.length} 块`);

// 通道矮墩
assert(seatRoot.getObjectByName("channel-pier-L"), "缺少 channel-pier-L");
assert(seatRoot.getObjectByName("channel-pier-R"), "缺少 channel-pier-R");
ok("通道两侧矮墩强化一线天");

// ---------- 3. 高度规格 ----------
console.log("[3] 高度与玩家倍率");
assert.equal(GATE.wallTop, 44.0);
assert.equal(M.towerHeight, 44.0);
assert(Math.abs(M.totalHeight - (GATE.wallTop + GATE.plinthH)) < 0.05);
const mult = M.towerHeight / PLAYER_H;
assert(mult >= 25 && mult <= 30, `塔高应为玩家 25~30 倍，实际 ${mult.toFixed(1)}`);
ok(`塔高 ${M.towerHeight} ≈ 玩家 ${mult.toFixed(1)} 倍（指标 25–30）`);
assert(M.passageApex > 12, `券顶过低 ${M.passageApex}`);
ok(`券洞拱顶 ${M.passageApex}，电车限高充足`);

// ---------- 4. 定位：草地→峡谷交界 ----------
console.log("[4] 落在草地→峡谷交界点");
const a = gate.userData.anchor;
ok(`入谷点 s=${Number.isFinite(a.entryS) ? a.entryS.toFixed(1) : "n/a"}，城门 s=${a.gateS.toFixed(1)}`);
// 默认用 findGateSeatU 选直段门座（可与首个入谷点不同弧段），只要求门座有效
assert(Number.isFinite(a.gateU) && a.gateU >= 0 && a.gateU < 1, "gateU 无效");
ok(`gateU=${a.gateU.toFixed(4)} 有效（findGateSeatU 直段落座）`);

const groundRadiusAt = (dir) => {
  const flat = worldToFlatXZ(dir, R);
  if (flat) return R + groundLiftAt(flat.x, flat.z);
  return R + canyonOffsetDir(dir);
};

const half = M.gateDepth / 2;
let maxElev = -Infinity;
let worstDrop = 0;
for (let d = -half; d <= half; d += 1) {
  const u = (((a.gateU + d / L) % 1) + 1) % 1;
  const p = curve.getPointAt(u, new THREE.Vector3());
  const dir = p.clone().normalize();
  maxElev = Math.max(maxElev, p.length() - groundRadiusAt(dir));
  worstDrop = Math.min(worstDrop, canyonOffsetDir(dir));
}
assert(worstDrop === 0, `城门跨入峡谷：最深沉降 ${worstDrop.toFixed(1)}`);
ok(`整座门（进深 ${M.gateDepth.toFixed(1)}）全程沉降 0 → 立在草地上`);
assert(maxElev < 1.5, `城门段轨道已抬升 ${maxElev.toFixed(2)}，不是贴地草坡`);
ok(`该段轨道最大离地 ${maxElev.toFixed(2)} < 1.5`);
assert(gate.userData.sink > 0, `应整体下沉埋脚，sink=${gate.userData.sink}`);
ok(`整体下沉 sink=${gate.userData.sink.toFixed(2)}`);

// ---------- 5. 防卡模：直立 + 对准铁轨 + 无碰撞 ----------
console.log("[5] 防卡模与净空");
const fwd = curve.getTangentAt(a.gateU, new THREE.Vector3()).normalize();
const trackPt = curve.getPointAt(a.gateU, new THREE.Vector3());
// seatRoot 局部 +Z = 前进
const seatZ = new THREE.Vector3(0, 0, 1).applyQuaternion(seatRoot.quaternion).normalize();
const seatY = new THREE.Vector3(0, 1, 0).applyQuaternion(seatRoot.quaternion).normalize();
const zDot = Math.abs(seatZ.dot(fwd));
const zErr = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, zDot)));
assert(zErr < 1, `seatRoot 前进轴未对齐切线，偏差 ${zErr.toFixed(3)}°`);
assert(seatY.dot(trackPt.clone().normalize()) > 0.985, "seatRoot 未直立");
ok("seatRoot 前进轴 ⟂ 门面、直立对齐球面法线");

const off = trackPt.clone().sub(seatRoot.position);
const lateral = Math.abs(off.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(seatRoot.quaternion).normalize()));
// 有 sink 后 position 在径向略偏，横向仍应对准
assert(lateral < 0.35, `通道中心未对准铁轨，横向偏移 ${lateral.toFixed(3)}`);
ok(`通道中心对准铁轨（横向 ${lateral.toFixed(3)}）`);

const sideMargin = (M.passageWidth - LANE_SPAN) / 2;
assert(sideMargin > 1.5, `会车余量不足 ${sideMargin.toFixed(2)}`);
ok(`双线跨度 ${LANE_SPAN} 居中，左右各余 ${sideMargin.toFixed(2)}`);

let collideHits = 0;
seatRoot.traverse((o) => {
  if (o.isMesh && o.userData?.collideRadius) collideHits++;
});
assert.equal(collideHits, 0, "存在带碰撞半径的构件，会挡电车");
ok("不参与碰撞（电车可穿三重拱）");

// ---------- 6. 材质：叹息之门晚霞残垣 Toon ----------
console.log("[6] 叹息之门晚霞残垣卡通材质");
const mats = new Set();
seatRoot.traverse((o) => {
  if (o.isMesh && o.material && !o.userData?.isOutline) mats.add(o.material);
});
assert([...mats].every((m) => m.isMeshToonMaterial), "存在非 MeshToonMaterial");
assert([...mats].every((m) => m.flatShading === true), "flatShading 未生效");
ok(`材质全为 MeshToonMaterial + flatShading（${mats.size} 种）`);

const hexes = [...mats].map((m) => `#${m.color.getHexString().toUpperCase()}`);
// 与源码相同的派生规则：deep=main×0.78、strip=main×0.62、阶梯主色→屋顶色 lerp(0.12/0.28)
const allowed = new Set([RUIN_ARCH_HEX, RUBBLE_HEX]);
const ruinMains = new Set();
for (const w of RUIN_WALLS) {
  const main = new THREE.Color(w.main);
  const roof = new THREE.Color(w.roof);
  allowed.add(toHex(w.main));
  allowed.add(toHex(w.roof));
  allowed.add(toHex(main.clone().multiplyScalar(0.78).getHex()));
  allowed.add(toHex(main.clone().multiplyScalar(0.62).getHex()));
  for (const t of [0.12, 0.28]) allowed.add(toHex(main.clone().lerp(roof, t).getHex()));
  ruinMains.add(toHex(w.main));
}
assert(
  hexes.every((h) => allowed.has(h)),
  `配色越界：${[...new Set(hexes)].join(",")}`
);
ok(`晚霞残垣色 + 暖灰乱石：${[...new Set(hexes)].join(" / ")}`);
// 设计意图：拱门烟灰石、双子塔各用一种不同残垣墙色、乱石暖灰褐
assert(hexes.includes(RUIN_ARCH_HEX), `拱门应为烟灰石 ${RUIN_ARCH_HEX}`);
assert(hexes.includes(RUBBLE_HEX), `乱石应为浅暖灰褐 ${RUBBLE_HEX}`);
const usedMains = [...new Set(hexes)].filter((h) => ruinMains.has(h));
assert(usedMains.length === 2, `双子塔应各用一种不同残垣墙色，实际 ${usedMains.join(",")}`);
assert(!hexes.includes("#F5F0E6") && !hexes.includes("#6DD5A0"), "残垣不应回退为奶油白/薄荷绿");
ok(`双子塔双色：${usedMains.join(" / ")}`);
assert([...mats].every((m) => (m.transmission ?? 0) === 0), "含 transmission");
ok("无 transmission（避免 SwiftShader 全场景回读）");

// 描边
let outlined = 0;
let meshCount = 0;
seatRoot.traverse((o) => {
  if (!o.isMesh || o.userData?.isOutline) return;
  meshCount++;
  if (o.children.some((c) => c.userData?.isOutline)) outlined++;
});
assert(outlined >= meshCount * 0.9, `描边覆盖不足：${outlined}/${meshCount}`);
ok(`描边覆盖 ${outlined}/${meshCount}`);

// ---------- 7. GATE_DEPTH 兼容 ----------
console.log("[7] 兼容 API");
assert.equal(M.gateDepth, GATE_DEPTH);
assert(GATE_DEPTH > 20, `GATE_DEPTH 过短 ${GATE_DEPTH}`);
ok(`GATE_DEPTH=${GATE_DEPTH.toFixed(1)} 与 metrics.gateDepth 一致`);
assert(typeof gate.userData.relocate === "function", "缺少 relocate");
const relocated = gate.userData.relocate(a.gateU);
assert(relocated, "relocate 失败");
ok("relocate 接口可用");

console.log(`\n全部通过：${pass} 项断言`);
console.log("几何指标：", JSON.stringify(M, null, 2));
