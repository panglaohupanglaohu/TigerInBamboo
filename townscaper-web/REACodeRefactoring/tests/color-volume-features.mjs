// 1710031224838771027 残差批：其他特征（roof/cliff 表面各接 HSL 域）、离散采样
// （原作 Inspector ~12 格色带粒度）、原版完整接口（sample/css/dE/oklabToRgb/terrain）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  makeColorVolume, sampleColorVolume, colorVolumeStrip,
  makeFeatureColorVolumes, sampleFeatureColorVolume, COLOR_VOLUME_FEATURES, COLOR_VOLUME_GLSL,
  makeCornerVolume, sampleCornerVolume, sampleCornerVolumeSpace, defaultFeatureVolumes,
  colorVolumeTerrain, css, dE, oklabToRgb,
} from '../src/core/color-volume.js';
import { srgbToOklab, deltaE } from '../src/core/oklab.js';

// 独立参考实现（不与被测函数共享代码）：标准 CSS hsl→rgb 的逆变换。
const rgbToHsl = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
const inHue = (h, [lo, hi]) => hi >= lo ? h >= lo - 1e-6 && h <= hi + 1e-6 : h >= lo - 1e-6 || h <= hi + 1e-6;

// ---------- 1. 离散采样：粒度与原版 12 格色带一致 ----------
{
  const v = makeColorVolume({ h: [.1, .6], s: [.3, .8], l: [.35, .65] });
  const cells = colorVolumeStrip(v, 12);                       // 原版 strip(vol,12) 粒度
  assert.equal(cells.length, 12);
  cells.forEach((c, i) => assert.deepEqual(c, sampleColorVolume(v, i / 11, .5, .5), 'strip cell ' + i));
  // 连续坐标吸附到最近格点（全部三坐标同一粒度）：u 方向恰为 12 个格点色
  const seen = new Set(), sv = Math.round(.5 * 11) / 11;        // v=w=.5 吸附到 6/11
  for (let i = 0; i <= 600; i++) {
    const u = i / 600, out = sampleColorVolume(v, u, .5, .5, { steps: 12 });
    seen.add(out.join(','));
    const snap = Math.round(u * 11) / 11;
    assert.deepEqual(out, sampleColorVolume(v, snap, sv, sv), 'snapped to grid cell ' + u);
  }
  assert.equal(seen.size, 12, 'exactly 12 discrete cells on u');
  // 吸附在 clamp 之后：越界坐标与端点格同格
  assert.deepEqual(sampleColorVolume(v, -2, .5, .5, { steps: 12 }), sampleColorVolume(v, 0, sv, sv));
  assert.deepEqual(sampleColorVolume(v, 9, .5, .5, { steps: 12 }), sampleColorVolume(v, 1, sv, sv));
  // 离散作用于全部三个坐标
  const distinct = new Set(); for (let i = 0; i <= 200; i++) distinct.add(sampleColorVolume(v, .5, i / 200, .5, { steps: 8 }).join(','));
  assert.equal(distinct.size, 8, 'v also quantizes');
  // 默认不变：steps=0 与 3 参数调用同输出（向后兼容）
  assert.deepEqual(sampleColorVolume(v, .37, .62, .81), sampleColorVolume(v, .37, .62, .81, { steps: 0 }));
  assert.throws(() => sampleColorVolume(v, 0, 0, 0, { steps: 1 }), RangeError);
  assert.throws(() => sampleColorVolume(v, 0, 0, 0, { steps: 2.5 }), RangeError);
  assert.throws(() => sampleColorVolume(v, 0, 0, 0, { steps: -3 }), RangeError);
  assert.throws(() => colorVolumeStrip(v, 0), RangeError);
}

