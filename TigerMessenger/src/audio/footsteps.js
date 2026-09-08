import { ensureAudio, isMuted } from './sfx.js';

// Distance-driven footsteps: no sound while airborne, idle, driving or muted.
export function createFootsteps() {
  let distance = 0;
  let buffer = null;
  return {
    update(dt, player, enabled) {
      if (!enabled || !player.onGround || isMuted()) { distance = 0; return; }
      const radial = player.velocity.dot(player.position) / player.position.length();
      const speed = Math.sqrt(Math.max(0, player.velocity.lengthSq() - radial * radial));
      distance += Math.min(dt, .05) * speed;
      if (speed < .6 || distance < 1.65) return;
      distance %= 1.65;
      const ctx = ensureAudio();
      if (!ctx) return;
      if (!buffer) {
        buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .075), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
      }
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = player.wadeFactor < 1 ? 1500 : 700;
      gain.gain.value = .075;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start();
    },
  };
}
