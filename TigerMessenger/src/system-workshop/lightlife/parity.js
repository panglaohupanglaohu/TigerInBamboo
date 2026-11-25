/**
 * parity.js — 原版当裁判（Guide §1.4 创新 1）：光照 / 大纹理 / 体素图三个嫁接各自的对照（R63–R64）。纯逻辑，不写文件、不 import 任何东西。
 * 原版 lighting.js 顶上 import 'three'，Node 里要先把 'three' 指到 vendor/three.module.js（module.register）再动态 import，
 * 所以模块由调用方载好传进来（tools/refactor/lightlife-parity.mjs、tests/lightlife-parity.test.mjs）：
 *   mods = { O: { lighting, town, megatex }（townscaper-web/REACode/src，只读）,
 *            G: { light: voxel-light.js, mega: mega-atlas.js, town: town-graph.js }（本轮嫁接进 REACodeRefactoring 的模块）,
 *            R: { bake: light/bake.js, world: core/world.js, spatial: core/spatial.js, palette: core/palette.js }（重构库原有）,
 *            grid: squareGrid }
 * 每组比两种口径：
 *   同判据   嫁接模块按原版的参数、原版的输入跑——应当逐值相同；不同 = 「gap」（两份实现对同一输入给出不同结果，要查）。
 *   重构库   重构库原有的同职责模块（bake.js / World.regions / spatial / palette）——不同是设计差异「design」，逐条写原因。
 * 「同判据一致」只说明这几个统计量在这几份固定输入上一致，不代表任意输入等价。
 */
export const LIGHTLIFE_PARITY_VERSION = 1;
export const PARITY_INPUTS = Object.freeze({
  lighting: Object.freeze({ n: 12, step: 1, levelHeight: 0.5, seed: 5, res: 0.09, pad: 0.9, blurRadius: 4, blurPasses: 2, bounce: Object.freeze({ passes: 3, gain: 0.9, stride: 3, airGain: 0.25 }) }),
  megatex: Object.freeze({ faces: 150, seed: 7, size: 512, pads: Object.freeze([0, 2]) }),
  town: Object.freeze({ n: 14, seed: 9, ops: 220 }),
});
export const ORIGINAL_FILES = Object.freeze({ lighting: 'townscaper-web/REACode/src/lighting.js', megatex: 'townscaper-web/REACode/src/megatex.js', town: 'townscaper-web/REACode/src/town.js' });
export const GRAFT_FILES = Object.freeze({ lighting: 'townscaper-web/REACodeRefactoring/src/light/voxel-light.js', megatex: 'townscaper-web/REACodeRefactoring/src/light/mega-atlas.js', town: 'townscaper-web/REACodeRefactoring/src/core/town-graph.js' });
export const LIBRARY_FILES = Object.freeze({ lighting: ['townscaper-web/REACodeRefactoring/src/light/bake.js'], megatex: ['townscaper-web/REACodeRefactoring/src/light/texel-owner.js', 'townscaper-web/REACodeRefactoring/src/core/atlas.js'], town: ['townscaper-web/REACodeRefactoring/src/core/world.js', 'townscaper-web/REACodeRefactoring/src/core/spatial.js', 'townscaper-web/REACodeRefactoring/src/core/palette.js'] });
export const PARITY_CLIPS = Object.freeze({ lighting: ['931196707236392960', '1168571866405097472', '1237305125070426112', '1580846877855338497'], megatex: ['1481661852887265288'], town: [] });
/** 光影与生命层里真实调用这几个嫁接模块的能力：每个都拿到对应那份对照作 ④ 的证据 */
export const PARITY_CAPABILITIES = Object.freeze({ 'light.voxel-ao': 'lighting', 'light.bounce': 'lighting', 'light.megatex': 'megatex', 'scene.town-graph': 'town' });

