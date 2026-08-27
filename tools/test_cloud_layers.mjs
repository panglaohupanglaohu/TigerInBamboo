// =====================================================================
// 云展现分层验收（飞艇鸟瞰）：各云层数量、位置、高度、山脉内外分布。
// =====================================================================
import assert from "node:assert/strict";
import { compileHighlandLocalHeroClouds } from "../TigerMessenger/src/world/highlandHeroClouds.js";

const c = compileHighlandLocalHeroClouds({ radius: 160 });
const byRole = (role) => c.instances.filter((i) => i.heroRole === role);
const clouds = c.instances.filter((i) => i.shape !== "canopy");

// --- 1. 分层数量 ------------------------------------------------------
assert.equal(byRole("cap").length, 1, "cap 1 朵");
assert.ok(byRole("ring").length >= 15, `ring 云海 ≥15（实际 ${byRole("ring").length}）`);
assert.ok(byRole("castle-cloud").length >= 1, "城堡环绕云 ≥1");
assert.ok(byRole("inner-cloud").length >= 3, "内环云 ≥3");
assert.ok(byRole("outer-cloud").length >= 15, `山脉外云 ≥15（实际 ${byRole("outer-cloud").length}）`);
assert.ok(clouds.length >= 40, `总云 ≥40（实际 ${clouds.length}）`);

// --- 2. cap 在城堡上方 -------------------------------------------------
const cap = byRole("cap")[0];
assert.ok(Math.abs(cap.position[0]) < 1 && Math.abs(cap.position[2]) < 1, "cap 在城堡正上方");
assert.ok(cap.position[1] >= 36 && cap.position[1] <= 42, `cap 高度 ${cap.position[1].toFixed(1)} 在城堡顶上方`);
assert.ok(cap.scale >= 20, `cap 足够大 ${cap.scale.toFixed(1)}`);

// --- 3. ring 云海: 山腰高度 + 半径环绕 ---------------------------------
const rings = byRole("ring");
for (const ring of rings) {
  const r = Math.hypot(ring.position[0], ring.position[2]);
  assert.ok(r >= 40 && r <= 72, `ring 半径 ${r.toFixed(0)} 在山腰环带`);
  assert.ok(ring.position[1] >= 28 && ring.position[1] <= 56, `ring 高度 ${ring.position[1].toFixed(0)}`);
}
// 相邻 ring 云重叠(云海感): 24 朵中至少 12 对距离 < 云直径
const RING_SCALE = rings[0].scale;
let overlap = 0;
for (let i = 0; i < rings.length; i++) {
  for (let j = i + 1; j < rings.length; j++) {
    const d = Math.hypot(
      rings[i].position[0] - rings[j].position[0],
      rings[i].position[2] - rings[j].position[2]
    );
    if (d < RING_SCALE * 1.4) overlap++;
  }
}
assert.ok(overlap >= 8, `ring 相邻重叠 ${overlap} 对（云海带）`);

// --- 4. 山脉外的云(outer): 半径必须超过山脉边缘 ------------------------
const outers = byRole("outer-cloud");
for (const outer of outers) {
  const r = Math.hypot(outer.position[0], outer.position[2]);
  assert.ok(r >= 60, `outer 半径 ${r.toFixed(0)} 在山脉轮廓外`);
  assert.ok(outer.position[1] >= 44 && outer.position[1] <= 72, `outer 高度 ${outer.position[1].toFixed(0)}`);
}
// 方位覆盖: outer 云方位角分布(至少 8 个象限中 6 个有云)
const octants = new Set(outers.map((o) => {
  const a = Math.atan2(o.position[2], o.position[0]);
  return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8);
}));
assert.ok(octants.size >= 6, `outer 覆盖 ${octants.size}/8 方位`);

// --- 5. 确定性 --------------------------------------------------------
const c2 = compileHighlandLocalHeroClouds({ radius: 160 });
assert.equal(c.instances.length, c2.instances.length, "确定性实例数");
for (let i = 0; i < c.instances.length; i++) {
  assert.equal(c.instances[i].id, c2.instances[i].id, `确定性 id[${i}]`);
  assert.deepEqual(c.instances[i].position, c2.instances[i].position, `确定性 pos[${i}]`);
}

console.log(`✅ 云展现分层: cap ${byRole("cap").length} + castle ${byRole("castle-cloud").length} + inner ${byRole("inner-cloud").length} + ring ${byRole("ring").length}(重叠${overlap}对) + outer ${byRole("outer-cloud").length}(${octants.size}/8方位) = ${clouds.length} 朵`);
