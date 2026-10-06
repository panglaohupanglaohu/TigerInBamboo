import {createTargetCityEntityEditor} from '../../src/world/citadel/targetCityEntityEditor.js';
/** Candidate-only panel. The production save and editor remain untouched. */
export function installTargetCityEditorPanel({root,scene,camera,canvas,THREE,host,refresh,onReport=()=>{},targetId,terrainVersion,factoryVersion}){
 const editor=createTargetCityEntityEditor({root,targetId,terrainVersion,factoryVersion});
 const panel=document.createElement('section');panel.id='target-entity-editor';panel.style.cssText='padding:10px;border:1px solid #628d98;background:#213c46;color:#eef8f4;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
 const title=document.createElement('strong');title.textContent='旧城住宅候选编辑';panel.append(title);
 const active=document.createElement('input');active.type='checkbox';active.id='entity-pointer-active';const enabled=document.createElement('label');enabled.append(active,document.createTextNode('启用点选 / 右键删除'));panel.append(enabled);
 const select=document.createElement('select');select.setAttribute('aria-label','候选住宅');panel.append(select);
 const colour=document.createElement('input');colour.type='color';colour.setAttribute('aria-label','住宅墙色');panel.append(colour);
 const message=document.createElement('span');message.id='entity-edit-status';panel.append(message);
 const text=document.createElement('textarea');text.setAttribute('aria-label','候选编辑JSON');text.style.cssText='display:none;width:100%;min-height:90px';
 let pointer=null,lastResult=null,disposed=false;const events=[];
 function listen(target,name,fn,options){target.addEventListener(name,fn,options);events.push(()=>target.removeEventListener(name,fn,options));}
 function sync(result){if(result)lastResult=result;const old=select.value;select.replaceChildren();for(const row of editor.list()){const opt=document.createElement('option');opt.value=row.id;opt.textContent=row.id+(row.occupied?'':' · 空槽');select.append(opt);}if(editor.list().some(e=>e.id===old))select.value=old;const selected=editor.list().find(e=>e.id===select.value);if(selected)colour.value=selected.wallColor;message.textContent=result?(result.ok?'已应用候选编辑':'未应用：'+result.error):'15栋住宅；地标、台地及通道受保护。';onReport(report());}
 function report(){return{mode:editor.mode,wfc:false,size:editor.size,revision:editor.revision,history:editor.history,lastResult,snapshot:editor.exportSnapshot(),pointerEditing:active.checked,productionEditorInstalled:false};}
 function perform(fn){try{const result=fn();sync(result);if(result.ok)refresh();}catch(e){sync({ok:false,error:String(e.message||e)});}}
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;panel.append(b);return b;}
 button('删除所选住宅',()=>perform(()=>editor.edit({id:select.value,occupied:false})));
 button('恢复所选住宅',()=>perform(()=>editor.edit({id:select.value,occupied:true})));
 button('应用墙色',()=>perform(()=>editor.edit({id:select.value,wallColor:colour.value})));
 button('住宅撤销',()=>perform(()=>editor.undo()));button('住宅重做',()=>perform(()=>editor.redo()));
 button('导出候选编辑JSON',()=>{text.style.display='block';text.value=editor.exportJSON();const url=URL.createObjectURL(new Blob([text.value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='citadel-target-entity-edit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);message.textContent='已导出独立候选文件；未改原游戏存档。';});
 button('载入候选编辑JSON',()=>{text.style.display='block';if(!text.value){text.value=editor.exportJSON();message.textContent='可粘贴同版本候选JSON后再次载入。';return;}perform(()=>editor.importSnapshot(text.value));});
 select.onchange=()=>{const row=editor.list().find(e=>e.id===select.value);if(row)colour.value=row.wallColor;};active.onchange=()=>{pointer=null;message.textContent=active.checked?'左键点选住宅，右键短点删除；拖拽不会删除。':'点选编辑已关闭。';onReport(report());};
 panel.append(text);host.append(panel);sync();
 const win=canvas.ownerDocument.defaultView;
 listen(win,'pointerdown',e=>{if(!active.checked||e.target!==canvas)return;pointer={x:e.clientX,y:e.clientY,button:e.button,id:e.pointerId};if(e.button===2){e.preventDefault();e.stopImmediatePropagation();}},true);
 listen(win,'contextmenu',e=>{if(active.checked&&e.target===canvas){e.preventDefault();e.stopImmediatePropagation();}},true);
 listen(win,'pointerup',e=>{if(!active.checked||e.target!==canvas||!pointer)return;const down=pointer;pointer=null;if(down.button===2){e.preventDefault();e.stopImmediatePropagation();}if(down.id!==e.pointerId||Math.hypot(down.x-e.clientX,down.y-e.clientY)>6)return;
  const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.layers.enableAll();camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const pick=editor.intersectClosestVisible(ray,scene);
  if(pick?.kind==='entity'){select.value=pick.id;colour.value=pick.entity.wallColor;if(down.button===2)perform(()=>editor.edit({id:pick.id,occupied:false}));else{message.textContent='已选中 '+pick.id;onReport(report());}}
  else{message.textContent=pick?'当前表面受保护，未点穿到后方住宅。':'未选中住宅。';onReport(report());}
 },true);
 return{editor,report,dispose(){if(disposed)return;disposed=true;events.forEach(f=>f());editor.dispose();panel.remove();}};
}
