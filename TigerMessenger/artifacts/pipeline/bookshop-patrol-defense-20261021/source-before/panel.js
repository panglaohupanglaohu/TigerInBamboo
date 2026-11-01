import {robotSkillStatus} from './combat.js';
const NAMES={locust:'蝗虫',ant:'蚂蚁',beetle:'甲壳虫',sentry:'机械靶守卫'};
const STATES={assembly:'组装中',ready:'待运',reserved:'已预订货位',loading:'吊装中',transit:'在途',unloading:'卸车中',deployed:'已部署',repair:'维修中',lost:'损失'};
const COMBAT_STATES={idle:'待机',move:'移动',blocked:'通行受阻',aim:'瞄准',attack:'交战',cooling:'冷却',reload:'换弹',repair:'维修补给',braced:'已架稳',disabled:'失能',search:'搜索'};
export function createRobotOpsPanel(ops){
 const style=document.createElement('style');style.textContent=`#robot-ops-toggle{position:fixed;bottom:65px;right:18px;z-index:70;padding:10px 16px;background:#263d42;color:#efd8a0;border:1px solid #b59760;border-radius:8px;cursor:pointer}#robot-ops{position:fixed;right:16px;top:90px;bottom:115px;width:min(430px,calc(100vw - 32px));z-index:80;background:#162a30f5;color:#e8e4d7;padding:20px;overflow:auto;border:1px solid #ac925f;border-radius:12px;font:14px/1.65 system-ui}#robot-ops[hidden]{display:none}#robot-ops h2{margin:0 0 10px;font-size:20px}#robot-ops h3{font-size:15px;color:#edc77e;margin:16px 0 6px}#robot-ops button{background:#304c50;color:#efe5c8;border:1px solid #75908e;padding:7px 10px;margin:3px;border-radius:5px;cursor:pointer}#robot-ops button:disabled{opacity:.4;cursor:default}#robot-ops small{color:#aec2c3}#robot-ops canvas{width:100%;border:1px solid #657b7b;cursor:crosshair;touch-action:none}#robot-ops label{display:block}#robot-ops .ops-row{border-bottom:1px solid #3e565b;padding:5px 0}#robot-ops-output{padding:9px;background:#243c41;white-space:pre-line}#robot-ops .close{float:right}`;document.head.append(style);
 const toggle=document.createElement('button');toggle.id='robot-ops-toggle';toggle.textContent='军团指挥';document.body.append(toggle);
 const panel=document.createElement('section');panel.id='robot-ops';panel.hidden=true;panel.innerHTML=`<button class="close" data-action="close">关闭</button><h2>工厂与机械军团</h2><small>三台同型一批 · 九个整机货位 · 先在试验场验证</small><h3>三座工厂</h3><div id="robot-factories"></div><button data-action="receive">接收一船零件</button><button data-action="factory">查看装配区</button><h3>铁路运输</h3><button data-action="loading">观看整机装运</button><div id="robot-trains"></div><button data-action="train">跟随红色货列</button><button data-action="blue-train">跟随蓝色货列</button><button data-action="plaza">查看广场环线</button><h3>试验场指挥</h3><button data-action="field">查看试验场</button><button data-action="exercise">启动机械靶演练</button><canvas id="robot-map" width="380" height="220" aria-label="点击地图下达移动命令"></canvas><small>拖框选择小队，按住 Shift 追加；点击空地移动，点击红色机械靶攻击。橙色为掩体。</small><div id="robot-units"></div><button data-action="all">全选</button><button data-action="hold">守住</button><button data-action="cease">停火</button><button data-action="skill">使用技能</button><button data-action="retreat">撤退补给</button><label><input id="robot-auto-retreat" type="checkbox" checked> 低耐久、武器损坏或弹药耗尽时自动撤退</label><h3>记录</h3><div id="robot-ops-output" aria-live="polite"></div><button data-action="save">保存进度</button><button data-action="restore">读取进度</button><button data-action="return">返回角色视角</button>`;document.body.append(panel);
 const selected=new Set();let last=0,unitList='';toggle.onclick=()=>panel.hidden=!panel.hidden;
 panel.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;const ids=[...selected];
  if(action==='close'){panel.hidden=true;ops.focus(null);}
  else if(action==='loading')ops.focus('loading');else if(action==='receive')ops.receiveShipment();else if(action==='factory')ops.focus('factory');else if(action==='train')ops.focus('train');else if(action==='blue-train')ops.focus('blue-train');else if(action==='plaza')ops.focus('plaza');else if(action==='field')ops.focus('field');else if(action==='exercise')ops.startExercise();else if(action==='save')ops.save();else if(action==='restore')ops.load();else if(action==='return')ops.focus(null);
  else if(action==='all'){for(const u of ops.combat.units)if(u.team==='friendly'&&u.hp>0)selected.add(u.id);unitList='';}
  else if(action==='skill'){
   if(!ids.length)ops.message='先勾选要使用技能的机器人。';
   else{const messages=[];for(const id of ids){const u=ops.combat.get(id);if(!u)continue;const s=robotSkillStatus(u);if(s.available){ops.combat.skill(u);messages.push(`${NAMES[u.kind]} ${id}：${s.label}已执行`);}else messages.push(`${NAMES[u.kind]} ${id}：${s.reason}`);}ops.message=messages.join('\n');}
  }else ops.combat.command(ids,action);
 });
 panel.addEventListener('change',e=>{if(e.target.id==='robot-auto-retreat'){ops.combat.autoRetreat=e.target.checked;return;}if(e.target.dataset.robot){if(e.target.checked)selected.add(e.target.dataset.robot);else selected.delete(e.target.dataset.robot);}});
 const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');let drag=null;
 const mapPoint=e=>{const b=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(380,(e.clientX-b.left)/b.width*380)),y:Math.max(0,Math.min(220,(e.clientY-b.top)/b.height*220))};};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=mapPoint(e);drag={start:p,end:p};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;drag.end=mapPoint(e);drawMap();});
 canvas.addEventListener('pointercancel',()=>{drag=null;drawMap();});
 canvas.addEventListener('pointerup',e=>{
  if(!drag)return;const p=mapPoint(e),start=drag.start;drag=null;
  if(Math.hypot(p.x-start.x,p.y-start.y)>8){
   if(!e.shiftKey)selected.clear();const minX=Math.min(p.x,start.x),maxX=Math.max(p.x,start.x),minY=Math.min(p.y,start.y),maxY=Math.max(p.y,start.y);
   for(const u of ops.combat.units){const x=(u.x+25)/50*380,y=(u.z+16)/32*220;if(u.team==='friendly'&&u.hp>0&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY)selected.add(u.id);}
   unitList='';ops.message=`已选择 ${selected.size} 台机器人，点击空地下达移动命令。`;
  }else{const x=p.x/380*50-25,z=p.y/220*32-16,target=ops.combat.units.find(u=>u.team==='enemy'&&u.hp>0&&Math.hypot(u.x-x,u.z-z)<2);ops.combat.command([...selected],target?'attack':'move',target?{id:target.id}:{x,z});}
  drawMap();
 });
 function drawMap(){
  ctx.fillStyle='#18343a';ctx.fillRect(0,0,380,220);const px=x=>(x+25)/50*380,pz=z=>(z+16)/32*220;
  for(const o of ops.combat.obstacles){ctx.fillStyle='#b49259';ctx.beginPath();ctx.arc(px(o.x),pz(o.z),o.radius/50*380,0,Math.PI*2);ctx.fill();}
  for(const s of ops.combat.smoke){ctx.fillStyle='#cad8d366';ctx.beginPath();ctx.arc(px(s.x),pz(s.z),s.radius/50*380,0,Math.PI*2);ctx.fill();}
  for(const u of ops.combat.units){ctx.fillStyle=u.hp<=0?'#737b75':u.team==='friendly'?'#8bd7b9':'#f39975';ctx.beginPath();ctx.arc(px(u.x),pz(u.z),selected.has(u.id)?6:4,0,Math.PI*2);ctx.fill();}
  if(drag){ctx.strokeStyle='#efd092';ctx.fillStyle='#efd09222';const w=drag.end.x-drag.start.x,h=drag.end.y-drag.start.y;ctx.fillRect(drag.start.x,drag.start.y,w,h);ctx.strokeRect(drag.start.x,drag.start.y,w,h);}
 }

 return {element:panel,open(){panel.hidden=false;},update(t){if(panel.hidden||t-last<.35)return;last=t;
  panel.querySelector('#robot-factories').innerHTML=Object.values(ops.logistics.factories).map(f=>{const u=ops.logistics.get(f.active);return`<div class="ops-row">${NAMES[f.kind]}：原料 ${f.kits} 套 · 待运 ${ops.logistics.factoryStock(f.kind).length} 台${u?` · 组装 ${Math.floor(u.progress*100)}%`:''}</div>`;}).join('');
  panel.querySelector('#robot-trains').innerHTML=Object.values(ops.logistics.trains).map(t=>`<div class="ops-row">${t.id==='red'?'红列':'蓝列'}：${t.slots.filter(Boolean).length}/${t.slots.length} 台${t.job?` · ${t.job.type==='load'?'装车':'卸车'} ${t.job.index+1}/${t.job.ids.length}`:' · '+ops.freightStatus(t.id)}</div>`).join('');
  const friendly=ops.combat.units.filter(u=>u.team==='friendly'),list=friendly.map(u=>[u.id,Math.ceil(u.hp),u.state,u.magazine,u.reserve,Math.ceil(u.heat),Math.floor(u.pressure),Math.ceil(u.skillCooldown),u.braced,selected.has(u.id)].join(':')).join('|');if(list!==unitList){unitList=list;panel.querySelector('#robot-units').innerHTML=friendly.map(u=>{const skill=robotSkillStatus(u),state=COMBAT_STATES[u.state]||u.state;return`<label class="ops-row"><input type="checkbox" data-robot="${u.id}" ${selected.has(u.id)?'checked':''}> ${NAMES[u.kind]} ${u.id} · ${state}<br><small>耐久 ${Math.ceil(u.hp)}/${u.maxHp} · 弹仓 ${Math.floor(u.magazine)} · 备弹 ${Math.floor(u.reserve)}<br>热量 ${Math.ceil(u.heat)}%${u.overheated?' · 泄热中，降至 55% 可开火':''}${u.kind==='ant'?` · 压力 ${Math.floor(u.pressure)}%`:''}<br>${skill.label}：${skill.reason||'可用'}${u.damageParts.weapon>=.4?' · 武器损坏':u.damageParts.legs>=.7?' · 行动受损':''}</small></label>`;}).join('')||'<small>整机卸车后出现在这里。</small>';}
  drawMap();panel.querySelector('#robot-auto-retreat').checked=ops.combat.autoRetreat;
  panel.querySelector('#robot-ops-output').textContent=ops.message||'工厂正在准备首批机器人。';
 }};
}
