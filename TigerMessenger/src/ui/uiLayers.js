// UI layers: one rule for every on-screen panel (industry pattern: player HUD vs. editor tools vs. debug stats).
//
//   play     玩家 HUD：任务 / 小地图 / 罗盘 / 救援主线 / 操作提示条 / 遥控 / 交互提示 / 对话 / 提示气泡。
//            Ships with the game, always visible; nothing else may cover the bottom controls bar.
//   edit     编辑工具：构建（莫西斯湖 · 十二门徒 · 高山圣城 · 水晶城 · 地图）、剧情镜头、玩法调试（霸天舰队 · 机器人）、参数。
//            Development only. One group open at a time from the dock (bottom-right) or F1; closed by default.
//   monitor  监控：帧率探针、体素 AO 探针、湖区 / 城区实时审计、WFC 失败面板。Development only, F2.
//
// Release (published Pages / any non-local host, or ?release=1): edit + monitor are hidden and the dock is not mounted
// (like a shipping build stripping dev UI). ?dev=1 forces the dev tools on a public host for a review session.
// Panels are classified by id when they appear (MutationObserver), so their own modules stay unchanged.

export const EDIT_GROUPS=[
 {id:'build',name:'构建',note:'莫西斯湖 · 十二门徒 · 高山圣城 · 水晶城 · 地图',selectors:['#morris-townscaper-hud','#lp-dlg','#citadel-editor','#ce-io','#crystal-city-editor','#map-editor']},
 {id:'story',name:'剧情 · 镜头',note:'故事板 · 截图工作台 · 景区巡览',selectors:['#storyboard-toggle','#storyboard-panel','#sb-level-config','#shot-harness-panel','#morris-live-review','#moon-lake-live-review','#citadel-live-city']},
 {id:'gameplay',name:'玩法调试',note:'霸天舰队 · 机器人作业',selectors:['#batian-hud','#robot-ops','#robot-ops-toggle']},
 {id:'params',name:'参数',note:'开发者菜单（移动 · 光照 · 天空 · 场景开关）',selectors:['#dev-toggle','#dev-panel']},
];
export const MONITOR_SELECTORS=['#tm-perf-probe','#voxel-ao-probe','#morris-live-audit','#moon-lake-live-audit','#citadel-runtime-status','#dev-wfc-failure'];
/** Player HUD (documentation + tests): never hidden by this module. */
export const PLAY_SELECTORS=['#hud','#topleft-stack','#quest-panel','#minimap-panel','#compass','#rescue-campaign','#controls-dock','#hint-panel','#touch-controls','#toast','#intro','#startup-progress','#load-error','#fox-chat','#morris-princess-dialogue','#morris-princess-hint','#morris-horse-hint','#robot-greeting-hint','#journal-panel'];

const STORE='tm-ui-layers-v1';
const q=new URLSearchParams(globalThis.location?.search||'');
const host=globalThis.location?.hostname||'';
const localHost=['localhost','127.0.0.1','::1','[::1]',''].includes(host)||host.endsWith('.local');
export const UI_DEV=q.get('dev')==='1'||(localHost&&q.get('release')!=='1'&&q.get('dev')!=='0');

const state={group:null,monitor:false};
try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');if(EDIT_GROUPS.some(g=>g.id===s.group))state.group=s.group;state.monitor=!!s.monitor;}catch{}
if(q.has('editor'))state.group=EDIT_GROUPS.some(g=>g.id===q.get('editor'))?q.get('editor'):null;
const listeners=new Set();
let installed=false,dock=null;

function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch{}}
function apply(){const root=document.documentElement;
 root.classList.toggle('tm-release',!UI_DEV);root.classList.toggle('tm-monitor-on',UI_DEV&&state.monitor);
 if(UI_DEV&&state.group)root.dataset.editGroup=state.group;else delete root.dataset.editGroup;
 dock?.sync();for(const fn of listeners){try{fn({...state});}catch(e){console.warn('[uiLayers]',e);}}}

function classify(el){
 for(const g of EDIT_GROUPS)if(g.selectors.some(s=>el.matches(s))){el.dataset.uiLayer='edit';el.dataset.uiGroup=g.id;return;}
 if(MONITOR_SELECTORS.some(s=>el.matches(s)))el.dataset.uiLayer='monitor';}
const ALL=[...EDIT_GROUPS.flatMap(g=>g.selectors),...MONITOR_SELECTORS].join(',');
function scan(node){if(node.nodeType!==1)return;if(node.matches(ALL))classify(node);for(const el of node.querySelectorAll(ALL))classify(el);}

