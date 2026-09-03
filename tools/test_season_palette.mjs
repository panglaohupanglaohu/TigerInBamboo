import assert from "node:assert";
import fs from "node:fs";
import {
  seasonTint,
  quantizeHex,
  SEASON_PALETTE,
} from "../TigerMessenger/src/world/seasonPalette.js";
import { SEASON_BANDS } from "../TigerMessenger/src/world/seasonBands.js";
import { stripComments } from "./lib/stripComments.mjs";

/** 纬度 → 单位球面坐标（经度固定，季相只看纬度） */
function posAtLat(latDeg, radius = 160) {
  const rad = (latDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius, z: 0 };
}

const channelDist = (a, b) =>
  Math.max(
    Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)),
    Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)),
    Math.abs((a & 0xff) - (b & 0xff))
  );

// 1. 纯数据层：不得 import three
const src = fs.readFileSync(new URL("../TigerMessenger/src/world/seasonPalette.js", import.meta.url), "utf8");
assert.ok(!/from\s+["']three["']/.test(stripComments(src)), "季相色板必须是纯数据，不得 import three");
assert.ok(!/new Date\(|Date\.now\(|getMonth\(/.test(stripComments(src)), "季相色板不得依赖时钟");

// 2. 每个季相都要有完整色板
for (const band of SEASON_BANDS) {
  const entry = SEASON_PALETTE[band.name];
  assert.ok(entry, `缺少季相色板：${band.name}`);
  for (const key of ["foliage", "ground", "tintStrength"]) {
    assert.ok(Number.isFinite(entry[key]), `${band.name}.${key} 非法`);
  }
  assert.ok(entry.tintStrength >= 0 && entry.tintStrength <= 1, `${band.name}.tintStrength 越界`);
}

// 3. 确定性：同一 pos 反复调用返回同一 hex
const p = posAtLat(56);
assert.equal(seasonTint(0x6d8f65, p, "ground"), seasonTint(0x6d8f65, p, "ground"));

// 4. pos 为空 → 原样返回（保持旧行为，回滚路径干净）
assert.equal(seasonTint(0x123456, null, "ground"), 0x123456);
assert.equal(seasonTint(0x123456, undefined, "foliage"), 0x123456);

// 5. 输出恒为合法 hex
for (let lat = -90; lat <= 90; lat += 1) {
  for (const ch of ["foliage", "ground"]) {
    const hex = seasonTint(0x6d8f65, posAtLat(lat), ch);
    assert.ok(Number.isInteger(hex) && hex >= 0 && hex <= 0xffffff, `hex 越界 @${lat}/${ch}: ${hex}`);
  }
}

// 6. 连续性：带边界两侧 ±0.1° 色差极小（无硬边）
for (const band of SEASON_BANDS) {
  if (!Number.isFinite(band.minLat)) continue;
  for (const ch of ["foliage", "ground"]) {
    const a = seasonTint(0x6d8f65, posAtLat(band.minLat + 0.1), ch);
    const b = seasonTint(0x6d8f65, posAtLat(band.minLat - 0.1), ch);
    assert.ok(channelDist(a, b) <= 4, `带边界色差过大 @${band.minLat}/${ch}: ${channelDist(a, b)}`);
  }
}

// 7. 地标之间必须肉眼可辨（否则季相白做）
const saihoji = seasonTint(0x6d8f65, posAtLat(56), "ground"); // 冬
const crystal = seasonTint(0x6d8f65, posAtLat(-24), "ground"); // 夏
assert.ok(channelDist(saihoji, crystal) >= 24, `苔庭与水晶城地被色差过小：${channelDist(saihoji, crystal)}`);

// 8. 量化：让邻近区块共享材质，防止染色顶高 draw call
assert.equal(quantizeHex(0x6d8f65, 16), quantizeHex(0x6d8f65 + 0x010101, 16));
const quantized = new Set();
for (let lat = -90; lat <= 90; lat += 0.5) {
  quantized.add(quantizeHex(seasonTint(0x6d8f65, posAtLat(lat), "ground"), 16));
}
assert.ok(quantized.size <= 24, `量化后色号仍过多（${quantized.size}），会打散材质共享`);

console.log(`test_season_palette: ok (量化后地被色号 ${quantized.size} 个)`);
