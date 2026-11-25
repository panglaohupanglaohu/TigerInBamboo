/**
 * contracts.js — R51 统一能力契约（Guide §1.4 创新 2「能力带契约，管线自己拼」）。纯数据 + 纯函数，Node / 浏览器 / Worker 共用。
 *
 * 契约 = 每个能力 meta 上的三样（外加 §5.3 已有的 id / name / domain / line / requires / modules）：
 *   reads     读什么（高度场、陆地遮罩、轨道遮罩、建筑遮罩……，见 RESOURCES）
 *   writes    写什么（同一套资源名）
 *   preserves 保证不动什么（建筑保护带、轨道净空、海岸线……，见 PRESERVES；验证 Worker 的检查项由它生成，见 contract-verify.js）
 * 用法：contractOf(meta) 取一个能力的契约；validateContracts(layers) 查整套契约；auto-assemble.js 沿契约拼管线。
 *
 * 过渡表 OVERLAY：P-R51-01 迁移已完成——mountain / battle / fx 三层能力的契约已全部搬进各自 meta 的 reads / writes / preserves，
 * 表保留为空壳供 contractOf 兼容（contractOf 仍查 OVERLAY[id] 兜底，meta 有字段就用 meta、来源标成 'meta'）。
 */
export const CONTRACT_VERSION = 1;

/** 资源词表：契约里 reads / writes 只能用这些名字。 */
export const RESOURCES = Object.freeze({
  heightfield: '高度场', landMask: '陆地遮罩', buildingMask: '建筑遮罩', railMask: '轨道遮罩', coastline: '海岸线', protectMask: '保护遮罩',
  terrainMesh: '地形网格', terrainLook: '地形外观开关', palette: '配色', materials: '材质', vegetation: '植被',
  buildableMask: '可建遮罩', prefabCatalog: '多格 prefab 目录', buildingLayout: '候选建筑群', roadNetwork: '候选路网',
  battleStage: '战斗舞台', garrison: '守军', waves: '来袭波次', campaignGraph: '战役图', frontier: '前线', cameraPath: '镜头路径', wake: '尾迹', ornament: '装饰', replay: '回放',
  objectLayout: '物件排布', planetRecipe: '星球配方', planetTerrain: '星球地貌', seaLevel: '海平面', seaLook: '海面外观', weather: '天气', lighting: '光照',
  // R65 光影与生命层（lightlife）：虚拟体素空间上的区域图 / 大纹理 / 植物图集 / 风 / 烟 / 小动物
  regionGraph: '区域图', megatexture: '大纹理图集', plantAtlas: '植物图集', wind: '风场', smoke: '烟', animals: '小动物',
  // R37–R39 表现层前沿四条线（fx.fire / fx.hallway / fx.sediment / fx.projectiles）的产出：叠在实景舞台上的效果计划
  fire: '火焰效果', hallway: '走廊样板', sediment: '沉积层带', projectiles: '弹道',
});
/** 保证不动什么：每一项在 contract-verify.js 里有一个通用检查器（没有检查器的会被 validateContracts 报出来）。 */
export const PRESERVES = Object.freeze({
  userBuildings: '已有建筑（含用户搭建）不动', buildingBuffer: '建筑保护带不动', railClearance: '轨道净空', coastline: '海岸线不变',
  userSaves: '不写用户存档', lakeBuildings: '不碰湖上建筑', originalTerrain: '原地形只隐藏不改', sceneAnchors: '场景锚点不被淹', lockedObjects: '手工锁定物件不动',
});
/** 每一层的扫描直接给出的资源（不需要别的能力写）。 */
export const LAYER_INPUTS = Object.freeze({
  mountain: ['heightfield', 'landMask', 'buildingMask', 'railMask', 'coastline'],
  relief: ['heightfield', 'landMask', 'buildingMask', 'railMask', 'coastline'],
  building: ['heightfield', 'landMask', 'buildingMask', 'railMask', 'coastline'],
  'apostles-terrain': ['terrainMesh'],
  battle: ['heightfield', 'landMask', 'buildingMask'],
  fx: ['battleStage'],
  gscene: ['materials'],
  object: ['objectLayout'],
  planet: ['planetRecipe'],
  lightlife: ['heightfield', 'landMask', 'buildingMask', 'palette', 'vegetation'],
});
export const LAYER_NAMES = Object.freeze({ relief: '地貌', mountain: '山形', building: '建筑', 'apostles-terrain': '十二门徒地形', battle: '战役', fx: '表现层', gscene: '通用场景', object: '物件', planet: '球系统', lightlife: '光影与生命' });
/** 场景 → 能跑的层（与 studio.js 的 MOUNTAIN_SCENE_IDS / BATTLE_SCENE_IDS 一致；建筑层 R57/R58 进高山圣城与水晶城）。 */
export const SCENE_LAYERS = Object.freeze({
  citadel: ['mountain', 'building', 'battle', 'fx'], crystal: ['building'], apostles: ['apostles-terrain', 'battle', 'fx'],
  moss: ['relief', 'battle', 'fx'], bookshop: ['battle', 'fx', 'gscene'], planet: ['planet'],
  'old-port': ['relief'],
});

const TERRAIN_KEEP = ['buildingBuffer', 'railClearance', 'coastline'];
/** 过渡表（见文件头）。P-R51-01 已迁空：契约全部进 meta，表保留为空壳供 contractOf 兜底。 */
export const OVERLAY = Object.freeze({});

