// =====================================================================
//  V5 光照 · K6 轮廓实验开关（TODO 564）
//  草 / 屋顶 / 台阶 / 士兵 四类资产 × background-contrast / depth 两版
//  轮廓实验。纯数据 + 校验函数；GPU 着色器实现不属于本任务（后续在
//  onBeforeCompile patch 中读取本配置，默认全关 = 现状不变）。
//  设计原则（TODO 564）：同类内部边缘弱、对天空/悬崖边缘强
//  → 校验规则 internalEdge <= silhouetteEdge。
// =====================================================================

export const OUTLINE_EXPERIMENT_CLASSES = Object.freeze(["grass", "roof", "steps", "soldier"]);
export const OUTLINE_EXPERIMENT_VARIANTS = Object.freeze(["background-contrast", "depth"]);

// 单元格默认值：关闭；内部边缘弱、轮廓（对天空/悬崖）边缘强
const DEFAULT_CELL = Object.freeze({
  enabled: false,
  internalEdge: 0.15, // 同类内部边缘强度 [0,1]
  silhouetteEdge: 0.9, // 对天空/悬崖轮廓边缘强度 [0,1]
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const k of Object.keys(value)) deepFreeze(value[k]);
    Object.freeze(value);
  }
  return value;
}

function defaultMatrix() {
  const m = {};
  for (const cls of OUTLINE_EXPERIMENT_CLASSES) {
    m[cls] = {};
    for (const variant of OUTLINE_EXPERIMENT_VARIANTS) {
      m[cls][variant] = { ...DEFAULT_CELL };
    }
  }
  return m;
}

/** 出厂配置：四类 × 两版全部关闭（深冻结，作为共享基线）。 */
export const OUTLINE_EXPERIMENTS = deepFreeze(defaultMatrix());

/**
 * 校验轮廓实验配置。
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOutlineExperiments(config) {
  const errors = [];
  if (!config || typeof config !== "object") return { ok: false, errors: ["config must be an object"] };
  for (const key of Object.keys(config)) {
    if (!OUTLINE_EXPERIMENT_CLASSES.includes(key)) errors.push(`unknown class: ${key}`);
  }
  for (const cls of OUTLINE_EXPERIMENT_CLASSES) {
    const row = config[cls];
    if (!row || typeof row !== "object") {
      errors.push(`missing class row: ${cls}`);
      continue;
    }
    for (const key of Object.keys(row)) {
      if (!OUTLINE_EXPERIMENT_VARIANTS.includes(key)) errors.push(`unknown variant: ${cls}.${key}`);
    }
    for (const variant of OUTLINE_EXPERIMENT_VARIANTS) {
      const cell = row[variant];
      if (!cell || typeof cell !== "object") {
        errors.push(`missing cell: ${cls}.${variant}`);
        continue;
      }
      if (typeof cell.enabled !== "boolean") errors.push(`${cls}.${variant}.enabled must be boolean`);
      for (const field of ["internalEdge", "silhouetteEdge"]) {
        const v = cell[field];
        if (typeof v !== "number" || !(v >= 0 && v <= 1)) errors.push(`${cls}.${variant}.${field} must be in [0,1]`);
      }
      // TODO 564 原则：同类内部边缘弱、对天空/悬崖边缘强
      if (
        typeof cell.internalEdge === "number" &&
        typeof cell.silhouetteEdge === "number" &&
        cell.internalEdge > cell.silhouetteEdge
      ) {
        errors.push(`${cls}.${variant}: internalEdge must be <= silhouetteEdge`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 以出厂全关配置为底，合并 overrides（深合并到单元格），校验后深冻结返回。
 * 不修改 OUTLINE_EXPERIMENTS。
 */
export function createOutlineExperimentConfig(overrides = {}) {
  const merged = defaultMatrix();
  for (const cls of Object.keys(overrides ?? {})) {
    if (!merged[cls]) throw new Error(`unknown outline experiment class: ${cls}`);
    for (const variant of Object.keys(overrides[cls] ?? {})) {
      if (!merged[cls][variant]) throw new Error(`unknown outline experiment variant: ${cls}.${variant}`);
      Object.assign(merged[cls][variant], overrides[cls][variant]);
    }
  }
  const verdict = validateOutlineExperiments(merged);
  if (!verdict.ok) throw new Error(`invalid outline experiments: ${verdict.errors.join("; ")}`);
  return deepFreeze(merged);
}

/** 查询某类资产某版实验是否开启；未知 cls/variant 一律视为关闭。 */
export function isOutlineExperimentEnabled(config, cls, variant) {
  return config?.[cls]?.[variant]?.enabled === true;
}
