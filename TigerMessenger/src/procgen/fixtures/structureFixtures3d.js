// =====================================================================
//  六类结构 3D fixture：tower / foundation / roof / stairs / bridge /
//  support（V7-G5 · 纯数据）
//  · 水平面全部 "solid" 对称互联，竖直 U/D 走 "stack"；
//  · foundation 限地面层（maxFloor:0），tower 需要承重 ≥2 的下方
//    （requiresBelow "bearing>=2"），stairs 上下端必须接 floor portal，
//    bridge 悬挑（无 requiresBelow）；
//  · 附封死门 / 倒置屋顶不可解 fixture（原因码 door-blocked /
//    inverted-roof）。
// =====================================================================

const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });
const SIDES = Object.freeze({ N: F("solid"), E: F("solid"), S: F("solid"), W: F("solid") });
const proto = (id, family, faces, rules = {}, extra = {}) =>
  Object.freeze({
    id,
    family,
    weight: 1,
    orientationGroup: "NONE",
    faces: Object.freeze({ ...SIDES, ...faces }),
    rules: Object.freeze(rules),
    ...extra,
  });

export const V3_FOUNDATION = proto(
  "v.foundation",
  "foundation",
  { U: F("stack", { support: 2, portal: "floor-portal" }), D: F("stack", { support: 2 }) },
  { maxFloor: 0 },
  { tags: Object.freeze(["load-bearing"]) }
);
export const V3_SUPPORT = proto(
  "v.support",
  "support",
  { U: F("stack", { support: 2, portal: "floor-portal" }), D: F("stack", { support: 1 }) },
  {},
  { tags: Object.freeze(["load-bearing"]) }
);
export const V3_TOWER = proto(
  "v.tower",
  "tower",
  { U: F("stack", { support: 1 }), D: F("stack") },
  { requiresBelow: "bearing>=2" }
);
export const V3_BRIDGE = proto(
  "v.bridge",
  "bridge",
  { U: F("stack", { support: 0 }), D: F("stack") },
  {},
  { tags: Object.freeze(["cantilever"]) }
);
export const V3_STAIRS = proto(
  "v.stairs",
  "stairs",
  { U: F("stack", { support: 0, portal: "stair-flight" }), D: F("stack", { portal: "stair-flight" }) },
  { portalAbove: Object.freeze(["floor-portal"]), portalBelow: Object.freeze(["floor-portal"]) }
);
export const V3_ROOF = proto(
  "v.roof",
  "roof",
  { U: F("sky"), D: F("stack", { portal: "floor-portal" }) },
  { roof: true, minFloor: 1 }
);

/** 六类原型集合（fixture 全量） */
export const STRUCTURE3D_PROTOTYPES = Object.freeze([
  V3_FOUNDATION,
  V3_SUPPORT,
  V3_TOWER,
  V3_BRIDGE,
  V3_STAIRS,
  V3_ROOF,
]);

/**
 * 全原型覆盖求解 fixture：6 column × 3 层，pins 强制每类至少出现一次。
 * pins 全部满足预约束（支撑承重 / portal / 楼层谓词）。
 */
export const STRUCTURE3D_SOLVE = Object.freeze({
  width: 6,
  height: 3,
  depth: 1,
  pins: Object.freeze([
    // col0：地基 → 支架 → 塔（塔承重：支架 U support=2）
    Object.freeze({ cell: "v:0:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:0:1:0", variant: "v.support@r0" }),
    Object.freeze({ cell: "v:0:2:0", variant: "v.tower@r0" }),
    // col1：地基 → 塔（地基 U support=2）
    Object.freeze({ cell: "v:1:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:1:1:0", variant: "v.tower@r0" }),
    // col2：地基 → 楼梯 → 屋顶（portal 链：floor-portal ↔ stair-flight ↔ floor-portal）
    Object.freeze({ cell: "v:2:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:2:1:0", variant: "v.stairs@r0" }),
    Object.freeze({ cell: "v:2:2:0", variant: "v.roof@r0" }),
    // col3：地基 → 桥（悬挑） → 屋顶
    Object.freeze({ cell: "v:3:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:3:1:0", variant: "v.bridge@r0" }),
    Object.freeze({ cell: "v:3:2:0", variant: "v.roof@r0" }),
    // col4：支架落地 → 桥 → 屋顶
    Object.freeze({ cell: "v:4:0:0", variant: "v.support@r0" }),
    Object.freeze({ cell: "v:4:1:0", variant: "v.bridge@r0" }),
    Object.freeze({ cell: "v:4:2:0", variant: "v.roof@r0" }),
    // col5：地基 → 支架 → 屋顶
    Object.freeze({ cell: "v:5:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:5:1:0", variant: "v.support@r0" }),
    Object.freeze({ cell: "v:5:2:0", variant: "v.roof@r0" }),
  ]),
});

/** 封死门 fixture：门 E 面 doorway 被实体封死 → 原因码 door-blocked */
export const V3_DOOR = proto(
  "v.door",
  "door",
  {
    U: F("stack", { support: 0 }),
    D: F("stack"),
    E: F("open", { walkable: true, portal: "doorway" }),
  },
  {}
);
export const SEALED_DOOR_FIXTURE = Object.freeze({
  kind: "sealed-door",
  prototypes: Object.freeze([V3_FOUNDATION, V3_DOOR]),
  /** 1×1×3 行：实体 | 门 | 实体（门的 E 面被 foundation 封死） */
  graph: Object.freeze({ width: 3, height: 1, depth: 1 }),
  pins: Object.freeze([
    Object.freeze({ cell: "v:0:0:0", variant: "v.foundation@r0" }),
    Object.freeze({ cell: "v:1:0:0", variant: "v.door@r0" }),
    Object.freeze({ cell: "v:2:0:0", variant: "v.foundation@r0" }),
  ]),
  expectedCode: "door-blocked",
});

/** 倒置屋顶 fixture：U 面承重、D 面朝天的屋顶 → 原因码 inverted-roof */
export const V3_ROOF_INVERTED = proto(
  "v.roof-inverted",
  "roof",
  { U: F("stack", { support: 0 }), D: F("sky") },
  { roof: true }
);
export const INVERTED_ROOF_FIXTURE = Object.freeze({
  kind: "inverted-roof",
  prototypes: Object.freeze([V3_FOUNDATION, V3_ROOF_INVERTED]),
  graph: Object.freeze({ width: 1, height: 2, depth: 1 }),
  expectedCode: "inverted-roof",
});
