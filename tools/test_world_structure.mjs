// =====================================================================
// 球形世界四级空间结构（Planet → Region → Landmark → Zone）
// 用法：node tools/test_world_structure.mjs
//
// 守的是**结构不变量**，刻意不写会因合法调整而红的数值：
// 改配色、改区域名、往 far-nature 里填地标，都不该把这条打红；
// 但漏一景、地标归属两个区域、mobile 区域存了快照，必须红。
//
// 参考教训：test_shot_harness_runtime 曾把 cache 标签字面量写进断言，
// 于是每次合法 bump 都变红，红久了就被当噪声。别写那种断言。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// three 桥接：Node 测试读它，干净 checkout 上不存在要先补
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
  LANDMARK_TIER,
  REGION_KIND,
  WORLD_REGIONS,
  WORLD_LANDMARKS,
  SAIHOJI_LOCAL_LANDMARKS,
  SAIHOJI_REGION_ID,
  allLandmarks,
  regionOfLandmark,
  landmarksOfRegion,
  regionById,
  angularDistance,
  resolveWorldLandmarks,
  locateWorldContext,
  visibleLandmarks,
  describeWorldStructure,
} = await import(new URL("world/worldStructure.js", SRC).href);
const { SAIHOJI_ZONES } = await import(new URL("world/saihoji.js", SRC).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 地标归属：每个 Tier0/1 属于恰好一个 region");
const regionIds = new Set(WORLD_REGIONS.map((r) => r.id));
for (const lm of WORLD_LANDMARKS) {
  assert.ok(regionIds.has(lm.region), `${lm.id} 的 region "${lm.region}" 不在区域表里`);
  const owning = WORLD_REGIONS.filter((r) => r.members.includes(lm.id));
  assert.equal(
    owning.length,
    1,
    `${lm.id} 必须被恰好一个 region 的 members 收录，实际 ${owning.length} 个：${owning.map((r) => r.id)}`
  );
  assert.equal(
    owning[0].id,
    lm.region,
    `${lm.id} 声明 region=${lm.region}，但被 ${owning[0].id}.members 收录 —— 两处不一致`
  );
}
// 六景全部属于 saihoji
for (const lm of SAIHOJI_LOCAL_LANDMARKS) {
  assert.equal(lm.region, SAIHOJI_REGION_ID, `景区 ${lm.id} 必须属于 ${SAIHOJI_REGION_ID}`);
  assert.equal(lm.parent, SAIHOJI_REGION_ID, `景区 ${lm.id} 的 parent 必须是 ${SAIHOJI_REGION_ID}`);
  assert.equal(lm.tier, LANDMARK_TIER.LOCAL, `景区 ${lm.id} 必须是 Tier2`);
}
// id 全局唯一（Tier0 的 saihoji 与区域同名是有意的，但地标 id 之间不得重名）
const ids = allLandmarks().map((lm) => lm.id);
assert.equal(new Set(ids).size, ids.length, `地标 id 有重复：${ids.join(",")}`);
ok(`${WORLD_LANDMARKS.length} 个 Tier0/1 归属唯一；${SAIHOJI_LOCAL_LANDMARKS.length} 景全属 ${SAIHOJI_REGION_ID}；id 无重名`);

console.log("[2] 六景与 SAIHOJI_ZONES 完全一致（禁止手抄）");
const zoneIds = SAIHOJI_ZONES.map((z) => z.id);
const localIds = SAIHOJI_LOCAL_LANDMARKS.map((lm) => lm.id);
assert.deepEqual(
  localIds,
  zoneIds,
  `六景必须从 SAIHOJI_ZONES 派生（含顺序）。\n  声明=${localIds.join(",")}\n  真源=${zoneIds.join(",")}`
);
for (const zone of SAIHOJI_ZONES) {
  const lm = SAIHOJI_LOCAL_LANDMARKS.find((l) => l.id === zone.id);
  assert.equal(lm.name, zone.name, `${zone.id} 的名字必须跟随真源（${lm.name} ≠ ${zone.name}）`);
  assert.equal(lm.localRadius, zone.radius, `${zone.id} 的 localRadius 必须跟随真源`);
}
// 上面的 deepEqual 守的是「不得手抄」；但派生表和真源同源，**删一景两边会一起变**，
// 光靠它抓不到丢景。所以再锁一次契约：西芳寺「六景」是固定的文化集合
// （入口苔径 / 主石之庭 / 枯瀑之庭 / 苔海岛群 / 空庭 / 回望石组），
// 不是可调参数。真要增删景区，是设计变更，得连这条断言一起改并说明理由。
const CANONICAL_SIX = Object.freeze([
  "moss-entry",
  "master-stones",
  "dry-cascade",
  "moss-islands",
  "empty-court",
  "return-view",
]);
assert.equal(zoneIds.length, CANONICAL_SIX.length, `西芳寺应为六景，实际 ${zoneIds.length}：${zoneIds.join(",")}`);
for (const id of CANONICAL_SIX) {
  assert.ok(zoneIds.includes(id), `六景缺了 ${id}`);
  assert.ok(localIds.includes(id), `派生表缺了 ${id}`);
}
ok(`${zoneIds.length} 景 id/name/radius 全部跟随 SAIHOJI_ZONES，且六景齐全`);

console.log("[3] mobile 区域必须惰性（不得存快照）");
const saihojiRegion = regionById(SAIHOJI_REGION_ID);
assert.equal(saihojiRegion.kind, REGION_KIND.MOBILE, "西芳寺必须标为 mobile —— 它骑在会动的白鲸上");
// 可变 stub：模拟白鲸游走后 handle 里的方向变了
const movingZone = { pathDirection: { x: 1, y: 0, z: 0 } };
const stubSaihoji = { landmarks: { zones: { [zoneIds[0]]: movingZone } } };
const resolvedMobile = resolveWorldLandmarks({ saihoji: stubSaihoji });
const saihojiEntry = resolvedMobile.find((lm) => lm.id === SAIHOJI_REGION_ID);
assert.equal(typeof saihojiEntry.getDir, "function", "getDir 必须是函数");
const before = saihojiEntry.getDir();
assert.deepEqual({ x: before.x, y: before.y, z: before.z }, { x: 1, y: 0, z: 0 });
// 鲸游走：改 handle，不重新 resolve
movingZone.pathDirection = { x: 0, y: 0, z: 1 };
const after = saihojiEntry.getDir();
assert.deepEqual(
  { x: after.x, y: after.y, z: after.z },
  { x: 0, y: 0, z: 1 },
  "getDir 必须每次重读 handle；返回旧值说明存了快照，鲸游走后导航会指错方向"
);
ok("saihoji 标为 mobile；getDir 跟随 handle 变化，无快照");

console.log("[4] 可见性规则：Tier0 恒显 / Tier1 进区域 / Tier2 进苔庭");
// 造一批方向互相分开的 stub，避免定位判定互相干扰
const dirOf = (x, y, z) => ({ x, y, z, lengthSq: () => x * x + y * y + z * z });
const stubMessenger = {
  landmarks: {
    camp: { landmarks: { anchor: { position: dirOf(1, 0, 0) } } },
    boat: { position: dirOf(0.98, 0.2, 0) },
    moebius: { grand: { dir: dirOf(0.95, 0, 0.3) } },
    odysseyCitadel: { position: dirOf(0, 1, 0) },
    bookshop: { position: dirOf(0.99, 0.1, 0.1) },
    citySeaLake: { centerDir: dirOf(0.97, 0.15, 0.2) },
    abandonedGate: { userData: { seatRoot: { position: dirOf(0.1, 0.99, 0) } } },
    moonLake: { centerWorld: dirOf(0, 0, 1) },
  },
};
const zonesStub = {};
for (const z of SAIHOJI_ZONES) zonesStub[z.id] = { pathDirection: dirOf(-1, 0, 0) };
const resolved = resolveWorldLandmarks({
  messenger: stubMessenger,
  saihoji: { landmarks: { zones: zonesStub } },
});
assert.equal(resolved.length, WORLD_LANDMARKS.length + SAIHOJI_ZONES.length);

// 星球尺度（远离一切）：只见 Tier0
const farAway = visibleLandmarks(resolved, { regionId: null, localId: null });
assert.equal(
  farAway.length,
  WORLD_LANDMARKS.filter((lm) => lm.tier === LANDMARK_TIER.WORLD).length,
  `星球尺度只该见 Tier0，实际 ${farAway.map((l) => l.id)}`
);
assert.ok(farAway.every((lm) => lm.tier === LANDMARK_TIER.WORLD), "星球尺度不得混入 Tier1/2");

// 给定 region：出现该区的 Tier1，别的区不出现
const inCoast = visibleLandmarks(resolved, { regionId: "coast-civil", localId: null });
const coastT1 = landmarksOfRegion("coast-civil", LANDMARK_TIER.REGION).map((l) => l.id);
for (const id of coastT1) {
  assert.ok(inCoast.some((lm) => lm.id === id), `进入 coast-civil 应出现 ${id}`);
}
assert.ok(!inCoast.some((lm) => lm.id === "gate"), "在 coast-civil 不该看到山地圣域的叹息之门");
assert.ok(!inCoast.some((lm) => lm.tier === LANDMARK_TIER.LOCAL), "没进苔庭不得出现六景");

// 给定 local：六景全出
const inGarden = visibleLandmarks(resolved, { regionId: SAIHOJI_REGION_ID, localId: zoneIds[0] });
for (const id of zoneIds) {
  assert.ok(inGarden.some((lm) => lm.id === id), `进入苔庭应出现景区 ${id}`);
}
ok(`Tier0=${farAway.length} 恒显；coast-civil 补 [${coastT1.join(",")}]；苔庭补 ${zoneIds.length} 景`);

console.log("[5] 绑定容错：handle 缺失不抛");
const empty = resolveWorldLandmarks({});
assert.equal(empty.length, WORLD_LANDMARKS.length + SAIHOJI_ZONES.length, "声明条目数不应因缺 handle 而变");
for (const lm of empty) {
  assert.equal(lm.getDir(), null, `${lm.id} 缺 handle 时 getDir 应返回 null 而不是抛错`);
}
// 只加载 saihoji（?scene=saihoji）时 messenger 为空，不该崩
const onlyGarden = resolveWorldLandmarks({ saihoji: { landmarks: { zones: zonesStub } } });
assert.equal(onlyGarden.find((lm) => lm.id === "camp").getDir(), null, "messenger 缺失时 camp 应为 null");
assert.ok(onlyGarden.find((lm) => lm.id === zoneIds[0]).getDir(), "saihoji 在时六景应可取向");
// 定位在空数据下也不该抛
assert.deepEqual(locateWorldContext(null, empty), { regionId: null, localId: null });
assert.deepEqual(locateWorldContext(dirOf(1, 0, 0), []), { regionId: null, localId: null });
ok("resolveWorldLandmarks({}) / locateWorldContext(null) 均不抛，getDir 全为 null");

console.log("[6] 定位：角距与 region/local 判定自洽");
assert.equal(angularDistance(dirOf(1, 0, 0), dirOf(1, 0, 0)), 0);
assert.ok(Math.abs(angularDistance(dirOf(1, 0, 0), dirOf(0, 1, 0)) - Math.PI / 2) < 1e-9);
assert.equal(angularDistance(dirOf(1, 0, 0), null), Infinity, "取不到方向应为 Infinity 而不是 NaN");
assert.equal(angularDistance(dirOf(0, 0, 0), dirOf(1, 0, 0)), Infinity, "零向量应为 Infinity");
// 站在营地：region = coast-civil
const atCamp = locateWorldContext(dirOf(1, 0, 0), resolved);
assert.equal(atCamp.regionId, "coast-civil", `站在营地应判为 coast-civil，实际 ${atCamp.regionId}`);
assert.equal(atCamp.localId, null, "营地不在任何景区内");
// 站在高山圣城：region = highland-sanctum
const atCitadel = locateWorldContext(dirOf(0, 1, 0), resolved);
assert.equal(atCitadel.regionId, "highland-sanctum", `站在圣城应判为 highland-sanctum，实际 ${atCitadel.regionId}`);
// 站在苔庭：local 命中，且 region 自动补成 saihoji
const atGarden = locateWorldContext(dirOf(-1, 0, 0), resolved);
assert.equal(atGarden.localId, zoneIds[0], `站在苔庭应命中景区，实际 ${atGarden.localId}`);
assert.equal(atGarden.regionId, SAIHOJI_REGION_ID, "命中景区时 region 必须补成 saihoji");
ok(`营地→coast-civil · 圣城→highland-sanctum · 苔庭→${SAIHOJI_REGION_ID}/${atGarden.localId}`);

console.log("[7] far-nature 空壳保留");
const far = regionById("far-nature");
assert.ok(far, "far-nature 区域必须存在（标记世界还没长出来的那一半）");
assert.equal(far.members.length, 0, "far-nature 目前应为空；填了地标要同步更新文档 §6");
ok("far-nature 保留为空壳");

console.log("[8] 生产接线：main.js 不得再手写平铺地标");
// 行为级/结构级断言，不依赖内部函数签名——同机另一个 agent 会话重构了
// cornerAssembly.js 两次，这类断言才扛得住对方改动。
const mainSrc = fs.readFileSync(fileURLToPath(new URL("main.js", SRC)), "utf8");
assert.match(
  mainSrc,
  /import\s*\{[\s\S]*?resolveWorldLandmarks[\s\S]*?\}\s*from\s*"\.\/world\/worldStructure\.js/,
  "main.js 必须从 worldStructure.js 取地标"
);
assert.match(mainSrc, /getVisible:\s*\(\)\s*=>/, "main.js 必须把三级可见集接进小地图");
assert.match(mainSrc, /visibleLandmarks\(/, "main.js 必须用 visibleLandmarks 过滤");
assert.match(mainSrc, /locateWorldContext\(/, "main.js 必须用 locateWorldContext 定位");
// 手写平铺的痕迹：旧代码把中文名直接写在 main.js 的数组里
for (const name of ["书店镇", "出发营地", "白鲸海水湖", "叹息之门"]) {
  assert.ok(
    !mainSrc.includes(`name: "${name}"`),
    `main.js 仍手写着地标 "${name}" —— 名字应只在 worldStructure.js / SAIHOJI_ZONES 里出现一份`
  );
}
const minimapSrc = fs.readFileSync(fileURLToPath(new URL("ui/minimap.js", SRC)), "utf8");
assert.match(minimapSrc, /getVisible/, "minimap 必须支持可变可见集");
assert.match(minimapSrc, /function\s+syncLegend/, "minimap 图例必须能在可见集变化时重建");
ok("main.js 走 worldStructure；minimap 支持可变可见集与图例重建");

console.log(`\n全部通过：${pass} 项`);
console.log(describeWorldStructure());
