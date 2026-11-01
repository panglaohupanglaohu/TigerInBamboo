import * as T from 'three';
import {mountLearnPanel} from '../vendor/townscaper-rea/learnpanel.js?v=gulls-r1';
import {PALETTES} from '../vendor/townscaper-rea/town.js';
import {generateDemo} from '../vendor/townscaper-rea/demo.js';
import {encodeTown} from '../vendor/townscaper-rea/save.js';
import {morrisViewer} from './morrisViewer.js';
export function mountMorrisTownMenu({panel,body,town,effects,setColor,setTool,remember,persist,allowed,activate}){
 const hud=document.createElement('div');hud.id='morris-townscaper-hud';document.body.append(hud);hud.append(panel);panel.classList.add('panel');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./morrisTownscaperMenu.css?v=menu-collapse-r1',import.meta.url).href;document.head.append(css);
 const host=document.createElement('div');host.id='learnpanel';hud.append(host);
 const palette=document.createElement('div');palette.id='morris-town-palette';palette.className='panel';hud.append(palette);
 let color=0,paletteName='town',currentTool='build',savedCamera=null;
 const restoreCamera=()=>{morrisViewer.applyTownCamera=null;if(savedCamera){savedCamera.camera.fov=savedCamera.fov;savedCamera.camera.far=savedCamera.far;savedCamera.camera.up.copy(savedCamera.up);savedCamera.camera.updateProjectionMatrix();savedCamera=null;}};
 function drawPalette(){palette.replaceChildren();town.palette.colors.forEach((hex,i)=>{const b=document.createElement('button');b.className='swatch'+(i===color?' active':'');b.style.background=hex;b.title=`颜色 ${i+1}`;b.setAttribute('aria-label',b.title);b.onclick=()=>{color=i;setColor(i);if(currentTool==='erase'){currentTool='build';setTool('build');for(const [key,button]of modes)button.classList.toggle('active',key==='build');}drawPalette();};palette.append(b);});}
 drawPalette();
 const toolbar=document.createElement('div');toolbar.id='morris-town-tools';toolbar.className='panel';hud.append(toolbar);
 function tool(icon,label,fn){const b=document.createElement('button');b.className='tool';b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;toolbar.append(b);return b;}
 const modes=[];for(const [key,icon,label]of [['build','▲','建造'],['erase','▼','拆除'],['paint','■','刷色']]){const b=tool(icon,label,()=>{activate();currentTool=key;setTool(key);for(const [name,button]of modes)button.classList.toggle('active',name===key);});modes.push([key,b]);}modes[0][1].classList.add('active');
 const sep=document.createElement('span');sep.className='sep';toolbar.append(sep);
 const oldButton=label=>[...body.querySelectorAll('button')].find(b=>b.textContent===label);
 tool('↶','撤销',()=>oldButton('撤销').click());tool('↷','重做',()=>oldButton('重做').click());
 const top=document.createElement('div');top.id='morris-town-topright';top.className='panel';hud.append(top);
 function topButton(icon,label,action){const b=document.createElement('button');b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;top.append(b);return b;}
 topButton('◐','切换配色',()=>{const keys=Object.keys(PALETTES);paletteName=keys[(keys.indexOf(paletteName)+1)%keys.length];town.palette=PALETTES[paletteName];effects.invalidate();persist();drawPalette();});
 const view={target:new T.Vector3(0,1.2,0),distance:30,pitch:.62,yaw:Math.PI*.28,timeOfDay:'day',
  setDebug(key,on){if(key==='wavewire'){effects.waves.material.wireframe=on;effects.skirt.visible=!on&&effects.flags.waves;}else if(key==='wire'){effects.material.wireframe=on;}else if(key==='ao'){effects.setDebug('ao',on);effects.setDebug('bounce',on);}else effects.setDebug(key,on);},
  setTimeOfDay(mode){if(!['day','dusk','night'].includes(mode))return;view.timeOfDay=mode;effects.setTimeOfDay(mode);view.onTimeOfDay?.();},
  updateCamera(){const camera=morrisViewer.camera;if(!camera)return;savedCamera??={camera,fov:camera.fov,far:camera.far,up:camera.up.clone()};const apply=()=>{effects.group.updateWorldMatrix(true,false);const cp=Math.cos(view.pitch),p=view.target.clone().add(new T.Vector3(Math.sin(view.yaw)*cp,Math.sin(view.pitch),Math.cos(view.yaw)*cp).multiplyScalar(view.distance));camera.position.copy(effects.group.localToWorld(p));camera.up.set(0,1,0).transformDirection(effects.group.matrixWorld);camera.lookAt(effects.group.localToWorld(view.target.clone()));camera.fov=30;camera.far=Math.max(camera.far,700);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);};apply();morrisViewer.applyTownCamera=apply;},
  frameTown(){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxH=0;for(const cell of town.cells){const top=town.top(cell);if(!top)continue;minX=Math.min(minX,cell.minX);maxX=Math.max(maxX,cell.maxX);minZ=Math.min(minZ,cell.minZ);maxZ=Math.max(maxZ,cell.maxZ);maxH=Math.max(maxH,top);}if(Number.isFinite(minX)){const span=Math.max(maxX-minX,maxZ-minZ,4);view.target.set((minX+maxX)/2,Math.max(.6,maxH*.5*.45),(minZ+maxZ)/2);view.distance=span*1.62;}else{view.target.set(0,1.2,0);view.distance=85;}view.updateCamera();}};
 topButton('☀','白天 / 黄昏 / 夜晚',()=>view.setTimeOfDay(['day','dusk','night'][(['day','dusk','night'].indexOf(view.timeOfDay)+1)%3]));
 topButton('◎','生成示例城镇',()=>{remember();generateDemo(town);for(const c of town.cells)if(!allowed(c))town.solid[c.id]=0;town.version++;persist();view.frameTown();});
 topButton('✕','清空',()=>oldButton('清空').click());
 const notice=document.createElement('div');notice.id='morris-town-toast';hud.append(notice);let noticeTimer;
 const toast=message=>{notice.textContent=message;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2500);};
 topButton('⧉','复制分享链接',async()=>{try{const url=new URL(location.href);url.searchParams.set('morrisTown',encodeTown(town));await navigator.clipboard.writeText(url.href);toast('分享链接已复制');}catch{toast('无法复制，请通过保存菜单导出');}});
 const help=document.createElement('div');help.id='morris-town-helpcard';help.className='panel hidden';help.innerHTML='<h1>Townscaper <span>REACode</span></h1><p>左键拖动建造，右键点击拆除单块；掏空底部自动形成钢架，两侧支撑形成拱。右键拖动旋转，中键平移，滚轮缩放。</p><p>左侧选色，下方切换建造、拆除、刷色；上方切换原版配色、时段、生成示例、清空和复制存档。结束建造后可命名保存。</p>';const close=document.createElement('button');close.textContent='知道了';close.onclick=()=>help.classList.add('hidden');help.append(close);hud.append(help);topButton('?','帮助',()=>help.classList.toggle('hidden'));
 const learned=mountLearnPanel(view,town);
 const collapse=document.createElement('button');collapse.id='morris-town-collapse';collapse.type='button';collapse.className='panel';collapse.textContent='收起建城菜单';collapse.setAttribute('aria-expanded','true');hud.append(collapse);
 const collapsible=[panel,palette,toolbar,top,host];for(const element of collapsible)element.classList.add('morris-menu-collapsible');
 collapse.onclick=()=>{const collapsed=hud.classList.toggle('collapsed');collapse.textContent=collapsed?'展开建城菜单':'收起建城菜单';collapse.setAttribute('aria-expanded',String(!collapsed));if(collapsed)help.classList.add('hidden');};
 hud.classList.remove('collapsed');collapse.textContent='收起建城菜单';collapse.setAttribute('aria-expanded','true');
 // Use the original menu for editing; keep only status and the requested save form in the small panel.
 for(const b of body.querySelectorAll('button'))b.style.display='none';
 const originalColors=body.lastElementChild;if(originalColors?.tagName==='DIV'&&originalColors.querySelector('button'))originalColors.hidden=true;
 let drag=null;const pointerDown=e=>{if(!morrisViewer.applyTownCamera||e.target.tagName!=='CANVAS'||![1,2].includes(e.button))return;drag={x:e.clientX,y:e.clientY,button:e.button};};
 const pointerMove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(drag.button===2){view.yaw-=dx*.008;view.pitch=T.MathUtils.clamp(view.pitch+dy*.006,.12,1.5);}else{view.target.x-=dx*view.distance*.001;view.target.z+=dy*view.distance*.001;}view.updateCamera();};const pointerUp=()=>drag=null;
 const wheel=e=>{if(!morrisViewer.applyTownCamera||e.target.tagName!=='CANVAS')return;e.preventDefault();view.distance=T.MathUtils.clamp(view.distance*Math.exp(e.deltaY*.001),3,160);view.updateCamera();};
 window.addEventListener('pointerdown',pointerDown,true);window.addEventListener('pointermove',pointerMove,true);window.addEventListener('pointerup',pointerUp,true);window.addEventListener('wheel',wheel,{capture:true,passive:false});
 const returnButton=document.createElement('button');returnButton.textContent='返回玩家视角';returnButton.onclick=restoreCamera;panel.append(returnButton);
 return{hud,view,syncLighting(mode){view.timeOfDay=mode;view.onTimeOfDay?.();},update(hidden){hud.hidden=hidden;},dispose(){learned?.dispose();css.remove();hud.remove();clearTimeout(noticeTimer);restoreCamera();window.removeEventListener('pointerdown',pointerDown,true);window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',pointerUp,true);window.removeEventListener('wheel',wheel,true);}};
}
