/**
 * catalog-build.js — 系统工坊能力目录的构建逻辑（Node 脚本与浏览器「扫描能力库」共用）。
 *   输入：REACode / REACodeRefactoring 的 learn 数据 + 重构审计 + 能力代码描述（describeCapabilities）
 *   输出：三层工坊、各分区的节点；每个节点取能拿到的最好执行档（code > refactored > partial > original > reference）
 */
// ---- 分区定义（与规划文档「系统工坊结构」一致）
export const WORKSHOPS = [
  { id: 'planet', name: '球系统工坊', target: '星球快照', domains: [
    ['grid', '球体与网格'], ['light', '光照与时间'], ['terrain', '地形'], ['water', '水'], ['weather', '天气'], ['vegetation', '植被'],
    ['transport', '交通'], ['building', '建筑'], ['vehicle', '载具'], ['activity', '活动'], ['style', '风格基线']] },
  { id: 'scene', name: '场景工坊', target: '场景 World', domains: [
    ['style', '风格'], ['terrain', '特定的地形'], ['water', '特定的水'], ['atmosphere', '光照与氛围'], ['building', '特定的建筑'],
    ['vehicle', '特定的载具'], ['activity', '特定的活动'], ['camera', '镜头与构图']] },
  { id: 'object', name: '物件工坊', target: '单个物件（人物也是物件）', domains: [
    ['style', '风格'], ['model', '特有模型'], ['interaction', '特有互动'], ['variant', '变体与状态'], ['placement', '放置规则'], ['performance', '性能']] },
];

const T = (re) => (s) => re.test(s);
const is = {
  weather: T(/雪|风场|风向|wind|雾|fog|云|cloud|雨|rain|闪电|lightning|天气|atmosphere/i),
  vehicle: T(/船|boat|ship|wake|尾迹|车|tram|train|飞艇|airship|aircraft|载具/i),
  transport: T(/左行|traffic|会车|走廊|道路|road|铁路|rail|运河|canal|航线|河流导航|river-nav|路径|path/i),
  camera: T(/镜头|camera|透视|perspective|motion ?blur|拖影|smear|构图|转镜/i),
  perf: T(/impostor|atlas|图集|合批|batch|实例化|instanc|LOD|mip|剔除|cull|性能|draw call/i),
  variant: T(/变体|variant|季节|season|损毁|随机.{0,4}(颜色|造型)|多样/i),
  placement: T(/放置|落点|place|scatter|分布|摆放|沿.{0,3}(边|岸|墙)|墙根|岸边|路边/i),
  model: T(/树冠|树干|叶|房|屋顶|窗|门|塔|模型|造型|mesh|model|portrait|头像|旗|banner|sprite|精灵|士兵|单位/i),
  interaction: T(/战斗|攻击|击退|弓|箭|矛|血|squad|小队|互动|交互|对话|点击|选择|interact|dialog/i),
};
function domainOf(it) {
  const s = `${it.text} ${it.note} ${it.where}`;
  if (it.topic === 'show') return is.camera(s) ? 'camera' : null;
  if (is.weather(s)) return 'weather';
  if (is.vehicle(s)) return 'vehicle';
  if (is.transport(s) && it.topic !== 'grid') return 'transport';
  if (is.camera(s) && it.topic !== 'grid') return 'camera';
  return { grid: 'grid', light: 'light', terrain: 'terrain', water: 'water', build: 'building', life: 'vegetation', texture: 'style', fx: 'activity', tools: 'tools' }[it.topic] || null;
}
/** 一个能力可以出现在多个工坊（方法复用，作用范围不同） */
function placements(dom, s) {
  const p = [];
  const add = (w, d) => p.push([w, d]);
  switch (dom) {
    case 'grid': add('planet', 'grid'); break;
    case 'light': add('planet', 'light'); add('scene', 'atmosphere'); break;
    case 'weather': add('planet', 'weather'); add('scene', 'atmosphere'); break;
    case 'terrain': add('planet', 'terrain'); add('scene', 'terrain'); break;
    case 'water': add('planet', 'water'); add('scene', 'water'); break;
    case 'vegetation': add('planet', 'vegetation'); if (is.model(s)) add('object', 'model'); break;
    case 'transport': add('planet', 'transport'); break;
    case 'building': add('planet', 'building'); add('scene', 'building'); if (is.model(s)) add('object', 'model'); break;
    case 'vehicle': add('planet', 'vehicle'); add('scene', 'vehicle'); add('object', 'model'); break;
    case 'activity': add('planet', 'activity'); add('scene', 'activity'); if (is.interaction(s)) add('object', 'interaction'); if (is.model(s)) add('object', 'model'); break;
    case 'style': add('planet', 'style'); add('scene', 'style'); add('object', 'style'); break;
    case 'camera': add('scene', 'camera'); break;
  }
  if (is.perf(s)) add('object', 'performance');
  if (is.variant(s)) add('object', 'variant');
  if (is.placement(s) && (dom === 'vegetation' || dom === 'building' || dom === 'activity')) add('object', 'placement');
  return p;
}

