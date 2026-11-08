import {listSceneObjects,getSceneObject,describeSceneObject} from './scene-objects.js';
import {setGroup,setCaptureMode,isCaptureMode} from '../ui/uiLayers.js?v=ui-layers-r2-capture';
import {validateRecipe,effectiveSettings} from './pipeline-model.js';
import {createVersionStore} from './store.js';

/** Studio-edit + capture-clean CSS: hide play HUD chrome while framing in the workshop. */
const STUDIO_EDIT_CSS=`
body.studio-edit #hud,
body.studio-edit #rescue-campaign,
body.studio-edit #touch-controls,
body.studio-edit #learnpanel,
body.studio-edit #controls-dock,
body.studio-edit #topleft-stack,
body.studio-edit #quest-panel,
body.studio-edit #minimap-panel,
body.studio-edit #compass,
body.studio-edit #hint-panel,
body.studio-edit #toast,
body.studio-edit #intro,
body.studio-edit #startup-progress,
body.studio-edit #journal-panel,
body.studio-edit #npc-hint,
body.studio-edit #bubble,
body.studio-edit #bubble-crosshair,
body.studio-edit #tm-ui-dock,
body.studio-edit #shot-harness-panel,
body.studio-edit #storyboard-panel,
body.studio-edit #storyboard-toggle,
body.studio-edit #tm-perf-probe{display:none!important}
`;

function grabCanvasPng(){
 const tm=globalThis.__tm;
 const canvas=tm?.renderer?.domElement||document.querySelector('canvas');
 if(!canvas||typeof canvas.toDataURL!=='function')throw Error('无可用 canvas');
 if(tm?.renderer&&tm.scene&&tm.camera){
  try{tm.renderer.render(tm.scene,tm.camera);}catch{}
 }
 return canvas.toDataURL('image/png');
}

