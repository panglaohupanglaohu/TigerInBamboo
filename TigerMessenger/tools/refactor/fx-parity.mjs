// 原版当裁判 · 表现层（§5.2 在 TigerMessenger 目录里跑）：
//   cd TigerMessenger && $NODE tools/refactor/fx-parity.mjs            写文件
//   cd TigerMessenger && $NODE tools/refactor/fx-parity.mjs --stdout   只打印摘要
// 每个能力一份 catalog/parity/fx.<id>.json（成熟度 ④ 的证据）。
// 原版 REACode 只读 import，不改；GLSL 裁判在工具内逐式移植成 JS 再对拍。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TM = path.resolve(HERE, '../..');
const ROOT = path.resolve(TM, '..');
const ORIG = 'townscaper-web/REACode', LIB = 'townscaper-web/REACodeRefactoring';
const PARITY_DIR = 'TigerMessenger/src/scene-authoring/catalog/parity';
const GENERATOR = 'TigerMessenger/tools/refactor/fx-parity.mjs';
const load = async (rel) => import(path.join(ROOT, rel));

const maxDiff = (pairs) => pairs.reduce((m, [a, b]) => Math.max(m, Math.abs(a - b)), 0);

// ── fx.camera：smearLengthPx 网格对拍 + 非法输入行为 ─────────────────────────
async function parityCamera() {
  const o = await load(ORIG + '/src/smear.js'), r = await load(LIB + '/src/core/camera-motion.js');
  const pairs = [], inputs = { omegas: 21, radii: 17, dts: [1 / 24, 1 / 30, 1 / 60, 1 / 120] };
  for (let i = -10; i <= 10; i++) for (let j = 0; j < 17; j++) for (const dt of inputs.dts) {
    const w = i * 0.8, rad = j * 125;
    pairs.push([o.smearLengthPx(w, rad, dt), r.smearLengthPx(w, rad, dt)]);
  }
  const diff = maxDiff(pairs);
  const diffs = [];
  if (diff > 1e-9) diffs.push({ kind: 'value', id: 'smearLengthPx', original: diff, refactored: '网格最大差 ' + diff });
  const oBad = o.smearLengthPx(NaN, 100, 1 / 60); let rBad = null; try { r.smearLengthPx(NaN, 100, 1 / 60); } catch (e) { rBad = e.constructor.name; }
  diffs.push({ kind: 'validation', id: 'smearLengthPx(NaN)', original: String(oBad), refactored: rBad || '返回值' });
  const oNeg = o.smearLengthPx(2, -100, 1 / 60), rNeg = r.smearLengthPx(2, -100, 1 / 60);
  if (oNeg !== rNeg) diffs.push({ kind: 'value', id: 'smearLengthPx(2,-100,dt)', original: oNeg, refactored: rNeg });
  return { id: 'fx.camera', verdict: diffs.length ? 'diff-registered' : 'equivalent', metrics: [{ id: 'smear-grid', name: 'smearLengthPx 1428 点网格最大差', original: 0, refactored: diff }], inputs, diffs,
    basis: '同一组 (ω,r,dt) 喂两边 smearLengthPx；合法域上原版 |ω|·r·dt 与重构 |ω|·|r|·dt 的差别只在负半径与非法输入的处理。' };
}

