// r56 C08 · 1714613599035863191 field patchwork variant: old stripes preserved, plots partition sane
import assert from 'node:assert/strict';
import { FIELD_GLSL, fieldPlotId } from '../src/terrain/field-pattern.js';
// mode 1 keeps the exact pre-r56 stripe body
const OLD = `  float phase = p.x * 5.0 + .22 * sin(p.y * 3.0);
  float fw = max(fwidth(phase), .0001);
  float d = abs(fract(phase) - .5);
  float stripe = 1.0 - smoothstep(.22 - fw, .22 + fw, d);
  // Fade unresolved stripes toward their mean instead of high-frequency flicker.
  stripe = mix(stripe, .44, smoothstep(.35, .9, fw));
  return mix(1.0, .90 + .18 * stripe, clamp(p.z, 0.0, 1.0));`;
assert.ok(FIELD_GLSL.includes('float fieldToneStripes(vec3 p) {\n' + OLD));
assert.ok(/float fieldTone\(vec3 p\) \{ return uFields > 1\.5 \? fieldTonePlots\(p\) : fieldToneStripes\(p\); \}/.test(FIELD_GLSL));
// balanced braces / single fieldTone definition
assert.equal((FIELD_GLSL.match(/\{/g) || []).length, (FIELD_GLSL.match(/\}/g) || []).length);
assert.equal((FIELD_GLSL.match(/float fieldTone\(/g) || []).length, 1);
// plot partition: a ~1.5-unit tile contains several plots; plots are spatially coherent
const ids = new Set(); let same = 0, n = 0;
for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
  const u = i * .04, v = j * .04, a = fieldPlotId(u, v), b = fieldPlotId(u + .01, v);
  ids.add(a.join()); n++; if (a.join() === b.join()) same++;
}
assert.ok(ids.size >= 3 && ids.size <= 12, 'plots per tile ' + ids.size);
assert.ok(same / n > .9, 'coherent plots');
console.log({ plotsInTile: ids.size, coherence: +(same / n).toFixed(3) });
console.log('PASS field-plots-c08');
