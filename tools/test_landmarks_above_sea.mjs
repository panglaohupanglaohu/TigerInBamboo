// =====================================================================
// 地标必须在海面之上（主人 2026-09-05 硬约束）
// 用法：node tools/test_landmarks_above_sea.mjs
//
// 主人原话：「无论怎么移动，除了水晶城和湖沼，其他地标都需要在海面之上」。
//
// 海面基准：R + OFFICIAL_OCEAN_SEA_LEVEL（= 160 + 0.72 = 160.72）。
// 官方海洋是一层贴 R+0.72 的球壳（officialOcean.js compileOfficialOcean），
// 并在峡谷内沿裂谷倾泻下去（officialOceanLevelAt）——所以峡谷内的水位更低，
// 城/湖沼在谷底属于**允许**在基准海面之下。
//
// 豁免名单只有两个：
//   · 水晶城 city   —— 本来就坐在峡谷里
//   · 湖沼 swamp    —— 莫比斯原初湖沼
// 其余地标一律必须 > 海面。
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
const { PLANET_RADIUS } = await import(new URL("world/planet.js", SRC).href);
const { OFFICIAL_OCEAN_SEA_LEVEL, officialOceanLevelAt } = await import(
  new URL("world/waterV8/officialOcean.js", SRC).href
);
const { groundLiftAt, ISLAND_FLAT_R, ISLAND_BASE_LIFT, BOOKSHOP_TOWN } = await import(
  new URL("world/hills.js", SRC).href
);
const { LAKE, HARBOR } = await import(new URL("world/lake.js", SRC).href);
const { SAIHOJI_HUB, SAIHOJI_ZONES } = await import(new URL("world/saihoji.js", SRC).href);
const { canyonOffsetDir } = await import(new URL("world/canyon.js", SRC).href);
const { latLonToDir, flatXZToLatLon } = await import(new URL("world/sphereMath.js", SRC).href);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const R = PLANET_RADIUS;
const SEA = R + OFFICIAL_OCEAN_SEA_LEVEL;
console.log(`R=${R}  海平面=R+${OFFICIAL_OCEAN_SEA_LEVEL}=${SEA.toFixed(2)}`);
console.log(`主岛足迹 ISLAND_FLAT_R=${ISLAND_FLAT_R}（张角 ${((ISLAND_FLAT_R / R) * 180 / Math.PI).toFixed(1)}° → lat ${(90 - (ISLAND_FLAT_R / R) * 180 / Math.PI).toFixed(1)}–90）\n`);

/** 平面地块地标：地表半径 = R + groundLiftAt(x,z) */
const flatLandmark = (name, x, z) => {
  const lift = groundLiftAt(x, z);
  const { lat, lon } = flatXZToLatLon(x, z, R);
  return { name, radius: R + lift, lift, lat, lon, source: `groundLiftAt(${x.toFixed(1)}, ${z.toFixed(1)})` };
};

/** 球面方向地标：地表半径 = R + canyonOffsetDir(dir)（谷外为 0） */
const dirLandmark = (name, latDeg, lonDeg, extraLift = 0) => {
  const dir = latLonToDir(latDeg, lonDeg, new THREE.Vector3());
  const canyon = canyonOffsetDir(dir);
  return {
    name,
    radius: R + canyon + extraLift,
    lift: canyon + extraLift,
    lat: latDeg,
    lon: lonDeg,
    dir,
    source: `canyonOffsetDir + ${extraLift}`,
  };
};

