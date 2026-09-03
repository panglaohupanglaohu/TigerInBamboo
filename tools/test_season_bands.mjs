import assert from "node:assert";
import fs from "node:fs";
import { seasonAtLatitude, latitudeOf, SEASON_BANDS } from "../TigerMessenger/src/world/seasonBands.js";
import { stripComments } from "./lib/stripComments.mjs";

// 1. 无日历依赖 —— 代码里不许出现时钟调用（注释里提及不算）
const src = fs.readFileSync(new URL("../TigerMessenger/src/world/seasonBands.js", import.meta.url), "utf8");
assert.ok(!/new Date\(|Date\.now\(|getMonth\(/.test(stripComments(src)), "季相不得依赖时钟");

// 2. 地标落带（数值来自 saihoji.js / citadelRange.js / citySeaLake.js / canyon.js）
assert.equal(seasonAtLatitude(62).name, "winter", "三重门 +62");
assert.equal(seasonAtLatitude(56).name, "winter", "苔庭 +56");
assert.equal(seasonAtLatitude(24.1).name, "autumn", "高山圣城 +24.1");
assert.equal(seasonAtLatitude(-24).name, "summer", "水晶城 −24");
assert.equal(seasonAtLatitude(-50).name, "spring", "峡谷 −50");

// 3. 纯函数：同输入同输出
assert.deepEqual(seasonAtLatitude(30), seasonAtLatitude(30));

// 4. 全纬度无 NaN、blend 恒在 [0,1]
for (let lat = -90; lat <= 90; lat += 0.5) {
  const s = seasonAtLatitude(lat);
  assert.ok(SEASON_BANDS.some((b) => b.name === s.name), `未知季相 @${lat}`);
  assert.ok(Number.isFinite(s.blend), `blend 非有限值 @${lat}`);
  assert.ok(s.blend >= 0 && s.blend <= 1, `blend 越界 @${lat}: ${s.blend}`);
}

// 5. 单调性：纬度下降 index 不回头（纵穿 = 一个轮回，不来回跳）
let prev = -1;
for (let lat = 90; lat >= -90; lat -= 0.5) {
  const i = seasonAtLatitude(lat).index;
  assert.ok(i >= prev, `季相带回头 @${lat}`);
  prev = i;
}

// 6. 过渡连续：带边界两侧 blend 不得跳变
for (const band of SEASON_BANDS) {
  if (!Number.isFinite(band.minLat)) continue;
  const above = seasonAtLatitude(band.minLat + 0.05).blend;
  const below = seasonAtLatitude(band.minLat - 0.05).blend;
  assert.ok(Math.abs(above - 1) < 0.05, `下边界处应完全过渡到下一带 @${band.minLat}: ${above}`);
  assert.ok(below <= 1 && below >= 0, `跨界后 blend 越界 @${band.minLat}`);
}

// 7. 边界安全
assert.ok(Number.isFinite(latitudeOf({ x: 0, y: 0, z: 0 })), "零向量不得 NaN");
assert.equal(latitudeOf({ x: 0, y: 5, z: 0 }), 90, "正北极 = +90");
assert.equal(latitudeOf({ x: 0, y: -5, z: 0 }), -90, "正南极 = −90");
assert.ok(Number.isFinite(latitudeOf(null)), "null 不得 NaN");

console.log("test_season_bands: ok");