const CSS=`
html.tm-release [data-ui-layer="edit"],html.tm-release [data-ui-layer="monitor"],html.tm-release #tm-ui-dock{display:none!important}
html:not(.tm-monitor-on) [data-ui-layer="monitor"]{display:none!important}
${EDIT_GROUPS.map(g=>`html:not([data-edit-group="${g.id}"]) [data-ui-group="${g.id}"]`).join(',')}{display:none!important}
/* build mode: the editor owns the left column and the right edge; player info panels step aside, the controls bar stays */
html[data-edit-group="build"] #topleft-stack,html[data-edit-group="build"] #rescue-campaign{display:none!important}
html[data-edit-group="build"] #morris-town-tools{bottom:78px!important}
html[data-edit-group="build"] #morris-townscaper{bottom:136px!important}
html[data-edit-group="build"] #morris-town-topright{right:96px!important}
html[data-edit-group="build"] #learnpanel{top:96px!important;max-height:calc(100vh - 176px)!important}
html[data-edit-group="build"] #morris-town-collapse{display:none!important}
/* the castle / crystal-city build panels take the right edge: the Townscaper learning panel steps aside while one is open */
html:has(#citadel-editor[style*="display: block"]) #learnpanel,html:has(#crystal-city-editor[style*="display: block"]) #learnpanel{display:none!important}
/* monitor stats sit bottom-right above the dock, clear of the player HUD */
#tm-perf-probe[data-ui-layer="monitor"]{left:auto!important;top:auto!important;right:12px!important;bottom:64px!important}
/* the player controls bar is always on top of editor panels */
#controls-dock{z-index:236}
#tm-ui-dock{position:fixed;right:12px;bottom:12px;z-index:400;font:13px/1.4 system-ui,-apple-system,"PingFang SC",sans-serif;color:#12232e}
#tm-ui-dock>button{border:0;border-radius:10px;padding:7px 12px;background:rgba(255,255,255,.86);box-shadow:0 4px 16px rgba(18,35,46,.22);cursor:pointer;font:600 13px/1 inherit}
#tm-ui-dock>button.on{background:#12232e;color:#fff}
#tm-ui-dock .menu{position:absolute;right:0;bottom:40px;width:250px;padding:8px;border-radius:12px;background:rgba(255,255,255,.94);box-shadow:0 8px 26px rgba(18,35,46,.25)}
#tm-ui-dock .menu[hidden]{display:none}
#tm-ui-dock .item{display:block;width:100%;text-align:left;border:0;background:none;border-radius:8px;padding:6px 8px;cursor:pointer;font:inherit;color:inherit}
#tm-ui-dock .item:hover{background:rgba(18,35,46,.07)}
#tm-ui-dock .item.on{background:#12232e;color:#fff}
#tm-ui-dock .item small{display:block;opacity:.7;font-size:11px}
#tm-ui-dock .foot{margin-top:6px;padding:6px 8px 2px;border-top:1px solid rgba(18,35,46,.1);font-size:11px;opacity:.75}
`;

function mountDock(){
 const wrap=document.createElement('div');wrap.id='tm-ui-dock';
 const button=document.createElement('button');button.type='button';button.title='编辑器 · 监控（F1 / F2）· 发布版不显示';
 const menu=document.createElement('div');menu.className='menu';menu.hidden=true;
 const item=(label,note,fn)=>{const b=document.createElement('button');b.type='button';b.className='item';b.innerHTML=`${label}${note?`<small>${note}</small>`:''}`;b.onclick=()=>{fn();menu.hidden=true;};menu.append(b);return b;};
 const items=new Map();
 items.set(null,item('关闭编辑器','只显示玩家界面（提示 · 操控）',()=>setGroup(null)));
 for(const g of EDIT_GROUPS)items.set(g.id,item(g.name,g.note,()=>setGroup(g.id)));
 const mon=item('监控','帧率 · 探针 · 实时审计（F2）',()=>setMonitor(!state.monitor));
 const foot=document.createElement('div');foot.className='foot';foot.textContent='F1 开 / 关编辑器 · F2 监控 · 编辑与监控只在本地开发显示，发布版自动隐藏';menu.append(foot);
 button.onclick=()=>{menu.hidden=!menu.hidden;};
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))menu.hidden=true;},true);
 wrap.append(menu,button);document.body.append(wrap);
 return{sync(){const g=EDIT_GROUPS.find(x=>x.id===state.group);button.textContent=g?`🛠 ${g.name}`:'🛠 编辑';button.classList.toggle('on',!!g);for(const[id,b]of items)b.classList.toggle('on',id===state.group);mon.classList.toggle('on',state.monitor);}};
}

let lastGroup=state.group||'build';
export function setGroup(id){state.group=id&&EDIT_GROUPS.some(g=>g.id===id)?id:null;if(state.group)lastGroup=state.group;save();apply();}
export function setMonitor(on){state.monitor=!!on;save();apply();}
export function isGroupOpen(id){return UI_DEV&&state.group===id;}
export function onUiLayersChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function uiLayersState(){return{dev:UI_DEV,...state};}

export function installUiLayers(){
 if(installed)return;installed=true;
 const style=document.createElement('style');style.id='tm-ui-layers-css';style.textContent=CSS;document.head.append(style);
 scan(document.body);new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)scan(n);}).observe(document.body,{childList:true,subtree:true});
 if(UI_DEV){dock=mountDock();
  window.addEventListener('keydown',e=>{if(e.repeat||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(e.key==='F1'){e.preventDefault();setGroup(state.group?null:lastGroup);}else if(e.key==='F2'){e.preventDefault();setMonitor(!state.monitor);}},true);}
 apply();
 globalThis.__tmUiLayers={state:uiLayersState,setGroup,setMonitor,groups:EDIT_GROUPS.map(g=>g.id)};
}