// ---------- 2. 色域采样分布 vs 裁判参数（每样本落在声明范围内） ----------
{
  const v = makeColorVolume({ h: [.6, .72], s: [.3, .65], l: [.4, .7] });
  for (let i = 0; i < 3000; i++) {
    const rgb = sampleColorVolume(v, (i % 31) / 30, (i % 17) / 16, (i % 13) / 12);
    const [h, s, l] = rgbToHsl(rgb);
    assert(inHue(h, v.h), `hue out of range: ${h}`);
    assert(s <= v.s[1] + 1e-4 && l >= v.l[0] - 1e-4 && l <= v.l[1] + 1e-4, `s/l out of range: ${s},${l}`);
  }
  // hue 环绕范围 [.95,.05]：样本 hue 落在 [.95,1]∪[0,.05]
  const w = makeColorVolume({ h: [.95, .05], s: [1, 1], l: [.5, .5] });
  for (let i = 0; i < 200; i++) { const [h] = rgbToHsl(sampleColorVolume(w, i / 199, .5, .5)); assert(inHue(h, w.h), 'wrap hue ' + h); }
}

// ---------- 3. 其他特征：ground/roof/cliff 各自的 HSL 域 ----------
{
  const vols = makeFeatureColorVolumes({
    ground: { h: [.22, .38], s: [.4, .7], l: [.3, .6] },
    roof: { h: [.02, .08], s: [.5, .85], l: [.4, .7] },
    cliff: { h: [.58, .66], s: [.05, .2], l: [.35, .55] },
  });
  assert.deepEqual(COLOR_VOLUME_FEATURES, ['ground', 'roof', 'cliff'], 'feature order = shader index');
  for (const f of COLOR_VOLUME_FEATURES) {
    for (let i = 0; i < 500; i++) {
      const rgb = sampleFeatureColorVolume(f, vols, (i % 23) / 22, (i % 11) / 10, (i % 7) / 6);
      const [h, s, l] = rgbToHsl(rgb), r = vols[f];
      assert(inHue(h, r.h), `${f} hue ${h}`);
      assert(s <= r.s[1] + 1e-4 && l >= r.l[0] - 1e-4 && l <= r.l[1] + 1e-4, `${f} s/l ${s},${l}`);
    }
  }
  // 特征分离：三特征中点色两两 ΔE > 10（不可能串色）
  const mid = (f) => srgbToOklab(...sampleFeatureColorVolume(f, vols, .5, .5, .5));
  const pairs = [['ground', 'roof'], ['ground', 'cliff'], ['roof', 'cliff']];
  for (const [a, b] of pairs) assert(deltaE(mid(a), mid(b)) > 10, `${a} vs ${b} too close`);
  // 契约：未知/缺失/空特征
  assert.throws(() => makeFeatureColorVolumes({ bogus: { h: [0, 1] } }), RangeError);
  assert.throws(() => makeFeatureColorVolumes({}), RangeError);
  assert.throws(() => makeFeatureColorVolumes(null), RangeError);
  assert.throws(() => sampleFeatureColorVolume('bogus', vols, .5, .5, .5), RangeError);
  const partial = makeFeatureColorVolumes({ roof: { h: [.02, .08], s: [.5, .8], l: [.4, .6] } });
  assert.throws(() => sampleFeatureColorVolume('ground', partial, .5, .5, .5), RangeError); // 未给的特征不落色域
}

