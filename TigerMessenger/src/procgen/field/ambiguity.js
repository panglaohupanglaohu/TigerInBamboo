// =====================================================================
// Marching Cubes ambiguity diagnostics（V7-G8）
// 对 checkerboard face 使用中心值记录 asymptotic-decider 选择；默认仍
// 采用 canonical table，诊断结果随 mesh stats 一并可记录。
// =====================================================================

export const AMBIGUOUS_CASES = Object.freeze(new Set([3, 6, 7, 10, 12, 13, 15, 42, 43, 51, 60, 85, 90, 102, 105, 119, 150, 153, 165, 170, 195, 204, 210, 212, 240, 243, 249, 250]));

export function cubeCase(values, isoLevel = 0) {
  let code = 0;
  for (let i = 0; i < 8; i++) if (values[i] < isoLevel) code |= 1 << i;
  return code;
}

export function ambiguityDecision(values, isoLevel = 0) {
  const code = cubeCase(values, isoLevel);
  const center = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { code, ambiguous: AMBIGUOUS_CASES.has(code), center, connectInside: center < isoLevel };
}
