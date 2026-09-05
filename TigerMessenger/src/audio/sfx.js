// =====================================================================
//  音频：简易 Web Audio 合成音效 + 白天轻环境点缀（零外部资源，可静音）
//  全局环境不含持续低频振荡；电车声仅在听距内按距离渐入/渐出
// =====================================================================
import { showToast } from "../ui/hud.js";

let audioCtx = null;
let muted = false;

// 弹琴老人 BGM（主人验收 2026-08-29）：music/Balmorhea-Remembrance.mp3，
// 从头播到 5:49（349.23s 取整），不循环
let musicBoxSession = null;
/** @type {HTMLAudioElement|null} */
let musicBoxEl = null;
const MUSIC_BOX_BGM_URL = new URL(
  "../../music/Balmorhea-Remembrance.mp3",
  import.meta.url
).href;
/** 从曲头开始 */
const MUSIC_BOX_START_SEC = 0;
/** 5 分 49 秒结束（不循环） */
const MUSIC_BOX_END_SEC = 5 * 60 + 49;
const MUSIC_BOX_VOLUME = 0.5;

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

// 电车搭乘 BGM：蓝车沿用原有 Tram.mp3 →《三亩地 - 城南花已开》；
// 红车使用 FKJ Tom Bailey - Drops.mp3 循环。
/** @type {HTMLAudioElement|null} */
let tramIntroEl = null;
/** @type {HTMLAudioElement|null} */
let tramMainEl = null;
/** @type {HTMLAudioElement|null} */
let tramRedRideEl = null;
/** 玩家仍在车上，应保持搭乘 BGM */
let tramRideWanted = false;
/** @type {'idle'|'intro'|'main'|'red'} */
let tramRidePhase = "idle";
let tramRideFading = false;
/** @type {'blue'|'red'} */
let tramRideVariant = "blue";
const TRAM_INTRO_URL = new URL(
  "../../music/Various Artists-Tram.mp3",
  import.meta.url
).href;
const TRAM_MAIN_URL = new URL(
  "../../music/三亩地 - 城南花已开.mp3",
  import.meta.url
).href;
const TRAM_RED_BGM_URL = new URL(
  "../../music/FKJ Tom Bailey - Drops.mp3",
  import.meta.url
).href;
/** Tram 采样只播开头 16 秒 */
const TRAM_INTRO_END_SEC = 16;
const TRAM_RIDE_VOLUME = 0.44;

// 环境点缀（风铃）；八音盒 / 场景 BGM 播放时 duck 压低。
// 乘坐电车时，电车搭乘曲优先于峡谷/湖沼等区域 BGM。
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
/** 场景已离开，但当前 18–53s 这一整段必须播完再停 */
let canyonBgmPendingStop = false;
let canyonBgmFading = false;
/** 主人 2026-09-05：BGM 只播一遍——本次进谷已播完整段（离开谷区才复位） */
let canyonBgmDone = false;
const CANYON_BGM_URL = new URL(
  "../../music/Gwenan Gibbard-風之傳說.mp3",
  import.meta.url
).href;
const CANYON_BGM_VOLUME = 0.42;
/** 进谷/水晶城 BGM 循环区间：第 18 秒 → 第 53 秒（约 35s 一整段） */
const CANYON_BGM_START_SEC = 18;
const CANYON_BGM_END_SEC = 53;

// 湖沼 BGM（同一首《風之傳說》）：进入莫比斯原初湖沼起播
/** @type {HTMLAudioElement|null} */
let swampBgmEl = null;
/** 场景仍要求播放（玩家在湖沼内） */
let swampBgmWanted = false;
/** 场景已离开，但当前 18–53s 这一整段必须播完再停 */
let swampBgmPendingStop = false;
let swampBgmFading = false;
/** 主人 2026-09-05：BGM 只播一遍——本次进湖沼已播完整段（离开才复位） */
let swampBgmDone = false;
const SWAMP_BGM_URL = new URL(
  "../../music/Gwenan Gibbard-風之傳說.mp3",
  import.meta.url
).href;
const SWAMP_BGM_VOLUME = 0.46;
/** 湖沼 BGM 循环区间：第 18 秒 → 第 53 秒（与水晶城、八音盒统一为同一情绪段） */
const SWAMP_BGM_START_SEC = 18;
const SWAMP_BGM_END_SEC = 53;

// 木马夜间潜入 BGM（鬼太鼓座 · 大太鼓）：
// 士兵行动中 + 玩家靠近场景才播；远离不启播；近距独占声道
/** @type {HTMLAudioElement|null} */
let infiltrationBgmEl = null;
/** 士兵是否在行动（任务进行中） */
let infiltrationMissionActive = false;
/** 当前是否因近距而占用声道 / 播放中 */
let infiltrationBgmWanted = false;
/** 距离滞回：已在听距内 */
let infiltrationInRange = false;
let infiltrationBgmFading = false;
const INFILTRATION_BGM_URL = new URL(
  "../../music/鬼太鼓座-大太鼓.mp3",
  import.meta.url
).href;
const INFILTRATION_BGM_VOLUME = 0.55;
/** 进入听距（看不到场景就别响） */
const INFILTRATION_BGM_ENTER_R = 42;
/** 离开听距（略大，防边界闪断） */
const INFILTRATION_BGM_EXIT_R = 52;
/** 此距离内满音量 */
const INFILTRATION_BGM_FULL_R = 16;

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
  // 潜入太鼓播放时电车静音
  if (infiltrationBgmWanted) {
    tramProximity = 0;
    tramNodes.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    return;
  }
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

// =====================================================================
//  苔庭鲸告警号角：低级文明发现高级文明飞行器 → 双音警报 + 低频战鼓心
//  每轮「鲸起 → 绳索拉回」只响一次；鲸落回地面后 rearm 允许下一轮再响。
// =====================================================================
let phalanxAlarmDone = false;

/**
 * 告警号角（每轮一次）：双音交替换频 + 低沉脉冲，像烽火台上的示警角。
 * @returns {boolean} 是否真的发声（静音/已响过/无音频上下文时 false）
 */
export function cuePhalanxAlarmOnce() {
  if (muted || phalanxAlarmDone) return false;
  phalanxAlarmDone = true;
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== "running") return true; // 上下文未就绪：静默放行，下轮再响
  // 双音交替 5 组（战争号角感）
  const hi = [622, 466, 622, 466, 622];
  hi.forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, dur: 0.21, type: "square", gain: 0.05, slide: -14 }), 40 + i * 240);
  });
  // 低音战鼓心：四下沉闷脉冲垫底
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playTone({ freq: 82, dur: 0.3, type: "sine", gain: 0.14, slide: -24 }), i * 300);
  }
  return true;
}

/** 鲸落回地面（新一轮循环前）重新武装告警，下轮再响 */
export function rearmPhalanxAlarm() {
  phalanxAlarmDone = false;
}