console.log("[1] 主岛四地标（北极冠，平面地块）");
const island = [
  flatLandmark("月亮湖 moon 湖心", LAKE.x, LAKE.z),
  flatLandmark("旧港 harbor", HARBOR.x, HARBOR.z),
  flatLandmark("书店镇 bookshop", BOOKSHOP_TOWN.x, BOOKSHOP_TOWN.z),
];
for (const lm of island) {
  console.log(
    `    ${lm.name.padEnd(20)} lat ${lm.lat.toFixed(1).padStart(5)}  lift ${lm.lift.toFixed(3).padStart(7)}  r ${lm.radius.toFixed(3)}  ${lm.radius > SEA ? `✓ 高出 ${(lm.radius - SEA).toFixed(3)}` : `❌ 低于海面 ${(SEA - lm.radius).toFixed(3)}`}`
  );
}
// 月亮湖是湖：湖心被 pondDepression 下挖是设计使然，判定用它的**岸**而不是湖心。
// 这里单独放宽湖心，但要求环湖小径外缘（LAKE.pathOuter）在海面之上。
const lakeBank = flatLandmark("月亮湖岸", LAKE.x + LAKE.pathOuter, LAKE.z);
console.log(
  `    ${"月亮湖岸（判定用）".padEnd(20)} lift ${lakeBank.lift.toFixed(3).padStart(7)}  r ${lakeBank.radius.toFixed(3)}  ${lakeBank.radius > SEA ? `✓ 高出 ${(lakeBank.radius - SEA).toFixed(3)}` : `❌ 低于海面 ${(SEA - lakeBank.radius).toFixed(3)}`}`
);
// 出发营地：平面 (-17, 9) → 世界 (-68, 36)，hypot=76.95 **超出** ISLAND_FLAT_R=72，
// 所以它靠自带的海湾台地（CAMP_OCEAN_ISLAND_LIFT）浮起来，不是靠岛面。
// 2026-09-05 实测：加台地之前 lift=0 → r=160.0，比海面低 0.5，而它是玩家出生点。
const camp = flatLandmark("出发营地 camp", -17 * 4, 9 * 4);
console.log(
  `    ${camp.name.padEnd(20)} lat ${camp.lat.toFixed(1).padStart(5)}  lift ${camp.lift.toFixed(3).padStart(7)}  r ${camp.radius.toFixed(3)}  ${camp.radius > SEA ? `✓ 高出 ${(camp.radius - SEA).toFixed(3)}` : `❌ 低于海面 ${(SEA - camp.radius).toFixed(3)}`}`
);
for (const lm of [island[1], island[2], lakeBank, camp]) {
  assert.ok(
    lm.radius > SEA,
    `${lm.name} 在海面之下：r=${lm.radius.toFixed(3)} ≤ 海面 ${SEA.toFixed(2)}（${lm.source}）`
  );
}
ok(`旧港 / 书店镇 / 月亮湖岸 均在海面之上（岛面基准 ISLAND_BASE_LIFT=${ISLAND_BASE_LIFT}）`);

console.log("\n[2] 西芳寺苔庭（2026-09-05 平移到 lat 32）");
// 苔丘建在星球上（messengerIsland 的 mossSaihoji），其表面半径见 saihojiGarden：
// surfaceR = R + 0.62 + 0.18
const MOSS_SURFACE_LIFT = 0.62 + 0.18;
const hub = dirLandmark("苔庭中枢 hub", SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, MOSS_SURFACE_LIFT);
const outsideIsland = (SAIHOJI_HUB.lat < 90 - (ISLAND_FLAT_R / R) * 180 / Math.PI);
console.log(
  `    中枢 lat ${SAIHOJI_HUB.lat} / lon ${SAIHOJI_HUB.lon}  在主岛足迹之外=${outsideIsland}` +
    `（故 groundLiftAt≈0，只靠苔丘自身抬升 ${MOSS_SURFACE_LIFT}）`
);
console.log(
  `    苔丘表面 r=${hub.radius.toFixed(3)}  海面 ${SEA.toFixed(2)}  ` +
    `${hub.radius > SEA ? `✓ 高出 ${(hub.radius - SEA).toFixed(3)}` : `❌ 低于海面 ${(SEA - hub.radius).toFixed(3)}`}`
);
assert.ok(
  hub.radius > SEA,
  `苔庭中枢在海面之下：r=${hub.radius.toFixed(3)} ≤ 海面 ${SEA.toFixed(2)}。\n` +
    `  lat ${SAIHOJI_HUB.lat} 在主岛足迹（lat ${(90 - (ISLAND_FLAT_R / R) * 180 / Math.PI).toFixed(1)}–90）之外，` +
    `groundLiftAt 返回 ~0，苔丘只有 ${MOSS_SURFACE_LIFT} 的自身抬升，撑不过海平面 ${OFFICIAL_OCEAN_SEA_LEVEL}。\n` +
    `  修法：给苔庭新位置补一块岛台抬升（参考 BOOKSHOP_OCEAN_ISLAND_LIFT=3.2 的做法），` +
    `或把中枢纬度移回主岛足迹内。`
);
// 六景同样要在海面之上
let worstZone = null;
for (const z of SAIHOJI_ZONES) {
  const zl = dirLandmark(z.id, z.lat, z.lon, MOSS_SURFACE_LIFT);
  if (!worstZone || zl.radius < worstZone.radius) worstZone = zl;
}
assert.ok(
  worstZone.radius > SEA,
  `六景最低者 ${worstZone.name} 在海面之下：r=${worstZone.radius.toFixed(3)} ≤ ${SEA.toFixed(2)}`
);
ok(`苔庭中枢与六景（最低 ${worstZone.name} r=${worstZone.radius.toFixed(3)}）均在海面之上`);

