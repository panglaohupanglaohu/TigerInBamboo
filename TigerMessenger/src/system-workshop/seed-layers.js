/**
 * seed-layers.js — 多种子分布报告的「层登记表」（R61，Guide §1.4 创新 6）。每层一个适配器，给 seed-report.js 用。
 * 登记 = 这一层同意出分布报告（tier-workshop 的分布面板按这张表自动出现，即 opt-in）；没登记的层面板不出现。
 *
 * 种子 s 在每层的含义不一样，写在 seedMeaning 里（不能混着比）：
 *   山形       噪声种子（massif.seed = s、rolling.seed = 37s mod 1000，与 R28 同一个函数，直接复用 mountain/seeds.js）
 *   球系统     星球配方 seed = s（真种子：同一条编译管线换种子）
 *   光影与生命 合成岛 syntheticSite(s)（地形 + 房子 + 植物都由 s 生成）上跑全部 9 个能力
 *   战役 / 表现层 / 十二门徒地形 / 通用场景 / 物件  这些层的能力没有噪声种子：s 生成一份合成输入，
 *              在上面按扫描结果预装全部能匹配的能力（默认参数）跑一遍——看的是「这条管线在不同输入上稳定产出什么范围」。
 *   场景（体素） NOT_RUN：输入是游戏 iframe 里莫西斯湖的体素世界（agent/world-cache.js，经 rea() 用浏览器地址加载能力注册表），
 *              Node 里没有这份输入，也还没有合成夹具；不编数。
 * 新的一层（例如并行在做的 relief / building）要出分布：在 LAYERS 里加一项（load 返回 metrics / fixture / runSeed）。
 * 版本号：import 的 ?v= 与 studio.js / worker-adapters.js / 各工坊 / 各 verify-worker 引同一模块时一致（2026-11-23 按 R51–R60 统一后的 contract-r1 改过一次），
 *   避免浏览器里同一模块两份实例；tests/seed-report-panel.test.mjs 从 worker-adapters.js 现读版本号来比，别人再改版本号时测试会红。
 */
import { VERIFY_METRICS, verificationMetrics, verificationScore, notRunReport, seedReport } from './seed-report.js?v=seeds-r61';

const rng = (seed) => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const APPLIED = { key: 'applied', label: '执行了的能力', unit: '个', better: 'higher' };
const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

/** 「扫描 → 预装全部能匹配的能力 → 执行 → 独立验证」一遍（战役 / 表现层 / 十二门徒地形共用；三层的 matchAll / runPlan / verify 形状相同）。 */
function siteRun(m, verify, site, extra = () => ({})) {
  const steps = m.matchAll(site).filter((r) => r.count > 0).map((r) => ({ id: r.id, params: {} }));
  const report = m.runPlan(site, steps), v = verify(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) });
  return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), applied: report.filter((r) => r.status === 'applied').length, ...extra(site, report, v) } };
}

