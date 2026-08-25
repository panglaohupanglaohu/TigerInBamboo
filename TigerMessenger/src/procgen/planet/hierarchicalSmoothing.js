// =====================================================================
// Hierarchical smoothing. Level 0 hard vertices are never moved; transition
// vertices may be influenced by hard neighbours, and free vertices receive
// the full smooth pass. This preserves coast/ridge/route/building edges.
// =====================================================================

function clampMove(a, b, maxMove) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  if (length <= maxMove || length < 1e-8) return b.slice();
  const t = maxMove / length;
  return [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
}

export function hierarchicalSmoothPositions(positions, neighbors, { levels = null, maxMove = [0, 0.15, 0.35], passes = 3, reproject = null } = {}) {
  const out = positions.map((position) => position.slice());
  const levelOf = levels || new Array(out.length).fill(2);
  for (let pass = 0; pass < passes; pass++) {
    const next = out.map((position) => position.slice());
    for (let i = 0; i < out.length; i++) {
      const level = levelOf[i] ?? 2;
      if (level <= 0) continue;
      const candidates = (neighbors[i] || []).filter((neighbor) => (levelOf[neighbor] ?? 2) <= level);
      if (!candidates.length) continue;
      const mean = candidates.reduce((sum, neighbor) => [sum[0] + out[neighbor][0], sum[1] + out[neighbor][1], sum[2] + out[neighbor][2]], [0, 0, 0]).map((value) => value / candidates.length);
      next[i] = clampMove(out[i], mean, maxMove[Math.min(2, level)]);
    }
    out.splice(0, out.length, ...next);
    if (reproject) for (let i = 0; i < out.length; i++) out[i] = reproject(out[i], i, levelOf[i] ?? 2);
  }
  return out;
}

export function classifyHardLevels({ count, hard = [], transition = [] } = {}) {
  const levels = new Array(count).fill(2);
  for (const index of transition) if (index >= 0 && index < count) levels[index] = Math.min(levels[index], 1);
  for (const index of hard) if (index >= 0 && index < count) levels[index] = 0;
  return levels;
}
