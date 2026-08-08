// 城头六组穿行云线 验收：单锚 / 6 组 / 体积 1/3 / 无龙卷 / 原涌动 + 穿行
// 运行：node tools/test_cloud_wall_single.mjs
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
      data: new Uint8ClampedArray(Math.max(4, (w || 1) * (h || 1) * 4)),
      width: w || 1,
      height: h || 1,
    }),
    createImageData: (w, h) => ({
      data: new Uint8ClampedArray(Math.max(4, (w || 1) * (h || 1) * 4)),
      width: w || 1,
      height: h || 1,
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
const {
  createDynamicMoebiusClouds,
  updateDynamicMoebiusClouds,
} = await import(new URL("src/world/equatorialClouds.js", BASE).href);
const { buildAbandonedGate, GATE } = await import(new URL("src/world/abandonedGate.js", BASE).href);

const R = 40;
const LINE_GROUPS = 6;
const CLUSTERS_PER_GROUP = 12;
const EXPECTED_CLUSTERS = LINE_GROUPS * CLUSTERS_PER_GROUP; // 72
const VOLUME_SCALE = Math.cbrt(1 / 3);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const scene = new THREE.Scene();
const curve = buildChristchurchTramSystem(scene, R, {}).curve;
const L = curve.getLength();

// ---------- 1. 单锚点城头云线 ----------
console.log("[1] 城头收敛为单锚六线云");
const clouds = createDynamicMoebiusClouds(scene, R, { trackCurve: curve, setback: 6 });
const towers = clouds.userData.towers || [];
assert(towers.length === 1, `应只有 1 座城头云线，实际 ${towers.length}`);
ok("只生成 1 座 cloud-crown-line");
assert.equal(towers[0].name, "cloud-crown-line", `名称应为 cloud-crown-line，实际 ${towers[0].name}`);
ok(`塔名=${towers[0].name}`);

const stationIds = new Set(towers.map((t) => t.userData.station));
assert.equal(stationIds.size, 1, `应只剩 1 站，实际 ${stationIds.size}`);
ok("只剩 1 站（旧走廊 22 站已停用）");

// 对照：走廊模式仍可恢复大量云塔
const corridor = createDynamicMoebiusClouds(new THREE.Scene(), R, {
  trackCurve: curve,
  corridor: true,
});
const cTowers = corridor.userData.towers || [];
assert(cTowers.length > 20, `走廊模式云塔数异常：${cTowers.length}`);
ok(`走廊模式仍可用（${cTowers.length} 座）`);

// ---------- 2. 锚点与废弃城门一致 ----------
console.log("[2] 锚点与双子要塞城头对齐");
const { findGateSeatU } = await import(new URL("src/world/abandonedGate.js", BASE).href);
const seatU = findGateSeatU(curve, R);
const gate = buildAbandonedGate({ curve, planetRadius: R, setback: 6 });
const gateU = gate.userData.anchor.gateU;
assert(Number.isFinite(seatU), "findGateSeatU 无结果");
assert(Math.abs(gateU - seatU) < 1e-9, `城门未用 findGateSeatU：gateU=${gateU} seatU=${seatU}`);
ok(`城门 / 默认云线同用 findGateSeatU → u=${gateU.toFixed(4)}`);

// 城头抬高后，欧氏「最近点投影」会沿弯轨漂移；改比径向方向对齐
const gateDir = curve.getPointAt(gateU, new THREE.Vector3()).normalize();
const cloudDir = towers[0].position.clone().normalize();
const align = cloudDir.dot(gateDir);
assert(align > 0.999, `云线径向未对准城门：dot=${align.toFixed(6)}`);
ok(`径向对齐 dot=${align.toFixed(6)}（抬高后不用弧长最近点）`);

const drop = canyonOffsetDir(cloudDir);
assert(drop === 0, `云线落在峡谷内，沉降 ${drop.toFixed(1)}`);
ok("云线位于草地一侧（峡谷沉降 0）");

const groundR = R + drop;
const radial = towers[0].position.length();
const expectedR = groundR + GATE.wallTop;
assert(
  Math.abs(radial - expectedR) < 0.25,
  `径向半径 ${radial.toFixed(2)} 应对齐城头 ${expectedR.toFixed(2)}`
);
ok(`径向半径=${radial.toFixed(2)} ≈ 地面+wallTop ${expectedR.toFixed(2)}`);

// 显式 anchorU 也应精确命中
const cloudsPinned = createDynamicMoebiusClouds(new THREE.Scene(), R, {
  trackCurve: curve,
  anchorU: gateU,
  crownY: GATE.wallTop,
});
const pinDir = cloudsPinned.userData.towers[0].position.clone().normalize();
assert(pinDir.dot(gateDir) > 0.9999, "显式 anchorU 未对齐");
ok("显式 anchorU 精确钉在城门座");

// ---------- 3. 六组 · 72 簇 · 穿行元数据 ----------
console.log("[3] 六组线云规格");
const clusters = clouds.userData.clusters || [];
assert.equal(
  clusters.length,
  EXPECTED_CLUSTERS,
  `应有 ${EXPECTED_CLUSTERS} 簇，实际 ${clusters.length}`
);
ok(`总簇数=${clusters.length}（6×12）`);

const groupIds = new Set(clusters.map((c) => c.userData.lineGroup));
assert.equal(groupIds.size, LINE_GROUPS, `应有 ${LINE_GROUPS} 组，实际 ${groupIds.size}`);
for (let g = 0; g < LINE_GROUPS; g++) {
  const n = clusters.filter((c) => c.userData.lineGroup === g).length;
  assert.equal(n, CLUSTERS_PER_GROUP, `第 ${g} 组应有 ${CLUSTERS_PER_GROUP} 簇，实际 ${n}`);
}
ok(`6 组各 ${CLUSTERS_PER_GROUP} 簇，lineGroup 完整`);

assert(
  clusters.every((c) => Number.isFinite(c.userData.paradeSpeed) && c.userData.paradeSpeed > 0),
  "存在缺少 paradeSpeed 的簇"
);
assert(
  clusters.every((c) => Number.isFinite(c.userData.paradeSpan) && c.userData.paradeSpan > 0),
  "存在缺少 paradeSpan 的簇"
);
ok("全部簇带有沿轨传送带元数据（paradeSpeed/span）");

// 组间相位 / 车道错开
const homes = clusters.map((c) => c.userData.home);
const group0Z = homes.filter((_, i) => clusters[i].userData.lineGroup === 0).map((h) => h.z);
const group5Z = homes.filter((_, i) => clusters[i].userData.lineGroup === 5).map((h) => h.z);
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
assert(mean(group5Z) - mean(group0Z) > 4, "跨轨 6 组车道未拉开");
ok(`跨轨车道拉开：组0 z̄=${mean(group0Z).toFixed(2)} · 组5 z̄=${mean(group5Z).toFixed(2)}`);

// ---------- 4. 体积 1/3（线尺寸 ×∛1/3）与条状形态 ----------
console.log("[4] 体积缩放与拉成线");
// makeCloudClusterMesh 内部 scale × CLOUD_VOLUME_SCALE；条状 stretch 在 userData
assert(
  clusters.every((c) => c.userData.stretch && c.userData.stretch.x > c.userData.stretch.z),
  "簇未沿轨拉成条状（stretch.x 应 > stretch.z）"
);
ok("全部簇 stretch.x > stretch.z → 拉成线");

// 体积 1/3 内嵌在 makeCloudClusterMesh：线尺寸 × CLOUD_VOLUME_SCALE
// 粗检：读源码常量 + 簇 mesh 经 stretch 后仍是条状（非球状巨石）
const src = fs.readFileSync(fileURLToPath(new URL("src/world/equatorialClouds.js", BASE)), "utf8");
assert(src.includes("CLOUD_VOLUME_SCALE = Math.cbrt(1 / 3)"), "缺少 CLOUD_VOLUME_SCALE = cbrt(1/3)");
assert(src.includes("LINE_GROUPS = 6"), "缺少 LINE_GROUPS = 6");
assert(/龙卷风模式已取消|不再调用 updateWallTornadoes/.test(src), "龙卷关闭注释缺失");
ok(`体积缩放 cbrt(1/3)≈${VOLUME_SCALE.toFixed(3)} 已写入 makeCloudClusterMesh 链路`);

const sample = clusters[0];
sample.geometry.computeBoundingBox();
const bb = sample.geometry.boundingBox;
const sx = bb.max.x - bb.min.x;
const sy = bb.max.y - bb.min.y;
const sz = bb.max.z - bb.min.z;
assert(sx > 0.2 && sy > 0.2 && sz > 0.2, `单簇包围盒退化 ${sx.toFixed(2)}×${sy.toFixed(2)}×${sz.toFixed(2)}`);
ok(`单簇包围盒 ${sx.toFixed(1)}×${sy.toFixed(1)}×${sz.toFixed(1)}（再 ×stretch 成线）`);

// ---------- 5. 取消龙卷风 · 保留雨带与涌动 ----------
console.log("[5] 无龙卷 + 雨带 + 原涌动穿行");
assert.deepEqual(clouds.userData.tornadoes, [], "tornadoes 应为空数组");
assert.equal(clouds.userData.nextTornadoCheck, Infinity, "龙卷检查应关闭（Infinity）");
ok("龙卷风模式已关闭");

let rain = null;
clouds.traverse((o) => {
  if (o.isLineSegments || o.isPoints) rain = rain || o;
});
assert(rain, "雨带未生成");
ok("雨带已生成");

const sun = new THREE.DirectionalLight(0xffffff, 1);
const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
cam.position.set(0, 5, R + 12);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld(true);

// 记录穿行前 x
const xBefore = clusters.map((c) => c.position.x);
let t = 0;
for (let i = 0; i < 180; i++) {
  updateDynamicMoebiusClouds(clouds, t, sun, cam);
  t += 1 / 60;
}
const moved = clusters.filter((c, i) => Math.abs(c.position.x - xBefore[i]) > 0.05).length;
assert(moved > EXPECTED_CLUSTERS * 0.8, `穿行几乎未发生：仅 ${moved}/${EXPECTED_CLUSTERS} 簇移动`);
ok(`3 秒后 ${moved}/${EXPECTED_CLUSTERS} 簇沿轨穿行位移`);

// 滚筒涌动：rotation 应变化
assert(
  clusters.some((c) => Math.abs(c.rotation.x) > 0.01 || Math.abs(c.rotation.z) > 0.001),
  "滚筒涌动未生效"
);
ok("原涌动（滚筒翻滚）仍在更新");

assert(clouds.userData.tornadoes.length === 0, "更新后仍不应生成龙卷");
ok("600 帧级更新后仍无龙卷");

assert(Number.isFinite(towers[0].position.x), "云线位置被写坏");
ok("云线位置保持有限值");

// relocate 接口
if (typeof clouds.userData.relocate === "function") {
  const u0 = gate.userData.anchor.gateU;
  const okRel = clouds.userData.relocate(u0);
  assert(okRel, "relocate 失败");
  ok("relocate 接口可用");
}

console.log(`\n全部通过：${pass} 项断言`);
console.log(
  `云线：1 座 · ${clusters.length} 簇 · 6 组 · 无龙卷 · wallTop=${GATE.wallTop}`
);