const arr = (v) => (Array.isArray(v) ? v.map(String) : null);
/** 一个能力的契约。layer 可省（按 id 前缀 / domain 推）。 */
export function contractOf(meta, layer = null) {
  const id = String(meta?.id || ''), has = Array.isArray(meta?.reads) && Array.isArray(meta?.writes) && Array.isArray(meta?.preserves), ov = OVERLAY[id];
  const src = has ? meta : ov || null;
  return {
    id, name: meta?.name || id, layer: layer || layerOf(meta), line: meta?.line || null, domain: meta?.domain || null,
    requires: arr(meta?.requires) || [], modules: arr(meta?.modules) || (arr(meta?.sources) || []).filter((x) => x.includes('REACodeRefactoring/')),
    reads: src ? arr(src.reads) : [], writes: src ? arr(src.writes) : [], preserves: src ? arr(src.preserves) : [],
    keywords: arr(meta?.keywords) || [], does: meta?.does || '', source: has ? 'meta' : ov ? 'overlay' : 'none',
  };
}
export function layerOf(meta) {
  const id = String(meta?.id || ''), pre = id.split('.')[0];
  return { scene: 'gscene', apostles: 'apostles-terrain' }[pre] || (LAYER_INPUTS[pre] ? pre : meta?.domain === 'apostles-terrain' ? 'apostles-terrain' : pre || null);
}

/**
 * 查整套契约。layers = [{ id, caps:[meta…] }]。
 * error：没有契约、用了词表外的资源 / 保护项、requires 指向不存在的能力、读的东西既不是扫描给的也没有任何能力写、§5.3 字段缺失、requires 成环；
 * warn：不写任何东西、改高度场却没声明保护建筑带 / 轨道净空 / 海岸线、没有 modules（树上归不了线）、契约还在过渡表。
 */
export function validateContracts(layers) {
  const all = [], problems = [], add = (id, level, text) => problems.push({ id, level, text });
  for (const L of layers || []) for (const m of L.caps || []) all.push(contractOf(m, L.id));
  const byId = new Map(all.map((c) => [c.id, c])), writers = new Map();
  for (const c of all) for (const r of c.writes) { if (!writers.has(r)) writers.set(r, []); writers.get(r).push(c.id); }
  for (const c of all) {
    const m = ((layers || []).find((L) => L.id === c.layer)?.caps || []).find((x) => x.id === c.id) || {};
    for (const f of ['id', 'name', 'domain', 'line']) if (!m[f]) add(c.id, 'error', `meta 缺 ${f}（Guide §5.3）`);
    if (c.source === 'none') { add(c.id, 'error', '没有契约（reads / writes / preserves 都没声明）'); continue; }
    if (c.source === 'overlay') add(c.id, 'warn', '契约还在过渡表（并行编码区域，待迁进 meta）');
    for (const r of [...c.reads, ...c.writes]) if (!RESOURCES[r]) add(c.id, 'error', `资源「${r}」不在词表里`);
    for (const p of c.preserves) if (!PRESERVES[p]) add(c.id, 'error', `保护项「${p}」不在词表里`);
    for (const q of c.requires) if (!byId.has(q)) add(c.id, 'error', `requires 指向不存在的能力 ${q}`);
    const inputs = LAYER_INPUTS[c.layer] || [];
    for (const r of c.reads) if (!inputs.includes(r) && !(writers.get(r) || []).some((w) => w !== c.id)) add(c.id, 'error', `读「${RESOURCES[r] || r}」，但扫描不给、也没有别的能力写它`);
    if (!c.writes.length) add(c.id, 'warn', '契约里不写任何东西');
    if (c.writes.includes('heightfield')) for (const p of TERRAIN_KEEP) if (!c.preserves.includes(p)) add(c.id, 'warn', `改高度场却没声明「${PRESERVES[p]}」`);
    if (!c.modules.length && !(m.sources || []).length && !(m.modules || []).length) add(c.id, 'warn', '没有 modules / sources（能力树上归不了线）');
  }
  // requires 成环
  const state = new Map(), cyc = (id, path) => { if (state.get(id) === 2) return; if (state.get(id) === 1) { add(id, 'error', 'requires 成环：' + [...path, id].join(' → ')); return; } state.set(id, 1); for (const q of byId.get(id)?.requires || []) if (byId.has(q)) cyc(q, [...path, id]); state.set(id, 2); };
  for (const c of all) cyc(c.id, []);
  const declared = all.filter((c) => c.source !== 'none').length;
  return {
    version: CONTRACT_VERSION, total: all.length, declared, fromMeta: all.filter((c) => c.source === 'meta').length, fromOverlay: all.filter((c) => c.source === 'overlay').length,
    missing: all.filter((c) => c.source === 'none').map((c) => c.id), errors: problems.filter((p) => p.level === 'error').length, warnings: problems.filter((p) => p.level === 'warn').length,
    problems, contracts: all,
  };
}

/** 页面上显示一个契约的一行字。 */
export function contractLine(c) {
  const n = (list, dict) => list.map((x) => dict[x] || x).join('、') || '—';
  return `读 ${n(c.reads, RESOURCES)} · 写 ${n(c.writes, RESOURCES)} · 不动 ${n(c.preserves, PRESERVES)}`;
}