const r6 = (v) => Math.round(v * 1e6) / 1e6;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
function diffStats(a, b) {
  let max = 0, sum = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; const n = a.length;
  for (let i = 0; i < n; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; sum += d; sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; }
  const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2, pear = va > 0 && vb > 0 ? (sab / n - (sa / n) * (sb / n)) / Math.sqrt(va * vb) : 1;
  return { maxAbs: r6(max), meanAbs: r6(sum / Math.max(1, n)), pearson: r6(pear), meanA: r6(sa / n), meanB: r6(sb / n) };
}

/* ---------------------------------------------------------------- 光照（lighting.js → voxel-light.js / bake.js） */
function lightingFixture(mods, I) {
  const R = rng(I.seed), grid = mods.grid(I.n, I.step, 0, 0), colors = mods.R.palette.PALETTES.town.colors, hts = [], paint = [];
  for (const c of grid.cells) { const edge = c.i === 0 || c.j === 0 || c.i === I.n - 1 || c.j === I.n - 1; hts.push(edge ? 0 : R() < 0.15 ? 0 : 1 + Math.floor(R() * (R() < 0.3 ? 7 : 3))); paint.push(colors[Math.floor(R() * colors.length)]); }
  const colorOf = (c) => hexRgb(paint[c.id]);
  // 三角形汤：每格顶面两个三角 + 侧墙（同 scene-voxels.columnMesh 的规则，这里内联，免得对照依赖被测模块）
  const pos = [], col = [];
  const push = (pts, c) => { for (const p of pts) pos.push(...p); const k = colorOf(c); for (let v = 0; v < 3; v++) col.push(k.r, k.g, k.b); };
  for (const c of grid.cells) {
    const t = hts[c.id]; if (!t) continue; const y = t * I.levelHeight, [a, b, cc, d] = c.pts;
    push([[a.x, y, a.z], [cc.x, y, cc.z], [b.x, y, b.z]], c); push([[a.x, y, a.z], [d.x, y, d.z], [cc.x, y, cc.z]], c);
    for (let e = 0; e < 4; e++) { const nid = c.edgeNeighbors[e], nt = nid < 0 ? 0 : hts[nid]; if (nt >= t) continue; const p = c.pts[e], q = c.pts[(e + 1) % 4], y0 = nt * I.levelHeight; push([[p.x, y0, p.z], [q.x, y, q.z], [q.x, y0, q.z]], c); push([[p.x, y0, p.z], [p.x, y, p.z], [q.x, y, q.z]], c); }
  }
  return { grid, hts, colorOf, pos, col };
}
export function lightingParity(mods, I = PARITY_INPUTS.lighting) {
  const fx = lightingFixture(mods, I), { grid, hts, colorOf, pos } = fx;
  const townO = new mods.O.town.Town(grid), world = new mods.R.world.World(grid);
  for (const c of grid.cells) { townO.fill(c, hts[c.id]); world.fill(c, hts[c.id], { rock: false }); }
  const fieldOpts = { grid, levelHeight: I.levelHeight, res: I.res, pad: I.pad, blurRadius: I.blurRadius, blurPasses: I.blurPasses };
  const fO = mods.O.lighting.buildVoxelField({ ...fieldOpts, sets: [{ town: townO, colorOf }] }), fG = mods.G.light.buildVoxelField({ ...fieldOpts, sets: [{ world, colorOf }] });
  const colO = fx.col.slice(), colG = fx.col.slice(), colB = fx.col.slice();
  mods.O.lighting.bakeVertexAO(fO, pos, colO); mods.G.light.bakeVertexAO(fG, pos, colG);
  mods.R.bake.bakeLighting({ pos, col: colB }, world, { L: I.levelHeight, colorOf, res: I.res, radius: I.blurRadius });
  // 多跳：两边各重建一张新场再扩散（扩散会改场）
  const b = I.bounce, fO2 = mods.O.lighting.buildVoxelField({ ...fieldOpts, sets: [{ town: townO, colorOf }] }), fG2 = mods.G.light.buildVoxelField({ ...fieldOpts, sets: [{ world, colorOf }] });
  mods.O.lighting.diffuseBounce(fO2, b.passes, b.gain, b.stride); mods.G.light.diffuseBounce(fG2, b.passes, b.gain, b.stride);
  const colO2 = fx.col.slice(), colG2 = fx.col.slice();
  mods.O.lighting.bakeVertexAO(fO2, pos, colO2, { airGain: b.airGain }); mods.G.light.bakeVertexAO(fG2, pos, colG2, { airGain: b.airGain });
  const occSame = fO.occ.length === fG.occ.length && fO.occ.every((v, i) => v === fG.occ[i]);
  const cases = {
    field: { original: { W: fO.W, H: fO.H, L: fO.L, voxels: fO.voxels }, graft: { W: fG.W, H: fG.H, L: fG.L, voxels: fG.voxels }, occIdentical: occSame },
    singleBounce: { graft: diffStats(colO, colG), library: diffStats(colO, colB) },
    multiBounce: { graft: diffStats(colO2, colG2), libraryHasMultiBounce: typeof mods.R.bake.diffuseBounce === 'function', vsSingle: diffStats(colO, colO2) },
  };
  const diffs = [];
  if (!occSame || cases.field.original.voxels !== cases.field.graft.voxels) diffs.push({ id: 'lighting.same.field', metric: 'field', kind: 'gap', original: cases.field.original, refactored: cases.field.graft, note: '同判据下占用场不一致：嫁接的 buildVoxelField 与原版对同一座小镇给出不同的栅格。' });
  if (cases.singleBounce.graft.maxAbs > 0) diffs.push({ id: 'lighting.same.vertexAO', metric: 'vertexColor', kind: 'gap', original: 0, refactored: cases.singleBounce.graft.maxAbs, note: '同判据下烘出来的顶点色不一致（单跳）。' });
  if (cases.multiBounce.graft.maxAbs > 0) diffs.push({ id: 'lighting.same.multiBounce', metric: 'vertexColor', kind: 'gap', original: 0, refactored: cases.multiBounce.graft.maxAbs, note: '同判据下多跳扩散后的顶点色不一致。' });
  if (cases.singleBounce.library.maxAbs > 0) diffs.push({ id: 'lighting.library.vertexAO', metric: 'vertexColor', kind: 'design', original: cases.singleBounce.library.meanA, refactored: cases.singleBounce.library.meanB, note: `重构库 light/bake.js 与原版单跳 AO 不逐值相同（最大差 ${cases.singleBounce.library.maxAbs}，平均差 ${cases.singleBounce.library.meanAbs}，相关 ${cases.singleBounce.library.pearson}）：bake.js 包围盒外扩 0.8（原版 0.9）、扫描线栅格化（原版逐像素点在格内测试）、只在每层有内容的窗口里模糊、第 0 层不采样；数学同一套（1 − 0.62·占用 + 0.42 反弹）。` });
  if (!cases.multiBounce.libraryHasMultiBounce) diffs.push({ id: 'lighting.library.multiBounce', metric: 'multiBounce', kind: 'design', original: 'diffuseBounce', refactored: 'voxel-light.js diffuseBounce（本轮嫁接）', note: `重构库原有的 bake.js 没有多跳扩散；本轮嫁接到 light/voxel-light.js。多跳相对单跳平均改了 ${cases.multiBounce.vsSingle.meanAbs}（最大 ${cases.multiBounce.vsSingle.maxAbs}）。` });
  return { line: 'light', cases, diffs, sameCriteriaEqual: !diffs.some((x) => x.kind === 'gap') };
}

