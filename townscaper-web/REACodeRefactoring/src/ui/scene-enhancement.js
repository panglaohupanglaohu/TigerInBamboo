import {installC11,C11_KEYS} from '../world/view-c11.js';
/** Curated display-only composition. Uses existing code; preserves all World data. */
export const SCENE_ENHANCEMENTS=[
 {id:'cloudshadow',name:'移动云影',group:'debug',module:'src/light/cloud-shadow.js'},
 {id:'surfaceshadow',name:'台地、墙面与洞内纹理阴影',group:'shading',module:'src/light/surface-shadow.js'},
 {id:'windflag',name:'旗帜读取局部风场',group:'post',module:'src/world/view-post-extras.js'},
 {id:'wallcards',name:'墙根折卡灌木',group:'post',module:'src/world/view-post-extras.js'},
 {id:'grassline',name:'草丛随背景反差描线',group:'c11',module:'src/world/view-c11-grassline.js'},
 {id:'shrubband',name:'灌木边带随崖高变化',group:'c11',module:'src/world/view-c11-shrubband.js'},
];
export function createSceneEnhancement(view,{getScene=()=>null}={}){
 let enabled=false,before=null,styleBefore=null,queue=Promise.resolve();
 const read=r=>r.group==='c11'?!!view.c11?.on[r.id]:r.group==='post'?!!view.postExtras?.state[r.id]:r.group==='shading'?!!view.shading?.on[r.id]:!!view.cloudShadow?.enabled;
 const write=(r,value)=>r.group==='c11'?view.c11.set(r.id,value):r.group==='post'?view.postExtras.set(r.id,value):view.setDebug(r.id,value);
 const restoreStyle=()=>{if(styleBefore){view.shrubStyle.value.copy(styleBefore.value);view.shrubColor.value.copy(styleBefore.color);styleBefore=null;}};
 const apply=(r,value)=>read(r)===value?undefined:write(r,value);
 const set=on=>queue=queue.catch(()=>{}).then(async()=>{
  if(on&&getScene()==='badnorth')throw Error('北境保留独立战斗表现，请在小镇、地形或融合场景启用');
  if(on===enabled)return;
  if(on){await view.c11Ready;if(!view.c11)await installC11(view,[]);before=SCENE_ENHANCEMENTS.map(r=>read(r));
   try{for(const r of SCENE_ENHANCEMENTS)await apply(r,true);if(!before[5]&&view.setShrubStyle){styleBefore={value:view.shrubStyle.value.clone(),color:view.shrubColor.value.clone()};view.setShrubStyle({width:.12,ragged:.035,shadow:.16,coverage:.6,color:'#b7a16a'});}enabled=true;}catch(error){for(let i=SCENE_ENHANCEMENTS.length-1;i>=0;i--)try{await apply(SCENE_ENHANCEMENTS[i],before[i]);}catch{}restoreStyle();before=null;throw error;}
  }else{for(let i=SCENE_ENHANCEMENTS.length-1;i>=0;i--)await apply(SCENE_ENHANCEMENTS[i],before[i]);restoreStyle();enabled=false;before=null;}
 });
 return{set,read,enabled:()=>enabled,settled:()=>queue};
}
export function mountSceneEnhancement(view,host,{getScene=()=>null}={}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},controller=createSceneEnhancement(view,{getScene});view.sceneEnhancement=controller;
 const section=el('section');section.className='scene-enhancement';const title=el('b','场景组合 · 水岸、植被与受光'),status=el('p','正在接入场景能力…');status.id='scene-enhancement-status';
 const compare=el('button','对照原效果'),apply=el('button','启用场景组合');compare.type=apply.type='button';const actions=el('div');actions.append(compare,apply);section.append(title,status,actions);
 const details=el('details');details.append(el('summary','查看组合调用的6项代码能力'));for(const r of SCENE_ENHANCEMENTS){const row=el('div'),a=el('a',r.name);a.href=r.module;a.target='_blank';a.rel='noopener';row.append(a);details.append(row);}section.append(details);host.prepend(section);
 async function run(on){apply.disabled=compare.disabled=true;try{await controller.set(on);status.textContent=on?'已接入6项 · 直接作用于当前场景':'原效果对照 · 已恢复组合启用前状态';status.dataset.enabled=String(controller.enabled());dispatchEvent(new Event('debugsync'));}catch(error){status.textContent='组合未应用：'+error.message;status.dataset.enabled=String(controller.enabled());}finally{apply.disabled=getScene()==='badnorth';compare.disabled=!controller.enabled();}}
 compare.onclick=()=>run(false);apply.onclick=()=>run(true);
 // Expose existing advanced code as real live controls, not just URL switches.
 const advanced=el('details');advanced.className='scene-capability-group';advanced.append(el('summary','草丛、灌木与岩面细节 · 当前场景'));const grid=el('div');grid.className='environment-toggles';advanced.append(grid);
 const names={grassline:'草丛背景反差描线',shrubband:'崖高灌木边带',mountaintex:'岩面下坡条痕',normalline:'笔触法线细线',megagi:'体积间接光（重烘焙）'};
 for(const key of C11_KEYS){const label=el('label'),box=el('input');box.type='checkbox';box.dataset.c11Control=key;label.append(box,document.createTextNode(names[key]));grid.append(label);box.onchange=async()=>{box.disabled=true;try{await view.c11Ready;if(!view.c11)await installC11(view,[]);await view.c11.set(key,box.checked);}catch(e){status.textContent='未能应用：'+e.message;}finally{box.checked=!!view.c11?.on[key];box.disabled=false;dispatchEvent(new Event('debugsync'));}};}
 host.append(advanced);const sync=()=>{for(const box of grid.querySelectorAll('input'))if(!box.disabled)box.checked=!!view.c11?.on[box.dataset.c11Control];};addEventListener('debugsync',()=>{sync();if(controller.enabled())status.textContent='场景组合已应用 · 当前启用 '+SCENE_ENHANCEMENTS.filter(controller.read).length+'/6 项';});
 addEventListener('scenechange',()=>{if(getScene()==='badnorth'&&controller.enabled())run(false);else apply.disabled=getScene()==='badnorth';});
 const params=new URLSearchParams(location.search);run(params.get('enhance')!=='0'&&getScene()!=='badnorth');return controller;
}
