/**
 * sound.js — 建造音效，全部用 WebAudio 现场合成（没有音频文件）。
 *
 *   石头入水 "咕咚"：
 *     咕 —— 落水的一下闷击：正弦从 ~420Hz 迅速滑到 ~110Hz，加一点低通噪声（水花）
 *     咚 —— 被拖下水的气泡：小气泡共振时音高是"往上走"的（Minnaert 气泡，收缩→变小→变高），
 *           所以用一个 260→700Hz 上扬、指数衰减的正弦；再随机补 1–2 个更小更晚的气泡，
 *           连着放就是"咕咚咕咚"
 *   陆地上放一块：低频 thump + 很短的带通噪声（石头磕石头）
 *   拆掉一块：短促上扬的 "啵"；拆到水面则再来一声小水花
 *
 * 浏览器要求用户手势之后才能出声：第一次 pointerdown / keydown 时才建 AudioContext。
 * 同一帧里批量编辑（比如加载场景）不会刷屏：每 40ms 最多一声，总并发上限 10。
 */

export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.last = 0;
    this.live = 0;
    const unlock = () => {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        // 一点点混响感：短延迟反馈（像在海湾里）
        const d = this.ctx.createDelay(); d.delayTime.value = 0.085;
        const fb = this.ctx.createGain(); fb.gain.value = 0.22;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        this.master.connect(this.ctx.destination);
        this.master.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.ctx.destination);
        this.noise = this.#noiseBuffer();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    // Chrome 认 pointerdown / keydown，Safari 只认 click / touchend —— 全挂上
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']) addEventListener(ev, unlock, true);
    this.played = 0;   // 调试：一共放了几声
  }

  /** 编辑事件：before / after 是这一格编辑前后的顶层高度 */
  onEdit(cell, before, after) {
    if (!this.enabled || !this.ctx) return;
    // 第一次点击时 resume() 是异步的：这一声别丢，等它醒了再放
    if (this.ctx.state !== 'running') {
      if (!this.pending) { this.pending = true; this.ctx.resume().then(() => { this.pending = false; this.onEdit(cell, before, after); }); }
      return;
    }
    const now = this.ctx.currentTime;
    if (now - this.last < 0.04 || this.live > 10) return;
    this.last = now;
    this.played++;
    // 同一格 id 给一个稳定的小音高偏移，不同格子听起来不一样
    const tone = 0.88 + ((cell.id * 2654435761) % 1000) / 1000 * 0.28;
    if (after > before) {
      if (before === 0) this.plop(tone);
      else this.knock(tone * (1 + Math.min(after, 8) * 0.03));
    } else if (after < before) {
      this.pop(tone);
      if (after === 0) setTimeout(() => this.plop(tone * 1.25, 0.5), 60);
    }
  }

  /** 咕咚：落水闷击 + 1–3 个上扬的气泡 */
  plop(tone = 1, vol = 1) {
    const c = this.ctx, t = c.currentTime + 0.005;
    // 咕
    this.#osc('sine', t, 0.16, 0.9 * vol, (f) => {
      f.setValueAtTime(420 * tone, t);
      f.exponentialRampToValueAtTime(110 * tone, t + 0.11);
    });
    this.#noise(t, 0.12, 0.35 * vol, 'lowpass', 900, 0.8);
    // 咚 + 后面的小气泡
    const n = 1 + ((Math.random() * 2.6) | 0);
    for (let k = 0; k < n; k++) {
      const dt = 0.07 + k * (0.09 + Math.random() * 0.07);
      const f0 = (260 + k * 140 + Math.random() * 80) * tone;
      const a = (k === 0 ? 0.75 : 0.4 / k) * vol;
      this.#osc('sine', t + dt, 0.13 - k * 0.02, a, (f) => {
        f.setValueAtTime(f0, t + dt);
        f.exponentialRampToValueAtTime(f0 * 2.6, t + dt + 0.09);
      });
    }
  }

  /** 陆地 / 楼上放一块：石头磕一下 */
  knock(tone = 1) {
    const t = this.ctx.currentTime + 0.005;
    this.#osc('sine', t, 0.09, 0.7, (f) => {
      f.setValueAtTime(190 * tone, t);
      f.exponentialRampToValueAtTime(80 * tone, t + 0.08);
    });
    this.#noise(t, 0.05, 0.4, 'bandpass', 1400 * tone, 1.6);
  }

  /** 拆掉一块：短促的 "啵" */
  pop(tone = 1) {
    const t = this.ctx.currentTime + 0.005;
    this.#osc('triangle', t, 0.07, 0.4, (f) => {
      f.setValueAtTime(330 * tone, t);
      f.exponentialRampToValueAtTime(820 * tone, t + 0.06);
    });
    this.#noise(t, 0.04, 0.2, 'highpass', 2500, 0.7);
  }

  #osc(type, t, dur, amp, sweep) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    sweep(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
    this.live++; o.onended = () => { this.live--; g.disconnect(); };
  }

  #noise(t, dur, amp, type, freq, q) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    s.onended = () => g.disconnect();
  }

  #noiseBuffer() {
    const len = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
}
