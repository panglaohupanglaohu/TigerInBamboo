import {buildCapabilityEvolution,evolutionFingerprint,RELATION_LABELS} from '../core/capability-evolution.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const safePath=p=>typeof p==='string'&&/^(?:src|learn|artifacts)\/[\w./-]+$/.test(p)&&!p.split('/').includes('..');
export function renderCapabilityEvolution(host,{learn,pipeline,root,query='',family:initialFamily,phase:initialPhase,priority:initialPriority,clip:initialClip,onPlay,onActions,onState,counterpart}={}){
 const model=buildCapabilityEvolution(learn,pipeline),byId=new Map(model.events.map(e=>[e.id,e])),edges=new Map(model.relations.map(e=>[e.id,e]));
 let family=initialFamily||(initialPhase?'all':'grid'),phase=initialPhase||'all',priority=['partial','高','中','低'].includes(initialPriority)?initialPriority:'all',needle=query,limit=36;const styleId='capability-evolution-css';
 if(!document.getElementById(styleId)){const css=el('link');css.id=styleId;css.rel='stylesheet';css.href=new URL('./capability-evolution.css',import.meta.url);document.head.append(css);}
 const shell=el('section',undefined,'capability-evolution');shell.dataset.evolutionRevision=model.revision;shell.dataset.evolutionPosts=model.counts.posts;host.append(shell);
 evolutionFingerprint(model).then(id=>{if(shell.isConnected){shell.dataset.evolutionFingerprint=id;fingerprint.textContent='共同资料指纹 '+id.slice(0,23)+'…';}});
 shell.append(el('small','AUTHOR HISTORY → CAPABILITY EVOLUTION'),el('h2','能力演进 · 从问题到下一版'),el('p','先看作者当时要解决的问题，再看 A 如何变成 A+、分成不同方案，或与另一项能力组合。发布时间、学习时间、代码扫描时间分别记录。'));
 const counts=el('p',`${model.counts.posts} 条来源 · ${model.counts.reviewedFamilies} 条已梳理主题 · ${model.counts.validRelations} 条有依据关系 · ${model.counts.withoutRelation} 条未连接关系（含独立能力/展示）`,'evolution-counts');shell.append(counts,el('p',`部分实现 ${model.counts.partial} 条 · 补全优先级：高 ${model.counts.priorityCounts['高']} / 中 ${model.counts.priorityCounts['中']} / 低 ${model.counts.priorityCounts['低']}；记录数不等于独立开发任务数。`,'evolution-counts'));
 shell.append(el('p',model.reviewBasis,'evolution-muted'));
 const facts=el('details');facts.append(el('summary',`时间与归属核对：${model.counts.dateConflicts} 处日期冲突 · ${model.counts.projectLabelsToReview} 处早期项目标签待核`),el('p',model.datePolicy),el('p',model.projectPolicy),el('p',`原管线 ${model.counts.pipelineRows} 行，去重为 ${model.counts.pipelinePosts} 个帖子，${model.counts.unanchoredMethods} 行没有帖子锚点；另有 ${model.counts.withoutPipeline} 条来源未登管线。未登管线不等于待实现。`));
 for(const row of model.unanchoredMethods)facts.append(el('p','无视频锚点：'+row.lane+' / '+row.group+' / '+row.name+' · '+(row.where||'落点待核')));
 for(const issue of model.issues){const r=byId.get(issue.id);if(issue.type==='date-conflict')facts.append(el('p',`${issue.id}：登记 ${issue.recorded} → 发布时间 ${issue.published}（UTC，原登记保留）`));else if(issue.type==='project-label')facts.append(el('p',`${r.date} · ${r.id}：${r.projectLabel}`));else if(issue.type==='relation-evidence-changed')facts.append(el('p','来源文字已变化，关系暂不生效：'+issue.id));}shell.append(facts);
 const phaseNav=el('div',undefined,'evolution-phases');
 const phaseButtons=[];for(const p of model.phases){const b=el('button',`${p.name}\n${p.posts} 条来源 · ${p.partial} 部分实现`);b.dataset.evolutionPhase=p.id;b.onclick=()=>{phase=p.id;family='all';select.value='all';limit=36;draw();};phaseButtons.push([p.id,b]);phaseNav.append(b);}shell.append(phaseNav,el('small','主线导航：Bad North → Townscaper → next → sphere。sphere 是后续世界的球面分支；同一时期其他研究仍留在 next，早期球面实验另列。','evolution-muted'));
 const milestones=el('div',undefined,'evolution-milestones');for(const [date,text,id]of [['2016–18','早期生成实验与 Bad North','793545297376972801'],['2019–21','Townscaper 不规则建筑网格','1147881669350891521'],['2022-10','不规则网格 × 多格模块','1579483114178768898'],['2024-03','后续世界球面展示与修正','1768627849529893109'],['2025-11','新岸浪与循环顶点数据','1991101097818403263']]){const b=el('button',date+'\n'+text);b.onclick=()=>focus(id);milestones.append(b);}const milestoneDetails=el('details');milestoneDetails.append(el('summary','关键转折与原帖入口'),milestones,el('small','这是有来源的里程碑，不是已证实的单线项目继承；2016 年另有早期球面实验。','evolution-muted'));shell.append(milestoneDetails);
 const toolbar=el('div',undefined,'evolution-toolbar'),select=el('select'),search=el('input');select.setAttribute('aria-label','能力演进主题');search.type='search';search.placeholder='搜索日期、作者原文、源码、帖子 ID';search.setAttribute('aria-label','搜索能力演进');search.value=query;
 for(const [id,name]of [['all','全部来源 · 按发布时间'],...model.families.map(f=>[f.id,f.name])]){const o=el('option',name);o.value=id;select.append(o);}if(![...select.options].some(o=>o.value===family))family='all';select.value=family;
 const both=el('a','在另一学习管线查看同一主题 ↗');both.target='_blank';both.rel='noopener';const prioritySelect=el('select');prioritySelect.setAttribute('aria-label','补全优先级');for(const [value,label]of [['all','全部状态'],['partial',`只看部分实现（${model.counts.partial}）`],...['高','中','低'].map(p=>[p,`${p}优先级（${model.counts.priorityCounts[p]}）`])]){const o=el('option',label);o.value=value;prioritySelect.append(o);}prioritySelect.value=priority;const reset=el('button','全部阶段');reset.onclick=()=>{phase='all';draw();};toolbar.append(select,prioritySelect,search,reset,both);shell.append(toolbar);
 const guide=el('div',undefined,'evolution-guide'),list=el('div',undefined,'evolution-events'),more=el('button','显示更多时间记录'),fingerprint=el('small','计算共同资料指纹…','evolution-muted');shell.append(el('p',model.priorityPolicy||'优先级尚待评估','evolution-muted'),guide,list,more,fingerprint);
 const link=(label,path)=>{const a=el('a',label);a.href=new URL(path,root);a.target='_blank';a.rel='noopener';return a;};
 function focus(id){phase='all';priority='all';prioritySelect.value='all';family='all';select.value=family;needle=id;search.value=id;limit=36;draw();}
 function draw(){
  guide.replaceChildren();list.replaceChildren();for(const [id,b]of phaseButtons)b.setAttribute('aria-pressed',String(id===phase));const f=model.families.find(f=>f.id===family);guide.hidden=!f;
  const url=new URL(counterpart);url.searchParams.set('evolutionFamily',family);url.searchParams.set('evolutionPhase',phase);url.searchParams.set('evolutionPriority',priority);if(needle)url.searchParams.set('evolutionQuery',needle);else url.searchParams.delete('evolutionQuery');both.href=url;onState?.({family,phase,priority,query:needle});
  if(f){guide.append(el('h3',f.name),el('p',f.question||'按原主题保留全部来源'),el('p',f.scope),el('strong','当前选择建议'),el('p',f.recommendation));for(const id of f.preferred){const r=byId.get(id),b=el('button',r.date+' · 查看研究入口');b.onclick=()=>focus(id);guide.append(b);}guide.append(el('small','建议是研究与选型入口；本地代码是否完成、是否有 Worker 接口，分别核验。'));}
  const q=needle.trim().toLowerCase(),rows=model.events.filter(e=>(phase==='all'||e.phase===phase)&&(priority==='all'||priority==='partial'&&e.status==='partial'||e.completion?.priority===priority)&&(family==='all'||e.families.includes(family))&&(!q||(byId.has(q)?e.id===q:JSON.stringify(e).toLowerCase().includes(q))));
  shell.dataset.visibleTotal=rows.length;shell.dataset.evolutionPhase=phase;shell.dataset.priorityFilter=priority;shell.dataset.evolutionFamily=family;
  for(const r of rows.slice(0,limit)){
   const card=el('article',undefined,'evolution-event');card.dataset.evolutionClip=r.id;
   const date=el('time',r.date||'日期待核');if(r.publishedAt)date.dateTime=r.publishedAt;card.append(date,el('small',r.projectLabel));
   const heading=r.methods[0]?.name||r.text||r.note||r.id;card.append(el('h3',heading.length>130?heading.slice(0,130)+'…':heading));
   if(r.dateConflict)card.append(el('p','日期冲突：原登记 '+r.recordedDate+'；按帖子发布时间 '+r.date+' 排序','evolution-warning'));
   for(const key of r.incoming){const edge=edges.get(key),prev=byId.get(edge.fromId),rel=el('div',undefined,'evolution-relation');rel.dataset.relationType=edge.type;rel.append(el('b',(edge.valid?edge.label:'证据变化 · 暂停关系')+' ← '+prev.date),el('p',edge.reason),el('small',edge.assessment));const b=el('button','查看前身 '+prev.id);b.onclick=()=>focus(prev.id);rel.append(b);card.append(rel);}
   if(!r.incoming.length)card.append(el('p',r.outgoing.length?'此项是已梳理关系的起点；不表示它是作者最早的想法。':'尚未建立前后关系；仅有时间位置，不能自动推断替代。','evolution-muted'));
   if(r.completion){const c=r.completion,annotation=el('aside',undefined,'evolution-completion');annotation.dataset.completionPriority=c.priority;
    annotation.append(el('b',`部分实现 · 补全优先级：${c.priority}`),el('small',c.workType||'待评估'));
    if(!c.current)annotation.append(el('p','来源记录已变化或缺少批注，先重新核对优先级。旧建议不能当成当前任务。','evolution-warning'));
    else annotation.append(el('p','批注：'+c.reason),el('p','下一步：'+c.nextAction),el('p','完成门槛：'+c.acceptance));card.append(annotation);
   }else card.append(el('small','原库状态：'+(r.status||'未知')+' · 不按日期提升验收状态'));
   const detail=el('details');detail.append(el('summary','作者原文、已有学习记录与实现差距'),el('p',r.text||'没有保存作者文字；参考现有视频审核。'),el('p',r.note||'未记录学习笔记'),el('p','代码位置：'+(r.where||'待核对')));
   const stages=r.reviewStages||{};detail.append(el('p',`原库状态：${r.status||'未知'} · 原记录全文帧审核：${stages.allFramesReviewed===true?'已登记':'未登记'} · 原记录运行验收：${stages.runtimeAccepted===true?'已登记（限定下述范围）':'未登记'}`),el('p','验收范围：'+(stages.acceptanceScope||'未说明；不能由时间较新推定通过')));
   for(const path of r.modules)detail.append(link(path,path));if(safePath(r.reviewEvidence))detail.append(link('已有审核证据',r.reviewEvidence));
   const source=el('a','作者原帖 ↗');source.href='https://x.com/OskSta/status/'+r.id;source.target='_blank';source.rel='noopener';detail.append(source);
   if(onPlay){const b=el('button','▶ 对应来源视频');b.onclick=()=>onPlay(r.id);detail.append(b);}
   const seen=new Set();for(const method of r.methods){const p=method.page?.startsWith('scene:')?'index.html?scene='+method.page.slice(6):method.page;if(p&&/^[\w-]+\.html(?:\?[\w=&-]+)?$/.test(p)&&!seen.has(p)){seen.add(p);detail.append(link('现有实现演示：'+p,p));}}
   card.append(detail);if(r.outgoing.length){const follow=el('div',undefined,'evolution-follow');for(const key of r.outgoing){const e=edges.get(key),target=byId.get(e.toId),b=el('button',`${e.valid?e.label:'待核对'} → ${target.date}`);b.title=e.reason;b.onclick=()=>focus(target.id);follow.append(b);}card.append(follow);}onActions?.(card,r);list.append(card);
  }
  if(!rows.length)list.append(el('p','没有匹配的时间记录。'));more.hidden=rows.length<=limit;more.textContent=`显示更多（已显示 ${Math.min(rows.length,limit)} / ${rows.length}）`;
 }
 prioritySelect.onchange=()=>{priority=prioritySelect.value;limit=36;draw();};
 select.onchange=()=>{family=select.value;limit=36;draw();};search.oninput=()=>{needle=search.value;limit=36;draw();};more.onclick=()=>{limit+=60;draw();};
 if(initialClip){phase='all';family='all';select.value=family;needle=initialClip;search.value=needle;}draw();return {model,focus};
}
