// Terrain/nav shared transport contracts for tram and other guided vehicles.

export function projectRouteToSurface(provider, directions = []) {
  return directions.map((direction) => provider.sample(direction).position.slice());
}

export function validateSurfaceTransportRoute(points = [], { maxSlope = 0.42, minTurnRadius = 1.8, clearances = [], coastSafety = 1 } = {}) {
  const errors = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1e-6;
    if (Math.abs(b[1] - a[1]) / horizontal > maxSlope) errors.push(`slope:${i}`);
  }
  for (let i = 2; i < points.length; i++) {
    const a = points[i - 2]; const b = points[i - 1]; const c = points[i];
    const ab = Math.hypot(b[0] - a[0], b[2] - a[2]); const bc = Math.hypot(c[0] - b[0], c[2] - b[2]);
    if (ab > 1e-6 && bc > 1e-6) {
      const turn = Math.acos(Math.max(-1, Math.min(1, ((b[0] - a[0]) * (c[0] - b[0]) + (b[2] - a[2]) * (c[2] - b[2])) / (ab * bc))));
      if (Math.min(ab, bc) / Math.max(turn, 1e-4) < minTurnRadius) errors.push(`turn-radius:${i}`);
    }
  }
  for (const clearance of clearances) if (!(clearance.width > 0 && clearance.height > 0 && clearance.radius >= coastSafety)) errors.push(`clearance:${clearance.id || "unknown"}`);
  return { ok: errors.length === 0, errors };
}

