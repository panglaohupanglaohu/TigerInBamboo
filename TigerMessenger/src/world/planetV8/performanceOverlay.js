export function createPlanetPerformanceOverlay({ phases = [], queue = {}, gpu = {}, cacheHit = 0 } = {}) {
  const durations = phases.map((phase) => phase.durationMs).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p) => durations.length ? durations[Math.min(durations.length - 1, Math.ceil((durations.length - 1) * p))] : null;
  return {
    workerQueue: { pending: queue.pending ?? 0, cancelled: queue.cancelled ?? 0 },
    phaseP50: percentile(0.5), phaseP95: percentile(0.95),
    mcTriangles: gpu.mcTriangles ?? null, drawCalls: gpu.drawCalls ?? null,
    instances: gpu.instances ?? null, gpuBuffers: gpu.gpuBuffers ?? null, cacheHit,
  };
}
