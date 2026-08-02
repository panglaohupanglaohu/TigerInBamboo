// =====================================================================
//  音频：简易 Web Audio 合成音效 + 白天轻环境点缀（零外部资源，可静音）
//  全局环境不含持续低频振荡；电车声仅在听距内按距离渐入/渐出
// =====================================================================
import { showToast } from "../ui/hud.js";

let audioCtx = null;
let muted = false;

// 有轨电车声：轮轨「哐啷」+ 到站铃/风铃感高音（禁止持续低频嗡嗡）
// 音量由 updateTramSound() 按距离衰减；近处才响
let tramNodes = null;
let tramLastGain = -1;
let tramLastUpdate = 0;
let tramClankTimer = null;
let tramBellTimer = null;
let tramProximity = 0;
const TRAM_MAX_DISTANCE = 22;
const TRAM_PEAK_GAIN = 0.42;

// 环境点缀
let padTimer = null;
let padStarted = false;

export function ensureAudio() {
  if (muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** 短促白噪声缓冲（哐啷撞击） */
function createClickNoiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const env = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  return buffer;
}

/**
 * 轮轨「哐啷」：中高频金属撞击，无低频
 * @param {number} level 0..1 距离音量
 */
function playTramClank(level) {
  const ctx = ensureAudio();
  if (!ctx || muted || level < 0.04 || !tramNodes) return;
  const t0 = ctx.currentTime;
  const g0 = Math.min(0.22, 0.08 + level * 0.16);

  // 撞击噪声（高通，去掉低沉）
  const noise = ctx.createBufferSource();
  noise.buffer = tramNodes.clickBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800 + Math.random() * 1200;
  bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(g0 * 0.55, t0);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
  noise.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(tramNodes.master);
  noise.start(t0);
  noise.stop(t0 + 0.07);

  // 金属叮（中高三角波，短促）
  const ping = ctx.createOscillator();
  const pg = ctx.createGain();
  ping.type = "triangle";
  const f0 = 1400 + Math.random() * 900;
  ping.frequency.setValueAtTime(f0, t0);
  ping.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + 0.05);
  pg.gain.setValueAtTime(g0 * 0.35, t0);
  pg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
  ping.connect(pg);
  pg.connect(tramNodes.master);
  ping.start(t0);
  ping.stop(t0 + 0.08);

  // 偶发双响（轨缝）
  if (Math.random() < 0.28) {
    const t1 = t0 + 0.045;
    const ping2 = ctx.createOscillator();
    const pg2 = ctx.createGain();
    ping2.type = "triangle";
    ping2.frequency.setValueAtTime(f0 * 1.12, t1);
    pg2.gain.setValueAtTime(g0 * 0.22, t1);
    pg2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.05);
    ping2.connect(pg2);
    pg2.connect(tramNodes.master);
    ping2.start(t1);
    ping2.stop(t1 + 0.06);
  }
}

/**
 * 到站铃 / 风铃感：高音双响「铃铃」，无低音
 * @param {number} level
 */
function playTramBell(level) {
  const ctx = ensureAudio();
  if (!ctx || muted || level < 0.08 || !tramNodes) return;
  const t0 = ctx.currentTime + 0.01;
  // 风铃感高音：E6 / G6 / B6 一带
  const notes = [
    [1318.5, 0],
    [1568.0, 0.14],
    [1975.5, 0.28],
  ];
  const gBase = Math.min(0.12, 0.04 + level * 0.1);
  for (const [freq, delay] of notes) {
    const start = t0 + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 600;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.97, start + 0.9);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gBase, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(hp);
    hp.connect(g);
    g.connect(tramNodes.master);
    osc.start(start);
    osc.stop(start + 1.15);
  }
  // 第二下「铃」
  setTimeout(() => {
    if (muted || !tramNodes || tramProximity < 0.08) return;
    const t1 = audioCtx.currentTime;
    const pair = [1174.7, 1480];
    for (const [i, freq] of pair.entries()) {
      const start = t1 + i * 0.02;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gBase * 0.75, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.85);
      osc.connect(g);
      g.connect(tramNodes.master);
      osc.start(start);
      osc.stop(start + 0.9);
    }
  }, 160);
}

