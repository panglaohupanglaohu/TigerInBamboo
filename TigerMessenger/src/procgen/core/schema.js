// =====================================================================
//  Procgen 引擎 schema 常量与随机流约定（V7-G0）
//  纯数据，禁止 import Three.js / DOM。
//  所有 V7 产物（module set、field、mesh、snapshot）都必须携带这些版本号，
//  版本不匹配时缓存自动失效，不污染存档。
// =====================================================================

/** 引擎整体协议版本（worker job request/result、编译图结构） */
export const PROCGEN_ENGINE_SCHEMA_VERSION = 1;
/** WFC 模块模型 schema（ModulePrototype/ModuleVariant/兼容表） */
export const WFC_MODEL_SCHEMA_VERSION = 1;
/** 标量场 / SDF / chunk 数据 schema */
export const FIELD_SCHEMA_VERSION = 1;
/** Marching Cubes 索引网格输出 schema */
export const MC_MESH_SCHEMA_VERSION = 1;

/** Golden seeds：与 V6 constraintSolver.GOLDEN_SEEDS 同源，V7 全阶段回归固定使用 */
export const GOLDEN_SEEDS = Object.freeze([1, 7, 42, 884]);

/**
 * RNG 流名约定：同一 master seed 下按用途派生互不干扰的子随机流。
 * 禁止在求解热循环中直接消耗其它流的随机数。
 */
export const RNG_STREAMS = Object.freeze([
  "blueprint", // 蓝图规范化 / 默认布局
  "wfc", // WFC 观察、加权选择、tie-break
  "repair", // 全局 validator 局部修复重解
  "field", // 地形场扰动 / SDF 组合
  "props", // prop 放置、洗牌
  "combat", // 战斗模拟（与 V2 combatEvents 共用语义）
]);

/** V7 能力等级（与 V6 台账一致，禁止跳级） */
export const DELIVERY_LEVELS = Object.freeze([
  "DEFINED",
  "TESTED",
  "WIRED",
  "DEFAULT_ON",
  "VISUAL_ACCEPTED",
  "PERF_ACCEPTED",
]);

/** 生成 schema 版本指纹（写入产物 hash，版本变化必失效缓存） */
export function schemaVersionStamp() {
  return `p${PROCGEN_ENGINE_SCHEMA_VERSION}/w${WFC_MODEL_SCHEMA_VERSION}/f${FIELD_SCHEMA_VERSION}/m${MC_MESH_SCHEMA_VERSION}`;
}
