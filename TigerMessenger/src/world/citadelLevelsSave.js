// Citadel layout save v6: same layout source as v5, plus incremental-edit metadata.
// Pure JSON envelope — callers pass `normalize` so this file does not import the
// cache-stamped citadelTown module (browser would otherwise load two copies).
import { hashHex } from "../core/rng.js";

export const CITADEL_LEVELS_SAVE_VERSION = 6;
export const CITADEL_LEVELS_KEY_V6 = "tm.citadel.levels.highland-townscaper.v6";
export const CITADEL_LEVELS_KEY_V5 = "tm.citadel.levels.highland-townscaper.v5";

export function citadelLevelsSaveKey(instanceId = null) {
  if (instanceId === "canal-junction") return "tm.citadel.levels.canal-junction.v4";
  if (instanceId) return `tm.citadel.levels.${instanceId}.v6`;
  return CITADEL_LEVELS_KEY_V6;
}

export function citadelLevelsLegacyKeys(instanceId = null) {
  if (instanceId === "canal-junction") return [];
  if (instanceId) return [`tm.citadel.levels.${instanceId}.v1`];
  return [CITADEL_LEVELS_KEY_V5];
}

function layoutOf(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.layout && (raw.layout.terraces || Array.isArray(raw.layout))) return raw.layout;
  return raw;
}

const identityNormalize = (value) => value;

export function serializeCitadelLevelsSave(layout, incremental = {}, { normalize = identityNormalize, floors } = {}) {
  const normalized = normalize(layoutOf(layout) || layout, floors);
  const meta = {
    lastDirtyCells: Array.isArray(incremental.lastDirtyCells) ? incremental.lastDirtyCells.slice() : [],
    lastEditHash: incremental.lastEditHash || null,
    rebuildMode: incremental.rebuildMode || "incremental",
  };
  return {
    version: CITADEL_LEVELS_SAVE_VERSION,
    schema: "citadel-levels-v6",
    gridSize: normalized.gridSize,
    terraces: normalized.terraces,
    layout: normalized,
    incremental: meta,
    layoutHash: hashHex(JSON.stringify(normalized.terraces)),
  };
}

export function migrateCitadelLevelsSave(raw, { normalize = identityNormalize, floors } = {}) {
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const layout = normalize(layoutOf(parsed) || parsed, floors);
  if (parsed?.version === CITADEL_LEVELS_SAVE_VERSION && parsed?.schema === "citadel-levels-v6") {
    return serializeCitadelLevelsSave(layout, parsed.incremental || {}, { normalize, floors });
  }
  return serializeCitadelLevelsSave(layout, parsed?.incremental || { rebuildMode: "full-restore" }, { normalize, floors });
}

export function loadCitadelLevelsSave(storage, { instanceId = null, floors, normalize = identityNormalize } = {}) {
  if (!storage?.getItem) return null;
  const keys = [citadelLevelsSaveKey(instanceId), ...citadelLevelsLegacyKeys(instanceId)];
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      return migrateCitadelLevelsSave(JSON.parse(raw), { normalize, floors });
    } catch {
      /* try next key */
    }
  }
  return null;
}

export function saveCitadelLevelsSave(storage, layout, incremental, { instanceId = null, normalize = identityNormalize, floors } = {}) {
  const envelope = serializeCitadelLevelsSave(layout, incremental, { normalize, floors });
  storage.setItem(citadelLevelsSaveKey(instanceId), JSON.stringify(envelope));
  return envelope;
}

export function replayCitadelLevelEdits(initialLayout, edits = [], apply, { normalize = identityNormalize } = {}) {
  let layout = normalize(initialLayout);
  const hashes = [hashHex(JSON.stringify(layout.terraces))];
  for (const edit of edits) {
    layout = apply(layout, edit);
    hashes.push(hashHex(JSON.stringify(normalize(layout).terraces)));
  }
  return { layout: normalize(layout), hashes };
}