function scheduleTramClanks() {
  if (tramClankTimer) clearTimeout(tramClankTimer);
  const tick = () => {
    tramClankTimer = null;
    if (!tramNodes || muted) return;
    if (tramProximity > 0.05) {
      playTramClank(tramProximity);
      // 越近哐啷越密（轨缝节奏）
      const interval = 140 + (1 - tramProximity) * 220 + Math.random() * 40;
      tramClankTimer = setTimeout(tick, interval);
    } else {
      tramClankTimer = setTimeout(tick, 400);
    }
  };
  tramClankTimer = setTimeout(tick, 200);
}

function scheduleTramBells() {
  if (tramBellTimer) clearTimeout(tramBellTimer);
  const tick = () => {
    tramBellTimer = null;
    if (!tramNodes || muted) return;
    // 较近时偶尔到站铃 / 风铃
    if (tramProximity > 0.35 && Math.random() < 0.55 + tramProximity * 0.35) {
      playTramBell(tramProximity);
    }
    // 间隔 2.8~5.5s
    tramBellTimer = setTimeout(tick, 2800 + Math.random() * 2700);
  };
  tramBellTimer = setTimeout(tick, 1800);
}

/** 启动电车声系统（无持续低频）；必须在用户手势后调用。 */
export function startTramSound() {
  const ctx = ensureAudio();
  if (!ctx || tramNodes) return;

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // 极轻的中高频轨面沙沙（高通噪声），不是低频嗡嗡
  const length = Math.floor(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const hiss = ctx.createBufferSource();
  hiss.buffer = buf;
  hiss.loop = true;
  const hissHp = ctx.createBiquadFilter();
  hissHp.type = "highpass";
  hissHp.frequency.value = 2200;
  const hissBp = ctx.createBiquadFilter();
  hissBp.type = "bandpass";
  hissBp.frequency.value = 3500;
  hissBp.Q.value = 0.6;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.028;
  hiss.connect(hissHp);
  hissHp.connect(hissBp);
  hissBp.connect(hissGain);
  hissGain.connect(master);
  hiss.start();

  tramNodes = {
    master,
    clickBuf: createClickNoiseBuffer(ctx),
    hissGain,
  };
  tramLastGain = -1;
  tramLastUpdate = 0;
  tramProximity = 0;
  scheduleTramClanks();
  scheduleTramBells();
}

/**
 * 按世界坐标更新电车音量与节奏。
 * 近处：哐啷密 + 偶发铃铃；远处渐隐；无低频底噪。
 */
export function updateTramSound(tramPosition, listenerPosition) {
  if (!tramNodes || !tramPosition || !listenerPosition || !audioCtx) return;
  const now = audioCtx.currentTime;
  if (now - tramLastUpdate < 0.04) return;
  tramLastUpdate = now;
  const distance = tramPosition.distanceTo(listenerPosition);
  const proximity = Math.max(0, Math.min(1, 1 - distance / TRAM_MAX_DISTANCE));
  tramProximity = muted ? 0 : proximity;
  const target = muted ? 0 : TRAM_PEAK_GAIN * Math.pow(proximity, 1.15);
  if (Math.abs(target - tramLastGain) >= 0.003) {
    tramLastGain = target;
    tramNodes.master.gain.setTargetAtTime(target, now, 0.08);
  }
  // 近处略抬高沙沙，仍保持高频
  if (tramNodes.hissGain) {
    tramNodes.hissGain.gain.setTargetAtTime(0.018 + proximity * 0.04, now, 0.1);
  }
}

// 全局响度倍率（相对原先偏小的默认值）
const VOL = 2.4;

function playTone({ freq = 440, dur = 0.12, type = "sine", gain = 0.08, slide = 0 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  const peak = Math.min(0.28, gain * VOL); // 硬顶，防削波刺耳
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfxJump() {
  playTone({ freq: 280, dur: 0.1, type: "square", gain: 0.055, slide: 160 });
}
export function sfxPickup() {
  playTone({ freq: 520, dur: 0.14, type: "sine", gain: 0.09, slide: 200 });
  setTimeout(() => playTone({ freq: 780, dur: 0.12, type: "sine", gain: 0.07 }), 70);
}
export function sfxDeliver() {
  playTone({ freq: 392, dur: 0.1, type: "triangle", gain: 0.09 });
  setTimeout(() => playTone({ freq: 523, dur: 0.12, type: "triangle", gain: 0.09 }), 90);
  setTimeout(() => playTone({ freq: 659, dur: 0.18, type: "triangle", gain: 0.08 }), 180);
}
export function sfxWin() {
  [523, 659, 784, 1046].forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, dur: 0.2, type: "sine", gain: 0.085 }), i * 120);
  });
}

