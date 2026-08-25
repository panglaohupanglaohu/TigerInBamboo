// Terrain Editor V9 core.  This module is deliberately Three.js-free: the
// authoring field and command log are the source of truth, while a worker or
// renderer can consume the preview snapshot at a frame boundary.

import { createPlanetSnapshotCommitQueue } from "../../world/planetV8/snapshotCommitV8.js";
import { createDirtyRegionPlan, stableSnapshotString } from "../../procgen/snapshot/incrementalSnapshot.js";

export const TERRAIN_EDITOR_SCHEMA = 9;
export const TERRAIN_BRUSHES = Object.freeze([
  "raise", "lower", "smooth", "flatten", "ridge", "canyon",
  "lake", "river", "forest", "grass", "erase", "lock",
]);

const FIELD_CHANNELS = Object.freeze(["height", "biome", "water", "forest", "grass", "hardLock"]);

function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cellId(x, y) { return `${x}:${y}`; }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

export function createAuthoringField({ width = 32, height = 20, seed = 1, cells = null } = {}) {
  const safeWidth = Math.max(2, Math.floor(width));
  const safeHeight = Math.max(2, Math.floor(height));
  const source = Array.isArray(cells) ? clone(cells) : [];
  const byId = new Map(source.map((item) => [String(item.id), item]));
  const output = [];
  for (let y = 0; y < safeHeight; y++) {
    for (let x = 0; x < safeWidth; x++) {
      const id = cellId(x, y);
      const previous = byId.get(id) || {};
      output.push({
        id,
        x,
        y,
        height: finite(previous.height),
        biome: previous.biome || "grassland",
        water: clamp(finite(previous.water)),
        forest: clamp(finite(previous.forest)),
        grass: clamp(finite(previous.grass, 0.35)),
        hardLock: Boolean(previous.hardLock),
      });
    }
  }
  return { schema: TERRAIN_EDITOR_SCHEMA, seed: seed >>> 0, width: safeWidth, height: safeHeight, cells: output };
}

function normalizeField(field) {
  return createAuthoringField(field || {});
}

function affectedCells(field, center, radius) {
  const origin = Array.isArray(center) ? center : [field.width * 0.5, field.height * 0.5];
  const r = Math.max(0.01, finite(radius, 1));
  return field.cells.filter((cell) => distance([cell.x, cell.y], origin) <= r);
}

function falloffWeight(cell, center, radius, falloff = "smooth") {
  const t = clamp(distance([cell.x, cell.y], center) / Math.max(0.01, radius));
  if (falloff === "flat") return 1;
  if (falloff === "linear") return 1 - t;
  return 1 - (t * t * (3 - 2 * t));
}

function setChannel(cell, channel, value) {
  if (channel === "biome") cell.biome = String(value || "grassland");
  else if (channel === "water" || channel === "forest" || channel === "grass") cell[channel] = clamp(value);
  else if (channel === "height") cell.height = finite(value);
}

function applyBrush(field, command, lockedIds) {
  const kind = command.kind;
  if (!TERRAIN_BRUSHES.includes(kind)) throw new Error(`unknown terrain brush: ${kind}`);
  const center = Array.isArray(command.center) ? command.center : [field.width * 0.5, field.height * 0.5];
  const radius = Math.max(0.01, finite(command.radius, 2));
  const strength = finite(command.strength, 1);
  const selected = affectedCells(field, center, radius);
  const touched = [];
  let blocked = 0;
  for (const cell of selected) {
    if (kind !== "lock" && (cell.hardLock || lockedIds.has(cell.id))) { blocked++; continue; }
    const weight = falloffWeight(cell, center, radius, command.falloff);
    const amount = strength * weight;
    if (kind === "raise" || kind === "lower") cell.height += (kind === "raise" ? 1 : -1) * amount;
    else if (kind === "smooth") {
      const neighbours = field.cells.filter((other) => Math.abs(other.x - cell.x) + Math.abs(other.y - cell.y) === 1);
      const average = neighbours.length ? neighbours.reduce((sum, other) => sum + other.height, 0) / neighbours.length : cell.height;
      cell.height += (average - cell.height) * clamp(amount);
    } else if (kind === "flatten") cell.height += (finite(command.value, 0) - cell.height) * clamp(amount);
    else if (kind === "ridge") {
      cell.height += amount * (1 - Math.abs((cell.x - center[0]) / Math.max(1, radius)));
      cell.biome = "mountain";
    } else if (kind === "canyon") {
      cell.height -= amount * 0.9;
      cell.biome = "canyon";
    } else if (kind === "lake") {
      cell.height += (finite(command.value, -0.2) - cell.height) * clamp(amount);
      cell.water = Math.max(cell.water, clamp(amount));
      cell.biome = "lake";
    } else if (kind === "river") {
      cell.water = Math.max(cell.water, clamp(amount));
      cell.height -= amount * 0.12;
      cell.biome = "river";
    } else if (kind === "forest") {
      cell.forest = Math.max(cell.forest, clamp(amount));
      cell.biome = command.biome || "forest";
    } else if (kind === "grass") {
      cell.grass = clamp(Math.max(cell.grass, amount));
      if (cell.biome === "rock" || cell.biome === "empty") cell.biome = "grassland";
    } else if (kind === "erase") {
      cell.water = 0; cell.forest = 0; cell.grass = 0.35; cell.biome = "grassland";
      cell.height *= 1 - clamp(amount);
    } else if (kind === "lock") {
      cell.hardLock = true;
      lockedIds.add(cell.id);
    }
    if (command.terrace > 0 && kind !== "lock") {
      const step = Math.max(0.001, finite(command.terrace, 0.25));
      cell.height = Math.round(cell.height / step) * step;
    }
    touched.push(cell.id);
  }
  return { touched, blocked };
}

