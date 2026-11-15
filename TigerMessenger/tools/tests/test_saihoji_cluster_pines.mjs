// 苔庭丛松（2026-11-11 用户参考图）：node 跑真 saihojiGarden SceneModule（鲲背岛 + 苔庭六景 + 丛松落位），
// 量岛局部坐标中的实际几何：
//   ① 原 25 株 Blender 古松的平均高按旧公式复算 = 常量 5.4479（证明 2.5× 的基准不是拍脑袋）；
//   ② 新松平均高 = 原 × 2.5；丛内最高 / 最矮 1.25–1.45；
//   ③ 丛内相邻根距 0.05–0.15 H，至少一对 ≤ 0.07 H（两棵几乎贴在一起），根部跨度 0.5–0.6 H；
//   ④ 整丛冠幅 0.8–0.9 H（沿丛长轴）；树干下部光秃 55–62%；
//   ⑤ 6 棵丛里最高的一棵是稀疏枯松，叶量 < 其他平均的 45%；
//   ⑥ 伏击隐蔽槽仍 50 个、头盔净空 ≥ 1.12；每棵 2 个网格；主岛林带 / 圣城台地仍用旧古松工厂。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const threeUrl = pathToFileURL(join(root, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};return n(s,c);}`));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, documentElement: el() }, { get: (t, k) => k in t ? t[k] : () => el() });
globalThis.addEventListener ??= () => {}; globalThis.location ??= { search: '' }; try { globalThis.navigator ??= {}; } catch {}
globalThis.window ??= globalThis;

const T = await import('three');
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { saihojiGardenScene } = await imp('src/scenes/saihojiGarden.js');
const { PLANET_RADIUS } = await imp('src/world/planet.js');
const { LEGACY_SAIHOJI_PINE_LAYOUTS, SAIHOJI_PINE_SIZE } = await imp('src/world/saihoji.js');
const { getOptimizedSaihojiPineBounds } = await imp('src/assets/saihojiPineOptimized.js');
const { LEVIATHAN_GARDEN_SCALE } = await imp('src/assets/leviathanIsland.js');
const P = await imp('src/assets/saihojiClusterPine.js');

