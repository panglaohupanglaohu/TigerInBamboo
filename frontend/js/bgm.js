// 背景音乐：循环播放，浏览器自动播放策略处理（首次交互后启动）
export class BgmPlayer {
  /**
   * @param {string} url - 音频文件地址
   * @param {Object} opts - { volume: 0~1 }
   */
  constructor(url, { volume = 0.5 } = {}) {
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.volume = volume;
    this.started = false;
    // 音频缺失时安静降级（不影响场景运行）
    this.audio.addEventListener("error", () => {
      console.info("BGM 未找到，跳过音乐：", url);
      this.missing = true;
    });
    // 浏览器要求用户交互后才能出声：首次点击/按键即启动
    const start = () => {
      if (this.started || this.missing) return;
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

  setVolume(v) {
    this.audio.volume = Math.max(0, Math.min(1, v));
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    return this.audio.muted;
  }
}
