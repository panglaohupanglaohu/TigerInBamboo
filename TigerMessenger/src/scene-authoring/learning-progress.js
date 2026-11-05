// Read the exact same progress sources as the upstream index/pipeline; never persist a copy.
export function mountLearningProgress(host,root,{load,onError}={}){
 const section=document.createElement('section');section.className='learning-card';section.id='learning-progress';
 const heading=document.createElement('h2');heading.textContent='最新学习与重构进度';
 const refresh=document.createElement('button');refresh.textContent='刷新学习进度';
 const notice=document.createElement('p');notice.setAttribute('role','status');const body=document.createElement('div');section.append(heading,refresh,notice,body);host.append(section);
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const link=(title,path)=>{const a=el('a',title);a.href=new URL(path,root).href;a.target='_blank';a.rel='noopener';return a;};
 let pending=null;
 async function update(){if(pending)return pending;refresh.disabled=true;
 pending=(async()=>{try{
  const prepared=await load(),{map,progress,snapshotId}=prepared,draft=document.createElement('div'),openSections=new Set([...body.querySelectorAll('details[open][data-progress-section]')].map(n=>n.dataset.progressSection));
  if(!Array.isArray(map.modules)||!map.counts||!Array.isArray(progress.completed)||!Array.isArray(progress.next))throw Error('进度数据格式无效');
  draft.append(el('p','更新：'+progress.updatedAt),el('p',map.modules.length+' 个原版模块 · '+Object.entries(map.counts).map(([k,v])=>k+' '+v).join(' · ')));
  const latest=progress.latest||{};const description=el('p',latest.summary||progress.completed.at(-1)||'');description.className='progress-summary';draft.append(el('h3',latest.title||'最新学习与重构'),description);const fullDescription=document.createElement('details');fullDescription.className='progress-description';fullDescription.append(el('summary','展开本轮完整说明'),el('p',latest.summary||progress.completed.at(-1)||''));draft.append(fullDescription);
  draft.append(el('p','静态改进、逐帧学习、运行验收分别记录；库覆盖进度不代表游戏接入或 Worker 执行完成。'));
  const links=el('p','');links.append(link('原库最新进度 ↗','pipeline.html#latest-progress'),' · ',link('模块覆盖映射 ↗','coverage.html'),' · ',link('本轮证据 ↗',latest.evidence||'CHANGELOG.md'));draft.append(links);
  const folders=el('div','');folders.className='progress-folders';
  function folder(id,title){const node=document.createElement('details');node.dataset.progressSection=id;node.open=openSections.has(id);node.append(el('summary',title));folders.append(node);return node;}
  const evidence=folder('evidence','证据与实景入口（'+(latest.links||[]).length+'）');const evidenceList=el('ul','');for(const item of latest.links||[]){const row=el('li','');row.append(link(item.label,item.href));evidenceList.append(row);}evidence.append(evidenceList);
  const recent=folder('history','完成记录（'+progress.completed.length+'）');const list=el('ul','');for(const text of progress.completed)list.append(el('li',text));recent.append(list);
  const upcoming=folder('next','后续学习与缺口（'+progress.next.length+'）');const next=el('ul','');for(const task of progress.next){const row=el('li',task.title);for(const id of task.clips||[])row.append(' · ',link(id,'../../REA-agent/gifs/'+id+'.mp4'));next.append(row);}upcoming.append(next);draft.append(folders);
  if(prepared.updates){const diff=prepared.updates,updates=document.createElement('details');updates.id='learning-updates';updates.dataset.baselineId=diff.baselineId||'';updates.append(el('summary',diff.baselineId?'方法登记更新：新增 '+diff.added.length+' · 修改 '+diff.changed.length+' · 撤回 '+diff.removed.length+' · 需核对 '+diff.conflicts.length:'首次读取方法基线 · 需核对 '+diff.conflicts.length));updates.append(el('p','与本页或最后缓存的资料比较，仅供审核；只比较管线登记，源码依赖变化尚未纳入。配方和场景不会自动替换，来源位置变化或重复标识需要核对。'));
   if(diff.baselineUpdatedAt)updates.append(el('p','比较基线：'+diff.baselineUpdatedAt));
   for(const [label,rows]of [['新增',diff.added],['修改',diff.changed.map(r=>r.current)],['撤回',diff.removed]]){if(!rows.length)continue;updates.append(el('h4',label+'（'+rows.length+'）'));for(const row of rows){const text=el('p',row.item.name+' · '+(row.identity.post||'无帖子ID')+' · '+row.identity.where);text.dataset.changeKind=label;updates.append(text);}}
   if(diff.conflicts.length){updates.append(el('h4','需核对的来源'));for(const row of diff.conflicts){const names=(row.records||row.current||[]).map(r=>r.item.name).join(' / ');updates.append(el('p',({'duplicate-anchor':'重复来源标识','missing-anchor':'缺少来源标识','possible-relocation':'来源位置可能变更'}[row.type]||row.type)+' · '+names));}}draft.append(updates);}
  prepared.commit?.();body.replaceChildren(...draft.childNodes);section.dataset.updatedAt=progress.updatedAt;section.dataset.snapshotId=snapshotId;section.dataset.state=prepared.stale?'stale':'current';notice.textContent=(prepared.stale?'离线旧资料，请刷新检查更新 · ':'资料与进度来自同一校验快照 · ')+snapshotId.slice(7,19);
 }catch(error){section.dataset.state=section.dataset.snapshotId?'stale':'error';notice.textContent='学习资料读取失败：'+error.message+'；'+(section.dataset.snapshotId?'当前保留上次成功资料，请重试刷新。':'请重试刷新。');onError?.(error);}
 finally{pending=null;refresh.disabled=false;}})();return pending;}
 refresh.onclick=update;
 return {refresh:update};
}
