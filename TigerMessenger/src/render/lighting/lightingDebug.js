// =====================================================================
// Lighting debug metrics（V5 K6）
// 不依赖渲染器对象；把像素、shadow-fit、局部灯和资源计数统一成报告。
// =====================================================================

function percentile(values, p) {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const index = Math.min(a.length - 1, Math.max(0, Math.floor((a.length - 1) * p)));
  return a[index];
}

export function summarizeLightingDebug({ luminance = [], clipped = 0, dark = 0, shadowFit = null, localLights = null, gpu = null } = {}) {
  const p10 = percentile(luminance, 0.1); const p50 = percentile(luminance, 0.5); const p90 = percentile(luminance, 0.9);
  return Object.freeze({
    p10, p50, p90,
    contrastP90P10: p90 / Math.max(p10, 1e-6),
    clippedPercent: Number(clipped) || 0,
    darkPercent: Number(dark) || 0,
    shadowFit: shadowFit ? { span: shadowFit.span, texel: shadowFit.texel, near: shadowFit.near, far: shadowFit.far } : null,
    localLights: localLights ? { registered: localLights.registered, exceptions: localLights.exceptions?.length || 0 } : null,
    gpu: gpu ? { drawCalls: gpu.drawCalls ?? null, triangles: gpu.triangles ?? null, frameMs: gpu.frameMs ?? null, textures: gpu.textures ?? null } : null,
  });
}
