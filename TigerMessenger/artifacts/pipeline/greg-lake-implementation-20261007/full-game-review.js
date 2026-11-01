const frame=document.querySelector('#game'),status=document.querySelector('#status'),message=document.querySelector('#message'),buttons=[...document.querySelectorAll('[data-view]')],restore=document.querySelector('#restore');
const gameURL=new URL('../../../index.html',location.href);gameURL.search='?tour=crystal-v7&autostart=1';
frame.src=gameURL.href;document.querySelector('#game-link').href=gameURL.href;
let saved=null,active='',lastAPI=null;
const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
function state(){
 const api=frame.contentWindow?.__tm,wrapper=api?.messenger?.landmarks?.moebiusSwamp,inner=wrapper?.userData?.inner;
 if(!api?.player||!api.cameraRig||!inner)return null;
 return {api,inner,plan:inner.userData.gregSpatialPlan,rim:inner.userData.gregCoralRim};
}
function riding(api){return api.player.riding||api.cameraRig.isFirstPerson()||['boatRide','tramRide','airshipRide','scoutAircraftRide'].some(key=>api[key]?.isRiding?.());}
function snapshot(api){
 const p=api.player;return {position:p.position.clone(),velocity:p.velocity.clone(),forward:p.forward.clone(),facing:p.facing.clone(),onGround:p.onGround,groundR:p.groundR,dist:api.cameraRig.getDist(),orbit:api.cameraRig.getOrbit()};
}
function target(s,id){
 const V=s.api.THREE.Vector3;
 if(id==='rim'){
  if(!s.rim?.ok)throw Error('实际坑缘承托尚未接入，不能放置玩家。');
  const angle=s.rim.entranceAngle+s.rim.entranceHalfAngle+.12,r=s.rim.rimPatrolRadius;
  return {point:new V(Math.cos(angle)*r,s.rim.topY,Math.sin(angle)*r),meshes:s.rim.walkMeshes,next:new V(Math.cos(angle-.06)*r,s.rim.topY,Math.sin(angle-.06)*r)};
 }
 if(id==='entry'){
  const step=s.inner.userData.tigerWalkSurfaces?.[0];if(!step)throw Error('原入口首阶不可用。');
  s.inner.updateWorldMatrix(true,true);const world=step.getWorldPosition(new V()),point=s.inner.worldToLocal(world);point.y+=.6;
  return {point,meshes:[step],next:s.inner.userData.tigerWalkSurfaces[1].position.clone()};
 }
 const level=s.plan?.levels?.[{upper:0,middle:1,lower:2}[id]];if(!level)throw Error('三层岸路未接入，不能使用概念坐标替代。');
 const middle=(level.angleStart+level.angleEnd)/2;
 const candidates=s.plan.route.map((p,index)=>({p:new V(...p),index})).filter(r=>Math.abs(r.p.y-level.innerY)<.001);
 candidates.sort((a,b)=>Math.abs(Math.atan2(a.p.z,a.p.x)-middle)-Math.abs(Math.atan2(b.p.z,b.p.x)-middle));
 const choice=candidates[0];if(!choice)throw Error('找不到对应实际路线点。');
 return {point:choice.p,meshes:s.plan.walkMeshes,next:new V(...s.plan.route[Math.min(s.plan.route.length-1,choice.index+2)])};
}
function place(id){
 try{
  const s=state();if(!s)throw Error('游戏尚未完成启动。');const {api,inner}=s;
  if(riding(api))throw Error('请先在正式游戏中退出载具，再调整观察起点。');
  const t=target(s,id),V=api.THREE.Vector3;inner.updateWorldMatrix(true,true);
  const world=inner.localToWorld(t.point.clone()),up=world.clone().normalize();
  const ray=new api.THREE.Raycaster(world.clone().addScaledVector(up,1),up.clone().negate());ray.far=2;
  const hit=ray.intersectObjects(t.meshes,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.5);
  if(!hit)throw Error('实际目标表面没有径向承托，取消定位。');
  saved??=snapshot(api);
  const p=api.player;p.position.copy(hit.point).addScaledVector(up,.025);p.velocity.set(0,0,0);p.onGround=true;p.groundR=hit.point.length();
  const aim=document.querySelector('#heading').value==='route'?t.next:new V(-8,t.point.y,-7);
  p.forward.copy(inner.localToWorld(aim)).sub(p.position);p.forward.addScaledVector(up,-p.forward.dot(up)).normalize();p.facing.copy(p.forward);
  const orbit=api.cameraRig.getOrbit();api.cameraRig.orbitBy(orbit.yaw);api.cameraRig.orbitPitchBy(-orbit.pitch);api.cameraRig.setDist(7.5);api.cameraRig.snapToPlayer();
  active=id;for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.view===id));restore.disabled=false;
  message.textContent=`已定位「${buttons.find(b=>b.dataset.view===id).textContent}」。现在由正式游戏碰撞控制；点击画面后行走。`;
  monitor();
  frame.contentWindow.focus();
 }catch(error){message.textContent=error.message;}
}
for(const button of buttons)button.addEventListener('click',()=>place(button.dataset.view));
restore.addEventListener('click',()=>{
 const s=state();if(!s||!saved)return;
 if(riding(s.api)){message.textContent='请先退出载具，再返回观察前位置。';return;}
 const {api}=s,p=api.player;for(const key of ['position','velocity','forward','facing'])p[key].copy(saved[key]);p.onGround=saved.onGround;p.groundR=saved.groundR;
 const orbit=api.cameraRig.getOrbit();api.cameraRig.orbitBy(orbit.yaw-saved.orbit.yaw);api.cameraRig.orbitPitchBy(saved.orbit.pitch-orbit.pitch);api.cameraRig.setDist(saved.dist);api.cameraRig.snapToPlayer();
 active='';for(const b of buttons)b.setAttribute('aria-pressed','false');message.textContent='已返回本次观察前的内存位置；存档和检查点没有改动。';monitor();frame.contentWindow.focus();
});
function monitor(){
 try{
  const s=state();if(!s){status.textContent='正式游戏启动中，等待现有 __tm 调试接口…';return;}
  const {api,inner}=s;if(lastAPI!==api){lastAPI=api;saved=null;restore.disabled=true;active='';}for(const button of buttons)button.disabled=false;
  const local=inner.worldToLocal(api.player.position.clone()),radius=api.player.position.length(),sample=inner.userData.sampleGroundRadius?.(api.player.position),r=api.renderer.info.render;
  const bridge=inner.userData.gregBridgeClearance;
  status.textContent=`正式完整场景 · round ${inner.userData.swampV2Round??'—'} · rim ${s.rim?.ok?'已接入':'缺失'} · dock ${inner.userData.gregShoreDock?.ok?'已接入':'缺失'} · 当前观察 ${active||'自由行走/母塔港'}\n玩家 inner [${local.toArray().map(fmt).join(', ')}] · 实际 groundR ${fmt(api.player.groundR)} · 足点半径 ${fmt(radius)} · 湖沼采样 R ${fmt(sample)} · onGround ${api.player.onGround} · draw calls ${r.calls} · triangles ${r.triangles}\n跨湖支撑 ${bridge?.ok?'已接入':'未接入'} · 置换穿湖柱 ${bridge?.removedPiers??'—'} · 保留柱 ${bridge?.retainedPiers??'—'} · 跨度 ${fmt(bridge?.spanWorld)} world · 湖岸视线净空 ${fmt(bridge?.bankClearanceWorld)} world · 叶冠残余交叉 ${bridge?.leafClearance?.remainingBidirectionalIntersections??'未测'}`;
 }catch(error){status.textContent=`无法读取同源正式场景：${error.message}`;}
}
setInterval(monitor,1000);monitor();
