// =====================================================================
//  版本化存档：blueprint/seed/玩家/任务，不序列化 Three.js（G11）
// =====================================================================

import { citadelBlueprintCanonicalHash, migrateCitadelBlueprint } from "../citadelBlueprint.js";
import { hashHex } from "../../core/rng.js";

export const CURRENT_SAVE_VERSION = 2;

export function canonicalize(save) {
  const copy = JSON.parse(JSON.stringify(save));
  return copy;
}

export function validateSave(save) {
  if (!save || typeof save !== "object") return { ok: false, errors: ["not-object"] };
  if (!Number.isFinite(save.version)) return { ok: false, errors: ["version"] };
  return { ok: true, errors: [] };
}

const MIGRATIONS = {
  1: (s) => ({
    ...s,
    version: 2,
    seeds: s.seeds || { combat: 7, town: 1, terrain: 1 },
  }),
};

export function migrateSave(raw) {
  let save = canonicalize(typeof raw === "string" ? JSON.parse(raw) : raw);
  const v = validateSave(save);
  if (!v.ok) throw new Error(v.errors.join(","));
  while (save.version < CURRENT_SAVE_VERSION) {
    const fn = MIGRATIONS[save.version];
    if (!fn) throw new Error(`no migration from ${save.version}`);
    save = fn(save);
  }
  if (save.blueprint) save.blueprint = migrateCitadelBlueprint(save.blueprint);
  return canonicalize(validateSave(save) && save);
}

export function createSave({ blueprint, player, quests, seeds }) {
  return canonicalize({
    version: CURRENT_SAVE_VERSION,
    seeds: seeds || { combat: 7, town: 1, terrain: 1 },
    blueprint,
    player: player
      ? { worldEntityId: player.worldEntityId || "player:0", x: player.x, y: player.y, z: player.z }
      : null,
    quests: (quests || []).map((q) => ({
      id: q.id,
      worldEntityId: q.worldEntityId,
      status: q.status || "idle",
    })),
  });
}

export function saveCanonicalHash(save) {
  const s = migrateSave(save);
  const bp = s.blueprint ? citadelBlueprintCanonicalHash(s.blueprint) : "none";
  return hashHex(JSON.stringify({ v: s.version, seeds: s.seeds, bp, player: s.player, quests: s.quests }));
}

export function questTargetId(kind, key) {
  return `world:${kind}:${key}`;
}
