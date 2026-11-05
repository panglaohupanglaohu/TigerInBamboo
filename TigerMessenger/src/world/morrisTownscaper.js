import {resolveObjectHit,describeSceneObject} from '../scene-authoring/scene-objects.js';
import {validateRecipe,effectiveSettings,DEFAULT_SETTINGS} from '../scene-authoring/pipeline-model.js';
import {resolveSceneVersion} from '../scene-authoring/store.js';
import {mountSceneWorkbench} from '../scene-authoring/workbench.js';
import * as T from 'three';
// Morris lake construction on REACodeRefactoring (src/vendor/townscaper-rea-refactoring, unchanged):
// one grid, one voxel World; WorldMesh (terrain + buildings + baked AO/bounce), shore, outline,
// birds, vegetation, atmosphere, decor, effects and sound run in MorrisTownStage.
import {buildQuadGrid} from '../vendor/townscaper-rea-refactoring/src/core/grid.js';
import {decorateCells,buildCellIndex,pointInQuad} from '../vendor/townscaper-rea-refactoring/src/core/spatial.js';
import {World,MAX_LEVEL} from '../vendor/townscaper-rea-refactoring/src/core/world.js';
import {PALETTES} from '../vendor/townscaper-rea-refactoring/src/core/palette.js';
import {encodeWorld,decodeWorld} from '../vendor/townscaper-rea-refactoring/src/world/save.js';
import {MorrisTownStage} from './morrisTownStage.js?v=reacode-refactor-r2';
import {mountMorrisTownMenu} from './morrisTownscaperMenu.js?v=apostles-edit-r1';
import {createMorrisTownLighting} from './morrisTownscaperLighting.js?v=reacode-refactor-r2';
import {migrateLegacyTown} from './morrisTownscaperLegacy.js?v=reacode-refactor-r1';
import {morrisViewer} from './morrisViewer.js';
import {onUiLayersChange} from '../ui/uiLayers.js?v=ui-layers-r1';
import {P} from '../core/params.js';
const STORAGE='morris-townscaper-refactor-v1',SAVES='morris-townscaper-refactor-saves-v1';
const LEGACY_STORAGE='morris-townscaper-rea-v1',LEGACY_SAVES='morris-townscaper-saves-v1';
export const MORRIS_TOWN_GRID_RADIUS=28,MORRIS_TOWN_SCALE=3;
// Flat lake surface in town units: polar strips out to the shoreline, minus protected sites (~12k triangles instead of the ~82k grid).
function lakeSurfaceGeometry({edge,ratio,isProtected,scale,segments=256,rings=24}){
 const pos=[],at=(a,t)=>{const r=edge(a)*ratio*t;return[Math.cos(a)*r,Math.sin(a)*r];};
 for(let i=0;i<segments;i++){const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2;for(let j=0;j<rings;j++){const t0=j/rings,t1=(j+1)/rings,p00=at(a0,t0),p01=at(a0,t1),p10=at(a1,t0),p11=at(a1,t1);
  for(const tri of j===0?[[p00,p11,p01]]:[[p00,p11,p01],[p00,p10,p11]]){const cx=(tri[0][0]+tri[1][0]+tri[2][0])/3,cz=(tri[0][1]+tri[1][1]+tri[2][1])/3;if(isProtected?.(cx,cz))continue;for(const [x,z]of tri)pos.push(x/scale,0,z/scale);}}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;}
export function installMorrisTownscaper({root,terrain,water,edge}){
 const scale=MORRIS_TOWN_SCALE,grid=decorateCells(buildQuadGrid({radius:MORRIS_TOWN_GRID_RADIUS,hexSize:1})),index=buildCellIndex(grid),world=new World(grid);world.palette=PALETTES.town;
 // Anchor: town units -> island-local (lake surface, x3). The stage renders in its own untilted scene.
 const anchor=new T.Group();anchor.name='morris-townscaper-local-frame';anchor.position.y=water.position.y;anchor.scale.setScalar(scale);root.add(anchor);
 const waterGeometry=edge?lakeSurfaceGeometry({edge,ratio:terrain.lakeRatio,isProtected:terrain.isProtected,scale}):water.geometry.clone().scale(1/scale,1/scale,1/scale);water.visible=false;
 const stage=new MorrisTownStage({world,grid,index,waterGeometry,anchor});
 // Invisible copy in the game scene: patrol / hoof support raycasts keep hitting the real town surface.
 const mesh=new T.Mesh(stage.worldMesh.geometry,new T.MeshBasicMaterial({visible:false}));mesh.name='morris-user-townscaper-castle';mesh.userData.authoringPickProxy=true;mesh.userData.authoringLabel='湖上建筑与地形';mesh.userData.authoringKind='体素合并网格（只读）';anchor.add(mesh);
 stage.onGeometry=g=>{mesh.geometry=g;stage.focusPoint=null;};
 const withinLake=cell=>cell.pts.every(p=>terrain.inLake(p.x*scale,p.z*scale));
 const allowed=cell=>withinLake(cell)&&cell.pts.every(p=>!terrain.isProtected?.(p.x*scale,p.z*scale));
 const clip=()=>{for(const c of grid.cells)if(!allowed(c)&&world.solid[c.id]){world.solid[c.id]=0;world.rock[c.id]=0;world.river[c.id]=0;}world.touch();};
 const undo=[],redo=[];let pickingObject=false,pickCallback=null,pickDown=null,inspectingObject=false,active=false,color=0,mode='build',scene='town',storageError='',restoredSave=false,migrated=false,seededCastle=false,manualTime=null;
 const rebuild=()=>stage.update(0);
 const encode=()=>encodeWorld(world,scene);
 const load=str=>{scene=decodeWorld(str,world);clip();};
 // Edit targets: the lake (default) or one of the Twelve Apostles masses (apostlesReacode.js, morrisViewer.apostles).
 // Every edit path below goes through `target`: world / anchor / allowed / pickRay / updateHover / rebuild / undo / redo.
 const morrisTarget={id:'morris',kind:'morris',name:'莫西斯湖',world,anchor,snapshot:()=>world.snapshot(),restore:s=>world.restore(s),allowed,maxLevel:()=>MAX_LEVEL,clip,pickRay:r=>stage.pickRay(r),updateHover:(h,m)=>stage.updateHover(h,m),rebuild:()=>rebuild(),undo,redo,setEditing(){}};
 let target=morrisTarget;
 const versionId=new URLSearchParams(location.search).get('sceneVersion');
 let pinnedVersion=null;
 if(versionId){try{pinnedVersion=resolveSceneVersion(localStorage,'morris-lake',versionId);}catch(e){storageError=e.message;}}
 try{const saved=pinnedVersion?.data||new URLSearchParams(location.search).get('morrisTown')||localStorage.getItem(STORAGE);if(saved){load(saved);restoredSave=true;}}catch{storageError='存档无法读取';pinnedVersion=null;world.reset();}
 if(!versionId&&!restoredSave){try{const legacy=localStorage.getItem(LEGACY_STORAGE);if(legacy&&migrateLegacyTown(legacy,world)){clip();restoredSave=migrated=true;localStorage.setItem(STORAGE,encode());}}catch{storageError='旧版存档无法迁移';world.reset();}}
 // Named saves from the original REACode menu move to v5 once; the old list is kept untouched as a backup.
 try{if(!localStorage.getItem(SAVES)){const old=JSON.parse(localStorage.getItem(LEGACY_SAVES)||'[]');if(Array.isArray(old)&&old.length){const probe=new World(grid);const rows=[];for(const r of old){try{if(r&&typeof r.data==='string'&&migrateLegacyTown(r.data,probe)){rows.push({id:r.id,name:r.name,time:r.time,data:encodeWorld(probe,'town'),migratedFrom:'reacode-v3'});}}catch{}}localStorage.setItem(SAVES,JSON.stringify(rows));}}}catch{}
 // No generated terrain on startup: the lake belongs to the user's saved Townscaper build.
 // Mountain generation remains an explicit editor action, never a missing-save fallback.
 let mountain=null;
 rebuild();
 if(versionId){const banner=document.createElement('p');banner.id='scene-version-status';banner.style.cssText='position:fixed;top:4px;left:30%;z-index:250;background:#f4e9cf;color:#25483e;padding:8px';banner.textContent=pinnedVersion?'莫里斯固定版本 · '+versionId:'固定版本加载失败 · '+storageError+'（当前显示本机工作区）';document.body.append(banner);}
 const panel=document.createElement('section');panel.id='morris-townscaper';panel.style.cssText='position:fixed;left:14px;bottom:65px;z-index:230;background:#f4e9cfee;color:#25483e;padding:10px;border-radius:10px;max-width:340px;font:13px system-ui';
 const toggle=document.createElement('button');toggle.textContent='Townscaper · 开始建城';panel.append(toggle);const body=document.createElement('div');body.hidden=true;panel.append(body);
 const info=document.createElement('div');info.textContent='左键划动建造 · Shift/右键删单层 · 右键拖动旋转（REACode 重构版）';body.append(info);
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=fn;body.append(b);return b;}
 const status=document.createElement('div');status.textContent=storageError||(migrated?'旧版存档已迁移到重构版网格':'');body.append(status);
 const persist=()=>{if(target!==morrisTarget){status.textContent=target.persist()?'已保存到本机（'+target.name+'）':'本机存储不可用';return;}rebuild();try{if(versionId){status.textContent='固定版本预览：修改仅留在本次编辑；请保存实验快照';return;}localStorage.setItem(STORAGE,encode());status.textContent='已保存到本机';}catch{status.textContent='本机存储不可用，请导出存档';}};
 const remember=()=>{target.undo.push(target.snapshot());if(target.undo.length>60)target.undo.shift();target.redo.length=0;};
 for(const tool of ['build','erase','paint','rock'])button({build:'建造',erase:'拆除',paint:'涂色',rock:'岩石'}[tool],()=>{mode=tool;status.textContent={build:'建造',erase:'拆除',paint:'涂色',rock:'岩石'}[tool];});
 button('撤销',()=>{const t=target;if(t.undo.length){t.redo.push(t.snapshot());t.restore(t.undo.pop());persist();}});button('重做',()=>{const t=target;if(t.redo.length){t.undo.push(t.snapshot());t.restore(t.redo.pop());persist();}});
 button('清空',()=>{remember();if(target!==morrisTarget){target.reset();status.textContent='已恢复生成的岩体（'+target.name+'）';return;}world.reset();persist();});
 button('导出',()=>{const blob=new Blob([target===morrisTarget?encode():target.encode()],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=target===morrisTarget?'morris-castle.town':target.id.replace(':','-')+'.town';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const importText=text=>{if(target!==morrisTarget){status.textContent='十二门徒请直接在岩体上编辑';return false;}const snap=world.snapshot();try{try{load(text);}catch{if(!migrateLegacyTown(text,world))throw Error('format');clip();}undo.push(snap);if(undo.length>60)undo.shift();redo.length=0;persist();return true;}catch{world.restore(snap);rebuild();return false;}};
 const input=document.createElement('input');input.type='file';input.accept='.town,.txt';input.hidden=true;body.append(input);button('导入',()=>input.click());input.onchange=async()=>{if(!importText(await input.files[0].text()))status.textContent='无法导入：存档不匹配';input.value='';};
 const colors=document.createElement('div');body.append(colors);world.palette.colors.forEach((hex,i)=>{const b=document.createElement('button');b.title=`颜色 ${i+1}`;b.style.cssText=`background:${hex};width:21px;height:21px;margin:2px;border:1px solid #fff`;b.onclick=()=>{color=i;status.textContent=`颜色 ${i+1}`;};colors.append(b);});
 const saveToggle=document.createElement('button');saveToggle.textContent='保存菜单';saveToggle.style.margin='3px';panel.insertBefore(saveToggle,body);
 const saveMenu=document.createElement('div');saveMenu.hidden=true;saveMenu.style.cssText='border-top:1px solid var(--panel-line);margin-top:8px;padding-top:8px';panel.append(saveMenu);
 const saveName=document.createElement('input');saveName.type='text';saveName.placeholder='城堡名称';saveName.maxLength=60;saveName.setAttribute('aria-label','城堡名称');for(const event of ['keydown','keyup'])saveName.addEventListener(event,e=>e.stopPropagation());saveName.style.cssText='width:95%;box-sizing:border-box;margin-bottom:6px';saveMenu.append(saveName);
 const saveList=document.createElement('select');saveList.setAttribute('aria-label','已保存的城堡');saveList.style.cssText='width:95%;display:block;margin:6px 0';
 const saveStatus=document.createElement('div');saveStatus.setAttribute('role','status');
 const readSaves=()=>{const rows=JSON.parse(localStorage.getItem(SAVES)||'[]');if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.data!=='string'||!Number.isFinite(r.time)))throw Error('invalid saves');return rows;};
 function refreshSaves(selected){try{const rows=readSaves();saveList.replaceChildren();for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.name+' · '+new Date(row.time).toLocaleString();saveList.append(option);}if(!rows.length){const option=document.createElement('option');option.value='';option.textContent='暂无已保存方案';saveList.append(option);}if(selected)saveList.value=selected;}catch{saveStatus.textContent='无法读取本机方案，仍可导出当前城堡';}}
 function saveButton(label,action){const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=action;saveMenu.append(b);return b;}
 saveButton('保存新方案',()=>{try{const rows=readSaves(),time=Date.now(),id=globalThis.crypto?.randomUUID?.()||String(time)+'-'+Math.random().toString(36).slice(2),name=saveName.value.trim()||'未命名城堡';rows.unshift({id,name,time,data:encode()});localStorage.setItem(SAVES,JSON.stringify(rows));refreshSaves(id);saveStatus.textContent='已保存「'+name+'」到本机';}catch{saveStatus.textContent='保存失败，本机空间不可用；请导出当前城堡';}});
 saveMenu.append(saveList);
 saveButton('读取选中方案',()=>{const row=(()=>{try{return readSaves().find(r=>r.id===saveList.value);}catch{return null;}})();if(!row){saveStatus.textContent='请先保存或选择一个方案';return;}if(importText(row.data)){saveName.value=row.name;saveStatus.textContent='已读取「'+row.name+'」，可用撤销恢复';}else saveStatus.textContent='读取失败，当前城堡已保留';});
 saveButton('导出当前城堡',()=>[...body.querySelectorAll('button')].find(b=>b.textContent==='导出').click());
 saveButton('导入城堡文件',()=>input.click());
 const storageHint=document.createElement('div');storageHint.textContent='方案保存在当前浏览器；导出文件可备份或转移。';storageHint.style.cssText='font-size:12px;margin-top:6px';saveMenu.append(saveStatus,storageHint);
 saveToggle.onclick=()=>{saveMenu.hidden=!saveMenu.hidden;if(!saveMenu.hidden)refreshSaves();};
 toggle.onclick=()=>{active=!active;target.setEditing(active);if(active){manualTime='day';stage.setTimeOfDay('day');menu.syncLighting('day');}else{manualTime=null;menu.restoreCamera();target.updateHover(null);}body.hidden=!active;toggle.textContent=active?'Townscaper · 结束建造':'Townscaper · 开始建城';if(!active){stage.updateHover(null);saveMenu.hidden=target!==morrisTarget;if(!saveMenu.hidden)refreshSaves();}};document.body.append(panel);
 const menu=mountMorrisTownMenu({panel,body,world,stage,anchor,getWorld:()=>target.world,getAnchor:()=>target.anchor,isMorris:()=>target===morrisTarget,setColor:i=>color=i,setTool:key=>mode=key,setTime:m=>{manualTime=m;},getScene:()=>scene,setScene:s=>{scene=s;},remember,persist,clip,allowed,activate(){if(!active)toggle.click();},returnToPlayer(){if(active)toggle.click();else menu.restoreCamera();morrisViewer.returnToPlayer?.();}});
 // Build target dropdown (bottom-left panel): 莫西斯湖 / 十二门徒 · <mass>; the apostles appear once they are built.
 const targetRow=document.createElement('label');targetRow.style.cssText='display:block;margin:0 0 6px';targetRow.textContent='构建对象 ';
 const targetSelect=document.createElement('select');targetSelect.id='morris-town-target';targetSelect.setAttribute('aria-label','构建对象');targetSelect.style.cssText='max-width:220px';targetRow.append(targetSelect);panel.insertBefore(targetRow,panel.firstChild);
 let listed='';
 const refreshTargets=()=>{const list=[{id:'morris',name:'莫西斯湖'},...(morrisViewer.apostles?[{id:'apostles',name:'十二门徒'}]:[])],editors=morrisViewer.buildEditors||[],key=[...list,...editors].map(t=>t.id).join('|');if(key===listed)return;listed=key;targetSelect.replaceChildren();
  const add=(parent,t)=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;parent.append(o);};add(targetSelect,list[0]);
  for(const t of list.slice(1))add(targetSelect,t);
  // castle / crystal city: their own build panels (same 构建 editor group)
  if(editors.length){const g=document.createElement('optgroup');g.label='城堡与城市';for(const t of editors)add(g,t);targetSelect.append(g);}
  targetSelect.value=target.id;};
 const selectTarget=id=>{const editor=(morrisViewer.buildEditors||[]).find(t=>t.id===id);if(editor){targetSelect.value=target.id;if(active)toggle.click();editor.open();status.textContent='已打开：'+editor.name;return;}
  const next=id==='morris'?morrisTarget:id==='apostles'?morrisViewer.apostles?.root:morrisViewer.apostles?.target(id);if(!next){targetSelect.value=target.id;return;}
  if(next!==target){stroke=null;target.updateHover(null);target.setEditing(false);target=next;target.setEditing(active);}
  saveToggle.hidden=target!==morrisTarget;if(target!==morrisTarget)saveMenu.hidden=true;
  if(!active)toggle.click();menu.redrawPalette();status.textContent='正在编辑：'+target.name;targetSelect.value=target.id;};
 targetSelect.onchange=()=>selectTarget(targetSelect.value);
 for(const ev of['pointerdown','focus'])targetSelect.addEventListener(ev,()=>refreshTargets());
 for(const ev of['keydown','keyup'])targetSelect.addEventListener(ev,e=>e.stopPropagation());
 refreshTargets();
 // Visibility belongs to the UI layer manager (构建 editor group, dev only); closing the group ends editing.
 const offLayers=onUiLayersChange(({group})=>{if(group==='build')refreshTargets();else if(active)toggle.click();});
 const ray=new T.Raycaster(),ndc=new T.Vector2(),inv=new T.Matrix4();let down=null,stroke=null;
 const isCanvas=e=>e.target?.tagName==='CANVAS';
 function pick(e){const camera=morrisViewer.camera;if(!camera)return null;const rect=e.target.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(ndc,camera);if(target.pickWorldRay)return target.pickWorldRay(ray.ray);const a=target.anchor;a.updateWorldMatrix(true,false);const local=ray.ray.clone().applyMatrix4(inv.copy(a.matrixWorld).invert());local.direction.normalize();const hit=target.pickRay(local);return hit&&target.allowed(hit.cell)?hit:null;}
 // REACodeRefactoring/src/world/app.js applyAt(): build fills the clicked empty level or stacks; erase removes one voxel; paint recolours the column.
 function apply(hit,erase=false){if(!hit||!stroke)return;const world=hit.world||target.world,maxLevel=hit.maxLevel||target.maxLevel,cell=hit.cell,tool=erase?'erase':mode,key=(hit.leaf?.id||'')+cell.id+':'+tool;if(stroke.edits.has(key))return;
  const top=world.top(cell),level=Math.max(1,Math.min(MAX_LEVEL,hit.level||top||1));
  if(tool==='build'||tool==='rock'){const lv=!world.isSolid(cell,level)?level:Math.min(MAX_LEVEL,top+1);if(lv<1||world.isSolid(cell,lv)||lv>maxLevel(cell))return;
   // rock: a terrain voxel (terrain pipeline: cliffs / strata / turf); build: a Townscaper house voxel in the chosen colour
   if(tool==='rock')world.setSolid(cell,lv,true,{rock:true});else{world.setSolid(cell,lv,true);if(lv>=2||world.ground(cell)>0)world.color[cell.id]=color;}}
  else if(tool==='erase'){const target=world.isSolid(cell,level)?level:top;if(!target)return;world.setSolid(cell,target,false);if(!world.ground(cell))world.river[cell.id]=0;}
  else{if(world.color[cell.id]===color)return;world.color[cell.id]=color;world.touch();}
  stroke.edits.add(key);stroke.changed=true;target.rebuild(hit);}
 const onDown=e=>{if(!active||inspectingObject||pickingObject||!isCanvas(e))return;if(e.button===2){down={x:e.clientX,y:e.clientY};return;}if(e.button!==0||e.altKey)return;stroke={snapshot:target.snapshot(),edits:new Set(),changed:false};apply(pick(e),e.shiftKey);e.preventDefault();e.stopImmediatePropagation();};
 const onMove=e=>{if(!active||inspectingObject||pickingObject||!isCanvas(e))return;const hit=pick(e);target.updateHover(hit,e.shiftKey?'erase':mode==='rock'?'build':mode);if(stroke){apply(hit,e.shiftKey);e.preventDefault();e.stopImmediatePropagation();}};
 const finish=()=>{if(stroke?.changed){target.undo.push(stroke.snapshot);if(target.undo.length>60)target.undo.shift();target.redo.length=0;persist();}stroke=null;};
 const onUp=e=>{if(inspectingObject||pickingObject)return;if(stroke){finish();e.preventDefault();e.stopImmediatePropagation();return;}if(!active||!down||!isCanvas(e))return;const start=down;down=null;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;stroke={snapshot:target.snapshot(),edits:new Set(),changed:false};apply(pick(e),true);finish();e.preventDefault();e.stopImmediatePropagation();};
 const onCancel=()=>{finish();down=null;stage.updateHover(null);};
 const context=e=>{if(active&&isCanvas(e))e.preventDefault();};
 window.addEventListener('pointerdown',onDown,true);window.addEventListener('pointerup',onUp,true);window.addEventListener('pointermove',onMove,true);window.addEventListener('pointercancel',onCancel,true);window.addEventListener('blur',onCancel);window.addEventListener('contextmenu',context,true);
 // Render hooks read by main.js: the town is drawn after the main pass; near the lake the main pass stays direct so depth is shared.
 const center=new T.Vector3();
 morrisViewer.townOverlayActive=camera=>!!camera&&stage.visible&&camera.position.distanceTo(root.getWorldPosition(center))<1400;
 morrisViewer.renderTownOverlay=({renderer,camera})=>{if(morrisViewer.townOverlayActive(camera))stage.renderOverlay({renderer,camera});};
 // Entering Morris Lake: the main pass uses the build-time (REACodeRefactoring) lighting as well, with hysteresis at the shore.
 const lighting=createMorrisTownLighting({group:anchor,world});waterGeometry.computeBoundingSphere();
 const lakeRadius=()=>waterGeometry.boundingSphere.radius*anchor.getWorldScale(new T.Vector3()).x;let inLake=false;
 const updateInLake=camera=>{if(!camera||!stage.visible)return inLake=false;const d=camera.position.distanceTo(root.getWorldPosition(center)),r=lakeRadius();inLake=(target===morrisTarget&&(!!morrisViewer.applyTownCamera||active))||d<(inLake?r*2.1:r*1.8);return inLake;};
 morrisViewer.isInMorrisLake=()=>inLake;
 morrisViewer.beginTownRender=({scene,renderer,camera})=>updateInLake(camera)?lighting.beginRender({scene,renderer}):null;
 let last=performance.now()/1000,lastMode=null,targetPoll=0;
 const autoMode=()=>P.timeOfDay<.2||P.timeOfDay>.85?'night':P.timeOfDay>.65?'dusk':'day';
 const authoringSettings=()=>({waves:stage.waves.visible,reflection:stage.reflection.visible,time:stage.timeOfDay,outline:stage.outline.ink.visible,grid:stage.gridLines.visible,vegetation:stage.vegetation.group.visible,birds:stage.birds.visible,fog:stage.atmosphere.fog.visible,snow:stage.atmosphere.snow.visible,fire:stage.effects.fire.visible});
 const applyAuthoringSettings=settings=>{for(const [k,v]of Object.entries(settings)){if(k==='time')menu.view.setTimeOfDay(v);else stage.setDebug(k,v);}};
 if(pinnedVersion?.settings){try{applyAuthoringSettings(pinnedVersion.settings);}catch{storageError='固定版本参数无法读取';}}
 else if(pinnedVersion?.recipe){try{validateRecipe(pinnedVersion.recipe);applyAuthoringSettings(effectiveSettings(pinnedVersion.recipe,pinnedVersion.recipe.baseline||DEFAULT_SETTINGS));}catch{storageError='固定版本管线参数无法读取';}}
 morrisViewer.sceneVersion=()=>({requested:versionId,loaded:pinnedVersion?.id||null,data:encode(),settings:authoringSettings()});
 let objectMarker=null;const clearObjectFocus=(restoreCamera=true)=>{inspectingObject=false;if(objectMarker){objectMarker.removeFromParent();objectMarker.geometry.dispose();objectMarker.material.dispose();objectMarker=null;}if(restoreCamera)menu.restoreCamera();};
 const focusObject=(object,localBounds=object.userData.authoringBounds,{frame=true}={})=>{object.updateWorldMatrix(true,true);const stored=localBounds,bounds=stored?new T.Box3(new T.Vector3().fromArray(stored.min),new T.Vector3().fromArray(stored.max)).applyMatrix4(object.matrixWorld):new T.Box3().setFromObject(object);if(bounds.isEmpty())throw Error('该对象暂缺可定位的几何边界');clearObjectFocus(frame);inspectingObject=true;target.updateHover(null);anchor.updateWorldMatrix(true,false);const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),scale=anchor.getWorldScale(new T.Vector3()).x;if(frame){menu.view.target.copy(anchor.worldToLocal(center));menu.view.distance=Math.max(6,size.length()/scale*1.7);menu.view.pitch=.16;menu.view.updateCamera();}const markerBounds=stored?new T.Box3(new T.Vector3().fromArray(stored.min),new T.Vector3().fromArray(stored.max)):bounds.clone().applyMatrix4(object.matrixWorld.clone().invert());objectMarker=new T.Box3Helper(markerBounds,0x87e6cb);objectMarker.name='workshop-object-selection';objectMarker.material.depthTest=false;objectMarker.renderOrder=1000;object.add(objectMarker);};
 const setObjectPicking=(on,callback=null)=>{pickingObject=on;pickCallback=callback;pickDown=null;};
 const pickObjectDown=e=>{if(!pickingObject||e.button!==0||!isCanvas(e))return;pickDown={x:e.clientX,y:e.clientY};e.preventDefault();e.stopImmediatePropagation();};
 const pickObjectUp=e=>{if(!pickingObject||e.button!==0||!pickDown||!isCanvas(e))return;const start=pickDown;pickDown=null;e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;try{
  const rect=e.target.getBoundingClientRect(),picker=new T.Raycaster();picker.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),morrisViewer.camera);let sceneRoot=anchor;while(sceneRoot.parent)sceneRoot=sceneRoot.parent;sceneRoot.updateWorldMatrix(true,true);
  const hit=picker.intersectObject(sceneRoot,true).find(h=>{if(!h.object.isMesh)return false;for(let o=h.object;o;o=o.parent)if(!o.visible)return false;const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;return material?.visible!==false||h.object.userData.authoringPickProxy;});
  const row=hit&&resolveObjectHit(hit);if(!row){pickCallback?.(null,'未选中物件，请点击实体表面。');return;}focusObject(row.object,row.bounds,{frame:false});pickingObject=false;pickCallback?.(describeSceneObject(row));
 }catch(error){pickCallback?.(null,error.message);}};
 window.addEventListener('pointerdown',pickObjectDown,true);window.addEventListener('pointerup',pickObjectUp,true);
 const authoring=mountSceneWorkbench({editorHud:menu.hud,focusObject,clearObjectFocus,setObjectPicking,settings:authoringSettings,apply:applyAuthoringSettings,id:'morris-lake',name:'莫西斯湖',play:()=>{menu.restoreCamera();morrisViewer.returnToPlayer?.();},open:()=>{selectTarget('morris');menu.view.frameTown();},encode,restore:data=>{selectTarget('morris');if(!importText(data))throw Error('存档无法恢复');},validate:data=>{const probe=new World(grid);try{const mode=decodeWorld(data,probe);return {passed:encodeWorld(probe,mode)===data,message:'编码往返不一致',scope:'codec-only'};}catch{return {passed:false,message:'场景编码无效'};}}});
 return{selectTarget,get target(){return target;},town:world,world,grid,index,mesh,stage,anchor,birds:stage.birds,undo,redo,seededCastle,migrated,mountain,encode,
  update(){const now=performance.now()/1000,dt=Math.min(.05,Math.max(0,now-last));last=now;const m=manualTime??(inLake?'day':autoMode());if(m!==lastMode){lastMode=m;stage.setTimeOfDay(m);lighting.setMode(m);menu.syncLighting(m);}stage.update(dt);if(++targetPoll%30===0)refreshTargets();menu.update(false);},
  dispose(){setObjectPicking(false);window.removeEventListener('pointerdown',pickObjectDown,true);window.removeEventListener('pointerup',pickObjectUp,true);clearObjectFocus();morrisViewer.sceneVersion=null;document.getElementById('scene-version-status')?.remove();authoring.dispose();offLayers();menu.dispose();lighting.dispose();if(morrisViewer.beginTownRender)morrisViewer.beginTownRender=null;morrisViewer.isInMorrisLake=null;stage.dispose();anchor.removeFromParent();panel.remove();if(morrisViewer.renderTownOverlay)morrisViewer.renderTownOverlay=null;morrisViewer.townOverlayActive=null;window.removeEventListener('pointerdown',onDown,true);window.removeEventListener('pointerup',onUp,true);window.removeEventListener('pointermove',onMove,true);window.removeEventListener('pointercancel',onCancel,true);window.removeEventListener('blur',onCancel);window.removeEventListener('contextmenu',context,true);}};
}
