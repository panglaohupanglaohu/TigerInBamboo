// =====================================================================
// 叹息之门泡形飞行器 ×3（用户 2026-09-04 需求，参考概念图形体）
//
//   ① createGatePodCraft 出得来：低模、有描边、三角数在预算内
//   ② 形体对得上概念图：球根机鼻在 +Z、方箱在 −Z、翼展 > 机长、座舱在顶
//   ③ mountGatePodCraft 挂 3 台到 seatRoot 下（搬门时跟着走）
//   ④ 幂等：重复挂载不会变成 6 台
//   ⑤ updateGatePodCraft 只动位置/滚转，基座常量不被改写
//   ⑥ 确定性：两次构建包围盒完全一致（禁止 Math.random）
//
// 运行：node tools/test_gate_pod_craft.mjs
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, createImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createGatePodCraft, mountGatePodCraft, updateGatePodCraft, GATE_POD_VARIANTS } =
  await import(new URL("src/world/gatePodCraft.js", BASE).href);

const tris = (root) => {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute("position");
    n += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
  });
  return n;
};
const boxOf = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };

// ---- ① 建得出来、是低模
const pod = createGatePodCraft({ scale: 1 });
assert.equal(pod.name, "gate-pod-craft");
const t = tris(pod);
assert.ok(t > 200, `不该是空壳，实得 ${t} 三角`);
assert.ok(t < 6000, `低模预算：单台应 < 6000 三角（含反向壳描边），实得 ${t}`);
let outlines = 0;
pod.traverse((o) => { if (o.isMesh && o.userData.isOutline) outlines++; });
assert.ok(outlines > 0, "主体块必须有描边（与场景其他低模资产同风格）");

// ---- ② 形体对得上概念图
{
  const box = boxOf(pod);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.x > size.z, `翼展应大于机长：展 ${size.x.toFixed(2)} vs 长 ${size.z.toFixed(2)}`);
  assert.ok(size.z > 4 && size.z < 9, `机长应在 4~9（约 7），实得 ${size.z.toFixed(2)}`);

  const part = (k) => { let f = null; pod.traverse((o) => { if (!f && o.userData?.podPart === k) f = o; }); return f; };
  const parts = (k) => { const out = []; pod.traverse((o) => { if (o.userData?.podPart === k) out.push(o); }); return out; };
  // 球根机鼻在机头一侧（+Z），方箱中后段在 −Z 一侧
  const nose = part("nose");
  assert.ok(nose && nose.position.z > 1, `球根机鼻应在 +Z 一侧，实得 z=${nose?.position.z}`);
  const bodyBox = part("body");
  assert.ok(bodyBox && bodyBox.position.z < 0, `方箱中后段应在 −Z 一侧，实得 z=${bodyBox?.position.z}`);
  assert.ok(nose.position.z > bodyBox.position.z, "机鼻必须在方箱前面");
  const tail = part("tail");
  assert.ok(tail && tail.position.z < bodyBox.position.z, "尾板应在方箱之后（最尾端）");
  // 座舱在顶部
  const canopy = part("canopy");
  assert.ok(canopy && canopy.position.y > 0.8, `座舱应在机身上方，实得 y=${canopy?.position.y}`);
  // 一对平直翼，左右对称
  const wings = parts("wing");
  assert.equal(wings.length, 2, `应是一对平直翼，实得 ${wings.length}`);
  assert.ok(Math.abs(wings[0].position.x + wings[1].position.x) < 1e-9, "两翼必须左右对称");
  assert.ok(Math.abs(wings[0].position.x) > 2, "翼要够长（概念图里细长外伸）");
  // 腹部推进器在下方
  const jets = parts("thruster");
  assert.ok(jets.length >= 4, `腹部推进器丛至少 4 根，实得 ${jets.length}`);
  assert.ok(jets.every((j) => j.position.y < -1), "推进器必须全在腹部下方");
  console.log(`  单台：${t} 三角 · 展 ${size.x.toFixed(2)} × 长 ${size.z.toFixed(2)} × 高 ${size.y.toFixed(2)}`);
}

