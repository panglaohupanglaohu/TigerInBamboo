import {PRESET_SETS} from '../system-workshop/capability-sets.js?v=sys-r4';
// A demand is a contract, not a claim that the upstream algorithm is integrated.
export const DEMANDS = [
 {id:'natural',name:'物件自然化',tier:'object',set:'preset:object-natural',pattern:/canopy|vegetation|scatter|relax|impostor/,contract:'布局输入 → 稳定尺寸与朝向 → 间距松弛 → 候选验证',accept:'固定种子可重放；手工锁定不变；作用范围外不变；无新增重叠；根部承托实景复核',next:'补充承托与通路净空验证器，再开放更多物种与模型替换。'},
 {id:'coast',name:'海岸聚落',tier:'scene',set:'preset:scene-coast-life',pattern:/shore|water|lighthouse|smoke|reflection/,contract:'共享 World → 岸线浅水 → 灯塔 → 灯室与炊烟',accept:'编码可恢复；水岸接缝；灯室匹配真实塔顶；显示层关闭可恢复；通路与性能实测',next:'补充组合级岸线与灯塔约束，记录每步命中目标和最终场景验收。'},
 {id:'terrain',name:'可通行岩体',tier:'scene',set:'preset:scene-terrain',pattern:/terrain|cage|arch|tunnel|navigation|navmesh/,contract:'地形候选 → 拱与悬垂 → 隧道 → 承托与通路验收',accept:'几何有限；受保护建筑不变；洞口连通；净空与承托；同机位前后核图',next:'把导航连通与净空检查接入组合验收，不以几何生成成功替代可通行。'},
 {id:'weather',name:'统一海面',tier:'planet',set:'preset:planet-sea-morris',pattern:/shore|waves|reflection|water/,contract:'岸线距离场 → 水色 → 白沫 → 浪带 → 倒影',accept:'原湖面保留；海湾接缝；浪峰水线；开关恢复；全局预算',next:'补齐不同海湾和岸坡的组合验证样例，保留当前人工版本。'}
];
export function buildRoadmap(coverage, capabilities=[]) {
 const modules=coverage?.modules||[];
 return DEMANDS.map(d=>{
  const set=PRESET_SETS[d.tier].find(s=>s.id===d.set);
  const steps=set.items.map(item=>({...item,available:capabilities.some(c=>c.id===item.id),name:capabilities.find(c=>c.id===item.id)?.name||item.id}));
  return {...d,steps,modules:modules.filter(m=>d.pattern.test([m.source,...(m.targets||[])].join(' '))),ready:steps.filter(s=>s.available).length};
 });
}
export function renderRoadmap(host,{coverage,capabilities,onUse,query='',root,snapshotId=''}) {
 const el=(t,s)=>{const n=document.createElement(t);if(s!==undefined)n.textContent=s;return n;};
 const link=(label,path,base=root)=>{const a=el('a',label);const u=new URL(path,base);if(u.origin!==location.origin||!u.pathname.startsWith(new URL(base).pathname))return el('span',label);a.href=u;a.target='_blank';a.rel='noopener';return a;};
 host.append(el('p','需求 → 原版模块 → 重构落点 → 能力组合 → 候选验证 → 场景采用。更新学习资料后重新计算；来源状态与系统可用性分别记录。'));
 host.append(el('small','来源批次 '+snapshotId+' · '+(coverage?.updatedAt||'未知时间')));
 for(const d of buildRoadmap(coverage,capabilities)){
  if(query&&!JSON.stringify({...d,pattern:undefined}).toLowerCase().includes(query.toLowerCase()))continue;
  const card=el('section');card.className='learning-card learning-demand';card.dataset.demand=d.id;
  card.append(el('h2',d.name),el('p',d.contract),el('strong',`当前工坊接口：${d.ready}/${d.steps.length} · 组合实景验收待完成`));
  const ol=el('ol');for(const s of d.steps)ol.append(el('li',`${s.name} · ${s.id} · ${s.available?'已有接口':'待适配'}`));card.append(ol);
  card.append(el('p','验收要求：'+d.accept),el('p','下一步：'+d.next));
  const use=el('button','将组合加入'+({object:'物件',scene:'场景',planet:'球系统'}[d.tier])+'管线 →');use.onclick=()=>onUse(d);card.append(use);
  const details=el('details');details.append(el('summary',`源码追溯与缺口 · ${d.modules.length} 个相关原模块（按路径规则关联）`));
  for(const m of d.modules){const row=el('div');row.className='learning-module';row.append(link(m.source,m.source,new URL('../REACode/',root)),el('p','原库状态：'+m.status));for(const p of m.targets||[])row.append(link(p,p),document.createTextNode(' '));row.append(el('p','剩余差距：'+(m.gap||'未提供；需补接口与验收说明')));if(m.evidence)row.append(link('原库证据',m.evidence));details.append(row);}card.append(details);host.append(card);
 }
}

export function renderModuleInventory(host,{coverage,capabilities,root,query=''}) {
 const el=(t,s)=>Object.assign(document.createElement(t),{textContent:s||''});
 const groups=new Map();
 for(const m of coverage.modules){
  if(query&&!JSON.stringify(m).toLowerCase().includes(query.toLowerCase()))continue;
  const dirs=[...new Set((m.targets||[]).filter(p=>p.startsWith('src/')).map(p=>p.split('/')[1]))];
  const group=dirs.join(' / ')||'待归类';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(m);
 }
 host.append(el('p','按重构落点职责全量归类；跨职责模块保留多域。能力关联按重用模块路径或来源帖子推导，只表示相关性，不能证明代码依赖或行为等价。'));
 for(const [group,rows] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const section=el('details');section.className='learning-card';section.open=!!query;section.append(el('summary',group+' · '+rows.length+' 个原模块'));
  for(const m of rows){const row=el('div');row.className='learning-module';
   const a=el('a',m.source);a.href=new URL('../REACode/'+m.source,root);a.target='_blank';row.append(a,el('p','原库：'+m.status));
   for(const p of m.targets||[]){const a=el('a',p);a.href=new URL(p,root);a.target='_blank';row.append(a,document.createTextNode(' '));}
   const linked=capabilities.filter(c=>(c.modules||[]).some(path=>(m.targets||[]).includes(path))||(c.sources||c.sourceVideos||c.related||c.codeMeta?.sources||[]).some(id=>(m.clips||[]).includes(id)));
   row.append(el('p','系统接口：'+(linked.map(c=>c.name+' ['+c.id+']').join('、')||'未找到相关已注册接口；需定义输入/输出、目标匹配、运行与验证')),
    el('p','剩余差距：'+(m.gap||'未提供')));section.append(row);
  }host.append(section);
 }
}