// ── fx.ornament：fold + orientUV 全网格对拍 ─────────────────────────────────
async function parityOrnament() {
  const o = await load(ORIG + '/src/mirrordecor.js'), r = await load(LIB + '/src/core/mirror-uv.js');
  const fp = []; for (let i = 0; i <= 400; i++) { const t = -4 + i * 0.02; fp.push([o.fold(t), r.fold(t)]); }
  const up = []; for (let k = 0; k < 8; k++) for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const [ou, ov] = o.orientUV(i / 10, j / 10, k), [ru, rv] = r.orientUV(i / 10, j / 10, k);
    up.push([ou, ru], [ov, rv]);
  }
  const diffs = [];
  let oBad = null; try { o.orientUV(0, 0, 9); oBad = '不校验（返回旋转结果）'; } catch { oBad = '抛错'; }
  let rBad = null; try { r.orientUV(0, 0, 9); } catch (e) { rBad = e.constructor.name; }
  if (oBad !== rBad) diffs.push({ kind: 'validation', id: 'orientUV(·,·,9)', original: oBad, refactored: rBad });
  const foldD = maxDiff(fp), uvD = maxDiff(up);
  return { id: 'fx.ornament', verdict: diffs.length ? 'diff-registered' : 'equivalent',
    metrics: [{ id: 'fold', name: 'fold 401 点最大差', original: 0, refactored: foldD }, { id: 'orient', name: 'orientUV 8×121 点最大差', original: 0, refactored: uvD }],
    inputs: { foldSamples: 401, orientGrid: '8 orientation × 11×11 uv' }, diffs,
    basis: 'fold 与 orientUV 在两库里同名同语义：D4 群 8 向镜像 + 三角折叠，逐点数值对拍。' };
}

// ── fx.wake：KELVIN 常量 + 发射语义登记 ─────────────────────────────────────
async function parityWake() {
  const o = await load(ORIG + '/src/wake.js'), r = await load(LIB + '/src/core/wake-sampling.js');
  const diffs = [{ kind: 'design', id: 'emission-model', original: 'Wake.step 每帧按 rate·dt·2 舷侧发射（Ship/Wake 状态模拟）', refactored: 'advanceWake/makeWakeParticles 按固定 interval·spread 采样带' }];
  const w = new o.Wake({ seed: 7 }); w.addShip(new o.Ship({ speed: 46 }));
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  const foam1s = w.foam.length;
  return { id: 'fx.wake', verdict: 'diff-registered',
    metrics: [{ id: 'kelvin', name: 'KELVIN 半角常量', original: o.KELVIN, refactored: r.KELVIN }, { id: 'foam-1s', name: '原版 Wake 直线 1s 泡沫发射数（speed46·rate300）', original: foam1s, refactored: '模型不同不直接可比' }],
    inputs: { ship: 'speed=46 len=54 beam=15', steps: '60×1/60s' }, diffs, gaps: 0,
    basis: '原版 Ship/Wake 是逐帧发射模拟；重构版把同一条 V 形尾迹做成固定间隔采样带。常量一致，发射模型口径不同，登记不判等价。' };
}

// ── fx.projectiles：同参数烘弧对拍（同一速度 Verlet 积分）───────────────────
async function parityProjectiles() {
  const o = await load(ORIG + '/src/ballistic.js'), r = await load(LIB + '/src/core/ballistic-table.js');
  const diffs = [{ kind: 'defaults', id: 'params', original: 'g=9.8 drag=2 startOffset=0.1 dt=1/30', refactored: `g=${r.PROJECTILE_GRAVITY} drag=0 dt=1/60` }];
  const inputs = { speeds: [3, 5, 7, 9, 11], angles: [15, 30, 45, 55], shared: 'g=9.8 drag=2 dt=1/30 start y=0 落地 y≤0' };
  const rp = [], ap = [];
  for (const s of inputs.speeds) for (const a of inputs.angles) {
    const arcO = o.bakeArc({ speed: s, angleDeg: a, params: { ...o.DEFAULT_PARAMS, startOffset: 0, bounds: { minY: -1e9, maxY: 1e9, minZ: 0, maxZ: 1e9 } } });
    const arcR = r.bakeBallisticArc({ speed: s, angleDeg: a, gravity: 9.8, drag: 2, dt: 1 / 30, maxTime: 4, minY: -1e-12 });
    rp.push([arcO.range || 0, arcR.range || 0]); ap.push([arcO.apex || 0, arcR.apex || 0]);
  }
  const rd = maxDiff(rp), ad = maxDiff(ap);
  return { id: 'fx.projectiles', verdict: diffs.length ? 'diff-registered' : 'equivalent',
    metrics: [{ id: 'range', name: '同参数 20 弧射程最大差', original: 0, refactored: rd }, { id: 'apex', name: '同参数 20 弧顶点最大差', original: 0, refactored: ad }],
    inputs, diffs,
    basis: '两边都是同一速度 Verlet 积分（前后速度均值推位置）。把原版参数对齐到同 g/drag/dt/起点后逐弧比射程与顶点；默认参数差（g9.8·drag2·dt1/30 vs g6·drag0·dt1/60）如实登记。' };
}

