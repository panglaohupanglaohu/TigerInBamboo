// Shared runtime/offline source: a pebble skipping across water, at a real shield hit.
const noiseBuffers = new WeakMap();
export function synthBatianShieldHit(ctx, out, start = ctx.currentTime, variation = 0, impactPower = 20) {
  // Robot defense already supplies per-projectile powers 9 / 24 / 100.
  const weight = Math.max(0, Math.min(1, (Number.isFinite(impactPower) ? impactPower : 20) / 100));
  const pitch = [1, .94, 1.07, .98][Math.abs(variation | 0) % 4] * (1.02 - weight * .1);
  const sources = [];
  function tone(frequency, endFrequency, duration, gain, delay = 0) {
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain(), t = start + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * pitch, t);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency * pitch, t + duration);
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(gain, t + .003);
    envelope.gain.exponentialRampToValueAtTime(.0001, t + duration);
    envelope.gain.linearRampToValueAtTime(0, t + duration + .008);
    oscillator.connect(envelope).connect(out);
    oscillator.start(t); oscillator.stop(t + duration + .012); sources.push(oscillator);
  }
  // Water stays in front; a quiet, damped bowl resonance follows the first contact.
  // Inharmonic modes suggest metal without turning every skip into a bell strike.
  tone(630,628,.34,.033+weight*.008,.008);
  tone(1690,1687,.26,.017,.009);
  tone(3090,3087,.17,.008,.010);
  // Three diminishing short wet plops.
  const skips=[{delay:0,level:1,pitch:1},{delay:.065,level:.54,pitch:1.19},{delay:.125,level:.27,pitch:1.34}];
  for(const skip of skips){
    tone((970-weight*190)*skip.pitch,340*skip.pitch,.052,(.31+weight*.12)*skip.level,skip.delay);
    tone(510*skip.pitch,280*skip.pitch,.069,.12*skip.level,skip.delay+.003);
  }
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .055), ctx.sampleRate);
    const data = buffer.getChannelData(0); let seed = 30183;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    noiseBuffers.set(ctx, buffer);
  }
  for(const skip of skips){const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain(),t=start+skip.delay;
    noise.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1700 * pitch*skip.pitch; filter.Q.value = .65;
    envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime((.24+weight*.06)*skip.level,t+.002);envelope.gain.exponentialRampToValueAtTime(.0001,t+.035);envelope.gain.setValueAtTime(0,t+.044);
    noise.connect(filter).connect(envelope).connect(out);noise.start(t);noise.stop(t+.055);sources.push(noise);
  }
  return sources;
}
