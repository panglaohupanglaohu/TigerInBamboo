import {UI_DEV} from '../ui/uiLayers.js?v=ui-layers-r1';
import * as T from 'three';
// In-game menu for the Morris lake, driven by REACodeRefactoring: its learnpanel (pipelines, toggles,
// clips, camera tours), palettes, scene generators (town / terrain / fusion) and v5 share strings.
import {mountLearnPanel} from '../vendor/townscaper-rea-refactoring/src/ui/learnpanel.js';
import {PALETTES} from '../vendor/townscaper-rea-refactoring/src/core/palette.js';
import {SCENES,buildScene} from '../vendor/townscaper-rea-refactoring/src/world/scenes.js';
import {encodeWorld} from '../vendor/townscaper-rea-refactoring/src/world/save.js';
import {morrisViewer} from './morrisViewer.js';
import {buildMorrisMountain} from './morrisMountain.js?v=reacode-refactor-r2';
const VENDOR=new URL('../vendor/townscaper-rea-refactoring/',import.meta.url).href;
const SOURCE_PAGES=new URL('../../../townscaper-web/REACodeRefactoring/',import.meta.url).href;
const CLIPS=new URL('../../../REA-agent/gifs/',import.meta.url).href;
// learn/*.js are classic scripts that set window.LEARN / PIPELINE / ARCH (as in REACodeRefactoring/index.html).
let learnData=null;
function loadLearnData(){if(learnData)return learnData;learnData=['learn/data.js','learn/pipeline.js','learn/architecture.js'].reduce((p,file)=>p.then(()=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=VENDOR+file;s.onload=resolve;s.onerror=()=>reject(Error(file));document.head.append(s);})),Promise.resolve());return learnData;}
// learnpanel writes page-relative links (learn/thumbs, gifs/, *.html); point them at the vendored copy / source tree.
function fixLinks(root){const fix=el=>{if(el.nodeType!==1)return;for(const node of[el,...el.querySelectorAll('[style*="learn/thumbs/"],a[href],video[src],source[src]')]){const st=node.getAttribute?.('style');if(st&&st.includes('url(learn/thumbs/'))node.setAttribute('style',st.replaceAll('url(learn/thumbs/','url('+VENDOR+'learn/thumbs/'));const href=node.getAttribute?.('href');if(href&&!/^(https?:|#|\/|data:|blob:)/.test(href))node.setAttribute('href',SOURCE_PAGES+href);if(node.target!=='_blank'&&node.tagName==='A')node.target='_blank';const src=node.getAttribute?.('src');if(src&&src.startsWith('gifs/'))node.setAttribute('src',CLIPS+src.slice(5));}};
 fix(root);const mo=new MutationObserver(list=>{for(const m of list){if(m.type==='attributes')fix(m.target);else m.addedNodes.forEach(fix);}});mo.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href','style']});return mo;}
export function mountMorrisTownMenu({panel,body,world,stage,anchor,getWorld=()=>world,getAnchor=()=>anchor,isMorris=()=>true,setColor,setTool,setTime,getScene,setScene,remember,persist,clip,allowed,activate,returnToPlayer}){
 const hud=document.createElement('div');hud.id='morris-townscaper-hud';document.body.append(hud);hud.append(panel);panel.classList.add('panel');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./morrisTownscaperMenu.css?v=reacode-refactor-r1',import.meta.url).href;document.head.append(css);
 const host=document.createElement('div');host.id='learnpanel';hud.append(host);
 const palette=document.createElement('div');palette.id='morris-town-palette';palette.className='panel';hud.append(palette);
 let color=0,currentTool='build',savedCamera=null,learned=null,observer=null,disposed=false;
 const paletteName=()=>Object.keys(PALETTES).find(k=>PALETTES[k]===getWorld().palette)||'town';
 const restoreCamera=()=>{morrisViewer.applyTownCamera=null;if(savedCamera){savedCamera.camera.fov=savedCamera.fov;savedCamera.camera.far=savedCamera.far;savedCamera.camera.up.copy(savedCamera.up);savedCamera.camera.updateProjectionMatrix();savedCamera=null;}};
 function drawPalette(){palette.replaceChildren();getWorld().palette.colors.forEach((hex,i)=>{const b=document.createElement('button');b.className='swatch'+(i===color?' active':'');b.style.background=hex;b.title=`颜色 ${i+1}`;b.setAttribute('aria-label',b.title);b.onclick=()=>{color=i;setColor(i);if(currentTool==='erase'){currentTool='build';setTool('build');for(const [key,button]of modes)button.classList.toggle('active',key==='build');}drawPalette();};palette.append(b);});}
 drawPalette();
 const toolbar=document.createElement('div');toolbar.id='morris-town-tools';toolbar.className='panel';hud.append(toolbar);
 function tool(icon,label,fn){const b=document.createElement('button');b.className='tool';b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;toolbar.append(b);return b;}
 const modes=[];for(const [key,icon,label]of [['build','▲','建造'],['erase','▼','拆除'],['paint','■','刷色'],['rock','◆','岩石（地形体素）']]){const b=tool(icon,label,()=>{activate();currentTool=key;setTool(key);for(const [name,button]of modes)button.classList.toggle('active',name===key);});modes.push([key,b]);}modes[0][1].classList.add('active');
 const sep=document.createElement('span');sep.className='sep';toolbar.append(sep);
 const oldButton=label=>[...body.querySelectorAll('button')].find(b=>b.textContent===label);
 tool('↶','撤销',()=>oldButton('撤销').click());tool('↷','重做',()=>oldButton('重做').click());
 const top=document.createElement('div');top.id='morris-town-topright';top.className='panel';hud.append(top);
 function topButton(icon,label,action){const b=document.createElement('button');b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;top.append(b);return b;}
 topButton('◐','切换配色',()=>{const keys=Object.keys(PALETTES);getWorld().palette=PALETTES[keys[(keys.indexOf(paletteName())+1)%keys.length]];if(isMorris())stage.worldMesh.invalidate();persist();drawPalette();});
 // Same contract as REACodeRefactoring's View for the learnpanel: debugState / setDebug / setTimeOfDay / camera rig / frameTown.
 const view={target:new T.Vector3(0,1.2,0),distance:30,pitch:.62,yaw:Math.PI*.28,get timeOfDay(){return stage.timeOfDay;},get debugState(){return stage.debugState;},get worldMesh(){return stage.worldMesh;},
  setDebug(key,on){stage.setDebug(key,on);},
  setTimeOfDay(mode){if(!['day','dusk','night'].includes(mode))return;setTime(mode);stage.setTimeOfDay(mode);view.onTimeOfDay?.();},
  changed(){stage.changed();},
  updateCamera(){const camera=morrisViewer.camera;if(!camera)return;savedCamera??={camera,fov:camera.fov,far:camera.far,up:camera.up.clone()};const apply=()=>{const anchor=getAnchor();anchor.updateWorldMatrix(true,false);const cp=Math.cos(view.pitch),p=view.target.clone().add(new T.Vector3(Math.sin(view.yaw)*cp,Math.sin(view.pitch),Math.cos(view.yaw)*cp).multiplyScalar(view.distance));camera.position.copy(anchor.localToWorld(p));camera.up.set(0,1,0).transformDirection(anchor.matrixWorld);camera.lookAt(anchor.localToWorld(view.target.clone()));camera.fov=30;camera.far=Math.max(camera.far,700);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);};apply();morrisViewer.applyTownCamera=apply;},
  frameTown(){const world=getWorld();let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxH=0;for(const cell of world.cells){const top=world.top(cell);if(!top)continue;minX=Math.min(minX,cell.minX);maxX=Math.max(maxX,cell.maxX);minZ=Math.min(minZ,cell.minZ);maxZ=Math.max(maxZ,cell.maxZ);maxH=Math.max(maxH,top);}if(Number.isFinite(minX)){const span=Math.max(maxX-minX,maxZ-minZ,4);view.target.set((minX+maxX)/2,Math.max(.6,maxH*.5*.45),(minZ+maxZ)/2);view.distance=span*1.62;}else{view.target.set(0,1.2,0);view.distance=85;}view.updateCamera();}};
 topButton('☀','白天 / 黄昏 / 夜晚',()=>view.setTimeOfDay(['day','dusk','night'][(['day','dusk','night'].indexOf(view.timeOfDay)+1)%3]));
 // Scenes from REACodeRefactoring/src/world/scenes.js, generated on the lake grid and clipped to the shore.
 const morrisOnly=()=>{if(isMorris())return true;toast('示例场景只用于莫西斯湖；十二门徒请直接在岩体上建造');return false;};
 const loadScene=(name,seed=(Math.random()*1e9)|0)=>{if(!SCENES[name]||!morrisOnly())return;remember();buildScene(world,name,seed);clip();setScene(name);persist();view.frameTown();toast(`已生成：${SCENES[name].name}`);};
 topButton('♜','重新生成莫里斯山与山顶城堡（地形管线）',()=>{if(!morrisOnly())return;remember();const r=buildMorrisMountain(world,{allowed,seed:(Math.random()*1e9)|0});setScene('fusion');persist();view.frameTown();toast(`莫里斯山：${r.cells} 格岩体，最高 ${r.maxLevel} 层`);});
 topButton('◎','生成示例城镇',()=>loadScene('town'));
 topButton('⛰','生成地形岛（地形管线）',()=>loadScene('terrain'));
 topButton('⌂','生成融合岛（地形 + 建筑）',()=>loadScene('fusion'));
 topButton('✕','清空',()=>oldButton('清空').click());
 const notice=document.createElement('div');notice.id='morris-town-toast';hud.append(notice);let noticeTimer;
 const toast=message=>{notice.textContent=message;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2500);};
 topButton('⧉','复制分享链接',async()=>{try{const url=new URL(location.href);if(!morrisOnly())return;url.searchParams.set('morrisTown',encodeWorld(world,getScene()));await navigator.clipboard.writeText(url.href);toast('分享链接已复制');}catch{toast('无法复制，请通过保存菜单导出');}});
 const help=document.createElement('div');help.id='morris-town-helpcard';help.className='panel hidden';help.innerHTML='<h1>Townscaper <span>REACode 重构版</span></h1><p>一张网格、一份体素：建筑和地形写进同一个 World，一起烘焙光照。左键拖动建造，右键点击拆除单块（地形也能挖）；掏空底部自动形成钢架，两侧支撑形成拱。右键拖动旋转，中键平移，滚轮缩放。</p><p>左侧选色，下方切换建造、拆除、刷色；上方切换配色、时段、生成小镇 / 地形岛 / 融合岛、清空和复制存档（v5）。右侧是重构版的学习导航：每条管线可开关、看镜头、播放原视频。</p>';const close=document.createElement('button');close.textContent='知道了';close.onclick=()=>help.classList.add('hidden');help.append(close);hud.append(help);topButton('?','帮助',()=>help.classList.toggle('hidden'));
 if(UI_DEV&&!new URLSearchParams(location.search).has('authoringEmbed'))loadLearnData().then(()=>{if(disposed)return;learned=mountLearnPanel(view,world,{getScene,loadScene:s=>loadScene(s)});observer=fixLinks(host);}).catch(e=>{host.textContent='学习导航数据加载失败：'+e.message;});
 const collapse=document.createElement('button');collapse.id='morris-town-collapse';collapse.type='button';collapse.className='panel';collapse.textContent='收起建城菜单';collapse.setAttribute('aria-expanded','true');hud.append(collapse);
 const collapsible=[panel,palette,toolbar,top,host];for(const element of collapsible)element.classList.add('morris-menu-collapsible');
 collapse.onclick=()=>{const collapsed=hud.classList.toggle('collapsed');collapse.textContent=collapsed?'展开建城菜单':'收起建城菜单';collapse.setAttribute('aria-expanded',String(!collapsed));if(collapsed)help.classList.add('hidden');};
 for(const b of body.querySelectorAll('button'))b.style.display='none';
 const originalColors=body.lastElementChild;if(originalColors?.tagName==='DIV'&&originalColors.querySelector('button'))originalColors.hidden=true;
 // 系统工坊把镜头切到整颗星球 / 某个场景时（planetCamera），右键 / 中键拖动和滚轮交给 orbitInput，不再回到莫西斯湖的镜头
 let drag=null;const pointerDown=e=>{if(!morrisViewer.applyTownCamera||e.target.tagName!=='CANVAS'||![1,2].includes(e.button))return;drag={x:e.clientX,y:e.clientY,button:e.button,orbit:!!morrisViewer.planetCamera};};
 const pointerMove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(drag.orbit||morrisViewer.planetCamera){morrisViewer.orbitInput?.drag(dx,dy,drag.button);return;}if(drag.button===2){view.yaw-=dx*.008;view.pitch=T.MathUtils.clamp(view.pitch+dy*.006,.12,1.5);}else{view.target.x-=dx*view.distance*.001;view.target.z+=dy*view.distance*.001;}view.updateCamera();};const pointerUp=()=>drag=null;
 const wheel=e=>{if(!morrisViewer.applyTownCamera||e.target.tagName!=='CANVAS')return;e.preventDefault();if(morrisViewer.planetCamera){morrisViewer.orbitInput?.wheel(e.deltaY);return;}view.distance=T.MathUtils.clamp(view.distance*Math.exp(e.deltaY*.001),3,160);view.updateCamera();};
 window.addEventListener('pointerdown',pointerDown,true);window.addEventListener('pointermove',pointerMove,true);window.addEventListener('pointerup',pointerUp,true);window.addEventListener('wheel',wheel,{capture:true,passive:false});
 const returnButton=document.createElement('button');returnButton.textContent='返回玩家视角';returnButton.onclick=e=>{e.stopPropagation();returnToPlayer?returnToPlayer():restoreCamera();};panel.append(returnButton);
 return{hud,view,restoreCamera,redrawPalette:()=>drawPalette(),syncLighting(){view.onTimeOfDay?.();},update(hidden){hud.hidden=hidden;},dispose(){disposed=true;observer?.disconnect();learned?.dispose?.();css.remove();hud.remove();clearTimeout(noticeTimer);restoreCamera();window.removeEventListener('pointerdown',pointerDown,true);window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',pointerUp,true);window.removeEventListener('wheel',wheel,true);}};
}
