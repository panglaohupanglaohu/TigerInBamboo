import {listSceneObjects,getSceneObject,describeSceneObject} from './scene-objects.js';
import {setGroup,setCaptureMode,isCaptureMode} from '../ui/uiLayers.js?v=ui-layers-r4-release-edit';
import {validateRecipe,effectiveSettings} from './pipeline-model.js';
import {createVersionStore} from './store.js';
import {playtestSceneId} from './playtest-target.js?v=playtest-r1';

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
 // 海面统一（world/seaStyle/seaStyle.js）：只接受样式数值，不接受代码；莫西斯湖与圣城海湾不动
 case 'sea.state':case 'sea.preview':case 'sea.compare':case 'sea.revert':case 'sea.commit':case 'sea.reset':case 'sea.cost':{
  const sea=globalThis.__tmSeaStyle;if(!sea)throw Error('海面统一模块还没加载（刷新游戏后再试）');
  const style=payload?.style&&typeof payload.style==='object'?JSON.parse(JSON.stringify(payload.style)):undefined;
  result=action==='sea.state'?sea.state():action==='sea.preview'?sea.preview(style||{}):action==='sea.compare'?sea.compare(!!payload?.on):action==='sea.revert'?sea.revert():action==='sea.commit'?sea.commit(style):action==='sea.reset'?sea.reset():sea.frameCost(Math.min(5000,Math.max(300,+payload?.ms||1000)));break;}
 // 天气（world/weatherStyle/weatherStyle.js）：只接受样式数值
 case 'weather.state':case 'weather.preview':case 'weather.compare':case 'weather.revert':case 'weather.commit':case 'weather.reset':{
  const wx=globalThis.__tmWeatherStyle;if(!wx)throw Error('天气模块还没加载（刷新游戏后再试）');
  const style=payload?.style&&typeof payload.style==='object'?JSON.parse(JSON.stringify(payload.style)):undefined;
  result=action==='weather.state'?wx.state():action==='weather.preview'?wx.preview(style||{}):action==='weather.compare'?wx.compare(!!payload?.on):action==='weather.revert'?wx.revert():action==='weather.commit'?wx.commit(style):wx.reset();break;}
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
 case 'scenes.focus':{if(typeof plugin.frameScene!=='function')throw Error('此插件不支持场景切换');const id=String(payload?.id||'');if(!/^[\w:-]{1,64}$/.test(id))throw Error('场景 id 无效');document.getElementById('start-btn')?.click();setGroup(null);document.body.classList.add('studio-edit');setCaptureMode(true);if(id!==plugin.id){activeScene=plugin.sceneAdapter?.(id)?id:plugin.id;}else activeScene=plugin.id;result={...plugin.frameScene(id,{preserveCamera:payload?.preserveCamera===true}),active:activeScene};break;}
 case 'scenes.editor':{const id=String(payload?.id||'');if(!/^[\w:-]{1,64}$/.test(id))throw Error('场景 id 无效');result=plugin.openSceneEditor?.(id);break;}
 case 'planet.state':result=plugin.planetState?.()||null;break;
 // 场景战役（world/rea/sceneBattle.js）：Bad North 玩法层；probe 只采样不交战，preview 按计划开战，commit 采用并持久化
 case 'battle.supported':{result=import('../world/rea/sceneBattle.js').then(m=>({scenes:m.BATTLE_SCENES}));break;}
 case 'battle.probe':{const id=String(payload?.id||activeScene);result=import('../world/rea/sceneBattle.js').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.probeSceneBattle({scene:globalThis.__tm?.scene,camera:globalThis.__tm?.camera,id,scale:payload?.scale,gridRadius:payload?.gridRadius});});break;}
 case 'battle.preview':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/sceneBattle.js').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');const r=m.deploySceneBattle({scene:globalThis.__tm?.scene,camera:globalThis.__tm?.camera,id:String(payload?.id||activeScene),plan});if(!r.ok)throw Error(r.reason||'战斗部署失败');return r;});break;}
 case 'battle.compare':{result=import('../world/rea/sceneBattle.js').then(m=>m.compareSceneBattle(!!payload?.on));break;}
 case 'battle.revert':{result=import('../world/rea/sceneBattle.js').then(m=>({stopped:m.stopSceneBattle()}));break;}
 case 'battle.commit':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/sceneBattle.js').then(m=>m.commitSceneBattle(String(payload?.id||activeScene),plan));break;}
 case 'battle.state':{result=import('../world/rea/sceneBattle.js').then(m=>m.battleSnapshot());break;}
 // 山形管线（world/rea/mountainCandidate.js）：probe 采高度网格与掩码，preview 换 low poly 山体，revert 恢复，commit 存本机
 // 表现层（world/rea/fxOverlay.js）：fx 工坊验证过的计划画成实景线层（前线/镜头/尾迹），不写存档
 case 'fx.preview':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/fxOverlay.js').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');const r=m.previewSceneFx({scene:globalThis.__tm.scene,id:String(payload?.id||activeScene),plan});if(!r.ok)throw Error(r.reason||'fx 预览失败');return r;});break;}
 case 'fx.compare':{result=import('../world/rea/fxOverlay.js').then(m=>m.compareSceneFx(!!payload?.on));break;}
 case 'fx.revert':{result=import('../world/rea/fxOverlay.js').then(m=>m.revertSceneFx());break;}
 case 'fx.state':{result=import('../world/rea/fxOverlay.js').then(m=>m.fxState());break;}
 // R37–R40 表现层实景能力（world/rea/fxLive.js）：火粒子 / 走廊样板 / 崖面层带 / 弹道 + fx.camera 路径真实驱动镜头；只存本机草稿，不改存档
 case 'fx.live.preview':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.previewSceneFxLive({scene:globalThis.__tm.scene,id:String(payload?.id||activeScene),plan});});break;}
 case 'fx.live.compare':{result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.compareSceneFxLive(!!payload?.on));break;}
 case 'fx.live.revert':{result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.revertSceneFxLive());break;}
 case 'fx.live.commit':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.commitSceneFxLive({id:String(payload?.id||activeScene),plan}));break;}
 case 'fx.live.state':{result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.fxLiveState());break;}
 case 'fx.live.focus':{const layer=String(payload?.layer||'fire');if(!['fire','hallway','sediment','projectiles'].includes(layer))throw Error('未知层 '+layer);result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.focusSceneFxLive({layer,distance:Number(payload?.distance)||9}));break;}
 case 'fx.camera.fly':{const plan=payload?.plan&&typeof payload.plan==='object'?structuredClone(payload.plan):null;result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.startCameraFlight({id:String(payload?.id||activeScene),plan,seconds:payload?.seconds==null?null:Number(payload.seconds),autoRestore:!!payload?.autoRestore}));break;}
 case 'fx.camera.stop':{result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.stopCameraFlight());break;}
 case 'fx.camera.state':{result=import('../world/rea/fxLive.js?v=fxe-r1').then(m=>m.cameraFlightState());break;}
 case 'mountain.probe':{const id=String(payload?.id||activeScene);result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.probeMountain({scene:globalThis.__tm.scene,id});});break;}
 case 'mountain.preview':{const plan=payload?.plan;if(!plan||typeof plan!=='object'||!Array.isArray(plan.h)||plan.h.length>400000)throw Error('山形计划无效');result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');const r=m.previewMountain({scene:globalThis.__tm.scene,id:String(payload?.id||activeScene),plan});if(!r.ok)throw Error(r.reason||'山形预览失败');return r;});break;}
 case 'mountain.compare':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.compareMountain(!!payload?.on));break;}
 case 'mountain.revert':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.revertMountain());break;}
 case 'mountain.commit':{const plan=payload?.plan;if(!plan||!Array.isArray(plan.h))throw Error('山形计划无效');result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>{const r=m.commitMountain(String(payload?.id||activeScene),plan);if(!r.ok)throw Error(r.reason);return r;});break;}
 case 'mountain.state':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.mountainState());break;}
 // R25–R28 山形验收：走一圈检验 / 固定机位 / 实景换配色 / 当前计划 / 回原山形 / 采用状态（与 main.js 同一个 ?v，保证是同一份模块状态）
 case 'mountain.walk':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.walkCheck({placePlayer:!!payload?.placePlayer,readPlayer:!!payload?.readPlayer}));break;}
 case 'mountain.camera':{const view=String(payload?.view||'front');if(!/^(front|side|top|oblique|eye|free)$/.test(view))throw Error('没有这个机位');result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.cameraView({view}));break;}
 case 'mountain.palette':{const p=payload?.palette;if(p!=null&&![0,1,2].includes(Number(p)))throw Error('没有这套配色');result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.paletteMountain(p==null?null:Number(p)));break;}
 case 'mountain.current':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.currentMountain());break;}
 case 'mountain.unadopt':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.unadoptMountain(String(payload?.id||activeScene)));break;}
 case 'mountain.adopted':{result=import('../world/rea/mountainCandidate.js?v=mountain-r28').then(m=>m.adoptedState(String(payload?.id||activeScene)));break;}
 // REA 地形候选（world/rea/reaTerrainCandidate.js）：库的方法重建地形——采样→细胞网格层化→台地几何
 // 轨道 / 桥采样时天然排除，净空保留；probe 只审不画，preview 藏原地形换候选，revert 拆回原样
 // 十二门徒地形候选（world/rea/apostlesLookProbe.js，R29–R32）：只读采样与检查；view 只动编辑镜头。外观切换走网址参数重载，这里不写任何存档 / localStorage
 case 'apostles.look.state':{result=import('../world/rea/apostlesLookProbe.js?v=apt-r1').then(m=>m.sampleApostleState());break;}
 case 'apostles.look.probe':{result=import('../world/rea/apostlesLookProbe.js?v=apt-r1').then(m=>m.probeApostlesLook());break;}
 case 'apostles.look.checks':{result=import('../world/rea/apostlesLookProbe.js?v=apt-r1').then(m=>m.checkApostlesSurface());break;}
 case 'apostles.look.view':{const view=String(payload?.view||''),massId=typeof payload?.massId==='string'&&/^[\w-]{1,32}$/.test(payload.massId)?payload.massId:undefined;result=import('../world/rea/apostlesLookProbe.js?v=apt-r1').then(m=>m.setApostleView(view,{massId}));break;}
 // R48 地貌候选（world/rea/reliefCandidate.js，地形管线重做旧港湾等场景）：probe 只采样；preview 藏原地形、贴候选；compare / revert 对照与拆回；不写任何存档 / localStorage、不改默认
 case 'relief.probe':{const id=String(payload?.id||activeScene||'old-port'),terrain=typeof payload?.terrain==='string'?payload.terrain:null;result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.probeRelief({scene:globalThis.__tm.scene,id,terrain});});break;}
 case 'relief.preview':{const id=String(payload?.id||activeScene||'old-port');result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.previewRelief({scene:globalThis.__tm.scene,id,plan:payload?.plan,lines:payload?.lines!==false});});break;}
 case 'relief.compare':{result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>m.compareRelief({on:payload?.on!==false}));break;}
 case 'relief.revert':{result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>m.revertRelief());break;}
 case 'relief.state':{result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>m.reliefState());break;}
 case 'relief.view':{const id=String(payload?.id||activeScene||'old-port'),view=String(payload?.view||'oblique');result=import('../world/rea/reliefCandidate.js?v=relief-r1').then(m=>m.reliefView({camera:globalThis.__tm?.camera,id,view}));break;}
 case 'terrain.rea.probe':{const id=String(payload?.id||activeScene);result=import('../world/rea/reaTerrainCandidate.js').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.probeReaTerrain({scene:globalThis.__tm?.scene,camera:globalThis.__tm?.camera,id,scale:payload?.scale,gridRadius:payload?.gridRadius,levelHeight:payload?.levelHeight});});break;}
 case 'terrain.rea.preview':{const id=String(payload?.id||activeScene);result=import('../world/rea/reaTerrainCandidate.js').then(m=>{if(!globalThis.__tm?.scene)throw Error('游戏场景尚未就绪');return m.previewReaTerrain({scene:globalThis.__tm?.scene,camera:globalThis.__tm?.camera,id,scale:payload?.scale,gridRadius:payload?.gridRadius,levelHeight:payload?.levelHeight});});break;}
 case 'terrain.rea.revert':{result=import('../world/rea/reaTerrainCandidate.js').then(m=>m.revertReaTerrain());break;}
 case 'terrain.rea.state':{result=import('../world/rea/reaTerrainCandidate.js').then(m=>m.reaTerrainState());break;}
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
 case 'play':{
  // 游玩检验跟随工坊「当前场景」：payload.id 缺省 / 非法时回落莫西斯湖（与进入编辑相同）
  const id=playtestSceneId(payload?.id);
  setGroup(null);
  document.body.classList.remove('studio-edit');
  setCaptureMode(false);
  const placed=plugin.play?.(id);
  result={playing:true,scene:id,placed:placed||null,captureMode:isCaptureMode()};
  break;}
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
