/**
 * auto-assemble.js — R53 按目标自动拼管线（Guide 创新 2 的后半：给一个目标，系统沿契约自己拼出管线）。纯逻辑，Node 测试与浏览器共用。
 * 扩展 R22 的 auto-preload.js（不重写它）：没有目标时原样走 planPreload（按场景 match + requires 预装）；
 * 有目标时：
 *   ① 目标文字 → 想要的资源（GOAL_RULES）+ 关键词直接命中的能力；
 *   ② 每个想要的资源找「写它」的能力（优先关键词命中的；都没命中取登记顺序第一个），拉进来；
 *   ③ 闭包：被拉进来的能力的 requires 拉进来；它读的资源如果扫描不给，就去拉写这个资源的能力；
 *   ④ 排序：requires 边 + 「写 → 读」边做拓扑排序。先后次序 = 层顺序（调用方给的 layers 顺序）+ 层内登记顺序；
 *      「写 → 读」边只从次序在前的写者连到次序在后的读者（次序在前的读者读的是扫描原样，例如保护带读原高度场）
 *      ——所以「山形改高度场」一定排在「建筑选址读高度场」前面，这就是「地形 → 建筑」两段管线；
 *   ⑤ 每一步记下是哪条契约链接把它拉进来的（reasoning），页面原样显示。
 * 只拼计划，不执行、不写任何存档；装进各层管线由 auto-assemble-panel.js 调各层工坊的 add 完成。
 */
import { planPreload } from './auto-preload.js?v=preload-r1';
import { contractOf, RESOURCES, LAYER_INPUTS, LAYER_NAMES, SCENE_LAYERS } from './contracts.js?v=contract-r1';

export const GOAL_RULES = Object.freeze([
  { re: /建筑|房子|房屋|屋|楼|城镇|聚落|街区|村|镇|宅|教堂|礼拜堂|building|house|town/i, resources: ['buildingLayout'], label: '建筑群' },
  { re: /道路|路网|街道|小路|road/i, resources: ['roadNetwork'], label: '路网' },
  { re: /山|峰|山脊|地形|坡|隆起|侵蚀|沟谷|高原|mountain|terrain/i, resources: ['heightfield'], label: '山形 / 地形' },
  { re: /战役|战斗|登陆|守军|来袭|波次|battle/i, resources: ['waves'], label: '战役' },
  { re: /前线|分区|战役图/, resources: ['frontier'], label: '前线' },
  { re: /镜头|运镜|机位|camera/i, resources: ['cameraPath'], label: '镜头' },
  { re: /配色|颜色|色调|调色|palette/i, resources: ['palette'], label: '配色' },
  { re: /海面|海浪|白沫|浪花/, resources: ['seaLook'], label: '海面' },
  { re: /天气|雾|雪|云|风/, resources: ['weather'], label: '天气' },
  { re: /光照|阴影|黄昏|夜晚|日光/, resources: ['lighting'], label: '光照' },
  { re: /物件|间距|摆放|排布/, resources: ['objectLayout'], label: '物件排布' },
]);

/** 目标文字 → [{ resource, label, word }]（同一资源只记一次）。 */
export function parseGoal(text) {
  const t = String(text || ''), out = [], seen = new Set();
  for (const r of GOAL_RULES) { const m = t.match(r.re); if (!m) continue; for (const res of r.resources) if (!seen.has(res)) { seen.add(res); out.push({ resource: res, label: r.label, word: m[0] }); } }
  return out;
}
const kwHits = (c, text) => { const t = String(text || '').toLowerCase(); return (c.keywords || []).filter((k) => k && k.length >= 1 && t.includes(String(k).toLowerCase())); };
const R = (r) => RESOURCES[r] || r, N = (c) => `${c.name}（${c.id}）`;

/**
 * layers = [{ id, name?, caps:[meta…] }]（只放本场景能跑的层；不给就按 SCENE_LAYERS[sceneId] 由调用方筛）。
 * scans = { 层: scan }（可缺），pipes = { 层: 管线草稿 }（无目标时传给 planPreload）。
 * 返回 { ok, mode:'goal'|'preload'|'preload-fallback', steps:[{ layer, id, name, why:[…] }], stages:[{ layer, name, ids }], links, reasoning, unmet, wants }
 */