/* ---------------------------------------------------------------- 大纹理（megatex.js → mega-atlas.js / texel-owner.js） */
const MEASURE_KEYS = ['fail', 'usedH', 'faceArea', 'padArea', 'occupancy', 'padShare', 'checked', 'exact', 'exactRate', 'maxUV', 'edgeSamples', 'bleed', 'bleedRate', 'meanErr'];
const pickM = (m) => Object.fromEntries(MEASURE_KEYS.map((k) => [k, typeof m[k] === 'number' ? r6(m[k]) : m[k]]));
export function megatexParity(mods, I = PARITY_INPUTS.megatex) {
  const O = mods.O.megatex.measure(), facesG = mods.G.mega.genFaces(I.faces, I.seed), facesO = mods.O.megatex.genFaces(I.faces, I.seed);
  const facesSame = JSON.stringify(facesO) === JSON.stringify(facesG.map(({ key, ...f }) => f));
  const S = mods.G.mega.measure({ faces: facesG, size: I.size, pads: I.pads, pack: 'shelf' }), A = mods.G.mega.measure({ faces: facesG, size: I.size, pads: I.pads, pack: 'atlas' });
  const cases = {}, diffs = [];
  if (!facesSame) diffs.push({ id: 'megatex.same.faces', metric: 'faces', kind: 'gap', original: facesO.length, refactored: facesG.length, note: 'genFaces 同 n / seed 给出的面不一样。' });
  for (const pad of I.pads) {
    const o = pickM(O[pad]), s = pickM(S[pad]), a = pickM(A[pad]);
    const mipO = mods.O.megatex.mipDown(O[pad].A, 2), mipS = mods.G.mega.mipDown(S[pad].A, 2);
    const mipSame = mipO.owner.length === mipS.owner.length && mipO.owner.every((v, i) => v === mipS.owner[i]);
    cases['pad' + pad] = { original: o, shelf: s, atlas: a, mipOwnerSame: mipSame };
    for (const k of MEASURE_KEYS) {
      if (o[k] !== s[k]) diffs.push({ id: `megatex.same.pad${pad}.${k}`, metric: k, kind: 'gap', original: o[k], refactored: s[k], note: `同判据（货架排布）垫边 ${pad} 时 ${k} 不一致。` });
      if (['occupancy', 'exactRate', 'bleedRate', 'fail'].includes(k) && o[k] !== a[k]) diffs.push({ id: `megatex.library.pad${pad}.${k}`, metric: k, kind: 'design', original: o[k], refactored: a[k], note: `共享增量图集（TexelOwnerAtlas / core/atlas.js 的 guillotine 分配）与原版货架排布的 ${k} 不同：同一批面摆的位置不一样，邻面关系跟着变；游戏里的 impostor / 精灵图集用的是增量图集。` });
    }
    if (!mipSame) diffs.push({ id: `megatex.same.pad${pad}.mip`, metric: 'mipOwner', kind: 'gap', original: 'mipDown', refactored: 'mipDown', note: `垫边 ${pad} 时两级 mip 的 owner 表不一致。` });
  }
  return { line: 'atlas', cases, diffs, sameCriteriaEqual: !diffs.some((x) => x.kind === 'gap') };
}

