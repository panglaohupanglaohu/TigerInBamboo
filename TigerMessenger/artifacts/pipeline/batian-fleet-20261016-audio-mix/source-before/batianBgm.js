export const BATIAN_BGM_URL = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hitman.mp3';

// A battle owns one play-through. Temporary mute or tram priority pauses it;
// returning to idle releases ownership and allows the next battle to restart.
export function createBatianBgm(ownership, makeAudio, suspendAmbience) {
  let el = null, active = false, finished = false;
  return function update(next, muted = false) {
    if (next && !active) { finished = false; if (el) el.currentTime = 0; }
    active = !!next;
    const allowed = ownership.request('batian', active && !muted && !finished);
    if (!active || muted || finished || !allowed) {
      if (el && !el.paused) el.pause();
      return false;
    }
    if (!el) {
      el = makeAudio('batian', BATIAN_BGM_URL);
      el.preload = 'metadata';
      el.loop = false;
      el.addEventListener('ended', () => {
        finished = true;
        ownership.request('batian', false);
      });
    }
    suspendAmbience();
    el.volume = 0.5;
    if (el.paused) el.play()?.catch?.(() => {});
    return true;
  };
}
