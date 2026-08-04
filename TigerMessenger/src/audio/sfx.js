// =====================================================================
//  音频：简易 Web Audio 合成音效 + 白天轻环境点缀（零外部资源，可静音）
//  全局环境不含持续低频振荡；电车声仅在听距内按距离渐入/渐出
// =====================================================================
import { showToast } from "../ui/hud.js";

let audioCtx = null;
let muted = false;

// 弹琴老人八音盒：播放《風之傳說》2:16–2:49 片段
let musicBoxSession = null;
/** @type {HTMLAudioElement|null} */
let musicBoxEl = null;
const MUSIC_BOX_BGM_URL = new URL(
  "../../music/Gwenan Gibbard-風之傳說.mp3",
  import.meta.url
).href;
/** 2 分 16 秒 */
const MUSIC_BOX_START_SEC = 2 * 60 + 16;
/** 2 分 49 秒（到此结束） */
const MUSIC_BOX_END_SEC = 2 * 60 + 49;
const MUSIC_BOX_VOLUME = 0.48;

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

// 环境点缀（风铃）；八音盒 / 峡谷 BGM 播放时 duck 压低
let padTimer = null;
let padStarted = false;
/** 1 = 正常环境音量；八音盒播放时降到 AMBIENCE_DUCK_MUSIC_BOX */
let ambienceDuck = 1;
const AMBIENCE_DUCK_MUSIC_BOX = 0.22;
const AMBIENCE_DUCK_CANYON_BGM = 0;

// 峡谷进谷 BGM（Gwenan Gibbard · 風之傳說）：进谷前 10s 起播，替换默认环境音
/** @type {HTMLAudioElement|null} */
let canyonBgmEl = null;
/** 场景仍要求播放（在谷内 / 进谷前 10s） */
let canyonBgmWanted = false;
/** 场景已离开，但当前 21–57s 这一整段必须播完再停 */
let canyonBgmPendingStop = false;
let canyonBgmFading = false;
const CANYON_BGM_URL = new URL(
  "../../music/Gwenan Gibbard-風之傳說.mp3",
  import.meta.url
).href;
const CANYON_BGM_VOLUME = 0.42;
/** 进谷 BGM 循环区间：第 21 秒 → 第 57 秒（约 36s 一整段） */
const CANYON_BGM_START_SEC = 21;
const CANYON_BGM_END_SEC = 57;

// 湖沼 BGM（同一首《風之傳說》）：进入莫比斯原初湖沼起播
/** @type {HTMLAudioElement|null} */
let swampBgmEl = null;
/** 场景仍要求播放（玩家在湖沼内） */
let swampBgmWanted = false;
/** 场景已离开，但当前 2:50–3:08 这一整段必须播完再停 */
let swampBgmPendingStop = false;
let swampBgmFading = false;
const SWAMP_BGM_URL = new URL(
  "../../music/Gwenan Gibbard-風之傳說.mp3",
  import.meta.url
).href;
const SWAMP_BGM_VOLUME = 0.46;
/** 湖沼 BGM 循环区间：2 分 50 秒 → 3 分 08 秒（尾奏情绪区，与水晶城 21–57s 前段明显区分） */
const SWAMP_BGM_START_SEC = 2 * 60 + 50;
const SWAMP_BGM_END_SEC = 3 * 60 + 8;

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

/** 雷鸣噪声缓冲缓存（按采样率） */
let thunderNoiseCache = null;

function getThunderNoiseBuffer(ctx) {
  if (thunderNoiseCache && thunderNoiseCache.sampleRate === ctx.sampleRate) {
    return thunderNoiseCache;
  }
  // ~2.4s 粉红/棕色噪声，供炸裂 + 滚雷共用
  const dur = 2.4;
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Paul Kellet 近似粉红噪声
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    const pink = b0 + b1 + b2 + white * 0.15;
    data[i] = pink * 0.22;
  }
  thunderNoiseCache = buffer;
  return buffer;
}

/**
 * 雷鸣：先近炸裂（短噪声裂响），再低频滚雷衰减。
 * 距离越远越晚、越闷、越轻（光先到、声后到）。
 * @param {{ distance?: number }} [opts] 与听者水平距离（世界单位）
 */
