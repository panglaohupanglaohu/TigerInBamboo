// =====================================================================
//  音频：简易 Web Audio 合成音效 + 夜色垫乐（零外部资源，可静音）
// =====================================================================
import { showToast } from "../ui/hud.js";

let audioCtx = null;
let muted = false;

// 垫乐节点
let padGain = null;
let padOscs = [];
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

function playTone({ freq = 440, dur = 0.12, type = "sine", gain = 0.08, slide = 0 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfxJump() {
  playTone({ freq: 280, dur: 0.1, type: "square", gain: 0.04, slide: 160 });
}
export function sfxPickup() {
  playTone({ freq: 520, dur: 0.14, type: "sine", gain: 0.07, slide: 200 });
  setTimeout(() => playTone({ freq: 780, dur: 0.12, type: "sine", gain: 0.05 }), 70);
}
export function sfxDeliver() {
  playTone({ freq: 392, dur: 0.1, type: "triangle", gain: 0.07 });
  setTimeout(() => playTone({ freq: 523, dur: 0.12, type: "triangle", gain: 0.07 }), 90);
  setTimeout(() => playTone({ freq: 659, dur: 0.18, type: "triangle", gain: 0.06 }), 180);
}
export function sfxWin() {
  [523, 659, 784, 1046].forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, dur: 0.2, type: "sine", gain: 0.06 }), i * 120);
  });
}

/** 夜色环境垫乐：低频和弦 + 偶发风铃点缀 */
export function startAmbience() {
  if (padStarted || muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  padStarted = true;

  padGain = ctx.createGain();
  padGain.gain.value = 0.0;
  padGain.connect(ctx.destination);
  // 淡入
  padGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2.5);

  // 三音和弦（A minor-ish 夜色）
  const freqs = [110, 164.81, 220, 329.63];
  padOscs = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i < 2 ? "sine" : "triangle";
    osc.frequency.value = f;
    g.gain.value = i === 0 ? 0.55 : 0.28;
    osc.connect(g);
    g.connect(padGain);
    osc.start();
    return { osc, g };
  });

  // 风铃：稀疏高音
  const chime = () => {
    if (muted || !audioCtx) return;
    const notes = [659, 784, 880, 1046, 1175];
    const f = notes[(Math.random() * notes.length) | 0];
    playTone({ freq: f, dur: 0.9, type: "sine", gain: 0.018, slide: -40 });
    padTimer = setTimeout(chime, 2800 + Math.random() * 4200);
  };
  padTimer = setTimeout(chime, 1800);
}

function stopAmbienceNodes() {
  if (padTimer) {
    clearTimeout(padTimer);
    padTimer = null;
  }
  for (const { osc } of padOscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  }
  padOscs = [];
  if (padGain) {
    try {
      padGain.disconnect();
    } catch {
      /* ignore */
    }
    padGain = null;
  }
  padStarted = false;
}

function setMuted(next) {
  muted = next;
  if (muted) {
    stopAmbienceNodes();
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
    if (!next) startAmbience();
  }
});