export function assemblePipeline({ goal = '', sceneId = null, layers = [], scans = {}, pipes = {} } = {}) {
  const order = layers.map((L) => L.id), all = [], byId = new Map();
  layers.forEach((L, li) => (L.caps || []).forEach((m, ci) => { const c = { ...contractOf(m, L.id), li, ci }; all.push(c); byId.set(c.id, c); }));
  const reasoning = [], say = (kind, text, extra = {}) => reasoning.push({ ...extra, kind, text });
  const preload = (why) => {
    const stages = [];
    // 拼的是一条新管线：不看现有节点（R22 的「已有节点不动」由装入时的备份 / 撤销保证）
    for (const L of layers) { const p = planPreload({ nodes: [] }, scans[L.id], L.caps || [], { force: true }); if (p.ids.length) stages.push({ layer: L.id, name: L.name || LAYER_NAMES[L.id] || L.id, ids: p.ids }); }
    say('preload', why + (stages.length ? '：' + stages.map((s) => `${s.name} ${s.ids.length} 个`).join('、') : '：扫描里没有能作用的能力（或还没扫描）'));
    const steps = stages.flatMap((s) => s.ids.map((id) => ({ layer: s.layer, id, name: byId.get(id)?.name || id, why: ['R22 按场景预装'] })));
    return { ok: steps.length > 0, mode: goal.trim() ? 'preload-fallback' : 'preload', goal, sceneId, wants: [], steps, stages, links: [], reasoning, unmet: [] };
  };
  if (!String(goal).trim()) return preload('没有写目标：沿用 R22「按场景预装」（扫描里有对象的能力 + 它们的 requires）');

  const wants = parseGoal(goal), pulled = new Map(), unmet = [];
  const pull = (c, why) => { if (!pulled.has(c.id)) pulled.set(c.id, []); pulled.get(c.id).push(why); };
  const matchCount = (c) => { const m = scans[c.layer]?.matches?.find((x) => x.id === c.id); return m ? m.count : null; };
  // ① 关键词直接命中
  for (const c of all) { const h = kwHits(c, goal); if (h.length) { pull(c, `目标里有「${h.slice(0, 3).join('、')}」= ${c.name} 的关键词`); say('keyword', `目标里的「${h[0]}」→ 直接拉进 ${N(c)}`, { to: c.id }); } }
  // ② 想要的资源 → 写它的能力
  for (const w of wants) {
    const writers = all.filter((c) => c.writes.includes(w.resource));
    if (!writers.length) { unmet.push({ resource: w.resource, text: `目标要「${R(w.resource)}」（因为「${w.word}」），但本场景能跑的层里没有能写它的能力` }); say('unmet', unmet.at(-1).text, { resource: w.resource }); continue; }
    const already = writers.filter((c) => pulled.has(c.id)), hit = writers.filter((c) => kwHits(c, goal).length);
    // 读写同一资源的能力是链式生产（上一步的产出喂给下一步，如 mountain.massif → erode → rolling → talus）：
    // 只拉一个链节，产出就是半成品（实景上 massif 单跑竖崖占比 40% 过不了山形验证）——要资源就把整条链拉进来。
    const chain = writers.filter((c) => c.reads.includes(w.resource));
    const pick = chain.length ? chain : already.length ? already : hit.length ? hit : [writers.find((c) => !c.reads.includes(w.resource)) || writers[0]];
    for (const c of pick) { pull(c, `目标要「${R(w.resource)}」，它写「${R(w.resource)}」`); say('goal', `目标「${w.word}」→ 要「${R(w.resource)}」→ ${N(c)} 写它`, { to: c.id, resource: w.resource }); }
  }
  if (!pulled.size) return preload(`目标「${goal}」里没认出要什么（资源词或能力关键词都没命中），改用 R22 按场景预装`);
  // ③ 闭包：requires 与读
  const queue = [...pulled.keys()];
  while (queue.length) {
    const c = byId.get(queue.shift());
    for (const q of c.requires) { const r = byId.get(q); if (!r) { unmet.push({ resource: null, text: `${N(c)} 需要 ${q}，但它不在本场景能跑的层里` }); continue; } if (!pulled.has(q)) { pull(r, `${c.name} 的 requires`); say('requires', `${N(c)} requires → ${N(r)}`, { from: q, to: c.id }); queue.push(q); } }
    for (const res of c.reads) {
      if ((LAYER_INPUTS[c.layer] || []).includes(res)) continue;          // 扫描直接给
      const have = [...pulled.keys()].some((id) => id !== c.id && byId.get(id).writes.includes(res)); if (have) continue;
      const ws = all.filter((x) => x.id !== c.id && x.writes.includes(res)), w = ws.find((x) => x.layer === c.layer) || ws[0];
      if (!w) { unmet.push({ resource: res, text: `${N(c)} 读「${R(res)}」，但扫描不给、也没有能力写它` }); say('unmet', unmet.at(-1).text, { to: c.id, resource: res }); continue; }
      pull(w, `${c.name} 读「${R(res)}」，它写`); say('reads', `${N(c)} 读「${R(res)}」← ${N(w)} 写它`, { from: w.id, to: c.id, resource: res }); queue.push(w.id);
    }
  }
  // ④ 依赖边与拓扑排序
  const ids = [...pulled.keys()], set = new Set(ids), edges = new Map(ids.map((id) => [id, new Set()])), links = [];
  const rank = (id) => { const c = byId.get(id); return c.li * 1000 + c.ci; };
  const edge = (a, b, kind, resource) => { if (a === b || !set.has(a) || !set.has(b) || edges.get(a).has(b)) return; edges.get(a).add(b); links.push({ from: a, to: b, kind, resource: resource || null }); };
  for (const id of ids) for (const q of byId.get(id).requires) edge(q, id, 'requires');
  const resources = new Set(ids.flatMap((id) => [...byId.get(id).reads, ...byId.get(id).writes]));
  for (const res of resources) {
    const ws = ids.filter((id) => byId.get(id).writes.includes(res)).sort((a, b) => rank(a) - rank(b)); if (!ws.length) continue;
    for (const id of ids) { if (!byId.get(id).reads.includes(res)) continue; for (const w of ws) if (rank(w) < rank(id)) edge(w, id, 'writes→reads', res); }
  }
  const indeg = new Map(ids.map((id) => [id, 0])); for (const [, s] of edges) for (const b of s) indeg.set(b, indeg.get(b) + 1);
  const ready = ids.filter((id) => !indeg.get(id)).sort((a, b) => rank(a) - rank(b)), sorted = [];
  while (ready.length) { const id = ready.shift(); sorted.push(id); for (const b of edges.get(id)) { indeg.set(b, indeg.get(b) - 1); if (!indeg.get(b)) { ready.push(b); ready.sort((x, y) => rank(x) - rank(y)); } } }
  if (sorted.length !== ids.length) { const left = ids.filter((id) => !sorted.includes(id)); say('cycle', '契约成环，排不出顺序：' + left.join('、')); return { ok: false, mode: 'goal', goal, sceneId, wants, steps: [], stages: [], links, reasoning, unmet: [...unmet, { resource: null, text: '契约成环：' + left.join('、') }] }; }
  // 跨层的「写 → 读」：这就是两段管线的接缝，单独说一句
  for (const l of links) if (l.kind === 'writes→reads' && byId.get(l.from).layer !== byId.get(l.to).layer && l.from === lastWriter(links, l.to, l.resource, sorted)) say('order', `${LAYER_NAMES[byId.get(l.from).layer] || byId.get(l.from).layer} → ${LAYER_NAMES[byId.get(l.to).layer] || byId.get(l.to).layer}：${N(byId.get(l.to))} 读的「${R(l.resource)}」用 ${N(byId.get(l.from))} 改过的，所以排在它后面`, l);
  const steps = sorted.map((id) => { const c = byId.get(id), m = matchCount(c); return { layer: c.layer, id, name: c.name, why: pulled.get(id), ...(m === 0 ? { warn: '扫描里没有可作用对象' } : {}) }; });
  const stages = []; for (const s of steps) { const last = stages.at(-1); if (last && last.layer === s.layer) last.ids.push(s.id); else stages.push({ layer: s.layer, name: layers.find((L) => L.id === s.layer)?.name || LAYER_NAMES[s.layer] || s.layer, ids: [s.id] }); }
  return { ok: !unmet.length && steps.length > 0, mode: 'goal', goal, sceneId, wants, steps, stages, links, reasoning, unmet };
}
function lastWriter(links, to, res, sorted) { const ws = links.filter((l) => l.to === to && l.resource === res && l.kind === 'writes→reads').map((l) => l.from); return ws.sort((a, b) => sorted.indexOf(b) - sorted.indexOf(a))[0]; }

/** 场景能跑的层（studio 也用它决定面板里能拼哪些层）。 */
export function layersForScene(sceneId, available) {
  const want = SCENE_LAYERS[sceneId] || [];
  return want.map((id) => available.find((L) => L.id === id)).filter((L) => L && (L.caps || []).length);
}

/** 一句话摘要（状态栏 / 卡片标题用）。 */
export function assemblySummary(r) {
  if (!r?.steps?.length) return r?.unmet?.length ? '拼不出管线：' + r.unmet[0].text : '没有能装的能力';
  return (r.mode === 'goal' ? '按目标拼出 ' : '按场景预装 ') + r.steps.length + ' 步：' + r.stages.map((s) => s.name + '（' + s.ids.length + '）').join(' → ');
}
