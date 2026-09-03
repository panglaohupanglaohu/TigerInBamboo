// =====================================================================
// 单台地边缘瀑布的数据模型验收（2026-09-02 主人定案）。
//
// 背景：五湖四帘绑死在五层台地上；台地塌缩成一层后没有中间落差可挂。
// 新形态是「从台地外沿直落海面」，并且可叠加——沿边缘摆任意多道，
// 每道只由方位角与宽度决定，互不依赖。
// =====================================================================
import assert from "node:assert/strict";
import {
  normalizeCitadelRimFalls,
  CITADEL_RIM_FALL_DEFAULTS,
} from "../TigerMessenger/src/world/odysseyCitadel.js";

// 1. 空输入 = 没有瀑布（单台地本身是合法形态）
assert.deepEqual(normalizeCitadelRimFalls(), []);
assert.deepEqual(normalizeCitadelRimFalls(null), []);

// 2. 可叠加：多道互不依赖，按方位角排序输出
const three = normalizeCitadelRimFalls([
  { azimuth: 2.0 },
  { azimuth: 0.17 },
  { azimuth: -1.1 },
]);
assert.equal(three.length, 3, "三道瀑布应全部保留");
assert.deepEqual(three.map((f) => f.azimuth), [-1.1, 0.17, 2.0], "按方位角排序");

// 3. 缺省字段回落到默认值
const [only] = normalizeCitadelRimFalls([{ azimuth: 0.5 }]);
assert.equal(only.arc, CITADEL_RIM_FALL_DEFAULTS.arc);
assert.equal(only.poolRadius, CITADEL_RIM_FALL_DEFAULTS.poolRadius);
assert.equal(only.flow, CITADEL_RIM_FALL_DEFAULTS.flow);

// 4. 同方位角去重：编辑器连点不得摆出两道重叠水帘（Z-fighting）
const dup = normalizeCitadelRimFalls([
  { id: "a", azimuth: 0.17, arc: 0.2 },
  { id: "b", azimuth: 0.17, arc: 0.9 },
]);
assert.equal(dup.length, 1, "同方位角只留一道");
assert.equal(dup[0].id, "a", "保留先到的那道");

// 5. 数值夹取：非法输入不得产出退化几何
const [clamped] = normalizeCitadelRimFalls([{ azimuth: 0, arc: 99, flow: -5, poolRadius: -3 }]);
assert.equal(clamped.arc, 1.2, "弧宽上限");
assert.equal(clamped.flow, 0.1, "水量下限，不得为负或 0");
assert.equal(clamped.poolRadius, 0, "潭半径不得为负；0 = 直接砸进海面");

// 6. poolRadius: 0 是合法值，不能被当成「缺省」而回落到默认
const [noPool] = normalizeCitadelRimFalls([{ azimuth: 0, poolRadius: 0 }]);
assert.equal(noPool.poolRadius, 0, "0 表示不做接水潭，必须保留");

// 7. 结果不可变：装配阶段不得就地改写规格
assert.ok(Object.isFrozen(three), "列表冻结");
assert.ok(Object.isFrozen(three[0]), "每道规格冻结");

// 8. 确定性：同输入同输出
assert.deepEqual(normalizeCitadelRimFalls([{ azimuth: 1 }, { azimuth: 0 }]),
  normalizeCitadelRimFalls([{ azimuth: 1 }, { azimuth: 0 }]));

console.log("✅ test_citadel_rim_falls");
