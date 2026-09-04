// =====================================================================
// 叹息之门 · 重型运输艇 ×3（用户 2026-09-04 第二张概念图）
//
//   ① 低模、有描边、三角数在预算内
//   ② 形体对得上概念图：方箱机体 + 腹部米白大护板 + 顶部泡形座舱
//      + 机头两个圆口 + 尾下球形推进舱 + 带肋滑撬板
//   ③ 与 gatePodCraft 是**两型不同的艇**：这型没有翼，且明显更粗壮
//   ④ 挂 3 台到 seatRoot 下（搬门跟随）、幂等
//   ⑤ 停位与侦察艇错开高度，且都在峡谷框景内
//   ⑥ 悬停摆动不写坏基座；三台错相
//   ⑦ 确定性
//
// 运行：node tools/test_gate_hauler_craft.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const H = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);
const P = await import(new URL("src/world/gatePodCraft.js", BASE).href);
const { createGateHaulerCraft, mountGateHaulerCraft, updateGateHaulerCraft, GATE_HAULER_VARIANTS } = H;

const tris = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    n += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
  });
  return n;
};
const part = (root, k) => { let f = null; root.traverse((o) => { if (!f && o.userData?.haulerPart === k) f = o; }); return f; };
const boxOf = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };

// ---- ① 低模
const craft = createGateHaulerCraft();
{
  assert.equal(craft.name, "gate-hauler-craft");
  const t = tris(craft);
  assert.ok(t > 300, `不该是空壳，实得 ${t}`);
  assert.ok(t < 8000, `低模预算：单台应 < 8000 三角（含描边），实得 ${t}`);
  let outlines = 0;
  craft.traverse((o) => { if (o.isMesh && o.userData.isOutline) outlines++; });
  assert.ok(outlines > 0, "主体块必须有描边");
  const size = boxOf(craft).getSize(new THREE.Vector3());
  console.log(`  单台：${t} 三角 · 宽 ${size.x.toFixed(2)} × 长 ${size.z.toFixed(2)} × 高 ${size.y.toFixed(2)}`);
}

// ---- ② 形体
{
  const hull = part(craft, "hull");
  const nose = part(craft, "nose");
  const belly = part(craft, "belly");
  const canopy = part(craft, "canopy");
  const pod = part(craft, "thrusterPod");
  const skid = part(craft, "skid");
  for (const [k, v] of Object.entries({ hull, nose, belly, canopy, thrusterPod: pod, skid })) {
    assert.ok(v, `缺少构件 ${k}`);
  }
  assert.ok(nose.position.z > hull.position.z, "机头段必须在主机体前面（+Z）");
  assert.ok(belly.position.y < hull.position.y, "米白护板必须在主机体下方");
  assert.ok(canopy.position.y > hull.position.y, "座舱必须在主机体上方");
  assert.ok(canopy.position.z > 0, "座舱偏前（概念图里飞行员在前上方）");
  assert.ok(pod.position.y < belly.position.y, "球形推进舱必须吊在腹部之下");
  assert.ok(pod.position.z < hull.position.z, "推进舱在尾部（−Z）");
  // 腹部护板要够大：它是这型艇的「脸」
  const bellyW = belly.geometry.boundingBox
    ? belly.geometry.boundingBox.max.x - belly.geometry.boundingBox.min.x
    : (belly.geometry.computeBoundingBox(), belly.geometry.boundingBox.max.x - belly.geometry.boundingBox.min.x);
  const hullW = (hull.geometry.computeBoundingBox(), hull.geometry.boundingBox.max.x - hull.geometry.boundingBox.min.x);
  assert.ok(bellyW >= hullW, `腹部护板应与机体等宽或更宽（${bellyW.toFixed(2)} vs ${hullW.toFixed(2)}）`);
}

// ---- ③ 与侦察艇是两型
{
  const pod = P.createGatePodCraft();
  const hs = boxOf(craft).getSize(new THREE.Vector3());
  const ps = boxOf(pod).getSize(new THREE.Vector3());
  assert.ok(ps.x > hs.x, `侦察艇有长翼、展宽应更大（${ps.x.toFixed(2)} vs ${hs.x.toFixed(2)}）`);
  assert.ok(hs.y > ps.y, `运输艇更粗壮、更高（${hs.y.toFixed(2)} vs ${ps.y.toFixed(2)}）`);
  assert.equal(part(craft, "wing"), null, "运输艇没有翼");
}

