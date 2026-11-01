import * as T from 'three';
import {buildQuadGrid} from '../vendor/townscaper-rea/quadgrid.js';
import {Town,decorateCells,buildCellIndex,pointInQuad,MAX_HEIGHT} from '../vendor/townscaper-rea/town.js';
import {TownMesh} from '../vendor/townscaper-rea/townmesh.js';
import {encodeTown,decodeTown} from '../vendor/townscaper-rea/save.js';
import {createMorrisTownEffects} from './morrisTownscaperEffects.js?v=gulls-r1';
import {mountMorrisTownMenu} from './morrisTownscaperMenu.js?v=gulls-r1';
import {seedMorrisCastle} from './morrisCastlePatrolRoute.js';
import {morrisViewer} from './morrisViewer.js';
const STORAGE='morris-townscaper-rea-v1';
const SAVES='morris-townscaper-saves-v1';
export function installMorrisTownscaper({root,terrain,water}){
 const grid=decorateCells(buildQuadGrid({radius:30,hexSize:1})),index=buildCellIndex(grid),town=new Town(grid),builder=new TownMesh(town,grid,{levelHeight:.5});
 const effects=createMorrisTownEffects({root,water,builder,town,grid,index,scale:3}),mesh=effects.mesh;mesh.name='morris-user-townscaper-castle';
 const withinLake=cell=>cell.pts.every(p=>terrain.inLake(p.x*3,p.z*3));
 const allowed=cell=>withinLake(cell)&&cell.pts.every(p=>!terrain.isProtected(p.x*3,p.z*3));
 const undo=[],redo=[];let active=false,color=0,mode='build',storageError='',restoredSave=false,seededCastle=false;
 const rebuild=()=>effects.rebuild();
 try{const saved=new URLSearchParams(location.search).get('morrisTown')||localStorage.getItem(STORAGE);if(saved){decodeTown(saved,town);for(const c of grid.cells)if(!withinLake(c))town.solid[c.id]=0;town.version++;restoredSave=true;}}catch{storageError='存档无法读取';town.reset();}
 if(!restoredSave)seededCastle=seedMorrisCastle(town,allowed);
 rebuild();
 const panel=document.createElement('section');panel.id='morris-townscaper';panel.style.cssText='position:fixed;left:14px;bottom:65px;z-index:230;background:#f4e9cfee;color:#25483e;padding:10px;border-radius:10px;max-width:340px;font:13px system-ui';
 const toggle=document.createElement('button');toggle.textContent='Townscaper · 开始建城';panel.append(toggle);const body=document.createElement('div');body.hidden=true;panel.append(body);
 const info=document.createElement('div');info.textContent='左键划动建造 · Shift/右键删单层 · 右键拖动旋转';body.append(info);
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=fn;body.append(b);return b;}
 const status=document.createElement('div');status.textContent=storageError;body.append(status);
 const persist=()=>{rebuild();try{localStorage.setItem(STORAGE,encodeTown(town));status.textContent='已保存到本机';}catch{status.textContent='本机存储不可用，请导出存档';}};
 const remember=()=>{undo.push(town.snapshot());if(undo.length>60)undo.shift();redo.length=0;};
 for(const tool of ['build','erase','paint'])button({build:'建造',erase:'拆除',paint:'涂色'}[tool],()=>{mode=tool;status.textContent={build:'建造',erase:'拆除',paint:'涂色'}[tool];});
 button('撤销',()=>{if(undo.length){redo.push(town.snapshot());town.restore(undo.pop());persist();}});button('重做',()=>{if(redo.length){undo.push(town.snapshot());town.restore(redo.pop());persist();}});
 button('清空',()=>{remember();town.reset();persist();});
 button('导出',()=>{const blob=new Blob([encodeTown(town)],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='morris-castle.town';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const input=document.createElement('input');input.type='file';input.accept='.town,.txt';input.hidden=true;body.append(input);button('导入',()=>input.click());input.onchange=async()=>{const snap=town.snapshot();try{decodeTown(await input.files[0].text(),town);if(grid.cells.some(c=>!allowed(c)&&town.top(c)>0))throw Error('outside');undo.push(snap);redo.length=0;persist();}catch{town.restore(snap);rebuild();status.textContent='无法导入：存档不匹配或超出湖岸';}input.value='';};
 const colors=document.createElement('div');body.append(colors);town.palette.colors.forEach((hex,i)=>{const b=document.createElement('button');b.title=`颜色 ${i+1}`;b.style.cssText=`background:${hex};width:21px;height:21px;margin:2px;border:1px solid #fff`;b.onclick=()=>{color=i;status.textContent=`颜色 ${i+1}`;};colors.append(b);});
 const saveToggle=document.createElement('button');saveToggle.textContent='保存菜单';saveToggle.style.margin='3px';panel.insertBefore(saveToggle,body);
 const saveMenu=document.createElement('div');saveMenu.hidden=true;saveMenu.style.cssText='border-top:1px solid var(--panel-line);margin-top:8px;padding-top:8px';panel.append(saveMenu);
 const saveName=document.createElement('input');saveName.type='text';saveName.placeholder='城堡名称';saveName.maxLength=60;saveName.setAttribute('aria-label','城堡名称');for(const event of ['keydown','keyup'])saveName.addEventListener(event,e=>e.stopPropagation());saveName.style.cssText='width:95%;box-sizing:border-box;margin-bottom:6px';saveMenu.append(saveName);
 const saveList=document.createElement('select');saveList.setAttribute('aria-label','已保存的城堡');saveList.style.cssText='width:95%;display:block;margin:6px 0';
 const saveStatus=document.createElement('div');saveStatus.setAttribute('role','status');
 const readSaves=()=>{const rows=JSON.parse(localStorage.getItem(SAVES)||'[]');if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=='string'||typeof r.name!=='string'||typeof r.data!=='string'||!Number.isFinite(r.time)))throw Error('invalid saves');return rows;};
 function refreshSaves(selected){try{const rows=readSaves();saveList.replaceChildren();for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.name+' · '+new Date(row.time).toLocaleString();saveList.append(option);}if(!rows.length){const option=document.createElement('option');option.value='';option.textContent='暂无已保存方案';saveList.append(option);}if(selected)saveList.value=selected;}catch{saveStatus.textContent='无法读取本机方案，仍可导出当前城堡';}}
 function saveButton(label,action){const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=action;saveMenu.append(b);return b;}
 saveButton('保存新方案',()=>{try{const rows=readSaves(),time=Date.now(),id=globalThis.crypto?.randomUUID?.()||String(time)+'-'+Math.random().toString(36).slice(2),name=saveName.value.trim()||'未命名城堡';rows.unshift({id,name,time,data:encodeTown(town)});localStorage.setItem(SAVES,JSON.stringify(rows));refreshSaves(id);saveStatus.textContent='已保存「'+name+'」到本机';}catch{saveStatus.textContent='保存失败，本机空间不可用；请导出当前城堡';}});
 saveMenu.append(saveList);
 saveButton('读取选中方案',()=>{const snap=town.snapshot();try{const row=readSaves().find(r=>r.id===saveList.value);if(!row){saveStatus.textContent='请先保存或选择一个方案';return;}decodeTown(row.data,town);if(grid.cells.some(c=>!allowed(c)&&town.top(c)>0))throw Error('outside');undo.push(snap);if(undo.length>60)undo.shift();redo.length=0;persist();saveName.value=row.name;saveStatus.textContent='已读取「'+row.name+'」，可用撤销恢复';}catch{town.restore(snap);rebuild();saveStatus.textContent='读取失败，当前城堡已保留';}});
 saveButton('导出当前城堡',()=>[...body.querySelectorAll('button')].find(b=>b.textContent==='导出').click());
 saveButton('导入城堡文件',()=>input.click());
 const storageHint=document.createElement('div');storageHint.textContent='方案保存在当前浏览器；导出文件可备份或转移。';storageHint.style.cssText='font-size:12px;margin-top:6px';saveMenu.append(saveStatus,storageHint);
 saveToggle.onclick=()=>{saveMenu.hidden=!saveMenu.hidden;if(!saveMenu.hidden)refreshSaves();};
 // Keep the save menu available after leaving build mode.
 toggle.onclick=()=>{active=!active;effects.setBuildMode(active);if(active)menu.syncLighting('day');body.hidden=!active;toggle.textContent=active?'Townscaper · 结束建造':'Townscaper · 开始建城';if(!active){effects.updateHover(null,0);saveMenu.hidden=false;refreshSaves();}};document.body.append(panel);
 const menu=mountMorrisTownMenu({panel,body,town,effects,setColor:i=>color=i,setTool:key=>mode=key,remember,persist,allowed,activate(){if(!active)toggle.click();}});
 const ray=new T.Raycaster(),ndc=new T.Vector2();let down=null,stroke=null;
 const isCanvas=e=>e.target?.tagName==='CANVAS';
 function pick(e){const camera=morrisViewer.camera;if(!camera)return null;const rect=e.target.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(ndc,camera);effects.group.updateWorldMatrix(true,false);const localRay=ray.ray.clone().applyMatrix4(effects.group.matrixWorld.clone().invert());const hit=effects.pickRay(localRay);return hit&&allowed(hit.cell)?hit:null;}
 function apply(hit,erase=false){if(!hit)return;const {cell}=hit,tool=erase?'erase':mode,key=cell.id+':'+tool;if(stroke?.edits.has(key))return;stroke?.edits.add(key);const top=town.top(cell),level=Math.max(1,Math.min(MAX_HEIGHT,hit.level||top||1));let changed=false;
  if(tool==='paint'){changed=top>0&&(hit.level||top)>=top?town.setRoofColor(cell,color):town.setColor(cell,color);}else if(tool==='erase'){changed=town.setSolid(cell,town.isSolid(cell,level)?level:top,false);}else{const target=!town.isSolid(cell,level)?level:Math.min(MAX_HEIGHT,top+1);changed=town.setSolid(cell,target,true);if(changed&&target>=2)town.setColor(cell,color);}
  if(changed){stroke.changed=true;rebuild();}
 }
 const onDown=e=>{if(!active||!isCanvas(e))return;if(e.button===2){down={x:e.clientX,y:e.clientY};return;}if(e.button!==0||e.altKey)return;stroke={snapshot:town.snapshot(),edits:new Set(),changed:false};apply(pick(e),e.shiftKey);e.preventDefault();e.stopImmediatePropagation();};
 const onMove=e=>{if(!active||!isCanvas(e))return;const hit=pick(e);effects.updateHover(hit?.cell,hit?.level||0);if(stroke){apply(hit,e.shiftKey);e.preventDefault();e.stopImmediatePropagation();}};
 const finish=()=>{if(stroke?.changed){undo.push(stroke.snapshot);if(undo.length>60)undo.shift();redo.length=0;persist();}stroke=null;};
 const onUp=e=>{if(stroke){finish();e.preventDefault();e.stopImmediatePropagation();return;}if(!active||!down||!isCanvas(e))return;const start=down;down=null;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;stroke={snapshot:town.snapshot(),edits:new Set(),changed:false};apply(pick(e),true);finish();e.preventDefault();e.stopImmediatePropagation();};
 const onCancel=()=>{finish();down=null;effects.updateHover(null,0);};
 const context=e=>{if(active&&isCanvas(e))e.preventDefault();};
 window.addEventListener('pointerdown',onDown,true);window.addEventListener('pointerup',onUp,true);window.addEventListener('pointermove',onMove,true);window.addEventListener('pointercancel',onCancel,true);window.addEventListener('blur',onCancel);window.addEventListener('contextmenu',context,true);
 return{town,grid,mesh,birds:effects.birds,undo,redo,effects,seededCastle,update(){effects.update(performance.now()/1000);const c=morrisViewer.camera;if(c){const distance=c.position.distanceTo(root.getWorldPosition(new T.Vector3()));menu.update(distance>360&&!morrisViewer.applyTownCamera);}},dispose(){menu.dispose();effects.dispose();panel.remove();window.removeEventListener('pointerdown',onDown,true);window.removeEventListener('pointerup',onUp,true);window.removeEventListener('pointermove',onMove,true);window.removeEventListener('pointercancel',onCancel,true);window.removeEventListener('blur',onCancel);window.removeEventListener('contextmenu',context,true);}};
}
