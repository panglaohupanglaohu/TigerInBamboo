// =====================================================================
//  海面基线 —— 全世界唯一真源（2026-09-05）
//
//  ---------------------------------------------------------------
//  为什么要单独立这个文件
//  ---------------------------------------------------------------
//  2026-09-05 审计发现海面高度是**碎的**，同一个世界里并存两套基线：
//    · `waterV8/officialOcean.js` 的 OFFICIAL_OCEAN_SEA_LEVEL = 0.72
//    · procgen 链一律默认 `seaLevel = 0`
//      （planetCompilerV8 / curvedWaterCompiler / hydrologyFieldV10 /
//       planetFieldComposer），而 planetV8/runtime.js 还**硬编码**传了 0
//  于是「地标在不在海面之上」这个问题，答案取决于当时走的是哪条水面分支。
//
//  这正是本会话已经犯过三次的同一个病 —— 同一份事实抄成两份，迟早漂：
//    ① 编辑面板硬抄色值 vs 生产色板（选松石绿建出风化白石，15 字符 14 个对不上）
//    ② 六景 id 手抄 vs SAIHOJI_ZONES
//    ③ messengerIsland 硬抄 (56, -120) vs SAIHOJI_HUB
//  海面比那三个更要紧：主人的硬约束「除水晶城和湖沼外，其余地标必须在海面之上」
//  只有在基线唯一时才可判定。
//
//  ---------------------------------------------------------------
//  基线值的由来
//  ---------------------------------------------------------------
//  原值 0.72 与 `hills.js` 的 `ISLAND_BASE_LIFT = 0.6` 冲突 ——
//  整块主岛的平地面沉在海面下 0.12（旧港、月亮湖岸实测 r=160.600 < 160.72）。
//  书店镇当年靠单独打补丁（BOOKSHOP_OCEAN_ISLAND_LIFT = 3.2）才浮起来，
//  说明这个坑早被踩过，但只补了一个镇。
//
//  主人 2026-09-05 选**方案 C：降海平面 0.72 → 0.5**。
//  这是三个方案里唯一**不改变「岛面 0.6 / 湖面 0.78 / 轨面 0.78」既有高差**的做法
//  —— 那三个高差是调好的（涉水深度 0.18、枕木净空），动它们会连锁。
//
//  ---------------------------------------------------------------
//  余量（实测，node tools/test_landmarks_above_sea.mjs）
//  ---------------------------------------------------------------
//    主岛地面（旧港 / 月亮湖岸）  +0.100   ← 最薄，动 ISLAND_BASE_LIFT 前必看
//    西芳寺苔庭                  +0.300   （原 +0.080）
//    书店镇                      +5.500
//    水晶城                      谷内 −25.7（豁免：海水沿裂谷倾泻）
//
//  ⚠️ 主岛只剩 0.100 余量。将来给单个岛做「岛台抬升」（方案 B，会复用到很多场景）时，
//  **抬升量一律相对本基线计算**，不要再各自写死数字。
//
//  纯常量，禁止 import Three.js / DOM。
// =====================================================================

/**
 * 海面相对星球半径 R 的抬升。世界海面半径 = R + SEA_LEVEL。
 *
 * 改这个值等于改全球海岸线。改完必须跑：
 *   node tools/test_landmarks_above_sea.mjs
 */
export const SEA_LEVEL = 0.5;

/** 海面半径 = R + SEA_LEVEL */
export function seaRadius(planetRadius) {
  return planetRadius + SEA_LEVEL;
}

/**
 * 某地表抬升是否在海面之上。
 * @param {number} lift 相对 R 的地表抬升（如 groundLiftAt 的返回）
 * @param {number} [margin] 要求的最小余量
 */
export function isAboveSea(lift, margin = 0) {
  return lift > SEA_LEVEL + margin;
}

/**
 * 岛台抬升助手（方案 B 复用）：给定目标净空，算出该抬多高才能浮出海面。
 * 让每个岛的抬升量都**相对基线派生**，而不是各自写死。
 *
 * @param {number} baseLift 该地当前的地表抬升（如 ISLAND_BASE_LIFT）
 * @param {number} [clearance] 想要高出海面多少
 * @returns {number} 还需追加的抬升量（已够高则返回 0）
 */
export function islandLiftFor(baseLift, clearance = 0.4) {
  const need = SEA_LEVEL + clearance - baseLift;
  return need > 0 ? need : 0;
}

export const SEA_LEVEL_VERSION = 1;
