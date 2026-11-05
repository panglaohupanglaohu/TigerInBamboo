import {listSceneObjects,getSceneObject} from './scene-objects.js';
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

export function mountPipelineBridge(plugin){
 if(window.parent===window)return ()=>{};
 const style=document.createElement('style');style.textContent=STUDIO_EDIT_CSS;document.head.append(style);
 const baseline=plugin.settings(),store=createVersionStore(localStorage);let current=null;
 function reply(id,result,error){window.parent.postMessage({type:'tm.pipeline.reply',id,result,error},location.origin);}
 const listener=e=>{if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='tm.pipeline.command')return;const {id,action,payload}=e.data;
 try{let result;switch(action){
 case 'objects.list':result=listSceneObjects();break;
 case 'objects.select':{if(typeof payload?.id!=='string'||payload.id.length>128)throw Error('对象ID无效');const row=getSceneObject(payload.id);document.getElementById('start-btn')?.click();setCaptureMode(true);document.body.classList.add('studio-edit');plugin.focusObject(row.object);result={id:row.id,name:row.name};break;}
 case 'objects.clear':plugin.clearObjectFocus();result={cleared:true};break;
 case 'capture':{const recipe=structuredClone(validateRecipe(payload));result={scene:plugin.id,goal:recipe.goal,snapshot:{data:plugin.encode(),settings:plugin.settings(),recipe,locks:{geometry:true}}};break;}
 case 'connect':result={scene:plugin.id,baseline,worker:false};break;
 case 'open':
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
 default:throw Error('未知管线操作');}
 reply(id,result);
 }catch(err){reply(id,null,err.message);}};
 window.addEventListener('message',listener);return()=>{
  style.remove();
  document.body.classList.remove('studio-edit');
  try{setCaptureMode(false);}catch{}
  window.removeEventListener('message',listener);
 };
}