function dirtyPlan(ids) {
  const sorted = [...new Set(ids.map(String))].sort();
  return createDirtyRegionPlan({
    wfcCells: sorted,
    fieldChunks: sorted,
    derivedSurfaces: sorted,
    nav: sorted,
    props: sorted,
    AO: sorted,
    shadow: sorted,
  });
}

export function createTerrainEditorSession({
  field = createAuthoringField(),
  seed = field.seed ?? 1,
  hardLocks = [],
  compilePreview = (snapshot) => ({ ok: true, snapshot }),
  validate = () => ({ ok: true, errors: [] }),
} = {}) {
  let currentField = normalizeField({ ...field, seed });
  const lockedIds = new Set(hardLocks.map(String));
  for (const cell of currentField.cells) if (cell.hardLock || lockedIds.has(cell.id)) { cell.hardLock = true; lockedIds.add(cell.id); }
  const history = [];
  const redoStack = [];
  const transactions = [];
  let committed = null;
  const commitQueue = createPlanetSnapshotCommitQueue({ validate: (snapshot) => validate(snapshot) });

  function snapshot() {
    return { schema: TERRAIN_EDITOR_SCHEMA, seed: seed >>> 0, field: clone(currentField), lockedIds: [...lockedIds].sort(), transactions: clone(transactions) };
  }

  function apply(command = {}) {
    const normalized = { ...command, kind: command.kind || "raise" };
    const before = clone(currentField);
    const result = applyBrush(currentField, normalized, lockedIds);
    if (!result.touched.length && result.blocked) return { ok: false, reason: "all-targets-locked", blocked: result.blocked };
    const transaction = {
      id: `terrain-tx:${transactions.length + 1}`,
      schema: TERRAIN_EDITOR_SCHEMA,
      seed: seed >>> 0,
      command: clone(normalized),
      touched: result.touched.slice().sort(),
      dirty: dirtyPlan(result.touched),
    };
    history.push({ before, after: clone(currentField), transaction });
    redoStack.length = 0;
    transactions.push(transaction);
    return { ok: true, transaction, blocked: result.blocked };
  }

  function undo() {
    const entry = history.pop();
    if (!entry) return { ok: false, reason: "empty-history" };
    redoStack.push(entry);
    currentField = entry.before;
    transactions.pop();
    return { ok: true, transaction: entry.transaction };
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return { ok: false, reason: "empty-redo" };
    currentField = entry.after;
    history.push(entry);
    transactions.push(entry.transaction);
    return { ok: true, transaction: entry.transaction };
  }

  function preview() {
    const candidate = snapshot();
    const compile = compilePreview(candidate, candidate.transactions.at(-1)?.dirty || dirtyPlan([]));
    const validation = validate(compile?.snapshot || candidate);
    const ok = compile?.ok !== false && validation?.ok !== false;
    return { ok, snapshot: ok ? (compile?.snapshot || candidate) : committed || null, compile, validation, committed: false };
  }

  function commit() {
    const result = preview();
    if (!result.ok) return result;
    const queued = commitQueue.enqueue(result.snapshot);
    if (!queued.ok) return { ...result, ok: false, queued };
    const flushed = commitQueue.commitAtFrameBoundary();
    if (!flushed.ok) return { ...result, ok: false, flushed };
    committed = flushed.snapshot;
    return { ...result, ok: true, committed: true, snapshot: committed };
  }

  function replay(commands = transactions.map((entry) => entry.command)) {
    const initial = normalizeField({ ...field, seed });
    currentField = initial;
    lockedIds.clear();
    for (const cell of initial.cells) if (cell.hardLock || hardLocks.includes(cell.id)) { cell.hardLock = true; lockedIds.add(cell.id); }
    history.length = 0; redoStack.length = 0; transactions.length = 0;
    for (const command of commands) apply(command);
    return snapshot();
  }

  return {
    schema: TERRAIN_EDITOR_SCHEMA,
    brushes: TERRAIN_BRUSHES,
    channels: FIELD_CHANNELS,
    apply,
    undo,
    redo,
    preview,
    commit,
    replay,
    snapshot,
    serialize() { return JSON.stringify(snapshot()); },
    get committed() { return committed; },
    get historySize() { return history.length; },
    get redoSize() { return redoStack.length; },
  };
}

export function terrainEditorHash(session) { return stableSnapshotString(session.snapshot()); }
