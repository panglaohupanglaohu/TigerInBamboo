// =====================================================================
// 地标连接走廊：山脊连续性 + 池塘/湖泊避让（2026-09-05）
// 用法：node tools/test_landmark_corridors.mjs
//
// 主人要求「地标与地标之间用山脉与森林连接」。本刀做主岛内部两条：
//   走廊 A 出发营地 → 书店镇      走廊 B 书店镇 → 月亮湖
//
// 守的是**几何不变量**，不是具体丘心坐标（调丘位不该误红）：
//   ① 走廊沿线地面必须连续高于海面 —— 否则「连接」会被海水切断
//   ② 沿线必须真有隆起（不是一条平地），否则叫不上山脊
//   ③ 丘心不得落进池塘椭圆或月亮湖 rOuter
//   ④ 营地必须浮出海面（岛台抬升生效）
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

const SRC = new URL("src/", BASE);
const {
  groundLiftAt,
  hillHeightAt,
  CORRIDOR_FOREST_PATH,
  ISLAND_FLAT_R,
  ISLAND_BASE_LIFT,
  CAMP_COVE,
  CAMP_OCEAN_ISLAND_LIFT,
  POND_CENTER_X,
  POND_CENTER_Z,
  POND_RADIUS_X,
  POND_RADIUS_Z,
} = await import(new URL("world/hills.js", SRC).href);
const { LAKE } = await import(new URL("world/lake.js", SRC).href);
const { SEA_LEVEL } = await import(new URL("world/seaLevel.js", SRC).href);
const { WORLD_SCALE } = await import(new URL("world/worldScale.js", SRC).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};
const S = WORLD_SCALE;
console.log(`WORLD_SCALE=${S}  海面 SEA_LEVEL=${SEA_LEVEL}  岛面 ${ISLAND_BASE_LIFT}\n`);

console.log("[1] 出发营地必须浮出海面（岛台抬升 = 方案 B 首个应用点）");
const campX = CAMP_COVE.x;
const campZ = CAMP_COVE.z;
const campOutside = Math.hypot(campX, campZ) > ISLAND_FLAT_R;
const campLift = groundLiftAt(campX, campZ);
console.log(
  `    营地 (${campX}, ${campZ})  在主岛足迹外=${campOutside}  ` +
    `台地抬升 ${CAMP_OCEAN_ISLAND_LIFT.toFixed(3)}  实测地面 ${campLift.toFixed(3)}`
);
assert.ok(campOutside, "营地本来就在 ISLAND_FLAT_R 之外——若这条不成立，说明布局变了，请复核本测试前提");
assert.ok(
  campLift > SEA_LEVEL,
  `出发营地仍在海面之下：lift=${campLift.toFixed(3)} ≤ SEA_LEVEL=${SEA_LEVEL}。` +
    "它是玩家出生点与 Tier0 地标，必须浮出海面"
);
ok(`营地地面 ${campLift.toFixed(3)} > 海面 ${SEA_LEVEL}（高出 ${(campLift - SEA_LEVEL).toFixed(3)}）`);

console.log("\n[2] 走廊沿线连续高于海面（连接不得被海水切断）");
assert.ok(Array.isArray(CORRIDOR_FOREST_PATH) && CORRIDOR_FOREST_PATH.length >= 2, "应有两条走廊");
const SAMPLES = 48;
for (const corridor of CORRIDOR_FOREST_PATH) {
  const pts = corridor.points;
  assert.ok(pts.length >= 2, `${corridor.id} 至少要两个点`);
  let minLift = Infinity;
  let minAt = null;
  let totalLen = 0;
  for (let seg = 0; seg < pts.length - 1; seg++) {
    const a = pts[seg];
    const b = pts[seg + 1];
    totalLen += Math.hypot(b.x - a.x, b.z - a.z);
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const x = (a.x + (b.x - a.x) * t) * S;
      const z = (a.z + (b.z - a.z) * t) * S;
      const lift = groundLiftAt(x, z);
      if (lift < minLift) {
        minLift = lift;
        minAt = { x: x / S, z: z / S };
      }
    }
  }
  console.log(
    `    ${corridor.id.padEnd(16)} 长 ${totalLen.toFixed(1)}  沿线最低地面 ${minLift.toFixed(3)}` +
      `  于 (${minAt.x.toFixed(1)}, ${minAt.z.toFixed(1)})`
  );
  assert.ok(
    minLift > SEA_LEVEL,
    `${corridor.id} 在 (${minAt.x.toFixed(1)}, ${minAt.z.toFixed(1)}) 沉到海面下` +
      `（lift=${minLift.toFixed(3)} ≤ ${SEA_LEVEL}）——走廊被海水切断，不算连接`
  );
}
ok(`${CORRIDOR_FOREST_PATH.length} 条走廊沿线全程高于海面`);

