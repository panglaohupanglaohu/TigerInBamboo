// 运行日志（episodic）：append-only 事件流 + 三因子检索 + 区间回放
// score = recency(0.995 ^ 小时数) + importance/10 + relevance（词面匹配）
import { memKey, storageGet, storageSet, uid } from "./memory-core.js";

const RECENCY_DECAY_PER_HOUR = 0.995; // Generative Agents 衰减因子

function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

/** 词面匹配得分（无分词库）：整串子串 +1，字级 bigram 重叠率，标签精确命中 +0.5 */
function relevanceOf(query, e) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return 0;
  const text = [e.subject, e.action, e.detail, e.place, (e.tags || []).join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = 0;
  if (text.includes(q)) score += 1;
  if (q.length >= 2) {
    const qb = bigrams(q);
    const tb = bigrams(text);
    let hit = 0;
    for (const b of qb) if (tb.has(b)) hit += 1;
    score += qb.size ? hit / qb.size : 0;
  } else if (text.includes(q)) {
    score += 0.5;
  }
  if ((e.tags || []).some((tag) => String(tag).toLowerCase() === q)) score += 0.5;
  return score;
}

export class EpisodicLog {
  constructor(creatureId) {
    this.creatureId = creatureId;
    this.key = memKey(creatureId, "log");
    this.events = storageGet(this.key) || [];
    if (!Array.isArray(this.events)) this.events = [];
  }

  _save() {
    storageSet(this.key, this.events);
  }

  /**
   * 追加一条事件（append-only）
   * @param {{id?,t?,subject?,action?,detail?,place?,importance?,tags?}} event
   */
  append(event = {}) {
    const e = {
      id: event.id || uid("ev"),
      t: Number.isFinite(+event.t) ? +event.t : Date.now(),
      subject: event.subject ?? this.creatureId,
      action: event.action ?? "",
      detail: event.detail ?? "",
      place: event.place ?? "",
      importance: Math.min(10, Math.max(1, Math.round(+event.importance) || 5)),
      tags: Array.isArray(event.tags) ? event.tags.map(String) : [],
      lastAccessAt: event.lastAccessAt ?? null,
    };
    this.events.push(e);
    this._save();
    return e;
  }

  /** 时间窗内事件回放（按时间升序）；缺参即全量 */
  replay(tStart = -Infinity, tEnd = Infinity) {
    return this.events
      .filter((e) => e.t >= tStart && e.t <= tEnd)
      .slice()
      .sort((a, b) => a.t - b.t);
  }

  /**
   * 三因子检索：score = recency + importance/10 + relevance
   * 命中（relevance > 0 的返回项）后刷新 lastAccessAt —— 用进废退
   * @returns {Array<{event, score, parts:{recency,importance,relevance}}>}
   */
  recall(query, k = 5, now = Date.now()) {
    const scored = this.events.map((e) => {
      const anchor = e.lastAccessAt ?? e.t;
      const hours = Math.max(0, (now - anchor) / 3_600_000);
      const recency = Math.pow(RECENCY_DECAY_PER_HOUR, hours);
      const importance = (e.importance || 5) / 10;
      const relevance = relevanceOf(query, e);
      return { event: e, score: recency + importance + relevance, parts: { recency, importance, relevance } };
    });
    const filtered = query && String(query).trim()
      ? scored.filter((s) => s.parts.relevance > 0)
      : scored;
    filtered.sort((a, b) => b.score - a.score);
    const hits = filtered.slice(0, Math.max(1, k));
    if (hits.length) {
      for (const h of hits) h.event.lastAccessAt = now;
      this._save();
    }
    return hits;
  }

  /** 共享时间轴切片：|事件时刻 - t| 在窗口内的事件（升序） */
  at(t, windowMs = 60_000) {
    return this.events
      .filter((e) => Math.abs(e.t - t) <= windowMs)
      .slice()
      .sort((a, b) => a.t - b.t);
  }

  toJSON() {
    return this.events;
  }

  /** 整层替换（导入用）；非法输入则清空为空数组 */
  replace(events) {
    this.events = Array.isArray(events) ? events : [];
    this._save();
  }
}
