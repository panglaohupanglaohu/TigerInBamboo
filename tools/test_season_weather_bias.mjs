import assert from "node:assert/strict";
import fs from "node:fs";
import { createSeasonWeatherBias, SEASON_WEATHER_MAP } from "../TigerMessenger/src/world/seasonWeatherBias.js";
import { stripComments } from "./lib/stripComments.mjs";

// 1. 无日历依赖
const src = fs.readFileSync(new URL("../TigerMessenger/src/world/seasonWeatherBias.js", import.meta.url), "utf8");
assert.ok(!/new Date\(|Date\.now\(|getMonth\(/.test(stripComments(src)), "不得依赖时钟");

// 2. 状态机防抖测试：在边界快速来回切换，active 不得抽风
const bias = createSeasonWeatherBias({ initialSeason: "summer", hysteresisSec: 3.0 });
const mockP = { weather: 0, weatherLocked: false };

assert.equal(bias.getActiveSeason(), "summer");

// 模拟在边界来回挪动（每次停留 0.5 秒，不足 3 秒）
for (let i = 0; i < 10; i++) {
  bias.update(0.5, "winter", mockP);
  bias.update(0.5, "summer", mockP);
}
assert.equal(bias.getActiveSeason(), "summer", "未满 3 秒防抖，不应触发切换");
assert.equal(mockP.weather, 0, "天气不应被短时抖动改变");

// 3. 稳定进入新季相满 3 秒后触发切换
bias.update(1.0, "winter", mockP);
bias.update(1.0, "winter", mockP);
bias.update(1.1, "winter", mockP);
assert.equal(bias.getActiveSeason(), "winter", "满 3 秒应切换为 winter");
assert.equal(mockP.weather, SEASON_WEATHER_MAP.winter, "天气应自动偏置为雪 (2)");

// 4. weatherLocked 手动锁定时不覆盖
mockP.weatherLocked = true;
mockP.weather = 0; // 手动强制晴天
bias.update(3.5, "spring", mockP);
assert.equal(bias.getActiveSeason(), "spring", "季相状态仍正常推进");
assert.equal(mockP.weather, 0, "锁定时不得覆盖玩家手动选择的天气");

console.log("test_season_weather_bias: ok");