console.log("\n[3] 沿线确有隆起（是山脊，不是平地）");
for (const corridor of CORRIDOR_FOREST_PATH) {
  const pts = corridor.points;
  let maxHill = 0;
  let ridgeSamples = 0;
  let total = 0;
  for (let seg = 0; seg < pts.length - 1; seg++) {
    const a = pts[seg];
    const b = pts[seg + 1];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const x = (a.x + (b.x - a.x) * t) * S;
      const z = (a.z + (b.z - a.z) * t) * S;
      const h = hillHeightAt(x, z);
      if (h > maxHill) maxHill = h;
      if (h > 0.25) ridgeSamples++;
      total++;
    }
  }
  const coverage = ridgeSamples / total;
  console.log(
    `    ${corridor.id.padEnd(16)} 最高丘 ${maxHill.toFixed(2)}  隆起覆盖 ${(coverage * 100).toFixed(0)}%`
  );
  assert.ok(maxHill > 0.6, `${corridor.id} 沿线最高只有 ${maxHill.toFixed(2)}，读不出山脊`);
  assert.ok(
    coverage > 0.5,
    `${corridor.id} 只有 ${(coverage * 100).toFixed(0)}% 的采样点有隆起，山脊不连续`
  );
}
ok("两条走廊沿线均有连续隆起");

console.log("\n[4] 避让：丘心不得落进池塘或月亮湖");
// 池塘椭圆 ((x-cx)/rx)² + ((z-cz)/rz)² < 1
const inPond = (wx, wz) => {
  const nx = (wx - POND_CENTER_X) / POND_RADIUS_X;
  const nz = (wz - POND_CENTER_Z) / POND_RADIUS_Z;
  return nx * nx + nz * nz < 1;
};
const inLake = (wx, wz) => Math.hypot(wx - LAKE.x, wz - LAKE.z) < LAKE.rOuter;
let checked = 0;
for (const corridor of CORRIDOR_FOREST_PATH) {
  for (const p of corridor.points) {
    const wx = p.x * S;
    const wz = p.z * S;
    // 端点就是地标本体（月亮湖端点当然在湖里），只查中间的走廊丘心
    const isEndpoint = p === corridor.points[0] || p === corridor.points[corridor.points.length - 1];
    if (isEndpoint) continue;
    assert.ok(
      !inPond(wx, wz),
      `${corridor.id} 的丘心 (${p.x}, ${p.z}) 落在池塘里——营地→书店必须走池南「针眼」`
    );
    assert.ok(
      !inLake(wx, wz),
      `${corridor.id} 的丘心 (${p.x}, ${p.z}) 落在月亮湖 rOuter=${LAKE.rOuter} 内——山会长进湖里`
    );
    checked++;
  }
}
ok(`${checked} 个走廊丘心全部避开池塘椭圆与月亮湖`);

console.log("\n[5] 走廊必须留在主岛足迹内（端点除外）");
for (const corridor of CORRIDOR_FOREST_PATH) {
  for (const p of corridor.points) {
    const isEndpoint = p === corridor.points[0] || p === corridor.points[corridor.points.length - 1];
    if (isEndpoint) continue;
    const d = Math.hypot(p.x * S, p.z * S);
    assert.ok(
      d <= ISLAND_FLAT_R,
      `${corridor.id} 的丘心 (${p.x}, ${p.z}) 距心 ${d.toFixed(1)} 超出 ISLAND_FLAT_R=${ISLAND_FLAT_R}，` +
        "岛外没有高度场，山丘会浮空"
    );
  }
}
ok(`走廊中间点全部在 ISLAND_FLAT_R=${ISLAND_FLAT_R} 内`);

console.log(`\n全部通过：${pass} 项`);
for (const c of CORRIDOR_FOREST_PATH) {
  console.log(`${c.id}: ${c.points.map((p) => `(${p.x},${p.z})`).join(" → ")}`);
}