export function sfxThunder(opts = {}) {
  const ctx = ensureAudio();
  if (!ctx || muted) return;

  const distance = Math.max(0, Number(opts.distance) || 8);
  // 声速近似：游戏单位约 0.04s/单位，夹在 0.04–1.0s
  const delay = Math.min(1.0, Math.max(0.04, 0.05 + distance * 0.038));
  // 近雷更响更亮，远雷闷而轻
  const near = Math.max(0, Math.min(1, 1 - distance / 28));
  const crackPeak = 0.12 + near * 0.2;
  const rumblePeak = 0.1 + near * 0.16;
  const t0 = ctx.currentTime + delay;
  const noiseBuf = getThunderNoiseBuffer(ctx);

  const master = ctx.createGain();
  master.gain.setValueAtTime(1, t0);
  master.connect(ctx.destination);

  // ---- 1) 炸裂：中高频噪声裂响（1～2 次） ----
  const crackCount = near > 0.55 && Math.random() < 0.55 ? 2 : 1;
  for (let c = 0; c < crackCount; c++) {
    const tc = t0 + c * (0.04 + Math.random() * 0.06);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 280 + near * 220;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 1400;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    const peak = crackPeak * (c === 0 ? 1 : 0.55);
    g.gain.setValueAtTime(0.0001, tc);
    g.gain.exponentialRampToValueAtTime(peak, tc + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, tc + 0.12 + Math.random() * 0.08);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(tc, 0, 0.25);
  }

  // ---- 2) 滚雷：低频长噪声 + 缓慢低通下滑 ----
  {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    const fStart = 420 + near * 380;
    const fEnd = 80 + near * 60;
    lp.frequency.setValueAtTime(fStart, t0);
    lp.frequency.exponentialRampToValueAtTime(fEnd, t0 + 1.8);
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(rumblePeak, t0 + 0.06);
    g.gain.setValueAtTime(rumblePeak * 0.75, t0 + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9 + near * 0.5);
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start(t0, 0.05, 2.2);
  }

  // ---- 3) 远雷额外闷响（很轻的低频包络，非持续嗡嗡） ----
  if (near < 0.7) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55 + Math.random() * 25, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 1.4);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.04 + (1 - near) * 0.03, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 1.55);
  }

  // 结束后断开 master，避免节点堆积
  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      /* 已回收 */
    }
  }, (delay + 2.8) * 1000);
}

/**
 * 环境音 duck：八音盒播放时压低风铃等背景点缀，结束后恢复。
 * @param {number} level 0..1
 */
function setAmbienceDuck(level) {
  ambienceDuck = Math.max(0, Math.min(1, level));
}

function ensureMusicBoxEl() {
  if (musicBoxEl) return musicBoxEl;
  const el = new Audio();
  el.preload = "auto";
  el.loop = false;
  el.volume = 0; // 定位完成前静音，防止从 0s 漏出
  el.crossOrigin = "anonymous";
  el.src = MUSIC_BOX_BGM_URL;
  el.addEventListener("timeupdate", () => {
    if (!musicBoxSession || muted || el.paused) return;
    // 未定位成功时若仍在前奏，强制拉回 2:16
    if (el.currentTime < MUSIC_BOX_START_SEC - 0.25) {
      el.currentTime = MUSIC_BOX_START_SEC;
      return;
    }
    // 播到 2:49 结束
    if (el.currentTime >= MUSIC_BOX_END_SEC - 0.04) {
      finishMusicBox(musicBoxSession);
    }
  });
  el.addEventListener("ended", () => {
    if (musicBoxSession) finishMusicBox(musicBoxSession);
  });
  musicBoxEl = el;
  return el;
}

/**
 * 等元数据就绪后 seek 到 startSec，并等待 seeked（避免 play 从 0s 起）。
 * @param {HTMLAudioElement} el
 * @param {number} startSec
 */
