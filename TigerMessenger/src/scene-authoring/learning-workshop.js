import {renderCapabilityEvolution} from '../../../townscaper-web/REACodeRefactoring/src/ui/capability-evolution.js';
import {renderCapabilityLineage} from '../../../townscaper-web/REACodeRefactoring/src/ui/capability-lineage.js';
import {renderCapabilityMap} from '../../../townscaper-web/REACodeRefactoring/src/ui/capability-map.js';
import {renderCapabilityTree} from '../../../townscaper-web/REACodeRefactoring/src/ui/capability-tree.js?v=maturity-r1';
import {buildCapabilityEvolution} from '../../../townscaper-web/REACodeRefactoring/src/core/capability-evolution.js';
import {onCatalogChange,loadCatalog} from '../system-workshop/catalog-view.js?v=code-r2';
import {renderCodeLibrary} from './code-library-view.js';
import {renderRefactorFiles} from './refactor-file-list.js';
import {renderRoadmap,renderModuleInventory} from './learning-roadmap.js';
import {makeVideoSummary,makeVideoPreview} from './learning-video-card.js';
import {diffLearningPipelines,indexLearningMethods} from './learning-diff.js';
import {createLearningCache} from './learning-cache.js';
import {decodeLearningSnapshot} from './learning-snapshot.js';
import {mountLearningProgress} from './learning-progress.js';
import {scanPipelineText} from './capability-scanner.js';
// Reuse current REACodeRefactoring data; never copy the stale sidebar snapshot.
export function mountLearningWorkshop({getUsage=()=>({present:false,adapters:[]}),onAddCapability=()=>{},onLocateCapability=()=>{},onAddCode=null,getCapabilities=()=>[],onUseCombination=()=>{},getExecutables=()=>[],getExperience=()=>({}),getDemand=()=>[],onUseExecutable=null,onUseGoal=null,experienceStore=null}={}){
 const host=document.getElementById('learning-workshop'),root=new URL('../townscaper-web/REACodeRefactoring/',location.href);const VIEWS=[['tree','能力树'],['map','能力地图'],['lineage','队列与闭环'],['evolution','时间线与能力演进'],['code','重构代码能力库'],['files','全目录重构状态'],['roadmap','需求与能力组合'],['inventory','源码归类与差距'],['architecture','系统与模块'],['pipeline','管线与能力'],['videos','视频与笔记']];
 // 默认是「能力地图」：一屏看能力网、场景差距和下一步。常用页签只有三个，其余资料收在「更多资料」里
 const PRIMARY=new Set(['tree','map','lineage','evolution']);let treeJev=null,treeMaturity=null;
 let loaded=false,mode=VIEWS.some(v=>v[0]===new URLSearchParams(location.search).get('learningView'))?new URLSearchParams(location.search).get('learningView'):'map',catalog=[],data=null,lastUpdate=0,codeCatalog=null,lineageLine=new URLSearchParams(location.search).get('lineageLine'),lineageConsumer=new URLSearchParams(location.search).get('lineageScene'),sceneConsumers=[];
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const link=(text,path)=>{const a=el('a',text);a.href=new URL(path,root).href;a.target='_blank';a.rel='noopener';return a;};
 const title=el('div',undefined,'learning-heading');title.append(el('small','学习工坊'));const back=el('button','返回系统工坊 →');back.onclick=()=>activate(false);title.append(back);host.append(title);
 const cache=createLearningCache(),cacheStatus=el('p','','muted');cacheStatus.id='learning-cache-status';host.append(cacheStatus);
 const progress=mountLearningProgress(host,root,{load:async()=>{
  let raw,next,cachedAt=null,stale=false;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(new URL('../../../api/workshop/learning-snapshot',import.meta.url),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('快照 HTTP '+response.status);raw=await response.json();next=await decodeLearningSnapshot(raw);}
  catch(error){if(loaded)throw error;const saved=await cache.read();if(!saved)throw error;raw=saved.snapshot;next=saved.data;cachedAt=saved.cachedAt;stale=true;}
  finally{clearTimeout(timer);}
  const nextCatalog=scanPipelineText('window.PIPELINE = '+JSON.stringify(next.pipeline)+';');
  let baseline=data;if(!baseline&&!stale){try{baseline=(await cache.read())?.data||null;}catch{}}
  const updates=baseline?await diffLearningPipelines(baseline.pipeline,next.pipeline):{added:[],changed:[],removed:[],conflicts:(await indexLearningMethods(next.pipeline)).conflicts,unchangedCount:0};updates.baselineId=baseline?.snapshotId||null;updates.baselineUpdatedAt=baseline?.sourceUpdatedAt||null;
  return {learn:next.learn,map:next.coverage,progress:next.progress,snapshotId:next.snapshotId,stale,updates,commit(){
   const previous={data,catalog,loaded};
   try{data=next;catalog=nextCatalog;loaded=true;render();}
   catch(error){({data,catalog,loaded}=previous);if(loaded)render();throw error;}
   lastUpdate=stale?0:Date.now();host.dataset.snapshotId=next.snapshotId;
   if(stale)cacheStatus.textContent='离线旧资料 · 缓存保存于 '+cachedAt;else{cacheStatus.textContent='正在保存学习缓存…';cache.write(raw).then(()=>cacheStatus.textContent='已缓存上次成功学习资料；场景存档独立保存。').catch(error=>cacheStatus.textContent='学习缓存未保存：'+error.message+'；当前资料仍可用。');}
  }};
 },onError:()=>{if(!loaded)stats.textContent='资料尚未加载，请在上方重试刷新。';}});
 const nav=el('nav',undefined,'learning-tabs'),search=el('input');search.type='search';search.placeholder='搜索模块、方法、笔记或帖子 ID';search.setAttribute('aria-label','搜索学习工坊');const stats=el('span','正在读取能力库…','muted'),content=el('div',undefined,'learning-content');host.append(nav,search,stats,content);
 const progressSection=host.querySelector('#learning-progress');for(const node of [nav,search,stats,content])host.insertBefore(node,progressSection);
 let fileRender=null,evolutionState=null;
 const tabs=[];for(const [id,name]of VIEWS.filter(v=>PRIMARY.has(v[0]))){const b=el('button',name);b.onclick=()=>{mode=id;render();};tabs.push([id,b]);nav.append(b);}
 const more=el('select');more.setAttribute('aria-label','更多资料');more.append(new Option('更多资料…',''));for(const [id,name]of VIEWS.filter(v=>!PRIMARY.has(v[0])))more.append(new Option(name,id));more.onchange=()=>{if(more.value){mode=more.value;render();}};nav.append(more);
 const dialog=document.createElement('dialog'),close=el('button','关闭视频'),video=el('video'),caption=el('p');video.controls=true;video.loop=true;video.playsInline=true;close.onclick=()=>dialog.close();dialog.onclose=()=>{video.pause();video.removeAttribute('src');video.load();};dialog.append(close,video,caption);host.append(dialog);
 function play(id){caption.textContent='原始来源 / '+id;video.src=new URL('../REA-agent/gifs/'+id+'.mp4',location.href).href;video.onerror=()=>caption.textContent='本地视频未找到：'+id+'。请在原素材目录恢复文件；此状态不计为已观看。';dialog.showModal();video.play().catch(()=>{});}
 function actions(row,entry){
  const usage=getUsage(entry),state=el('p',usage.code?.length?'已有能力代码，可在场景中执行':usage.present?'已在当前场景管线':'可加入当前场景管线 · 尚待执行适配');row.append(state);
  const add=el('button',usage.present?'定位场景中的此能力 →':'＋ 加入当前场景管线');add.onclick=()=>{if(usage.present)onLocateCapability(entry.id);else onAddCapability(entry);activate(false);};row.append(add);
  for(const adapter of usage.adapters){const locate=el('button','查看场景适配：'+adapter.name);locate.onclick=()=>{onLocateCapability(adapter.id);activate(false);};row.append(locate);}
  // 学习 → 场景：这条方法若已有能力代码（REACodeRefactoring/src/capabilities），直接显示可执行入口与执行经验
  for(const code of usage.code||[]){const x=code.exp,b=el('button',(code.present?'⚙ 定位能力代码：':'⚙ 加入能力代码：')+code.name);b.onclick=()=>{code.present?onLocateCapability(code.id):onAddCode?.(code.id);activate(false);};row.append(b,el('small',x.runs?`场景经验：执行 ${x.runs} 次 · 验证通过 ${x.passed} · 不通过 ${x.failed} · 写入 ${x.committed}${x.lastFailure?' · 最近失败：'+x.lastFailure:''}`:'场景经验：尚未执行','muted'));}
 }
 function render(){
  if(!loaded&&mode!=='code')return;fileRender?.abort();fileRender=null;for(const [id,b]of tabs){b.classList.toggle('primary',mode===id);b.setAttribute('aria-pressed',String(mode===id));}more.value=PRIMARY.has(mode)?'':mode;more.classList.toggle('primary',!PRIMARY.has(mode));host.classList.toggle('learning-map-mode',mode==='map'||mode==='tree');for(const n of [cacheStatus,stats,progressSection])if(n)n.hidden=mode==='map'||mode==='tree';content.replaceChildren();content.classList.toggle('learning-video-grid',mode==='videos');search.hidden=['evolution','lineage','map','tree'].includes(mode);const q=search.value.trim().toLowerCase(),match=value=>JSON.stringify(value).toLowerCase().includes(q);
  if(mode==='code'){stats.textContent='实际源码、导出接口、依赖组合与迁移差异';fileRender=new AbortController();renderCodeLibrary(content,{query:q,signal:fileRender.signal,onUse:async d=>{if(await onUseCombination(d)===false)throw Error('当前场景尚未提供这组执行接口；请先返回系统工坊选择适用场景。');activate(false);}});return;}
  stats.textContent=data.arch.layers.reduce((n,l)=>n+l.modules.length,0)+' 条模块职责 · '+data.learn.items.length+' 条学习记录（登记不等于验收）';
  const focusClip=id=>{mode='evolution';evolutionState={family:'all',phase:'all',priority:'all',query:id};render();host.querySelector('.learning-tabs')?.scrollIntoView({block:'start'});};
  if(mode==='tree'){
   renderCapabilityTree(content,{evolution:buildCapabilityEvolution(data.learn,data.pipeline),modules:codeCatalog?.modules||[],alignment:codeCatalog?.alignment||[],executables:getExecutables(),experience:getExperience(),demand:getDemand(),consumers:sceneConsumers,jev:treeJev,maturity:treeMaturity,line:lineageLine,
    onState:s=>{lineageLine=s.line;},onUse:onUseExecutable?x=>{onUseExecutable(x);}:null,onUseGoal:onUseGoal?g=>{onUseGoal(g);}:null,onOpenLine:id=>{lineageLine=id;mode='map';render();}});
  }else if(mode==='map'){
   renderCapabilityMap(content,{evolution:buildCapabilityEvolution(data.learn,data.pipeline),modules:codeCatalog?.modules||[],alignment:codeCatalog?.alignment||[],executables:getExecutables(),experience:getExperience(),demand:getDemand(),consumers:sceneConsumers,consumer:lineageConsumer,line:lineageLine,
    onState:s=>{lineageLine=s.line;lineageConsumer=s.consumer;},onFocus:focusClip,onUse:onUseExecutable?x=>{onUseExecutable(x);}:null,onDetail:()=>{mode='lineage';render();}});
  }else if(mode==='lineage'){
   stats.textContent='由作者时间线、源码依赖、可执行能力与本机执行经验计算；原库 done / partial 状态不因此改变';
   const focus=id=>{mode='evolution';evolutionState={family:'all',phase:'all',priority:'all',query:id};render();host.querySelector('.learning-tabs')?.scrollIntoView({block:'start'});};
   renderCapabilityLineage(content,{evolution:buildCapabilityEvolution(data.learn,data.pipeline),modules:codeCatalog?.modules||[],alignment:codeCatalog?.alignment||[],executables:getExecutables(),experience:getExperience(),demand:getDemand(),consumers:sceneConsumers,consumer:lineageConsumer,line:lineageLine,onState:s=>{lineageLine=s.line;lineageConsumer=s.consumer??lineageConsumer;},onFocus:focus,
    onUse:onUseExecutable?x=>{onUseExecutable(x);}:null,onStage:id=>{if(id==='pipeline'&&!getDemand().length){activate(false);return true;}return false;}});
   if(experienceStore){const bar=el('div',undefined,'exp-tools'),msg=el('span',`本机经验 ${experienceStore.read().length} 条 · 导出文件可在另一台机器导入复算`,'muted'),dl=el('button','⇩ 导出经验'),up=el('label','⇧ 导入经验'),inp=document.createElement('input');
    dl.onclick=()=>{const blob=new Blob([JSON.stringify(experienceStore.export(),null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tm-experience-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href);};
    inp.type='file';inp.accept='application/json';inp.hidden=true;inp.onchange=async()=>{if(!inp.files?.[0])return;try{const r=experienceStore.import(JSON.parse(await inp.files[0].text()));msg.textContent='已导入 '+r.added+' 条（共 '+r.total+'）· 队列已按合并经验重算';}catch(e){msg.textContent='导入失败：'+e.message;}render();};
    up.append(inp);bar.append(dl,up,msg);content.append(bar);}
  }else if(mode==='evolution'){
   const params=new URLSearchParams(location.search);
   stats.textContent='与 REACodeRefactoring 使用同一份作者时间线、演进关系和已有审核记录';
   renderCapabilityEvolution(content,{learn:data.learn,pipeline:data.pipeline,root,query:q||params.get('evolutionQuery')||'',family:params.get('evolutionFamily'),phase:params.get('evolutionPhase'),priority:params.get('evolutionPriority'),clip:evolutionState?null:params.get('evolutionClip'),...evolutionState,onState:state=>{evolutionState=state;},counterpart:new URL('pipeline.html',root).href,onPlay:play,onActions:(card,event)=>{
    const methods=catalog.filter(c=>c.provenance.records.some(r=>r.id===event.id));
    if(!methods.length)return;const d=el('details');d.append(el('summary','系统管线接入状态（独立于作者时间线）'));
    for(const entry of methods){const row=el('div');row.append(el('strong',entry.name));actions(row,entry);d.append(row);}card.append(d);
   }});
  }else if(mode==='files'){
   fileRender=new AbortController();renderRefactorFiles(content,{query:q,signal:fileRender.signal});
  }else if(mode==='roadmap'){
   renderRoadmap(content,{coverage:data.coverage,capabilities:getCapabilities(),query:q,root,snapshotId:data.snapshotId,onUse:d=>onUseCombination(d)});
  }else if(mode==='inventory'){
   renderModuleInventory(content,{coverage:data.coverage,capabilities:getCapabilities(),query:q,root});
  }else if(mode==='architecture'){
   const flow=el('div',undefined,'learning-flow');for(const [name,path,description]of data.arch.flow){const card=el('div',undefined,'learning-step');card.append(el('strong',name),link(path,path),el('p',description));flow.append(card);}content.append(flow);
   const grid=el('div',undefined,'learning-grid');for(const layer of data.arch.layers){if(!match(layer))continue;const card=el('section',undefined,'learning-card');card.style.borderTopColor=layer.color;card.append(el('h2',layer.name),el('code',layer.dir+'/'));for(const [name,description]of layer.modules){if(q&&!match([name,description])&&!match([layer.name,layer.dir]))continue;const row=el('div',undefined,'learning-module');row.append(link(name,layer.dir+'/'+name),el('p',description));const related=el('button','查看相关管线能力 →');related.onclick=()=>{mode='pipeline';search.value=layer.dir+'/'+name;render();};row.append(related);card.append(row);}grid.append(card);}content.append(grid);
  }else if(mode==='pipeline'){
   for(const lane of data.pipeline.lanes){if(!match(lane))continue;const card=el('details',undefined,'learning-card');card.open=!!q;card.style.borderTopColor=lane.color;card.append(el('summary',lane.name),el('p',lane.note||''));for(const [group,items]of lane.groups){const rows=items.filter(match);if(!rows.length)continue;card.append(el('h3',group));for(const item of rows){const row=el('div',undefined,'learning-module learning-method-with-preview'),body=el('div',undefined,'learning-method-copy');row.append(makeVideoPreview({id:item.id,name:item.name},root),body);body.append(el('strong',item.name),el('p',(item.where||'未标实现位置')+' · 库登记：'+item.status));if(item.id){body.append(el('code',item.id));const button=el('button','▶ 来源视频');button.onclick=()=>play(item.id);body.append(button);}const entry=catalog.find(c=>c.provenance.records.some(r=>r.lane===lane.key&&r.group===group&&r.name===item.name&&r.toggle===item.toggle));if(entry)actions(body,entry);card.append(row);}}content.append(card);}
  }else{
   for(const item of data.learn.items.filter(match)){const card=el('details',undefined,'learning-card learning-video-card');card.append(makeVideoSummary(item,root),el('p',item.text),el('p',item.note||item.learned||''),el('code',item.where||'未标实现位置'));const button=el('button','▶ 播放本地原视频');button.onclick=()=>play(item.id);card.append(button);const methods=catalog.filter(c=>c.provenance.records.some(r=>r.id===item.id));for(const entry of methods){const row=el('div',undefined,'learning-module');row.append(el('strong',entry.name));actions(row,entry);card.append(row);}if(!methods.length)card.append(el('p','这条学习记录尚未登记为可插入管线的方法。'));content.append(card);}
  }
  if(!content.textContent)content.append(el('p','没有匹配记录。'));
 }
 search.oninput=render;
 onCatalogChange(c=>{codeCatalog=c;if(['code','lineage','map'].includes(mode)&&!host.hidden)render();});
 // 场景消费清单（tools/refactor/scan-scene-consumers.mjs 生成）：能力网的场景诊断用
 // R23 九级成熟度（tools/refactor/build-capability-maturity.mjs 生成）：没有这份文件时树照常显示，只是不标级别
 fetch(new URL('./catalog/capability-maturity.json',import.meta.url),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(Array.isArray(d?.rows)){treeMaturity=d;if(mode==='tree'&&loaded&&!host.hidden)render();}}).catch(()=>{});
 fetch(new URL('./catalog/capability-tree-jev.json',import.meta.url),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d?.assignments){treeJev=d;if(mode==='tree'&&loaded&&!host.hidden)render();}}).catch(()=>{});
 fetch(new URL('./catalog/scene-consumers.json',import.meta.url),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d?.schemaVersion===1){sceneConsumers=d.consumers;if(['lineage','map'].includes(mode)&&loaded&&!host.hidden)render();}}).catch(()=>{});
 loadCatalog().then(c=>{codeCatalog=c;if(['lineage','map'].includes(mode)&&loaded&&!host.hidden)render();}).catch(()=>{});
 // 系统工坊左栏「下一步 → 学习工坊」：直接打开那条能力线
 window.addEventListener('tm.learning.lineage',e=>{mode='map';if(e.detail?.line)lineageLine=e.detail.line;if(e.detail?.consumer)lineageConsumer=e.detail.consumer;activate(true);});
 let expTimer=0;window.addEventListener('tm:experience',()=>{if(!loaded)return;clearTimeout(expTimer);expTimer=setTimeout(()=>{if(!host.hidden&&['tree','map','lineage','evolution'].includes(mode))render();},600);});
 async function ensure(){if(loaded&&Date.now()-lastUpdate<60000)return;return progress.refresh();}
 const sceneTab=document.getElementById('scene-workshop-tab'),learnTab=document.getElementById('learning-workshop-tab');
 function activate(learning){for(const id of ['save-recipe','export','connection'])document.getElementById(id).hidden=learning;host.hidden=!learning;for(const node of document.querySelectorAll('#system-workshop,body>.intro,body>main'))node.hidden=learning;document.getElementById('system-tab')?.setAttribute('aria-pressed',String(!learning));learnTab.setAttribute('aria-pressed',String(learning));sceneTab.setAttribute('aria-selected',String(!learning));learnTab.setAttribute('aria-selected',String(learning));document.title=learning?'学习工坊 · 学习管线':'系统工坊 · 编辑管线';history.replaceState(null,'',learning?'#learning':'#scene');if(learning){render();ensure();}}
 window.addEventListener('tm.learning.roadmap',()=>{mode='roadmap';search.value='';activate(true);});
 sceneTab.onclick=()=>activate(false);learnTab.onclick=()=>activate(true);activate(location.hash==='#learning');
 return {async openSource(query,section='pipeline'){activate(true);await ensure();mode=section;search.value=query;render();},refresh:render,showScene:()=>activate(false)};
}
