// =====================================================================
// V10 field overlay (G21-G, DeepSeek data layer).
//
// Ten debug layers (elevation, slope, waterDepth, coastDistance, fetch,
// vapor, lift, rainShadow, precipitation, forestness) extracted from the
// same semantic cells with per-layer min/max legend metadata and a numeric
// probe.  The DOM view wiring is left to the Codex integration side; this
// module is the pure data contract the view must render.
// =====================================================================

export const FIELD_OVERLAY_LAYERS_V10 = Object.freeze([
  "elevation", "slope", "waterDepth", "coastDistance", "fetch",
  "vapor", "lift", "rainShadow", "precipitation", "forestness",
]);

const LAYER_SOURCE_V10 = Object.freeze({
  elevation: { group: "terrain", key: "elevation" },
  slope: { group: "terrain", key: "slope" },
  waterDepth: { group: "water", key: "waterDepth" },
  coastDistance: { group: "water", key: "coastDistance" },
  fetch: { group: "climate", key: "upwindOceanFetch" },
  vapor: { group: "climate", key: "vapor" },
  lift: { group: "climate", key: "orographicLift" },
  rainShadow: { group: "climate", key: "rainShadow" },
  precipitation: { group: "climate", key: "precipitationClimatology" },
  forestness: { group: "ecology", key: "forestness" },
});

/** Normalize a layer value to 0..1 for a debug view (raw kept for probes). */
export function normalizeLayerV10(layer, value, stats) {
  if (layer === "waterDepth" || layer === "fetch" || layer === "lift" || layer === "coastDistance") {
    const magnitude = Math.abs(value);
    const max = stats?.max ?? 0;
    return max > 0 ? Math.max(0, Math.min(1, magnitude / max)) : 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * @param {object} options
 *   cells   iterable of SemanticCellV10 (or object with byId map)
 *   byId    optional id -> cell map
 * Returns per-layer Float32Array (stable cell order) + min/max stats +
 * legend, and a probe(cellId|index, layer) reading the same arrays.
 */
export function buildFieldOverlayV10({ cells = [], byId = null } = {}) {
  const list = Array.isArray(cells) ? cells : [...cells];
  const order = list.map((cell) => cell.id).sort((a, b) => {
    const na = Number(a.split(":")[1]); const nb = Number(b.split(":")[1]);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const indexById = new Map(order.map((id, index) => [id, index]));
  const layers = {};
  const stats = {};
  for (const layer of FIELD_OVERLAY_LAYERS_V10) {
    const source = LAYER_SOURCE_V10[layer];
    const values = new Float32Array(order.length);
    let min = Infinity; let max = -Infinity;
    for (let i = 0; i < order.length; i++) {
      const cell = byId?.get(order[i]) ?? list.find((entry) => entry.id === order[i]);
      const value = Number(cell?.[source.group]?.[source.key]) || 0;
      values[i] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    layers[layer] = values;
    stats[layer] = { min, max };
  }
  return Object.freeze({
    kind: "field-overlay-v10",
    layers: Object.freeze(layers),
    stats: Object.freeze(stats),
    legend: Object.freeze(FIELD_OVERLAY_LAYERS_V10.map((layer) => ({
      layer,
      min: stats[layer].min,
      max: stats[layer].max,
      unit: layer === "elevation" || layer === "waterDepth" || layer === "coastDistance" ? "world units" : layer === "fetch" ? "rad" : "0..1",
    }))),
    order,
    probe(cellIdOrIndex, layer) {
      if (!FIELD_OVERLAY_LAYERS_V10.includes(layer)) throw new Error(`field-overlay-v10: unknown layer ${layer}`);
      const index = typeof cellIdOrIndex === "number" ? cellIdOrIndex : indexById.get(cellIdOrIndex);
      if (index == null || index < 0 || index >= order.length) throw new Error(`field-overlay-v10: unknown cell ${cellIdOrIndex}`);
      const raw = layers[layer][index];
      return { raw, normalized: normalizeLayerV10(layer, raw, stats[layer]) };
    },
  });
}