const out = {};
let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`); if (!ok) failures++; };

// ① 原高复算：旧公式（工厂根 1.02 × 布局 scale × SAIHOJI_PINE_SIZE × 鲲背 0.43 × 旧 whaleBack heightScale）
const legacy = Object.values(LEGACY_SAIHOJI_PINE_LAYOUTS).flat();
const legacyHeights = legacy.map((s) => {
  const hs = s.scale > 1.15 ? 0.93 : s.scale >= 0.95 ? 1.07 : 1.2;
  return getOptimizedSaihojiPineBounds(s.seed).height * 1.02 * s.scale * SAIHOJI_PINE_SIZE * LEVIATHAN_GARDEN_SCALE * hs;
});
const legacyMean = legacyHeights.reduce((a, b) => a + b, 0) / legacyHeights.length;
out.legacy = { trees: legacy.length, mean: legacyMean, min: Math.min(...legacyHeights), max: Math.max(...legacyHeights) };
check('旧 25 株平均高复算 ≈ 常量 SAIHOJI_LEGACY_PINE_MEAN_HEIGHT（±1.5%）', legacy.length === 25 && Math.abs(legacyMean / P.SAIHOJI_LEGACY_PINE_MEAN_HEIGHT - 1) < 0.015, out.legacy);

// 真场景
const scene = new T.Scene();
const loaded = saihojiGardenScene.load({ scene, planetRadius: PLANET_RADIUS, options: {} });
scene.updateMatrixWorld(true);
const whale = loaded.group, island = whale.getObjectByName('leviathan-island');
const inv = island.matrixWorld.clone().invert();
const pines = []; whale.traverse((n) => { if (n.userData.kind === 'gardenPine') pines.push(n); });
const v = new T.Vector3();
const trees = pines.map((p) => {
  const rootLocal = island.worldToLocal(p.getWorldPosition(new T.Vector3()));
  let top = -Infinity, bottom = Infinity, crownLow = Infinity, crownTris = 0, meshes = 0;
  const crownPts = [];
  p.traverse((n) => {
    if (!n.isMesh) return; meshes++;
    const m = new T.Matrix4().multiplyMatrices(inv, n.matrixWorld), a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(m);
      top = Math.max(top, v.y); bottom = Math.min(bottom, v.y);
      if (n.userData.pineCrown) { crownLow = Math.min(crownLow, v.y); if (i % 3 === 0) crownPts.push([v.x, v.z]); }
    }
    if (n.userData.pineCrown) crownTris += a.count / 3;
  });
  return { seed: p.userData.sourceSeed, cluster: p.userData.pineCluster, key: p.userData.pineClusterKey, sparse: !!p.userData.clusterPine?.sparse,
    root: [rootLocal.x, rootLocal.z], h: top - bottom, bare: (crownLow - bottom) / (top - bottom), crownTris, meshes, crownPts,
    procedural: !!p.userData.pineOptimization?.procedural };
});
const mean = trees.reduce((a, t) => a + t.h, 0) / trees.length;
out.new = { trees: trees.length, mean, ratio: mean / legacyMean, min: Math.min(...trees.map((t) => t.h)), max: Math.max(...trees.map((t) => t.h)) };
check('苔庭全部松树为新丛松，且按参考图只有一丛 6 棵', trees.length === 6 && trees.every((t) => t.procedural && t.cluster), { trees: trees.length });
check('② 新松平均高 = 原 × 2.5（±2%）', Math.abs(out.new.ratio / 2.5 - 1) < 0.02, out.new);

out.clusters = [];
for (const c of P.SAIHOJI_PINE_CLUSTERS) {
  const ts = trees.filter((t) => t.cluster === c.id);
  const H = ts.reduce((a, t) => a + t.h, 0) / ts.length;
  const nn = ts.map((t, i) => Math.min(...ts.filter((_, j) => j !== i).map((o) => Math.hypot(o.root[0] - t.root[0], o.root[1] - t.root[1]))) / H);
  let span = 0; for (const a of ts) for (const b of ts) span = Math.max(span, Math.hypot(a.root[0] - b.root[0], a.root[1] - b.root[1]));
  const trunkDia = 2 * 0.024 * 1.45; // 树干根部（含根张）直径 / 树高
  const rootWidth = span / H + trunkDia;
  // 冠幅：丛长轴 = 根部最远两点方向
  let ax = [1, 0], best = 0;
  for (const a of ts) for (const b of ts) { const d = Math.hypot(a.root[0] - b.root[0], a.root[1] - b.root[1]); if (d > best) { best = d; ax = [(b.root[0] - a.root[0]) / d, (b.root[1] - a.root[1]) / d]; } }
  const proj = ts.flatMap((t) => t.crownPts.map(([x, z]) => x * ax[0] + z * ax[1]));
  const crown = (Math.max(...proj) - Math.min(...proj)) / H;
  const hs = ts.map((t) => t.h);
  const tallest = ts.reduce((a, t) => (t.h > a.h ? t : a));
  const others = ts.filter((t) => !t.sparse);
  const r = { id: c.id, trees: ts.length, H, tallOverShort: Math.max(...hs) / Math.min(...hs), nnMin: Math.min(...nn), nnMax: Math.max(...nn), rootWidth, crown,
    bare: [Math.min(...ts.map((t) => t.bare)), Math.max(...ts.map((t) => t.bare))], sparse: ts.filter((t) => t.sparse).map((t) => t.key), tallest: tallest.key,
    sparseLeaf: ts.some((t) => t.sparse) ? ts.find((t) => t.sparse).crownTris / (others.reduce((a, t) => a + t.crownTris, 0) / others.length) : null };
  out.clusters.push(r);
  check(`[${c.id}] 4–6 棵`, ts.length >= 4 && ts.length <= 6, ts.length);
  check(`[${c.id}] 最高 / 最矮 1.25–1.45`, r.tallOverShort >= 1.25 && r.tallOverShort <= 1.45, +r.tallOverShort.toFixed(3));
  check(`[${c.id}] ③ 相邻根距 0.05–0.15 H，且有一对 ≤ 0.07 H`, r.nnMin >= 0.05 && r.nnMax <= 0.15 && r.nnMin <= 0.07, { min: +r.nnMin.toFixed(3), max: +r.nnMax.toFixed(3) });
  check(`[${c.id}] ③ 根部跨度 0.5–0.6 H`, r.rootWidth >= 0.5 && r.rootWidth <= 0.6, +r.rootWidth.toFixed(3));
  // 2026-11-11 06:48 参考图实量：最左叶垫（x≈165）到最右（x≈1110）≈ 945 px ≈ 1.13 H（H≈834 px）；旧 0.8–0.9 是按上一版理解定的
  check(`[${c.id}] ④ 冠幅 0.9–1.2 H（参考图实量 ≈1.13 H）`, r.crown >= 0.9 && r.crown <= 1.2, +r.crown.toFixed(3));
  check(`[${c.id}] ④ 树干光秃 55–62%`, r.bare[0] >= 0.55 && r.bare[1] <= 0.62, r.bare.map((x) => +x.toFixed(3)));
  if (ts.length === 6) check(`[${c.id}] ⑤ 最高的一棵为稀疏枯松，叶量 < 45%`, r.sparse.length === 1 && r.tallest === r.sparse[0] && r.sparseLeaf < 0.45, { sparse: r.sparse, tallest: r.tallest, leaf: r.sparseLeaf && +r.sparseLeaf.toFixed(3) });
}
check('至少一丛 6 棵', out.clusters.some((c) => c.trees === 6));

// ⑥ 玩法与性能
const covers = whale.userData.saihojiCoverPoints || [];
check('⑥ 伏击隐蔽槽 50 个、净空 ≥ 1.12', covers.length === 50 && covers.every((c) => c.clearance >= 1.12), { count: covers.length, minClear: Math.min(...covers.map((c) => c.clearance)) });
check('⑥ 每棵 2 个网格（树皮 + 叶垫）', trees.every((t) => t.meshes === 2));
const nature = readFileSync(join(root, 'src/world/nature.js'), 'utf8'), terrace = readFileSync(join(root, 'src/world/citadel/terracePlanting.js'), 'utf8');
check('⑥ 主岛林带 / 圣城台地仍用旧 Blender 古松工厂（只改苔庭）', /createOptimizedSaihojiPine\(/.test(nature) && /createOptimizedSaihojiPine\(/.test(terrace) && !/saihojiClusterPine/.test(nature + terrace));

console.log(JSON.stringify({ legacy: out.legacy, new: out.new, clusters: out.clusters.map((c) => Object.fromEntries(Object.entries(c).map(([k, x]) => [k, typeof x === 'number' ? +x.toFixed(3) : Array.isArray(x) ? x.map((y) => (typeof y === 'number' ? +y.toFixed(3) : y)) : x]))) }));
assert.equal(failures, 0, `${failures} 项未通过`);
console.log('ALL PASS');
