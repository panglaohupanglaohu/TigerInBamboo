// JSON/SVG-friendly debug model. Rendering remains an optional tool layer;
// generation never imports Three.js or writes files from the hot path.

export function buildPlanetGridDebug(grid, manifest = []) {
  const mainEdges = (grid?.edges || []).map((edge) => ({ key: edge.key, color: "#2d75ff" }));
  const dualEdges = [];
  for (const cell of grid?.dual?.cells?.() || []) for (const edge of grid.dual.neighborsOf(cell.index)) {
    if (cell.index < edge.to) dualEdges.push({ from: cell.id, to: grid.dual.cellId(edge.to), color: "#e33b55" });
  }
  const pentagons = (grid?.dual?.vertexCells?.() || []).filter((cell) => grid.dual.vertexNeighborsOf(cell.index).length === 5).map((cell) => cell.id);
  return {
    kind: "planet-grid-debug-v8",
    mainEdges,
    dualEdges,
    pentagons,
    landmarkPins: manifest.map((entry) => ({ id: entry.id, direction: entry.direction.slice(), color: "#ffffff" })),
  };
}

export function planetGridDebugSvg(model, { width = 900, height = 450 } = {}) {
  const lines = [];
  for (const edge of model?.mainEdges || []) lines.push(`<line data-edge="${edge.key}" stroke="${edge.color}" opacity=".7"/>`);
  for (const edge of model?.dualEdges || []) lines.push(`<line data-dual="${edge.from}:${edge.to}" stroke="${edge.color}" opacity=".7"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" data-pentagons="${(model?.pentagons || []).length}">${lines.join("")}</svg>`;
}