console.log("\n[3] 豁免名单：只有水晶城与湖沼可以在海面之下");
const EXEMPT = Object.freeze(["city", "swamp"]);
assert.deepEqual(EXEMPT, ["city", "swamp"], "豁免名单只能是水晶城与湖沼；要加豁免得主人点头");
// 水晶城在峡谷里，海水沿裂谷倾泻 → 谷内水位低于基准海面，这是设计
const cityDir = latLonToDir(-24, -112, new THREE.Vector3());
const cityCanyon = canyonOffsetDir(cityDir);
const cityWater = officialOceanLevelAt(cityDir);
console.log(
  `    水晶城 lat −24 / lon −112：谷底偏移 ${cityCanyon.toFixed(3)}，` +
    `该处水位 ${cityWater.toFixed(3)}（基准 ${OFFICIAL_OCEAN_SEA_LEVEL}）→ 允许在基准海面之下`
);
assert.ok(cityCanyon < 0, "水晶城应位于峡谷内（谷底偏移为负），否则豁免就没有依据");
ok(`豁免名单 [${EXEMPT.join(", ")}]；水晶城确在谷内（偏移 ${cityCanyon.toFixed(3)}）`);

console.log("\n[4] 海面基线必须唯一（禁止第二份数字）");
// 2026-09-05 审计：officialOcean.js 写 0.72、procgen 链默认 0、runtime.js 硬编码 0，
// 同一世界两套水面高度 → 「是否在海面之上」取决于走了哪条分支。基线已收拢到
// world/seaLevel.js。这一项守住它不再分裂。
const { SEA_LEVEL, seaRadius, isAboveSea, islandLiftFor } = await import(
  new URL("world/seaLevel.js", SRC).href
);
assert.equal(
  OFFICIAL_OCEAN_SEA_LEVEL,
  SEA_LEVEL,
  `OFFICIAL_OCEAN_SEA_LEVEL(${OFFICIAL_OCEAN_SEA_LEVEL}) 必须等于基线 SEA_LEVEL(${SEA_LEVEL})`
);
assert.equal(seaRadius(R), SEA, "seaRadius(R) 必须等于 R + SEA_LEVEL");
// officialOcean.js 不得再自带数字
const oceanSrc = fs.readFileSync(
  fileURLToPath(new URL("world/waterV8/officialOcean.js", SRC)),
  "utf8"
);
assert.match(
  oceanSrc,
  /OFFICIAL_OCEAN_SEA_LEVEL\s*=\s*SEA_LEVEL/,
  "officialOcean.js 必须从 SEA_LEVEL 派生，不得写死数字"
);
assert.match(oceanSrc, /import\s*\{\s*SEA_LEVEL\s*\}/, "officialOcean.js 必须 import 基线");
// runtime.js 的水面编译不得再硬编码 seaLevel: 0
const runtimeSrc = fs.readFileSync(
  fileURLToPath(new URL("world/planetV8/runtime.js", SRC)),
  "utf8"
);
assert.ok(
  !/compileCurvedWater\(\{[^}]*seaLevel:\s*0[,\s}]/.test(runtimeSrc),
  "runtime.js 仍在给 compileCurvedWater 硬编码 seaLevel: 0 —— 会与 official ocean 形成两套水面"
);
assert.match(runtimeSrc, /seaLevel:\s*SEA_LEVEL/, "runtime.js 的水面编译应传基线");
// 方案 B 的助手：抬升量必须相对基线派生
assert.equal(islandLiftFor(SEA_LEVEL + 1, 0.4), 0, "已够高时不应再追加抬升");
assert.ok(islandLiftFor(0, 0.4) > SEA_LEVEL, "从 0 起要抬到基线以上");
assert.equal(isAboveSea(SEA_LEVEL), false, "恰好等于海面不算在海面之上");
assert.equal(isAboveSea(SEA_LEVEL + 1e-6), true, "略高于海面应算在海面之上");
ok(`基线唯一：SEA_LEVEL=${SEA_LEVEL}，海面半径 ${SEA.toFixed(2)}；两处旧数字已派生化`);

console.log(`\n全部通过：${pass} 项`);