const HEX=/^#[0-9a-f]{6}$/i;
function checkStyle(o){
 if(typeof o!=='object'||Array.isArray(o)||JSON.stringify(o).length>200000)throw Error('风格覆盖无效');
 if(o.walls!==undefined&&(!Array.isArray(o.walls)||o.walls.length!==15||!o.walls.every(c=>HEX.test(c))))throw Error('墙面色槽须为 15 个 #rrggbb');
 if(o.build!==undefined)for(const v of Object.values(o.build))if(!HEX.test(v))throw Error('建筑颜色无效');
 if(o.roles!==undefined)for(const r of Object.values(o.roles)){if(r.color!==undefined&&!HEX.test(r.color))throw Error('角色颜色无效');if(r.roughness!==undefined&&!(r.roughness>=0&&r.roughness<=1))throw Error('粗糙度无效');if(r.colorMap!==undefined)for(const [a,b]of Object.entries(r.colorMap))if(!HEX.test(a)||!HEX.test(b))throw Error('颜色表无效');}
 return o;
}
export function mountPipelineBridge(plugin){
 if(window.parent===window)return ()=>{};
 const style=document.createElement('style');style.textContent=STUDIO_EDIT_CSS;document.head.append(style);
 const baseline=plugin.settings(),store=createVersionStore(localStorage);let current=null;
 // 当前作用的场景：莫西斯湖走场景编辑插件；其余场景走通用场景插件（generic-scene.js）
 let activeScene=plugin.id;const gs=()=>activeScene===plugin.id?null:plugin.sceneAdapter?.(activeScene)||null;const edits=()=>{const g=gs();return g?g.objectEditor:plugin.objectEdits?.();};
 function reply(id,result,error){window.parent.postMessage({type:'tm.pipeline.reply',id,result,error},location.origin);}
 const listener=e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='tm.pipeline.command')return;const {id,action,payload}=e.data;
 try{let result;switch(action){
 case 'objects.list':{const g=gs();result=g?g.list():listSceneObjects();break;}
 case 'objects.select':{if(typeof payload?.id!=='string'||payload.id.length>128)throw Error('对象ID无效');document.getElementById('start-btn')?.click();setCaptureMode(true);document.body.classList.add('studio-edit');const g=gs();if(g){g.setObjectPicking(false);const row=g.get(payload.id);g.focusObject(row);result=g.describe(row);break;}const row=getSceneObject(payload.id);plugin.setObjectPicking(false);plugin.focusObject(row.object,row.bounds);result=describeSceneObject(row);break;}
 case 'objects.clear':{const g=gs();if(g){g.setObjectPicking(false);g.clearObjectFocus();result={cleared:true};break;}plugin.setObjectPicking(false);plugin.clearObjectFocus();edits()?.drag(null,false);result={cleared:true};break;}
 // 物件编辑（object-edits.js）：只接受固定操作与数值，不接受代码
 case 'objects.edit':{const ed=edits();if(!ed)throw Error('此场景未接入物件编辑');if(typeof payload?.id!=='string'||payload.id.length>128)throw Error('对象ID无效');const op={};for(const k of ['dx','dy','dz','ry','s'])if(payload[k]!==undefined){if(!Number.isFinite(payload[k])||Math.abs(payload[k])>200)throw Error('编辑数值无效');op[k]=payload[k];}if(payload.hidden!==undefined)op.hidden=!!payload.hidden;if(payload.reset)op.reset=true;result=ed.edit(payload.id,op);break;}
 case 'objects.edit.get':{const ed=edits();result=ed&&typeof payload?.id==='string'?ed.get(payload.id):null;break;}
 // 风格（style/runtime.js）：覆盖只接受颜色 / 数值，不接受代码
 case 'style.get':{const st=plugin.styleRuntime?.();if(!st)throw Error('此场景未接入风格包');result=st.state();break;}
 case 'style.preview':{const st=plugin.styleRuntime?.();if(!st)throw Error('此场景未接入风格包');result=st.preview(checkStyle(payload?.overrides||{}));break;}
 case 'style.compare':result=plugin.styleRuntime?.().compare(!!payload?.on);break;
 case 'style.save':result=plugin.styleRuntime?.().save();break;
 case 'style.revert':result=plugin.styleRuntime?.().revert();break;
 case 'style.reset':result=plugin.styleRuntime?.().reset();break;
 case 'camera.planet':{if(typeof plugin.framePlanet!=='function')throw Error('此场景插件不支持星球镜头');document.getElementById('start-btn')?.click();setGroup(null);document.body.classList.add('studio-edit');setCaptureMode(true);result=plugin.framePlanet(payload||{});break;}
 case 'objects.rename':{const g=gs();if(!g)throw Error('莫西斯湖的物件名来自场景代码，暂不能改名');if(typeof payload?.id!=='string'||payload.id.length>128)throw Error('对象ID无效');result=g.rename(payload.id,String(payload.name||'').slice(0,40));break;}
 case 'gscene.style.get':{const g=gs();if(!g)throw Error('当前场景用莫西斯湖的风格面板');result=g.style.state();break;}
 case 'gscene.style.preview':{const g=gs();if(!g)throw Error('当前不是通用插件场景');const o=payload?.colors;if(!o||typeof o!=='object'||Object.keys(o).length>500)throw Error('风格改动无效');result=g.style.preview(o);break;}
 case 'gscene.style.compare':result=gs()?.style.compare(!!payload?.on);break;
 case 'gscene.style.save':{const g=gs();if(!g)throw Error('当前不是通用插件场景');result=g.style.save();break;}
 case 'gscene.style.revert':result=gs()?.style.revert();break;
 case 'gscene.style.reset':result=gs()?.style.reset();break;
 case 'gscene.drafts.list':{const g=gs();result=g?{scene:activeScene,rows:g.drafts.list()}:null;break;}
 case 'gscene.drafts.save':{const g=gs();if(!g)throw Error('当前不是通用插件场景');result=g.drafts.save(String(payload?.goal||'').slice(0,120));break;}
 case 'gscene.drafts.restore':{const g=gs();if(!g)throw Error('当前不是通用插件场景');result=g.drafts.restore(String(payload?.id||''));break;}
 case 'gscene.drafts.finalize':{const g=gs();if(!g)throw Error('当前不是通用插件场景');result=g.drafts.finalize(String(payload?.id||''));break;}
 case 'gscene.drafts.remove':{const g=gs();if(!g)throw Error('当前不是通用插件场景');result=g.drafts.remove(String(payload?.id||''));break;}
 case 'scenes.status':{const id=String(payload?.id||activeScene);if(id===plugin.id){result={scene:id,label:plugin.name,plugin:'workbench',checks:[{name:'场景编辑插件',passed:true,detail:'体素建造 / 物件 / 风格 / 草稿 / 定稿'},{name:'物件登记',passed:listSceneObjects().length>0,detail:listSceneObjects().length+' 个对象'}]};break;}const g=plugin.sceneAdapter?.(id);if(!g)throw Error('这个场景还没有根对象，无法接入');result=g.status();break;}
 case 'scenes.list':result=plugin.listScenes?.()||[{id:plugin.id,label:plugin.name,edit:'workbench'}];break;
 case 'scenes.focus':{if(typeof plugin.frameScene!=='function')throw Error('此插件不支持场景切换');const id=String(payload?.id||'');if(!/^[\w:-]{1,64}$/.test(id))throw Error('场景 id 无效');document.getElementById('start-btn')?.click();setGroup(null);document.body.classList.add('studio-edit');setCaptureMode(true);if(id!==plugin.id){activeScene=plugin.sceneAdapter?.(id)?id:plugin.id;}else activeScene=plugin.id;result={...plugin.frameScene(id),active:activeScene};break;}
 case 'scenes.editor':{const id=String(payload?.id||'');if(!/^[\w:-]{1,64}$/.test(id))throw Error('场景 id 无效');result=plugin.openSceneEditor?.(id);break;}
 case 'planet.state':result=plugin.planetState?.()||null;break;
 case 'objects.layout':{const ed=edits();if(!ed)throw Error('此场景未接入物件编辑');result={scene:activeScene,rows:ed.layout()};break;}
 case 'objects.preview':{const ed=edits();if(!ed)throw Error('此场景未接入物件编辑');const next=payload?.edits;if(!next||typeof next!=='object'||Object.keys(next).length>2000)throw Error('候选改动无效');for(const [id,e]of Object.entries(next)){if(id.length>128||!e||typeof e!=='object')throw Error('候选改动无效');for(const k of ['dx','dy','dz','ry','s'])if(e[k]!==undefined&&(!Number.isFinite(e[k])||Math.abs(e[k])>200))throw Error('编辑数值无效');}result=ed.previewEdits(next);break;}
 case 'objects.preview.compare':result=edits()?.compare(!!payload?.on);break;
 case 'objects.preview.revert':result=edits()?.revertPreview();break;
 case 'objects.preview.commit':{const ed=edits();if(!ed)throw Error('此场景未接入物件编辑');result=ed.commitPreview();break;}
 case 'objects.undo':result=edits().undo();break;
 case 'objects.redo':result=edits().redo();break;
 case 'objects.drag':{const ed=edits();if(!ed)throw Error('此场景未接入物件编辑');result=ed.drag(payload?.id,!!payload?.enabled);break;}
 case 'objects.picking':{if(typeof payload?.enabled!=='boolean')throw Error('选择模式参数无效');if(payload.enabled){document.getElementById('start-btn')?.click();setCaptureMode(true);document.body.classList.add('studio-edit');}(gs()||plugin).setObjectPicking(payload.enabled,(row,error)=>window.parent.postMessage({type:'tm.scene-object.selected',row,error},location.origin));result={enabled:payload.enabled};break;}
 case 'capture':{const recipe=structuredClone(validateRecipe(payload));result={scene:plugin.id,goal:recipe.goal,snapshot:{data:plugin.encode(),settings:plugin.settings(),recipe,objects:plugin.objectEdits?.()?.snapshot()||{},style:plugin.styleRuntime?.()?.snapshot()||{},locks:{geometry:true}}};break;}
 case 'connect':result={scene:plugin.id,baseline,worker:false,capabilities:plugin.capabilities?.actions||[]};break;
 case 'open':activeScene=plugin.id;
  document.getElementById('start-btn')?.click();
  setGroup('build');
  document.body.classList.add('studio-edit');
  // Workshop framing must be menu-free (strategy 1)
  setCaptureMode(true);
  plugin.open();
  result={opened:true,captureMode:isCaptureMode()};
  break;
 case 'play':
  setGroup(null);
  document.body.classList.remove('studio-edit');
  setCaptureMode(false);
  plugin.play?.();
  result={playing:true,captureMode:isCaptureMode()};
  break;
 case 'captureClean':{
  const on=payload===undefined?true:!!payload;
  setCaptureMode(on);
  // Keep studio-edit chrome CSS in sync when still framing
  if(on)document.body.classList.add('studio-edit');
  result={captureMode:isCaptureMode()};
  break;}
 case 'screenshot':{
  setCaptureMode(true);
  const png=grabCanvasPng();
  // Stay clean while still in studio-edit (series of shots); caller may send captureClean:false
  if(!document.body.classList.contains('studio-edit')){
   /* leave capture on for series; parent turns off via captureClean */
  }
  result={png,via:'canvas',captureMode:true};
  break;}
 case 'apply':current=structuredClone(validateRecipe(payload));plugin.apply(effectiveSettings(current,baseline));result={settings:plugin.settings(),geometryUnchanged:true};break;
 case 'baseline':plugin.apply(baseline);result={settings:plugin.settings()};break;
 case 'save':{if(!current)throw Error('先预览当前管线');const data=plugin.encode(),validation=plugin.validate(data);if(!validation.passed)throw Error(validation.message);const row=store.save(plugin.id,data,current.goal,validation,{...current,baseline},plugin.settings());window.parent.dispatchEvent(new CustomEvent('tm.experiments.changed',{detail:{id:row.id}}));result={id:row.id,validation,scope:'编码往返；通行与性能待实测'};break;}
 default:if(action.startsWith('cap.')&&plugin.capabilities){result=plugin.capabilities.handle(action,payload);break;}throw Error('未知管线操作');}
 if(result&&typeof result.then==='function'){result.then(r=>reply(id,r),err=>reply(id,null,err.message));return;}
 reply(id,result);
 }catch(err){reply(id,null,err.message);}};
 window.addEventListener('message',listener);return()=>{
  style.remove();
  document.body.classList.remove('studio-edit');
  try{setCaptureMode(false);}catch{}
  window.removeEventListener('message',listener);
 };
}