/* ---------------------------------------------------------------- 体素图（town.js → town-graph.js / World / spatial / palette） */
export function townParity(mods, I = PARITY_INPUTS.town) {
  const R = rng(I.seed), grid = mods.grid(I.n, 1, 0, 0), O = new mods.O.town.Town(grid), G = new mods.G.town.Town(grid), cells = grid.cells;
  for (let k = 0; k < I.ops; k++) {
    const c = cells[Math.floor(R() * cells.length)], r = R();
    if (r < 0.55) { const h = Math.floor(R() * 7); O.fill(c, h); G.fill(c, h); }
    else if (r < 0.8) { const lv = 1 + Math.floor(R() * 10), on = R() < 0.4; O.setSolid(c, lv, on); G.setSolid(c, lv, on); }
    else { const col = Math.floor(R() * 15); O.setColor(c, col); G.setColor(c, col); }
  }
  const colsSame = cells.every((c) => O.top(c) === G.top(c) && O.bottom(c) === G.bottom(c) && O.isFloating(c) === G.isFloating(c) && O.color(c) === G.color(c) && [0, 1, 2, 3].every((e) => O.neighborTop(c, e) === G.neighborTop(c, e)));
  const sig = (rs) => rs.regions.map((r) => `${r.h}:${r.isWalkway ? 'w' : 'b'}:${r.cells.map((c) => c.id).sort((a, b) => a - b).join(',')}`).sort();
  const rO = O.regions(), rG = G.regions(), regionsSame = JSON.stringify(sig(rO)) === JSON.stringify(sig(rG)) && rO.regionOf.every((v, i) => (v < 0) === (rG.regionOf[i] < 0) && (v !== -2) === (rG.regionOf[i] !== -2));
  // 重构库原有 World.regions()：只连「顶部是建筑」的格子。同一份体素抄进新 World，顶部 ≤ 2 层的柱子当地形（岩石层），其余当建筑
  const W = new mods.R.world.World(grid); for (const c of cells) { const m = G.world.solid[c.id] & 511; W.solid[c.id] = m; W.rock[c.id] = G.top(c) <= 2 ? m : 0; } W.touch();
  const rW = W.regions();
  // 同名函数（对账别名）：pointInQuad 同算法；buildCellIndex 都要能找到点所在的格
  let pq = 0, pqSame = 0, idxBoth = 0, idxN = 0; const Ri = rng(I.seed + 1), decorated = mods.O.town.decorateCells({ cells: cells.map((c) => ({ ...c, pts: c.pts.map((p) => ({ ...p })) })) });
  const idxO = mods.O.town.buildCellIndex(decorated), idxR = mods.R.spatial.buildCellIndex(grid);
  for (let k = 0; k < 400; k++) {
    const q = cells[Math.floor(Ri() * cells.length)].pts, x = Ri() * I.n, z = Ri() * I.n; pq++; if (mods.O.town.pointInQuad(q, x, z) === mods.R.spatial.pointInQuad(q, x, z)) pqSame++;
    const truth = cells.find((c) => x >= c.minX && x < c.maxX && z >= c.minZ && z < c.maxZ); if (!truth) continue; idxN++;
    if (idxO.at(x, z).some((c) => c.id === truth.id) && idxR.cellAt(x, z)?.id === truth.id) idxBoth++;
  }
  const pal = ['town', 'pastel', 'dusk'].every((k) => JSON.stringify(mods.O.town.PALETTES[k].colors) === JSON.stringify(mods.R.palette.PALETTES[k].colors));
  const terrainSameKeys = Object.keys(mods.O.town.TERRAIN).filter((k) => k in mods.R.palette.TERRAIN);
  const cases = { columns: { same: colsSame }, regions: { original: { regions: rO.regions.length, walkways: rO.regions.filter((r) => r.isWalkway).length }, graft: { regions: rG.regions.length, walkways: rG.regions.filter((r) => r.isWalkway).length }, worldRegions: rW.regions.length, same: regionsSame },
    aliases: { pointInQuad: { samples: pq, same: pqSame }, buildCellIndex: { samples: idxN, bothFind: idxBoth }, palettesSame: pal, terrainSharedKeys: terrainSameKeys } };
  const diffs = [];
  if (!colsSame) diffs.push({ id: 'town.same.columns', metric: 'columns', kind: 'gap', original: 'Town', refactored: 'town-graph Town', note: '同一串编辑之后 top / bottom / isFloating / 颜色 / neighborTop 不一致。' });
  if (!regionsSame) diffs.push({ id: 'town.same.regions', metric: 'regions', kind: 'gap', original: cases.regions.original, refactored: cases.regions.graft, note: '同一串编辑之后区域图不一致。' });
  if (pqSame !== pq) diffs.push({ id: 'town.alias.pointInQuad', metric: 'pointInQuad', kind: 'gap', original: pq, refactored: pqSame, note: 'core/spatial.js 的 pointInQuad 与原版对同一点给出不同结果。' });
  if (idxBoth !== idxN) diffs.push({ id: 'town.alias.buildCellIndex', metric: 'buildCellIndex', kind: 'gap', original: idxN, refactored: idxBoth, note: '空间哈希没找到点所在的格。' });
  if (!pal) diffs.push({ id: 'town.alias.PALETTES', metric: 'PALETTES', kind: 'gap', original: 'PALETTES', refactored: 'core/palette.js PALETTES', note: '三套墙色色板颜色不一致。' });
  if (rW.regions.length !== rG.regions.length) diffs.push({ id: 'town.library.regions', metric: 'regions', kind: 'design', original: rG.regions.length, refactored: rW.regions.length, note: '重构库原有 World.regions() 只连顶部是建筑的格子、不分走道；原版 Town.regions() 连所有顶部同高的柱子（含 1 层走道 isWalkway）。两种都留：town-graph.js 给需要原版口径的消费者。' });
  diffs.push({ id: 'town.library.TERRAIN', metric: 'TERRAIN', kind: 'design', original: Object.keys(mods.O.town.TERRAIN).length, refactored: Object.keys(mods.R.palette.TERRAIN).length, note: `原版 town.js 的 TERRAIN 是灰泥 / 屋顶 / 路面 / 码头等城镇材质色，重构库 core/palette.js 的同名 TERRAIN 是岩石 / 沙 / 草等地形色——同名不同物，共有键 ${terrainSameKeys.length} 个（${terrainSameKeys.join('、') || '无'}）。` });
  diffs.push({ id: 'town.library.decorateCells', metric: 'size', kind: 'design', original: '对角线一半的均值', refactored: '角到格心平均距离 × 0.7', note: 'decorateCells 的 cell.size 口径不同（方格时接近）；包围盒相同。' });
  return { line: 'grid', cases, diffs, sameCriteriaEqual: !diffs.some((x) => x.kind === 'gap') };
}