/* ---------------------------------------------------------------- 合成输入（只给没有噪声种子的层用） */
export function battleFixture(s) {
  const R = rng(s), cells = 2400 + Math.floor(R() * 2400);
  return { scene: { id: 'synthetic', label: '合成舞台 #' + s }, meshes: 1, cells, land: 30 + Math.floor(R() * 420), maxLevel: 2 + Math.floor(R() * 8), houses: Math.floor(R() * 7), scale: 3 + Math.floor(R() * 5), gridRadius: 12 + Math.floor(R() * 10), unitHeight: 1.7, plateauRaised: 0 };
}
export function fxFixture(s) {
  const R = rng(s), n = 120 + Math.floor(R() * 160), g = [], r0 = 6 + R() * 8, wob = 3 + R() * 7;
  for (let i = 0; i < n; i++) { const a = i * 2.4, r = r0 + wob * Math.sin(i * (0.4 + R() * 0.6)); g.push([Math.cos(a) * r + (R() - 0.5) * 4, Math.sin(a) * r + (R() - 0.5) * 4, 1 + Math.floor(R() * 4), R() < 0.03 ? 1 : 0]); }
  return { scene: { id: 'synthetic', label: '合成舞台 #' + s }, scale: 5, unitHeight: 1.7, land: g.length, maxLevel: 4, houses: g.filter((x) => x[3]).length, grid: g };
}
export function apostlesFixture(s) {
  const R = rng(s), mk = (id, order) => {
    const n = 18 + Math.floor(R() * 10), xz = [], lv = [], edges = [], c = n / 2, rad = c - 1 - R() * 2, stepK = R() < 0.5 ? 1 : 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i - c, z = j - c, r = Math.hypot(x, z); xz.push(x, z); lv.push(r > rad ? 0 : stepK === 1 ? 1 + Math.floor((rad - r) / 1.5) : 1 + 2 * Math.floor((rad - r) / 3)); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n + i; for (const b of [i + 1 < n ? a + 1 : -1, j + 1 < n ? a + n : -1]) if (b >= 0 && lv[a] > 0 && lv[b] > 0) edges.push(a, b); }
    const hue = Math.floor(R() * 60), top = '#' + [150 + hue, 180, 90].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('');
    return { id, order, seed: 7300 + order * 101, spire: false, scale: 2.1, xz, lv, edges, colors: { top, wall: '#d8d2c2' } };
  };
  return { ok: true, scene: 'apostles', look: { id: 'approved', soft: false, palette: false }, masses: [mk('front-left', 3), mk('back-right', 1)] };
}
export function materialsFixture(s) {
  const R = rng(s), k = 8 + Math.floor(R() * 14), hex = () => '#' + [0, 0, 0].map(() => Math.floor(40 + R() * 200).toString(16).padStart(2, '0')).join('');
  return Array.from({ length: k }, (_, i) => { const c = hex(); return { id: 'm' + i, name: '材质' + i, base: c, color: c, uses: 1 + Math.floor(R() * 40), locked: false }; });
}
export function objectsFixture(s) {
  const R = rng(s), E = { dx: 0, dy: 0, dz: 0, ry: 0, s: 1, hidden: false }, kinds = ['plane-tree', 'lamp', 'bench'], n = 8 + Math.floor(R() * 16);
  return Array.from({ length: n }, (_, i) => { const kind = kinds[i % kinds.length]; return { id: kind + ':' + i, kind, x: R() * 6, z: R() * 6, r: 0.3 + R() * 0.3, edit: { ...E }, locked: false }; });
}

/** 建筑层合成场地（R-B1）：tests/lib/building-fixtures.mjs terraceField 的种子化版本——岛 + 两级台地 + 老城块 + 轨道，位置 / 高差随 s 变。 */
export function buildingField(s, { n = 61, step = 3 } = {}) {
  const R = rng(s), half = (n - 1) * step / 2, N = n * n, h = new Array(N), cls = new Array(N).fill(0);
  const highR = half * (0.3 + R() * 0.12), highK = 4 + Math.floor(R() * 5), slopeK = R() < 0.5 ? 0.02 : 0.035, rot = R() * Math.PI;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = i * step - half, z0 = j * step - half, x = x0 * Math.cos(rot) - z0 * Math.sin(rot), z = x0 * Math.sin(rot) + z0 * Math.cos(rot);
    const r = Math.hypot(x, z), q = j * n + i;
    h[q] = r > half * 0.92 ? 0 : Math.round((3.5 + slopeK * x + (r < highR ? highK : 0)) * 100) / 100;
  }
  const bw = 5 + Math.floor(R() * 4), bh = 5 + Math.floor(R() * 4), bx = Math.floor(n * (0.15 + R() * 0.3)), bz = Math.floor(n * (0.3 + R() * 0.3));
  for (let j = bz; j < bz + bh && j < n; j++) for (let i = bx; i < bx + bw && i < n; i++) cls[j * n + i] = 1;
  const rj = n - 8 - Math.floor(R() * 10), ri1 = Math.min(n - 4, rj + 8 + Math.floor(R() * 10));
  for (let i = 4; i <= ri1 && i < n; i++) cls[rj * n + i] = 2;
  return { n, step, half, h, cls, sea: 0.3 };
}
export const buildingSiteFixture = (s) => ({ scene: { id: 'seed-site', label: '合成台地 #' + s }, field: buildingField(s), terrain: 'original' });

