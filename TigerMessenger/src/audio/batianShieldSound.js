// Shared runtime/offline source: a firm energy interception, then crystal ripples.
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
  tone(1250, 620, .10, .34); // clear impact; no gunshot or explosion layer
  tone(480, 170, .30, .35 + weight * .4, .008);
  tone(145, 68, .24, .26 + weight * .5, .004); // shield pressure; weight without a bomb's rumbling tail
  tone(1740, 1120, .49, .14, .014);
  tone(2650, 1810, .37, .065, .026);
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .055), ctx.sampleRate);
    const data = buffer.getChannelData(0); let seed = 30183;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    noiseBuffers.set(ctx, buffer);
  }
  const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
  noise.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 3200 * pitch; filter.Q.value = .7;
  envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(.22, start + .002); envelope.gain.linearRampToValueAtTime(0, start + .05);
  noise.connect(filter).connect(envelope).connect(out); noise.start(start); noise.stop(start + .06); sources.push(noise);
  return sources;
}
