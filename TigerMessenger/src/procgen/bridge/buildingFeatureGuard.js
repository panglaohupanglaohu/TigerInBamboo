// =====================================================================
// 建筑特征保护断言（V7-G9，TODO 1214）
// 清晰建筑主体继续走 family builder；MC terrain 不得覆盖门/窗/阳台/屋顶。
// 纯数据层：在 feature 采样点上检查 terrain field 值必须为「外部」（> iso）。
// =====================================================================

// 特征类别：门 / 窗 / 阳台 / 屋顶（kind 字面值锁定，schema 稳定）
export const MODULE_FEATURE_KINDS = Object.freeze(["door", "casement", "balcony", "roof"]);

function featureSamplePoints(feature) {
  if (Array.isArray(feature.points) && feature.points.length) return feature.points;
  if (Array.isArray(feature.position)) return [feature.position];
  if (feature.aabb?.min && feature.aabb?.max) {
    const { min, max } = feature.aabb;
    const points = [];
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) points.push([x, y, z]);
    points.push(min.map((v, i) => (v + max[i]) / 2));
    return points;
  }
  throw new Error(`feature ${feature?.id ?? "?"} needs position/aabb/points`);
}

/**
 * 返回 { ok, issues }；feature 任一点落入 MC 实体（field < isoLevel）
 * 即记 mc-covers-feature。field 外按「空气」（outside=+1）处理，不误报。
 */
export function auditModuleFeatureClearance({ field, features, isoLevel = 0 } = {}) {
  if (!field?.sampleWorld) throw new Error("auditModuleFeatureClearance requires a ScalarField-like input");
  const issues = [];
  for (const feature of features || []) {
    if (!MODULE_FEATURE_KINDS.includes(feature?.kind)) {
      issues.push({ code: "unknown-feature-kind", featureId: feature?.id ?? null, moduleId: feature?.moduleId ?? null, kind: feature?.kind ?? null });
      continue;
    }
    for (const point of featureSamplePoints(feature)) {
      const value = field.sampleWorld(point, 1);
      if (value < isoLevel) {
        issues.push({ code: "mc-covers-feature", featureId: feature.id ?? null, moduleId: feature.moduleId ?? null, kind: feature.kind, position: point.slice(), value });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

export function assertModuleFeaturesClear(args) {
  const audit = auditModuleFeatureClearance(args);
  if (!audit.ok) {
    const error = new Error(`mc-covers-feature: ${audit.issues.length}`);
    error.code = "mc-covers-feature";
    error.issues = audit.issues;
    throw error;
  }
  return audit;
}
