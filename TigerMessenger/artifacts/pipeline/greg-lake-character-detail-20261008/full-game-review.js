const frame=document.querySelector('#game'),status=document.querySelector('#status'),message=document.querySelector('#message'),buttons=[...document.querySelectorAll('[data-view]')],restore=document.querySelector('#restore');
const gameURL=new URL('../../../index.html',location.href);gameURL.search='?tour=crystal-v7&autostart=1';
frame.src=gameURL.href;document.querySelector('#game-link').href=gameURL.href;
let saved=null,active='',lastAPI=null;
// Bounded, read-only renderer samples for the ongoing allocation audit.
let resourceStarted=0,resourceSamples=[];
let sceneResourceSample=null,lastSceneResourceSeconds=-10;
function censusResources(scene){
 const textures=new Set(),sources=new Set(),bones=new Set(),shadowMaps=new Set();
 let skinned=0,shadowLights=0;
 scene.traverse(object=>{
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material)continue;
   for(const value of Object.values(material))if(value?.isTexture){textures.add(value.uuid);if(value.source)sources.add(value.source.uuid);}
  }
  if(object.isSkinnedMesh){skinned++;if(object.skeleton?.boneTexture)bones.add(object.skeleton.boneTexture.uuid);}
  if(object.isLight&&object.castShadow){shadowLights++;if(object.shadow?.map)shadowMaps.add(object.shadow.map.texture?.uuid);}
 });
 return {materialTextures:textures.size,textureSources:sources.size,skinnedMeshes:skinned,boneTextures:bones.size,shadowLights,shadowMaps:shadowMaps.size};
}
const resourceOutput=document.createElement('details');
resourceOutput.innerHTML='<summary>GPU 资源采样（仅诊断，不代表性能通过）</summary><pre id="resource-samples"></pre>';
status.after(resourceOutput);
const inputButton=document.querySelector('#input-check'),inputResult=document.querySelector('#input-result');
let inputCheckRunning=false;
inputButton.addEventListener('click',()=>{
 const s=state();if(!s||inputCheckRunning||riding(s.api)||!active)return;
 // Exercise the production key listener and physics, without writing position
 // during the movement. This is synthetic input, not native keyboard evidence.
 const win=frame.contentWindow,start=s.api.player.position.clone(),samples=[];
 inputCheckRunning=true;inputButton.disabled=true;win.focus();
 const event=type=>win.dispatchEvent(new win.KeyboardEvent(type,{code:'KeyW',key:'w',bubbles:true,cancelable:true}));
 const started=performance.now();let released=false;
 function release(){if(released)return;released=true;event('keyup');inputCheckRunning=false;inputButton.disabled=false;
  inputResult.textContent=JSON.stringify({kind:'synthetic-KeyW-production-input',durationMs:+(performance.now()-started).toFixed(1),view:active,samples:samples.length,displacementWorld:+s.api.player.position.distanceTo(start).toFixed(4),onGround:s.api.player.onGround,minFootMinusGround:samples.length?Math.min(...samples.map(x=>x.gap)):null,maxFootMinusGround:samples.length?Math.max(...samples.map(x=>x.gap)):null,innerEnd:s.inner.worldToLocal(s.api.player.position.clone()).toArray().map(x=>+x.toFixed(4))});
 }
 function sample(){if(released)return;const p=s.api.player;samples.push({gap:+(p.position.length()-p.groundR).toFixed(5)});if(performance.now()-started>=1000)release();else requestAnimationFrame(sample);}
 event('keydown');requestAnimationFrame(sample);setTimeout(release,1600);win.addEventListener('pagehide',release,{once:true});
});
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
  const {api,inner}=s;if(lastAPI!==api){lastAPI=api;saved=null;restore.disabled=true;active='';resourceStarted=performance.now();resourceSamples=[];sceneResourceSample=null;lastSceneResourceSeconds=-10;}for(const button of buttons)button.disabled=inputCheckRunning;inputButton.disabled=!active||inputCheckRunning;
  const local=inner.worldToLocal(api.player.position.clone()),radius=api.player.position.length(),sample=inner.userData.sampleGroundRadius?.(api.player.position),r=api.renderer.info.render;
  const bridge=inner.userData.gregBridgeClearance;
  const memory=api.renderer.info.memory;
  const seconds=+((performance.now()-resourceStarted)/1000).toFixed(1);
  // Scan only every ten seconds so diagnostics do not traverse the whole world
  // each frame. Renderer counters include allocations beyond scene materials.
  if(seconds-lastSceneResourceSeconds>=10||!sceneResourceSample){sceneResourceSample=censusResources(api.scene);lastSceneResourceSeconds=seconds;}
  resourceSamples.push({seconds,view:active||'original',textures:memory.textures,geometries:memory.geometries,programs:api.renderer.info.programs?.length,calls:r.calls,triangles:r.triangles,sceneResources:sceneResourceSample});
  if(resourceSamples.length>120)resourceSamples.shift();
  document.querySelector('#resource-samples').textContent=JSON.stringify(resourceSamples,null,2);
  let cameraOutput=document.querySelector('#camera-diagnostics');
  if(!cameraOutput){cameraOutput=document.createElement('pre');cameraOutput.id='camera-diagnostics';resourceOutput.append(cameraOutput);}
  const V=api.THREE.Vector3,cameraDirection=api.camera.getWorldDirection(new V());
  const cameraRay=new api.THREE.Raycaster(api.camera.position.clone(),cameraDirection);cameraRay.camera=api.camera;
  const visibleMeshes=[];api.scene.traverseVisible(o=>{if(o.isMesh)visibleMeshes.push(o);});
  const hits=cameraRay.intersectObjects(visibleMeshes,false).slice(0,8).map(h=>({name:h.object.name,parent:h.object.parent?.name,distance:h.distance,point:inner.worldToLocal(h.point.clone()).toArray()}));
  cameraOutput.textContent=JSON.stringify({cameraWorld:api.camera.position.toArray(),cameraInner:inner.worldToLocal(api.camera.position.clone()).toArray(),direction:cameraDirection.toArray(),near:api.camera.near,fov:api.camera.fov,zoom:api.camera.zoom,occlusionEnabled:api.cameraRig.isOcclusionEnabled?.(),occlusionDistance:api.cameraRig.getOcclusionDist?.(),distance:api.cameraRig.getDist(),orbit:api.cameraRig.getOrbit(),firstPerson:api.cameraRig.isFirstPerson(),hits},null,2);
  status.textContent=`正式完整场景 · round ${inner.userData.swampV2Round??'—'} · rim ${s.rim?.ok?'已接入':'缺失'} · dock ${inner.userData.gregShoreDock?.ok?'已接入':'缺失'} · 当前观察 ${active||'自由行走/母塔港'}\n玩家 inner [${local.toArray().map(fmt).join(', ')}] · 实际 groundR ${fmt(api.player.groundR)} · 足点半径 ${fmt(radius)} · 湖沼采样 R ${fmt(sample)} · onGround ${api.player.onGround} · draw calls ${r.calls} · triangles ${r.triangles}\n跨湖支撑 ${bridge?.ok?'已接入':'未接入'} · 置换穿湖柱 ${bridge?.removedPiers??'—'} · 保留柱 ${bridge?.retainedPiers??'—'} · 跨度 ${fmt(bridge?.spanWorld)} world · 湖岸视线净空 ${fmt(bridge?.bankClearanceWorld)} world · 叶冠残余交叉 ${bridge?.leafClearance?.remainingBidirectionalIntersections??'未测'}`;
 }catch(error){status.textContent=`无法读取同源正式场景：${error.message}`;}
}
setInterval(monitor,1000);monitor();
