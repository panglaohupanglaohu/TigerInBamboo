// 情绪残留（affective）：事件散场后留下的情绪余烬
// 可衰减（S = S₀·exp(-Δt/η)，η=72h）、可再激活（有界，最大 +20%）
// 只通过 toneHint() 影响"语气"，不参与事实检索
import { memKey, storageGet, storageSet, clamp01 } from "./memory-core.js";

export const AFFECT_ETA_MS = 72 * 3_600_000; // 衰减常数 η = 72 小时
const FLOOR = 0.01; // 低于此强度视为散尽

const clampValence = (v) => Math.min(1, Math.max(-1, Number.isFinite(+v) ? +v : 0));

function emptyState() {
  return { valence: 0, arousal: 0, labels: {}, updatedAt: Date.now() };
}

export class AffectResidue {
  constructor(creatureId) {
    this.creatureId = creatureId;
    this.key = memKey(creatureId, "affect");
    const saved = storageGet(this.key);
    this.state = saved && typeof saved === "object" ? { ...emptyState(), ...saved } : emptyState();
    if (!this.state.labels || typeof this.state.labels !== "object") this.state.labels = {};
  }

  _save() {
    storageSet(this.key, this.state);
  }

  /** 惰性衰减到时刻 now（MemoryBank 式 S = S₀·exp(-Δt/η)） */
  _decayTo(now = Date.now()) {
    const s = this.state;
    const dt = now - (s.updatedAt ?? now);
    if (dt <= 0) return;
    const f = Math.exp(-dt / AFFECT_ETA_MS);
    s.valence *= f;
    s.arousal *= f;
    for (const [label, intensity] of Object.entries(s.labels)) {
      const v = intensity * f;
      if (v < FLOOR) delete s.labels[label];
      else s.labels[label] = v;
    }
    s.updatedAt = now;
  }

  /**
   * 注入一次感受。同一标签再激活则强化 —— 有界，最多 +20%
   * @param {string} label 情绪标签（如"牵挂""惊惧"）
   * @param {number} intensity 0~1
   * @param {number} valence -1~1（负 → 正）
   * @param {number} arousal 0~1（平静 → 激动）
   */
  feel(label, intensity = 0.5, valence = 0, arousal = 0.5, now = Date.now()) {
    if (!label) return null;
    this._decayTo(now);
    const s = this.state;
    const key = String(label);
    const cur = s.labels[key];
    s.labels[key] =
      cur === undefined ? clamp01(intensity) : Math.min(1, Math.max(cur * 1.2, clamp01(intensity)));
    s.valence = clampValence(s.valence * 0.5 + clampValence(valence) * 0.5);
    s.arousal = clamp01(s.arousal * 0.5 + clamp01(arousal) * 0.5);
    s.updatedAt = now;
    this._save();
    return this.residue(now);
  }

  /** 当前残留（施加衰减后返回快照，并落盘） */
  residue(now = Date.now()) {
    this._decayTo(now);
    this._save();
    return {
      valence: +this.state.valence.toFixed(4),
      arousal: +this.state.arousal.toFixed(4),
      labels: Object.fromEntries(
        Object.entries(this.state.labels).map(([k, v]) => [k, +v.toFixed(4)]),
      ),
      updatedAt: this.state.updatedAt,
    };
  }

  /**
   * 一句中文语气提示（供对话 prompt 注入；不影响事实检索）
   * 例："语气里带着一点未散的牵挂。"
   */
  toneHint(now = Date.now()) {
    const r = this.residue(now);
    const entries = Object.entries(r.labels).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return "语气平静，没有明显的情绪残留。";
    const [label, intensity] = entries[0];
    const degree = intensity >= 0.6 ? "浓浓的" : intensity >= 0.3 ? "一丝" : "一点未散的";
    let hint = `语气里带着${degree}${label}`;
    if (r.arousal >= 0.7) hint += "，语速不自觉地快了些";
    else if (r.arousal <= 0.2 && intensity >= 0.3) hint += "，说得又轻又慢";
    if (r.valence <= -0.4) hint += "，尾音微微发沉";
    else if (r.valence >= 0.4) hint += "，尾音里透出暖意";
    return `${hint}。`;
  }

  /** 共享时间轴切片：衰减到时刻 t 的残留（只计算，不落盘） */
  at(t) {
    const s = this.state;
    const dt = t - (s.updatedAt ?? t);
    const f = dt > 0 ? Math.exp(-dt / AFFECT_ETA_MS) : 1;
    const labels = {};
    for (const [k, v] of Object.entries(s.labels)) {
      const decayed = v * f;
      if (decayed >= FLOOR) labels[k] = +decayed.toFixed(4);
    }
    return {
      valence: +(s.valence * f).toFixed(4),
      arousal: +(s.arousal * f).toFixed(4),
      labels,
    };
  }

  /** 封存用快照（同 residue，但语义上强调"此刻定格"） */
  snapshot(now = Date.now()) {
    return this.residue(now);
  }

  toJSON() {
    return this.state;
  }

  /** 整层替换（导入用）；非法输入则重置为空状态 */
  replace(state) {
    this.state = state && typeof state === "object" ? { ...emptyState(), ...state } : emptyState();
    if (!this.state.labels || typeof this.state.labels !== "object") this.state.labels = {};
    this._save();
  }
}
