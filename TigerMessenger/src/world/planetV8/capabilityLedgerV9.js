// Explicit V9 capability state.  A green data test is not silently promoted
// to a renderer/default claim; every promotion carries reproducible evidence.

export const CAPABILITY_STATES = Object.freeze([
  "MISSING",
  "DATA_TESTED",
  "RUNTIME_WIRED",
  "VISUAL_PROXY_PASSED",
  "DEFAULT_ON",
]);

const FORWARD_STATES = Object.freeze({
  MISSING: Object.freeze(["DATA_TESTED"]),
  DATA_TESTED: Object.freeze(["RUNTIME_WIRED"]),
  RUNTIME_WIRED: Object.freeze(["VISUAL_PROXY_PASSED", "DEFAULT_ON"]),
  VISUAL_PROXY_PASSED: Object.freeze(["DEFAULT_ON"]),
  DEFAULT_ON: Object.freeze([]),
});

function validState(state) { return CAPABILITY_STATES.includes(state); }

export function canPromoteCapability(from, to) {
  if (from === to) return true;
  if (!validState(from) || !validState(to)) return false;
  if (CAPABILITY_STATES.indexOf(to) < CAPABILITY_STATES.indexOf(from)) return true;
  return (FORWARD_STATES[from] || []).includes(to);
}

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
        if (entry.state === "DEFAULT_ON" && !entry.test) errors.push(`default-on-without-evidence:${entry.id}`);
      }
      return { ok: errors.length === 0, errors };
    },
    toJSON() { return { version, capabilities: this.values(), validation: this.validate() }; },
  };
}

function setCapability(values, entry = {}) {
  const id = String(entry.id);
  const nextState = entry.state || "MISSING";
  const previous = values.get(id);
  if (!validState(nextState)) throw new Error(`capability-ledger: invalid state ${nextState} for ${id}`);
  if (!previous) {
    if (nextState === "DEFAULT_ON") throw new Error(`capability-ledger: ${id} cannot start at DEFAULT_ON`);
  } else if (!canPromoteCapability(previous.state, nextState)) {
    throw new Error(`capability-ledger: cannot skip ${previous.state} → ${nextState} for ${id}`);
  }
  const normalized = {
    id,
    state: nextState,
    test: String(entry.test || "unverified"),
    hash: String(entry.hash || "unhashed"),
    seedCount: Math.max(0, Math.floor(Number(entry.seedCount) || 0)),
    featureFlag: entry.featureFlag ?? null,
    details: entry.details || null,
  };
  values.set(id, normalized);
}