/** 跑三组对照，返回 { lighting, megatex, town } 三份登记文档（capability 字段由写文件的脚本按能力 ID 填）。 */
export function runLightLifeParity(mods) {
  const out = {};
  for (const [key, fn] of [['lighting', lightingParity], ['megatex', megatexParity], ['town', townParity]]) {
    const r = fn(mods, PARITY_INPUTS[key]);
    out[key] = { schemaVersion: 1, parityVersion: LIGHTLIFE_PARITY_VERSION, line: r.line, verdict: r.diffs.length ? 'diff-registered' : 'equivalent', sameCriteriaEqual: r.sameCriteriaEqual,
      original: [ORIGINAL_FILES[key]], refactored: [GRAFT_FILES[key], ...LIBRARY_FILES[key]], clips: PARITY_CLIPS[key].slice(), inputs: JSON.parse(JSON.stringify(PARITY_INPUTS[key])),
      cases: r.cases, diffs: r.diffs, gaps: r.diffs.filter((x) => x.kind === 'gap').length,
      basis: '同一份固定输入喂给原版与嫁接模块（同判据，应逐值相同），再与重构库原有的同职责模块比（设计差异，逐条写原因）。一致只说明这几个统计量在这份输入上一致。' };
  }
  return out;
}
/** 补学队列需求行（export-learn-queue 读 catalog/parity/*-demand.json 的格式 [{id,name,clips,reason}]）：只登记 gap。 */
export function parityDemand(docs) {
  const rows = [];
  for (const [key, doc] of Object.entries(docs)) for (const d of doc.diffs.filter((x) => x.kind === 'gap')) rows.push({ id: `parity:${key}:${d.id}`, name: '原版对照缺口·' + key + '·' + d.metric, clips: doc.clips.slice(), reason: d.note, source: 'parity', parity: `TigerMessenger/src/scene-authoring/catalog/parity/${key}.json#${d.id}` });
  return rows;
}
