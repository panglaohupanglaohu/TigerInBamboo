import {bombMixFocus} from './bombMixFocus.js';
export const BATIAN_BGM_REMOTE_URL = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hitman.mp3';
export const BATIAN_BGM_URL = new URL('../../music/Hitman.ogg', import.meta.url).href;

// A battle owns one play-through. Temporary mute or tram priority pauses it;
// returning to idle releases ownership and allows the next battle to restart.
export function createBatianBgm(ownership, makeAudio, suspendAmbience, mixFocus=bombMixFocus, clock=()=>performance.now()/1000) {
  let el = null, active = false, finished = false, pending = false;
  let failures = 0, retryAt = 0, lastError = null, fallback = false, attempts = 0;
  function fail(error) {
    failures++;
    lastError = error?.name || error?.message || String(error);
    retryAt = clock() + Math.min(8, 2 * failures);
  }
  function update(next, muted = false) {
    if (next && !active) {
      finished = false; failures = 0; retryAt = 0; lastError = null;
      if (el) el.currentTime = 0;
    }
    active = !!next;
    const allowed = ownership.request('batian', active && !muted && !finished);
    if (!active || muted || finished || !allowed) {
      if (el && !el.paused) el.pause();
      return false;
    }
    if (!el) {
      el = makeAudio('batian', BATIAN_BGM_URL);
      el.preload = 'auto';
      el.loop = false;
      el.addEventListener('ended', () => {
        finished = true;
        ownership.request('batian', false);
      });
      // The packaged copy avoids a network dependency. Keep the original
      // author's MP3 as one fallback for a missing/unsupported local file.
      el.addEventListener('error', () => {
        pending = false;
        if (!fallback) {
          fallback = true;
          el.src = BATIAN_BGM_REMOTE_URL;
          el.load?.();
          retryAt = clock();
        } else fail(new Error('Hitman media error ' + (el.error?.code ?? 'unknown')));
      });
    }
    el.volume = 0.5 * mixFocus.read().music;
    if (el.paused && !pending && failures < 3 && clock() >= retryAt) {
      pending = true; attempts++;
      try {
        Promise.resolve(el.play()).then(() => {
          pending = false;
          if (!active || !ownership.allowed('batian')) el.pause();
        }, error => { pending = false; fail(error); });
      } catch (error) { pending = false; fail(error); }
    }
    const playing = !el.paused && el.readyState >= 2;
    if (playing) suspendAmbience();
    return playing;
  }
  update.snapshot = () => ({active,finished,pending,failures,attempts,fallback,lastError,
    source:el?.currentSrc || el?.src || BATIAN_BGM_URL,playing:!!el && !el.paused && el.readyState>=2});
  return update;
}
