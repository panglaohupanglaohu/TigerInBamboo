// 1710031224838771027 面板形制（五特征 H/S/L 范围 × 逐轴格数）的纯逻辑验收。
// 口径：片里 Inspector 上是 Grass/Roof/Cliff/Beach/Flowers 五行，每行 H/S/L 三段范围 + 逐轴格数（H 5 / S 3 / L 3），
// 下方 12 格色带；改一行只改该特征，地形由同一分类器重取色。这里验模块侧：逐轴格数、逐特征取色、确定性、掩膜归属。
import assert from 'node:assert/strict';
import {
  makeColorVolume, sampleColorVolume, colorVolumeStrip,
  colorVolumeTerrainHSL,
} from '../src/core/color-volume.js';

const FEATURES = ['Grass', 'Roof', 'Cliff', 'Beach', 'Flowers'];
const DEFAULTS = {
  Grass: { h: [.15, .36], s: [.25, .55], l: [.30, .62], n: [5, 3, 3] },
  Roof: { h: [.00, .07], s: [.45, .85], l: [.35, .68], n: [5, 3, 3] },
  Cliff: { h: [.55, .66], s: [.05, .20], l: [.32, .55], n: [5, 3, 3] },
  Beach: { h: [.09, .14], s: [.25, .55], l: [.55, .80], n: [5, 3, 3] },
  Flowers: { h: [.80, .95], s: [.40, .85], l: [.40, .65], n: [5, 3, 3] },
};
const volumes = (p = DEFAULTS) => Object.fromEntries(FEATURES.map((f) => [f, makeColorVolume({ h: p[f].h, s: p[f].s, l: p[f].l })]));
const stepsOf = (p = DEFAULTS) => Object.fromEntries(FEATURES.map((f) => [f, p[f].n]));

// 1) 逐轴格数：沿 u 至多 5 档、沿 v 至多 3 档、沿 w 至多 3 档
{
  const v = volumes(), st = [5, 3, 3], f0 = 'Grass';
  const along = (axis) => {
    const s = new Set();
    for (let i = 0; i <= 400; i++) {
      const x = i / 400, p = axis === 0 ? [x, .5, .5] : axis === 1 ? [.5, x, .5] : [.5, .5, x];
      s.add(sampleColorVolume(v[f0], p[0], p[1], p[2], { steps: st }).join(','));
    }
    return s.size;
  };
  assert.equal(along(0), 5, 'u 轴格数应为 5');
  assert.equal(along(1), 3, 'v 轴格数应为 3');
  assert.equal(along(2), 3, 'w 轴格数应为 3');
  // 单数字 steps 仍按三轴同一格数（向后兼容）
  const s2 = new Set();
  for (let i = 0; i <= 400; i++) s2.add(sampleColorVolume(v.Grass, i / 400, .5, .5, { steps: 3 }).join(','));
  assert.equal(s2.size, 3, 'steps=3 单数字仍为三轴同格数');
  // 非法格数：1 / 2.5 / 长度不 3 的数组
  assert.throws(() => sampleColorVolume(v.Grass, .5, .5, .5, { steps: [5, 1, 3] }), RangeError);
  assert.throws(() => sampleColorVolume(v.Grass, .5, .5, .5, { steps: [5, 3] }), RangeError);
  assert.throws(() => sampleColorVolume(v.Grass, .5, .5, .5, { steps: [5, 2.5, 3] }), RangeError);
}