export function buildCatalog({ orig, ref, refStatus = {}, codeCaps = [] }) {
const refById = new Map(ref.items.map((i) => [i.id, i]));
const codeById = new Map();
for (const c of codeCaps) for (const id of c.sources || []) { if (!codeById.has(id)) codeById.set(id, []); codeById.get(id).push(c.id); }
const ids = new Set([...orig.items.map((i) => i.id), ...ref.items.map((i) => i.id)]);
const origById = new Map(orig.items.map((i) => [i.id, i]));
const nodes = [];
for (const id of ids) {
  const o = origById.get(id), r = refById.get(id), it = r || o;
  if (!it || it.status === 'na' || o?.status === 'na') continue;
  const dom = domainOf(it);
  if (!dom) continue;
  const s = `${it.text} ${it.note} ${it.where}`;
  const code = codeById.get(id) || [];
  const exec = code.length ? 'code' : r?.status === 'done' ? 'refactored' : r?.status === 'partial' ? 'partial' : o && ['game', 'engine', 'both', 'partial'].includes(o.status) ? 'original' : 'reference';
  const node = {
    id, domain: dom, exec, title: (r?.note || o?.note || it.text).replace(/\s+/g, ' ').slice(0, 80), text: it.text.slice(0, 200), date: it.date, project: it.project,
    original: o ? { status: o.status, label: orig.labels[o.status], where: o.where || '' } : null,
    refactored: r ? { status: r.status, label: ref.labels?.[r.status] || r.status, where: r.where || '', audit: refStatus[id] || '' } : null,
    code,
  };
  for (const [w, d] of placements(dom, s)) nodes.push({ ...node, workshop: w, slot: d });
}
// 工具类：三层共用
const shared = [];
for (const id of ids) { const it = refById.get(id) || origById.get(id); if (it && it.status !== 'na' && domainOf(it) === 'tools') shared.push({ id, title: (it.note || it.text).slice(0, 80) }); }

return {
  generatedAt: new Date().toISOString(),
  sources: { original: { items: orig.items.length, page: 'http://localhost:8765/learn.html' }, refactored: { items: ref.items.length, page: 'http://localhost:8769/learn.html' }, codeCapabilities: codeCaps.length },
  workshops: WORKSHOPS.map((w) => ({ ...w, domains: w.domains.map(([id, name]) => {
    const rows = nodes.filter((n) => n.workshop === w.id && n.slot === id).sort((a, b) => ['code', 'refactored', 'partial', 'original', 'reference'].indexOf(a.exec) - ['code', 'refactored', 'partial', 'original', 'reference'].indexOf(b.exec) || b.date.localeCompare(a.date));
    const count = (e) => rows.filter((n) => n.exec === e).length;
    return { id, name, counts: { total: rows.length, code: count('code'), refactored: count('refactored'), partial: count('partial'), original: count('original'), reference: count('reference') }, nodes: rows.map(({ workshop, slot, ...n }) => n) };
  }) })),
  shared,
};
}
