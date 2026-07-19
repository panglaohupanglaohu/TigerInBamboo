// 虎啸音效：WebAudio 高保真程序化合成（无音频素材依赖）
// 分层配方：爆发瞬态 + 低频双振荡 + AM 喉音滚鸣 + 共振峰声道 + 多普勒风啸 + 胸腔捶击
// 主链挂 DynamicsCompressor 粘合压紧；首次用户交互后解锁 AudioContext
export class TigerSfx {
  constructor({ volume = 0.8 } = {}) {
    this.volume = volume;
    this.ctx = null;
    const unlock = () => {
      this._ensure();
      this.ctx?.resume?.();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      // 主链：主增益 → 压缩器（爆发力粘合）→ 输出
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.18;
      this.master.connect(this.comp).connect(this.ctx.destination);
      // 共享白噪声
      const len = this.ctx.sampleRate * 2;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.ctx;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  // —— 分层件 ——

  /** 爆发瞬态：10~40ms 高通噪声劈啪（速度/爆发力的"出膛"感） */
  _snap(t0, gain = 0.5, dur = 0.03) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** 多普勒风啸：带通噪声急速上扫（扑跃的风压速度感） */
  _whoosh(t0, dur = 0.35, gain = 0.4, f0 = 300, f1 = 2400) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** 胸腔捶击：超低频正弦下坠（飞扑落爪的体重感） */
  _thump(t0, gain = 0.55, dur = 0.22) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(52, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** 吼声主体：双振荡 + AM 喉音滚鸣 + 共振峰声道
   *  dur 时长；f0→f1 体音俯冲；gargle 滚鸣深度；form0→form1 声道峰；gain 总幅 */
  _roarCore(t0, { dur, f0, f1, gargle = 0.5, form0 = 560, form1 = 300, gain = 0.8 }) {
    const ctx = this.ctx;
    // 喉音滚鸣 AM（~24Hz 的"呼噜"颗粒感，真虎吼的灵魂）
    const am = ctx.createGain();
    am.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.type = "triangle";
    lfo.frequency.value = 24;
    const lfoG = ctx.createGain();
    lfoG.gain.value = gargle * 0.5;
    lfo.connect(lfoG).connect(am.gain);
    // 双振荡：锯齿 + 失谐方波（加厚）
    const mix = ctx.createGain();
    mix.gain.value = 1;
    for (const [type, det, mul] of [["sawtooth", 0, 1], ["square", 4, 0.5]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = det;
      o.frequency.setValueAtTime(f0 * mul * 2, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(f1 * mul * 2, 24), t0 + dur);
      const og = ctx.createGain();
      og.gain.value = type === "sawtooth" ? 0.5 : 0.28;
      o.connect(og).connect(mix);
      o.start(t0); o.stop(t0 + dur);
    }
    // 超低频正弦（胸腔底座）
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(f0, t0);
    sub.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
    const sg = ctx.createGain();
    sg.gain.value = 0.5;
    sub.connect(sg).connect(mix);
    sub.start(t0); sub.stop(t0 + dur);
    // 共振峰声道（噪声过带通扫频，模拟喉管/口腔共鸣）
    const breath = ctx.createBufferSource();
    breath.buffer = this._noiseBuf; breath.loop = true;
    const form = ctx.createBiquadFilter();
    form.type = "bandpass"; form.Q.value = 2.2;
    form.frequency.setValueAtTime(form0, t0);
    form.frequency.exponentialRampToValueAtTime(form1, t0 + dur);
    const bg = ctx.createGain();
    bg.gain.value = 0.55;
    breath.connect(form).connect(bg).connect(mix);
    breath.start(t0); breath.stop(t0 + dur);
    // 总包络：快起缓收
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1400;
    mix.connect(am).connect(env).connect(lp).connect(this.master);
    lfo.start(t0); lfo.stop(t0 + dur);
  }

  // —— 四种虎啸 ——

  /** 潜行低吼：压低的滚动喉音，威而不发 */
  growl() {
    if (!this._ensure() || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    this._roarCore(t0, { dur: 1.7, f0: 50, f1: 36, gargle: 0.75, form0: 300, form1: 170, gain: 0.3 });
  }

  /** 爆发短吼：瞬态劈啪 + 短促喷息（出膛即爆发） */
  snarl() {
    if (!this._ensure() || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    this._snap(t0, 0.5, 0.028);
    this._whoosh(t0, 0.22, 0.3, 500, 1800);
    this._roarCore(t0, { dur: 0.42, f0: 92, f1: 55, gargle: 0.35, form0: 700, form1: 260, gain: 0.6 });
  }

  /** 飞扑咆哮：瞬态 + 风啸 + 全幅怒吼 + 落爪捶击（速度与爆发力的顶点） */
  roar() {
    if (!this._ensure() || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    this._snap(t0, 0.6, 0.035);
    this._whoosh(t0, 0.38, 0.42, 320, 2600);
    this._roarCore(t0, { dur: 1.05, f0: 70, f1: 38, gargle: 0.55, form0: 620, form1: 240, gain: 1.0 });
    this._thump(t0 + 0.4, 0.5, 0.24); // 扑至中段的落体重音
  }

  /** 进食咀嚼：细碎低频滚动 */
  chew() {
    if (!this._ensure() || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    this._roarCore(t0, { dur: 1.2, f0: 44, f1: 32, gargle: 0.9, form0: 200, form1: 110, gain: 0.2 });
  }

  /** 竹丛沙沙：带通噪声 + 快速颤动（虎挤过竹丛，枝叶积雪簌落声） */  rustle(strength = 1) {
    if (!this._ensure() || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime, dur = 0.4 + strength * 0.25;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    const peak = 0.22 * Math.min(strength, 1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    // 枝叶颤动：高频 LFO 抖幅
    const lfo = ctx.createOscillator();
    lfo.type = "triangle";
    lfo.frequency.value = 26;
    const lg = ctx.createGain();
    lg.gain.value = peak * 0.6;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
}
