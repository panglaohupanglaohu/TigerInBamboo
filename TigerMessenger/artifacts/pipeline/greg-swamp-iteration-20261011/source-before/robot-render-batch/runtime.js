import {findDeploymentBay,repairDeploymentOverlaps} from './deployment.js';
import {createBaseDefense} from './baseDefense.js';
import {createBookshopPedestrians} from '../../world/bookshopPedestrians.js';
import {validateRobotOperationsSave} from './saveState.js';
import {createRobotHandlingRig} from './handlingRig.js';
import {createRobotEffects} from './effects.js';
import * as THREE from 'three';
import {RobotLogistics,ROBOT_KINDS,ROBOT_CARGO_SLOTS} from './logistics.js';
import {RobotCombat,ROBOT_RULES} from './combat.js';
import {createRobotOpsPanel} from './panel.js';
import {BOOKSHOP_ROBOT_FACTORIES} from '../../assets/bookshopRobots.js';
import {animateArticulatedRobot} from '../../assets/robotArticulation.js';
import {townSurfacePoint,seatTownObject,townSurfaceMesh} from '../../world/bookshopTownSite.js';
import {factoryKit} from '../../assets/factoryArchitecture.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';
const SAVE='tigermessenger-robot-operations-v1';
const NAMES={locust:'蝗虫',ant:'蚂蚁',beetle:'甲壳虫'};
export function createRobotOperations({scene,base,tramSystem,camera,cameraRig,colliders=[],getFleet=()=>null,getAssault=()=>null,R=160}){
 const logistics=new RobotLogistics(),obstacles=[{x:-9,z:-1,radius:2.5},{x:8,z:0,radius:2.8},{x:0,z:-8,radius:2.3}],combat=new RobotCombat({obstacles,bounds:{minX:-25,maxX:25,minZ:-16,maxZ:16}});combat.home={x:0,z:12};logistics.maxUnits=54;logistics.handlingSeconds=12;logistics.unloadingSeconds=20;
 const root=new THREE.Group();root.name='robot-operations-live';scene.add(root);
 const field=new THREE.Group();field.name='robot-proving-ground';base.add(field);seatTownObject(base,field,0,-87,0,R);
 const {M,box,cyl,beam,sign}=factoryKit(field);townSurfaceMesh(field,-25,25,-16,16,M.stone,R,.925,24);
 for(const o of obstacles){const prop=new THREE.Group();field.add(prop);seatTownObject(field,prop,o.x,o.z,0,R);box(o.radius*1.5,2.2,o.radius*1.5,0,1.1,0,M.iron,prop);for(const x of[-.7,.7])box(.14,2.3,1.2,x,1.15,0,M.brass,prop);}
 for(let x=-24;x<=24;x+=4)for(const z of[-15.5,15.5]){const p=townSurfacePoint(field,x,z,R,1.15);cyl(.08,.6,...p.toArray(),M.brass);}
 sign('ROBOT LEGION · PROVING GROUND',12,1.4,0,3.4,15.8);mergeStaticGroup(field);
 const modelRoot=new THREE.Group();modelRoot.name='robot-live-units';root.add(modelRoot);
 const templates=new Map(),models=new Map(),landingBays=new Map(),waitingFactories=new Map(),lastTrainProgress=new Map(),previousJobs=new Map();let focusMode=null,elapsed=0,shipment=0,saveTimer=0,eventCursor=0,exerciseNumber=0;
 const api={logistics,combat,models,root,field,message:'三厂各有 3 套首批零件，按三台同型成批出厂。',focus(mode){focusMode=mode;if(!mode)cameraRig?.snapToPlayer?.();},
  freightStatus(id){const s=tramSystem.freightServices.find(s=>s.tram.userData.variant===id);return !s?'待命':s.tram.userData.signalHold?'交汇处让行':s.shuntingBack?'回厂调车':logistics.isHolding(id)?'吊装锁定':waitingFactories.has(id)?'等待同型三台齐备':s.dwell>0?'站内停留':'运行中';},
  receiveShipment(){if(shipment>0){api.message='本船仍在卸货。';return false;}shipment=28;api.message='蒸汽货船正在卸货，28 秒后入库。';return true;},
  startExercise(){if(!combat.units.some(u=>u.team==='friendly'&&u.hp>0)){api.message='先等待一个机器人批次完成装运、卸车。';return false;}if(combat.units.some(u=>u.team==='enemy'&&u.hp>0)){api.message='当前演练尚未结束。';return false;}exerciseNumber++;for(let i=0;i<3;i++)combat.add({id:`TARGET-${exerciseNumber}-${i+1}`,kind:'sentry',team:'enemy',x:-16+i*16,z:-12});api.message='机械靶演练开始。选择单位下令，或使用守住/撤退。';return true;},
  save(){try{localStorage.setItem(SAVE,JSON.stringify({version:1,logistics:logistics.snapshot(),combat:combat.snapshot(),shipment,exerciseNumber,trains:tramSystem.freightServices.map(s=>({variant:s.tram.userData.variant,progress:s.progress,lastStop:s.lastStop,dwell:s.dwell,shuntingBack:!!s.shuntingBack}))}));api.message='生产、货位与军团状态已保存。';return true;}catch(e){api.message='保存失败：'+e.message;return false;}},
  load(){try{const raw=localStorage.getItem(SAVE);if(!raw){api.message='没有已保存的军团进度。';return false;}const data=validateRobotOperationsSave(JSON.parse(raw));logistics.restore(data.logistics);combat.restore(data.combat);landingBays.clear();waitingFactories.clear();lastTrainProgress.clear();previousJobs.clear();repairDeploymentOverlaps(combat);eventCursor=combat.eventSequence;effects.clear();handling.begin();shipment=data.shipment||0;exerciseNumber=data.exerciseNumber||0;for(const s of data.trains||[]){tramSystem.seekFreight(s.variant,s.progress);const service=tramSystem.freightServices.find(x=>x.tram.userData.variant===s.variant);if(service){service.lastStop=s.lastStop;service.dwell=s.dwell;service.shuntingBack=!!s.shuntingBack;}}restoreStationHolds();for(const m of models.values())m.removeFromParent();models.clear();api.message='已读取进度；中断吊装从安全锚点继续。';return true;}catch(e){api.message='未读取：'+e.message;return false;}},
  snapshot(){return{logistics:logistics.snapshot(),combat:combat.snapshot(),models:models.size,effects:effects.count,shipment,focus:focusMode};}
 };
 api.defense=createBaseDefense({scene,base,logistics,models,combat,getFleet,getAssault,R});
 const pedestrians=createBookshopPedestrians({base,colliders,tramSystem,R,isAlarm:()=>api.defense?.active});api.pedestrians=pedestrians;
 const panel=createRobotOpsPanel(api);api.panel=panel;
 const effects=createRobotEffects({root,models,field,point:townSurfacePoint,R});
 const handling=createRobotHandlingRig({base,root,R});
 function template(kind){if(!templates.has(kind)){const m=BOOKSHOP_ROBOT_FACTORIES[ROBOT_KINDS.indexOf(kind)]({rigged:true});m.scale.setScalar(1.25);animateArticulatedRobot(m,{state:'transport'});m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m,true);m.userData.transportMinY=b.min.y;m.userData.transportMaxY=b.max.y;m.userData.transportSize=b.getSize(new THREE.Vector3()).toArray();templates.set(kind,m);}return templates.get(kind);}
 function ensureModel(u){if(models.has(u.id))return models.get(u.id);let m;
  if(u.kind==='sentry'){m=new THREE.Group();const kit=factoryKit(m);kit.box(1.8,.45,1.8,0,.225,0,kit.M.iron);kit.cyl(.62,1.1,0,.95,0,kit.M.copper);kit.box(1.5,.7,1.1,0,1.8,0,kit.M.slate);kit.cyl(.12,1.4,0,1.8,.75,kit.M.iron).rotation.x=Math.PI/2;mergeStaticGroup(m);}
  else m=template(u.kind).clone(true);
  m.traverse(o=>{if(o.isMesh)o.userData.noDistanceCulling=true;});m.name='robot-unit-'+u.id;m.userData.robotId=u.id;m.userData.robotType=u.kind;modelRoot.add(m);models.set(u.id,m);return m;
 }
 function court(kind){return base.getObjectByName(kind+'-bookshop-court');}
 function stockPose(u){const d=court(u.kind),index=logistics.units.filter(v=>v.kind===u.kind).findIndex(v=>v.id===u.id)%6,x=-14+(index%3)*7,z=index<3?-37.6:-33.6;const p=d.localToWorld(townSurfacePoint(d,x,z,R,1.58));const up=p.clone().normalize(),forward=new THREE.Vector3(0,0,1).transformDirection(d.matrixWorld),right=new THREE.Vector3().crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));return{p,q};}
 function fieldPose(u){const p=field.localToWorld(townSurfacePoint(field,u.x,u.z,R,.94)),up=p.clone().normalize(),forward=new THREE.Vector3(Math.sin(u.heading),0,Math.cos(u.heading)).transformDirection(field.matrixWorld),right=new THREE.Vector3().crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();return{p,q:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward))};}
 function cargoPose(u,m){const service=tramSystem.freightServices.find(s=>s.tram.userData.variant===u.train),car=service?.wagons[u.slot];if(!car)return null;car.updateWorldMatrix(true,false);return{p:car.localToWorld(new THREE.Vector3(0,car.userData.deckHeight-m.userData.transportMinY,0)),q:car.getWorldQuaternion(new THREE.Quaternion())};}
 function deployPosition(u){
  const current=combat.get(u.id);if(current)return{x:current.x,z:current.z};
  if(!landingBays.has(u.id)){const p=findDeploymentBay(combat.units,obstacles,[...landingBays].filter(([id])=>!combat.get(id)).map(([id,p])=>({id,...p})),u.id);if(p)landingBays.set(u.id,p);}
  return landingBays.get(u.id)||null;
 }
 function drawUnit(u){const m=ensureModel(u);m.visible=true;if(u.status==='lost'){const c=combat.get(u.id);if(c){const p=fieldPose(c);m.position.copy(p.p);m.quaternion.copy(p.q);animateArticulatedRobot(m,{state:'disabled'});}else m.visible=false;return;}let pose,state='idle';
  if(u.status==='transit'){pose=cargoPose(u,m);state='transport';}
  else if(u.status==='loading'||u.status==='unloading'){
   const job=logistics.trains[u.train]?.job;if(!job)return;const source=u.status==='loading'?stockPose(u):cargoPose(u,m),deploy=deployPosition(u),target=u.status==='loading'?cargoPose(u,m):deploy?fieldPose({...deploy,heading:Math.PI}):null;if(!source||!target)return;
   const a=Math.min(1,job.elapsed/logistics.handlingDuration(job)),ease=x=>x*x*(3-2*x),t=ease(Math.max(0,Math.min(1,(a-.2)/.6))),height=u.status==='unloading'?R+22:Math.max(source.p.length(),target.p.length())+7;
   const p=source.p.clone().lerp(target.p,t).normalize().multiplyScalar(a<.2?THREE.MathUtils.lerp(source.p.length(),height,ease(a/.2)):a>.8?THREE.MathUtils.lerp(height,target.p.length(),ease((a-.8)/.2)):height);
   pose={p,q:source.q.clone().slerp(target.q,t)};state='transport';
  }else if(u.status==='deployed'||u.status==='repair'){
   let c=combat.get(u.id);if(!c){const pos=deployPosition(u);if(!pos){m.visible=false;return;}c=combat.add({id:u.id,kind:u.kind,...pos});c.heading=Math.PI;}
   pose=fieldPose(c);state=c.hp<=0?'disabled':c.state;
   animateArticulatedRobot(m,{time:elapsed,speed:c.speed,state,braced:c.braced,aim:c.turretYaw||0,fire:c.speed>0&&!!c.target,recoil:c.recoil,damage:1-c.hp/c.maxHp});
  }else pose=stockPose(u);
  if(!pose)return;m.position.copy(pose.p);m.quaternion.copy(pose.q);
  if(!['deployed','repair'].includes(u.status))animateArticulatedRobot(m,{time:elapsed,state});
  m.traverse(o=>{if(!o.name.startsWith('armor-joint-'))return;const threshold=/hip|knee|ankle|wheel/.test(o.name)?.04:/body/.test(o.name)?.32:.68;o.visible=u.status!=='assembly'||u.progress>=threshold;});
  if(u.status==='loading'||u.status==='unloading')handling.place(u.status==='unloading'?'frontline':u.kind,m,m.userData.transportMaxY);
 }
 function drawEnemy(u){const m=ensureModel(u),pose=fieldPose(u);m.position.copy(pose.p);m.quaternion.copy(pose.q);m.rotation.z+=u.hp<=0?.3:0;}
 function canAwaitBatch(id,kind){
  const f=logistics.factories[kind],t=logistics.trains[id];if(!f||!f.enabled||!t.slots.some((_,i)=>i<=ROBOT_CARGO_SLOTS-3&&t.slots.slice(i,i+3).every(v=>v===null)))return false;
  if(t.slots.some(slot=>slot&&logistics.get(slot)?.kind===kind))return false;
  return true; // The factory holds its train until a real batch is ready.
 }
 const freightController={isHolding:id=>logistics.isHolding(id)||waitingFactories.has(id),onArrive:(id,stop)=>{
  const t=logistics.trains[id],service=tramSystem.freightServices.find(s=>s.tram.userData.variant===id);
  const first=id==='red'?'locust':'beetle';
  if(service.shuntingBack){if(stop!==first)return;service.shuntingBack=false;}
  // A loaded train must actually travel the world route before returning to the
  // receiving crane. Otherwise the nearby test depot empties it before departure.
  if(stop==='frontline'&&t.slots.some(Boolean)&&(t.haulDistance||0)<service.trackLen*.9){api.message='整机已装车，先环游世界运输，再返站卸车。';return;}
  if(stop==='frontline'){
   const reservations=[...landingBays].filter(([id])=>!combat.get(id)).map(([id,p])=>({id,...p})),newBays=[];
   for(const cargoId of t.slots.filter(Boolean)){
    if(combat.get(cargoId)||landingBays.has(cargoId))continue;
    const p=findDeploymentBay(combat.units,obstacles,reservations,cargoId);
    if(!p){api.message='试验场泊位不足，整机保留在货车上继续运输。';return;}
    reservations.push({id:cargoId,...p});newBays.push([cargoId,p]);
   }
   for(const[id,p]of newBays)landingBays.set(id,p);
  }
  if(ROBOT_KINDS.includes(stop)&&t.slots.some(slot=>slot&&logistics.get(slot)?.kind===stop))return;
  const wasEmpty=t.slots.every(v=>v===null),started=logistics.dock(id,stop);
  if(started&&wasEmpty)t.haulDistance=0;
  if(!started&&canAwaitBatch(id,stop))waitingFactories.set(id,stop);
  api.message=started?`${id==='red'?'红列':'蓝列'}正在${stop==='frontline'?'卸车部署':NAMES[stop]+'工厂装车'}。`:waitingFactories.has(id)?`${NAMES[stop]}等待三台整机齐备，完成吊装后发车。`:'本次经停没有可装卸整批。';
 }};
 tramSystem.setFreightController(freightController);
 function restoreStationHolds(){
  // Waiting for production is not a crane job. Rebuild that lock after loading
  // a save, otherwise lastStop prevents onArrive firing again and the train escapes.
  for(const service of tramSystem.freightServices){
   const id=service.tram.userData.variant,t=logistics.trains[id];
   previousJobs.set(id,t.job?.type||null);
   const stop=service.loadingStops.find(s=>s.name===service.lastStop);
   if(!stop||Math.min(Math.abs(service.progress-stop.progress),1-Math.abs(service.progress-stop.progress))*service.trackLen>.5)continue;
   if(!t.job&&stop.name==='frontline'&&t.slots.every(v=>v===null))service.shuntingBack=true;
   if(!t.job&&!service.shuntingBack&&canAwaitBatch(id,stop.name))waitingFactories.set(id,stop.name);
  }
 }
 function stageNewService(){
  // New games used to spawn both empty trains on the world route, several
  // minutes before the first factory. Start at their actual loading platforms.
  for(const service of tramSystem.freightServices){
   const id=service.tram.userData.variant,first=id==='red'?'locust':'beetle';
   const stop=service.loadingStops.find(s=>s.name===first);
   tramSystem.seekFreight(id,stop.progress);
   service.lastStop=first;service.dwell=3;service.shuntingBack=false;
   freightController.onArrive(id,first);
  }
 }
 api.update=(dt)=>{
  elapsed+=dt;logistics.update(dt);combat.update(dt);pedestrians.update(dt);
  for(const service of tramSystem.freightServices){const id=service.tram.userData.variant,t=logistics.trains[id],previous=lastTrainProgress.get(id);lastTrainProgress.set(id,service.progress);if(previous!==undefined&&t.slots.some(slot=>slot&&logistics.get(slot)?.status==='transit')){const delta=((service.progress-previous)*service.direction+1)%1;if(delta<.05)t.haulDistance=(t.haulDistance||0)+delta*service.trackLen;}}
  for(const service of tramSystem.freightServices){
   const id=service.tram.userData.variant,t=logistics.trains[id],last=id==='red'?'beetle':'locust';
   const complete=ROBOT_KINDS.every(kind=>t.slots.filter(slot=>slot&&logistics.get(slot)?.kind===kind&&logistics.get(slot)?.status==='transit').length>=3);
   if(!t.job&&previousJobs.get(id)==='unload'){service.shuntingBack=true;api.message='卸车完成，空编组倒车回首厂，重新收齐三种整机。';}
   // Legacy partial manifests may reach the last factory without all three types.
   // Back along the same rails (no teleport) rather than leave with missing cargo.
   if(service.lastStop===last&&!t.job&&!waitingFactories.has(id)&&!complete)service.shuntingBack=true;
   previousJobs.set(id,t.job?.type||null);
  }
  for(const[id,kind]of waitingFactories){if(logistics.dock(id,kind)){waitingFactories.delete(id);if(logistics.trains[id].slots.filter(Boolean).length===3)logistics.trains[id].haulDistance=0;api.message=NAMES[kind]+'三台齐备，开始逐台吊装。';}else if(!canAwaitBatch(id,kind))waitingFactories.delete(id);}
  if(!shipment&&[...waitingFactories.values()].some(kind=>{const f=logistics.factories[kind];return f.kits<3&&!f.active&&logistics.units.filter(u=>u.status!=='lost').length<logistics.maxUnits-2;}))api.receiveShipment();
  if(shipment>0){shipment=Math.max(0,shipment-dt);if(shipment===0){for(const kind of ROBOT_KINDS)logistics.receive(kind,3);api.message='本船零件已入库，三厂各收到 3 套。';}}
  handling.begin();
  for(const u of logistics.units)drawUnit(u);for(const u of combat.units)if(u.team==='enemy')drawEnemy(u);
  api.defense.update(dt);
  for(const e of combat.events)if(e.sequence>eventCursor)effects.emit(e);eventCursor=combat.eventSequence;effects.update(dt);
  for(const u of combat.units){const l=logistics.get(u.id);if(!l)continue;l.health=u.hp/u.maxHp;if(u.hp<=0)logistics.markLost(u.id);else if(u.state==='repair')logistics.repair(u.id);else if(l.status==='repair'&&u.hp===u.maxHp)logistics.finishRepair(u.id);}
  saveTimer+=dt;if(saveTimer>=30){saveTimer=0;const message=api.message;api.save();api.message=message;}
  panel.update(elapsed);
 };
 api.updateCamera=()=>{if(!focusMode)return;let target,up,eye;
  if(focusMode==='loading'){const unit=logistics.units.find(u=>u.status==='loading'||u.status==='unloading'),m=unit&&models.get(unit.id);if(m){target=m.getWorldPosition(new THREE.Vector3());up=target.clone().normalize();const forward=new THREE.Vector3(0,0,1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())),right=new THREE.Vector3().crossVectors(up,forward).normalize();eye=target.clone().addScaledVector(up,7).addScaledVector(right,12).addScaledVector(forward,16);target.addScaledVector(up,2);}else{const service=tramSystem.freightServices.find(s=>logistics.trains[s.tram.userData.variant].slots.some(Boolean));if(service){target=service.wagons[2].getWorldPosition(new THREE.Vector3());up=target.clone().normalize();eye=service.wagons[2].localToWorld(new THREE.Vector3(15,10,17));}else{target=base.localToWorld(new THREE.Vector3(0,0,-30));up=target.clone().normalize();eye=base.localToWorld(new THREE.Vector3(30,45,30));}}}
  else if(focusMode==='train'||focusMode==='blue-train'){const s=tramSystem.freightServices[focusMode==='blue-train'?1:0],car=s.wagons[2];target=car.position.clone();up=target.clone().normalize();const outward=target.clone().sub(base.getWorldPosition(new THREE.Vector3())).addScaledVector(up,-target.clone().sub(base.getWorldPosition(new THREE.Vector3())).dot(up)).normalize();eye=target.clone().addScaledVector(up,34).addScaledVector(outward,42);}
  else{const parent=focusMode==='field'?field:focusMode==='factory'?court('locust'):base;const local=focusMode==='field'?new THREE.Vector3(0,0,0):focusMode==='factory'?new THREE.Vector3(0,2,-30):new THREE.Vector3(0,0,32);target=parent.localToWorld(local);up=target.clone().normalize();eye=parent.localToWorld(focusMode==='field'?new THREE.Vector3(0,44,28):focusMode==='factory'?new THREE.Vector3(-30,28,-64):new THREE.Vector3(0,95,106));}
  if(focusMode==='loading'){
   const blockers=base.userData.cameraOccludersNear?.(target,65)||[],ray=new THREE.Raycaster(),origin=target.clone().addScaledVector(up,2),offset=eye.clone().sub(target),horizontal=offset.clone().addScaledVector(up,-offset.dot(up)).normalize();
   let chosen=null;
   for(const height of[12,20,30]){for(const angle of[0,Math.PI,-Math.PI/2,Math.PI/2]){const candidate=target.clone().addScaledVector(up,height).addScaledVector(horizontal.clone().applyAxisAngle(up,angle),22),delta=candidate.clone().sub(origin);ray.set(origin,delta.clone().normalize());ray.far=delta.length();if(!ray.intersectObjects(blockers,false).length){chosen=candidate;break;}}if(chosen)break;}
   if(chosen)eye=chosen;else eye=target.clone().addScaledVector(up,36).addScaledVector(horizontal,8);
  }
  camera.position.copy(eye);camera.up.copy(up);camera.lookAt(target);camera.updateMatrixWorld();
 };
 const restored=localStorage.getItem(SAVE)&&api.load();
 if(!restored)stageNewService();
 if(new URLSearchParams(location.search).get('robotOps')==='1'){panel.open();api.focus('factory');}
 return api;
}
