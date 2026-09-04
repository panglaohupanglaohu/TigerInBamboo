// =====================================================================
// 木马唯一性验收（2026-09-03，主人定案：只要一匹，浮在水上）
//
// 前史：9/2 因「存档非空即以存档为准」木马被挤掉，加了常驻地貌木马兜底。
// 但那匹站在城堡门前，把故事场景挡在城堡背后。现在故事木马由
// placeNavonaPlaza 浮在旧港边水面上，常驻那匹就成了多余的第二匹。
//
// 这条测试守两件事：装载路径不得再注入常驻木马；广场必须被摆出来。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../TigerMessenger/src/${p}`, import.meta.url), "utf8");
const loadCitadel = read("scenes/messenger/loadCitadel.js");
const range = read("world/citadelRange.js");
const editor = read("ui/citadelEditorPanel.js");

// 1. 装载路径不得再注入常驻木马——否则城堡门前会多出第二匹
assert.doesNotMatch(loadCitadel, /^\s*citadelTerrainObjects\s*=\s*withResidentTrojanHorse\(/m,
  "已改为单匹：loadCitadel 不得再注入常驻地貌木马");
assert.doesNotMatch(loadCitadel, /import\s*\{[^}]*withResidentTrojanHorse/,
  "不再调用就不该还留着 import");

// 2. 广场必须真的被摆出来（它是唯一那匹木马的来源，也是部队集结点）
assert.match(loadCitadel, /citadelRange\.placeNavonaPlaza\(/,
  "placeNavonaPlaza 必须有调用点——只定义不调用等于没摆");

// 3. 广场坐标必须由旧港实位反解，不得写死
const call = loadCitadel.match(/citadelRange\.placeNavonaPlaza\(([^;]*)\)/)?.[1] ?? "";
assert.doesNotMatch(call, /-?\d+\.\d+\s*,\s*-?\d+\.\d+/,
  `广场坐标不得硬编码（snapOldHarborToSeaCove 改港口位置后会失配）：${call.trim()}`);
assert.match(loadCitadel, /rangeWorldToLocal\(\s*harbor\./,
  "广场位置须由 harbor 世界坐标反解到 range 局部系");

// 4. 木马位置必须跟着广场走，不得写死局部坐标
assert.doesNotMatch(range, /rangeLocalToWorld\(10\.8,\s*31\.5/,
  "谷地模式木马坐标已改为按广场推导，写死的 (10.8, 31.5) 不该再出现");
assert.match(range, /HORSE_PLAZA_ALONG|HORSE_PLAZA_SIDE/,
  "木马偏移量须具名，便于调");

// 5. 浮在水上：抬升量与 water 语义不得被改掉
assert.match(range, /HORSE_LAKE_CLEARANCE\s*=\s*[\d.]+/, "浮水抬升量必须保留");
assert.match(range, /surface:\s*"water"/, "木马 placement.surface 必须是 water——主人要它浮着");

// 6. 谷地模式朝向城堡，不再偏转 90° 去看运河
assert.match(range, /latestValleyMode\s*\?\s*waterfallYaw\s*:\s*waterfallYaw\s*-\s*Math\.PI\s*\/\s*2/,
  "谷地模式必须直指基准目标（城堡），历史模式保留 -90° 偏转");
assert.match(range, /facing:\s*latestValleyMode\s*\?\s*"castle"/,
  "placement.facing 必须记录朝向城堡");

// 7. 编辑器仍不得删掉木马（9/2 的老要求，继续守）
assert.match(editor, /\?\.type === "trojanHorse"[\s\S]{0,200}return false;/,
  "编辑器删除入口必须拒绝木马，否则 UI 显示已删、刷新又回来");

console.log("✅ test_single_trojan_horse");