// ---------- 4. 原版完整接口：sample/css/dE/oklabToRgb/opts/terrain ----------
{
  const corners = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#000000', '#ffffff'];
  // sampleCornerVolumeSpace = 原版 sample：返回插值空间原坐标（oklab 体积 → OKLab）
  const v = makeCornerVolume('t', corners);
  const mid = sampleCornerVolumeSpace(v, .3, .6, .9);
  const roundtrip = srgbToOklab(...sampleCornerVolume(v, .3, .6, .9));
  assert(mid.every((x, k) => Math.abs(x - roundtrip[k]) < 1e-3), 'space sample ≈ oklab of srgb sample');
  const sv = makeCornerVolume('s', corners, { space: 'srgb' });
  assert.deepEqual(sampleCornerVolumeSpace(sv, .3, .6, .9), sampleCornerVolume(sv, .3, .6, .9), 'srgb space = sample output');
  // 原版 makeVolume 的 ...opts 透传
  const ov = makeCornerVolume('o', corners, { label: 'demo', meta: { a: 1 } });
  assert.equal(ov.label, 'demo'); assert.equal(ov.meta.a, 1); assert.equal(ov.space, 'oklab');
  // css / dE / oklabToRgb 原版签名
  assert.equal(css(srgbToOklab(1, 0, 0)), 'rgb(255,0,0)');
  assert.equal(css(srgbToOklab(1, 1, 1)), 'rgb(255,255,255)');
  assert.equal(css(srgbToOklab(0, 0, 0)), 'rgb(0,0,0)');
  assert(Math.abs(dE(srgbToOklab(0, 0, 0), srgbToOklab(1, 1, 1)) - 100) < .5, 'dE black-white ≈ 100');
  const rt = oklabToRgb(...srgbToOklab(.8, .3, .5)); assert(rt.every((x, k) => Math.abs(x - [.8, .3, .5][k]) < 1e-4), 'oklabToRgb roundtrip');

  // terrain：原版预览的忠实移植 —— 确定性 + 每像素落在某一特征体积内且不串色
  const vols = defaultFeatureVolumes(), names = Object.keys(vols);
  const t1 = colorVolumeTerrain(96, 64, vols, { seed: 3 });
  const t2 = colorVolumeTerrain(96, 64, vols, { seed: 3 });
  const t3 = colorVolumeTerrain(96, 64, vols, { seed: 9 });
  assert.deepEqual(Array.from(t1.rgb), Array.from(t2.rgb), 'same seed deterministic');
  assert.notDeepEqual(Array.from(t1.rgb), Array.from(t3.rgb), 'different seed differs');
  assert.equal(t1.rgb.length, 96 * 64 * 3); assert.equal(t1.w, 96); assert.equal(t1.h, 64);
  const usedSum = Object.values(t1.used).reduce((a, b) => a + b, 0);
  assert.equal(usedSum, 96 * 64, 'every pixel classified');
  assert(t1.used.Beach > 0 && t1.used.Grass > 0, 'island has beach ring + grass');
  assert.equal(Object.keys(t1.used).join(','), 'Beach,Cliff,Grass,Flowers', 'referee used keys');
  // 每像素必须落在某一特征的体积可达集内（minDist≈0），且距第二近特征 >4 ΔE（不串色）
  const reach = names.map((f) => { const a = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) a.push(srgbToOklab(...sampleCornerVolume(vols[f], i / 4, j / 4, k / 4))); return a; });
  let ambiguous = 0, outside = 0;
  for (let p = 0; p < t1.rgb.length; p += 3) {
    const own = srgbToOklab(t1.rgb[p], t1.rgb[p + 1], t1.rgb[p + 2]);
    const dists = reach.map((set) => Math.min(...set.map((q) => deltaE(own, q))));
    const sorted = [...dists].sort((a, b) => a - b);
    if (sorted[0] > 2) outside++;
    if (sorted[1] < 4) ambiguous++;
  }
  assert.equal(outside, 0, 'every pixel inside some feature volume');
  assert.equal(ambiguous, 0, 'no pixel drifts into a second feature');
  assert.throws(() => colorVolumeTerrain(0, 10, vols), RangeError);
}

// ---------- 5. GLSL 与 view.js 接线契约（源码断言，同 view-shading.mjs 口径） ----------
{
  for (const t of ['uColorVolumeSteps', 'uFeatVolOn', 'uFeatVolMin[3]', 'uFeatVolMax[3]', 'cvQuant', 'featVolumeSample', 'cvHslToRgb'])
    assert.ok(COLOR_VOLUME_GLSL.includes(t), 'GLSL token ' + t);
  const view = fs.readFileSync(new URL('../src/world/view.js', import.meta.url), 'utf8');
  for (const t of ['uColorVolumeSteps', 'uFeatVolOn', 'uFeatVolMin', 'uFeatVolMax', 'setFeatureColorVolumes', 'colorVolumeOn.value=3', 'makeFeatureColorVolumes'])
    assert.ok(view.includes(t), 'view.js token ' + t);
  // 模式分派：>2.5 走 per-feature，<=2 走旧 ground/palette 路径
  assert.ok(view.includes('uColorVolumeOn>2.5') && view.includes('uFeatVolOn[cvf]>.5'), 'mode-3 dispatch');
}

console.log('PASS discrete steps (12-cell strip parity), per-feature HSL volumes (ground/roof/cliff separated), referee interface (space sample/css/dE/terrain deterministic), GLSL+view wiring');