/* ---------------------------------------------------------------- 登记表 */
export const LAYERS = [
  { layer: 'mountain', label: '山形', ownPanel: '山形验收台 R28 已有 30 种子面板（实景采样）；这里是同一套算法在擂台岛上的 Node 版',
    inputLabel: '擂台测试岛 arenaIsland(20261123)', seedMeaning: 'massif.seed = s、rolling.seed = 37s mod 1000，其余默认（同 R28）',
    load: async () => {
      const [S, A] = await Promise.all([import('./mountain/seeds.js?v=seeds-r28'), import('./mountain/arena.js?v=arena-r26')]);
      return { metrics: S.SEED_METRICS, fixture: () => A.arenaIsland(A.ARENA_SEED), runSeed: (field, seed) => { const [r] = [...S.runSeeds(field, { count: 1, from: seed })]; return r; } };
    } },
  { layer: 'lightlife', label: '光影与生命', inputLabel: '合成岛 syntheticSite(s)（28×28 格，地形 + 房子 + 植物）', seedMeaning: '合成岛种子 s；9 个能力默认参数全跑',
    load: async () => {
      const [C, V, X] = await Promise.all([import('./lightlife/capabilities.js?v=light-r66'), import('./lightlife/verify.js?v=light-r66'), import('./lightlife/scene-voxels.js?v=light-r65')]);
      return { metrics: [...VERIFY_METRICS, ...C.LIGHTLIFE_SEED_METRICS], fixture: () => null,
        runSeed: (input, s) => { const site = input ? { ...clone(input), seed: s } : X.syntheticSite(s); const steps = C.LIGHTLIFE_CAPABILITIES.map((c) => ({ id: c.meta.id, params: {} })); const report = C.runPlan(site, steps); const v = V.verifyLightLife(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }); return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), ...C.seedMetricsOf(site.plan) } }; } };
    } },
  { layer: 'battle', label: '战役', inputLabel: '合成舞台 battleFixture(s)', seedMeaning: '种子 s 生成舞台采样（陆地 / 层数 / 小屋数）；预装全部能匹配的能力',
    load: async () => { const [M, V] = await Promise.all([import('./battle/capabilities.js?v=contract-r2'), import('./battle/verify.js?v=nav-r1')]); return { metrics: [...VERIFY_METRICS, APPLIED], fixture: () => null, runSeed: (_, s) => siteRun(M, V.verifyBattle, battleFixture(s)) }; } },
  { layer: 'fx', label: '表现层', inputLabel: '合成舞台格网 fxFixture(s)', seedMeaning: '种子 s 生成舞台格网；预装全部能匹配的能力',
    load: async () => { const [M, V] = await Promise.all([import('./fx/capabilities.js?v=fx-meta-r1'), import('./fx/verify.js?v=fxe-r1')]); return { metrics: [...VERIFY_METRICS, APPLIED], fixture: () => null, runSeed: (_, s) => { const site = fxFixture(s); return siteRun({ matchAll: M.matchAll, runPlan: (x, steps) => { x.pipelineSteps = steps.map((t) => t.id); return M.runPlan(x, steps); } }, V.verifyFx, site); } }; } },
  { layer: 'apostles-terrain', label: '十二门徒地形', inputLabel: '合成岩体 apostlesFixture(s)（两块）', seedMeaning: '种子 s 生成两块岩体的台阶与顶面色',
    load: async () => { const [M, V] = await Promise.all([import('./apostles-terrain/capabilities.js?v=contract-r2'), import('./apostles-terrain/verify.js?v=apt-r1')]); return { metrics: [...VERIFY_METRICS, APPLIED, { key: 'meltable', label: '可融台阶占比', unit: '%', better: 'higher' }], fixture: () => null, runSeed: (_, s) => siteRun(M, V.verifyApostlesTerrain, apostlesFixture(s), (site) => ({ meltable: site.plan?.metrics?.soft?.total?.meltable ?? null })) }; } },
  { layer: 'gscene', label: '通用场景', inputLabel: '合成材质表 materialsFixture(s)', seedMeaning: '种子 s 生成 8–21 种材质颜色与使用次数',
    load: async () => {
      const [M, V] = await Promise.all([import('./gscene/capabilities.js?v=contract-r2'), import('./gscene/verify.js?v=contract-r1')]);
      return { metrics: [...VERIFY_METRICS, APPLIED, { key: 'recolored', label: '改了色的材质', unit: '个', better: 'none' }], fixture: () => null,
        runSeed: (_, s) => { const mats = materialsFixture(s), steps = M.matchGscene(mats).filter((r) => r.count > 0).map((r) => ({ id: r.id, params: {} })), out = M.runGscenePlan(mats, steps), v = V.verifyGscene(mats, out.colors, { steps: out.report }); return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), applied: out.report.filter((r) => r.status === 'applied').length, recolored: Object.keys(out.colors).length } }; } };
    } },
  { layer: 'object', label: '物件', inputLabel: '合成物件摆放 objectsFixture(s)', seedMeaning: '种子 s 生成 8–23 个物件的位置与半径',
    load: async () => {
      const [M, V] = await Promise.all([import('./object/capabilities.js?v=contract-r2'), import('./object/verify.js')]);
      return { metrics: [...VERIFY_METRICS, APPLIED, { key: 'edited', label: '动了的物件', unit: '个', better: 'none' }], fixture: () => null,
        runSeed: (_, s) => { const L = objectsFixture(s), steps = M.matchObjects(L).filter((r) => r.count > 0).map((r) => ({ id: r.id, params: {} })), out = M.runObjectPlan(L, steps), v = V.verifyObjects(L, out.edits, { steps: out.report.map((r) => ({ id: r.id, params: r.params })) }); return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), applied: out.report.filter((r) => r.status === 'applied').length, edited: Object.keys(out.edits).length } }; } };
    } },
  { layer: 'planet', label: '球系统', inputLabel: 'DEFAULT_PLANET_RECIPE（64×32 采样）', seedMeaning: '配方 seed = s，其余默认；不加能力步骤（看编译管线本身的范围）',
    load: async () => {
      const [M, S, V] = await Promise.all([import('./planet/capabilities.js?v=contract-r3'), import('./planet/summarize.js?v=sys-r15'), import('./planet/verify.js?v=sys-r15')]);
      return { metrics: [...VERIFY_METRICS, { key: 'land', label: '陆地占比', unit: '%', better: 'none' }, { key: 'forest', label: '森林占比', unit: '%', better: 'none' }, { key: 'rock', label: '岩石占比', unit: '%', better: 'none' }, { key: 'lakes', label: '湖', unit: '个', better: 'none' }], fixture: () => null,
        runSeed: (_, s) => { const recipe = { ...M.DEFAULT_PLANET_RECIPE, seed: s }, a = S.compileAndSummarize(recipe, { W: 64, H: 32 }), v = V.verifyPlanet(a, a, a.ok ? S.compileAndSummarize(recipe, { W: 8, H: 4 }) : null); return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), land: a.stats?.land ?? null, forest: a.stats?.forest ?? null, rock: a.stats?.rock ?? null, lakes: a.stats?.lakes ?? null } }; } };
    } },
  { layer: 'relief', label: '地貌', inputLabel: 'arenaSite(s) 测试岛（61×61 格 × 3 m）', seedMeaning: '种子 s 生成测试岛（terrain/arena-generic.js，同擂台考场）；预装全部 6 个地貌能力',
    load: async () => {
      const [M, V, A] = await Promise.all([import('./relief/capabilities.js?v=relief-r2'), import('./relief/verify.js?v=relief-r2'), import('./terrain/arena-generic.js?v=arena-r1')]);
      const RELIEF_METRICS = [
        { key: 'cliff', label: '竖崖占比', unit: '%', better: 'lower' }, { key: 'midSlope', label: '中等坡占比', unit: '%', better: 'higher' },
        { key: 'flat', label: '平地占比', unit: '%', better: 'none' }, { key: 'drainage', label: '排水率', unit: '%', better: 'higher' },
        { key: 'pits', label: '排不出去的坑', unit: '格', better: 'lower' }, { key: 'hardEdge', label: '硬边位移', unit: 'm', better: 'lower' },
        { key: 'overhang', label: '岩檐占比', unit: '%', better: 'none' }, { key: 'reach', label: '最大可走连通片', unit: '%', better: 'higher' },
        { key: 'climb', label: '可爬占比', unit: '%', better: 'higher' }, { key: 'contour', label: '等高线在格边', unit: '%', better: 'higher' }];
      return { metrics: [...VERIFY_METRICS, APPLIED, ...RELIEF_METRICS], fixture: () => null,
        runSeed: (_, s) => { const site = A.arenaSite(s); return siteRun(M, V.verifyRelief, site, (x, r, v) => ({ ...(v.metrics || {}) })); } };
    } },
  { layer: 'building', label: '建筑', inputLabel: '合成台地场地 buildingField(s)（61×61 × 3 m：岛 + 两级台地 + 老城块 + 轨道）', seedMeaning: '种子 s 生成场地（台地高差 / 老城位置 / 轨道走向）；预装选址 + prefab + 联合 WFC',
    load: async () => {
      const [M, V] = await Promise.all([import('./building/capabilities.js?v=building-r2'), import('./building/verify.js?v=building-r1')]);
      return { metrics: [...VERIFY_METRICS, APPLIED, { key: 'buildings', label: '摆出的建筑', unit: '栋', better: 'higher' }, { key: 'roads', label: '路段', unit: '格', better: 'none' }], fixture: () => null,
        runSeed: (_, s) => { const site = buildingSiteFixture(s); const steps = M.matchAll(site).filter((r) => r.count > 0).map((r) => ({ id: r.id, params: {} })), report = M.runPlan(site, steps), v = V.verifyBuilding(site.field, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }); return { score: verificationScore(v), status: v.status, metrics: { ...verificationMetrics(v), applied: report.filter((r) => r.status === 'applied').length, buildings: site.plan?.layout?.placements?.length ?? 0, roads: site.plan?.layout?.roads?.length ?? site.plan?.layout?.roadCount ?? null } }; } };
    } },
  { layer: 'scene', label: '场景（体素）', notRun: '输入是游戏 iframe 里莫西斯湖的体素世界（agent/world-cache.js 经 rea() 用浏览器地址加载能力注册表），Node 里没有这份输入，也还没有合成夹具；浏览器里只看单次结果。' },
];
export const SEED_LAYER_IDS = LAYERS.map((l) => l.layer);
export const seedLayerFor = (key) => LAYERS.find((l) => l.layer === key) || null;

