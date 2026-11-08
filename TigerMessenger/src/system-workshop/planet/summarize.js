/** 把 compilePlanetV8 的结果压成可以跨 Worker 传、可以比较的摘要 + 等距柱状投影预览图。纯数据。 */
import { compilePlanetV8 } from '../../procgen/planet/planetCompilerV8.js';

const dirOf = (i, j, W, H) => { const lat = (0.5 - (j + 0.5) / H) * Math.PI, lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI; return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; };
const lonLat = (d) => { const n = Math.hypot(...d) || 1; return [Math.atan2(d[2] / n, d[0] / n), Math.asin(d[1] / n)]; };
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

// 编译器的错误码 → 说人话（失败阶段 + 原因 + 怎么改）
const CODES = {
  'chain-not-one-land-component': '地形链要求所有场景锚点连成一块陆地，这组配方下陆地被海分成了几块',
  'chain-no-land-component': '这组配方下没有生成陆地',
  'non-finite-elevation-probe': '地形高度出现了无效值',
};
function explainFailure(r) {
  const errs = []; const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o.errors)) errs.push(...o.errors.map(String)); for (const v of Object.values(o)) if (v && typeof v === 'object' && v !== o.errors) walk(v); };
  walk(r.report);
  const why = [...new Set(errs)].map((e) => CODES[e] || (e.startsWith('final-saddle:') ? `场景之间的鞍部检查未通过（${e.slice(13)}）` : e)).join('；');
  return `停在「${r.stage}」阶段：${why || '编译器未给出原因'}`;
}
export function compileAndSummarize(recipe, { W = 192, H = 96 } = {}) {
  const t0 = Date.now();
  let r;
  try { r = compilePlanetV8({ ...recipe, landmarks: undefined }); } catch (e) { return { ok: false, stage: 'throw', error: e.message, recipe, ms: Date.now() - t0 }; }
  const ms = Date.now() - t0;
  const reports = {};
  for (const [k, v] of Object.entries(r)) if (/Report$/.test(k) && v && typeof v === 'object' && 'ok' in v) reports[k] = { ok: !!v.ok, errors: (v.errors || []).slice(0, 4).map(String) };
  if (!r.ok) return { ok: false, stage: r.stage, recipe, ms, reports, error: explainFailure(r), raw: JSON.stringify(r.report || {}).slice(0, 300) };
  const sea = r.field.seaLevel ?? recipe.seaLevel ?? 0;
  const px = new Uint8ClampedArray(W * H * 4); let land = 0, forest = 0, rock = 0, snow = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const q = r.field.semanticAt(dirOf(i, j, W, H)), h = q.height - sea;
    let c;
    if (q.lake > 0.5 || h <= 0) c = mix([38, 74, 96], [70, 128, 150], Math.max(0, Math.min(1, 1 + h / 4)));
    else {
      land++; c = mix([126, 150, 98], [166, 148, 112], Math.min(1, h / 9));
      if (q.forestness > 0.35) { forest++; c = mix(c, [64, 104, 66], Math.min(1, q.forestness)); }
      if (q.rockness > 0.6) { rock++; c = mix(c, [128, 122, 116], 0.5); }
      if (q.snowness > 0.3) { snow++; c = mix(c, [232, 236, 236], Math.min(1, q.snowness)); }
    }
    px.set([c[0], c[1], c[2], 255], (j * W + i) * 4);
  }
  const N = W * H;
  const landmarks = r.manifest.map((m) => { const q = r.field.semanticAt(m.direction); const [lon, lat] = lonLat(m.direction); return { id: m.id, lon, lat, height: q.height, water: !!(m.water || /lake|harbor|water/.test(m.id)) }; });
  const onLand = landmarks.filter((m) => !m.water);
  const clouds = (r.clouds?.instances || []).map((c) => { const [lon, lat] = lonLat(c.anchor); return { lon, lat, type: c.type }; });
  return {
    ok: true, stage: r.stage, recipe, ms, reports, pipeline: r.pipeline,
    hashes: { grid: r.grid.hash, wfc: r.wfc.solutionHash, hydrology: r.snapshot.hydrologyHash, climate: r.snapshot.climateHash, ecology: r.snapshot.ecologyHash, nav: r.navigation?.hash },
    stats: { land: land / N, forest: forest / N, rock: rock / N, snow: snow / N, lakes: r.water?.lakes?.length || 0, routes: r.terrainRoutes?.routes?.length || 0, navNodes: r.navigation?.nodes?.length || 0,
      clouds: clouds.length, vegetation: (r.vegetation || []).reduce((a, v) => a + Object.values(v.buckets || {}).reduce((b, x) => b + x.length, 0), 0), charts: r.grid.charts?.length || 0, cells: r.grid.main?.cells?.length || r.wfc.assignment?.length || 0,
      landmarks: landmarks.length, lowestLandmark: onLand.reduce((a, m) => (!a || m.height < a.height ? m : a), null) },
    landmarks, clouds, raster: { W, H, px },
  };
}
