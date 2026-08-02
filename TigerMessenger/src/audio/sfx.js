// =====================================================================
//  音频：简易 Web Audio 合成音效 + 白天轻环境点缀（零外部资源，可静音）
//  不含持续低频振荡（避免嗡嗡声）
// =====================================================================
import { showToast } from "../ui/hud.js";

let audioCtx = null;
let muted = false;

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

/**
 * 白天环境点缀：仅稀疏高音风铃，无持续低频垫音（旧版 110Hz 和弦会嗡嗡响）
 */
export function startAmbience() {
  if (padStarted || muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  padStarted = true;

  // 风铃：中高音区、更疏、音量压低
  const chime = () => {
    if (muted || !audioCtx) return;
    const notes = [659, 784, 880, 988, 1046, 1175]; // E5–D6，无低音
    const f = notes[(Math.random() * notes.length) | 0];
    playTone({ freq: f, dur: 1.1, type: "sine", gain: 0.012, slide: -30 });
    // 偶发双音，仍保持高音
    if (Math.random() < 0.35) {
      const f2 = notes[(Math.random() * notes.length) | 0];
      setTimeout(
        () => playTone({ freq: f2, dur: 0.85, type: "sine", gain: 0.008, slide: -20 }),
        90
      );
    }
    padTimer = setTimeout(chime, 4500 + Math.random() * 5500);
  };
  padTimer = setTimeout(chime, 2200);
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