/** 载入一层的适配器（带 layer / label / inputLabel / seedMeaning）；跑不了的层返回 null。 */
export async function loadSeedAdapter(key) {
  const L = seedLayerFor(key); if (!L || L.notRun) return null;
  const a = await L.load();
  return { layer: L.layer, label: L.label, inputLabel: L.inputLabel, seedMeaning: L.seedMeaning, ownPanel: L.ownPanel || null, ...a };
}
/** 一层跑一份完整报告（Node 命令行与测试用；浏览器里分布面板在 Worker 里逐个跑）。input 不给 = 用这层的合成 / 擂台输入。 */
export async function layerSeedReport(key, { count, from, input } = {}) {
  const L = seedLayerFor(key);
  if (!L) return notRunReport({ layer: key, label: key, reason: '这一层还没有登记分布适配器（src/system-workshop/seed-layers.js LAYERS）', blocked: true });
  if (L.notRun) return notRunReport({ layer: L.layer, label: L.label, reason: L.notRun });
  let a;
  try { a = await loadSeedAdapter(key); } catch (e) { return notRunReport({ layer: L.layer, label: L.label, reason: '依赖载入失败：' + (e?.message || e), blocked: true }); }
  const fx = input ?? a.fixture();
  return seedReport(a, fx, { count, from, inputLabel: input ? '调用方给的输入' : a.inputLabel });
}
