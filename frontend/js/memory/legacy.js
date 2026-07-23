// 遗存 / 传递协议：封存快照（只读化）、凭吊只读视图、遗嘱协议（define-only）
// 封存是仪式不是删除：快照只读、原件保留凭吊
import { storageGet, storageSet, storageKeys, deepFreeze } from "./memory-core.js";

export const LEGACY_PREFIX = "tib.legacy.";
export const LEGACY_SCHEMA = "tib.legacy/v1";

const legacyKey = (creatureId) => `${LEGACY_PREFIX}${creatureId}`;

/** 是否已封存 */
export function isSealed(creatureId) {
  return storageGet(legacyKey(creatureId)) !== null;
}

/** 全部已封存的 creatureId */
export function listSealedIds() {
  return storageKeys(LEGACY_PREFIX).map((k) => k.slice(LEGACY_PREFIX.length));
}

/**
 * 封存：全量快照写入 tib.legacy.<creatureId> 并深冻结（仪式性只读化）
 * @param {string} creatureId
 * @param {import("./memory-core.js").MemoryCore} core 活体记忆核心
 * @returns 冻结后的快照；已封存则返回既有快照
 */
export function seal(creatureId, core, now = Date.now()) {
  const existing = storageGet(legacyKey(creatureId));
  if (existing) return existing;
  const snapshot = {
    schema: LEGACY_SCHEMA,
    creatureId,
    sealedAt: now,
    log: core.log.toJSON(),
    perceptionSummary: core.perception.summarize(),
    intentions: core.intentions.toJSON(),
    affectSnapshot: core.affect.snapshot(now),
  };
  storageSet(legacyKey(creatureId), snapshot);
  return snapshot;
}

/**
 * 凭吊：返回只读视图数据（深冻结的深拷贝）
 * 回放而非对话 —— 调用方须披露"这是回放，不是本人"
 */
export function memorial(creatureId) {
  const snapshot = storageGet(legacyKey(creatureId));
  if (!snapshot) return null;
  return deepFreeze(JSON.parse(JSON.stringify(snapshot)));
}

/**
 * 传递协议 JSON Schema（define-only）：协议已定，迁移未实现
 */
export const WILL_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tigerinbamboo.local/schemas/will.schema.json",
  title: "画中生物记忆遗嘱协议",
  type: "object",
  required: ["will"],
  properties: {
    will: {
      type: "object",
      required: ["beneficiary", "migrate_preferences", "handover_intentions", "keep_memorial"],
      properties: {
        beneficiary: { type: "string", description: "继承者的 creatureId" },
        migrate_preferences: {
          type: "array",
          items: { type: "string" },
          description: "偏好迁移确认清单：逐条列出、逐条确认",
        },
        handover_intentions: {
          enum: ["ask_new_owner", "auto", "drop"],
          description: "未发送意图的交接策略：问新主人 / 自动承接 / 全部放弃",
        },
        keep_memorial: {
          type: "boolean",
          default: true,
          description: "传递后原件是否保留凭吊（传递 = 复制，原件保留）",
        },
      },
      additionalProperties: false,
    },
  },
};

/**
 * 生成遗嘱草稿 JSON（协议已定，迁移未实现）
 */
export function draftWill(creatureId, now = Date.now()) {
  return {
    will: {
      testator: creatureId,
      beneficiary: "",
      migrate_preferences: [],
      handover_intentions: "ask_new_owner",
      keep_memorial: true,
    },
    draftedAt: now,
    note: "协议已定，迁移未实现 —— 本草稿仅声明意图，不产生任何复制或交接行为。",
  };
}