function seekAudioWhenReady(el, startSec) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(el);
    };

    const applySeek = () => {
      const dur = el.duration;
      let t = startSec;
      if (Number.isFinite(dur) && dur > 0) {
        t = Math.min(startSec, Math.max(0, dur - 0.05));
      }
      const onSeeked = () => {
        el.removeEventListener("seeked", onSeeked);
        // 再校验一次
        if (el.currentTime < startSec - 1) {
          try {
            el.currentTime = t;
          } catch {
            /* ignore */
          }
        }
        done();
      };
      el.addEventListener("seeked", onSeeked);
      try {
        el.currentTime = t;
      } catch {
        done();
        return;
      }
      // 部分浏览器已在目标附近不会触发 seeked
      window.setTimeout(() => {
        if (Math.abs(el.currentTime - t) < 1.5 || el.readyState >= 2) {
          el.removeEventListener("seeked", onSeeked);
          done();
        }
      }, 400);
    };

    if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
      applySeek();
      return;
    }
    const onMeta = () => {
      el.removeEventListener("loadedmetadata", onMeta);
      applySeek();
    };
    el.addEventListener("loadedmetadata", onMeta);
    try {
      el.load();
    } catch {
      /* ignore */
    }
    // 超时兜底：仍尝试 seek + play
    window.setTimeout(() => {
      el.removeEventListener("loadedmetadata", onMeta);
      applySeek();
    }, 2500);
  });
}

/**
 * 弹琴老人八音盒：播放《風之傳說》2:16–2:49。
 * 返回 true 表示开始播放；正在播放时再次调用会停止并返回 false。
 * @param {{onNote?:(index:number)=>void, onEnded?:()=>void}} hooks
 */
export function toggleMusicBox(hooks = {}) {
  if (musicBoxSession) {
    stopMusicBox();
    return false;
  }
  if (muted) return false;
  ensureAudio();

  // 压低默认环境点缀
  setAmbienceDuck(AMBIENCE_DUCK_MUSIC_BOX);

  const el = ensureMusicBoxEl();
  el.volume = 0; // seek 完成前保持静音

  // 键位动画：约按节拍脉冲 onNote
  let noteIndex = 0;
  const pulseTimer = window.setInterval(() => {
    if (!musicBoxSession) return;
    hooks.onNote?.(noteIndex++);
  }, 420);

  const session = {
    el,
    pulseTimer,
    onEnded: hooks.onEnded,
    timers: [pulseTimer],
    sources: [],
    master: null,
    shimmer: null,
    generation: (musicBoxSession?.generation || 0) + 1,
  };
  musicBoxSession = session;

  // 必须先 seek 到 2:16，再 play，否则会从头响
  seekAudioWhenReady(el, MUSIC_BOX_START_SEC).then(() => {
    if (musicBoxSession !== session) return;
    // 双保险
    try {
      if (el.currentTime < MUSIC_BOX_START_SEC - 0.5) {
        el.currentTime = MUSIC_BOX_START_SEC;
      }
    } catch {
      /* ignore */
    }
    el.volume = MUSIC_BOX_VOLUME;
    el.play()?.catch?.(() => {
      if (musicBoxSession === session) finishMusicBox(session);
    });
  });

  return true;
}

function finishMusicBox(session) {
  if (!session || musicBoxSession !== session) return;
  musicBoxSession = null;
  setAmbienceDuck(1);
  for (const timer of session.timers || []) clearTimeout(timer);
  clearInterval(session.pulseTimer);
  const el = session.el || musicBoxEl;
  if (el) {
    try {
      el.pause();
      el.currentTime = MUSIC_BOX_START_SEC;
    } catch {
      /* ignore */
    }
  }
  session.onEnded?.();
}

export function stopMusicBox() {
  const session = musicBoxSession;
  if (!session) return;
  finishMusicBox(session);
}