// ── fx.sediment：GLSL 裁判逐式移植到 JS 再对拍 ──────────────────────────────
function glslSediment() {
  const fract = (v) => v - Math.floor(v), mix = (a, b, t) => a + (b - a) * t;
  const sHash = (x, y) => { let px = fract(x * 123.34), py = fract(y * 456.21); const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d; return fract(px * py); };
  const sNoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = sHash(ix, iy), b = sHash(ix + 1, iy), c = sHash(ix, iy + 1), d = sHash(ix + 1, iy + 1); return mix(mix(a, b, fx), mix(c, d, fx), fy); };
  const sWobble = (x, y) => sNoise(x, y) * 0.72 + sNoise(x * 2.07 + 17.3, y * 2.07 + 17.3) * 0.28;
  // sWarp: q=wp.xz*uSedFreq; a=sWobble(q+3.1)-.5; b=sWobble(q*.87+41.7)-.5; → [b,a,b*.7]*uSedAmp
  const sWarp = (x, z, uSedAmp, uSedFreq) => { const qx = x * uSedFreq, qz = z * uSedFreq; const a = sWobble(qx + 3.1, qz + 3.1) - 0.5, b = sWobble(qx * 0.87 + 41.7, qz * 0.87 + 41.7) - 0.5; return [b * uSedAmp, a * uSedAmp, b * 0.7 * uSedAmp]; };
  return { sWobble, sWarp };
}
async function paritySediment() {
  const g = glslSediment(), r = await load(LIB + '/src/core/sediment.js');
  const wp = [], dp = [];
  for (let i = 0; i < 2000; i++) { const x = -60 + (i * 37.13) % 120, z = -40 + (i * 17.77) % 80; wp.push([g.sWobble(x, z), r.sWobble(x, z)]); }
  const AMP = 0.24, FREQ = r.SED_FREQ;
  for (let i = 0; i < 2000; i++) { const x = -60 + (i * 11.31) % 120, z = -40 + (i * 7.93) % 80;
    const a = g.sWarp(x, z, AMP, FREQ), b = r.sedimentDisplace(x, z, AMP / 2, FREQ);
    dp.push([a[0], b[0]], [a[1], b[1]], [a[2], b[2]]); }
  const wd = maxDiff(wp), dd = maxDiff(dp);
  return { id: 'fx.sediment', verdict: wd < 1e-12 && dd < 1e-12 ? 'equivalent' : 'diff-registered',
    metrics: [{ id: 'wobble', name: 'GLSL sWobble 逐式移植 vs JS sWobble 2000 点最大差', original: 0, refactored: wd }, { id: 'warp', name: 'GLSL sWarp vs sedimentDisplace 2000 点×3 分量最大差', original: 0, refactored: dd }],
    inputs: { points: 2000, uSedAmp: AMP, uSedFreq: FREQ, map: '本地 amplitude = uSedAmp/2' }, diffs: [],
    basis: 'engine/surface.js 的 sHash/sNoise/sWobble/sWarp 在本工具内按 GLSL 逐式移植成 JS（同一份公式），再与重构 sediment.js 同点采样对拍。' };
}