// =====================================================================
//  苔庭鲸每档下沉的「低鸣闷响」：巨鲸被绳索拽下一档的沉重顿挫
// =====================================================================
let whaleStepSoundCd = 0;

/** 每档下沉一声闷响（双振荡：65Hz 滑落 + 40Hz 顿挫），0.5s 防连发 */
export function sfxWhaleStep() {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  if (now < whaleStepSoundCd) return;
  whaleStepSoundCd = now + 0.5;
  playTone({ freq: 65, dur: 0.55, type: "sine", gain: 0.2, slide: -30 });
  playTone({ freq: 40, dur: 0.32, type: "triangle", gain: 0.16, slide: -12 });
}

// 雷声闪电：外部采样 music/纯音乐-雷声闪电.mp3（不再用合成噪声）
const THUNDER_SFX_URL = new URL(
  "../../music/纯音乐-雷声闪电.mp3",
  import.meta.url
).href;
/** 可重叠落雷的播放池 */
const THUNDER_POOL_SIZE = 4;
/** @type {HTMLAudioElement[]} */
const thunderPool = [];
let thunderPoolIdx = 0;

function ensureThunderPool() {
  if (thunderPool.length) return thunderPool;
  for (let i = 0; i < THUNDER_POOL_SIZE; i++) {
    const el = new Audio(THUNDER_SFX_URL);
    el.preload = "auto";
    el.loop = false;
    el.volume = 0;
    el.crossOrigin = "anonymous";
    thunderPool.push(el);
  }
  return thunderPool;
}

/**
 * 雷鸣 / 闪电声：播放 `music/纯音乐-雷声闪电.mp3`。
 * 距离越远越晚、越轻（光先到、声后到）；不再使用合成噪声。
 * @param {{ distance?: number }} [opts] 与听者水平距离（世界单位）
 */
export function sfxThunder(opts = {}) {
  if (muted) return;
  ensureAudio(); // 用户手势后恢复，便于 HTMLAudio 播放

  const distance = Math.max(0, Number(opts.distance) || 8);
  // 声速近似：游戏单位约 0.04s/单位，夹在 0.04–1.0s
  const delayMs = Math.min(1000, Math.max(40, (0.05 + distance * 0.038) * 1000));
  // 近雷更响，远雷更轻
  const near = Math.max(0, Math.min(1, 1 - distance / 28));
  const volume = THREE_CLAMP(0.22 + near * 0.58, 0.08, 0.85);

  window.setTimeout(() => {
    if (muted) return;
    const pool = ensureThunderPool();
    const el = pool[thunderPoolIdx % pool.length];
    thunderPoolIdx += 1;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.volume = volume;
    el.play()?.catch?.(() => {});
  }, delayMs);
}

/**
 * 环境音 duck：八音盒播放时压低风铃等背景点缀，结束后恢复。
 * @param {number} level 0..1
 */
function setAmbienceDuck(level) {
  ambienceDuck = Math.max(0, Math.min(1, level));
}