export function isMusicBoxPlaying() {
  return musicBoxSession !== null;
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

  // 风铃：中高音区；八音盒播放时 ambienceDuck 压低音量
  const chime = () => {
    if (muted || !audioCtx) return;
    const duck = ambienceDuck;
    // duck 很低时拉长间隔，进一步让出八音盒
    const gapScale = duck < 0.5 ? 1.6 : 1;
    const notes = [659, 784, 880, 988, 1046, 1175]; // E5–D6，无低音
    const f = notes[(Math.random() * notes.length) | 0];
    playTone({ freq: f, dur: 1.2, type: "sine", gain: 0.035 * duck, slide: -30 });
    // 偶发双音，仍保持高音
    if (duck > 0.15 && Math.random() < 0.45) {
      const f2 = notes[(Math.random() * notes.length) | 0];
      setTimeout(
        () => playTone({ freq: f2, dur: 0.95, type: "sine", gain: 0.025 * ambienceDuck, slide: -20 }),
        90
      );
    }
    padTimer = setTimeout(chime, (3200 + Math.random() * 3800) * gapScale);
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

/** 默认风铃环境是否在播 */
export function isAmbiencePlaying() {
  return padStarted && !muted;
}

/**
 * 暂停默认环境音（进谷 BGM / 特殊场景用）
 */
export function pauseDefaultAmbience() {
  ambienceDuck = AMBIENCE_DUCK_CANYON_BGM;
  stopAmbienceNodes();
}

/**
 * 恢复默认环境音（离开峡谷场景且未静音时）
 */
export function resumeDefaultAmbience() {
  if (muted) return;
  ambienceDuck = 1;
  if (!padStarted) startAmbience();
}

function ensureCanyonBgmEl() {
  if (canyonBgmEl) return canyonBgmEl;
  const el = new Audio(CANYON_BGM_URL);
  // 不用原生 loop（会回到 0 秒）；在 21s–57s 区间内自循环
  el.loop = false;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  el.addEventListener("timeupdate", () => {
    if (muted || el.paused) return;
    if (el.currentTime < CANYON_BGM_END_SEC - 0.04) return;
    // 到达 57s：仍在场景内则循环；已驶出则播完这一段后停
    onCanyonBgmSegmentEnd(el);
  });
  el.addEventListener("ended", () => {
    if (muted) return;
    onCanyonBgmSegmentEnd(el);
  });
  canyonBgmEl = el;
  return el;
}

/**
 * 区间终点处理：在谷内 → 回 21s 再循环；已请求停止 → 淡出结束（保证整段 21–57 播完）
 */
function onCanyonBgmSegmentEnd(el) {
  if (canyonBgmWanted && !canyonBgmPendingStop) {
    seekCanyonBgmToStart(el);
    if (el.paused) el.play()?.catch?.(() => {});
    return;
  }
  // 场景已离开（pending stop）或不再需要：本段结束，真正停掉
  canyonBgmPendingStop = false;
  canyonBgmWanted = false;
  fadeOutCanyonBgm(1.2);
}

/** 定位到循环起点 21s（元数据未就绪时等 loadedmetadata） */
function seekCanyonBgmToStart(el) {
  if (!el) return;
  const apply = () => {
    try {
      const dur = el.duration;
      let start = CANYON_BGM_START_SEC;
      if (Number.isFinite(dur) && dur > 0) {
        start = Math.min(CANYON_BGM_START_SEC, Math.max(0, dur - 0.05));
      }
      el.currentTime = start;
    } catch {
      /* 部分浏览器 seek 中会抛 */
    }
  };
  if (el.readyState >= 1 /* HAVE_METADATA */) apply();
  else el.addEventListener("loadedmetadata", apply, { once: true });
}

function isCanyonBgmAudible() {
  return !!(canyonBgmEl && !canyonBgmEl.paused && canyonBgmEl.volume > 0.001);
}

/**
 * 峡谷进谷背景音乐：进谷前约 10 秒起播。
 * 幂等：状态未变则不重复 fade / play。
 * 关闭时：若本段 21–57s 未播完，会播完再停（驶出水晶城不打断）。
 * @param {boolean} active 是否应播放
 * @param {{ fade?: number }} [opts] fade 秒数
 */
export function setCanyonApproachBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.2;
  const next = !!active && !muted;

  if (next) {
    // 重新进入谷区：取消「播完即停」，继续循环
    const wasPendingOnly = canyonBgmPendingStop && !canyonBgmWanted;
    canyonBgmPendingStop = false;

    if (canyonBgmWanted && isCanyonBgmAudible()) {
      // 已在播，仅防暂停
      if (canyonBgmEl?.paused) {
        ensureAudio();
        canyonBgmEl.play()?.catch?.(() => {});
      }
      return;
    }

    // pending 收尾过程中又进谷：接上当前进度继续播，不从头 seek（避免跳播）
    if (wasPendingOnly && isCanyonBgmAudible()) {
      canyonBgmWanted = true;
      return;
    }

    canyonBgmWanted = true;
    pauseDefaultAmbience();
    if (musicBoxSession) stopMusicBox();
    // 与湖沼 BGM 互斥：进谷时压掉可能仍在播的湖沼段
    if (swampBgmWanted || swampBgmPendingStop || isSwampBgmAudible()) {
      fadeOutSwampBgm(0.6);
    }

    ensureAudio();
    const el = ensureCanyonBgmEl();
    // 新开一段：从 21s 起
    seekCanyonBgmToStart(el);
    el.play()?.catch?.(() => {});
    fadeAudioTo(el, CANYON_BGM_VOLUME, fade);
    return;
  }

  // ---- 请求停止 ----
  if (!canyonBgmWanted && !canyonBgmPendingStop) {
    // 本来就没在播
    return;
  }

  canyonBgmWanted = false;

  // 本段 21–57 尚未走完：标记 pending，播到 57s 再停
  const el = canyonBgmEl;
  if (
    el &&
    !el.paused &&
    el.currentTime >= CANYON_BGM_START_SEC - 0.5 &&
    el.currentTime < CANYON_BGM_END_SEC - 0.15
  ) {
    canyonBgmPendingStop = true;
    return;
  }

  // 已在终点附近或未真正在播：直接淡出
  canyonBgmPendingStop = false;
  fadeOutCanyonBgm(fade);
}

export function isCanyonBgmPlaying() {
  return !!(
    canyonBgmEl &&
    !canyonBgmEl.paused &&
    (canyonBgmWanted || canyonBgmPendingStop)
  );
}

/** 已驶离触发区，正在把当前 21–57s 整段播完（鸟群伴飞窗口） */
export function isCanyonBgmFinishing() {
  return !!(
    canyonBgmPendingStop &&
    canyonBgmEl &&
    !canyonBgmEl.paused
  );
}

function fadeAudioTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  canyonBgmFading = true;
  const step = () => {
    if (!canyonBgmEl || canyonBgmEl !== el) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && canyonBgmFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      canyonBgmFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutCanyonBgm(seconds = 1.4) {
  const el = canyonBgmEl;
  canyonBgmWanted = false;
  canyonBgmPendingStop = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : CANYON_BGM_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  canyonBgmFading = true;
  const step = () => {
    if (!canyonBgmEl || canyonBgmEl !== el) return;
    // 若中途又要求播放，中止淡出
    if (canyonBgmWanted) {
      canyonBgmFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start * (1 - k);
    if (k < 1) {
      requestAnimationFrame(step);
      return;
    }
    el.volume = 0;
    try {
      el.pause();
      // 停在起点标记，下次 play 仍从 21s
      el.currentTime = CANYON_BGM_START_SEC;
    } catch {
      /* ignore */
    }
    canyonBgmFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

// =====================================================================
//  湖沼 BGM：进入莫比斯原初湖沼 → 循环《風之傳說》2:50–3:08（尾奏区）
//  与峡谷 BGM（前段 21–57s）明显区分；同构：整段播完才停，离开不打断；两者互斥（先停对方）
// =====================================================================

/** 任一区段 BGM（峡谷 / 湖沼）仍在占用声道时，默认环境音不得恢复 */
function anySegmentBgmEngaged() {
  return (
    canyonBgmWanted ||
    canyonBgmPendingStop ||
    swampBgmWanted ||
    swampBgmPendingStop
  );
}

function ensureSwampBgmEl() {
  if (swampBgmEl) return swampBgmEl;
  const el = new Audio(SWAMP_BGM_URL);
  // 不用原生 loop（会回到 0 秒）；在 2:50–3:08 区间内自循环
  el.loop = false;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  el.addEventListener("timeupdate", () => {
    if (muted || el.paused) return;
    if (el.currentTime < SWAMP_BGM_END_SEC - 0.04) return;
    onSwampBgmSegmentEnd(el);
  });
  el.addEventListener("ended", () => {
    if (muted) return;
    onSwampBgmSegmentEnd(el);
  });
  swampBgmEl = el;
  return el;
}

/** 区间终点：仍在湖沼内 → 回 2:50 再循环；已请求停止 → 本段播完淡出 */
function onSwampBgmSegmentEnd(el) {
  if (swampBgmWanted && !swampBgmPendingStop) {
    seekSwampBgmToStart(el);
    if (el.paused) el.play()?.catch?.(() => {});
    return;
  }
  swampBgmPendingStop = false;
  swampBgmWanted = false;
  fadeOutSwampBgm(1.2);
}

/** 定位到循环起点 2:50（元数据未就绪时等 loadedmetadata） */
function seekSwampBgmToStart(el) {
  if (!el) return;
  const apply = () => {
    try {
      const dur = el.duration;
      let start = SWAMP_BGM_START_SEC;
      if (Number.isFinite(dur) && dur > 0) {
        start = Math.min(SWAMP_BGM_START_SEC, Math.max(0, dur - 0.05));
      }
      el.currentTime = start;
    } catch {
      /* 部分浏览器 seek 中会抛 */
    }
  };
  if (el.readyState >= 1 /* HAVE_METADATA */) apply();
  else el.addEventListener("loadedmetadata", apply, { once: true });
}

function isSwampBgmAudible() {
  return !!(swampBgmEl && !swampBgmEl.paused && swampBgmEl.volume > 0.001);
}

/**
 * 湖沼背景音乐：进入莫比斯原初湖沼起播，区间内循环。
 * 幂等：状态未变则不重复 fade / play。
 * 离开时：若本段 2:50–3:08 未播完，播完再停（不打断乐句）。
 * @param {boolean} active 是否应播放（玩家是否在湖沼内）
 * @param {{ fade?: number }} [opts] fade 秒数
 */
export function setSwampBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.2;
  const next = !!active && !muted;

  if (next) {
    const wasPendingOnly = swampBgmPendingStop && !swampBgmWanted;
    swampBgmPendingStop = false;

    if (swampBgmWanted && isSwampBgmAudible()) {
      if (swampBgmEl?.paused) {
        ensureAudio();
        swampBgmEl.play()?.catch?.(() => {});
      }
      return;
    }

    // 收尾过程中又回到湖沼：接上当前进度继续播，不重新 seek
    if (wasPendingOnly && isSwampBgmAudible()) {
      swampBgmWanted = true;
      return;
    }

    swampBgmWanted = true;
    pauseDefaultAmbience();
    if (musicBoxSession) stopMusicBox();
    // 与峡谷 BGM 互斥：进湖沼时压掉可能尚在收尾的峡谷段
    if (canyonBgmWanted || canyonBgmPendingStop || isCanyonBgmAudible()) {
      fadeOutCanyonBgm(0.6);
    }

    ensureAudio();
    const el = ensureSwampBgmEl();
    seekSwampBgmToStart(el);
    el.play()?.catch?.(() => {});
    fadeSwampAudioTo(el, SWAMP_BGM_VOLUME, fade);
    return;
  }

  // ---- 请求停止 ----
  if (!swampBgmWanted && !swampBgmPendingStop) return;

  swampBgmWanted = false;

  const el = swampBgmEl;
  if (
    el &&
    !el.paused &&
    el.currentTime >= SWAMP_BGM_START_SEC - 0.5 &&
    el.currentTime < SWAMP_BGM_END_SEC - 0.15
  ) {
    swampBgmPendingStop = true;
    return;
  }

  swampBgmPendingStop = false;
  fadeOutSwampBgm(fade);
}

export function isSwampBgmPlaying() {
  return !!(
    swampBgmEl &&
    !swampBgmEl.paused &&
    (swampBgmWanted || swampBgmPendingStop)
  );
}

/** 已离开湖沼，正在把当前 2:50–3:08 整段播完 */
export function isSwampBgmFinishing() {
  return !!(swampBgmPendingStop && swampBgmEl && !swampBgmEl.paused);
}

function fadeSwampAudioTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  swampBgmFading = true;
  const step = () => {
    if (!swampBgmEl || swampBgmEl !== el) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && swampBgmFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      swampBgmFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutSwampBgm(seconds = 1.4) {
  const el = swampBgmEl;
  swampBgmWanted = false;
  swampBgmPendingStop = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : SWAMP_BGM_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  swampBgmFading = true;
  const step = () => {
    if (!swampBgmEl || swampBgmEl !== el) return;
    // 若中途又要求播放，中止淡出
    if (swampBgmWanted) {
      swampBgmFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start * (1 - k);
    if (k < 1) {
      requestAnimationFrame(step);
      return;
    }
    el.volume = 0;
    try {
      el.pause();
      // 停在起点标记，下次 play 仍从 2:50
      el.currentTime = SWAMP_BGM_START_SEC;
    } catch {
      /* ignore */
    }
    swampBgmFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

function THREE_CLAMP(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function setMuted(next) {
  muted = next;
  if (muted) {
    stopMusicBox();
    stopAmbienceNodes();
    canyonBgmPendingStop = false;
    canyonBgmWanted = false;
    fadeOutCanyonBgm(0.2);
    swampBgmPendingStop = false;
    swampBgmWanted = false;
    fadeOutSwampBgm(0.2);
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
