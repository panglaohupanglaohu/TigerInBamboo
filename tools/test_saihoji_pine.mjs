// 西芳寺主石之庭单株巨松验收（node 直跑）
// 运行：node tools/test_saihoji_pine.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

if (!globalThis.document) {
  const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
  globalThis.document = { getElementById: el, querySelector: el, createElement: el };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.window = globalThis;
  globalThis.window.addEventListener = () => {};
  globalThis.document.createElement = (tag) => {
    if (tag === "canvas") {
      const ctx2d = new Proxy({}, {
        get(t, k) {
          if (k === "canvas") return { width: 256, height: 256 };
          if (k === "createLinearGradient" || k === "createRadialGradient") {
            return () => ({ addColorStop() {} });
          }
          if (k === "measureText") return () => ({ width: 0 });
          if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
          if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
          return typeof k === "string" ? () => {} : undefined;
        },
      });
      return { width: 256, height: 256, getContext: () => ctx2d };
    }
    return el();
  };
}

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildSaihojiPlanet, SAIHOJI_PINE_SIZE } = await import(
  new URL("src/world/saihoji.js", BASE).href
);

const scene = new THREE.Scene();
const built = buildSaihojiPlanet(scene, { seed: 884 });

// 松树碰撞体存在（古松 collideRadius 随 scale 变化）
const pineColliders = built.colliders?.filter((c) => c.radius >= 0.4) || [];
assert(pineColliders.length >= 10, `松树碰撞体应 ≥10（实际 ${pineColliders.length}）`);
console.log(`  ✓ 松树碰撞体 ${pineColliders.length} 个`);

const zones = built.landmarks?.zones ?? {};
const byId = Object.fromEntries(
  Object.entries(zones).map(([id, z]) => [id, z.pines?.length ?? 0])
);
const totalPines = Object.values(byId).reduce((a, b) => a + b, 0);
assert(totalPines >= 18 && totalPines <= 30, `全庭松树 18–30 株（实际 ${totalPines}）`);
console.log(`  ✓ 全庭 ${totalPines} 株 · 分区 ${JSON.stringify(byId)}`);

// 空庭极简（计白当黑）
assert((byId["empty-court"] ?? 0) <= 3, `空庭应 ≤3 株（实际 ${byId["empty-court"]}）`);
console.log(`  ✓ 空庭极简 ${byId["empty-court"]} 株`);

// 高低胖瘦：scale 跨度
const allPines = Object.values(zones).flatMap((z) => z.pines || []);
const scales = allPines.map((p) => p.userData.pineScale ?? 1);
const sMin = Math.min(...scales);
const sMax = Math.max(...scales);
assert(sMin <= 0.7, `应有幼/矮松 scale≤0.7（min=${sMin.toFixed(2)}）`);
assert(sMax >= 1.2, `应有主木 scale≥1.2（max=${sMax.toFixed(2)}）`);
assert.equal(SAIHOJI_PINE_SIZE, 3, "苔庭松树体积应为三倍");
const visuals = allPines.map((p) => p.scale.x);
const vMin = Math.min(...visuals);
const vMax = Math.max(...visuals);
assert(vMin >= 1.02 * sMin * SAIHOJI_PINE_SIZE * 0.98, `幼松可见尺度应约 3×（min=${vMin.toFixed(2)}）`);
assert(vMax >= 1.02 * 1.2 * SAIHOJI_PINE_SIZE * 0.98, `主木可见尺度应约 3×（max=${vMax.toFixed(2)}）`);
console.log(`  ✓ 胖瘦高低 scale ${sMin.toFixed(2)}–${sMax.toFixed(2)} · 体积 ×${SAIHOJI_PINE_SIZE}（${vMin.toFixed(2)}–${vMax.toFixed(2)}）`);

// 角色齐全
const roles = new Set(allPines.map((p) => p.userData.pineRole));
assert(roles.has("master") && roles.has("companion"), `应有主木/添木角色（${[...roles]}）`);
console.log(`  ✓ 角色 ${[...roles].join(",")}`);

// 非均匀：同景内株距方差（忌等距环植）
function localXZ(pine, zoneDef) {
  // 用世界位相对区心的切向投影近似局部 xz
  const R = 160;
  const lat = (zoneDef.lat * Math.PI) / 180;
  const lon = (zoneDef.lon * Math.PI) / 180;
  const base = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
  const east = new THREE.Vector3(0, 1, 0).cross(base).normalize();
  const north = base.clone().cross(east).normalize();
  const p = pine.position.clone().normalize();
  // 切平面投影（弧长近似）
  const d = p.clone().sub(base);
  return { x: d.dot(east) * R, z: d.dot(north) * R };
}
let nonUniformOk = 0;
for (const [id, z] of Object.entries(zones)) {
  const pines = z.pines || [];
  if (pines.length < 3) continue;
  const pts = pines.map((p) => localXZ(p, z.definition));
  const dists = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      dists.push(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
    }
  }
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const variance =
    dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / mean; // 变异系数
  assert(cv > 0.18, `${id} 株距应参差（cv=${cv.toFixed(2)}）`);
  nonUniformOk++;
}
console.log(`  ✓ ${nonUniformOk} 景株距参差（非等距环）`);

// 抬根：径向位置应略高于球面 R
const R = 160;
let buried = 0;
for (const pine of allPines) {
  const r = pine.position.length();
  if (r < R + 0.04) buried++;
}
assert(buried === 0, `应全部抬根出苔，埋入 ${buried} 株`);
console.log(`  ✓ 全部抬根出苔（r ≥ R+0.04）`);

console.log(`\n结果：通过`);
process.exit(0);
