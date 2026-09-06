# -*- coding: utf-8 -*-
"""L：整体舰队作战 BGM ——《徐嘉良-战 (大提琴版)》。

主人 2026-09-06：「整体舰队作战BGM music/徐嘉良-战 (大提琴版).mp3，
除了苔庭之战的BGM之外」。

改之前 vanguardAssault 在每次任务装填时都调 setLeviathanStormBgm(true)，
也就是**每一场舰队作战都放苔庭鲸那首 Terminator 2**。苔庭之战的曲子本来由
saihojiGarden 按鲸的故事线开关（起/落/终扫各有淡入淡出），登陆队在旁边又开一遍，
等于把一首专属曲当成了通用战斗曲。现在拆开：
  · 苔庭之战 → 仍归 saihojiGarden，Terminator 2；
  · 其余整体舰队作战 → 徐嘉良《战》大提琴版，且**苔庭那首在响时自动让路**。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/audio/sfx.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 段内 BGM 登记 ----------------
rep("""    bubblePodCannonWanted ||
    siegeAssaultWanted
  );
}""",
"""    bubblePodCannonWanted ||
    siegeAssaultWanted ||
    fleetAssaultWanted
  );
}""",
    "anySegmentBgmEngaged")

# ---------------- 新块（放在气泡艇开炮 BGM 之后） ----------------
anchor = """// =====================================================================
//  蓝盔攻城 BGM：Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3"""
assert anchor in s

block = """// =====================================================================
//  整体舰队作战 BGM：徐嘉良-战 (大提琴版).mp3
//
//  主人 2026-09-06：「整体舰队作战BGM …… 除了苔庭之战的BGM之外」。
//  莫比斯舰队（主舰 + 侦察机 + 泡机 + 登陆艇 + 重甲兵）一进入作战就起播，
//  收队淡出。**苔庭之战那首（Terminator 2）优先**：鲸的故事线在响时这首让路，
//  不去抢它的声道——那条线有自己的起/落/终扫节奏，被打断就散了。
// =====================================================================
/** @type {HTMLAudioElement|null} */
let fleetAssaultEl = null;
let fleetAssaultWanted = false;
let fleetAssaultFading = false;
export const FLEET_ASSAULT_BGM_URL = new URL(
  "../../music/徐嘉良-战 (大提琴版).mp3",
  import.meta.url
).href;
const FLEET_ASSAULT_VOLUME = 0.46;

function ensureFleetAssaultEl() {
  if (fleetAssaultEl) return fleetAssaultEl;
  if (typeof Audio === "undefined") return null;
  const el = new Audio(FLEET_ASSAULT_BGM_URL);
  // 一场作战从进场打到收队要一两分钟，循环，别中途冷场
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  fleetAssaultEl = el;
  return el;
}

function isFleetAssaultAudible() {
  return !!(fleetAssaultEl && !fleetAssaultEl.paused && fleetAssaultEl.volume > 0.001);
}

function pauseOthersForFleetAssault() {
  pauseDefaultAmbience();
  if (musicBoxSession) stopMusicBox();
  if (swampBgmWanted || swampBgmPendingStop || isSwampBgmAudible()) {
    fadeOutSwampBgm(0.6);
  }
  if (canyonBgmWanted || canyonBgmPendingStop) {
    canyonBgmPendingStop = false;
    canyonBgmWanted = false;
    fadeOutCanyonBgm(0.6);
  }
}

function fadeFleetAssaultTo(el, targetVol, seconds) {
  if (!el) return;
  const start = el.volume;
  const end = THREE_CLAMP(targetVol, 0, 1);
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  fleetAssaultFading = true;
  const step = () => {
    if (!fleetAssaultEl || fleetAssaultEl !== el) return;
    if (!fleetAssaultWanted && end > 0) {
      fleetAssaultFading = false;
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / dur);
    el.volume = start + (end - start) * k;
    if (k < 1 && fleetAssaultFading) requestAnimationFrame(step);
    else {
      el.volume = end;
      fleetAssaultFading = false;
    }
  };
  requestAnimationFrame(step);
}

function fadeOutFleetAssaultBgm(seconds = 1.1) {
  const el = fleetAssaultEl;
  fleetAssaultWanted = false;
  if (!el || (el.paused && el.volume <= 0.001)) {
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    return;
  }
  const start = el.volume > 0 ? el.volume : FLEET_ASSAULT_VOLUME;
  const t0 = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  fleetAssaultFading = true;
  const step = () => {
    if (!fleetAssaultEl || fleetAssaultEl !== el) return;
    if (fleetAssaultWanted) {
      fleetAssaultFading = false;
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
    fleetAssaultFading = false;
    if (!muted && !anySegmentBgmEngaged()) resumeDefaultAmbience();
    else resumeTramRideBgmIfWanted();
  };
  requestAnimationFrame(step);
}

/**
 * 整体舰队作战 BGM。舰队进入作战即循环《徐嘉良-战（大提琴版）》，收队淡出。
 *
 * 让路名单（返回 false，不抢声道）：
 *   · 苔庭之战（leviathanStorm / leviathanCue）—— 主人点名的例外；
 *   · 木马夜间潜入太鼓、电车乘车曲 —— 玩家自己正在经历的段落，抢了就破功。
 *
 * @param {boolean} active
 * @param {{ fade?: number }} [opts]
 * @returns {boolean} 是否改变了播放状态
 */
export function setFleetAssaultBgm(active, opts = {}) {
  const fade = opts.fade ?? 1.0;
  const next = !!active && !muted;
  if (next) {
    if (
      leviathanStormWanted ||
      leviathanCueWanted ||
      infiltrationBgmWanted ||
      tramRideWanted
    ) {
      return false;
    }
    fleetAssaultWanted = true;
    const el = ensureFleetAssaultEl();
    if (!el) return false;
    if (!el.paused) return true; // 已在播：作战期间反复调用不重头
    pauseOthersForFleetAssault();
    ensureAudio();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play()?.catch?.(() => {});
    fadeFleetAssaultTo(el, FLEET_ASSAULT_VOLUME, fade);
    return true;
  }
  if (!fleetAssaultWanted && !isFleetAssaultAudible()) return false;
  fleetAssaultWanted = false;
  fadeOutFleetAssaultBgm(fade);
  return true;
}

export function isFleetAssaultBgmPlaying() {
  return !!(fleetAssaultWanted && fleetAssaultEl && !fleetAssaultEl.paused);
}

"""
s = s.replace(anchor, block + anchor, 1)

# ---------------- 静音/全停也要带上它 ----------------
rep("""  bubblePodCannonWanted = false;
  if (bubblePodCannonEl && !bubblePodCannonEl.paused) {""",
"""  fleetAssaultWanted = false;
  if (fleetAssaultEl && !fleetAssaultEl.paused) {
    try {
      fleetAssaultEl.pause();
      fleetAssaultEl.volume = 0;
    } catch {
      /* ignore */
    }
  }
  bubblePodCannonWanted = false;
  if (bubblePodCannonEl && !bubblePodCannonEl.paused) {""",
    "静音全停")

io.open(P, "w", encoding="utf-8").write(s)
print("patched sfx.js（舰队作战 BGM）")