function ensureMusicBoxEl() {
  if (musicBoxEl) {
    // 曲目若已切换，刷新 src
    if (musicBoxEl.src !== MUSIC_BOX_BGM_URL && !musicBoxEl.src.endsWith(encodeURI("Balmorhea-Remembrance.mp3")) && !musicBoxEl.src.includes("Balmorhea-Remembrance")) {
      try {
        musicBoxEl.src = MUSIC_BOX_BGM_URL;
        musicBoxEl.load();
      } catch {
        /* ignore */
      }
    }
    return musicBoxEl;
  }
  const el = new Audio(MUSIC_BOX_BGM_URL);
  el.preload = "auto";
  el.loop = false; // 不循环
  el.volume = MUSIC_BOX_VOLUME;
  el.crossOrigin = "anonymous";
  el.addEventListener("timeupdate", () => {
    if (!musicBoxSession || muted || el.paused) return;
    // 播到 4:33 停止，不循环
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
 * 弹琴老人 BGM：播放 `music/Balmorhea-Remembrance.mp3`（0 → 5:49，不循环）。
 * 必须在用户按键手势里同步调用 play()，避免浏览器拦截异步播放。
 * 返回 true 表示开始播放；正在播放时再次调用会停止并返回 false。
 * @param {{onNote?:(index:number)=>void, onEnded?:()=>void}} hooks
 */
export function toggleMusicBox(hooks = {}) {
  if (musicBoxSession) {
    stopMusicBox();
    return false;
  }
  if (muted) return false;
  // 潜入太鼓 / 蓝盔攻城曲独占时不播八音盒
  if (infiltrationBgmWanted || siegeAssaultWanted) return false;
  ensureAudio();

  // 压低默认环境点缀
  setAmbienceDuck(AMBIENCE_DUCK_MUSIC_BOX);

  const el = ensureMusicBoxEl();
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

  // 同步在用户手势中 play（不可放到 await/then，否则会被浏览器拦截）
  try {
    el.pause();
    el.currentTime = MUSIC_BOX_START_SEC;
  } catch {
    /* ignore */
  }
  el.volume = MUSIC_BOX_VOLUME;
  const playP = el.play?.();
  if (playP && typeof playP.then === "function") {
    playP.catch((err) => {
      console.warn("[musicBox] play failed", err);
      if (musicBoxSession === session) finishMusicBox(session);
    });
  }

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
  if (padStarted || muted || infiltrationBgmWanted || siegeAssaultWanted) return;
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
  if (
    muted ||
    infiltrationBgmWanted ||
    leviathanStormWanted ||
    leviathanCueWanted ||
    bubblePodCannonWanted ||
    siegeAssaultWanted
  ) {
    return;
  }
  ambienceDuck = 1;
  if (!padStarted) startAmbience();
}

function ensureCanyonBgmEl() {
  if (canyonBgmEl) return canyonBgmEl;
  const el = new Audio(CANYON_BGM_URL);
  // 主人 2026-09-05：BGM 只播一遍——到 57s 段尾即收，不再区间回环
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
 * 区间终点（主人 2026-09-05：BGM 只播一遍）——整段走完即淡出收尾，
 * 不再回 21s 回环；是否重播由离开/再进触发区决定。
 */
function onCanyonBgmSegmentEnd(el) {
  canyonBgmPendingStop = false;
  canyonBgmWanted = false;
  canyonBgmDone = true;
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
 * 关闭时：若本段 18–53s 未播完，会播完再停（驶出水晶城不打断）。
 * @param {boolean} active 是否应播放
 * @param {{ fade?: number }} [opts] fade 秒数
 */
export function setCanyonApproachBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.2;
  // 电车是移动中的主场景：保留峡谷的 wanted 状态，实际声道让给电车；
  // 下车后主循环再次调用本函数时，峡谷曲会从这里恢复。
  // 本轮已播完整段（canyonBgmDone）则不再保留 wanted——不回环。
  if (active && !canyonBgmDone && tramRideWanted && !infiltrationBgmWanted && !siegeAssaultWanted) {
    canyonBgmWanted = true;
    canyonBgmPendingStop = false;
    if (canyonBgmEl && !canyonBgmEl.paused) {
      try {
        canyonBgmEl.pause();
        canyonBgmEl.volume = 0;
      } catch {
        /* ignore */
      }
    }
    return;
  }
  // 木马潜入太鼓 / 蓝盔攻城曲独占时不抢播
  const next = !!active && !muted && !infiltrationBgmWanted && !siegeAssaultWanted;

  if (next) {
    // 主人 2026-09-05：本轮进谷已播完整段就不再重播（离开谷区才复位）
    if (canyonBgmDone) return;
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

    // 收尾过程中又进谷：接上当前进度继续播完这一遍，不重新 seek
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
    // 峡谷优先：暂停电车搭乘曲（下车 wanted 仍保留，离谷后可恢复）
    if (tramRidePhase !== "idle") {
      for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
        if (!el) continue;
        try {
          el.pause();
          el.volume = 0;
        } catch {
          /* ignore */
        }
      }
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
    // 本来就没在播（含整段已播完）：离开触发区，复位后下次进谷可重播一遍
    canyonBgmDone = false;
    return;
  }

  canyonBgmWanted = false;
  canyonBgmDone = false;

  // 本段 18–53 尚未走完：标记 pending，播到 53s 再停
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
  // 离谷后若仍在电车上，恢复搭乘主曲
  resumeTramRideBgmIfWanted();
}

export function isCanyonBgmPlaying() {
  return !!(
    canyonBgmEl &&
    !canyonBgmEl.paused &&
    (canyonBgmWanted || canyonBgmPendingStop)
  );
}

/** 已驶离触发区，正在把当前 18–53s 整段播完（鸟群伴飞窗口） */
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
    else resumeTramRideBgmIfWanted();
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
    else resumeTramRideBgmIfWanted();
  };
  requestAnimationFrame(step);
}

// =====================================================================
//  湖沼 BGM：进入莫比斯原初湖沼 → 循环《風之傳說》18–53s（与水晶城、八音盒统一区间）
//  同构：整段播完才停，离开不打断；与峡谷/八音盒互斥（先停对方）
// =====================================================================

/** 任一区段 BGM（峡谷 / 湖沼 / 潜入太鼓 / 电车搭乘 / 苔庭鲸风暴 / 气泡艇开炮 / 蓝盔攻城）仍在占用声道时，默认环境音不得恢复 */
function anySegmentBgmEngaged() {
  return (
    canyonBgmWanted ||
    canyonBgmPendingStop ||
    swampBgmWanted ||
    swampBgmPendingStop ||
    infiltrationBgmWanted ||
    tramRideWanted ||
    leviathanStormWanted ||
    leviathanCueWanted ||
    bubblePodCannonWanted ||
    siegeAssaultWanted
  );
}

/** 电车上暂停区域曲，但不清除区域 wanted，便于下车后恢复。 */
function suspendRegionalBgmForTram() {
  for (const el of [canyonBgmEl, swampBgmEl]) {
    if (!el || el.paused) continue;
    try {
      el.pause();
      el.volume = 0;
    } catch {
      /* ignore */
    }
  }
}

/** 乘车是当前场景：攻城/潜入只保留 wanted，声道让给电车曲。 */
function suspendExclusiveBgmForTram() {
  suspendRegionalBgmForTram();
  for (const el of [siegeAssaultEl, infiltrationBgmEl]) {
    if (!el || el.paused) continue;
    try {
      el.pause();
      el.volume = 0;
    } catch {
      /* ignore */
    }
  }
}

function resumeExclusiveBgmAfterTram() {
  if (muted) return;
  if (siegeAssaultWanted && siegeAssaultEl && !siegeAssaultEl.ended) {
    siegeAssaultEl.volume = SIEGE_ASSAULT_VOLUME;
    siegeAssaultEl.play()?.catch?.(() => {});
    return;
  }
  // 只播一遍：已播完的曲子不在下车时复活
  if (infiltrationBgmWanted && infiltrationBgmEl && !infiltrationBgmEl.ended) {
    infiltrationBgmEl.volume = INFILTRATION_BGM_VOLUME;
    infiltrationBgmEl.play()?.catch?.(() => {});
  }
}

// =====================================================================
//  电车搭乘 BGM：蓝车 = Various Artists-Tram.mp3（0–16s）→ 三亩地-城南花已开；
//  红车 = FKJ Tom Bailey - Drops.mp3（循环）。
// =====================================================================

function ensureTramIntroEl() {
  if (tramIntroEl) return tramIntroEl;
  const el = new Audio(TRAM_INTRO_URL);
  el.preload = "auto";
  el.loop = false;
  el.volume = 0;
  el.crossOrigin = "anonymous";
  el.addEventListener("timeupdate", () => {
    if (!tramRideWanted || tramRidePhase !== "intro" || muted) return;
    if (el.currentTime < TRAM_INTRO_END_SEC - 0.05) return;
    // 头 16 秒播完 → 切主曲
    advanceTramRideToMain();
  });
  el.addEventListener("ended", () => {
    if (!tramRideWanted || tramRidePhase !== "intro" || muted) return;
    advanceTramRideToMain();
  });
  tramIntroEl = el;
  return el;
}

function ensureTramMainEl() {
  if (tramMainEl) return tramMainEl;
  const el = new Audio(TRAM_MAIN_URL);
  el.preload = "auto";
  el.loop = true;
  el.volume = 0;
  el.crossOrigin = "anonymous";
  tramMainEl = el;
  return el;
}

function ensureTramRedRideEl() {
  if (tramRedRideEl) return tramRedRideEl;
  const el = new Audio(TRAM_RED_BGM_URL);
  el.preload = "auto";
  el.loop = true;
  el.volume = 0;
  el.crossOrigin = "anonymous";
  tramRedRideEl = el;
  return el;
}

function stopTramRideElements() {
  tramRidePhase = "idle";
  tramRideFading = false;
  for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
    if (!el) continue;
    try {
      el.pause();
      el.volume = 0;
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  tramRideVariant = "blue";
}

function advanceTramRideToMain() {
  if (!tramRideWanted || muted) return;
  suspendExclusiveBgmForTram();
  const intro = tramIntroEl;
  if (intro) {
    try {
      intro.pause();
      intro.volume = 0;
    } catch {
      /* ignore */
    }
  }
  tramRidePhase = "main";
  ensureAudio();
  const main = ensureTramMainEl();
  try {
    main.currentTime = 0;
  } catch {
    /* ignore */
  }
  main.volume = TRAM_RIDE_VOLUME;
  main.play()?.catch?.(() => {});
}

/**
 * 电车搭乘背景音乐。
 * 上车：先播 Tram.mp3 头 16 秒，再循环《三亩地 - 城南花已开》；下车：停止。
 * 乘车时电车曲占主声道；峡谷/湖沼/攻城只保留 wanted，下车后再恢复。
 * @param {boolean} active
 * @param {{ fade?: number, skipIntro?: boolean, variant?: 'red'|'blue' }} [opts]
 */
export function setTramRideBgm(active, opts = {}) {
  const fade = opts.fade ?? 0.7;
  const next = !!active && !muted;

  if (next) {
    const requestedVariant = opts.variant === "red" ? "red" : "blue";
    // 全局只允许一条搭乘曲；切换车辆颜色时先清掉上一条，避免叠播。
    if (tramRidePhase !== "idle" && tramRideVariant !== requestedVariant) {
      stopTramRideElements();
    }
    tramRideVariant = requestedVariant;
    tramRideWanted = true;
    if (requestedVariant === "red") {
      if (tramRidePhase === "red") {
        if (tramRedRideEl) {
          ensureAudio();
          suspendExclusiveBgmForTram();
          if (tramRedRideEl.volume < TRAM_RIDE_VOLUME * 0.5) {
            tramRedRideEl.volume = TRAM_RIDE_VOLUME;
          }
          if (tramRedRideEl.paused) tramRedRideEl.play()?.catch?.(() => {});
        }
        return;
      }
      pauseDefaultAmbience();
      if (musicBoxSession) stopMusicBox();
      suspendExclusiveBgmForTram();
      ensureAudio();
      tramRidePhase = "red";
      const redRide = ensureTramRedRideEl();
      try {
        redRide.currentTime = 0;
      } catch {
        /* ignore */
      }
      redRide.volume = 0;
      redRide.play()?.catch?.(() => {});
      fadeTramRideAudioTo(redRide, TRAM_RIDE_VOLUME, fade);
      // 预加载蓝车链路，不改变蓝车原曲逻辑。
      ensureTramIntroEl();
      ensureTramMainEl();
      return;
    }
    if (tramRidePhase === "intro" || tramRidePhase === "main") {
      const el = tramRidePhase === "intro" ? tramIntroEl : tramMainEl;
      if (el) {
        ensureAudio();
        suspendExclusiveBgmForTram();
        if (el.volume < TRAM_RIDE_VOLUME * 0.5) el.volume = TRAM_RIDE_VOLUME;
        if (el.paused) el.play()?.catch?.(() => {});
      }
      return;
    }
    pauseDefaultAmbience();
    if (musicBoxSession) stopMusicBox();
    // 区域/攻城 wanted 保留，声道让给蓝车 Tram.mp3 → 城南花已开。
    suspendExclusiveBgmForTram();

    ensureAudio();
    if (opts.skipIntro) {
      advanceTramRideToMain();
      return;
    }
    tramRidePhase = "intro";
    const intro = ensureTramIntroEl();
    try {
      intro.currentTime = 0;
    } catch {
      /* ignore */
    }
    intro.volume = 0;
    intro.play()?.catch?.(() => {});
    fadeTramRideAudioTo(intro, TRAM_RIDE_VOLUME, fade);
    // 预加载主曲
    ensureTramMainEl();
    return;
  }

  // ---- 下车 / 关闭 ----
  if (!tramRideWanted && tramRidePhase === "idle") return;
  tramRideWanted = false;
  fadeOutTramRideBgm(fade);
}

/** 峡谷/潜入结束后，若仍在车上则恢复搭乘曲 */
export function resumeTramRideBgmIfWanted() {
  if (!tramRideWanted || muted) return;
  if (tramRideVariant === "red" && tramRidePhase === "red") {
    if (tramRedRideEl && !tramRedRideEl.paused) return;
    pauseDefaultAmbience();
    ensureAudio();
    const redRide = ensureTramRedRideEl();
    redRide.volume = TRAM_RIDE_VOLUME;
    redRide.play()?.catch?.(() => {});
    return;
  }
  if (tramRidePhase === "intro" && tramIntroEl && !tramIntroEl.paused) return;
  if (tramRidePhase === "main" && tramMainEl && !tramMainEl.paused) return;
  pauseDefaultAmbience();
  // intro 未播完：从断点续播；否则接主曲
  if (
    tramRidePhase === "intro" &&
    tramIntroEl &&
    tramIntroEl.currentTime < TRAM_INTRO_END_SEC - 0.12
  ) {
    ensureAudio();
    tramIntroEl.volume = TRAM_RIDE_VOLUME;
    tramIntroEl.play()?.catch?.(() => {});
    return;
  }
  advanceTramRideToMain();
}

export function isTramRideBgmPlaying() {
  return !!(
    tramRideWanted &&
    ((tramIntroEl && !tramIntroEl.paused) ||
      (tramMainEl && !tramMainEl.paused) ||
      (tramRedRideEl && !tramRedRideEl.paused))
  );
}

function fadeTramRideAudioTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  tramRideFading = true;
  const step = () => {
    if (el !== tramIntroEl && el !== tramMainEl && el !== tramRedRideEl) return;
    if (!tramRideWanted && end > 0) {
      tramRideFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && tramRideFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      tramRideFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutTramRideBgm(seconds = 0.9) {
  tramRideWanted = false;
  const el =
    tramRidePhase === "intro"
      ? tramIntroEl
      : tramRidePhase === "main"
        ? tramMainEl
        : tramRidePhase === "red"
          ? tramRedRideEl
        : tramIntroEl || tramMainEl;
  if (!el || (el.paused && el.volume <= 0.001)) {
    stopTramRideElements();
    resumeExclusiveBgmAfterTram();
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : TRAM_RIDE_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  tramRideFading = true;
  const step = () => {
    if (tramRideWanted) {
      tramRideFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start * (1 - k);
    if (k < 1) {
      requestAnimationFrame(step);
      return;
    }
    stopTramRideElements();
    resumeExclusiveBgmAfterTram();
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

// =====================================================================
//  木马夜间潜入 BGM：鬼太鼓座 · 大太鼓
//  士兵开始行动起播，返回木马腹内停止；播放时暂停其他音响
// =====================================================================

function ensureInfiltrationBgmEl() {
  if (infiltrationBgmEl) return infiltrationBgmEl;
  const el = new Audio(INFILTRATION_BGM_URL);
  // 主人 2026-09-05：BGM 只播一遍——整首走完即止，任务结束才复位
  el.loop = false;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  // 播完即解除独占：wanted 滞留会挡住八音盒/气泡炮/峡谷湖沼的重启
  el.addEventListener("ended", () => {
    infiltrationBgmWanted = false;
  });
  infiltrationBgmEl = el;
  return el;
}

function isInfiltrationBgmAudible() {
  return !!(
    infiltrationBgmEl &&
    !infiltrationBgmEl.paused &&
    infiltrationBgmEl.volume > 0.001
  );
}

/** 强制暂停其他 BGM / 环境 / 电车（潜入太鼓独占） */
function pauseOthersForInfiltration() {
  pauseDefaultAmbience();
  if (musicBoxSession) stopMusicBox();
  // 峡谷 / 湖沼：立刻掐掉，不播完收尾（潜入优先）
  canyonBgmPendingStop = false;
  canyonBgmWanted = false;
  if (canyonBgmEl && !canyonBgmEl.paused) {
    try {
      canyonBgmEl.pause();
      canyonBgmEl.volume = 0;
    } catch {
      /* ignore */
    }
  }
  swampBgmPendingStop = false;
  swampBgmWanted = false;
  if (swampBgmEl && !swampBgmEl.paused) {
    try {
      swampBgmEl.pause();
      swampBgmEl.volume = 0;
    } catch {
      /* ignore */
    }
  }
  leviathanStormWanted = false;
  leviathanCueWanted = false;
  for (const el of [leviathanStormEl, leviathanCueEl]) {
    if (!el || el.paused) continue;
    try {
      el.pause();
      el.volume = 0;
    } catch {
      /* ignore */
    }
  }
  bubblePodCannonWanted = false;
  if (bubblePodCannonEl && !bubblePodCannonEl.paused) {
    try {
      bubblePodCannonEl.pause();
      bubblePodCannonEl.volume = 0;
    } catch {
      /* ignore */
    }
  }
  if (siegeAssaultWanted || isSiegeAssaultAudible()) {
    fadeOutSiegeAssaultBgm(0.7);
  }
  // 电车搭乘曲：暂停声道（tramRideWanted 保留，任务结束后可恢复）
  for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
    if (!el) continue;
    try {
      el.pause();
      el.volume = 0;
    } catch {
      /* ignore */
    }
  }
  tramProximity = 0;
  if (tramNodes?.master && audioCtx) {
    tramNodes.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.04);
  }
}

/**
 * 标记潜入任务是否进行中（士兵出动 / 回腹）。
 * 真正起播由 updateInfiltrationBgm 按玩家距离决定——看不到场景不响。
 * @param {boolean} active
 * @param {{ fade?: number }} [opts]
 */
export function setInfiltrationBgm(active, opts = {}) {
  const fade = opts.fade ?? 0.8;
  const next = !!active && !muted;
  if (next) {
    infiltrationMissionActive = true;
    // 新一轮任务允许重播一遍：清掉上一首的 ended 痕迹
    if (infiltrationBgmEl) {
      try {
        if (infiltrationBgmEl.ended) infiltrationBgmEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    // 不立即 play：等本帧/后续 updateInfiltrationBgm 判定距离
    return;
  }
  // 任务结束（回腹）：无论远近都停
  infiltrationMissionActive = false;
  infiltrationInRange = false;
  if (!infiltrationBgmWanted && !isInfiltrationBgmAudible()) return;
  infiltrationBgmWanted = false;
  fadeOutInfiltrationBgm(fade);
}

/**
 * 按玩家与木马/圣城场景的距离更新潜入太鼓。
 * 士兵行动中 + 进入听距才播放并独占声道；离开听距暂停并恢复其他音响。
 * @param {THREE.Vector3|{x:number,y:number,z:number}|null|undefined} listenerPos
 * @param {THREE.Vector3|{x:number,y:number,z:number}|null|undefined} sourcePos 木马/场景锚点
 */
export function updateInfiltrationBgm(listenerPos, sourcePos) {
  if (tramRideWanted) return;
  // 蓝盔进攻曲独占到「夜晚鼓声响起」：交接前不启太鼓
  if (siegeAssaultWanted && !siegeAssaultHandoff) return;
  if (!infiltrationMissionActive || muted) {
    if (infiltrationBgmWanted || isInfiltrationBgmAudible()) {
      infiltrationBgmWanted = false;
      infiltrationInRange = false;
      fadeOutInfiltrationBgm(0.6);
    }
    return;
  }
  if (
    !listenerPos ||
    !sourcePos ||
    !Number.isFinite(listenerPos.x) ||
    !Number.isFinite(sourcePos.x)
  ) {
    return;
  }

  const dx = listenerPos.x - sourcePos.x;
  const dy = listenerPos.y - sourcePos.y;
  const dz = listenerPos.z - sourcePos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // 滞回：进 ENTER 才开听，出 EXIT 才关
  if (infiltrationInRange) {
    if (dist > INFILTRATION_BGM_EXIT_R) infiltrationInRange = false;
  } else if (dist <= INFILTRATION_BGM_ENTER_R) {
    infiltrationInRange = true;
  }

  if (!infiltrationInRange) {
    // 离得远：不播 / 停播，让出声道
    if (infiltrationBgmWanted || isInfiltrationBgmAudible()) {
      infiltrationBgmWanted = false;
      silenceInfiltrationBgmKeepMission(0.7);
    }
    return;
  }

  // 近距：满音量 → 边缘衰减
  let gain = 1;
  if (dist > INFILTRATION_BGM_FULL_R) {
    const span = Math.max(
      0.001,
      INFILTRATION_BGM_ENTER_R - INFILTRATION_BGM_FULL_R
    );
    gain = THREE_CLAMP(1 - (dist - INFILTRATION_BGM_FULL_R) / span, 0, 1);
  }
  const targetVol = INFILTRATION_BGM_VOLUME * gain;

  // 只播一遍：整首已播完（ended）就不在本轮任务里再起播；
  // 离开听距的暂停不算完，回到听距会从暂停处续完这一遍
  if (
    (!infiltrationBgmWanted || !isInfiltrationBgmAudible()) &&
    !infiltrationBgmEl?.ended
  ) {
    infiltrationBgmWanted = true;
    pauseOthersForInfiltration();
    ensureAudio();
    const el = ensureInfiltrationBgmEl();
    // 仅首次进入听距时从头播，避免反复 seek 打断鼓点
    if (!isInfiltrationBgmAudible()) {
      try {
        if (el.currentTime < 0.05 || el.paused) el.currentTime = 0;
      } catch {
        /* ignore */
      }
      el.play()?.catch?.(() => {});
    }
    el.volume = targetVol;
    return;
  }

  // 已在播：只跟距离改音量（不每帧重 fade 动画，避免抢）
  if (infiltrationBgmEl && !infiltrationBgmFading) {
    infiltrationBgmEl.volume = targetVol;
  }
}

/**
 * 仍在任务中但玩家走远：暂停太鼓并恢复其他音响（任务标记保留）。
 */
function silenceInfiltrationBgmKeepMission(seconds = 0.7) {
  const el = infiltrationBgmEl;
  infiltrationBgmWanted = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : INFILTRATION_BGM_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  infiltrationBgmFading = true;
  const step = () => {
    if (!infiltrationBgmEl || infiltrationBgmEl !== el) return;
    // 又靠近了：中止静音
    if (infiltrationBgmWanted) {
      infiltrationBgmFading = false;
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
      // 保留进度，回来接着听（比每次从头更自然）
    } catch {
      /* ignore */
    }
    infiltrationBgmFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

export function isInfiltrationBgmPlaying() {
  return !!(
    infiltrationBgmEl &&
    !infiltrationBgmEl.paused &&
    infiltrationBgmWanted
  );
}

/** 潜入任务是否仍在进行（不论玩家远近） */
export function isInfiltrationMissionActive() {
  return !!infiltrationMissionActive;
}

function fadeInfiltrationAudioTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  infiltrationBgmFading = true;
  const step = () => {
    if (!infiltrationBgmEl || infiltrationBgmEl !== el) return;
    if (!infiltrationBgmWanted && end > 0) {
      infiltrationBgmFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && infiltrationBgmFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      infiltrationBgmFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutInfiltrationBgm(seconds = 1.0) {
  const el = infiltrationBgmEl;
  infiltrationBgmWanted = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : INFILTRATION_BGM_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  infiltrationBgmFading = true;
  const step = () => {
    if (!infiltrationBgmEl || infiltrationBgmEl !== el) return;
    if (infiltrationBgmWanted) {
      infiltrationBgmFading = false;
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
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    infiltrationBgmFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

function ensureSwampBgmEl() {
  if (swampBgmEl) return swampBgmEl;
  const el = new Audio(SWAMP_BGM_URL);
  // 主人 2026-09-05：BGM 只播一遍——到 53s 段尾即收，不再区间回环
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

/**
 * 区间终点（主人 2026-09-05：BGM 只播一遍）——整段走完即淡出收尾，
 * 不再回 18s 回环；是否重播由离开/再进湖沼决定。
 */
function onSwampBgmSegmentEnd(el) {
  swampBgmPendingStop = false;
  swampBgmWanted = false;
  swampBgmDone = true;
  fadeOutSwampBgm(1.2);
}

/** 定位到循环起点 18s（元数据未就绪时等 loadedmetadata） */
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
 * 离开时：若本段 18–53s 未播完，播完再停（不打断乐句）。
 * @param {boolean} active 是否应播放（玩家是否在湖沼内）
 * @param {{ fade?: number }} [opts] fade 秒数
 */
export function setSwampBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.2;
  // 电车上保留湖沼 wanted 状态，但不让区域 BGM 抢主声道。
  // 本轮已播完整段（swampBgmDone）则不再保留 wanted——不回环。
  if (active && !swampBgmDone && tramRideWanted && !infiltrationBgmWanted && !siegeAssaultWanted) {
    swampBgmWanted = true;
    swampBgmPendingStop = false;
    if (swampBgmEl && !swampBgmEl.paused) {
      try {
        swampBgmEl.pause();
        swampBgmEl.volume = 0;
      } catch {
        /* ignore */
      }
    }
    return;
  }
  // 木马潜入太鼓 / 蓝盔攻城曲独占时不抢播
  const next = !!active && !muted && !infiltrationBgmWanted && !siegeAssaultWanted;

  if (next) {
    // 主人 2026-09-05：本轮进湖沼已播完整段就不再重播（离开才复位）
    if (swampBgmDone) return;
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
  if (!swampBgmWanted && !swampBgmPendingStop) {
    // 本来就没在播（含整段已播完）：离开触发区，复位后下次进湖沼可重播一遍
    swampBgmDone = false;
    return;
  }

  swampBgmWanted = false;
  swampBgmDone = false;

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

/** 已离开湖沼，正在把当前 18–53s 整段播完 */
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
      // 停在起点标记，下次 play 仍从 18s
      el.currentTime = SWAMP_BGM_START_SEC;
    } catch {
      /* ignore */
    }
    swampBgmFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
  };
  requestAnimationFrame(step);
}

// =====================================================================
//  苔庭鲸升空音乐：
//  - 升起前 cue 一次《狂风暴雨》（不循环）
//  - 升起过程 BGM：《Terminator 2》循环
// =====================================================================
/** @type {HTMLAudioElement|null} */
let leviathanStormEl = null;
/** @type {HTMLAudioElement|null} */
let leviathanCueEl = null;
let leviathanStormWanted = false;
/** 主人 2026-09-05：BGM 只播一遍——本轮升空已播完整首（收飞才复位） */
let leviathanStormDone = false;
let leviathanCueWanted = false;
let leviathanStormFading = false;
const LEVIATHAN_STORM_CUE_URL = new URL(
  "../../music/CV君言君与-狂风暴雨.mp3",
  import.meta.url
).href;
const LEVIATHAN_STORM_BGM_URL = new URL(
  "../../music/The Original Movies Orchestra (电影原声带)-Terminator 2.mp3",
  import.meta.url
).href;
const LEVIATHAN_STORM_VOLUME = 0.5;
const LEVIATHAN_CUE_VOLUME = 0.52;

function makeLeviathanAudio(url, loop) {
  if (typeof Audio === "undefined") return null;
  const el = new Audio(url);
  el.loop = !!loop;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  return el;
}

function ensureLeviathanStormEl() {
  if (leviathanStormEl) return leviathanStormEl;
  // 主人 2026-09-05：BGM 只播一遍——整首走完即止（收飞/落回才复位）
  leviathanStormEl = makeLeviathanAudio(LEVIATHAN_STORM_BGM_URL, false);
  leviathanStormEl?.addEventListener("ended", () => {
    leviathanStormDone = true;
  });
  return leviathanStormEl;
}

function ensureLeviathanCueEl() {
  if (leviathanCueEl) return leviathanCueEl;
  const el = makeLeviathanAudio(LEVIATHAN_STORM_CUE_URL, false);
  if (el) {
    el.addEventListener("ended", () => {
      leviathanCueWanted = false;
    });
  }
  leviathanCueEl = el;
  return el;
}

function isLeviathanStormAudible() {
  return !!(
    leviathanStormEl &&
    !leviathanStormEl.paused &&
    leviathanStormEl.volume > 0.001
  );
}

function pauseOthersForLeviathanStorm() {
  pauseDefaultAmbience();
  if (musicBoxSession) stopMusicBox();
  if (bubblePodCannonWanted || isBubblePodCannonAudible()) {
    fadeOutBubblePodCannonBgm(0.45);
  }
  if (siegeAssaultWanted || isSiegeAssaultAudible()) {
    fadeOutSiegeAssaultBgm(0.45);
  }
  if (swampBgmWanted || swampBgmPendingStop || isSwampBgmAudible()) {
    fadeOutSwampBgm(0.5);
  }
  if (canyonBgmWanted || canyonBgmPendingStop) {
    canyonBgmPendingStop = false;
    canyonBgmWanted = false;
    fadeOutCanyonBgm(0.5);
  }
  if (tramRidePhase !== "idle") {
    for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
      if (!el) continue;
      try {
        el.pause();
        el.volume = 0;
      } catch {
        /* ignore */
      }
    }
  }
}

function stopLeviathanCue(fade = 0.35) {
  leviathanCueWanted = false;
  const el = leviathanCueEl;
  if (!el) return;
  if (el.paused && el.volume <= 0.001) return;
  const start = el.volume;
  const t0 = performance.now();
  const dur = Math.max(0.05, fade) * 1000;
  const step = () => {
    if (leviathanCueWanted) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start * (1 - k);
    if (k < 1) {
      requestAnimationFrame(step);
      return;
    }
    el.volume = 0;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  };
  requestAnimationFrame(step);
}

/**
 * 升起前触发一次《狂风暴雨》：强制从曲头起播，不循环。
 * 同一轮升空里重复调用不会重头。
 */
export function cueLeviathanStormOnce() {
  if (muted || siegeAssaultWanted) return false;
  if (leviathanCueWanted && leviathanCueEl && !leviathanCueEl.paused) return false;
  const el = ensureLeviathanCueEl();
  if (!el) return false;
  leviathanCueWanted = true;
  pauseOthersForLeviathanStorm();
  ensureAudio();
  try {
    el.currentTime = 0;
  } catch {
    /* ignore */
  }
  el.volume = 0;
  el.play()?.catch?.(() => {});
  const t0 = performance.now();
  const start = 0;
  const end = LEVIATHAN_CUE_VOLUME;
  const dur = 450;
  const step = () => {
    if (!leviathanCueWanted || !leviathanCueEl) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return true;
}

/**
 * 升空期间循环 Terminator 2。起播时压掉前奏《狂风暴雨》。
 * @param {boolean} active
 * @param {{ fade?: number }} [opts]
 */
export function setLeviathanStormBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.1;
  const next = !!active && !muted && !siegeAssaultWanted;
  if (next) {
    leviathanStormWanted = true;
    // 主人 2026-09-05：本轮升空已播完整首就不再重播（收飞才复位）。
    // 战斗期每帧都会带 active 调进来，靠这个闩锁防“没完没了”。
    if (leviathanStormDone) return;
    if (isLeviathanStormAudible()) {
      if (leviathanStormEl?.paused) {
        ensureAudio();
        leviathanStormEl.play()?.catch?.(() => {});
      }
      return;
    }
    const el = ensureLeviathanStormEl();
    if (!el) return;
    stopLeviathanCue(0.4);
    pauseOthersForLeviathanStorm();
    ensureAudio();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play()?.catch?.(() => {});
    fadeLeviathanStormTo(el, LEVIATHAN_STORM_VOLUME, fade);
    return;
  }
  if (!leviathanStormWanted && !isLeviathanStormAudible()) {
    // 已停/已播完：本轮收尾，复位闩锁，下次升空重播一遍
    leviathanStormDone = false;
    stopLeviathanCue(fade);
    return;
  }
  leviathanStormWanted = false;
  leviathanStormDone = false;
  stopLeviathanCue(0.3);
  fadeOutLeviathanStormBgm(fade);
}

export function isLeviathanStormBgmPlaying() {
  return !!(leviathanStormWanted && isLeviathanStormAudible());
}

function fadeLeviathanStormTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  leviathanStormFading = true;
  const step = () => {
    if (!leviathanStormEl || leviathanStormEl !== el) return;
    if (!leviathanStormWanted && end > 0) {
      leviathanStormFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && leviathanStormFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      leviathanStormFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutLeviathanStormBgm(seconds = 1.2) {
  const el = leviathanStormEl;
  leviathanStormWanted = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : LEVIATHAN_STORM_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  leviathanStormFading = true;
  const step = () => {
    if (!leviathanStormEl || leviathanStormEl !== el) return;
    if (leviathanStormWanted) {
      leviathanStormFading = false;
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
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    leviathanStormFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    else resumeTramRideBgmIfWanted();
  };
  requestAnimationFrame(step);
}

function THREE_CLAMP(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// =====================================================================
//  气泡艇开炮 BGM：黄英华-Opening.mp3
//  第一次开炮起播并循环；连发不重头；下艇淡出
// =====================================================================
/** @type {HTMLAudioElement|null} */
let bubblePodCannonEl = null;
let bubblePodCannonWanted = false;
let bubblePodCannonFading = false;
export const BUBBLE_POD_CANNON_BGM_URL = new URL(
  "../../music/黄英华-Opening.mp3",
  import.meta.url
).href;
const BUBBLE_POD_CANNON_VOLUME = 0.5;

function ensureBubblePodCannonEl() {
  if (bubblePodCannonEl) return bubblePodCannonEl;
  if (typeof Audio === "undefined") return null;
  const el = new Audio(BUBBLE_POD_CANNON_BGM_URL);
  // 主人 2026-09-05：BGM 只播一遍——整首走完即止，再次开炮才是新触发
  el.loop = false;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  bubblePodCannonEl = el;
  return el;
}

function isBubblePodCannonAudible() {
  return !!(
    bubblePodCannonEl &&
    !bubblePodCannonEl.paused &&
    bubblePodCannonEl.volume > 0.001
  );
}

function pauseOthersForBubblePodCannon() {
  pauseDefaultAmbience();
  if (musicBoxSession) stopMusicBox();
  if (swampBgmWanted || swampBgmPendingStop || isSwampBgmAudible()) {
    fadeOutSwampBgm(0.5);
  }
  if (canyonBgmWanted || canyonBgmPendingStop) {
    canyonBgmPendingStop = false;
    canyonBgmWanted = false;
    fadeOutCanyonBgm(0.5);
  }
  if (tramRidePhase !== "idle") {
    for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
      if (!el) continue;
      try {
        el.pause();
        el.volume = 0;
      } catch {
        /* ignore */
      }
    }
  }
}

function fadeBubblePodCannonTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  bubblePodCannonFading = true;
  const step = () => {
    if (!bubblePodCannonEl || bubblePodCannonEl !== el) return;
    if (!bubblePodCannonWanted && end > 0) {
      bubblePodCannonFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && bubblePodCannonFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      bubblePodCannonFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutBubblePodCannonBgm(seconds = 0.9) {
  const el = bubblePodCannonEl;
  bubblePodCannonWanted = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : BUBBLE_POD_CANNON_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  bubblePodCannonFading = true;
  const step = () => {
    if (!bubblePodCannonEl || bubblePodCannonEl !== el) return;
    if (bubblePodCannonWanted) {
      bubblePodCannonFading = false;
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
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    bubblePodCannonFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    else resumeTramRideBgmIfWanted();
  };
  requestAnimationFrame(step);
}

/**
 * 气泡艇开炮 BGM。第一次开炮从曲头循环《黄英华-Opening》；连发不重头。
 * 苔庭鲸风暴 / 潜入太鼓优先，不抢它们的声道。
 * @param {boolean} active
 * @param {{ fade?: number }} [opts]
 */
export function setBubblePodCannonBgm(active, opts = {}) {
  const fade = opts.fade ?? 0.7;
  const next = !!active && !muted;
  if (next) {
    if (
      leviathanStormWanted ||
      leviathanCueWanted ||
      infiltrationBgmWanted ||
      siegeAssaultWanted
    ) {
      return false;
    }
    bubblePodCannonWanted = true;
    const el = ensureBubblePodCannonEl();
    if (!el) return false;
    // 已在播（含淡入中 volume≈0）：连发不重头
    if (!el.paused) return true;
    pauseOthersForBubblePodCannon();
    ensureAudio();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play()?.catch?.(() => {});
    fadeBubblePodCannonTo(el, BUBBLE_POD_CANNON_VOLUME, fade);
    return true;
  }
  if (!bubblePodCannonWanted && !isBubblePodCannonAudible()) return false;
  bubblePodCannonWanted = false;
  fadeOutBubblePodCannonBgm(fade);
  return true;
}

export function isBubblePodCannonBgmPlaying() {
  return !!(bubblePodCannonWanted && bubblePodCannonEl && !bubblePodCannonEl.paused);
}

// =====================================================================
//  蓝盔攻城 BGM：Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3
//  蓝盔开始中央突破时起播并循环；深夜清场淡出
// =====================================================================
/** @type {HTMLAudioElement|null} */
let siegeAssaultEl = null;
let siegeAssaultWanted = false;
let siegeAssaultFading = false;
/** 深夜太鼓可以接手后为 true；此前攻城曲独占，其它 BGM 一律不播 */
let siegeAssaultHandoff = false;
export const SIEGE_ASSAULT_BGM_URL = new URL(
  "../../music/Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3",
  import.meta.url
).href;
const SIEGE_ASSAULT_VOLUME = 0.5;

function ensureSiegeAssaultEl() {
  if (siegeAssaultEl) return siegeAssaultEl;
  if (typeof Audio === "undefined") return null;
  const el = new Audio(SIEGE_ASSAULT_BGM_URL);
  // 主人 2026-09-05：BGM 只播一遍——整首走完即止，下次攻城才是新触发
  el.loop = false;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  // 播完即解除独占（夜晚太鼓经 handoff 接管，滞留 wanted 会挡住八音盒等）
  el.addEventListener("ended", () => {
    siegeAssaultWanted = false;
  });
  siegeAssaultEl = el;
  return el;
}

function isSiegeAssaultAudible() {
  return !!(
    siegeAssaultEl &&
    !siegeAssaultEl.paused &&
    siegeAssaultEl.volume > 0.001
  );
}

function pauseOthersForSiegeAssault() {
  pauseDefaultAmbience();
  if (musicBoxSession) stopMusicBox();
  if (infiltrationBgmWanted || isInfiltrationBgmAudible()) {
    infiltrationBgmWanted = false;
    silenceInfiltrationBgmKeepMission(0.4);
  }
  if (leviathanStormWanted || leviathanCueWanted || isLeviathanStormAudible()) {
    leviathanStormWanted = false;
    leviathanCueWanted = false;
    stopLeviathanCue(0.35);
    fadeOutLeviathanStormBgm(0.4);
  }
  if (bubblePodCannonWanted || isBubblePodCannonAudible()) {
    fadeOutBubblePodCannonBgm(0.4);
  }
  if (swampBgmWanted || swampBgmPendingStop || isSwampBgmAudible()) {
    fadeOutSwampBgm(0.5);
  }
  if (canyonBgmWanted || canyonBgmPendingStop) {
    canyonBgmPendingStop = false;
    canyonBgmWanted = false;
    fadeOutCanyonBgm(0.5);
  }
  if (tramRidePhase !== "idle") {
    for (const el of [tramIntroEl, tramMainEl, tramRedRideEl]) {
      if (!el) continue;
      try {
        el.pause();
        el.volume = 0;
      } catch {
        /* ignore */
      }
    }
  }
}

function fadeSiegeAssaultTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  siegeAssaultFading = true;
  const step = () => {
    if (!siegeAssaultEl || siegeAssaultEl !== el) return;
    if (!siegeAssaultWanted && end > 0) {
      siegeAssaultFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && siegeAssaultFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      siegeAssaultFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutSiegeAssaultBgm(seconds = 1.2) {
  const el = siegeAssaultEl;
  siegeAssaultWanted = false;
  siegeAssaultHandoff = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : SIEGE_ASSAULT_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  siegeAssaultFading = true;
  const step = () => {
    if (!siegeAssaultEl || siegeAssaultEl !== el) return;
    if (siegeAssaultWanted) {
      siegeAssaultFading = false;
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
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    siegeAssaultFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    else resumeTramRideBgmIfWanted();
  };
  requestAnimationFrame(step);
}

/**
 * 蓝盔开始进攻时循环《The Best Is Yet To Come》。
 * 起播后独占声道，直到夜晚太鼓真正响起（handoff）才让出。
 * @param {boolean} active
 * @param {{ fade?: number }} [opts]
 */
export function setSiegeAssaultBgm(active, opts = {}) {
  const fade = opts.fade ?? 0.9;
  const next = !!active && !muted;
  if (next) {
    siegeAssaultWanted = true;
    siegeAssaultHandoff = false;
    if (tramRideWanted) return true;
    const el = ensureSiegeAssaultEl();
    if (!el) return false;
    if (!el.paused) return true;
    pauseOthersForSiegeAssault();
    ensureAudio();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play()?.catch?.(() => {});
    fadeSiegeAssaultTo(el, SIEGE_ASSAULT_VOLUME, fade);
    return true;
  }
  if (!siegeAssaultWanted && !isSiegeAssaultAudible()) return false;
  siegeAssaultWanted = false;
  siegeAssaultHandoff = false;
  fadeOutSiegeAssaultBgm(fade);
  return true;
}

/** 允许夜晚太鼓接手：攻城曲继续播，直到太鼓真正起声再淡出 */
export function allowSiegeAssaultBgmHandoff() {
  if (!siegeAssaultWanted) return false;
  siegeAssaultHandoff = true;
  return true;
}

export function isSiegeAssaultBgmPlaying() {
  return !!(siegeAssaultWanted && siegeAssaultEl && !siegeAssaultEl.paused);
}

export function isSiegeAssaultBgmHandoff() {
  return !!siegeAssaultHandoff;
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
    leviathanStormWanted = false;
    leviathanCueWanted = false;
    for (const el of [leviathanStormEl, leviathanCueEl]) {
      if (!el) continue;
      try {
        el.pause();
        el.volume = 0;
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    infiltrationMissionActive = false;
    infiltrationBgmWanted = false;
    infiltrationInRange = false;
    if (infiltrationBgmEl) {
      try {
        infiltrationBgmEl.pause();
        infiltrationBgmEl.volume = 0;
        infiltrationBgmEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    for (const el of thunderPool) {
      try {
        el.pause();
        el.volume = 0;
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    tramRideWanted = false;
    stopTramRideElements();
    bubblePodCannonWanted = false;
    if (bubblePodCannonEl) {
      try {
        bubblePodCannonEl.pause();
        bubblePodCannonEl.volume = 0;
        bubblePodCannonEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    siegeAssaultWanted = false;
    siegeAssaultHandoff = false;
    if (siegeAssaultEl) {
      try {
        siegeAssaultEl.pause();
        siegeAssaultEl.volume = 0;
        siegeAssaultEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
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