/**
 * 原创“水面旅程”登车氛围段。
 * 不引用电影旋律或录音，只用悬浮和弦、缓慢泛音与水面般的高频点。
 */
export function sfxWaterTrain() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const sceneGain = ctx.createGain();
  sceneGain.gain.setValueAtTime(0.0001, t0);
  sceneGain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.8);
  sceneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.4);
  sceneGain.connect(ctx.destination);

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.setValueAtTime(950, t0);
  padFilter.frequency.exponentialRampToValueAtTime(1600, t0 + 4.8);
  padFilter.connect(sceneGain);

  // 开放悬浮和弦；没有固定旋律，避免与任何现有作品形成旋律复刻。
  const padVoices = [196, 246.94, 293.66, 392];
  for (const [index, freq] of padVoices.entries()) {
    const osc = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    osc.type = index % 2 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.setValueAtTime(index % 2 ? -5 : 4, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.004, t0 + 5.9);
    voiceGain.gain.setValueAtTime(0.0001, t0);
    voiceGain.gain.exponentialRampToValueAtTime(0.28 / padVoices.length, t0 + 1.2);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.1);
    osc.connect(voiceGain);
    voiceGain.connect(padFilter);
    osc.start(t0);
    osc.stop(t0 + 6.6);
  }

  // 稀疏水光泛音：错开的短音，不组成可辨识旋律。
  [659.25, 783.99, 987.77, 1174.66].forEach((freq, index) => {
    const start = t0 + 0.55 + index * 1.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.985, start + 0.9);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.95);
    osc.connect(gain);
    gain.connect(sceneGain);
    osc.start(start);
    osc.stop(start + 1.02);
  });

  window.setTimeout(() => {
    try {
      sceneGain.disconnect();
      padFilter.disconnect();
    } catch {
      /* 节点已由浏览器回收 */
    }
  }, 7600);
}

/**
 * 白天环境点缀：仅稀疏高音风铃，无持续低频垫音（旧版 110Hz 和弦会嗡嗡响）
 */
export function startAmbience() {
  if (padStarted || muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  padStarted = true;

  // 风铃：中高音区；音量加大，间隔略缩短
  const chime = () => {
    if (muted || !audioCtx) return;
    const notes = [659, 784, 880, 988, 1046, 1175]; // E5–D6，无低音
    const f = notes[(Math.random() * notes.length) | 0];
    playTone({ freq: f, dur: 1.2, type: "sine", gain: 0.035, slide: -30 });
    // 偶发双音，仍保持高音
    if (Math.random() < 0.45) {
      const f2 = notes[(Math.random() * notes.length) | 0];
      setTimeout(
        () => playTone({ freq: f2, dur: 0.95, type: "sine", gain: 0.025, slide: -20 }),
        90
      );
    }
    padTimer = setTimeout(chime, 3200 + Math.random() * 3800);
  };
  padTimer = setTimeout(chime, 1200);
}

function stopAmbienceNodes() {
  if (padTimer) {
    clearTimeout(padTimer);
    padTimer = null;
  }
  padStarted = false;
}

function setMuted(next) {
  muted = next;
  if (muted) {
    stopAmbienceNodes();
    tramProximity = 0;
    if (tramNodes?.master && audioCtx) {
      tramNodes.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    }
    if (audioCtx && audioCtx.state === "running") {
      // 不关闭 context，便于再开时恢复
    }
  } else if (padStarted === false) {
    // 用户重新开声时若游戏已在进行，由调用方 startAmbience
  }
}

export function isMuted() {
  return muted;
}

// M 键静音切换
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    const next = !muted;
    setMuted(next);
    showToast(next ? "音效已关闭" : "音效已开启", 1.4);
    if (!next) {
      startAmbience();
      startTramSound();
    }
  }
});
