// 未发送队列（prospective memory）："打算做但还没做"的事 —— 第一等公民
// 每条意图携带：创建者 / 触发条件 / 倒计时 / 超时策略 / 死亡交接规则（handover，v1 预留）
import { memKey, storageGet, storageSet, uid } from "./memory-core.js";

export const INTENTION_STATUS = ["pending", "confirmed", "dropped"];
export const TIMEOUT_POLICIES = ["drop", "escalate", "keep"];
export const CONFIDENCE_LEVELS = ["normal", "unclear"];

const DAY_MS = 86_400_000;

export class IntentionQueue {
  constructor(creatureId) {
    this.creatureId = creatureId;
    this.key = memKey(creatureId, "intentions");
    this.items = storageGet(this.key) || [];
    if (!Array.isArray(this.items)) this.items = [];
  }

  _save() {
    storageSet(this.key, this.items);
  }

  /**
   * 新建一条意图
   * @param {{creator, instruction, trigger?, dueAt?, countdown?, timeoutPolicy?, provenance?, handover?}} input
   */
  add(input = {}) {
    const now = Date.now();
    const prov = input.provenance || {};
    const it = {
      id: input.id || uid("in"),
      tCreated: Number.isFinite(+input.tCreated) ? +input.tCreated : now,
      creator: input.creator ?? "",
      instruction: input.instruction ?? "",
      trigger: input.trigger ?? "",
      dueAt: Number.isFinite(+input.dueAt) ? +input.dueAt : null,
      countdown: Number.isFinite(+input.countdown) ? +input.countdown : null,
      status: "pending",
      timeoutPolicy: TIMEOUT_POLICIES.includes(input.timeoutPolicy) ? input.timeoutPolicy : "drop",
      provenance: {
        saidAt: Number.isFinite(+prov.saidAt) ? +prov.saidAt : now,
        context: prov.context ?? "",
        confidence: CONFIDENCE_LEVELS.includes(prov.confidence) ? prov.confidence : "normal",
      },
      handover: input.handover ?? null, // 死亡交接规则：v1 预留字段，不实现逻辑
    };
    this.items.push(it);
    this._save();
    return it;
  }

  /**
   * 待办意图：按 dueAt 升序（无期限者居后），附"还有 N 天 / 已逾期 N 天"
   */
  pending(now = Date.now()) {
    return this.items
      .filter((i) => i.status === "pending")
      .slice()
      .sort((a, b) => {
        if (a.dueAt === null && b.dueAt === null) return a.tCreated - b.tCreated;
        if (a.dueAt === null) return 1;
        if (b.dueAt === null) return -1;
        return a.dueAt - b.dueAt;
      })
      .map((i) => {
        const daysLeft = i.dueAt === null ? null : Math.ceil((i.dueAt - now) / DAY_MS);
        const dueLabel =
          daysLeft === null ? "无期限" : daysLeft >= 0 ? `还有 ${daysLeft} 天` : `已逾期 ${-daysLeft} 天`;
        return { ...i, daysLeft, dueLabel };
      });
  }

  /** 全部意图（含已确认 / 已放弃），按创建时间升序 */
  all() {
    return this.items.slice().sort((a, b) => a.tCreated - b.tCreated);
  }

  /** 确认完成 */
  confirm(id, now = Date.now()) {
    const it = this.items.find((i) => i.id === id);
    if (!it || it.status !== "pending") return null;
    it.status = "confirmed";
    it.confirmedAt = now;
    this._save();
    return it;
  }

  /** 放弃 */
  drop(id, now = Date.now()) {
    const it = this.items.find((i) => i.id === id);
    if (!it || it.status !== "pending") return null;
    it.status = "dropped";
    it.droppedAt = now;
    this._save();
    return it;
  }

  /** 共享时间轴切片：t 时刻已创建且仍悬置的意图 */
  at(t) {
    return this.items.filter((i) => i.tCreated <= t && i.status === "pending");
  }

  toJSON() {
    return this.items;
  }

  /** 整层替换（导入用）；非法输入则清空 */
  replace(items) {
    this.items = Array.isArray(items) ? items : [];
    this._save();
  }
}
