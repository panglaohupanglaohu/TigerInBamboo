import {makeVideoSummary,makeVideoPreview} from './learning-video-card.js';
import {diffLearningPipelines,indexLearningMethods} from './learning-diff.js';
import {createLearningCache} from './learning-cache.js';
import {decodeLearningSnapshot} from './learning-snapshot.js';
import {mountLearningProgress} from './learning-progress.js';
import {scanPipelineText} from './capability-scanner.js';
// Reuse current REACodeRefactoring data; never copy the stale sidebar snapshot.
export function mountLearningWorkshop({getUsage=()=>({present:false,adapters:[]}),onAddCapability=()=>{},onLocateCapability=()=>{}}={}){
 const host=document.getElementById('learning-workshop'),root=new URL('../townscaper-web/REACodeRefactoring/',location.href);let loaded=false,mode='architecture',catalog=[],data=null,lastUpdate=0;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const link=(text,path)=>{const a=el('a',text);a.href=new URL(path,root).href;a.target='_blank';a.rel='noopener';return a;};
 const title=el('div',undefined,'learning-heading');title.append(el('small','LEARNING WORKSHOP / REACodeRefactoring'),el('h1','理解系统，再组合世界。'),el('p','系统、管线、模块与视频来源。直接读取能力库当前记录。'));const back=el('button','返回当前场景管线 →');back.onclick=()=>activate(false);title.append(back);host.append(title);
 const cache=createLearningCache(),cacheStatus=el('p','','muted');cacheStatus.id='learning-cache-status';host.append(cacheStatus);
 const progress=mountLearningProgress(host,root,{load:async()=>{
  let raw,next,cachedAt=null,stale=false;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(new URL('../../../api/workshop/learning-snapshot',import.meta.url),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('快照 HTTP '+response.status);raw=await response.json();next=await decodeLearningSnapshot(raw);}
  catch(error){if(loaded)throw error;const saved=await cache.read();if(!saved)throw error;raw=saved.snapshot;next=saved.data;cachedAt=saved.cachedAt;stale=true;}
  finally{clearTimeout(timer);}
  const nextCatalog=scanPipelineText('window.PIPELINE = '+JSON.stringify(next.pipeline)+';');
  let baseline=data;if(!baseline&&!stale){try{baseline=(await cache.read())?.data||null;}catch{}}
  const updates=baseline?await diffLearningPipelines(baseline.pipeline,next.pipeline):{added:[],changed:[],removed:[],conflicts:(await indexLearningMethods(next.pipeline)).conflicts,unchangedCount:0};updates.baselineId=baseline?.snapshotId||null;updates.baselineUpdatedAt=baseline?.sourceUpdatedAt||null;
  return {map:next.coverage,progress:next.progress,snapshotId:next.snapshotId,stale,updates,commit(){
   const previous={data,catalog,loaded};
   try{data=next;catalog=nextCatalog;loaded=true;render();}
   catch(error){({data,catalog,loaded}=previous);if(loaded)render();throw error;}
   lastUpdate=stale?0:Date.now();host.dataset.snapshotId=next.snapshotId;
   if(stale)cacheStatus.textContent='离线旧资料 · 缓存保存于 '+cachedAt;else{cacheStatus.textContent='正在保存学习缓存…';cache.write(raw).then(()=>cacheStatus.textContent='已缓存上次成功学习资料；场景存档独立保存。').catch(error=>cacheStatus.textContent='学习缓存未保存：'+error.message+'；当前资料仍可用。');}
  }};
 },onError:()=>{if(!loaded)stats.textContent='资料尚未加载，请在上方重试刷新。';}});
 const nav=el('nav',undefined,'learning-tabs'),search=el('input');search.type='search';search.placeholder='搜索模块、方法、笔记或帖子 ID';search.setAttribute('aria-label','搜索学习工坊');const stats=el('span','正在读取能力库…','muted'),content=el('div',undefined,'learning-content');host.append(nav,search,stats,content);
 const tabs=[];for(const [id,name]of [['architecture','系统与模块'],['pipeline','管线与能力'],['videos','视频与笔记']]){const b=el('button',name);b.onclick=()=>{mode=id;render();};tabs.push([id,b]);nav.append(b);}
 const dialog=document.createElement('dialog'),close=el('button','关闭视频'),video=el('video'),caption=el('p');video.controls=true;video.loop=true;video.playsInline=true;close.onclick=()=>dialog.close();dialog.onclose=()=>{video.pause();video.removeAttribute('src');video.load();};dialog.append(close,video,caption);host.append(dialog);
 function play(id){caption.textContent='原始来源 / '+id;video.src=new URL('../REA-agent/gifs/'+id+'.mp4',location.href).href;video.onerror=()=>caption.textContent='本地视频未找到：'+id+'。请在原素材目录恢复文件；此状态不计为已观看。';dialog.showModal();video.play().catch(()=>{});}
 function actions(row,entry){
  const usage=getUsage(entry),state=el('p',usage.present?'已在当前场景管线':'可加入当前场景管线 · 尚待执行适配');row.append(state);
  const add=el('button',usage.present?'定位场景中的此能力 →':'＋ 加入当前场景管线');add.onclick=()=>{if(usage.present)onLocateCapability(entry.id);else onAddCapability(entry);activate(false);};row.append(add);
  for(const adapter of usage.adapters){const locate=el('button','查看场景适配：'+adapter.name);locate.onclick=()=>{onLocateCapability(adapter.id);activate(false);};row.append(locate);}
 }
 function render(){
  if(!loaded)return;for(const [id,b]of tabs){b.classList.toggle('primary',mode===id);b.setAttribute('aria-pressed',String(mode===id));}content.replaceChildren();content.classList.toggle('learning-video-grid',mode==='videos');const q=search.value.trim().toLowerCase(),match=value=>JSON.stringify(value).toLowerCase().includes(q);
  stats.textContent=data.arch.layers.reduce((n,l)=>n+l.modules.length,0)+' 条模块职责 · '+data.learn.items.length+' 条学习记录（登记不等于验收）';
  if(mode==='architecture'){
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
 async function ensure(){if(loaded&&Date.now()-lastUpdate<60000)return;return progress.refresh();}
 const sceneTab=document.getElementById('scene-workshop-tab'),learnTab=document.getElementById('learning-workshop-tab');
 function activate(learning){for(const id of ['save-recipe','export','connection'])document.getElementById(id).hidden=learning;host.hidden=!learning;for(const node of document.querySelectorAll('body>.intro,body>main'))node.hidden=learning;sceneTab.setAttribute('aria-selected',String(!learning));learnTab.setAttribute('aria-selected',String(learning));document.title=(learning?'学习工坊':'场景工坊')+' · Super-agent';history.replaceState(null,'',learning?'#learning':'#scene');if(learning){if(loaded)render();ensure();}}
 sceneTab.onclick=()=>activate(false);learnTab.onclick=()=>activate(true);activate(location.hash==='#learning');
 return {async openSource(query,section='pipeline'){activate(true);await ensure();mode=section;search.value=query;render();},refresh:render,showScene:()=>activate(false)};
}
