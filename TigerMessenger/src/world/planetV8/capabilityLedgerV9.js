// Explicit V9 capability state.  A green data test is not silently promoted
// to a renderer/default claim; every promotion carries reproducible evidence.

export const CAPABILITY_STATES = Object.freeze([
  "MISSING",
  "DATA_TESTED",
  "RUNTIME_WIRED",
  "VISUAL_PROXY_PASSED",
  "DEFAULT_ON",
]);

function validState(state) { return CAPABILITY_STATES.includes(state); }

export function createCapabilityLedger({ version = 9, entries = [] } = {}) {
  const values = new Map();
  for (const entry of entries) setCapability(values, entry);
  return {
    version,
    set(entry) { setCapability(values, entry); return this; },
    get(id) { return values.get(String(id)) || null; },
    values() { return [...values.values()].sort((a, b) => a.id.localeCompare(b.id)); },
    validate() {
      const errors = [];
      for (const entry of values.values()) {
        if (!validState(entry.state)) errors.push(`state:${entry.id}`);
        if (!entry.test || !entry.hash || !Number.isInteger(entry.seedCount)) errors.push(`evidence:${entry.id}`);
        if (entry.seedCount < 0) errors.push(`seedCount:${entry.id}`);
      }
      return { ok: errors.length === 0, errors };
    },
    toJSON() { return { version, capabilities: this.values(), validation: this.validate() }; },
  };
}

function setCapability(values, entry = {}) {
  const normalized = {
    id: String(entry.id),
    state: entry.state || "MISSING",
    test: String(entry.test || "unverified"),
    hash: String(entry.hash || "unhashed"),
    seedCount: Math.max(0, Math.floor(Number(entry.seedCount) || 0)),
    featureFlag: entry.featureFlag ?? null,
    details: entry.details || null,
  };
  values.set(normalized.id, normalized);
}
