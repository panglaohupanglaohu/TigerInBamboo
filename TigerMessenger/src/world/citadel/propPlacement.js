// =====================================================================
//  独立 Prop Placement：slot 过滤 / 占用 / dirty reconcile（V6-G3）
//  纯数据，禁止 import Three.js。单 facade 不得连续四个相同道具。
// =====================================================================

import { hashHex, stableShuffle, createRng } from "../../core/rng.js";

export const PROP_KINDS = Object.freeze(["window", "lamp", "pot", "tree", "mailbox", "crate", "rope", "flag"]);

export const SLOT_KINDS = Object.freeze(["facade", "roof", "balcony", "doorway", "waterside", "stair", "bridge", "support"]);

const PROP_FOR = Object.freeze({
  facade: ["window", "lamp", "flag", "mailbox"],
  roof: ["chimney", "pot", "flag"],
  balcony: ["pot", "lamp"],
  doorway: ["lamp", "flag", "mailbox"],
  waterside: ["crate", "rope", "pot", "tree"],
  stair: ["lamp", "pot"],
  bridge: ["lamp", "flag", "rope"],
  support: ["rope", "lamp"],
});

function slopeOK(slot, prop) {
  const max = prop === "pot" || prop === "crate" || prop === "mailbox" ? 0.22 : 0.55;
  return (slot.slope ?? 0) <= max;
}

function clearanceOK(slot) {
  return (slot.clearance ?? 0) >= 0.18;
}

function occluded(slot) {
  return slot.occluded === true;
}

export function chooseProp(tags, context, slot) {
  const allow = (tags || []).filter((t) => PROP_KINDS.includes(t) || t === "chimney");
  const pool = allow.length ? allow : PROP_FOR[slot.kind] || ["lamp"];
  const rng = context.rng || createRng(context.seed || 1);
  const pick = pool[Math.floor(rng.next() * pool.length) % pool.length];
  return {
    id: `prop:${slot.id}:${pick}`,
    slotId: slot.id,
    kind: pick,
    cellId: slot.cellId,
    facadeDir: slot.dir,
    slotKind: slot.kind,
    u: slot.u,
    v: slot.v,
    h: slot.h,
  };
}

function facadeKey(prop) {
  return `${prop.cellId || ""}:${prop.facadeDir || "x"}`;
}

function breaksFourInARow(placed, next) {
  const key = facadeKey(next);
  const same = placed.filter((p) => facadeKey(p) === key);
  if (same.length < 3) return false;
  const tail = same.slice(-3);
  return tail.every((p) => p.kind === next.kind);
}

export function placeProps(slots, context = {}) {
  const seed = context.seed || 1;
  const rng = context.rng || createRng(seed);
  const shuffled = stableShuffle(slots || [], rng);
  const reserved = new Set(context.reserved || []);
  const placed = [];
  for (const slot of shuffled) {
    if (!clearanceOK(slot) || occluded(slot)) continue;
    const tags = slot.tags || PROP_FOR[slot.kind] || ["lamp"];
    const trial = chooseProp(tags, { ...context, rng, seed }, slot);
    if (!slopeOK(slot, trial.kind)) continue;
    const fp = `${slot.cellId}:${slot.kind}:${Math.round((slot.u || 0) * 8)}:${Math.round((slot.v || 0) * 8)}`;
    if (reserved.has(fp)) continue;
    if (breaksFourInARow(placed, trial)) continue;
    reserved.add(fp);
    placed.push(trial);
  }
  return placed;
}

export function reconcileProps(prevPlaced, nextSlots, context = {}) {
  const slotIds = new Set((nextSlots || []).map((s) => s.id));
  const keep = (prevPlaced || []).filter((p) => slotIds.has(p.slotId));
  const keptSlots = new Set(keep.map((p) => p.slotId));
  const dirty = (nextSlots || []).filter((s) => !keptSlots.has(s.id));
  const reserved = new Set(keep.map((p) => `${p.cellId}:${p.slotKind}:${Math.round((p.u || 0) * 8)}`));
  const added = placeProps(dirty, { ...context, reserved });
  return { placed: [...keep, ...added], dirtySlotIds: dirty.map((s) => s.id), kept: keep.length };
}

export function propUsage(placed, catalogKinds = PROP_KINDS) {
  const counts = Object.fromEntries(catalogKinds.map((k) => [k, 0]));
  for (const p of placed || []) counts[p.kind] = (counts[p.kind] || 0) + 1;
  const neverSelected = catalogKinds.filter((k) => !counts[k]);
  return { counts, neverSelected, total: (placed || []).length };
}

export function geometryUsage(cells) {
  const families = {};
  const variants = {};
  for (const c of cells || []) {
    const f = c.module?.family || "floor";
    const v = c.module?.id || `${f}.${c.module?.role || "x"}`;
    families[f] = (families[f] || 0) + 1;
    variants[v] = (variants[v] || 0) + 1;
  }
  return { families, variants };
}

export function appearancePropHash(placed) {
  return hashHex(
    (placed || [])
      .map((p) => `${p.slotId}:${p.kind}`)
      .sort()
      .join("|")
  );
}