// ── fx.hallway：常量与面板色板对拍（原版 drawMotif 要 canvas ctx）────────────
async function parityHallway() {
  const o = await load(ORIG + '/src/doodlewall.js'), r = await load(LIB + '/src/build/doodle-wall.js');
  const diffs = [{ kind: 'runtime', id: 'drawMotif', original: 'ctx 画原版鱼/鸟/花/虫/面具路径', refactored: 'ctx 画同族路径+图腾/太阳/卷草等扩展件' }];
  const rgbaNums = (s) => String(s).match(/[\d.]+/g).map(Number);
  const cssEq = (a, b) => JSON.stringify(rgbaNums(a)) === JSON.stringify(rgbaNums(b));
  const tintEq = JSON.stringify(o.PANEL_TINTS.map(rgbaNums)) === JSON.stringify(r.PANEL_TINTS.map(rgbaNums)), inkEq = cssEq(o.INK, r.INK), paperEq = cssEq(o.PAPER, r.PAPER);
  if (!tintEq) diffs.push({ kind: 'value', id: 'PANEL_TINTS', original: o.PANEL_TINTS, refactored: r.PANEL_TINTS });
  if (!inkEq) diffs.push({ kind: 'value', id: 'INK', original: o.INK, refactored: r.INK });
  if (!paperEq) diffs.push({ kind: 'value', id: 'PAPER', original: o.PAPER, refactored: r.PAPER });
  return { id: 'fx.hallway', verdict: 'diff-registered',
    metrics: [{ id: 'palette', name: 'PANEL_TINTS/INK/PAPER 逐值一致', original: '6色+墨+纸', refactored: tintEq && inkEq && paperEq ? '一致' : '不一致' }],
    inputs: { compare: 'constants + motif kind coverage' }, diffs,
    basis: '原版 drawMotif 只在 canvas ctx 上画，Node 不能执行；颜色/墨色常量按 rgba 数值解析对拍（字面格式 .92/0.92 不算差异），纹样路径差异如实登记。' };
}

// ── fx.campaign：同节点集实测邻接对拍（knnEdges vs campaignGraph）──────────
async function parityCampaign() {
  const o = await load(ORIG + '/src/campaignmap.js'), r = await load(LIB + '/src/campaign/campaign.js');
  const g = await load(LIB + '/src/core/campaign-graph.js');
  const rg = r.generateCampaign({ seed: 7, n: 260, W: 6, H: 26, regions: 6 });
  const rows = [];
  let inter = 0, oOnly = 0, rOnly = 0, oEdges = 0, rEdges = 0;
  for (const seed of [7, 11, 23]) {
    const nodes = o.scatter({ w: 640, h: 400, seed }).nodes;
    const oe = o.knnEdges(nodes, { k: 3, linkDist: 66 });
    const oSet = new Set(oe.map(([a, b]) => a < b ? a + '-' + b : b + '-' + a));
    const graph = g.campaignGraph(nodes);
    const rSet = new Set();
    graph.nb.forEach((ns, a) => { for (const b of ns) { if (a < b) rSet.add(a + '-' + b); } });
    const i = [...oSet].filter(k => rSet.has(k)).length;
    inter += i; oOnly += oSet.size - i; rOnly += rSet.size - i; oEdges += oSet.size; rEdges += rSet.size;
    rows.push({ seed, nodes: nodes.length, originalEdges: oSet.size, refactoredEdges: rSet.size, shared: i, jaccard: +(i / (oSet.size + rSet.size - i)).toFixed(4), bridges: graph.bridges.length, componentsBeforeRepair: graph.componentsBeforeRepair });
  }
  const totalJ = +(inter / (oEdges + rEdges - inter)).toFixed(4);
  const diffs = [
    { kind: 'design', id: 'graph.adjacency', original: `knnEdges(k=3,linkDist=66)：3 种子共 ${oEdges} 边`, refactored: `campaignGraph（Delaunay+2NN+Kruskal 桥）：${rEdges} 边；重合 ${inter}，边集 Jaccard ${totalJ}`, note: '原版 knn 判据已从 campaignmap.js 复原并实测；重构版为 Delaunay 近似+连通修复，非 unknow，是实测差异。' },
    { kind: 'design', id: 'graph.connectivity', original: 'knn 不保证连通（原作靠游走 stuck 计数暴露）', refactored: `Kruskal 桥接保证连通（3 种子桥 ${rows.map(r2 => r2.bridges).join('/')}，修复前连通块 ${rows.map(r2 => r2.componentsBeforeRepair).join('/')}）` },
  ];
  return { id: 'fx.campaign', verdict: 'diff-registered',
    metrics: [
      { id: 'edgeOverlap', name: '同节点集边重合率（3 种子合计）', original: `knn ${oEdges} 边`, refactored: `graph ${rEdges} 边 · 重合 ${inter} · Jaccard ${totalJ}` },
      { id: 'seeds', name: '各种子明细', original: rows.map(r2 => `${r2.seed}:${r2.originalEdges}e`).join(' '), refactored: rows.map(r2 => `${r2.seed}:${r2.refactoredEdges}e/J${r2.jaccard}/B${r2.bridges}`).join(' ') },
    ],
    inputs: { seeds: [7, 11, 23], scatter: { w: 640, h: 400 }, knn: { k: 3, linkDist: 66 } }, diffs, gaps: 1,
    decisions: [{ id: 'fx.campaign:graph.adjacency', decided: 'keep-delaunay-bridges', at: '2026-11-25', note: `原版 knn(k=3,linkDist=66) 判据已复原并实测：3 种子边重合 ${inter}/${oEdges}，Jaccard ${totalJ}；重构版 Delaunay+2NN+Kruskal 桥接保证连通（原版 knn 不保证，靠 walkPath stuck 计数暴露）。定案保留重构判据：连通性是可玩性刚需，边集差异如实登记。` }],
    basis: '原版 knnEdges 已从 campaignmap.js 复原，同 scatter 节点集实测对拍：边集 Jaccard ' + totalJ + '（重合 ' + inter + '/' + oEdges + '）；重构版 Delaunay 近似+连通桥接为刻意的可玩性修复，如实登记不判等价。' };
}