// ---- ④ 挂 3 台 + 幂等 + 搬门跟随
const seat = new THREE.Group();
seat.name = "gate-seat-root";
const gate = new THREE.Group();
gate.add(seat);
gate.userData.seatRoot = seat;

const flight = mountGateHaulerCraft(gate);
assert.ok(flight, "应挂载成功");
assert.equal(flight.parent, seat, "必须挂在 seatRoot 下");
assert.equal(flight.children.length, 3, `恰好 3 台，实得 ${flight.children.length}`);
assert.deepEqual(flight.children.map((c) => c.userData.haulerVariant), GATE_HAULER_VARIANTS.map((v) => v.id));
{
  mountGateHaulerCraft(gate);
  let n = 0;
  seat.traverse((o) => { if (o.name === "gate-hauler-flight") n++; });
  assert.equal(n, 1, `重复挂载只能有一个编队，实得 ${n}`);
}
{
  const sq = seat.getObjectByName("gate-hauler-flight");
  const before = boxOf(sq.children[0]).getCenter(new THREE.Vector3()).clone();
  seat.position.set(90, -30, 44);
  const after = boxOf(sq.children[0]).getCenter(new THREE.Vector3());
  assert.ok(after.distanceTo(before) > 80, "搬门后必须跟着走");
  seat.position.set(0, 0, 0);
}

// ---- ⑤ 停位：都在框景内，且与侦察艇错开高度
{
  const sq = seat.getObjectByName("gate-hauler-flight");
  for (const c of sq.children) {
    assert.ok(Math.abs(c.position.x) <= 16, `横向不得超出峡谷框景 ±16，实得 ${c.position.x}`);
    assert.ok(c.position.y > 8 && c.position.y < 40, `停位高度应在 8~40，实得 ${c.position.y}`);
  }
  const podSquad = P.mountGatePodCraft(gate);
  const haulerMax = Math.max(...sq.children.map((c) => c.position.y));
  const podMin = Math.min(...podSquad.children.map((c) => c.position.y));
  assert.ok(haulerMax < podMin, `运输艇应整体低于侦察艇（运输 max ${haulerMax} vs 侦察 min ${podMin}）——两拨叠在一层会糊成一坨`);
  console.log(`  停位：运输艇 ${sq.children.map((c) => c.position.y).join("/")} · 侦察艇 ${podSquad.children.map((c) => c.position.y).join("/")}`);
}

// ---- ⑥ 悬停摆动
{
  const sq = seat.getObjectByName("gate-hauler-flight");
  const bases = sq.children.map((c) => c.userData.basePosition.slice());
  for (let i = 0; i < 300; i++) updateGateHaulerCraft(sq, i * 0.05);
  sq.children.forEach((c, i) => {
    assert.deepEqual(c.userData.basePosition, bases[i], "基座常量不得被摆动写回");
    assert.ok(Math.abs(c.position.y - bases[i][1]) <= 0.28, "垂直摆幅应 ≤ 0.26+ε（比侦察艇更稳）");
  });
  updateGateHaulerCraft(sq, 2.3);
  const dys = sq.children.map((c, i) => (c.position.y - bases[i][1]).toFixed(4));
  assert.equal(new Set(dys).size, 3, `三台必须错相，实得 ${dys}`);
}

// ---- ⑦ 确定性
{
  const a = boxOf(createGateHaulerCraft());
  const b = boxOf(createGateHaulerCraft());
  assert.deepEqual(a.min.toArray().map((v) => v.toFixed(6)), b.min.toArray().map((v) => v.toFixed(6)));
  assert.deepEqual(a.max.toArray().map((v) => v.toFixed(6)), b.max.toArray().map((v) => v.toFixed(6)));
}

console.log("✅ test_gate_hauler_craft（3 台挂 seatRoot · 与侦察艇分层 · 幂等 · 错相悬停 · 确定性）");
