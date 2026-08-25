// =====================================================================
//  花砖/屋瓦装饰 demo fixture（V7-G4 · 纯数据）
//  证明 OverlappingModel2D 只做装饰层：结构层（SimpleTiled + pins：
//  门/支撑/玩法路径）与装饰层（overlapping pattern）是两个独立模型，
//  装饰求解不修改门、支撑和玩法路径。
// =====================================================================

const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });
const structural = (id, family, weight, extra = {}) => ({
  id,
  family,
  weight,
  orientationGroup: "NONE",
  faces: { N: F("c"), E: F("c"), S: F("c"), W: F("c") },
  ...extra,
});

/** 结构层：门 / 支撑 / 玩法路径全部由 pins 锁定，装饰层不得触碰 */
export const DECOR_STRUCTURE = Object.freeze({
  width: 4,
  height: 3,
  prototypes: Object.freeze([
    structural("castle.floor", "floor", 3, { tags: Object.freeze(["walkable"]) }),
    structural("castle.wall", "wall", 1),
    structural("castle.door", "door", 1, { tags: Object.freeze(["walkable"]) }),
    structural("castle.support", "support", 1, { tags: Object.freeze(["load-bearing"]) }),
    structural("castle.path", "path", 2, { tags: Object.freeze(["walkable"]) }),
  ]),
  /** 玩法硬约束：门、支撑、路径 */
  pins: Object.freeze([
    Object.freeze({ x: 0, y: 0, variant: "castle.door@r0", source: "door" }),
    Object.freeze({ x: 3, y: 0, variant: "castle.support@r0", source: "support" }),
    Object.freeze({ x: 1, y: 1, variant: "castle.path@r0", source: "path" }),
    Object.freeze({ x: 2, y: 1, variant: "castle.path@r0", source: "path" }),
  ]),
});

/** 装饰层：项目自有内联花砖/屋瓦色板样例（4×4，N=2 pattern 提取） */
export const DECOR_SAMPLE = Object.freeze({
  N: 2,
  labels: Object.freeze(["tile-red", "tile-blue", "tile-gold", "roof-a"]),
  sample: Object.freeze([
    Object.freeze(["tile-red", "tile-blue", "tile-red", "tile-blue"]),
    Object.freeze(["tile-blue", "tile-gold", "tile-gold", "tile-red"]),
    Object.freeze(["tile-red", "tile-gold", "roof-a", "roof-a"]),
    Object.freeze(["tile-blue", "tile-red", "roof-a", "roof-a"]),
  ]),
});

/** 装饰输出与结构 footprint 同尺寸 */
export const DECOR_OUTPUT = Object.freeze({ width: 4, height: 3 });
