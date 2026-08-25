// =====================================================================
// 命名语义集（V7-G7 / TODO 1180）
// MC 顶点语义通道（Uint8Array）只存 id；名称↔id 映射在此唯一锁定，
// 渲染、切片导出、material group 统一引用，禁止各模块自行编号。
// =====================================================================

export const SEMANTIC_NAMES = Object.freeze([
  "none", "grass", "cliff", "shore", "canal-bed", "foundation", "moss", "waterfall",
]);

export const SEMANTIC_IDS = Object.freeze(Object.fromEntries(SEMANTIC_NAMES.map((name, id) => [name, id])));

export function semanticId(name) {
  const id = SEMANTIC_IDS[name];
  if (id === undefined) throw new Error(`unknown semantic name: ${name}`);
  return id;
}

export function semanticName(id) {
  if (!Number.isInteger(id) || id < 0 || id >= SEMANTIC_NAMES.length) throw new Error(`unknown semantic id: ${id}`);
  return SEMANTIC_NAMES[id];
}

// 调试可视化/切片导出的稳定色板（RGB 0-255），顺序与 SEMANTIC_NAMES 一致
export const SEMANTIC_COLORS = Object.freeze([
  [32, 32, 32],     // none
  [86, 176, 80],    // grass
  [150, 142, 133],  // cliff
  [214, 196, 152],  // shore
  [58, 96, 140],    // canal-bed
  [170, 170, 176],  // foundation
  [70, 130, 90],    // moss
  [90, 160, 220],   // waterfall
]);
