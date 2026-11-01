import * as T from 'three';
import {createMoebiusSwampPlacement} from '/TigerMessenger/src/world/moebiusSwamp.js';
import {buildHumanCourier,animateHumanCourier} from '/TigerMessenger/src/assets/characters/humanCourier.js';
const status=document.querySelector('#status'),variant=new URLSearchParams(location.search).get('variant')==='before'?'当前模型（历史对照请看生物页）':'当前模型';
if(new URLSearchParams(location.search).get('variant')==='before'){
 const notice=document.createElement('p');notice.textContent='此页始终加载当前真实工厂；旧版生物几何请打开“生物左右对照”，此 URL 不是环境历史快照。';notice.style.padding='0 12px';
 const link=document.createElement('a');link.href='./creatures.html';link.textContent='生物左右对照';notice.append(' ',link);status.before(notice);
}
const faults=[];window.addEventListener('error',e=>{faults.push(e.message);status.textContent=JSON.stringify({faults});});
try {
 const scene=new T.Scene();scene.background=new T.Color('#eee7dd');
 const camera=new T.PerspectiveCamera(60,1,.05,300),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
 renderer.debug.onShaderError=(gl,program,vs,fs)=>{faults.push(gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));};
 document.body.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xc1e2e5,0x31455a,2));const sun=new T.DirectionalLight(0xffead0,2);sun.position.set(25,50,30);scene.add(sun);
 const root=createMoebiusSwampPlacement({scale:.5,seed:7711});scene.add(root);const inner=root.userData.inner;
 // Even a paused inspection must initialize actors at their actual story positions.
 root.userData.update?.(1/60,0,{});scene.updateMatrixWorld(true);
 const levels=inner.userData.gregSpatialPlan.levels;
 const courier=buildHumanCourier();scene.add(courier);const courierFitY=courier.position.y;const courierState={velocity:new T.Vector3(),onGround:true,riding:false,holdingLetter:false,animPhase:0};
 const shore=levels[1],shoreAngle=(shore.angleStart+shore.angleEnd)/2;courier.position.copy(inner.localToWorld(new T.Vector3(Math.cos(shoreAngle)*shore.radius*2,shore.innerY,Math.sin(shoreAngle)*shore.radius*2)));courier.position.y+=courierFitY;courier.rotation.y=shoreAngle+Math.PI/2;
 const courierAnchor=courier.position.clone();
 const views={weatherCliff:[[-23,35,-9],[-30,38,-14]],overview:[[39,65,43],[-3,34,-3]],upper:[[28,38.2,4.5],[-8,31,-7]],middle:[[18,34.2,18],[-8,28,-7]],lower:[[-7,30.2,19],[-8,26,-7]],under:[[6,21,14],[-8,23,-7]],algae:[[9,14,10],[1,11.5,1]],trunk:[[-1,41,3],[-8,42,-7]],trunkMiddle:[[20,46,22],[-8,48,-7]]};
 let current=new URLSearchParams(location.search).get('view')||'overview',t=0,previous=performance.now(),lastInfo=0;
 const runtime={};
 // Swimming is an action review: play by default rather than presenting a frozen pose.
 if(current==='feedWhale')document.querySelector('#motion').checked=true;
 const greetButton=document.createElement('button');greetButton.id='greet-test';greetButton.textContent='模拟入湖迎接';document.querySelector('#drink').after(greetButton);
 greetButton.onclick=()=>{
  if(runtime.player){delete runtime.player;greetButton.textContent='模拟入湖迎接';}
  else {runtime.player={position:inner.localToWorld(new T.Vector3(-2,26,-1)),facing:new T.Vector3(0,0,1),velocity:new T.Vector3(),onGround:true};greetButton.textContent='模拟离湖返岸';}
  document.querySelector('#motion').checked=false;
 };
 function view(name){current=name;camera.position.copy(inner.localToWorld(new T.Vector3(...views[name][0])));camera.up.set(0,1,0);camera.lookAt(inner.localToWorld(new T.Vector3(...views[name][1]))); draw();}
 // Shore cameras use the actual terrace centre and the production player's 1.66-world height.
 for(const [i,name] of ['upper','middle','lower'].entries()){const l=levels[i],a=(l.angleStart+l.angleEnd)/2;views[name][0]=[Math.cos(a)*l.radius*2,l.innerY+3.32,Math.sin(a)*l.radius*2];}
 const actorViews={flowerBoat:()=>inner.userData.flowerBoyActivities?.navigation?.records?.[0]?.boat,departingShip:()=>inner.userData.shipyard.departure,shoreBoy:()=>inner.userData.flowerBoyActivities?.shore,feedWhale:()=>inner.userData.flowerBoyActivities?.feeder,repairMonkey:()=>inner.userData.shipyard.workers[0],tiger:()=>inner.userData.tiger,dock:()=>inner.userData.shipyard.barge,bird:()=>inner.getObjectByName('swamp-bird'),monkey:()=>inner.getObjectByName('swamp-longtail-monkey'),lizard:()=>inner.getObjectByName('swamp-glow-lizard')};
 function refreshActorViews(){for(const [name,get]of Object.entries(actorViews)){const actor=get();if(!actor)continue;const p=inner.worldToLocal(actor.getWorldPosition(new T.Vector3()));
  if(name==='shoreBoy'){const radial=new T.Vector3(p.x,0,p.z).normalize(),tangent=new T.Vector3(-radial.z,0,radial.x);views[name]=[p.clone().addScaledVector(radial,-2.8).addScaledVector(tangent,3.1).add(new T.Vector3(0,2.1,0)).toArray(),p.clone().add(new T.Vector3(0,.55,0)).toArray()];continue;}
  if(name==='feedWhale'){const whale=inner.userData.whales[0],w=inner.worldToLocal(whale.getWorldPosition(new T.Vector3())),center=p.clone().lerp(w,.4);views[name]=[center.clone().add(new T.Vector3(7,5,8)).toArray(),center.toArray()];continue;}
  const offset=['dock','departingShip'].includes(name)?[9,7,10]:name==='tiger'?[-7,3.2,5]:[3,2,4];views[name]=[p.clone().add(new T.Vector3(...offset)).toArray(),p.clone().add(new T.Vector3(0,name==='tiger'?.7:.2,0)).toArray()];}}
 for(const [name,label] of [['shoreBoy','岸边孩子'],['feedWhale','水中喂鲸'],['flowerBoat','花船双桨']]){const link=document.createElement('a');const params=new URLSearchParams(location.search);params.set('view',name);link.href='?'+params;link.textContent=label;document.querySelector('header').append(link);}
 views.courier=[inner.worldToLocal(courierAnchor.clone().add(new T.Vector3(.95,1.0,1.65))).toArray(),inner.worldToLocal(courierAnchor.clone().add(new T.Vector3(0,.85,0))).toArray()];
 views.courierFace=[inner.worldToLocal(courierAnchor.clone().add(new T.Vector3(.25,1.47,.55))).toArray(),inner.worldToLocal(courierAnchor.clone().add(new T.Vector3(0,1.46,0))).toArray()];
 refreshActorViews();
 document.querySelector('#pose').onchange=e=>{const pose=e.target.value;courierState.velocity.set(0,0,pose==='run'?10:pose==='walk'?3:0);courierState.riding=pose==='ride';courierState.onGround=pose!=='jump';courierState.holdingLetter=pose==='letter';for(let i=0;i<90;i++)animateHumanCourier(courierState,courier,1/60,courierState.velocity.length()>0);document.querySelector('#motion').checked=false;draw();};
 document.querySelector('#orbit').onchange=e=>{courier.rotation.y=shoreAngle+Math.PI/2+Number(e.target.value);draw();};
 document.querySelector('#drink').onclick=()=>{inner.userData.tiger.userData.forceDrink=true;document.querySelector('#motion').checked=false;};
 document.querySelector('#stride').onclick=()=>{document.querySelector('#motion').checked=false;for(let i=0;i<12;i++){t+=1/60;root.userData.update?.(1/60,t,runtime);}scene.updateMatrixWorld(true);refreshActorViews();view(current);};
 document.querySelector('#step').onclick=()=>{document.querySelector('#motion').checked=false;for(let i=0;i<120;i++){t+=1/60;root.userData.update?.(1/60,t,runtime);}scene.updateMatrixWorld(true);refreshActorViews();view(current);};
 const departureLink=document.createElement('a');departureLink.href='?variant=after&view=departingShip';departureLink.textContent='出航长船';document.querySelector('header').append(departureLink);
 const sampleSwim=document.createElement('button');sampleSwim.textContent='游泳推进 0.8 秒';sampleSwim.onclick=()=>{document.querySelector('#motion').checked=false;for(let i=0;i<48;i++){t+=1/60;root.userData.update?.(1/60,t,runtime);}scene.updateMatrixWorld(true);refreshActorViews();view(current);};document.querySelector('header').append(sampleSwim);
 Promise.resolve(inner.userData.tiger?.userData.swampTigerV2Ready).then(()=>{root.userData.update?.(0,t,{});scene.updateMatrixWorld(true);refreshActorViews();view(current);});
 function resize(){renderer.setSize(innerWidth,Math.max(350,innerHeight-document.querySelector('header').offsetHeight-document.querySelector('#status').offsetHeight));camera.aspect=renderer.domElement.width/renderer.domElement.height;camera.updateProjectionMatrix();draw();}addEventListener('resize',resize);resize();view(current);
 function entryReport(){
  const top=inner.userData.tigerWalkSurfaces?.[0],lamp=inner.getObjectByName('v2-entry-lamps')?.children[0];
  if(!top)return null;top.geometry.computeBoundingBox();
  const box=top.geometry.boundingBox,round=v=>v.map(n=>+n.toFixed(4));
  return {graded:!!inner.userData.tigerLandingGraded,topBounds:{min:round(box.min.toArray()),max:round(box.max.toArray())},topPosition:round(top.position.toArray()),lamp:lamp?{position:round(lamp.position.toArray()),clearance:lamp.userData.entryPatrolClearance??null}:null,cheeks:inner.getObjectByName('v2-entry-stone-cheeks')?.children.slice(0,2).map(n=>n.userData.entryPatrolClearance??null)};
 }
 function draw(){renderer.render(scene,camera);status.textContent=JSON.stringify({reviewBuild:'character-detail-20261008',glowFlowerBatch:inner.userData.glowFlowerRenderBatch?{version:inner.userData.glowFlowerRenderBatch.version,drawsSaved:inner.userData.glowFlowerRenderBatch.drawsSaved}:null,flowerBatch:inner.userData.flowerRenderBatch?{version:inner.userData.flowerRenderBatch.version,drawsSaved:inner.userData.flowerRenderBatch.drawsSaved}:null,courier: {model:courier.userData.runtimeModel,geometry:courier.userData.geometryRevision,podOpen:courier.userData.postalSatchel?.userData.openAmount,pose:document.querySelector('#pose').value,phase:+courierState.animPhase.toFixed(3)},workerTails:inner.userData.shipyard.workers.map(w=>({pose:w.userData.monkeyTail?.pose,length:w.userData.monkeyTail?.arcLength,raisedCoil:w.userData.monkeyTail?.raisedCoil})),tigerWalk:inner.userData.tiger?.userData.targetGait??null,tigerModel:inner.userData.tiger?.userData.tigerTargetRound??null,serviceWorker:navigator.serviceWorker?.controller?.scriptURL??null,entry:entryReport(),entryLink:inner.userData.gregSpatialPlan?.entryLink,tigerPosition:inner.userData.tiger?.position.toArray().map(n=>+n.toFixed(4)),tigerHeading:+(inner.userData.tiger?.rotation.y??0).toFixed(4),feederSwim:(()=>{const s=inner.userData.flowerBoyActivities?.feeder?.userData.flowerSwim;return s?{version:s.version,phase:s.phase,cycle:s.cycle,mouthY:s.mouthY,noseY:s.noseY,breath:s.breath}:null;})(),activities:(()=>{const a=inner.userData.flowerBoyActivities;return a?{version:a.version,boats:a.navigation?.records.map(r=>({position:r.boat.position.toArray(),heading:r.boat.rotation.y,state:r.state,cycle:r.cycle,valid:r.valid})),whales:a.tails?.records.filter(r=>r.mesh.name==='swamp-beluga-continuous-body').map(r=>({position:r.whale.position.toArray(),heading:r.whale.rotation.y})),repair:!!a.repair}:null;})(),variant,view:current,round:inner.userData.swampV2Round,time:+t.toFixed(2),flowerBoatPaddles:inner.userData.flowerBoyActivities?.navigation?.records?.slice(0,5).map(r=>({name:r.boat.name,count:r.boat.userData.paddles?.length,strokes:r.boat.userData.paddles?.map(p=>({phase:p.userData.stroke,grip:p.userData.gripLocal,blade:p.userData.bladeLocal,scale:p.scale.toArray(),visible:p.visible})),holders:r.boat.userData.paddles?.map(p=>p.userData.holder?.userData.flowerBoy?.state)})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,shaderErrors:faults,bankHeights:levels.map(x=>x.innerY),visuals:inner.userData.gregLakeVisuals?.version,waterShore:inner.userData.swampWaterShore?.version??null,coralRim:inner.userData.gregCoralRim?.version??null,dock:inner.userData.gregShoreDock?.version??null,algae:inner.userData.rootedAlgae?{version:inner.userData.rootedAlgae.version,drawCalls:inner.userData.rootedAlgae.drawCalls,blades:inner.userData.rootedAlgae.blades.length}:null,canopy:inner.userData.gregCoralCanopy?.shapeRevision??null,naturalCliff:inner.userData.gregNaturalCliff?.version??null,understory:inner.userData.gregUnderstory?{counts:inner.userData.gregUnderstory.counts,drawCalls:inner.userData.gregUnderstory.drawCalls,triangles:inner.userData.gregUnderstory.triangles}:null,trunkDetail:inner.userData.gregTrunkDetail?{version:inner.userData.gregTrunkDetail.version,changedTrunks:inner.userData.gregTrunkDetail.changedTrunks,renderBatches:inner.userData.gregTrunkBatch?.renderMeshes}:null,tigerMode:inner.userData.tiger?.userData._mode,tigerSurface:{kind:inner.userData.tiger?.userData.tigerTargetSupport?.supportKind,grounded:inner.userData.tiger?.userData.tigerTargetSupport?.grounded,waterReturning:!!inner.userData.tiger?.userData._waterReturning},tigerSupport:inner.userData.tiger?.userData.tigerTargetSupport?.feet?.map(f=>({height:f.height,y:f.foot[1]}))});}
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden)return;
 const moving=document.querySelector('#motion').checked;
 if(moving){animateHumanCourier(courierState,courier,dt,courierState.velocity.length()>0);t+=dt;root.userData.update?.(dt,t,runtime);if(actorViews[current]){refreshActorViews();view(current);}}
 // Refresh static views after texture completion or browser backing-buffer changes.
 if(moving||now-lastInfo>500){lastInfo=now;draw();}}
 requestAnimationFrame(frame);
}catch(e){status.textContent=e.stack;throw e;}
