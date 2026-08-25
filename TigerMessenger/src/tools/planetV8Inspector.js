// Stable, serializable inspector model.  The UI can render these layers or
// export them without changing solver random streams.

export const PLANET_V8_DEBUG_LAYERS = Object.freeze([
  "main-grid", "dual-grid", "wfc-domain", "wfc-entropy", "wfc-conflict",
  "field-slice", "field-gradient", "mc-case", "mc-seam", "hard-level",
  "semantic", "water", "nav-portal", "cloud-climate", "cloud-lod",
]);

export function createPlanetV8Inspector(snapshot = null, diagnostics = {}) {
  return {
    version: 8,
    enabled: false,
    layers: PLANET_V8_DEBUG_LAYERS.map((id) => ({ id, visible: false })),
    diagnostics: { ...diagnostics },
    snapshotVersion: snapshot?.version ?? null,
    toJSON() { return { version: this.version, enabled: this.enabled, layers: this.layers, diagnostics: this.diagnostics, snapshotVersion: this.snapshotVersion }; },
  };
}

