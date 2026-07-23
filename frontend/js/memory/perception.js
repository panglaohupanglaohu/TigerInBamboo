// 感知流（perceptual）：容量 500 的环形缓冲 —— 易逝的原始刺激
// compress() 把缓冲聚合为摘要事件写入运行日志（反思固化），并清空已压缩部分
import { memKey, storageGet, storageSet } from "./memory-core.js";

export const PERCEPTION_CAPACITY = 500;

export class PerceptionStream {
  constructor(creatureId) {
    this.creatureId = creatureId;
    this.key = memKey(creatureId, "perception");
    this.buffer = storageGet(this.key) || [];
    if (!Array.isArray(this.buffer)) this.buffer = [];
  }

  _save() {
    storageSet(this.key, this.buffer);
  }

  /** 注入一条感知：{t?, modality, payload}；超出容量时丢弃最旧者 */
  perceive(entry = {}) {
    const item = {
      t: Number.isFinite(+entry.t) ? +entry.t : Date.now(),
      modality: entry.modality ?? "vision",
      payload: entry.payload ?? null,
    };
    this.buffer.push(item);
    if (this.buffer.length > PERCEPTION_CAPACITY) {
      this.buffer.splice(0, this.buffer.length - PERCEPTION_CAPACITY);
    }
    this._save();
    return item;
  }

  /** 返回 t 时刻前后窗口内的感知切片（按时间升序） */
  perceiveAt(t, windowMs = 60_000) {
    return this.buffer
      .filter((i) => Math.abs(i.t - t) <= windowMs)
      .slice()
      .sort((a, b) => a.t - b.t);
  }

  /** 缓冲统计摘要（不清空）：次数、时间跨度、按模态计数、fear 均值 */
  summarize() {
    const byModality = {};
    let fearSum = 0;
    let fearN = 0;
    let tStart = null;
    let tEnd = null;
    for (const i of this.buffer) {
      const m = i.modality || "unknown";
      byModality[m] = (byModality[m] || 0) + 1;
      const fear = i.payload && typeof i.payload === "object" ? i.payload.fear : null;
      if (Number.isFinite(+fear)) {
        fearSum += +fear;
        fearN += 1;
      }
      tStart = tStart === null ? i.t : Math.min(tStart, i.t);
      tEnd = tEnd === null ? i.t : Math.max(tEnd, i.t);
    }
    return {
      count: this.buffer.length,
      tStart,
      tEnd,
      byModality,
      fearMean: fearN ? +(fearSum / fearN).toFixed(3) : null,
    };
  }

  /**
   * 反思固化：把缓冲聚合为一条摘要事件写入运行日志，并清空已压缩部分
   * @param {import("./log.js").EpisodicLog} [log] 目标运行日志；缺省则只返回摘要不落日志
   * @returns {{summary, event}|null} 缓冲为空时返回 null
   */
  compress(log) {
    if (!this.buffer.length) return null;
    const summary = this.summarize();
    const modalityText = Object.entries(summary.byModality)
      .map(([m, n]) => `${m} ${n} 次`)
      .join("、");
    const fearText = summary.fearMean === null ? "" : `；fear 均值 ${summary.fearMean}`;
    const detail = `这段时间感知到 ${summary.count} 次刺激：${modalityText}${fearText}`;
    let event = null;
    if (log && typeof log.append === "function") {
      event = log.append({
        t: summary.tEnd ?? Date.now(),
        subject: this.creatureId,
        action: "感知压缩",
        detail,
        place: "",
        importance: 5,
        tags: ["感知", "压缩", ...Object.keys(summary.byModality)],
      });
    }
    this.buffer = [];
    this._save();
    return { summary, event, detail };
  }

  toJSON() {
    return this.buffer;
  }

  /** 整层替换（导入用）；非法输入则清空 */
  replace(buffer) {
    this.buffer = Array.isArray(buffer) ? buffer.slice(-PERCEPTION_CAPACITY) : [];
    this._save();
  }
}