const RUNNERS = [parityCamera, parityOrnament, parityWake, parityProjectiles, paritySediment, parityHallway, parityCampaign];
const NO_ORIGINAL = [
  { id: 'fx.fire', why: 'life/effects.js 按帖子重构（1056990611738451968 等），REACode 里没有可对拍的原版文件' },
  { id: 'fx.replay', why: 'node-graph-runtime 是重构库自造工具，没有原版对应' },
];

export async function buildFxParityFiles({ now = new Date() } = {}) {
  const files = {}, docs = [], demand = [];
  for (const run of RUNNERS) {
    const d = await run(); docs.push(d); demand.push(...(d.demand || []));
    const rel = `${PARITY_DIR}/${d.id}.json`;
    files[rel] = { capability: d.id, schemaVersion: 1, parityVersion: 1, generatedAt: now.toISOString(), generator: GENERATOR,
      verdict: d.verdict, line: 'fx', basis: d.basis, metrics: d.metrics, inputs: d.inputs, diffs: d.diffs, gaps: d.gaps || 0,
      skipped: NO_ORIGINAL.filter((n) => n.id === d.id).map((n) => n.why) };
  }
  files[`${PARITY_DIR}/fx-demand.json`] = demand;
  return { docs, files, skipped: NO_ORIGINAL };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { docs, files, skipped } = await buildFxParityFiles();
  if (process.argv.includes('--stdout')) {
    console.log(docs.map((d) => `${d.id} → ${d.verdict}（${d.metrics.map((m) => `${m.name}=${m.refactored}`).join('；')}）`).join('\n'));
    console.log('无原版跳过：' + skipped.map((s) => s.id).join(' '));
  } else {
    fs.mkdirSync(path.join(ROOT, PARITY_DIR), { recursive: true });
    for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(body, null, 1) + '\n');
    console.log(docs.map((d) => `${d.id} → ${d.verdict}`).join(' · ') + `\n写入 ${Object.keys(files).length} 份 parity 文件；无原版跳过 ${skipped.length} 个（${skipped.map((s) => s.id).join(' ')}）`);
  }
}