// ---- ③ 挂 3 台到 seatRoot
const seat = new THREE.Group();
seat.name = "gate-seat-root";
const gate = new THREE.Group();
gate.add(seat);
gate.userData.seatRoot = seat;

const squadron = mountGatePodCraft(gate);
assert.ok(squadron, "应挂载成功");
assert.equal(squadron.parent, seat, "必须挂在 seatRoot 下——搬门时才会跟着走");
assert.equal(squadron.children.length, 3, `恰好 3 台，实得 ${squadron.children.length}`);
const ids = squadron.children.map((c) => c.userData.podVariant);
assert.deepEqual(ids, GATE_POD_VARIANTS.map((v) => v.id), "三台应各用一套涂装");
// 三台位置互不相同，且都在门的框景范围里（横向 ±16、高度 10~40）
const seen = new Set();
for (const c of squadron.children) {
  const k = c.position.toArray().join(",");
  assert.ok(!seen.has(k), "三台不能停在同一点");
  seen.add(k);
  assert.ok(Math.abs(c.position.x) <= 16, `横向不得超出峡谷框景 ±16，实得 x=${c.position.x}`);
  assert.ok(c.position.y > 10 && c.position.y < 40, `停位高度应在 10~40（门高 44），实得 y=${c.position.y}`);
}

// 搬门：seatRoot 一动，三台跟着动
{
  const before = boxOf(squadron.children[0]).getCenter(new THREE.Vector3()).clone();
  seat.position.set(120, -40, 33);
  const after = boxOf(squadron.children[0]).getCenter(new THREE.Vector3());
  assert.ok(after.distanceTo(before) > 100, "搬门后飞行器必须跟着走（挂在 seatRoot 下）");
  seat.position.set(0, 0, 0);
}

// ---- ④ 幂等
{
  const again = mountGatePodCraft(gate);
  assert.equal(again.children.length, 3, "重复挂载仍是 3 台");
  let squads = 0;
  seat.traverse((o) => { if (o.name === "gate-pod-squadron") squads++; });
  assert.equal(squads, 1, `seatRoot 下只能有一个中队，实得 ${squads}`);
}

// ---- ⑤ 悬停摆动不写坏基座
{
  const sq = seat.getObjectByName("gate-pod-squadron");
  const bases = sq.children.map((c) => c.userData.basePosition.slice());
  for (let i = 0; i < 200; i++) updateGatePodCraft(sq, i * 0.05);
  sq.children.forEach((c, i) => {
    assert.deepEqual(c.userData.basePosition, bases[i], "基座常量不得被摆动写回");
    assert.ok(Math.abs(c.position.y - bases[i][1]) <= 0.45, "垂直摆幅应 ≤ 0.42+ε");
    assert.ok(Math.abs(c.position.x - bases[i][0]) <= 0.25, "横向摆幅应 ≤ 0.22+ε");
  });
  // 三台错相：同一时刻的 y 偏移不应全部相同
  updateGatePodCraft(sq, 1.7);
  const dys = sq.children.map((c, i) => (c.position.y - bases[i][1]).toFixed(4));
  assert.ok(new Set(dys).size === 3, `三台必须错相摆动，实得 ${dys}`);
}

// ---- ⑥ 确定性
{
  const a = boxOf(createGatePodCraft({ scale: 1 }));
  const b = boxOf(createGatePodCraft({ scale: 1 }));
  assert.deepEqual(a.min.toArray().map((v) => v.toFixed(6)), b.min.toArray().map((v) => v.toFixed(6)));
  assert.deepEqual(a.max.toArray().map((v) => v.toFixed(6)), b.max.toArray().map((v) => v.toFixed(6)));
}

console.log(`✅ test_gate_pod_craft（3 台挂在 seatRoot 下 · 搬门跟随 · 幂等 · 错相悬停 · 确定性）`);
