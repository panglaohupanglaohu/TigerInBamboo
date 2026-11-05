import {createExperimentSession} from './experiment-session.js';
import {mountPipelineBridge} from './pipeline-bridge.js';
import {createVersionStore,createSceneRegistry} from './store.js';
import {UI_DEV} from '../ui/uiLayers.js?v=ui-layers-r1';
export function mountSceneWorkbench(plugin){
 const offBridge=mountPipelineBridge(plugin);
 if(!UI_DEV)return {dispose:offBridge};
 const embedded=new URLSearchParams(location.search).has('authoringEmbed')&&window.parent!==window;
 if(!embedded){
  const entry=document.createElement('a');entry.id='scene-studio-entry';entry.textContent='◈ 场景工坊';entry.href=new URL('../../pipeline.html',import.meta.url).href;entry.target='_blank';entry.rel='noopener';entry.style.cssText='position:fixed;right:16px;top:16px;z-index:240;padding:9px 15px;border-radius:7px;background:#192b2c;color:#dbe8df;font:13px system-ui;text-decoration:none';document.body.append(entry);
  const hide=document.createElement('style');hide.textContent='#morris-townscaper-hud,#lp-dlg{display:none!important}';document.head.append(hide);
  return {dispose(){offBridge();entry.remove();hide.remove();}};
 }
 const parentDoc=window.parent.document,versionsHost=parentDoc.getElementById('scene-versions'),editorHost=parentDoc.getElementById('editor-controls');
 if(!versionsHost||!editorHost)throw Error('场景工坊菜单容器缺失');
 if(!parentDoc.getElementById('studio-editor-style')){const style=parentDoc.createElement('link');style.id='studio-editor-style';style.rel='stylesheet';style.href=new URL('../world/morrisTownscaperMenu.css?v=reacode-refactor-r1',import.meta.url).href;parentDoc.head.append(style);}
 editorHost.append(plugin.editorHud);
 const compactToolbar=plugin.editorHud.querySelector('#morris-town-topright');if(compactToolbar)plugin.editorHud.prepend(compactToolbar);

 const captureRecipe=()=>{const detail={};window.parent.dispatchEvent(new CustomEvent('tm.pipeline.capture',{detail}));if(!detail.recipe)throw Error('管线尚未就绪');return detail.recipe;};
 const restoreRecipe=recipe=>{const detail={recipe};window.parent.dispatchEvent(new CustomEvent('tm.pipeline.restore',{detail}));if(detail.error||!detail.restored)throw Error(detail.error||'管线恢复失败');};
 const registry=createSceneRegistry();registry.register(plugin);
 const store=createVersionStore(localStorage),box=document.createElement('details');box.id='scene-authoring';
 box.style.cssText='position:fixed;right:14px;top:65px;z-index:240;background:#f3eddd;color:#25483e;padding:12px;border-radius:10px;width:300px;max-height:70vh;overflow:auto;font:13px system-ui';
 box.classList.add('studio-version-panel');
 const summary=document.createElement('summary');summary.textContent='场景创作 · 实验与定稿';box.append(summary);
 const select=document.createElement('select');select.setAttribute('aria-label','创作场景');for(const p of registry.list())select.add(new Option(p.name,p.id));box.append(select);
 const note=document.createElement('p');note.textContent='Worker 未连接 · 当前复用游戏编辑器。快照保留手工版本。';box.append(note);
 const goal=document.createElement('p');goal.textContent='目标与配方沿用上方管线；快照同时保存当前实际参数。';box.append(goal);
 const session=createExperimentSession({store,plugin,captureRecipe,restoreRecipe});
 for(const b of plugin.editorHud.querySelectorAll('button'))if(b.textContent==='返回玩家视角')b.hidden=true;
 for(const [oldLabel,newLabel]of [['撤销','撤销建造'],['重做','重做建造']]){const b=plugin.editorHud.querySelector('#morris-town-tools [aria-label="'+oldLabel+'"]');if(b){b.title=newLabel;b.setAttribute('aria-label',newLabel);}}
 const list=document.createElement('select');list.setAttribute('aria-label','实验版本');list.style.width='100%';box.append(list);
 const out=document.createElement('p');out.setAttribute('role','status');box.append(out);
 const current=()=>registry.get(select.value);
 function refresh(selected){confirm.checked=false;const previous=selected||list.value;const s=store.read();list.replaceChildren();for(const v of s.versions.filter(v=>v.scene===select.value).reverse())list.add(new Option(`${s.finals[v.scene]===v.id?'定稿 · ':''}${new Date(v.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} ${v.goal}`,v.id));if([...list.options].some(o=>o.value===previous))list.value=previous;}
 const chosen=()=>{const row=store.read().versions.find(v=>v.id===list.value&&v.scene===select.value);if(!row)throw Error('请先保存实验');return row;};
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style.margin='4px';b.onclick=()=>{try{fn();}catch(e){out.textContent=e.message;}};box.append(b);}
 
 button('比较当前与实验',()=>{const row=chosen();const diff=session.compare(row);out.textContent='建筑：'+(diff.geometryEqual?'相同':'不同')+'；参数：'+(diff.settingsDiff.join('、')||'相同')+'；管线：'+(diff.recipeEqual?'相同':'不同');});
 button('恢复所选实验',()=>{const row=chosen();session.restore(row);refresh(row.id);out.textContent='场景、实际参数与管线已恢复；恢复前版本已保护';});
 const confirm=document.createElement('input');confirm.type='checkbox';const label=document.createElement('label');label.append(confirm,'我已检查所选实验的视觉与玩法');box.append(label);
 button('确认所选实验定稿',()=>{if(!confirm.checked)throw Error('请先人工检查所选实验');session.finalize(chosen());confirm.checked=false;refresh();out.textContent='固定快照已存档；可用固定版本入口打开游戏';});
 button('用所选固定版本打开游戏',()=>{const row=chosen();if(!row.validation?.passed)throw Error('请先验证此实验');const state=store.read();if(state.finals[row.scene]!==row.id)throw Error('请先确认所选实验定稿');const url=new URL(location.href);url.searchParams.set('sceneVersion',row.id);url.searchParams.delete('morrisTown');url.searchParams.delete('authoringEmbed');url.searchParams.set('dev','0');window.open(url.href,'_blank','noopener');});
 button('导出实验记录',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(store.read(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='scene-authoring.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 list.onchange=()=>confirm.checked=false;select.onchange=()=>refresh();
 for(const event of ['keydown','keyup','pointerdown'])box.addEventListener(event,e=>e.stopPropagation());
 const onSave=event=>{try{const row=session.save(true);refresh(row.id);out.textContent='当前场景草稿已保存，编码往返通过；通行与性能仍需检查';event.detail.row=row;}catch(error){out.textContent='草稿保存失败：'+error.message+'；未新增版本，请检查原因后重试。';event.detail.error=error.message;}};window.parent.addEventListener('tm.experiment.save-current',onSave);
 const onVersions=event=>refresh(event.detail?.id);window.parent.addEventListener('tm.experiments.changed',onVersions);
 try{refresh();}catch(e){out.textContent='记录读取失败：'+e.message;}versionsHost.append(box);
 return {registry,dispose:()=>{offBridge();window.parent.removeEventListener('tm.experiments.changed',onVersions);window.parent.removeEventListener('tm.experiment.save-current',onSave);box.remove();}};
}
