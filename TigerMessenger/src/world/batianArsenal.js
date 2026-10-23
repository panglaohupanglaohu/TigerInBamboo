import {puffTexture} from './citadel/ridgeFlowClouds.js';
import * as THREE from 'three';
import {predictBatianBomb} from './batianBombTrajectory.js';

// Combat presentation and consequences share the same scheduled impact. No buildings are damaged.
export const BATIAN_WEAPONS=['cannon','rain','ion','traction'];
export function shieldSegmentHit(from,to,craft,axes=new THREE.Vector3(40,10,40)){
 craft.updateWorldMatrix(true,false);
 const inverse=craft.matrixWorld.clone().invert(),a=from.clone().applyMatrix4(inverse).divide(axes),b=to.clone().applyMatrix4(inverse).divide(axes),v=b.sub(a);
 const A=v.lengthSq(),B=2*a.dot(v),C=a.lengthSq()-1,disc=B*B-4*A*C;if(A<1e-10||disc<0)return null;
 const roots=[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)],u=roots.find(x=>x>=0&&x<=1);return u===undefined?null:from.clone().lerp(to,u);
}
export function createBatianArsenal({scene,aircraft,radius=160,audio={},onImpact=()=>{},groundRadiusAt=null}){
 const root=new THREE.Group();root.name='batian-arsenal-live';root.userData.noDistanceCulling=true;scene.add(root);
 const active=[],jobs=[],destroyed=new Set(),stats={cannon:0,rain:0,ion:0,traction:0,robotHits:0,robotsShattered:0,shieldImpacts:0,shieldAudioPlayed:0,shieldAudioSkipped:0},factoryTimers=new Map(),disrupted=new Map();let lastImpact=null,smokeMap=null;
 const colors={cannon:0x75ffe0,rain:0xff8557,ion:0xa592ff,traction:0x6aebc6};
 function mesh(g,color,opacity=.85){const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,fog:false,toneMapped:false}));m.userData.noDistanceCulling=true;return m;}
 function add(m,life,step){root.add(m);active.push({m,life,total:life,step,opacity:m.material.opacity});return m;}
 function disc(p,size,color,life=2,expand=0){const m=mesh(new THREE.RingGeometry(size*.86,size,48),color);m.position.copy(p);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),p.clone().normalize());return add(m,life,(o,u)=>o.scale.setScalar(1+u*expand));}
 function beam(a,b,width,color,life=.8){const delta=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(width,width,delta.length(),10),color);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return add(m,life);}
 function steamMap(){if(smokeMap)return smokeMap;if(typeof document!=='undefined')return smokeMap=puffTexture();const data=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4,a=Math.max(0,1-Math.hypot(x-7.5,y-7.5)/8);data.set([255,255,255,Math.round(a*a*180)],i);}smokeMap=new THREE.DataTexture(data,16,16);smokeMap.needsUpdate=true;return smokeMap;}
 function cloud(p,color,count=8,fire=false){
  if(active.length>450)return;
  const up=p.clone().normalize(),e=new THREE.Vector3(0,1,0).cross(up).normalize();if(e.lengthSq()<.1)e.set(1,0,0);const n=up.clone().cross(e);
  for(let i=0;i<count;i++){
   const a=i*2.399,v=e.clone().multiplyScalar(Math.cos(a)*1.6).addScaledVector(n,Math.sin(a)*1.6).addScaledVector(up,2+i*.2),mat=new THREE.SpriteMaterial({map:steamMap(),color,transparent:true,opacity:.6,depthWrite:false,fog:false,toneMapped:false});mat.rotation=a;
   const puff=new THREE.Sprite(mat);puff.name='batian-soft-steam-smoke';puff.userData.noDistanceCulling=true;puff.position.copy(p).addScaledVector(e,Math.cos(a)*2).addScaledVector(n,Math.sin(a)*2).addScaledVector(up,.8+i*.3);const size=3.2+(i%4)*.65;puff.scale.setScalar(size);
   add(puff,8,(o,u,dt)=>{o.position.addScaledVector(v,dt);o.scale.setScalar(size*(1+u*2.8));});
  }
  if(fire)for(let i=0;i<3;i++){
   const mat=new THREE.SpriteMaterial({map:steamMap(),color:i===0?0xffe4a1:0xff761e,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false}),flame=new THREE.Sprite(mat);flame.name='batian-explosion-fire';flame.userData.noDistanceCulling=true;flame.position.copy(p).addScaledVector(up,1.2+i*.9).addScaledVector(e,(i-1)*1.7);const size=5+i*1.4;flame.scale.setScalar(size);add(flame,1.7,(o,u,dt)=>{o.position.addScaledVector(up,dt*2);o.scale.setScalar(size*(1+u*1.7));});
  }
 }
 function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
 function robots(){const result=[];scene.traverse(o=>{if(o.userData.robotType&&o.getObjectByName('robot-muzzle')&&!o.userData.dead&&visible(o))result.push(o);});return result;}
 function warn(point,type,delay){const m=disc(point,7,colors[type],delay);m.name='batian-'+type+'-telegraph';const inner=disc(point,3,colors[type],delay);inner.name='batian-impact-warning';}
 function shatter(robot){if(destroyed.has(robot))return;robot.updateWorldMatrix(true,true);const centre=robot.getWorldPosition(new THREE.Vector3()),up=centre.clone().normalize();const pieces=[];robot.traverse(o=>{if(o.isMesh&&o.geometry&&!o.userData.isOutline&&pieces.length<14)pieces.push(o);});
  for(const [i,part]of pieces.entries()){const g=part.geometry.clone(),original=Array.isArray(part.material)?part.material[0]:part.material,m=new THREE.Mesh(g,original.clone());m.material.transparent=true;m.material.fog=false;m.userData.noDistanceCulling=true;part.matrixWorld.decompose(m.position,m.quaternion,m.scale);const v=m.position.clone().sub(centre);if(v.lengthSq()<.01)v.set(Math.cos(i*2.4),0,Math.sin(i*2.4));v.normalize().multiplyScalar(4+i%4).addScaledVector(up,4+i%3);add(m,12,(o,u,dt)=>{v.addScaledVector(up,-8*dt);o.position.addScaledVector(v,dt);const floor=centre.length()-.5;if(o.position.length()<floor){o.position.normalize().multiplyScalar(floor);v.multiplyScalar(.25);}o.rotateX(dt*(i%3+1));});}
  cloud(centre,0x333b43,6,true);destroyed.add(robot);robot.userData.dead=true;robot.userData.batianShattered=true;robot.visible=false;stats.robotsShattered++;
 }
 function affect(p,type){const range=type==='traction'?25:type==='cannon'?20:type==='ion'?30:13;for(const robot of robots()){const at=robot.getWorldPosition(new THREE.Vector3());if(at.distanceTo(p)>range)continue;stats.robotHits++;if(type!=='traction')robot.userData.batianSuppressionSeconds=type==='ion'?9:2;
   if(type==='ion'){robot.userData.batianIonUntil=9;disruptLights(robot);continue;}if(type==='traction'){robot.userData.batianSlowedSeconds=6;continue;}
   const damage=type==='cannon'?130:110;robot.userData.batianCombatHealth=(robot.userData.batianCombatHealth??100)-damage;if(robot.userData.batianCombatHealth<=0)shatter(robot);
  }
  if(type==='ion')scene.traverse(o=>{if(!o.name.endsWith('-factory-compound'))return;const c=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());if(c.distanceTo(p)>65)return;o.userData.batianShutdownSeconds=9;factoryTimers.set(o,9);ventSteam(o);});
 }
 function groundImpact(p,type){onImpact(p,type);lastImpact={point:p.toArray(),type,age:0};if(type==='rain'||type==='cannon')audio.explosion?.(p,type);const up=p.clone().normalize();if(type==='cannon'){disc(p,3,colors.cannon,3,10);cloud(p,0x373b42,12,true);for(let i=0;i<10;i++){const m=mesh(new THREE.DodecahedronGeometry(.3+i%3*.15),0x8d8575),v=new THREE.Vector3(Math.cos(i*2.4),Math.sin(i*2.4),.3).normalize().multiplyScalar(4).addScaledVector(up,5);m.position.copy(p);add(m,2,(o,u,dt)=>{o.position.addScaledVector(v,dt);v.addScaledVector(up,-10*dt);});}}
  else if(type==='rain'){disc(p,3,0xffc189,3,6);cloud(p,0x292e36,10,true);const flash=mesh(new THREE.SphereGeometry(3.5,12,8),0xffe5af);flash.position.copy(p).addScaledVector(up,2);flash.name='batian-bomb-detonation';add(flash,1.4,(o,u)=>o.scale.setScalar(1+u*2.6));scene.userData.batianBlast={position:p.clone(),strength:1,age:0};}
  else if(type==='ion'){disc(p,9,colors.ion,4,1);cloud(p,0xdce7dd,3);}affect(p,type);
 }
 function muzzle(source,x=0){source.updateWorldMatrix(true,false);const mounts=source===aircraft?source.userData.batianWeaponMounts:null;const mount=mounts?(Math.abs(x)>10?mounts.ion[x<0?0:1]:mounts.cannon):null;return source.localToWorld(mount?mount.clone().add(new THREE.Vector3(Math.abs(x)>10?0:x,0,0)):new THREE.Vector3(x,source===aircraft?(Math.abs(x)>10?-3.8:-4.6):-2.8,0));}
 function predictRain(point,source=aircraft,offset=0){return predictBatianBomb(muzzle(source,offset),source.userData.batianFlightVelocity?.clone()||new THREE.Vector3(),groundRadiusAt,point.length());}
 function fire(type,point,source=aircraft){stats[type]++;const p=point.clone(),from=muzzle(source);
  if(type==='cannon'){
   const vector=p.clone().sub(from).normalize(),duration=1.1;
   for(const [width,length,color,opacity]of [[3.5,12,colors.cannon,.7],[1.6,9,0xe4fff6,.95]]){const pulse=mesh(new THREE.CylinderGeometry(width,width,length,12),color,opacity);pulse.name='batian-short-crystal-pulse';pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector);pulse.position.copy(from);add(pulse,duration,(o,u)=>o.position.lerpVectors(from,p,u));}
   jobs.push({wait:duration,run:()=>groundImpact(p,type)});
  }
  else if(type==='rain'){
   const count=source===aircraft?10:3;
   for(let i=0;i<count;i++)jobs.push({release:true,wait:i*.6,run:()=>{
    const origin=muzzle(source,source===aircraft?(i%2?2.2:-2.2):0),plan=predictRain(p,source,source===aircraft?(i%2?2.2:-2.2):0);if(!plan)return;
    const {up,duration}=plan,end=plan.point;
    audio.release?.(origin);warn(end,'rain',duration);
    const m=mesh(new THREE.CapsuleGeometry(.75,2.8,6,12),0x343c49,1);m.material.transparent=false;m.material.depthWrite=true;m.position.copy(origin);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);m.name='batian-falling-capsule-bomb';
    m.userData.releaseOrigin=origin.toArray();m.userData.impactPoint=end.toArray();m.userData.fallDuration=duration;
    m.userData.initialVelocity=plan.velocity.toArray();
    const fallingSound=audio.fall?.(origin,duration);let soundStopped=false;m.userData.stopAudio=()=>{if(soundStopped)return;soundStopped=true;fallingSound?.stop?.();};
    add(m,duration,(o,u)=>{const time=u*duration;o.position.copy(plan.at(time));fallingSound?.update?.(o.position);const velocity=plan.velocity.clone().addScaledVector(up,-plan.gravity*time);if(velocity.lengthSq()>.01)o.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),velocity.normalize());});
    jobs.push({wait:duration,run:()=>{m.userData.stopAudio();groundImpact(end,'rain');}});
   }});
  }
  else if(type==='ion'){
   const up=p.clone().normalize(),e=new THREE.Vector3(0,1,0).cross(up).normalize();
   for(const x of[-18,18]){const start=muzzle(source,source===aircraft?x:0),laser=beam(start,p,.4,colors.ion,5);laser.name='batian-ion-sweeping-beam';const fx=active.find(f=>f.m===laser);fx.step=(o,u)=>{const from=muzzle(source,source===aircraft?x:0),to=p.clone().addScaledVector(e,Math.sin(u*Math.PI*2)*7),v=to.clone().sub(from);o.position.copy(from).add(to).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());o.scale.y=v.length()/start.distanceTo(p);};}
   groundImpact(p,type);
  }
  else {const up=p.clone().normalize(),m=mesh(new THREE.CylinderGeometry(3,19,1,32,1,true),colors.traction,.16);
   // The narrow top stays at the moving belly muzzle; the broad bottom stays
   // at the actual ground effect. Radial-up orientation detached both ends.
   const axis=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
   const followSource=o=>{const start=muzzle(source);delta.copy(start).sub(p);const length=delta.length();o.visible=length>1e-6;if(!o.visible)return;o.position.copy(start).add(p).multiplyScalar(.5);o.quaternion.setFromUnitVectors(axis,delta.multiplyScalar(1/length));o.scale.y=length;};
   m.name='batian-traction-light-field';m.onBeforeRender=()=>{followSource(m);m.updateWorldMatrix(true,false);};followSource(m);add(m,5,followSource);for(let i=0;i<5;i++){const ring=disc(p.clone().addScaledVector(up,.3+i*.2),6+i*2,colors.traction,5);ring.name='batian-traction-vortex';addVortexParticles(p,up,i);}affect(p,type);onImpact(p,type);}
 }
 function disruptLights(robot){
  if(disrupted.has(robot)){disrupted.get(robot).left=9;return;}
  const parts=[];robot.traverse(o=>{if(!o.isMesh||parts.length>=8||!o.material?.emissive)return;const original=o.material,copy=original.clone();o.material=copy;parts.push({o,original,copy});});disrupted.set(robot,{left:9,parts});
 }
 function ventSteam(factory){
  const emitters=[];factory.traverse(o=>{if(o.name.endsWith('-steam-emitter')&&emitters.length<2)emitters.push(o);});
  for(const emitter of emitters){const p=emitter.getWorldPosition(new THREE.Vector3()),up=p.clone().normalize(),side=new THREE.Vector3(1,0,0).applyQuaternion(factory.getWorldQuaternion(new THREE.Quaternion()));side.addScaledVector(up,-side.dot(up)).normalize();
   const jet=mesh(new THREE.ConeGeometry(1.8,12,12,1,true),0xe8f0e6,.45);jet.name='batian-ion-valve-steam-jet';jet.position.copy(p).addScaledVector(side,6);jet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),side);add(jet,7,(o,u)=>{o.scale.set(1+Math.sin(u*40)*.2,1,1);});
   for(let i=0;i<7;i++){const puff=mesh(new THREE.IcosahedronGeometry(.7),0xe2eee3,.5);puff.position.copy(p).addScaledVector(side,i*1.2);puff.name='batian-ion-escaping-steam';add(puff,7,(o,u,dt)=>{o.position.addScaledVector(side,dt*1.8).addScaledVector(up,dt*.5);o.scale.setScalar(1+u*2);});}
  }
 }
 function addVortexParticles(p,up,layer){const e=new THREE.Vector3(0,1,0).cross(up).normalize(),n=up.clone().cross(e);for(let j=0;j<4;j++){const a=j*Math.PI/2,small=mesh(new THREE.IcosahedronGeometry(.35),layer%2?0xb1cfcb:0x978973,.65);small.position.copy(p);add(small,5,(o,u)=>{const angle=a+u*10,r=5+layer*2;o.position.copy(p).addScaledVector(e,Math.cos(angle)*r).addScaledVector(n,Math.sin(angle)*r).addScaledVector(up,u*10);});}}
 function charge(point,type,delay,source=aircraft){if(type==='rain')return;if(type==='cannon')audio.charge?.(muzzle(source));warn(point,type,delay);for(const x of type==='ion'&&source===aircraft?[-18,18]:[0]){const m=mesh(new THREE.OctahedronGeometry(1,1),colors[type],.8);m.name='batian-'+type+'-charge';m.position.copy(muzzle(source,x));add(m,delay,(o,u)=>{o.position.copy(muzzle(source,x));o.scale.setScalar(.7+u*(type==='cannon'?4:2));});}}
 function shieldImpact(point,craft,impactPower=20){
  stats.shieldImpacts++;craft.updateWorldMatrix(true,false);
  const axes=craft===aircraft?new THREE.Vector3(40,10,40):new THREE.Vector3(6,6,6),local=craft.worldToLocal(point.clone());
  const q=local.clone().divide(axes).length();if(q<1e-8)return;local.multiplyScalar(1/q);
  if(craft===aircraft){const played=audio.shieldHit?.(craft.localToWorld(local.clone()),impactPower);if(played===true)stats.shieldAudioPlayed++;else if(played===false)stats.shieldAudioSkipped++;}
  const axesSquared=axes.clone().multiply(axes),normal=local.clone().divide(axesSquared).normalize(),e=new THREE.Vector3(0,1,0).cross(normal).normalize();if(e.lengthSq()<.1)e.set(1,0,0);const n=normal.clone().cross(e).normalize();
  for(let wave=0;wave<3;wave++){
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(128*3),3));const indices=[];for(let i=0;i<64;i++){const j=(i+1)%64;indices.push(i*2,j*2,i*2+1,j*2,j*2+1,i*2+1);}geometry.setIndex(indices);
   const circle=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:wave===0?0xe4ffff:0x65dedf,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide,fog:false,toneMapped:false}));circle.name='batian-raindrop-shield-ripple';circle.userData.noDistanceCulling=true;circle.frustumCulled=false;
   // Reuse per-ring scratch vectors; hit bursts must not allocate per vertex/frame.
   const v=new THREE.Vector3(),unitV=new THREE.Vector3(),outward=new THREE.Vector3();
   const updateRing=(o,u)=>{const t=THREE.MathUtils.clamp((u*1.5-wave*.12)/1.1,0,1),r=.4+t*(craft===aircraft?6:2.5),attr=geometry.attributes.position;craft.updateWorldMatrix(true,false);for(let i=0;i<128;i++){const a=Math.floor(i/2)/64*Math.PI*2,rr=r+(i%2?.14:-.14),k=unitV.copy(v.copy(local).addScaledVector(e,Math.cos(a)*rr).addScaledVector(n,Math.sin(a)*rr)).divide(axes).length();v.multiplyScalar(1/k);outward.copy(v).divide(axesSquared).normalize();v.addScaledVector(outward,.09).applyMatrix4(craft.matrixWorld);attr.setXYZ(i,v.x,v.y,v.z);}attr.needsUpdate=true;o.visible=t>0&&t<1;};
   updateRing(circle,.01);add(circle,1.5,updateRing);
  }
 }
 function update(dt){if(lastImpact)lastImpact.age+=dt;for(const [robot,r]of disrupted){r.left-=dt;robot.userData.batianIonUntil=Math.max(0,r.left);for(const part of r.parts){part.copy.emissive.setHex(0x7050bd);part.copy.emissiveIntensity=Math.sin(r.left*23)>0?1.4:.03;}if(r.left<=0){for(const part of r.parts){part.o.material=part.original;part.copy.dispose();}disrupted.delete(robot);}}if(scene.userData.batianBlast)scene.userData.batianBlast.age+=dt;for(let i=jobs.length-1;i>=0;i--){jobs[i].wait-=dt;if(jobs[i].wait<=0){const job=jobs.splice(i,1)[0];job.run();}}for(let i=active.length-1;i>=0;i--){const f=active[i];f.life-=dt;if(f.life<=0){f.m.userData.stopAudio?.();f.m.removeFromParent();if(!f.m.isSprite)f.m.geometry.dispose();f.m.material.dispose();active.splice(i,1);continue;}const u=1-f.life/f.total;f.step?.(f.m,u,dt);if(f.m.material.transparent)f.m.material.opacity=f.opacity*(1-u*.8);}for(const robot of destroyed)robot.visible=false;for(const [factory,left]of factoryTimers){const next=Math.max(0,left-dt);factory.userData.batianShutdownSeconds=next;if(next===0)factoryTimers.delete(factory);else factoryTimers.set(factory,next);}}
 return{charge,fire,predictRain,shieldImpact,update,stats,beginSortie(){for(const key of Object.keys(stats))stats[key]=0;lastImpact=null;},cancelReleases(){for(let i=jobs.length-1;i>=0;i--)if(jobs[i].release)jobs.splice(i,1);},snapshot:()=>({...stats,lastImpact:lastImpact?{...lastImpact,point:[...lastImpact.point]}:null,smokeStyle:'soft-steam-sprite',activeSoftSmoke:active.filter(f=>f.m.name==='batian-soft-steam-smoke').length,activeSteamJets:active.filter(f=>f.m.name==='batian-ion-valve-steam-jet').length,factoriesStopped:factoryTimers.size,robotsBlinking:disrupted.size,activeIon:active.some(f=>f.m.name==='batian-ion-sweeping-beam'),activeEffects:active.length,pendingProjectiles:jobs.length}),dispose(){for(const r of disrupted.values())for(const part of r.parts){part.o.material=part.original;part.copy.dispose();}for(const f of active){f.m.userData.stopAudio?.();if(!f.m.isSprite)f.m.geometry.dispose();f.m.material.dispose();}smokeMap?.dispose();root.removeFromParent();}};
}
