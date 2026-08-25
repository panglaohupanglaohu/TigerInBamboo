// =====================================================================
//  任务目标稳定 worldEntityId（G11）：编辑地形后收发点不丢
// =====================================================================

import { questTargetId } from "./saveSchema.js";

export function withQuestWorldIds(quest) {
  if (!quest || typeof quest !== "object") return quest;
  const sender = quest.sender
    ? {
        ...quest.sender,
        worldEntityId: quest.sender.worldEntityId || questTargetId("npc", quest.sender.name || "sender"),
      }
    : quest.sender;
  const receiver = quest.receiver
    ? {
        ...quest.receiver,
        worldEntityId: quest.receiver.worldEntityId || questTargetId("npc", quest.receiver.name || "receiver"),
      }
    : quest.receiver;
  return {
    ...quest,
    worldEntityId: quest.worldEntityId || questTargetId("quest", quest.id || "unknown"),
    sender,
    receiver,
  };
}

export function bindQuestTarget(quest, world) {
  const id = quest?.worldEntityId;
  if (!id || !world?.entities) return null;
  return world.entities.get(id) || null;
}
