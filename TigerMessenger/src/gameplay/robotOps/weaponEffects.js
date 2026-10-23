import * as THREE from 'three';
import {aimLocustRifle} from '../../assets/robotArticulation.js';
import {sfxRobotShot,sfxRobotImpact} from '../../audio/worldSfx.js';
import {puffTexture} from '../../world/citadel/ridgeFlowClouds.js';
// Shared by the proving ground and live fleet defense. Effects never apply damage.
export const WEAPON_VISUALS=Object.freeze({
 sentry:{shots:2,gap:.16,flash:.18,travel:.14},
 locust:{shots:3,gap:.11,flash:.36,travel:.17},
 ant:{shots:1,gap:0,flash:.65,travel:.42},
 beetle:{shots:5,gap:.055,flash:.16,travel:.14}
});
export function createWeaponEffects(root){
 const active=[],pending=[],sphere=new THREE.SphereGeometry(1,8,6),cylinder=new THREE.CylinderGeometry(1,1,1,8),cone=new THREE.ConeGeometry(1,1,8),ring=new THREE.TorusGeometry(1,.04,6,32),white=new THREE.Color(0xffedba);let serial=0;
 const stats={locust:0,ant:0,beetle:0,sentry:0};
 // All smoke has identical texels. This controller owns one lazy map; individual
 // expiring SpriteMaterials must not dispose a map still used by other puffs.
 let steamMap=null;
 const getSteamMap=()=>steamMap||(steamMap=puffTexture());
 const acousticCache=new WeakMap(),acousticRay=new THREE.Raycaster();let acousticBase=null,acousticLookAt=-Infinity;
 // perf 2026-10-14: every effect goes into one container so the scene's root child count stays
 // stable (per-frame caches elsewhere key on it); the container is recreated if detached.
 let fxHost=null;
 const host=()=>{if(!fxHost||!fxHost.parent){fxHost=new THREE.Group();fxHost.name='robot-weapon-effects';fxHost.userData.noDistanceCulling=true;root.add(fxHost);}return fxHost;};
 function acoustics(model,from,up){
  const old=acousticCache.get(model),now=performance.now();if(old&&now-old.at<700)return old.value;
  if(!acousticBase&&now-acousticLookAt>2000){acousticLookAt=now;root.traverse(o=>{if(o.userData.cameraOccludersNear)acousticBase=o;});}
  const walls=acousticBase?.userData.cameraOccludersNear(from,24)||[];
  const right=new THREE.Vector3(1,0,0);if(Math.abs(right.dot(up))>.9)right.set(0,0,1);right.addScaledVector(up,-right.dot(up)).normalize();
  const forward=new THREE.Vector3().crossVectors(up,right),distances=[];
  for(const dir of[right,right.clone().negate(),forward,forward.clone().negate(),up]){
   acousticRay.set(from,dir);acousticRay.near=.15;acousticRay.far=24;const h=acousticRay.intersectObjects(walls,false)[0];if(h)distances.push(h.distance);
  }
  const value={enclosure:distances.length/5,reflectionDistance:distances.length?distances.reduce((a,b)=>a+b,0)/distances.length:24};
  acousticCache.set(model,{at:now,value});return value;
 }

 function add(mesh,life,step){mesh.name=mesh.name||'robot-weapon-effect';mesh.userData.noDistanceCulling=true;host().add(mesh);active.push({mesh,life,total:life,step});return mesh;}
 function solid(geometry,color,position,scale,life,step){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));mesh.position.copy(position);mesh.scale.copy(scale);return add(mesh,life,step);}
 function steam(p,up,size,life,drift){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:getSteamMap(),color:0xe7e1d3,transparent:true,opacity:.55,depthWrite:false}));m.name='weapon-pressure-steam';m.position.copy(p);m.scale.setScalar(size);add(m,life,(o,t,dt)=>{o.position.addScaledVector(up,dt*.6).addScaledVector(drift,dt*.65);o.scale.setScalar(size*(.6+t*1.7));o.material.opacity=.55*(1-t);});}
 // Cinematic fire layer (2026-10-12): film-style gatling read. Every round is a
 // glowing tracer with a hot head and fading trail, the muzzle blooms a star
 // flash with a little smoke, and hits throw sparks, a flash and dust. All
 // additive and short-lived; textures are lazy and shared per controller.
 let fxMaps=null;
 const canvasTex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
 const maps=()=>fxMaps||(fxMaps={
  glow:canvasTex(64,64,(x,w)=>{const g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,250,225,1)');g.addColorStop(.25,'rgba(255,205,120,.85)');g.addColorStop(.6,'rgba(255,140,50,.25)');g.addColorStop(1,'rgba(255,110,30,0)');x.fillStyle=g;x.fillRect(0,0,w,w);}),
  star:canvasTex(128,128,(x,w)=>{const c=w/2;const g=x.createRadialGradient(c,c,0,c,c,c*.55);g.addColorStop(0,'rgba(255,255,240,1)');g.addColorStop(.4,'rgba(255,214,120,.9)');g.addColorStop(1,'rgba(255,150,40,0)');x.fillStyle=g;x.fillRect(0,0,w,w);
   x.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=i*Math.PI/3+.3,l=i%2?c*.62:c*.98;x.save?.();const sg=x.createRadialGradient(c,c,0,c,c,l);sg.addColorStop(0,'rgba(255,240,190,.95)');sg.addColorStop(1,'rgba(255,160,60,0)');x.fillStyle=sg;x.beginPath?.();x.moveTo?.(c,c);x.lineTo?.(c+Math.cos(a-.09)*l*.3,c+Math.sin(a-.09)*l*.3);x.lineTo?.(c+Math.cos(a)*l,c+Math.sin(a)*l);x.lineTo?.(c+Math.cos(a+.09)*l*.3,c+Math.sin(a+.09)*l*.3);x.closePath?.();x.fill?.();x.restore?.();}}),
  dust:null});
 function glowSprite(map,color,position,size,life,step,name,solidLook=false){const m=new THREE.Sprite(new THREE.SpriteMaterial({map,color,transparent:true,depthWrite:false,blending:solidLook?THREE.NormalBlending:THREE.AdditiveBlending,toneMapped:false}));m.name=name;m.position.copy(position);m.scale.setScalar(size);m.material.rotation=Math.random()*Math.PI*2;return add(m,life,step);}
 function additive(geometry,color,position,scale,life,step,name){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));mesh.position.copy(position);mesh.scale.copy(scale);mesh.name=name;return add(mesh,life,step);}
 function dust(p,up,size,life,color=0x7a6e5e){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:getSteamMap(),color,transparent:true,opacity:.75,depthWrite:false}));m.name='weapon-impact-dust';m.position.copy(p);m.scale.setScalar(size*.5);add(m,life,(o,t,dt)=>{o.position.addScaledVector(up,dt*.9);o.scale.setScalar(size*(.5+t*1.4));o.material.opacity=.75*(1-t)*(1-t);});}
 const FIRE={sentry:{flash:.9,tracer:[.07,2.4],trail:.16,sparks:5,speed:.14},locust:{flash:1.5,tracer:[.11,3.6],trail:.24,sparks:8,speed:.17},beetle:{flash:1.2,tracer:[.08,2.8],trail:.18,sparks:6,speed:.14},ant:{flash:2.6,tracer:null,trail:0,sparks:16,speed:.42}};
 function fireLayer(kind,from,to,direction,up,right){const f=FIRE[kind],m=maps();
  // muzzle bloom: star flash + hot core + side jets, flickering for a frame or two
  glowSprite(m.star,0xffffff,from.clone().addScaledVector(direction,f.flash*.25),f.flash,kind==='ant'?.14:.075,(o,t)=>{o.material.opacity=(1-t)*(t<.5?1:.6);o.scale.setScalar(f.flash*(1+t*.4));},kind+'-muzzle-bloom',true);
  glowSprite(m.glow,0xffe2a8,from,f.flash*.75,kind==='ant'?.22:.11,(o,t)=>{o.material.opacity=1-t;},kind+'-muzzle-glow');
  for(const s of[-1,1])glowSprite(m.glow,0xffb35a,from.clone().addScaledVector(right,s*f.flash*.22).addScaledVector(direction,f.flash*.12),f.flash*.35,.06,(o,t)=>{o.material.opacity=1-t;},kind+'-muzzle-jet');
  if(kind!=='ant'&&Math.random()<.6)dust(from.clone().addScaledVector(direction,.25),up,.35,.55,0xd8d2c4);
  if(f.tracer){const dist=from.distanceTo(to),[w,len]=f.tracer,L=Math.min(len,dist*.6);
   const core=solid(cylinder,kind==='locust'?0xffe27a:0xffc23a,from,new THREE.Vector3(w,L,w),f.speed,(o,t)=>{o.position.lerpVectors(from,to,t).addScaledVector(direction,-L*.5);});core.name=kind+'-tracer-core';core.material.toneMapped=false;
   core.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
   const trail=additive(cylinder,0xff6a14,from,new THREE.Vector3(f.trail,L*1.6,f.trail),f.speed+.05,(o,t)=>{o.position.lerpVectors(from,to,Math.min(1,t*1.05)).addScaledVector(direction,-L*.9);o.material.opacity=.55*(1-t*.7);},kind+'-tracer-trail');
   trail.quaternion.copy(core.quaternion);
   glowSprite(m.glow,0xffe6b0,from,.55,f.speed,(o,t)=>{o.position.lerpVectors(from,to,t);},kind+'-tracer-head');}
 }
 function impactLayer(p,up,kind){const f=FIRE[kind]||FIRE.sentry,m=maps(),heavy=kind==='ant';
  glowSprite(m.star,0xffffff,p,heavy?3.6:.95,heavy?.18:.08,(o,t)=>{o.material.opacity=1-t;o.scale.setScalar((heavy?3.6:.95)*(1+t));},kind+'-impact-flash',true);
  for(let i=0;i<f.sparks;i++){const v=new THREE.Vector3(Math.random()-.5,Math.random()*.9+.2,Math.random()-.5).normalize().multiplyScalar((heavy?7:4)*(.5+Math.random()));v.addScaledVector(up,1.5);
   glowSprite(m.glow,0xffc56a,p,heavy?.32:.18,.25+Math.random()*.25,(o,t,dt)=>{o.position.addScaledVector(v,dt);v.addScaledVector(up,-9.8*dt);o.material.opacity=1-t;},kind+'-impact-spark');}
  dust(p,up,heavy?3.2:.9,heavy?1.3:.8);
  if(heavy){glowSprite(m.glow,0xff7a2a,p.clone().addScaledVector(up,.6),4.2,.45,(o,t)=>{o.material.opacity=(1-t)*.9;o.scale.setScalar(4.2*(1+t*.6));o.position.addScaledVector(up,.02);},'ant-fireball');
   for(let i=0;i<3;i++)dust(p.clone().addScaledVector(up,.5+i*.8),up,2.4+i,1.1+i*.15,0x5a524a);}
 }
 function impact(p,up,kind){sfxRobotImpact(kind,p);impactLayer(p,up,kind);const heavy=kind==='ant',count=heavy?11:kind==='locust'?5:2;for(let i=0;i<count;i++){const v=new THREE.Vector3(Math.sin(i*2.4),.4+Math.cos(i)*.2,Math.cos(i*2.4)).multiplyScalar(heavy?2:1);v.add(up);solid(sphere,heavy?0xffa451:0xffcc75,p,new THREE.Vector3().setScalar(heavy?.09:.035),heavy?.45:.20,(o,t,dt)=>{o.position.addScaledVector(v,dt);o.material.opacity=1-t;});}
  if(heavy){const pulse=solid(ring,0xf8d1a0,p,new THREE.Vector3().setScalar(.2),.4,(o,t)=>{o.scale.setScalar(.2+t*1.6);o.material.opacity=(1-t)*.65;});pulse.name='ant-pressure-impact';pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),up);steam(p,up,1.5,.95,new THREE.Vector3());}
 }
 function shot(model,target,index=0,onImpact=null){if(!model?.parent||!model.visible)return;const kind=model.userData.robotType;if(!WEAPON_VISUALS[kind])return;stats[kind]++;if(kind==='locust')aimLocustRifle(model,target);model.updateWorldMatrix(true,true);
  const muzzle=model.getObjectByName(kind==='beetle'&&index%2?'robot-muzzle-left':'robot-muzzle');
  const from=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):model.localToWorld(new THREE.Vector3(0,1.8,1.4)),to=target.clone(),up=new THREE.Vector3(0,1,0).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion())),direction=to.clone().sub(from).normalize(),right=new THREE.Vector3().crossVectors(up,direction).normalize();
  sfxRobotShot(kind,from,to,acoustics(model,from,up));
  model.userData.weaponPulse={at:performance.now()/1000,kind,index};
  const spec=WEAPON_VISUALS[kind],flash=solid(cone,white,from.clone().addScaledVector(direction,spec.flash*.5),new THREE.Vector3(spec.flash*.23,spec.flash,spec.flash*.23),kind==='ant'?.12:.065,(o,t)=>{o.material.opacity=1-t;});flash.name=kind+'-muzzle-flash';flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().negate());
  fireLayer(kind,from,to,direction,up,right);
  if(kind==='ant'){
   for(let i=0;i<5;i++)steam(from.clone().addScaledVector(direction,i*.12),up,.5+i*.13,.65+i*.07,direction);
   const shell=solid(sphere,0xffb660,from,new THREE.Vector3(.11,.11,.19),spec.travel,(o,t)=>{o.position.lerpVectors(from,to,t).addScaledVector(up,Math.sin(t*Math.PI)*.45);});shell.name='ant-pressure-shell';{const m=maps();glowSprite(m.glow,0xffb060,from,.9,spec.travel,(o,t)=>{o.position.lerpVectors(from,to,t).addScaledVector(up,Math.sin(t*Math.PI)*.45);},'ant-shell-glow');}shell.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);active[active.length-1].onEnd=()=>{if(onImpact)onImpact(to);else impact(to,up,kind);};
  }else{
   const length=kind==='locust'?1.15:.55,width=kind==='locust'?.027:.012;
   const tracer=solid(cylinder,kind==='locust'?0xffd792:0xff973c,from,new THREE.Vector3(width,length,width),spec.travel,(o,t)=>{o.position.lerpVectors(from,to,t);});tracer.name=kind+'-moving-tracer';tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);active[active.length-1].onEnd=()=>{if(onImpact)onImpact(to);else impact(to,up,kind);};
   if(kind==='locust'){const velocity=right.clone().multiplyScalar(2.2).addScaledVector(up,1.5),shell=solid(cylinder,0xb58c48,from.clone().addScaledVector(direction,-.65),new THREE.Vector3(.035,.14,.035),.8,(o,t,dt)=>{o.position.addScaledVector(velocity,dt);o.position.addScaledVector(up,-3*t*dt);o.rotateX(dt*8);o.rotateZ(dt*5);});shell.name='locust-ejected-case';}
  }
 }
 return{shot,burst(model,target,count=WEAPON_VISUALS[model.userData.robotType]?.shots||1,onImpact=null){const kind=model.userData.robotType,spec=WEAPON_VISUALS[kind];if(!spec)return;const id=++serial;shot(model,target,0,onImpact);for(let i=1;i<count;i++)pending.push({model,target:target.clone(),index:i,wait:i*spec.gap,id,onImpact});},update(dt){
  for(let i=pending.length-1;i>=0;i--){const p=pending[i];p.wait-=dt;if(p.wait<=0){if(!p.model.userData.dead)shot(p.model,p.target,p.index,p.onImpact);pending.splice(i,1);}}
  // Iterate over a snapshot: impact callbacks may append fresh effects.
  for(const p of [...active]){p.life-=dt;if(p.life<=0){p.mesh.removeFromParent();p.mesh.material.dispose();active.splice(active.indexOf(p),1);p.onEnd?.();}else{const t=1-p.life/p.total;p.step?.(p.mesh,t,dt);}}
 },clear(){pending.length=0;for(const p of active){p.mesh.removeFromParent();p.mesh.material.dispose();}active.length=0;},dispose(){this.clear();for(const g of[sphere,cylinder,cone,ring])g.dispose();steamMap?.dispose();steamMap=null;if(fxMaps){fxMaps.glow.dispose();fxMaps.star.dispose();fxMaps=null;}},get count(){return active.length;},get pendingCount(){return pending.length;},stats};
}
