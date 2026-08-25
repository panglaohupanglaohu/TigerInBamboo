// Chart partitioning is compiled alongside the geodesic grid.  This named
// adapter keeps the boundary contract explicit for callers and tests.
export function chartForDirection(grid, direction) {
  let best = null; let score = -Infinity;
  for (const chart of grid?.charts || []) {
    const cell = chart.cellIndices?.[0];
    const center = cell === undefined ? [0, 1, 0] : grid.dual.directionOf(cell);
    const current = center[0] * direction[0] + center[1] * direction[1] + center[2] * direction[2];
    if (current > score) { score = current; best = chart; }
  }
  return best;
}