// 2) 地形预览：分类器与 colorVolumeTerrain 同口径（Beach/Cliff/Flowers/Grass），Roof 不出现
{
  const a = colorVolumeTerrainHSL(120, 120, volumes(), { steps: stepsOf() });
  const b = colorVolumeTerrainHSL(120, 120, volumes(), { steps: stepsOf() });
  assert.equal(a.rgb.length, 120 * 120 * 3);
  assert.deepEqual(Array.from(a.rgb), Array.from(b.rgb), '同参必须逐值一致');
  const sum = Object.values(a.used).reduce((x, y) => x + y, 0);
  assert.equal(sum, 120 * 120, '每像素都被分类');
  assert.equal(a.used.Roof ?? 0, 0, 'Roof 不进地形预览');
  for (const f of ['Beach', 'Cliff', 'Grass', 'Flowers']) assert.ok(a.used[f] > 100, f + ' 分类太少: ' + a.used[f]);
  const names = new Set(a.feature);
  assert.deepEqual([...names].sort(), ['Beach', 'Cliff', 'Flowers', 'Grass']);
}

// 3) 逐轴格数真的减少色数；连续档不去重
{
  const cont = colorVolumeTerrainHSL(90, 90, volumes(), { steps: 0 });
  const q = colorVolumeTerrainHSL(90, 90, volumes(), { steps: stepsOf() });
  const uniq = (r) => new Set(Array.from({ length: r.w * r.h }, (_, i) => r.rgb[i * 3].toFixed(5) + ',' + r.rgb[i * 3 + 1].toFixed(5) + ',' + r.rgb[i * 3 + 2].toFixed(5))).size;
  assert.ok(uniq(q) * 2 < uniq(cont), `格数没起分层作用：连续 ${uniq(cont)} vs 离散 ${uniq(q)}`);
}

// 4) 只改一个特征 → 变化像素必须全部落在该特征的掩膜内（CPU 掩膜即 GPU 的同一张 u,v,w+feature 图）
{
  const base = colorVolumeTerrainHSL(100, 100, volumes(), { steps: stepsOf() });
  const changed = (r) => { const out = { total: 0, byFeature: {} }; for (let i = 0; i < r.w * r.h; i++) { if (r.rgb[i * 3] !== base.rgb[i * 3] || r.rgb[i * 3 + 1] !== base.rgb[i * 3 + 1] || r.rgb[i * 3 + 2] !== base.rgb[i * 3 + 2]) { out.total++; out.byFeature[base.feature[i]] = (out.byFeature[base.feature[i]] || 0) + 1 } } return out };
  for (const f of ['Grass', 'Cliff', 'Beach', 'Flowers']) {
    const p = structuredClone(DEFAULTS); p[f] = { ...p[f], h: [.95, .99], s: [.9, 1], l: [.4, .6] };
    const r = colorVolumeTerrainHSL(100, 100, volumes(p), { steps: stepsOf(p) });
    const c = changed(r);
    assert.ok(c.total > 100, f + ' 改动没影响任何像素');
    assert.deepEqual(Object.keys(c.byFeature), [f], f + ' 的改变泄漏到别的特征: ' + JSON.stringify(c.byFeature));
  }
  // 只改 Roof 的范围 → 地形预览一格都不变（原版同一口径），但色带要变
  const p2 = structuredClone(DEFAULTS); p2.Roof = { ...p2.Roof, h: [.4, .5] };
  const r2 = colorVolumeTerrainHSL(100, 100, volumes(p2), { steps: stepsOf(p2) });
  assert.equal(changed(r2).total, 0, 'Roof 不该改动地形预览');
  assert.notDeepEqual(colorVolumeStrip(volumes(p2).Roof, 12), colorVolumeStrip(volumes().Roof, 12), 'Roof 色带必须变');
}

// 5) 12 格色带：固定 v/w 沿 u 取 12 格；同参确定
{
  const v = volumes();
  const s = colorVolumeStrip(v.Grass, 12);
  assert.equal(s.length, 12);
  assert.deepEqual(s, colorVolumeStrip(volumes().Grass, 12));
  assert.ok(new Set(s.map((c) => c.join(','))).size >= 6, '12 格色带应有可见变化');
  assert.throws(() => colorVolumeStrip(v.Grass, 0), RangeError);
}

console.log('PASS 五特征 H/S/L 面板：逐轴格数 5/3/3、分类器与掩膜归属、单特征改动零泄漏、Roof 只动色带不动地形、12 格色带');
