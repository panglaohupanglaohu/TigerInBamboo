// 背景音乐：多曲顺序循环，浏览器自动播放策略处理（首次交互后启动）
export class BgmPlayer {
  /**
   * @param {string|string[]} urls - 音频文件地址（数组则顺序循环播放整个歌单）
   * @param {Object} opts - { volume: 0~1 }
   */
  constructor(urls, { volume = 0.5 } = {}) {
    this.tracks = Array.isArray(urls) ? urls : [urls];
    this.volume = volume;
    this.started = false;
    this._idx = 0;
    this._load(this._idx);
    // 浏览器要求用户交互后才能出声：首次点击/按键即启动
    const start = () => {
      if (this.started) return;
      this.audio.play().then(() => {
        this.started = true;
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("keydown", start);
      }).catch(() => { /* 仍被拦截则下次交互再试 */ });
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    this._start = start;
  }

  _load(i) {
    this.audio = new Audio(this.tracks[i]);
    this.audio.volume = this.volume;
    this.audio.muted = this._muted ?? false;
    // 单曲结束 → 下一首（歌单循环）
    this.audio.addEventListener("ended", () => this._next());
    // 某首缺失时安静跳过（不影响场景运行）
    this.audio.addEventListener("error", () => {
      console.info("BGM 未找到，跳过该曲：", this.tracks[i]);
      this._next();
    });
  }

  _next() {
    this._idx = (this._idx + 1) % this.tracks.length;
    const wasMuted = this._muted;
    this._load(this._idx);
    this.audio.muted = wasMuted;
    if (this.started) this.audio.play().catch(() => {});
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.audio.volume = this.volume;
  }

  toggleMute() {
    this._muted = !this._muted;
    this.audio.muted = this._muted;
    return this._muted;
  }
}
