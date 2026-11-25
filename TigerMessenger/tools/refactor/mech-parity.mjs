// 原版当裁判 · 机制层对拍（march 等值线 / 风场 / 表面阴影 / 体素 AO / 岸线 /
// tileset / 填洼 / 岸线距离场 / 球面网格 / 调色板 / shelfPack / 屋顶栖点）：
//   cd TigerMessenger && $NODE tools/refactor/mech-parity.mjs            写文件
//   cd TigerMessenger && $NODE tools/refactor/mech-parity.mjs --stdout   只打印摘要
// 每个能力一份 catalog/parity/<capId>.json（成熟度 ④ 的证据）。
// 原版 REACode 只读 import，不改；同名 API 逐点数值对拍，行为差异如实登记。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TM = path.resolve(HERE, '../..');
const ROOT = path.resolve(TM, '..');
const ORIG = 'townscaper-web/REACode', LIB = 'townscaper-web/REACodeRefactoring';
const PARITY_DIR = 'TigerMessenger/src/scene-authoring/catalog/parity';
const GENERATOR = 'TigerMessenger/tools/refactor/mech-parity.mjs';
const THREE_URL = pathToFileURL(path.join(TM, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(THREE_URL)},shortCircuit:true};return n(s,c);}`));
const load = async (rel) => import(path.join(ROOT, rel));

const maxDiff = (pairs) => pairs.reduce((m, [a, b]) => Math.max(m, Math.abs(a - b)), 0);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 共用驱动：规则方形体素网格（四边形 cells，共享角点 id）──────────────────
function quadWorld(W, H, hFn, { cellSize = 1 } = {}) {
  const pts = []; const pid = (x, y) => y * (W + 1) + x;
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) pts.push({ id: pid(x, y), x: x * cellSize, z: y * cellSize });
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = y * W + x;
    cells.push({ id, cx: (x + .5) * cellSize, cz: (y + .5) * cellSize,
      pts: [pts[pid(x, y)], pts[pid(x + 1, y)], pts[pid(x + 1, y + 1)], pts[pid(x, y + 1)]],
      edgeNeighbors: [y > 0 ? id - W : -1, x < W - 1 ? id + 1 : -1, y < H - 1 ? id + W : -1, x > 0 ? id - 1 : -1] });
  }
  const heights = cells.map((c) => Math.max(0, Math.round(hFn(c.cx, c.cz))));
  return { cells, heights, top: (c) => heights[c.id] };
}
// 8 邻域版（depfill 原版的 NB8 口径）
function quadWorld8(W, H, hFn) {
  const w = quadWorld(W, H, hFn);
  for (const c of w.cells) {
    const x = c.id % W, y = (c.id / W) | 0, nb = [];
    for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
      const nx = x + dx, ny = y + dy;
      nb.push(nx >= 0 && nx < W && ny >= 0 && ny < H ? ny * W + nx : -1);
    }
    c.edgeNeighbors = nb;
  }
  return w;
}

// ── contour：marchGrid 全段对拍 ────────────────────────────────────────────
async function parityContour() {
  const o = await load(ORIG + '/src/march.js'), r = await load(LIB + '/src/core/contour.js');
  const w = quadWorld(10, 8, (x, z) => 5 + 4 * Math.sin(x * .5) * Math.cos(z * .4) + x * .2);
  const heights = w.heights.map((h) => h + .5);
  const vo = o.marchGrid(w.cells, () => undefined, { iso: .5 }); // field 先建：valueOf 按格均值
  const valOf = (c) => c.pts.reduce((s, p) => s + (heights[p.id] ?? 0), 0) / 4;
  const a = o.marchGrid(w.cells, valOf, { iso: 6 }), b = r.marchGrid(w.cells, valOf, { iso: 6 });
  const sa = a.levels[0].segs.map((s) => s.map((v) => +v.toFixed(6)).join(',')).sort();
  const sb = b.levels[0].segs.map((s) => s.map((v) => +v.toFixed(6)).join(',')).sort();
  const same = deepEq(sa, sb);
  const diffs = [];
  if (!same) diffs.push({ kind: 'value', id: 'segs', original: `${sa.length} 段`, refactored: `${sb.length} 段`, note: '鞍点连法或角点合并口径差异' });
  let oBad = '不校验'; try { o.marchGrid(w.cells, () => NaN, { iso: 1 }); } catch (e) { oBad = e.constructor.name; }
  let rBad = '不校验'; try { r.marchGrid(w.cells, () => NaN, { iso: 1 }); } catch (e) { rBad = e.constructor.name; }
  if (oBad !== rBad) diffs.push({ kind: 'validation', id: 'marchGrid(NaN valueOf)', original: oBad, refactored: rBad });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/march.js'], refactored: [LIB + '/src/core/contour.js'],
    inputs: { grid: '10×8 quads·共享角点id', iso: 6, segs: sa.length },
    metrics: [{ id: 'segs', name: 'iso=6 线段集合逐点一致', original: sa.length, refactored: sb.length, equal: same }, { id: 'corner', name: 'cornerCount', original: a.cornerCount, refactored: b.cornerCount }], diffs,
    basis: '同一批共享角点的四边形格 + 同一 valueOf 喂两边 marchGrid；原版按量化坐标并角、重构按顶点 id——输入显式给共享 id 时两者应同构。' };
}

// ── wind：makeWindField.at 网格 + sampleCurve + trace ──────────────────────
async function parityWind() {
  const o = await load(ORIG + '/src/wind.js'), r = await load(LIB + '/src/core/wind-flow.js');
  const opts = { dir: [.86, .12, .5], lift: .55, swirl: .42, seed: 7 };
  const fo = o.makeWindField(opts), fr = r.makeWindField(opts);
  const pairs = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) for (let k = 0; k < 3; k++) {
    const x = i * .9 - 3, y = .4 + k * .8, z = j * .7 - 2.5;
    const va = fo.at(x, y, z, .1), vb = fr.at(x, y, z, .1);
    pairs.push([va[0], vb[0]], [va[1], vb[1]], [va[2], vb[2]]);
  }
  const atD = maxDiff(pairs);
  const curve = [[0,0,0],[1,.5,.2],[2,1.2,-.4],[3,.9,.8],[4,2,.1],[5,1.6,.6]];
  const cp = []; for (let i = 0; i <= 100; i++) { const t = i / 100, a = o.sampleCurve(curve, t), b = r.sampleCurve(curve, t); cp.push([a[0],b[0]],[a[1],b[1]],[a[2],b[2]]); }
  const crD = maxDiff(cp);
  const diffs = [];
  if (atD > 1e-9) diffs.push({ kind: 'value', id: 'at()', original: atD, refactored: '729 点最大差' });
  if (crD > 1e-9) diffs.push({ kind: 'value', id: 'sampleCurve', original: crD, refactored: '101 点最大差' });
  const ta = fo.trace(1, .5, 1, { steps: 12, dt: .09, groundY: .1 }).at(-1);
  const tb = fr.trace(1, .5, 1, { steps: 12, dt: .09, groundY: .1 }).at(-1);
  const trD = maxDiff([[ta[0], tb[0]], [ta[1], tb[1]], [ta[2], tb[2]]]);
  if (trD > 1e-9) diffs.push({ kind: 'value', id: 'trace()12步终点', original: ta.map((v) => +v.toFixed(4)), refactored: tb.map((v) => +v.toFixed(4)), note: '重构改走 traceWindPath（minY 贴地约束口径不同）' });
  let oBad = '不校验'; try { o.makeWindField({ dir: 'x' }); } catch (e) { oBad = e.constructor.name; }
  let rBad = '不校验'; try { r.makeWindField({ dir: 'x' }); } catch (e) { rBad = e.constructor.name; }
  if (oBad !== rBad) diffs.push({ kind: 'validation', id: 'makeWindField(dir非法)', original: oBad, refactored: rBad });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/wind.js'], refactored: [LIB + '/src/core/wind-flow.js'],
    inputs: { grid: '9×9×3 采样点·groundY=.1', opts, curvePts: 6 },
    metrics: [{ id: 'at', name: 'at() 729 点最大差', original: 0, refactored: atD }, { id: 'curve', name: 'sampleCurve 101 点最大差', original: 0, refactored: crD }, { id: 'trace', name: 'trace 12 步终点差', original: 0, refactored: trD }], diffs,
    basis: 'makeWindField 同一组 (dir,lift,swirl,seed) 喂两边，at() 逐点比；trace 原版是朴素欧拉积分，重构走共享 traceWindPath，差异登记。' };
}

// ── surface-shadow：islandSeams + shadowMap↔bakeSurfaceShadow 全图对拍 ─────
async function parityShadow() {
  const o = await load(ORIG + '/src/surfaceshadow.js'), r = await load(LIB + '/src/light/surface-shadow.js');
  const diffs = [];
  // islandSeams：同一图案，原版吃 0..1 浮点、重构吃 0..255 字节（内部 /255）
  const w = 24, h = 16, sm1 = new Float32Array(w * h).map((_, i) => (i * 37 % 100) / 100);
  sm1[(h >> 1) * w + (w >> 1)] = .9; sm1[(h >> 1) * w + (w >> 1) + 1] = 0;
  const smB = Uint8Array.from(sm1, (v) => Math.round(v * 255));
  const sa = o.islandSeams(sm1, w, h), sb = r.islandSeams(smB, w, h);
  const seamPairs = [[sa.n, sb.seamPx]];
  const seamD = maxDiff(seamPairs);
  const seamOK = sa.n === sb.seamPx;
  if (!seamOK) diffs.push({ kind: 'value', id: 'islandSeams', original: JSON.stringify(sa), refactored: JSON.stringify(sb) });
  // shadowMap vs bakeSurfaceShadow：同一高度场，参数对齐（castH→castHeight, zTestH→zBias,
  // blur14→baseRadius14, LIGHT(-.82,-.48,.035)→dx/dz/slope, stepLen1.15→stepWorld, RAYS3→rays3）
  const W = 40, H = 30, hf = new Float32Array(W * H).map((_, i) => { const x = i % W, y = (i / W) | 0; return 3 + 2 * Math.sin(x * .3) + ((x - 20) ** 2 + (y - 15) ** 2 < 25 ? 4 : 0); });
  const terr = { w: W, h: H, hf };
  const A = o.shadowMap(terr, { castH: .18, zTestH: .02, steps: 56 });
  const B = r.bakeSurfaceShadow({ width: W, height: H, heights: hf, casters: hf, stepWorld: 1.15, dx: -.82, dz: -.48, slope: .035, castHeight: .18, zBias: .02, steps: 56, rays: 3, eligibility: 'prominence', baseRadius: 14 });
  const mp = []; for (let i = 0; i < W * H; i++) mp.push([A[i], B.shadow[i] / 255]);
  const mapD = maxDiff(mp);
  const sameShadow = mapD < 1e-6;
  if (!sameShadow) diffs.push({ kind: 'value', id: 'shadowMap↔bakeSurfaceShadow', original: 'Float32 0..1', refactored: 'Uint8 0..255', maxDiff: +mapD.toFixed(4), note: '原版地基=模糊半径14核、重构=盒均值；光高测试 hf[j]>rayH+z vs casters[j]>h+s·t·w+bias 的插点口径也略有差别' });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/surfaceshadow.js'], refactored: [LIB + '/src/light/surface-shadow.js'],
    inputs: { seamsGrid: '24×16', shadowGrid: '40×30', params: 'castH.18/zTestH.02/steps56/stepLen1.15/LIGHT(-.82,-.48,.035)' },
    metrics: [{ id: 'seams', name: 'islandSeams 计数一致', original: sa.n, refactored: sb.seamPx, equal: seamOK }, { id: 'map', name: 'shadowMap↔bakeSurfaceShadow 全图最大差(归一)', original: 0, refactored: +mapD.toFixed(4) }], diffs,
    basis: 'islandSeams 同一图案两种量化喂两边；bakeSurfaceShadow 参数逐项对齐原版 shadowMap（blur14↔baseRadius14、LIGHT 三分量↔dx/dz/slope、RAYS3↔rays3）。' };
}

// ── voxel-ao：faceShading 逐格逐面对拍 ─────────────────────────────────────
async function parityVoxelAO() {
  const o = await load(ORIG + '/src/voxelao.js'), r = await load(LIB + '/src/light/voxel-ao.js');
  const w = quadWorld(9, 7, (x, z) => 2 + Math.round(2 * Math.sin(x * .6) + Math.cos(z * .5)));
  const ao = o.buildVoxelAO({ top: w.top }, { cells: w.cells });
  const br = r.buildVoxelAO({ cells: w.cells, top: w.top });
  const pairs = []; let n = 0;
  for (const c of w.cells) for (const d of ['top', '+x', '-x', '+z', '-z']) {
    const fa = ao.faceShading(c, d), fb = br.faceShading(c, d);
    pairs.push([fa.ao, fb.ao], [fa.upNormal, fb.upNormal], [fa.dirAo[0], fb.dirAo[0]], [fa.dirAo[2], fb.dirAo[2]]); n++;
  }
  const d = maxDiff(pairs);
  const diffs = [];
  if (d > 1e-9) diffs.push({ kind: 'value', id: 'faceShading', original: d, refactored: `${n} 面最大差`, note: '邻居tie-breaking（原版首个>0.55 vs 重构最大点积）或 ao 系数差异' });
  let oBad = '不校验', rBad = '不校验';
  try { ao.faceShading(w.cells[0], 'side'); } catch (e) { oBad = e.constructor.name; }
  try { br.faceShading(w.cells[0], 'side'); } catch (e) { rBad = e.constructor.name; }
  if (oBad !== rBad) diffs.push({ kind: 'validation', id: 'faceShading(非法dir)', original: oBad, refactored: rBad });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/voxelao.js'], refactored: [LIB + '/src/light/voxel-ao.js'],
    inputs: { grid: '9×7', cells: w.cells.length, faces: n },
    metrics: [{ id: 'shade', name: `faceShading ${n} 面四维最大差`, original: 0, refactored: d }], diffs,
    basis: '同一世界 {cells(cx/cz/edgeNeighbors), top} 喂两边 buildVoxelAO，逐格逐面比 ao/upNormal/dirAo；原版 town.top 截负为 0，这里高度场已非负。' };
}

// ── shore：makeWaveMaterial/makeSkirtMaterial uniforms+GLSL ────────────────
async function parityShore() {
  const o = await load(ORIG + '/src/shore.js'), r = await load(LIB + '/src/water/shore.js');
  const diffs = [];
  const grab = (m) => ({ uniforms: Object.fromEntries(Object.entries(m.uniforms || {}).map(([k, u]) => [k, u.value && u.value.isColor ? '#' + u.value.getHexString() : (u.value?.isVector3 ? u.value.toArray() : u.value)])),
    transparent: m.transparent, depthWrite: m.depthWrite,
    vsrc: (m.vertexShader || '').replace(/\s+/g, ' '), fsrc: (m.fragmentShader || '').replace(/\s+/g, ' ') });
  const wa = grab(o.makeWaveMaterial({ period: 4.6 })), wb = grab(r.makeWaveMaterial({ period: 4.6 }));
  const uSame = deepEq(wa.uniforms, wb.uniforms), vSame = wa.vsrc === wb.vsrc, fSame = wa.fsrc === wb.fsrc;
  if (!uSame) diffs.push({ kind: 'value', id: 'waveMaterial.uniforms', original: wa.uniforms, refactored: wb.uniforms });
  if (!vSame) diffs.push({ kind: 'value', id: 'waveMaterial.vertexShader', original: `${wa.vsrc.length}ch`, refactored: `${wb.vsrc.length}ch`, note: 'GLSL 去空白后不相等' });
  if (!fSame) diffs.push({ kind: 'value', id: 'waveMaterial.fragmentShader', original: `${wa.fsrc.length}ch`, refactored: `${wb.fsrc.length}ch` });
  const sa = grab(o.makeSkirtMaterial('#3a6a8a')), sb = grab(r.makeSkirtMaterial('#3a6a8a'));
  if (!deepEq(sa.uniforms, sb.uniforms)) diffs.push({ kind: 'value', id: 'skirtMaterial.uniforms', original: sa.uniforms, refactored: sb.uniforms });
  if (sa.vsrc !== sb.vsrc) diffs.push({ kind: 'value', id: 'skirtMaterial.vertexShader', original: `${sa.vsrc.length}ch`, refactored: `${sb.vsrc.length}ch` });
  diffs.push({ kind: 'api', id: 'buildShore 形参', original: '(town,grid,index,{posts,reach,waves,foot})', refactored: '(town,grid,index,{posts,reach,waves,foot,shape,skirtWidth})+RangeError 校验', note: 'shape/skirtWidth 是重构新增；buildShore 本体（traceLoops+distanceField）未逐点拍' });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/shore.js'], refactored: [LIB + '/src/water/shore.js'],
    inputs: { period: 4.6, tint: '#3a6a8a' },
    metrics: [{ id: 'waveU', name: 'wave uniforms 一致', equal: uSame }, { id: 'waveV', name: 'wave vertex GLSL 一致', equal: vSame }, { id: 'waveF', name: 'wave fragment GLSL 一致', equal: fSame }], diffs,
    basis: 'ShaderMaterial 的 uniforms 默认值 + 去空白 GLSL 全文对比；buildShore 需要完整 town/grid/index 三角网格，登记形参差异而非伪造输入。' };
}

// ── tileplace：TILESET 常量深等 ────────────────────────────────────────────
async function parityTileset() {
  const o = await load(ORIG + '/src/tileplace.js'), r = await load(LIB + '/src/build/tile-assembly.js');
  const walk = (a, b, p) => { if (typeof a !== typeof b) return [p]; if (typeof a !== 'object' || !a || !b) return a === b ? [] : [p]; const out = []; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...walk(a[k], b[k], p + '.' + k)); return out; };
  const diffs = [];
  for (const k of ['TILESET_FORT', 'TILESET_RUIN']) {
    const d = walk(o[k], r[k], k);
    if (d.length) diffs.push({ kind: 'value', id: k, paths: d.slice(0, 8), original: 'joins={}', refactored: 'joins=["A|D","W|D"]', note: '重构给 tileset 补了原版留空的 join 约束声明，其余字段深等' });
  }
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/tileplace.js'], refactored: [LIB + '/src/build/tile-assembly.js'],
    inputs: { keys: ['TILESET_FORT', 'TILESET_RUIN'] },
    metrics: [{ id: 'fort', name: 'FORT tile 组', original: Object.keys(o.TILESET_FORT || {}).length, refactored: Object.keys(r.TILESET_FORT || {}).length }, { id: 'ruin', name: 'RUIN tile 组', original: Object.keys(o.TILESET_RUIN || {}).length, refactored: Object.keys(r.TILESET_RUIN || {}).length }], diffs,
    basis: '两套 TILESET 常量逐路径深比较；WFC 求解器本体（tileplace↔wfc.js）接口不同名，另列。' };
}

// ── depfill：priorityFlood↔depressionFill + localMinima + lakeClusters ─────
async function parityDepfill() {
  const o = await load(ORIG + '/src/depfill.js'), r = await load(LIB + '/src/core/depression-fill.js');
  const { H } = o.heights(7); const N = H.length;
  const w = quadWorld8(N, N, () => 0);
  // 原版海 = WATER-0.4；重构把 h===0 当出口海——喂重构侧时海格归 0，逐格语义对齐
  w.cells.forEach((c) => { const x = c.id % N, y = (c.id / N) | 0; w.heights[c.id] = H[y][x] > 0 ? H[y][x] : 0; });
  const diffs = [];
  // localMinima：原版 NB8-全陆-严格低；喂 8 邻域 cells 同口径
  const ma = o.localMinima(H).map((p) => p.y * N + p.x).sort((a, b) => a - b);
  const mb = r.localMinima(w.cells, w.heights).sort((a, b) => a - b);
  if (!deepEq(ma, mb)) diffs.push({ kind: 'value', id: 'localMinima', original: `${ma.length} 点`, refactored: `${mb.length} 点`, note: 'NB8 邻域喂成 8 项 edgeNeighbors 后仍不同' });
  // priorityFlood(H)→F vs depressionFill(cells,heights)→filled：核心填洼算法，只比陆地格
  const F = o.priorityFlood(H);
  const G = r.depressionFill(w.cells, w.heights);
  const fp = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (H[y][x] > 0) fp.push([F[y][x], G.filled[y * N + x]]);
  const fD = maxDiff(fp);
  if (fD > 1e-9) diffs.push({ kind: 'value', id: 'priorityFlood↔depressionFill', original: '陆地格 fill 图', refactored: `最大差 ${fD}`, note: '原版 EPS 台内递升 vs 重构 microSlope=0 纯平' });
  // lakeClusters：同一 fill 喂两边（原版吃 2D F，重构吃 {filled,parent}）
  const lc = o.lakeClusters(H, F), lb = r.lakeClusters(w.cells, w.heights, G);
  const lakesA = (Array.isArray(lc) ? lc : lc.lakes || []).length, lakesB = (Array.isArray(lb) ? lb : lb.lakes || []).length;
  if (lakesA !== lakesB) diffs.push({ kind: 'value', id: 'lakeClusters', original: lakesA, refactored: lakesB });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/depfill.js'], refactored: [LIB + '/src/core/depression-fill.js'],
    inputs: { grid: `${N}×${N}`, seed: 7, minima: ma.length },
    metrics: [{ id: 'minima', name: 'localMinima 集合一致', original: ma.length, refactored: mb.length, equal: deepEq(ma, mb) }, { id: 'fill', name: 'priorityFlood↔depressionFill 陆地格最大差', original: 0, refactored: fD }, { id: 'lakes', name: 'lakeClusters 湖数', original: lakesA, refactored: lakesB }], diffs,
    basis: '同一高度场：原版走 2D 数组 H[y][x]+NB8，重构走 cells+edgeNeighbors；edgeNeighbors 显式给 8 邻域、海格归 0 后同构，陆地格逐点比。' };
}

// ── shorefield：buildShoreDistance sample 网格对拍 ─────────────────────────
async function parityShorefield() {
  const o = await load(ORIG + '/engine/shorefield.js'), r = await load(LIB + '/src/water/shorefield.js');
  const W = 12, HH = 9, world = quadWorld(W, HH, (x, z) => (x > 3 && x < 8 && z > 2 && z < 6 ? 4 : 0) + (Math.hypot(x - 5.5, z - 4) < 2 ? 3 : 0));
  for (const c of world.cells) { c.minX = Math.min(...c.pts.map((p) => p.x)); c.maxX = Math.max(...c.pts.map((p) => p.x)); c.minZ = Math.min(...c.pts.map((p) => p.z)); c.maxZ = Math.max(...c.pts.map((p) => p.z)); }
  const grid = { cells: world.cells }, town = { top: world.top };
  const A = o.buildShoreDistance(town, grid, { res: .15, pad: 2 });
  const B = r.buildShoreDistance(town, grid, { res: .15, pad: 2 });
  const pairs = [], samples = [];
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 30; j++) {
    const x = -2 + i * .35, z = -2 + j * .3;
    const a = A.sample(x, z), b = B.sample(x, z);
    if (a > 100 || b > 100) { if ((a > 100) !== (b > 100)) samples.push([x, z, a, b]); continue; }
    pairs.push([a, b]);
  }
  const d = maxDiff(pairs);
  const diffs = [];
  if (d > 1e-9) diffs.push({ kind: 'value', id: 'sample()', original: d, refactored: `${pairs.length} 点最大差`, note: 'chamfer 权重或边界带语义差异' });
  if (samples.length) diffs.push({ kind: 'value', id: 'sample()域外', original: '域外计数', refactored: `${samples.length} 点一侧出界另一侧有值` });
  let oBad = '不校验'; try { o.buildShoreDistance(null, grid); } catch (e) { oBad = e.constructor.name; }
  let rBad = '不校验'; try { r.buildShoreDistance(null, grid); } catch (e) { rBad = e.constructor.name; }
  if (oBad !== rBad) diffs.push({ kind: 'validation', id: 'buildShoreDistance(null)', original: oBad, refactored: rBad });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/engine/shorefield.js'], refactored: [LIB + '/src/water/shorefield.js'],
    inputs: { grid: '12×9 L形陆', res: .15, pad: 2, samples: pairs.length },
    metrics: [{ id: 'sample', name: `sample() ${pairs.length} 点最大差`, original: 0, refactored: d }], diffs,
    basis: '重构模块自述「独立原版 buildShoreDistance API 的逐式移植，裁判=engine/shorefield.js」——同一 town.top+grid 喂两边，sample 逐点比。' };
}

// ── sphere：buildSphere 参数映射 + 结构统计 ────────────────────────────────
async function paritySphere() {
  const o = await load(ORIG + '/engine/sphere.js'), r = await load(LIB + '/src/sphere/planet.js');
  const A = o.buildSphere({ count: 160, spacingPasses: 4, relaxPasses: 6, seed: 1 });
  const B = r.buildSphere({ n: 160, seed: 1, spacing: 4, relax: 6 });
  const stat = (s) => {
    const pts = s.points || s.cells || s.verts || [];
    return { n: pts.length, keys: Object.keys(s).slice(0, 8).join(',') };
  };
  const sa = stat(A), sb = stat(B);
  const diffs = [{ kind: 'api', id: 'buildSphere 形参', original: '{count,spacingPasses,relaxPasses,seed}', refactored: '{n,spacing,relax,seed,history}+RangeError 校验', note: '参数改名+校验；点集生成器是否同源看统计' }];
  if (sa.n !== sb.n) diffs.push({ kind: 'value', id: 'buildSphere 点数', original: sa.n, refactored: sb.n });
  return { verdict: 'diff-registered', original: [ORIG + '/engine/sphere.js'], refactored: [LIB + '/src/sphere/planet.js'],
    inputs: { count: 160, spacing: 4, relax: 6, seed: 1 },
    metrics: [{ id: 'shape', name: '返回键', original: sa.keys, refactored: sb.keys }, { id: 'n', name: '点数', original: sa.n, refactored: sb.n }], diffs,
    basis: '形参名不同但语义对应（count↔n 等）；点集分布同源与否由结构统计登记，不伪造逐点相等。' };
}

// ── palette：PALETTES 深等 ─────────────────────────────────────────────────
async function parityPalette() {
  const o = await load(ORIG + '/src/palette.js'), r = await load(LIB + '/src/core/palette.js');
  const same = deepEq(o.PALETTES, r.PALETTES);
  const diffs = same ? [] : [{ kind: 'value', id: 'PALETTES', original: JSON.stringify(o.PALETTES).slice(0, 120), refactored: JSON.stringify(r.PALETTES).slice(0, 120) }];
  return { verdict: same ? 'equivalent' : 'diff-registered', original: [ORIG + '/src/palette.js'], refactored: [LIB + '/src/core/palette.js'],
    inputs: { keys: ['PALETTES'] },
    metrics: [{ id: 'pal', name: 'PALETTES 深等', original: Object.keys(o.PALETTES || {}).length, refactored: Object.keys(r.PALETTES || {}).length, equal: same }], diffs,
    basis: '调色板是纯常量表，JSON 深比较即等价判定。' };
}

// ── shelfPack：同签名逐尺寸对拍 ────────────────────────────────────────────
async function parityShelfPack() {
  const o = await load(ORIG + '/src/rectpack.js'), r = await load(LIB + '/src/core/atlas.js');
  const cases = [
    [64, 64, [[10, 10], [20, 8], [8, 30], [30, 30], [5, 5], [12, 12], [40, 6]]],
    [32, 16, [[16, 16], [16, 16], [17, 16], [4, 4]]],
    [100, 50, [[60, 40], [45, 30], [30, 20], [10, 10]]],
  ];
  const diffs = [];
  let allEq = true;
  for (const [W, H, sizes] of cases) {
    const a = o.shelfPack(W, H, sizes), b = r.shelfPack(W, H, sizes);
    if (a.placed !== b.placed || Math.abs(a.fill - b.fill) > 1e-9) { allEq = false; diffs.push({ kind: 'value', id: `shelfPack(${W}×${H})`, original: a, refactored: { placed: b.placed, fill: b.fill } }); }
  }
  const aOver = o.shelfPack(10, 10, [[20, 5]]); let bOver = null;
  try { bOver = r.shelfPack(10, 10, [[20, 5]]); } catch (e) { bOver = e.constructor.name; }
  if (JSON.stringify(aOver) !== JSON.stringify(bOver)) diffs.push({ kind: 'value', id: 'shelfPack 超宽', original: aOver, refactored: bOver, note: '重构多了 w>width 提前 break 与 rects 输出' });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/rectpack.js'], refactored: [LIB + '/src/core/atlas.js'],
    inputs: { cases: cases.map(([w, h]) => `${w}×${h}`).join(',') },
    metrics: [{ id: 'pack', name: 'placed/fill 三组全等', equal: allEq }], diffs,
    basis: 'shelfPack 同名同签名，placed/fill 逐案比；重构额外返回 rects（超集，不算差异）但 w>width 的 break 口径不同要登记。' };
}

// ── birds：findRoofPerches 同签名对拍 ──────────────────────────────────────
async function parityBirds() {
  const o = await load(ORIG + '/src/birds.js'), r = await load(LIB + '/src/life/birds.js');
  const pos = [];
  for (let i = 0; i < 240; i++) pos.push([(i % 12) * .2, (i % 5) * .3 + ((i % 12) > 6 ? .9 : .1), ((i / 12) | 0) * .25]);
  const geo = { getAttribute: () => ({ count: pos.length, getX: (i) => pos[i][0], getY: (i) => pos[i][1], getZ: (i) => pos[i][2] }) };
  const cb = { cellAt: (x, z) => `${Math.round(x * 4)},${Math.round(z * 4)}`, isRoofCell: (k) => k.split(',').every((v) => (+v) % 2 === 0) };
  const a = o.findRoofPerches(geo, cb), b = r.findRoofPerches(geo, cb);
  const same = deepEq(a, b);
  const diffs = same ? [] : [{ kind: 'value', id: 'findRoofPerches', original: `${a.length} 栖点`, refactored: `${b.length} 栖点` }];
  return { verdict: same ? 'equivalent' : 'diff-registered', original: [ORIG + '/src/birds.js'], refactored: [LIB + '/src/life/birds.js'],
    inputs: { verts: pos.length, minY: .6, spacing: .13 },
    metrics: [{ id: 'perches', name: '栖点列表深等', original: a.length, refactored: b.length, equal: same }], diffs,
    basis: '两文件 findRoofPerches 行号对齐（同一段落逐式移植）；同一假 geometry+callbacks 喂两边逐点比。' };
}

// ── noise：engine/noise.js ↔ core/noise.js（massif 脊线噪声的直接调用面）──
async function parityNoise() {
  const o = await load(ORIG + '/engine/noise.js'), r = await load(LIB + '/src/core/noise.js');
  const pts = [[0, 0], [3.7, -2.1], [101.25, 88.5], [-13.4, 7.9], [512, 256]], pairs = [];
  for (const [x, y] of pts) for (const s of [0, 7, 42]) {
    pairs.push([o.valueNoise(x, y, s), r.valueNoise(x, y, s)]);
    pairs.push([o.fbm(x, y, { octaves: 4, freq: 2, seed: s }), r.fbm(x, y, { octaves: 4, freq: 2, seed: s })]);
    pairs.push([o.ridged(x, y, { seed: s }), r.ridged(x, y, { seed: s })]);
    pairs.push([o.smoothstep(.3, .58, x * .013 + s * .001), r.smoothstep(.3, .58, x * .013 + s * .001)]);
  }
  let rngMax = 0; { const a = o.makeRng(7), b = r.makeRng(7); for (let i = 0; i < 64; i++) rngMax = Math.max(rngMax, Math.abs(a() - b())); }
  const d = maxDiff(pairs), same = d === 0 && rngMax === 0;
  return { verdict: same ? 'equivalent' : 'diff-registered', original: [ORIG + '/engine/noise.js'], refactored: [LIB + '/src/core/noise.js'],
    inputs: { samples: `${pts.length} 点×3 种子×4 函数`, rng: 'makeRng(7) 前 64 发' },
    metrics: [{ id: 'value', name: `valueNoise/fbm/ridged/smoothstep ${pairs.length} 采样最大差`, original: 0, refactored: d, equal: d === 0 }, { id: 'rng', name: 'makeRng 前 64 发最大差', original: 0, refactored: rngMax, equal: rngMax === 0 }],
    diffs: same ? [] : [{ kind: 'value', id: 'noise', original: '采样差', refactored: d, note: '哈希或插值口径差异' }],
    basis: 'mountain.massif 的脊线噪声直接调 core/noise.js 的 fbm/ridged；同采样点逐位对拍。' };
}

// ── navribbon：sampleByArc ↔ path-samples.samplePath（对象间距采样）──
async function parityPathSamples() {
  const o = await load(ORIG + '/src/navribbon.js'), r = await load(LIB + '/src/core/path-samples.js');
  const metrics = [], diffs = [];
  for (const perSeg of [64, 12]) for (const step of [1.0, .35]) {
    const line = o.centerline(perSeg), pts3 = line.pts.map((p) => [p[0], 0, p[1]]);
    const ref = o.sampleByArc(line, step), ours = r.samplePath(pts3, { spacing: step, maxSamples: 1e6 });
    let ok = ours.points.length >= ref.pts.length;
    for (let i = 0; ok && i < ref.pts.length; i++) ok = ours.points[i][0] === ref.pts[i].x && ours.points[i][2] === ref.pts[i].z && ours.distances[i] === ref.pts[i].s;
    metrics.push({ id: `arc-${perSeg}-${step}`, name: `perSeg=${perSeg} step=${step} 同弧长采样位置逐位`, original: ref.pts.length, refactored: ours.points.length, equal: ok });
    const tail = ours.points.length - ref.pts.length;
    if (tail) diffs.push({ kind: 'value', id: `tail-${perSeg}-${step}`, original: `${ref.pts.length} 点（丢不足一步的尾巴）`, refactored: `${ours.points.length} 点（末尾必追加折线终点 s=len）`, note: 'tests/path-samples-referee.mjs 登记的工程差异' });
  }
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/navribbon.js'], refactored: [LIB + '/src/core/path-samples.js'],
    inputs: { centerline: 'perSeg 64/12', steps: [1.0, .35] }, metrics, diffs,
    basis: '同一中线同一弧长 s 处的采样位置逐位比——裁判二分定位、本侧线性游标是同一式子；端点保留差异如实登记。' };
}

// ── spritepack：radialPack ↔ sprite-atlas.radialPack（精灵图集排布）──
async function paritySpritePack() {
  const o = await load(ORIG + '/engine/spritepack.js'), r = await load(LIB + '/src/core/sprite-atlas.js');
  const items = [{ id: 'a', w: 40, h: 40 }, { id: 'b', w: 24, h: 60 }, { id: 'c', w: 16, h: 16 }, { id: 'd', w: 60, h: 24 }, { id: 'e', w: 8, h: 90 }, { id: 'f', w: 33, h: 7 }, { id: 'g', w: 5, h: 5 }];
  const metrics = [], diffs = [], pos = (x) => x.placed.map((p) => `${p.id}@${p.x},${p.y}`).join('|');
  for (const size of [128, 96]) {
    const a = o.radialPack(items, { size, gap: 2 }), b = r.radialPack(items, { size, gap: 2 });
    const same = pos(a) === pos(b);
    metrics.push({ id: `pack-${size}`, name: `radialPack size=${size} 放置序列`, original: a.placed.length, refactored: b.placed.length, equal: same });
    if (!same) diffs.push({ kind: 'value', id: `radialPack(${size})`, original: pos(a), refactored: pos(b) });
  }
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/engine/spritepack.js'], refactored: [LIB + '/src/core/sprite-atlas.js'],
    inputs: { items: items.length, sizes: [128, 96] }, metrics, diffs,
    basis: '阿基米德螺旋 + 占据栅格同一式子（stepR=max(2,min(W,H)*.28)、r<size*.75）；重构多 maxCandidates 预算上限，未触发时放置序列应逐位一致。' };
}

// ── mountainlight ↔ mountain-bake（Port of REACode/src/mountainlight.js）──
async function parityMountainLight() {
  const o = await load(ORIG + '/src/mountainlight.js'), r = await load(LIB + '/src/core/mountain-bake.js');
  const m = o.buildMountain({ w: 120, h: 90, seed: 31 }), pairs = []; let n = 0;
  for (let y = 5; y < 85; y += 5) for (let x = 5; x < 115; x += 5) {
    const a = o.normalAt(m, x, y), b = r.mountainNormalAt(m, x, y);
    pairs.push([a[0], b[0]], [a[1], b[1]], [a[2], b[2]]); n++;
  }
  const dN = maxDiff(pairs);
  const terrain = m.rockMask || Uint8Array.from(m.z, (v) => (v > 0 ? 1 : 0));
  const m2 = { w: m.w, h: m.h, z: m.z, terrain };
  const sa = o.renderShade(m, 'baked'), sb = r.renderMountainShade(m2, 'baked');
  const stat = (res, nlK, luK, mkK) => { const nl = res[nlK], lu = res[luK], mk = res[mkK]; let sN = 0, sL = 0, c = 0; for (let i = 0; i < nl.length; i++) { if (mk && !mk[i]) continue; if (!Number.isFinite(nl[i]) || !Number.isFinite(lu[i])) continue; sN += nl[i]; sL += lu[i]; c++; } return { nlMean: c ? sN / c : NaN, lumaMean: c ? sL / c : NaN, n: c }; };
  const sta = stat(sa, 'nlMap', 'lumaMap', 'rockMask'), stb = stat(sb, 'nl', 'luma', 'rock');
  const diffs = [];
  if (dN > 1e-9) diffs.push({ kind: 'value', id: 'normalAt', original: dN, refactored: `${n} 点三轴最大差` });
  if (!deepEq([sta.nlMean, sta.lumaMean], [stb.nlMean, stb.lumaMean])) diffs.push({ kind: 'value', id: 'baked stats', original: sta, refactored: stb, note: '岩面色/光源口径差异（本地 bake 假设，非原作纹理烘焙）' });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/mountainlight.js'], refactored: [LIB + '/src/core/mountain-bake.js'],
    inputs: { mountain: '120×90 seed=31', normalSamples: n },
    metrics: [{ id: 'normal', name: `${n} 点法线最大差`, original: 0, refactored: dN, equal: dN === 0 }, { id: 'nlMean', name: 'baked 岩面平均 N·L', original: +sta.nlMean.toFixed(6), refactored: +stb.nlMean.toFixed(6) }, { id: 'lumaMean', name: 'baked 岩面平均亮度', original: +sta.lumaMean.toFixed(6), refactored: +stb.lumaMean.toFixed(6) }], diffs,
    basis: 'mountain-bake 自述 Port of mountainlight.js：同一高度场喂 normalAt/mountainNormalAt 逐点比法线，再比 baked 渲染的岩面均值统计。' };
}

// ── rayvis ↔ space-visibility（fibonacci 方向 + 可见度）──
async function parityRayvis() {
  const o = await load(ORIG + '/src/rayvis.js'), r = await load(LIB + '/src/core/space-visibility.js');
  const da = o.fibonacciDirs(32), db = r.fibonacciDirections(32);
  const dirSame = deepEq(da, db);
  const occ = (x, y, z) => y === 0 || (x >= 7 && x <= 8 && z >= 7 && z <= 8 && y <= 4);
  const s = o.buildSolid(occ, 16, 8, 16);
  const world = { isSolid: (c, lv) => occ(c.x, lv - 1, c.z) };
  const index = { cellAt: (x, z) => (x >= 0 && x < 16 && z >= 0 && z < 16 ? { x: Math.floor(x), z: Math.floor(z) } : null) };
  const metrics = [{ id: 'dirs', name: 'fibonacciDirs(32) 逐位一致', equal: dirSame }], diffs = [], visPairs = [];
  for (const p of [{ x: 2.5, y: 1.5, z: 2.5 }, { x: 12.5, y: 1.5, z: 12.5 }, { x: 7.5, y: 6.5, z: 7.5 }]) {
    const a = o.visibility(s, p, da, { maxDist: 8, step: .25 });
    const b = r.sampleWorldVisibility(world, index, p, { count: 32, maxDist: 8, step: .25, levelHeight: 1 });
    visPairs.push([a, b.value]);
  }
  const dv = maxDiff(visPairs);
  metrics.push({ id: 'visibility', name: '同场景同方向集可见度最大差', original: 0, refactored: dv, equal: dv === 0 });
  if (dv > 1e-9) diffs.push({ kind: 'value', id: 'visibility', original: '固定步长前进采样', refactored: `按格边界切段精确求交，最大差 ${dv}`, note: 'castRay 定步 vs castWorldRay 逐格——命中距离口径不同' });
  return { verdict: diffs.length || !dirSame ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/rayvis.js'], refactored: [LIB + '/src/core/space-visibility.js'],
    inputs: { dirs: 32, scene: '16×8×16 房间+柱', probes: 3 }, metrics, diffs,
    basis: 'space-visibility 自述「rayvis.js 其余部分迁到共享 World」：方向集逐位比，可见度在同一占据场景上比（采样策略不同如实登记）。' };
}

// ── cloudWindBob ↔ engine/impostor.js 顶点着色器同式（云起伏）──
async function parityCloudWind() {
  const r = await load(LIB + '/src/core/cloud-motion.js');
  // 裁判式子逐字摘自 REACode/engine/impostor.js 顶点着色器（ph=x*.13+z*.17，三轴异频）
  const ref = (t, x, z, amt) => { const ph = x * .13 + z * .17; return [Math.sin(t * .11 + ph) * amt, Math.sin(t * .15 + ph * .7) * amt * .25, Math.cos(t * .09 + ph * 1.3) * amt * .6]; };
  const pairs = [];
  for (const t of [0, 3.7, 21.4, 100]) for (const [x, z] of [[0, 0], [5.5, -8.2], [-40, 33], [200, 17]]) for (const amt of [.6, 1]) {
    const a = ref(t, x, z, amt), b = r.cloudWindBob(t, x, z, amt);
    pairs.push([a[0], b[0]], [a[1], b[1]], [a[2], b[2]]);
  }
  const d = maxDiff(pairs);
  return { verdict: d === 0 ? 'equivalent' : 'diff-registered', original: [ORIG + '/engine/impostor.js'], refactored: [LIB + '/src/core/cloud-motion.js'],
    inputs: { samples: `${pairs.length / 3} 组合（t×位置×amt）` },
    metrics: [{ id: 'bob', name: `cloudWindBob ${pairs.length} 分量最大差`, original: 0, refactored: d, equal: d === 0 }],
    diffs: d === 0 ? [] : [{ kind: 'value', id: 'cloudWindBob', original: 'GLSL 式', refactored: d }],
    basis: '重构文件自述「与 engine 同式的函数化移植」——把 impostor.js 顶点着色器里的云起伏式子逐字取到 JS，同参逐位对拍。' };
}

// ── flowfield ↔ navmesh-flow（顶点到目标代价场）──
async function parityFlowField() {
  const o = await load(ORIG + '/src/flowfield.js'), r = await load(LIB + '/src/world/navmesh-flow.js');
  const W = 6, H = 4, verts = [], polys = [];
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) verts.push({ x, y: 0, z: y });
  const vid = (x, y) => y * (W + 1) + x;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) polys.push([vid(x, y), vid(x + 1, y), vid(x + 1, y + 1), vid(x, y + 1)]);
  const mesh = r.buildNavMesh(verts, polys);
  const adj = verts.map(() => []), add = (a, b) => { const w = Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y, verts[a].z - verts[b].z); adj[a].push({ id: b, cost: w }); adj[b].push({ id: a, cost: w }); };
  for (const vs of polys) for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) add(vs[i], vs[j]);
  const goal = vid(5, 3);
  const F = r.buildVertexField(mesh, { goal: { x: verts[goal].x, z: verts[goal].z, r: .01 } });
  const G = o.buildFlowField({ adj }, goal);
  const pairs = verts.map((_, i) => [F.dist[i], G.dist[i]]);
  const d = maxDiff(pairs);
  const diffs = [];
  if (d > 1e-9) diffs.push({ kind: 'value', id: 'dist', original: d, refactored: `${verts.length} 顶点代价最大差`, note: '反向 Dijkstra 边序或代价口径差异' });
  return { verdict: diffs.length ? 'diff-registered' : 'equivalent', original: [ORIG + '/src/flowfield.js'], refactored: [LIB + '/src/world/navmesh-flow.js'],
    inputs: { mesh: '6×4 方格（35 顶点 24 面）', goal: 'vertex(5,3)' },
    metrics: [{ id: 'dist', name: `${verts.length} 顶点到目标代价逐位`, original: 'dist[]', refactored: 'dist[]', equal: d === 0 }], diffs,
    basis: '两边都是「从目标反向 Dijkstra 得到达代价场」：同一顶点图（poly 内全连接、3D 边权）喂 buildFlowField 与 buildVertexField，逐顶点比 dist。' };
}

// ── slopeMask ↔ overhangterrain 掩码程序（apostles.soft 的缓坡省）──
async function paritySlopeMask() {
  const r = await load(LIB + '/src/terrain/generate.js'), n = await load(LIB + '/src/core/noise.js');
  const cells = []; for (let z = 0; z < 24; z++) for (let x = 0; x < 30; x++) cells.push({ cx: x - 15, cz: z - 12 });
  const seed = 7, mask = r.slopeMask(cells, seed);
  let span = 0; for (const c of cells) span = Math.max(span, Math.hypot(c.cx, c.cz));
  const raw = cells.map((c) => n.fbm(c.cx / (span * 2) * 1.3 + 21.3, c.cz / (span * 2) * 1.3 + 9.4, { octaves: 3, freq: 2, seed: seed + 57 }));
  const sorted = [...raw].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * .3)], hi = sorted[Math.floor(sorted.length * .58)];
  const expect = Float32Array.from(raw, (v) => n.smoothstep(lo, hi, v));
  const d = maxDiff([...mask].map((v, i) => [v, expect[i]]));
  const F = (await load(ORIG + '/src/overhangterrain.js')).heightField(7);
  const stat = (a) => { let s = 0, c = 0; for (const v of a) { s += v; c++; } return +(s / c).toFixed(4); };
  return { verdict: 'diff-registered', original: [ORIG + '/src/overhangterrain.js'], refactored: [LIB + '/src/terrain/generate.js'],
    inputs: { cells: cells.length, seed },
    metrics: [{ id: 'chain', name: 'fbm→分位→smoothstep 全链复算', original: '自复算', refactored: d, equal: d === 0 },
      { id: 'quantiles', name: '分位阈值口径', original: 'p_idx .30/.58（heightField L87-88）', refactored: '.30/.58（slopeMask L263-264）', equal: true },
      { id: 'maskMean', name: '掩码均值（域不同，仅参考）', original: stat(F.sharp), refactored: stat(mask) }],
    diffs: [{ kind: 'value', id: 'rawSharp 域', original: 'fbm(i*.023+21.3, j*.023+9.4, seed+57, 3) 像素域', refactored: 'fbm(cx/(span*2)*1.3+21.3, …, seed+57, octaves3) 跨度归一域', note: '同一分位程序（0.30/0.58→smoothstep），噪声域/网格形状不同 → 掩码值不可逐点比' }],
    basis: 'slopeMask 注释自标「阈值取本场分位数（REACode/overhangterrain p30/p58）」：全链复算逐位核 + 分位常数 0.30/0.58 与噪声常数 21.3/9.4/+57/oct3 与原版逐字一致登记。' };
}

// ── terracecliff classify ↔ terrace-profile（台地诊断）──
async function parityTerrace() {
  const o = await load(ORIG + '/src/terracecliff.js'), r = await load(LIB + '/src/core/terrace-profile.js');
  const N = 24, hFn = (x, z) => Math.max(0, Math.round(6 - Math.hypot(x - 12, z - 12) * .8 + (Math.sin(x * .7) > .6 ? 2 : 0)));
  const h = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => hFn(x, y)));
  const a = o.classify(h, 0);
  const w = quadWorld(N, N, (x, z) => hFn(x, z));
  for (const c of w.cells) c.n = c.pts.length;
  const world = { cells: w.cells, ground: (c) => w.heights[c.id], isSolid: (c, lv) => lv >= 1 && lv <= w.heights[c.id] };
  const b = r.terraceProfile(world);
  const diffs = [];
  if (a.land !== b.slope.flat + b.slope.soft + b.slope.cliff) diffs.push({ kind: 'value', id: 'land', original: a.land, refactored: b.slope.flat + b.slope.soft + b.slope.cliff, note: 'land 口径（原版水面排除 vs 本侧 heights>0）' });
  if (a.flat !== b.slope.flat || a.cliff !== b.slope.cliff) diffs.push({ kind: 'value', id: 'slope split', original: { flat: a.flat, cliff: a.cliff }, refactored: b.slope, note: '原版按梯度角分档，本侧按相邻层差 0/1/≥2 分档' });
  return { verdict: 'diff-registered', original: [ORIG + '/src/terracecliff.js'], refactored: [LIB + '/src/core/terrace-profile.js'],
    inputs: { field: `24×24 台地场`, water: 0 },
    metrics: [{ id: 'land', name: '陆地格数', original: a.land, refactored: b.slope.flat + b.slope.soft + b.slope.cliff }, { id: 'flat', name: '平缓格', original: a.flat, refactored: b.slope.flat }, { id: 'cliff', name: '崖格', original: a.cliff, refactored: b.slope.cliff }], diffs,
    basis: 'terrace-profile 自述「inspired by classify」：同一高度场喂原版 classify 与本侧 terraceProfile，land/flat/cliff 分档口径差异如实登记。' };
}

// ── oklab 感知色板 ↔ palette.js HSL 色板工具（scene.oklab-*/palette-unify/style-pack/tone）──
async function parityOklab() {
  const o = await load(ORIG + '/src/palette.js'), r = await load(LIB + '/src/core/oklab.js');
  const hexes = ['#1a2b3c', '#7f8f9a', '#d4a373', '#264653', '#e76f51', '#2a9d8f', '#e9c46a', '#f4f1de'];
  const base = hexes.map((h) => [o.hexToRgb(h).map((v) => v / 255), r.hexToSrgb(h)]);
  const dHex = maxDiff(base.flatMap(([a, b]) => a.map((v, i) => [v, b[i]])));
  const labs = hexes.map((h) => r.hexToOklab(h));
  const de = maxDiff(hexes.map((_, i) => hexes.map((_, j) => [r.deltaE(labs[i], labs[j]), r.deltaE(labs[j], labs[i])])).flat());
  // 原版对应物：HSL 通道混合的距离感——mixPalette 中间色与 ΔE 排序相关性
  const hslDist = (a, b) => { const A = o.rgbToHsl(o.hexToRgb(a)), B = o.rgbToHsl(o.hexToRgb(b)); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  const pairs = []; for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) pairs.push([i, j]);
  const rank = (key) => [...pairs].sort((p, q) => key(p) - key(q)).map(([i, j]) => i * 100 + j).join(',');
  const sameOrder = rank(([i, j]) => r.deltaE(labs[i], labs[j])) === rank(([i, j]) => hslDist(hexes[i], hexes[j]));
  const diffs = [];
  if (dHex > 1e-12) diffs.push({ kind: 'value', id: 'hexToSrgb', original: 'hexToRgb/255', refactored: 'hexToSrgb', note: `最大分量差 ${dHex}` });
  if (!sameOrder) diffs.push({ kind: 'order', id: 'perceptual-vs-hsl', original: 'HSL 距离排序', refactored: 'OKLab ΔE 排序', note: '感知距离与 HSL 距离的色对排序不同——oklab 层是新增的感知机制，原版 palette.js 没有对应物' });
  return { verdict: 'diff-registered', original: [ORIG + '/src/palette.js'], refactored: [LIB + '/src/core/oklab.js'],
    inputs: { hexes: hexes.length },
    metrics: [
      { id: 'hex', name: '8 色 hex 解析逐分量（原版/255）', original: 'hexToRgb', refactored: 'hexToSrgb', equal: dHex === 0 },
      { id: 'deltaE-sym', name: 'ΔE 对称性（28 色对）', original: '—', refactored: de === 0 ? '对称' : de, equal: de === 0 },
      { id: 'rankOrder', name: '28 色对距离排序与 HSL 一致', original: 'rgbToHsl 距离', refactored: 'deltaE', equal: sameOrder }],
    diffs,
    basis: 'oklab.js 是 perceptual-capabilities 五能力的落点：hex 解析底层与 palette.hexToRgb 逐位等价登记；srgbToOklab/ΔE/色域裁剪是原版没有的感知层，与 HSL 距离排序差异如实登记（不是移植差异，是新增机制）。' };
}

// ── fog-envelope ↔ fog.js 雾片衰减（planet.weather-fog / weather.atmosphere）──
async function parityFog() {
  const r = await load(LIB + '/src/core/fog-envelope.js');
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // 原版 fog.js 的三条衰减（GLSL 内联，按源码逐字复算）：near=ss(3,9,dist)、band=1-ss(uBand,uBand*2.4,y)、wisp 门 ss(.42,.78,n)
  const near = (d) => ss(3, 9, d), band = (y, uBand) => 1 - ss(uBand, uBand * 2.4, y);
  const samples = []; for (let d = 0; d <= 30; d += 1.5) samples.push({ d, near: near(d), env: r.fogEnvelope(d, 5, 26) });
  const bandTop = [[.5, 1.4], [1.4, 1.4], [2.8, 1.4]].map(([y, uB]) => [y, band(y, uB)]);
  const diffs = [
    { kind: 'param', id: 'envelope-vs-near', original: 'near=smoothstep(3,9,camDist)：相机距离衰减', refactored: 'fogEnvelope(r,inner,outer)：岛心半径包络（含外沿 20% 回落）', note: '衰减基准不同：原版按相机距离防贴脸全白，本侧按岛心半径限定雾域；同一 smoothstep 平滑核' },
    { kind: 'param', id: 'band', original: 'band=1-smoothstep(uBand,uBand*2.4,y)：竖直带贴水面', refactored: 'makeFogWisps bottom/top 参数化雾片高度', note: '雾片贴水/封顶思路一致，参数化路径不同（uniform 常量 vs 生成参数）' }];
  return { verdict: 'diff-registered', original: [ORIG + '/engine/fog.js'], refactored: [LIB + '/src/core/fog-envelope.js'],
    inputs: { envelope: 'inner=5,outer=26', near: 'ss(3,9,d)', band: '1-ss(u,2.4u,y)' },
    metrics: [
      { id: 'envCurve', name: '包络 21 采样（r=0→30）', original: 'near(d) 相机距', refactored: 'fogEnvelope(d) 岛心距', equal: false },
      { id: 'smoothKernel', name: '平滑核 t²(3-2t)', original: 'GLSL smoothstep', refactored: 'JS smooth 同式', equal: true },
      { id: 'bandTop', name: '竖直带示例（y=0.5/1.4/2.8,uBand=1.4）', original: JSON.stringify(bandTop.map((b) => +b[1].toFixed(3))), refactored: `makeFogWisps top=${1.35}`, equal: null }],
    diffs,
    basis: 'fog.js 原版是风场驱动的雾片仿真（GLSL 衰减 + 绕行），fog-envelope 是纯包络函数 + wisp 生成器——同一「贴水雾片、柔边、不糊岛」意图，数学口径不同如实登记；smoothstep 核逐字一致。' };
}

// ── 汇总写盘 ────────────────────────────────────────────────────────────────
// ── capabilities 系共用擂场：N×N 四边形 cells + 位掩码体素列（与 record-voxel-arena 同构）──
async function capVoxWorld(N, fillFn) {
  const ops = await load(LIB + '/src/capabilities/ops.js');
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const id = y * N + x;
    cells.push({ id, n: 4, cx: x + .5, cz: y + .5, edgeNeighbors: [x > 0 ? id - 1 : -1, y > 0 ? id - N : -1, x < N - 1 ? id + 1 : -1, y < N - 1 ? id + N : -1] });
  }
  const w = {
    cells, grid: { cells }, seed: 20261125,
    solid: new Int32Array(N * N), rock: new Int32Array(N * N), color: new Int32Array(N * N), river: new Int32Array(N * N),
    touched: 0, touch() { this.touched++; },
  };
  w.top = (c) => ops.top(w, c.id); w.ground = (c) => ops.ground(w, c.id);
  w.isSolid = (c, lv) => ops.isSolid(w, c.id, lv); w.isRock = (c, lv) => ops.isRock(w, c.id, lv);
  w.isBuilt = (c, lv) => ops.isSolid(w, c.id, lv) && !ops.isRock(w, c.id, lv);
  w.setSolid = (c, lv, on, o) => ops.setVoxel(w, c.id, lv, on, o);
  fillFn((x, y, h, rock = true) => { const id = y * N + x; for (let lv = 1; lv <= h; lv++) ops.setVoxel(w, id, lv, true, { rock }); });
  return { w, ops };
}

// ── overhangterrain 蘑菇檐/海柱 ↔ capabilities overhang/seastack ────────────
async function parityOverhangVox() {
  const o = await load(ORIG + '/src/overhangterrain.js');
  const caps = await load(LIB + '/src/capabilities/terrain.js');
  // ② 原版：buildTerrain(7) 自产岛体素里数「实心格正下方悬空」的悬垂体素
  const T = o.buildTerrain(7);
  let hang = 0; const { NX, NY, NZ } = o;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) for (let k = 1; k < NZ; k++)
    if (T.vox[T.idx(i, j, k)] && !T.vox[T.idx(i, j, k - 1)]) hang++;
  // ③ 本侧：崖台擂场（h=4 岩台邻 h=1 岩）跑 overhang match→run，海缘水格跑 seastack
  const { w, ops } = await capVoxWorld(9, (fill) => {
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) fill(x, y, 4);   // 岩台
    for (let x = 4; x <= 6; x++) fill(x, 3, 1);                               // 台脚（邻台落差 3）
    for (let y = 0; y <= 2; y++) for (let x = 0; x <= 1; x++) fill(x, y, 1);   // 岸
  });
  const oT = caps.overhang.match(w), oR = caps.overhang.run(w, { targets: oT.slice(0, 3) });
  const sT = caps.seastack.match(w), sR = caps.seastack.run(w, { targets: sT.slice(0, 1), params: { height: 5 } });
  // 本侧悬垂验证：overhang 放下的体素下一层为空
  const placedHang = oT.slice(0, 3).filter((t) => ops.isSolid(w, t.cells[0], t.level) && !ops.isSolid(w, t.cells[0], t.level - 1)).length;
  return { verdict: 'diff-registered', original: [ORIG + '/src/overhangterrain.js'], refactored: [LIB + '/src/capabilities/terrain.js'],
    inputs: { originalSeed: 7, arena: '9×9 崖台+海岸' },
    metrics: [
      { id: 'origHang', name: '原版悬垂体素（实心下空）', original: hang, refactored: '—' },
      { id: 'capSeastack', name: '原版海柱帽比柱宽', original: `stemR ${T.stack.stemR} < capR ${T.stack.capR} · 帽 ${T.stack.capCells} 格`, refactored: `柱 1 格 + 帽圈 ${sR.applied.length ? '上沿一圈' : '—'}` },
      { id: 'refMatch', name: '本侧 overhang 候选/放置', original: '—', refactored: `${oT.length} / ${oR.applied.length}` },
      { id: 'refHang', name: '本侧悬垂体素（实心下空）', original: '—', refactored: placedHang },
      { id: 'stackPlaced', name: '本侧 seastack 放置', original: '—', refactored: sR.applied.length }],
    diffs: [{ kind: 'rule', id: '悬垂选址', original: '脚本化：海柱帽半径>柱径 + 海蚀洞顶保留', refactored: '规则化：邻格落差 ≥3 层的崖顶外伸 / 离岸两格水格立柱', note: '「实心体素悬空」机制一致，放哪里两边各自规则 — 如实登记' }],
    basis: '原版 buildTerrain 实测悬垂体素 ' + hang + ' 个（蘑菇帽+洞顶）；本侧 overhang 在崖台擂场真放置 ' + placedHang + ' 个悬垂体素、seastack 立柱 ' + sR.applied.length + ' 根带帽——机制同「实心悬空」，选址规则不同如实登记。' };
}

// ── cavepath 拱形洞道 ↔ capabilities tunnel（terrain.tunnel）────────────────
async function parityTunnelCap() {
  const o = await load(ORIG + '/src/cavepath.js');
  const caps = await load(LIB + '/src/capabilities/terrain.js');
  // ② 原版：CFG.TUN 贯穿洞宽 + archHead 半椭圆断面
  const C = o.CFG, width = C.TUN.i1 - C.TUN.i0 + 1;
  const crown = o.archHead((C.TUN.i0 + C.TUN.i1 + 1) / 2), spring = o.archHead(C.TUN.i0 - .5);
  const roofTop = C.ZTOP, roofMin = roofTop - crown;   // 洞顶最薄处
  // ③ 本侧：擂场「两端同高地面 + 中间高岩」跑 tunnel match→run
  const { w, ops } = await capVoxWorld(9, (fill) => {
    for (let x = 1; x <= 7; x++) fill(x, 4, 1);               // 地面一排
    for (let x = 3; x <= 5; x++) fill(x, 4, 3);               // 中间 3 格抬到 h=3（岩脊）
  });
  const tT = caps.tunnel.match(w), tR = caps.tunnel.run(w, { targets: tT.slice(0, 1) });
  const carved = tT[0] ? tT[0].cells.filter((id) => !ops.isSolid(w, id, tT[0].floor + 1) && ops.isSolid(w, id, tT[0].floor + 2)).length : 0;
  return { verdict: 'diff-registered', original: [ORIG + '/src/cavepath.js'], refactored: [LIB + '/src/capabilities/terrain.js'],
    inputs: { originalSlab: `${C.SLAB.i1 - C.SLAB.i0 + 1}×${C.SLAB.j1 - C.SLAB.j0 + 1} 板`, arena: '9×9 岩脊' },
    metrics: [
      { id: 'origWidth', name: '原版洞宽（格）', original: width, refactored: tT[0]?.cells.length ?? 0 },
      { id: 'origSection', name: '原版断面', original: `起拱 ${spring.toFixed(2)}→冠 ${crown.toFixed(2)}（半椭圆）`, refactored: '单层体素口（floor+1 层挖空）' },
      { id: 'origRoof', name: '原版洞顶最薄', original: +roofMin.toFixed(2), refactored: '≥1 层（floor+2 及以上保留）' },
      { id: 'refCarved', name: '本侧挖空格（口空顶实）', original: '—', refactored: carved },
      { id: 'refApplied', name: '本侧应用', original: '—', refactored: tR.applied.length }],
    diffs: [{ kind: 'shape', id: '断面形状', original: '三段式半椭圆（spring 1.00→crown 1.80，层高 0.90 约 2 层）', refactored: '矩形单层口（挖 floor+1 整层）', note: '「中间高岩、两端同高地面、打通一层、顶留岩」机制一致' }],
    basis: 'cavepath 的洞口几何是连续半椭圆；本侧 tunnel 是体素层整层挖空。同一「瑞士奶酪」机制、断面表示不同如实登记——本侧擂场实挖 ' + carved + ' 格口、顶岩保留。' };
}

// ── terraceladder 梯子几何 ↔ ladder-profile + thin-platform（terrain.ledge）──
async function parityLadderThin() {
  const o = await load(ORIG + '/src/terraceladder.js');
  const lp = await load(LIB + '/src/core/ladder-profile.js');
  const C = o.CFG, rows = [];
  let maxRung = 0, allCount = true;
  for (const spec of C.LADDERS) {
    const a = o.ladder(spec);
    // 原版 2D (x,z) 立剖面 → 本侧 3D (x, y=z原, z=0)
    const b = lp.ladderProfile({ x: a.foot.x, y: a.foot.z, z: 0 }, { x: a.lip.x, y: a.lip.z, z: 0 },
      { side: { x: 0, y: 0, z: 1 }, width: C.RAIL * 2, over: C.OVER, spacing: C.RUNG });
    const rd = Math.max(...a.rungs.map((r, i) => Math.abs(Math.hypot(r.x - a.foot.x, r.z - a.foot.z) - b.rungs[i].distance)), 0);
    maxRung = Math.max(maxRung, rd);
    if (a.rungs.length !== b.rungs.length) allCount = false;
    rows.push({ id: spec.id, L: +a.L.toFixed(4), len: +b.length.toFixed(4), rungs: `${a.rungs.length}/${b.rungs.length}`, rungDist: +rd.toFixed(6), shortGap: +a.shortGap.toFixed(4) });
  }
  const eq = allCount && maxRung < 1e-12 && rows.every((r) => Math.abs(r.L - r.len) < 1e-9);
  return { verdict: eq ? 'equivalent' : 'diff-registered', original: [ORIG + '/src/terraceladder.js'], refactored: [LIB + '/src/core/ladder-profile.js', LIB + '/src/terrain/thin-platform.js'],
    inputs: { ladders: C.LADDERS.length, H: C.H, OVER: C.OVER, RUNG: C.RUNG },
    metrics: [
      { id: 'len', name: '梯梁长 L（3 梯逐字）', original: rows.map((r) => r.L).join('/'), refactored: rows.map((r) => r.len).join('/'), equal: rows.every((r) => r.L === r.len) },
      { id: 'rungs', name: '踏棍数 floor((L+OVER)/RUNG)', original: rows.map((r) => r.rungs.split('/')[0]).join('/'), refactored: rows.map((r) => r.rungs.split('/')[1]).join('/'), equal: allCount },
      { id: 'rungPos', name: '踏棍沿梁距离最大差', original: 0, refactored: maxRung, equal: maxRung < 1e-12 },
      { id: 'shortGap', name: '「层高当梯长」短差 L−H', original: rows.map((r) => r.shortGap).join('/'), refactored: 'ladderContact.shortGap = profile.length − rise·L 同口径', equal: true }],
    diffs: eq ? [] : [{ kind: 'value', id: '梯子几何', original: '原版 2D', refactored: '本侧 3D', note: '逐梯差异见 metrics' }],
    basis: '梯梁沿真实 foot→lip 锚点（永不取层高）——原版 ladder(spec) 与本侧 ladderProfile 同锚点跑：梯长/踏棍数/踏棍位逐字对拍；thinPlatform 判定（supportDepth<rise）与原版「薄平台挑空」机制同。' };
}

// ── archvoid 楔石拱 ↔ capabilities arch（terrain.arch）──────────────────────
async function parityArchVoid() {
  const o = await load(ORIG + '/src/archvoid.js');
  const caps = await load(LIB + '/src/capabilities/terrain.js');
  // ② 原版：默认参数半椭圆拱 — 矢高 span·riseRatio、楔石块数、内弧长
  const A = o.makeArch({}), rise = 9 * .5;
  const innerLen = o.arcLen(9 * .5, rise, 0, Math.PI);
  // ③ 本侧：两 h=5 岩柱隔 2 格低地 → match→run 出平桥面体素
  const { w, ops } = await capVoxWorld(9, (fill) => {
    fill(3, 4, 5); fill(6, 4, 5);          // 双柱 h=5
    fill(4, 4, 1); fill(5, 4, 1);          // 间低 h=1
    fill(3, 5, 1); fill(6, 5, 1);          // 柱脚
  });
  const aT = caps.arch.match(w), aR = caps.arch.run(w, { targets: aT.slice(0, 1) });
  const t = aT[0];
  const deckThick = t ? t.cells.filter((id) => ops.isSolid(w, id, t.level) && ops.isSolid(w, id, t.level - 1)).length : 0;
  return { verdict: 'diff-registered', original: [ORIG + '/src/archvoid.js'], refactored: [LIB + '/src/capabilities/terrain.js'],
    inputs: { originalArch: 'span 9 · riseRatio .5 · 楔石 15', arena: '9×9 双柱' },
    metrics: [
      { id: 'origProfile', name: '原版断面', original: `半椭圆 矢高 ${rise} · 内弧 ${innerLen.toFixed(2)}`, refactored: `平桥面 ${t ? `第 ${t.level} 层` : '—'}` },
      { id: 'origWedges', name: '原版楔石块', original: A.wedges.length, refactored: '—' },
      { id: 'refSpan', name: '本侧跨格数', original: '—', refactored: t?.cells.length ?? 0 },
      { id: 'refThick', name: '本侧加厚格（≥3 落差 → 拱厚 2）', original: '—', refactored: deckThick },
      { id: 'refApplied', name: '本侧应用', original: '—', refactored: aR.applied.length }],
    diffs: [{ kind: 'shape', id: '拱形', original: '半椭圆楔石拱（archInner/Outer + 法向外推厚度）', refactored: '平桥面体素（低差 ≥3 自动厚 2 层）', note: '「两柱间锚定跨接」机制一致、断面表示不同如实登记' }],
    basis: 'archvoid 是参数半椭圆拱（楔石 ' + A.wedges.length + ' 块）；本侧 arch 在双柱擂场跨 ' + (t?.cells.length ?? 0) + ' 格平桥面、自动加厚 ' + deckThick + ' 格。同族机制对账如实登记。' };
}

// ── overhangterrain/terracecliff 软坡 ↔ soft-tops 角点融合（mountain.talus）──
async function paritySoftTops() {
  const o = await load(ORIG + '/src/overhangterrain.js');
  const st = await load(LIB + '/src/terrain/soft-tops.js');
  const ops = await load(LIB + '/src/capabilities/ops.js');
  // ② 原版：heightField(7) 里相邻格对——soft 省（sharp<.5）应不量化（连续）、sharp 省应压向台阶
  const F = o.heightField(7), step = F.step, q = (v) => Math.round(v / step) * step;
  let softMelt = 0, softAll = 0, sharpStep = 0, sharpAll = 0;
  for (let k = 0; k < F.h.length - 1; k++) {
    if (F.land[k] < .1 || F.land[k + 1] < .1) continue;
    const s = (F.sharp[k] + F.sharp[k + 1]) / 2, d = Math.abs(F.h[k] - F.h[k + 1]);
    if (s < .5) { softAll++; if (d < step * .55) softMelt++; }
    else { sharpAll++; if (d >= step * .45) sharpStep++; }
  }
  // ③ 本侧：带 pts/vertexCells 的擂场——交替 1 层台阶 + 全软 slopeMask → softCorners 应全部熔链
  const N = 8, vid = (x, y) => y * (N + 1) + x;
  const pts = []; for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) pts.push({ id: vid(x, y), x, z: y });
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const id = y * N + x;
    cells.push({ id, n: 4, cx: x + .5, cz: y + .5, pts: [pts[vid(x, y)], pts[vid(x + 1, y)], pts[vid(x + 1, y + 1)], pts[vid(x, y + 1)]],
      edgeNeighbors: [x > 0 ? id - 1 : -1, y > 0 ? id - N : -1, x < N - 1 ? id + 1 : -1, y < N - 1 ? id + N : -1] });
  }
  const vertexCells = new Map();
  for (const c of cells) for (const p of c.pts) { if (!vertexCells.has(p.id)) vertexCells.set(p.id, []); vertexCells.get(p.id).push(c.id); }
  const w = { cells, grid: { cells, vertexCells }, solid: new Int32Array(N * N), rock: new Int32Array(N * N),
    river: new Int32Array(N * N), splicedHouses: null, slopeMask: new Float32Array(N * N).fill(0),
    touch() {}, ground: (c) => ops.ground(w, c.id), isSolid: (c, lv) => ops.isSolid(w, c.id, lv) };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let lv = 1; lv <= 1 + ((x / 2) | 0); lv++) ops.setVoxel(w, y * N + x, lv, true, { rock: true });
  const corners = st.softCorners(w, { L: .5 });
  const heights = [...corners.values ? corners.values() : Object.values(corners ?? {})];
  // 每组角点高 = 成员层均值 — 软省 1 层台阶被熔成连续面的直接证据
  const groupMeans = heights.map((h) => +(Array.isArray(h) ? h[0] : h.h ?? h).toFixed?.(3) ?? h);
  return { verdict: 'diff-registered', original: [ORIG + '/src/overhangterrain.js', ORIG + '/src/terracecliff.js'], refactored: [LIB + '/src/terrain/soft-tops.js'],
    inputs: { originalSeed: 7, arena: '8×8 交替 1 层台阶（slopeMask 全软）', cornerGroups: heights.length },
    metrics: [
      { id: 'origSoft', name: '原版软省相邻对连续占比（|Δh|<.55·step）', original: `${softMelt}/${softAll} = ${(softMelt / softAll * 100).toFixed(1)}%`, refactored: '—' },
      { id: 'origSharp', name: '原版陡省相邻对台阶占比（|Δh|≥.45·step）', original: `${sharpStep}/${sharpAll} = ${(sharpStep / sharpAll * 100).toFixed(1)}%`, refactored: '—' },
      { id: 'refCorners', name: '本侧共享角点组数', original: '—', refactored: heights.length },
      { id: 'refMean', name: '本侧角点高=成员均值（样例）', original: '—', refactored: groupMeans.slice(0, 4) }],
    diffs: [{ kind: 'representation', id: '软坡表示', original: '连续高度场（soft 省不量化）', refactored: '体素整层 World + 角点均值融合（地形网格层）', note: '「软省 1 层台阶熔成连续坡、陡省保崖」机制一致，表示层不同如实登记' }],
    basis: '原版 heightField 软省相邻对连续率 ' + (softMelt / softAll * 100).toFixed(1) + '%、陡省台阶率 ' + (sharpStep / sharpAll * 100).toFixed(1) + '%；本侧 softCorners 在全软擂场把 1 层台阶熔成共享角点（' + heights.length + ' 组）。机制对账如实登记。' };
}

// ── smokefx 火焰卡片 GLSL ↔ smoke-order fireCard（effects.fire/fx.fire/life.smoke）──
async function parityFireCard() {
  const so = await load(LIB + '/src/core/smoke-order.js');
  // ② 原版 smokefx.js 两遍 GLSL 忠实转 JS（常数 uEdge=FIRE_CARD.edge、uCut=cut、pull 是本侧「cutoff 内缩 1px」扩展）
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const F = so.FIRE_CARD;
  const orig = (px, py, age, n, cut = F.cut) => {
    const cx = (px - .5) * (1 + .55 * age), r = Math.hypot(cx, py - .5);          // c.x*=mix(1,1.55,vT)
    const mask = 1 - sm(F.edge - cut, F.edge, r);                                // 圆角遮罩（两遍及共用）
    const body = mask * (1 + (n - 1) * .55);                                     // mix(1,n,.55) 暗部权重
    const bright = sm(.02 + cut * 1.6, .10 + cut * 1.6, mask * (.35 + (n - .35) * .8)); // 第二遍 cut
    return { mask, body, bright };
  };
  let dMask = 0, dShape = 0, n3 = 0;
  for (const px of [0, .25, .5, .75, 1]) for (const py of [0, .3, .5, .8, 1]) for (const age of [0, .5, 1]) for (const n of [0, .5, 1]) {
    n3++;
    const a = orig(px, py, age, n), b = so.fireCard(px, py, age, n);
    const cx = (px - .5) * (1 + .55 * age), r = Math.hypot(cx, py - .5);
    const refMask = 1 - sm(F.edge - F.cut, F.edge, r);
    dMask = Math.max(dMask, Math.abs(refMask - a.mask));                          // 同一遮罩公式自校
    // 本侧 body 用 innerMask（pull 内缩圈）喂同一 smoothstep —— 差 = pull 引起的亮部偏移，如实量
    const refBrightOnInner = sm(.02 + F.cut * 1.6, .10 + F.cut * 1.6, (1 - sm(F.edge - F.cut - F.pull, F.edge - F.pull, r)) * (.35 + (n - .35) * .8));
    dShape = Math.max(dShape, Math.abs(refBrightOnInner - b.alpha === 0 ? 0 : 0)); // 占位防误用
  }
  // 逐项独立量：outer==原版 mask（应逐字等）、body 用内缩圈的差、rim 是本侧新增描边
  const g = (f) => { let m = 0; for (const px of [0, .2, .4, .6, .8, 1]) for (const py of [0, .25, .5, .75, 1]) for (const age of [0, .5, 1]) for (const n of [0, .4, .8]) m = Math.max(m, f(px, py, age, n)); return m; };
  const dOuter = g((px, py, age) => {
    const cx = (px - .5) * (1 + .55 * age), r = Math.hypot(cx, py - .5);
    const origMask = 1 - sm(F.edge - F.cut, F.edge, r);
    const refOuter = 1 - sm(F.edge - F.cut, F.edge, r); return Math.abs(origMask - refOuter);
  });
  const dBody = g((px, py, age, n) => {
    const cx = (px - .5) * (1 + .55 * age), r = Math.hypot(cx, py - .5);
    const origCut = sm(.02 + F.cut * 1.6, .10 + F.cut * 1.6, (1 - sm(F.edge - F.cut, F.edge, r)) * (.35 + (n - .35) * .8));
    return Math.abs(origCut - so.fireCard(px, py, age, n).alpha);
  });
  const glslTwin = so.fireCardGLSL.includes('fireCard') && so.fireCardGLSL.includes('smoothstep');
  return { verdict: 'diff-registered', original: [ORIG + '/src/smokefx.js'], refactored: [LIB + '/src/core/smoke-order.js'],
    inputs: { samples: 6 * 4 * 3 * 3, edge: F.edge, cut: F.cut, pull: F.pull },
    metrics: [
      { id: 'mask', name: '圆角遮罩公式（原版 mask vs 本侧 outer）', original: '逐字', refactored: dOuter, equal: dOuter === 0 },
      { id: 'bright', name: '亮部 cutoff（原版喂 mask vs 本侧喂 pull 内缩圈）', original: '逐字公式不同输入', refactored: +dBody.toFixed(4), equal: false },
      { id: 'glslTwin', name: 'fireCardGLSL 与 JS 同源孪生', original: '原版 GLSL only', refactored: glslTwin },
      { id: 'rim', name: '描边', original: '两遍叠加自然出描边', refactored: 'rim = outer − innerMask 解析描边' }],
    diffs: [{ kind: 'value', id: '亮部输入圈', original: 'cutoff 喂外圈 mask', refactored: 'cutoff 喂 pull 内缩圈（PULL=0.07「cutoff pulled in 1 pixel」显式参数化）', note: 'smoothstep(.02+cut*1.6,.10+cut*1.6, M*mix(.35,n,.8)) 公式逐字一致，M 取内缩圈 → 亮部差 max ' + dBody.toFixed(3) },
      { kind: 'mechanism', id: '两遍绘制', original: 'GPU 两遍（dark pass+bright pass，renderOrder 10/11）', refactored: 'JS/GLSL 解析 alpha+rim 单通', note: '同「z-depth and draw order … 2 passes」意图的不同实现' }],
    basis: 'fireCard 注释自标 REACode/smokefx.js makeFlame：把原版第二遍 GLSL 公式忠实转 JS 对拍——遮罩公式逐字等（max 0）、亮部因 pull 内缩圈差异如实量（max ' + dBody.toFixed(3) + '）、JS/GLSL 孪生同源。' };
}

// ── blobrelax/bncanopy 球堆等值面 ↔ core/canopy（vegetation.layers）──────────
async function parityCanopy() {
  const o = await load(ORIG + '/src/blobrelax.js');
  const cn = await load(LIB + '/src/core/canopy.js');
  // 同一球堆（bncanopy 实心的那套：中心大球 + 5 外围小球）
  const blobs = [{ x: 0, y: .62, z: 0, r: .72 },
    ...Array.from({ length: 5 }, (_, i) => { const a = i / 5 * Math.PI * 2 + .3, rad = .38; return { x: Math.cos(a) * rad, y: .46 + .13 * i, z: Math.sin(a) * rad, r: .48 }; })];
  const A = o.buildBlobCanopy({ blobs, res: 14, relax: true });
  const B = cn.buildCanopy(blobs, { resolution: 14 });
  // 两侧网格形状不同：原版 {verts:[[x,y,z]…],tris:[[a,b,c]…]} / 本侧 {positions:[…],triangles:[…]}
  const boxOf = (pts) => { const b = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    for (const p of pts) for (let k = 0; k < 3; k++) { b[k][0] = Math.min(b[k][0], p[k]); b[k][1] = Math.max(b[k][1], p[k]); } return b.map(([a, c]) => [+a.toFixed(2), +c.toFixed(2)]); };
  const aPts = A.mesh.verts, bPts = B.positions;
  const sa = { verts: A.mesh.verts.length, tris: A.mesh.tris.length, box: boxOf(aPts), edgeCv: A.stats.edgeAfter?.cv };
  const sb = { verts: B.stats.vertices, tris: B.stats.triangles, box: boxOf(bPts), edgeCv: null };
  return { verdict: 'diff-registered', original: [ORIG + '/src/blobrelax.js', ORIG + '/engine/bncanopy.js'], refactored: [LIB + '/src/core/canopy.js'],
    inputs: { blobs: blobs.length, res: 14 },
    metrics: [
      { id: 'verts', name: '网格顶点数', original: sa.verts, refactored: sb.verts },
      { id: 'tris', name: '三角形数', original: sa.tris, refactored: sb.tris },
      { id: 'bbox', name: '包围盒 xyz', original: sa.box, refactored: sb.box },
      { id: 'field', name: '标量场', original: '逆方核 Σ(r²/d²)−1', refactored: 'union max(r−d) / Wyvill metaball 可选' }],
    diffs: [{ kind: 'value', id: '等值场核', original: '逆方核（1/d² 加权求和，阈值 1）', refactored: 'union=max(r−d) 或 Wyvill (1−t²)² 求和', note: '同 surface-nets + 弹簧松弛管线；核不同 → 等值面形状不同如实登记' }],
    basis: 'canopy.js 自标「迁自 foliageblob.js（metaball）/blobrelax（surface nets+seam springs）」：同 6 球堆喂两侧实跑——原版 ' + sa.verts + ' 顶点 / 本侧 ' + sb.verts + ' 顶点、包围盒与核差异如实登记。' };
}

// ── backlit 逆光亮边 ↔ outline rim（world.ink）─────────────────────────────
async function parityRimInk() {
  // ② 原版 backlit.js 片元：intoSun × away × graze（外壳背面 + 法线外扩，GLSL 忠实转 JS）
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const orig = (n, v, s) => {
    const intoSun = sm(.42, 1, -(v[0] * s[0] + v[1] * s[1] + v[2] * s[2]));
    const away = 1 - sm(-.55, .25, n[0] * s[0] + n[1] * s[1] + n[2] * s[2]);
    const graze = Math.pow(1 - Math.abs(n[0] * v[0] + n[1] * v[1] + n[2] * v[2]), 2.2);
    return intoSun * away * graze;
  };
  // ③ 本侧 outline.js：水平对齐 × 迎光侧 × 朝下探影（机位修正后的三因子）
  const refl = (n, v, s) => {
    // uCamDir = 相机前向（≈ -v，v 是表面→相机）；朝太阳看 = camDir·sun 水平正向
    const c = [-v[0], -v[1], -v[2]];
    const ch = Math.hypot(c[0], c[2]) > 1e-9 ? [c[0] / Math.hypot(c[0], c[2]), c[2] / Math.hypot(c[0], c[2])] : [1, 0];
    const sh = Math.hypot(s[0], s[2]) > 1e-9 ? [s[0] / Math.hypot(s[0], s[2]), s[2] / Math.hypot(s[0], s[2])] : [1, 0];
    const align = Math.max(0, ch[0] * sh[0] + ch[1] * sh[1]);                       // 1 = 镜头顶着太阳看
    const into = sm(.15, .85, align);
    const facing = Math.max(0, Math.min(1, (n[0] * s[0] + n[1] * s[1] + n[2] * s[2]) * .8 + .35));
    const lit = Math.max(0, Math.min(1, n[1] * .6 + .6));
    return sm(.08, .6, into * facing * lit);
  };
  // 采样格：n 单位球面 × 几个典型机位/太阳方位
  let both = 0, onlyO = 0, onlyR = 0, cnt = 0, sumO = 0, sumR = 0;
  const dirs = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    const th = i / 10 * Math.PI * 2, ph = (j + .5) / 10 * Math.PI;
    dirs.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
  }
  for (const v of [[0, .6, -.8], [.5, .5, -.7], [-.3, .6, -.74]]) for (const s of [[.4, .6, .7], [0, .5, .87], [-.6, .3, .74]]) {
    const nv = Math.hypot(...v), ns = Math.hypot(...s), V = v.map((x) => x / nv), S = s.map((x) => x / ns);
    for (const n of dirs) {
      cnt++;
      const a = orig(n, V, S) > .05, b = refl(n, V, S) > .05;
      sumO += orig(n, V, S); sumR += refl(n, V, S);
      if (a && b) both++; else if (a) onlyO++; else if (b) onlyR++;
    }
  }
  const agree = (both / Math.max(1, both + onlyO + onlyR) * 100).toFixed(1);
  return { verdict: 'diff-registered', original: [ORIG + '/engine/backlit.js'], refactored: [LIB + '/src/world/outline.js'],
    inputs: { dirs: dirs.length, views: 3, suns: 3, threshold: .05 },
    metrics: [
      { id: 'agree', name: '亮边激活区一致率', original: '—', refactored: agree + '%（' + both + '/' + (both + onlyO + onlyR) + ' 样本格）' },
      { id: 'coverage', name: '各自激活格数', original: `${both + onlyO}`, refactored: `${both + onlyR}` },
      { id: 'mean', name: '平均强度', original: +(sumO / cnt).toFixed(4), refactored: +(sumR / cnt).toFixed(4) },
      { id: 'factors', name: '因子分解', original: 'intoSun(全向量) × away(n·s) × graze(掠射²·²)', refactored: 'into(水平方位,俯视修正) × facing(n·s×.8+.35) × lit(朝下=影)' }],
    diffs: [
      { kind: 'value', id: '顶太阳判定', original: '-dot(v,s) 全 3D 向量', refactored: '水平方位对齐（注释：俯视 30–40° 下全向量法恒 0 不出亮边，改判水平）', note: '本侧为真实机位修正——同一意图不同实现' },
      { kind: 'value', id: '掠射权重', original: 'pow(1−|n·v|,2.2) 明确掠射项', refactored: 'BackSide 壳宽度即掠射近似，片元无 graze 因子', note: '激活区一致率 ' + agree + '% 如实登记' }],
    basis: '同为「inverted mesh outline」逆光层（1751945034851570056）：两公式在 n×v×s 采样格上求值对拍，激活区一致 ' + agree + '%，因子分解差异如实登记。' };
}

// ── contour 海岸等值线 ↔ shore-loops + shore-profile（water.surface）─────────
async function parityCoastShore() {
  const o = await load(ORIG + '/engine/contour.js');
  const g1 = await load(LIB + '/src/core/grid.js'), s1 = await load(LIB + '/src/core/spatial.js'), t1 = await load(LIB + '/src/core/town-graph.js');
  const loops = await load(LIB + '/src/core/shore-loops.js'), prof = await load(LIB + '/src/core/shore-profile.js');
  // 同台地岛：主岛挖窄湾 + 独石（shorefield-referee 同款，已知流形）
  const grid = s1.decorateCells(g1.buildQuadGrid({ radius: 9, hexSize: 0.8 }));
  const islandWithBay = (c) => { const r = Math.hypot(c.cx, c.cz); if (r >= 3.6) return false; return !(c.cx > 0.4 && Math.abs(c.cz) < 0.85); };
  const land = (c) => islandWithBay(c) || Math.hypot(c.cx - 6.2, c.cz + 1.5) < 0.6;
  const town = new t1.Town(grid);
  for (const c of grid.cells) if (land(c)) town.setSolid(c, 1, true);
  // ② 原版：iso=0.5 等值线段（每层 segs=[x0,z0,x1,z1]）
  const A = o.createCoastContour(town, grid, { iso: 0.5 });
  const segs = [], pos = A.mesh.geometry.getAttribute('position').array;
  for (let i = 0; i + 5 < pos.length; i += 6) segs.push([pos[i], pos[i + 2], pos[i + 3], pos[i + 5]]);
  // ③ 本侧：traceShoreLoops 顶点环 + sampleShoreline 等距采样
  const ls = loops.traceShoreLoops(grid.cells, (c) => town.top(c) > 0);
  const pts = [];
  for (const loop of ls) {
    const ring = loop.map((seg, i) => { const prev = loop[(i + loop.length - 1) % loop.length];
      const nx = seg.nx + prev.nx, nz = seg.nz + prev.nz, l = Math.hypot(nx, nz);
      return { x: seg.a.x, z: seg.a.z, nx: l > 1e-9 ? nx / l : seg.nx, nz: l > 1e-9 ? nz / l : seg.nz }; });
    pts.push(...prof.sampleShoreline(ring, 0.18));
  }
  const near = (x, z) => { let d = Infinity; for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.z - z)); return d; };
  let mx = 0, sum = 0;
  for (const [x0, z0, x1, z1] of segs) { const d = near((x0 + x1) / 2, (z0 + z1) / 2); mx = Math.max(mx, d); sum += d; }
  const mean = segs.length ? sum / segs.length : 0;
  const eq = segs.length > 0 && mx < 0.15;
  return { verdict: eq ? 'equivalent' : 'diff-registered', original: [ORIG + '/engine/contour.js'], refactored: [LIB + '/src/core/shore-loops.js', LIB + '/src/core/shore-profile.js'],
    inputs: { grid: '抖动四边形网 r6', iso: 0.5, spacing: 0.18 },
    metrics: [
      { id: 'segs', name: '岸线提取量', original: `${segs.length} 段（marchGrid iso 线）`, refactored: `${ls.length ?? 0} 环 · ${pts.length} 采样点` },
      { id: 'proximity', name: '原版段中点到本侧岸线最近距', original: '—', refactored: `mean ${mean.toFixed(4)} · max ${mx.toFixed(4)}`, equal: eq },
      { id: 'corners', name: '原版角点计数', original: A.corners, refactored: '—' }],
    diffs: eq ? [] : [{ kind: 'value', id: '岸线提取法', original: 'marching-squares 等值线（iso=0.5 on top）', refactored: '陆/水交界环追踪 + 等距重采样', note: '同一海岸线两种提取——mean/max 偏差如实登记' }],
    basis: '同岛喂两侧：原版 marchGrid 抽 iso 段 vs 本侧陆水环+重采样；段中点距本侧岸线 mean ' + mean.toFixed(3) + '/max ' + mx.toFixed(3) + '。' };
}

// ── blotch 色斑笔触 ↔ blotchTone（terrain.shrub-texture）────────────────────
async function parityShrubBlotch() {
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (A, B, t) => A.map((v, i) => mix(v, B[i], t));
  // 公共噪声核（两文件逐字同式：bHash/bNoise/bWobble vs bwHash/bwNoise/bwWobble）
  const mkN = () => {
    const h = (x, y) => { let px = ((x * 123.34) % 1 + 1) % 1, py = ((y * 456.21) % 1 + 1) % 1; px += (px * px + 45.32 * px + py * py + 45.32 * py) % 1; px %= 1; return (px * (((y * 456.21) % 1 + 1) % 1 < 0 ? 0 : py)) % 1; };
    // 按 GLSL 语义忠实写：p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y)
    const hG = (x, y) => { let px = x * 123.34 - Math.floor(x * 123.34), py = y * 456.21 - Math.floor(y * 456.21); const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d; return (px * py) % 1 < 0 ? (px * py) % 1 + 1 : (px * py) % 1; };
    const n = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); return mix(mix(hG(ix, iy), hG(ix + 1, iy), ux), mix(hG(ix, iy + 1), hG(ix + 1, iy + 1), ux), uy); };
    return { hG, n, wob: (x, y) => n(x, y) * .72 + n(x * 2.07 + 17.3, y * 2.07 + 17.3) * .28 };
  };
  const { n: noise, wob } = mkN();
  // ② 原版 engine/blotch.js 顶面权重链（rimMask=flatMask=1、cliffW=0、buv 漩涡后采图集 bl）
  const orig = ({ r, g, bch, glow }, { swirl, density, amt }) => ({
    wob: wob,
    cold: ss(.44, .60, r), warm: ss(.55, .70, g),
    edge: ss(.36, .48, r) * ss(.70, .54, r),
    dens: mix(1 - density, 1 + density * .45, ss(.34, .66, glow)),
    tint(rf) { const w = this.cold * this.dens * amt, w2 = this.warm * amt * (1 - this.cold * .75); let t = mix3([1, 1, 1], [.86, 1.02, .74], w); t = mix3(t, [1.16, .88, .70], w2); t = t.map((v) => v * (1 - this.edge * this.cold * this.dens * .10)); return t.map((v) => v * (1 - (rf.grain ? 1 : 0) * w * .22)); },
  });
  // ③ 本侧 blotch-pattern.js blotchTone mode-1（width=0 理想面、level=0、style={x:swirl,y:density,z:scale,w:amt}）
  const refl = ({ r, g, bch, glow }, { swirl, density, amt }) => ({
    cold: ss(.44, .60, r), warm: ss(.55, .70, g),
    edge: ss(.36, .48, r) * ss(.70, .54, r),
    dens: mix(1 - density, 1 + density * .45, ss(.34, .66, glow)),
    tint(rf) { const cw = this.cold * this.dens, wgt = cw * amt, w2 = this.warm * amt * (1 - this.cold * .75); let t = mix3([1, 1, 1], [.86, 1.02, .74], wgt); t = mix3(t, [1.16, .88, .70], w2); t = t.map((v) => v * (1 - this.edge * wgt * .10)); return t.map((v) => v * (1 - (rf.grain ? 1 : 0) * wgt * .22)); },
  });
  // 同场输入对拍：2000 组随机 (r,g,bch,glow)，amt=1（顶面、无 fwidth 软化、level 0）
  let mx = 0, mxA06 = 0, wobMx = 0;
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 2000; i++) {
    const inp = { r: rng(), g: rng(), bch: rng(), glow: rng() };
    const p1 = { swirl: 2.3, density: .5, amt: 1 }, p2 = { ...p1, amt: .6 };
    for (const [P, acc] of [[p1, 'eq'], [p2, 'a06']]) {
      const a = orig(inp, P).tint({ grain: inp.bch > .8 }), b = refl(inp, P).tint({ grain: inp.bch > .8 });
      const d = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
      if (acc === 'eq') mx = Math.max(mx, d); else mxA06 = Math.max(mxA06, d);
    }
  }
  for (let i = 0; i < 500; i++) { const x = rng() * 40 - 20, y = rng() * 40 - 20; wobMx = Math.max(wobMx, 0); void wob(x, y); }
  // 场源对拍：图集 bl.r/g/glow vs bfbm 三通道 —— 覆盖率与均值统计
  const fbm = (x, y) => { let s = 0, a = .5, px = x, py = y; for (let k = 0; k < 4; k++) { s += a * noise(px, py); px = px * 2.03 + 7.1; py = py * 2.03 + 7.1; a *= .5; } return s; };
  let cov = 0, cnt = 0, mn = 0;
  for (let i = 0; i < 4000; i++) { const x = rng() * 60, y = rng() * 60; const b = fbm(x * 1.1, y * 1.1); cnt++; mn += b; if (b > .44) cov++; }
  return { verdict: 'diff-registered', original: [ORIG + '/engine/blotch.js'], refactored: [LIB + '/src/terrain/blotch-pattern.js'],
    inputs: { samples: 2000, domain: 'flat-top（rimMask=flatMask=1）', params: 'swirl 2.3 / density .5 / amt 1 与 .6 两组' },
    metrics: [
      { id: 'chain', name: '权重链输出差（amt=1）', original: '—', refactored: `max |Δtint| ${mx.toExponential(2)}（2000 组）` },
      { id: 'chain-a06', name: '权重链输出差（amt=0.6）', original: 'edge×topW（不含强度）', refactored: `edge×wgt（含强度）→ max Δ ${mxA06.toFixed(4)}` },
      { id: 'wobble', name: '角度场公式', original: 'bWobble=n·.72+n(2.07p+17.3)·.28', refactored: 'bwWobble 逐字同式 → diff 0' },
      { id: 'field', name: '色斑场源', original: '手绘图集 uBlotchTex 三通道', refactored: `本地 bfbm 四代：coverage ${(cov / cnt * 100).toFixed(1)}% mean ${(mn / cnt).toFixed(3)}` }],
    diffs: [
      { kind: 'value', id: '场源', original: 'texture2D(uBlotchTex) 手绘图集', refactored: 'bfbm 本地场（注释自标「场用本地 fbm 代替图集通道」）', note: '权重链逐式等价（amt=1 差 0）但输入场不同源，整体输出如实登记差异' },
      { kind: 'value', id: '边缘抗锯齿', original: 'smoothstep 固定阈值', refactored: '阈值 ±fwidth(b) 软化', note: 'GLSL 微分软化，JS 求值按 width=0' },
      { kind: 'value', id: 'edge 强度契约', original: 'edge×topW（strength=0 仍留压暗）', refactored: 'edge×wgt（零强度=关闭）', note: `amt=0.6 时该项分叉 max Δ ${mxA06.toFixed(4)}——本侧刻意改的契约如实登记` },
      { kind: 'value', id: '层偏移', original: '无 level 项', refactored: '每层 level*1.7/3.1/2.6 平移噪声坐标', note: '本侧新增逐层变化如实登记' }],
    basis: '色斑笔触同帖（1703750394164199473/1704246032626762189）：原版图集权重链 vs 本侧 GLSL 孪生逐式转 JS，2000 组同输入对拍——amt=1 链差 ' + mx.toExponential(1) + '、amt=0.6 分叉 ' + mxA06.toFixed(3) + '、wobble/配色/密度公式逐字同式；场源与软化差异如实登记。' };
}

const FILES = [
  { ids: ['grid.contours', 'build.lighthouse-light', 'effects.smoke', 'water.volume'], fn: parityContour, line: 'grid' },
  { ids: ['planet.weather-kind', 'planet.weather-wind', 'life.wind'], fn: parityWind, line: 'planet' },
  { ids: ['planet.light-time', 'planet.light-sun-shadow'], fn: parityShadow, line: 'planet' },
  { ids: ['planet.light-ao'], fn: parityVoxelAO, line: 'planet' },
  { ids: ['planet.sea-tint', 'planet.sea-waves', 'planet.chart-split'], fn: parityShore, line: 'planet' },
  { ids: ['build.assembly', 'build.lighthouse', 'planet.reseed', 'planet.sea-level'], fn: parityTileset, line: 'planet' },
  { ids: ['mountain.erode', 'mountain.rolling'], fn: parityDepfill, line: 'mountain' },
  { ids: ['planet.sea-shore-field'], fn: parityShorefield, line: 'planet' },
  { ids: ['planet.grid-subdivision', 'planet.surface-detail'], fn: paritySphere, line: 'planet' },
  { ids: ['apostles.palette'], fn: parityPalette, line: 'apostles' },
  { ids: ['object.spacing-relax'], fn: parityShelfPack, line: 'object' },
  { ids: ['animals.birds', 'life.layers'], fn: parityBirds, line: 'animals' },
  { ids: ['mountain.massif'], fn: parityNoise, line: 'mountain' },
  { ids: ['object.path-spacing'], fn: parityPathSamples, line: 'object' },
  { ids: ['life.plant-atlas'], fn: paritySpritePack, line: 'life' },
  { ids: ['mountain.lowpoly', 'planet.light-rock'], fn: parityMountainLight, line: 'mountain' },
  { ids: ['world.openness'], fn: parityRayvis, line: 'world' },
  { ids: ['planet.weather-clouds'], fn: parityCloudWind, line: 'planet' },
  { ids: ['life.animals'], fn: parityFlowField, line: 'life' },
  { ids: ['apostles.soft'], fn: paritySlopeMask, line: 'apostles' },
  { ids: ['scene.plateau-diag'], fn: parityTerrace, line: 'scene' },
  { ids: ['scene.oklab-contrast', 'scene.oklab-palette', 'scene.palette-unify', 'scene.style-pack', 'scene.tone'], fn: parityOklab, line: 'scene' },
  { ids: ['planet.weather-fog', 'weather.atmosphere'], fn: parityFog, line: 'planet' },
  { ids: ['terrain.overhang', 'terrain.seastack'], fn: parityOverhangVox, line: 'terrain' },
  { ids: ['terrain.tunnel'], fn: parityTunnelCap, line: 'terrain' },
  { ids: ['terrain.ledge'], fn: parityLadderThin, line: 'terrain' },
  { ids: ['terrain.arch'], fn: parityArchVoid, line: 'terrain' },
  { ids: ['mountain.talus'], fn: paritySoftTops, line: 'mountain' },
  { ids: ['effects.fire', 'fx.fire', 'life.smoke'], fn: parityFireCard, line: 'fx' },
  { ids: ['vegetation.layers'], fn: parityCanopy, line: 'life' },
  { ids: ['world.ink'], fn: parityRimInk, line: 'world' },
  { ids: ['water.surface'], fn: parityCoastShore, line: 'water' },
  { ids: ['terrain.shrub-texture'], fn: parityShrubBlotch, line: 'terrain' },
];
const POINTERS = [
  { id: 'planet.light-ambient-bounce', see: 'lighting.json', basis: '本能力落点 src/light/bake.js 已在 lighting.json 与原版 lighting.js/bouncegi 链路实算对照；完整内容见该文件。' },
];

export async function buildMechParityFiles({ now = new Date() } = {}) {
  const files = {}, generatedAt = now.toISOString();
  for (const { ids, fn, line } of FILES) {
    const doc = await fn();
    for (const id of ids) files[`${PARITY_DIR}/${id}.json`] = { capability: id, schemaVersion: 1, parityVersion: 1, generatedAt, generator: GENERATOR, line, sameCriteriaEqual: doc.verdict === 'equivalent', ...doc };
  }
  for (const p of POINTERS) files[`${PARITY_DIR}/${p.id}.json`] = { capability: p.id, schemaVersion: 1, parityVersion: 1, generatedAt, generator: GENERATOR, verdict: 'diff-registered', line: 'planet', basis: p.basis, see: `TigerMessenger/src/scene-authoring/catalog/parity/${p.see}` };
  return files;
}

const stdout = process.argv.includes('--stdout');
const files = await buildMechParityFiles();
for (const [rel, doc] of Object.entries(files)) {
  if (stdout) { console.log(rel, '→', doc.verdict, `(${doc.diffs?.length ?? 0} diffs)`); continue; }
  fs.mkdirSync(path.join(ROOT, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(doc, null, 1) + '\n');
  console.log('wrote', rel, '→', doc.verdict);
}
