import * as THREE from 'three';
import {getCityFrame} from './crystalCityLayout.js';
import {canyonOffsetDir} from './canyon.js';
import {officialOceanLevelAt} from './waterV8/officialOcean.js';
export const FLEET_PHASES=['idle','assemble','transit','blockade','pincer','cannon','guard','withdraw','return','dock'];
export function fleetRoles(count){
 const ideal=['scout','attack','attack','guard','support','guard','scout','attack','attack','guard','jammer','support','attack','attack','guard','jammer'];
 return Array.from({length:count},(_,i)=>ideal[i%ideal.length]);
}
const durations={assemble:12,transit:25,blockade:12,pincer:24,cannon:18,guard:24,withdraw:10,return:25,dock:12};
export function createBatianFleet({scene,flagship,squad,targets=[],radius=160,canControl=()=>true,auto=false}){
 const aircraft=flagship.aircraft,home=getCityFrame().center;
 // Existing objects only: no aircraft constructor, cloning or added fleet members.
 const members=[...new Set(squad?.userData?.members||[])].filter(m=>m?.isObject3D&&m.parent);
 const roles=fleetRoles(members.length),owner={active:false};
 const st={phase:'idle',age:0,energy:100,shield:false,wingNodes:2,heat:0,target:null,cycle:0,shots:0,retreatReason:null};
 const effects=new THREE.Group();effects.name='batian-combat-effects';scene.add(effects);
 const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0x829bcc,wireframe:true,transparent:true,opacity:.19,depthWrite:false}));shield.name='batian-faceted-shield';shield.scale.set(40,10,40);shield.visible=false;aircraft.add(shield);
 const core=new THREE.Mesh(new THREE.OctahedronGeometry(1),new THREE.MeshBasicMaterial({color:0x82d7c6,transparent:true,opacity:.7}));core.name='batian-weapon-crystal-core';core.position.y=-3.5;core.visible=false;aircraft.add(core);
 const petals=new THREE.Group();petals.name='batian-crystal-weapon-bay';petals.position.y=-3;aircraft.add(petals);
 for(let i=0;i<6;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(2,.25,5),new THREE.MeshStandardMaterial({color:0x55506c,roughness:.25}));p.rotation.y=i*Math.PI/3;p.position.set(Math.cos(i*Math.PI/3)*2.5,0,Math.sin(i*Math.PI/3)*2.5);petals.add(p);}
 const palette={scout:0x81b8b2,attack:0xe88370,guard:0x9a82bb,jammer:0x7d8bcd,support:0xc7b69b};
 const saved=members.map((m,i)=>({m,role:roles[i],p:m.position.clone(),q:m.quaternion.clone(),material:m.userData.cockpitCore?.material,roleMaterial:null}));
 for(const rec of saved){const dot=rec.m.userData.cockpitCore;if(dot?.material){rec.roleMaterial=dot.material.clone();rec.roleMaterial.color?.setHex(palette[rec.role]);dot.material=rec.roleMaterial;}}
 const fx=[],reactions=new Map();const up=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),desired=new THREE.Vector3(),pos=new THREE.Vector3(),basis=new THREE.Matrix4();
 const events=[];
 let routeFrom=home.clone(),routeTo=home.clone(),idleAge=0,lastTime=0,lastShot=-100,combatTime=0;
 const originalState=squad?.userData.state;
 function setPhase(phase){events.push({phase,time:lastTime,energy:+st.energy.toFixed(2),shots:st.shots});if(events.length>96)events.shift();st.phase=phase;st.age=0;routeFrom.copy(aircraft.position).normalize();if(phase==='transit')routeTo.copy(st.target.dir).normalize();if(phase==='return')routeTo.copy(home);}
 function start(id){if(st.phase!=='idle'||!members.length||!canControl())return false;const target=id?targets.find(t=>t.id===id):targets[0];if(!target?.dir)return false;st.target=target;st.energy=100;st.heat=0;st.wingNodes=2;st.retreatReason=null;st.shots=0;st.cycle++;combatTime=0;lastShot=-100;owner.active=true;squad.userData.batianFleetOwner=owner;saved.forEach(r=>r.m.userData.batianFleetRole=r.role);setPhase('assemble');return true;}
 function retreat(reason='command'){if(!owner.active||['withdraw','return','dock'].includes(st.phase))return false;st.retreatReason=reason;setPhase('withdraw');return true;}
 function hit(power=10,node=null){if(!owner.active||!Number.isFinite(power)||power<=0)return false;if(st.shield)st.energy=Math.max(0,st.energy-power*.65);else{if(node==='wing')st.wingNodes=Math.max(0,st.wingNodes-1);st.energy=Math.max(0,st.energy-power*.35);st.heat+=power*.4;}return true;}
 function surface(dir){return radius+Math.max(canyonOffsetDir(dir),officialOceanLevelAt(dir));}
 function placeFlagship(dt){
  if(['transit','return'].includes(st.phase)){const u=THREE.MathUtils.smoothstep(st.age/25,0,1),angle=routeFrom.angleTo(routeTo);up.copy(routeFrom).multiplyScalar(Math.sin((1-u)*angle)).addScaledVector(routeTo,Math.sin(u*angle));if(up.lengthSq()<1e-8)up.copy(routeTo);up.normalize();fwd.copy(routeTo).addScaledVector(up,-routeTo.dot(up));if(fwd.lengthSq()<1e-8)fwd.copy(aircraft.userData._fleetForward||new THREE.Vector3(0,0,1));fwd.addScaledVector(up,-fwd.dot(up)).normalize();}
  else if(st.phase==='assemble'||st.phase==='dock'){up.copy(home);fwd.copy(getCityFrame().east);}
  else {const d=st.target.dir,a=st.age*.025;const e=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),d).normalize();if(e.lengthSq()<1e-8)e.set(1,0,0);const n=new THREE.Vector3().crossVectors(d,e);up.copy(d).addScaledVector(e,Math.cos(a)*.10).addScaledVector(n,Math.sin(a)*.10).normalize();fwd.copy(e).multiplyScalar(-Math.sin(a)).addScaledVector(n,Math.cos(a));}
  let altitude=['transit','return','withdraw'].includes(st.phase)?70:40;
  if(st.target?.safeRadius)altitude=Math.max(altitude,st.target.safeRadius-radius+9);
  // Radial location respects local sea/soil and authored obstacle clearance.
  desired.copy(up).multiplyScalar(Math.max(radius+altitude,surface(up)+40));
  aircraft.position.lerp(desired,Math.min(1,dt*1.3));up.copy(aircraft.position).normalize();fwd.addScaledVector(up,-fwd.dot(up)).normalize();right.crossVectors(up,fwd).normalize();basis.makeBasis(right,up,fwd);aircraft.quaternion.setFromRotationMatrix(basis);aircraft.userData._fleetForward=fwd.clone();aircraft.updateWorldMatrix(true,true);
 }
 function slot(i,t){const role=roles[i],sign=i%2?1:-1;let x=sign*(48+Math.floor(i/2)*7),z=-i*8,y=6;
  if(role==='scout'){x=sign*22;z=75+Math.floor(i/6)*12;y=12;}
  if(role==='guard'){x=sign*44;z=i%3?25:-32;y=15;}
  if(role==='jammer'||role==='support'){x=sign*45;z=-60-Math.floor(i/6)*12;y=role==='support'?-6:18;}
  if(st.phase==='transit'||st.phase==='return')z*=1.35;
  if(st.phase==='blockade'){const a=t*(i%2?.09:-.07)+i*2.399;const r=role==='scout'||role==='guard'?94:68;x=Math.cos(a)*r;z=Math.sin(a)*r;y=i%2?18:3;}
  if(st.phase==='pincer'&&role==='attack'){const sideActive=Math.floor(st.age/8)%2===(i%2);if(sideActive){const a=(st.age%8)/8*Math.PI;x=sign*(55+Math.sin(a)*22);z=38-Math.cos(a)*35;y=6-Math.sin(a)*8;}}
  if(st.phase==='cannon'){x=sign*Math.max(54,Math.abs(x));z=role==='support'?-85:z;}
  if(st.phase==='guard'){x=sign*Math.max(42,Math.abs(x)*.82);y+=5;}
  if(['withdraw','return'].includes(st.phase)){if(role==='support'){x=sign*42;z=65;}else if(role==='guard'){x=sign*54;z=-75;}else{x=sign*48;z=-10-i*5;}}
  // Full flagship wing/waist remains empty, including the cannon axis.
  return {x,z,y};
 }
 function moveMembers(dt,t){for(let i=0;i<members.length;i++){const m=members[i],s=slot(i,t);desired.copy(aircraft.position).addScaledVector(right,s.x).addScaledVector(fwd,s.z).addScaledVector(up,s.y);
   // Convert the world slot into the existing parent's coordinates; never reparent aircraft.
   m.parent.updateWorldMatrix(true,false);m.parent.worldToLocal(desired);const alpha=1-Math.exp(-dt*1.25);m.position.lerp(desired,alpha);const q=new THREE.Quaternion().setFromRotationMatrix(basis),pq=m.parent.getWorldQuaternion(new THREE.Quaternion()).invert();m.quaternion.slerp(pq.multiply(q),alpha);m.updateWorldMatrix(true,false);
  }}
 function addFx(mesh,lifetime,type,origin){effects.add(mesh);fx.push({mesh,age:0,lifetime,type,origin:origin?.clone()});}
 function reactionTargets(hitPoint,type,t){scene.traverse(o=>{if(!o.isGroup||!o.visible)return;const tag=(o.name+' '+(o.userData.kind||'')).toLowerCase();if(/tiger|fox|courier|messenger|player/.test(tag))return;const isRobot=o.userData.kind==='bookshop-robot';if(/robot/.test(tag)&&!isRobot)return;if(!isRobot&&!/monkey|bird|beluga|fish|salamander|firefly|insect/.test(tag))return;o.getWorldPosition(pos);if(pos.distanceTo(hitPoint)>22)return;if(!reactions.has(o))reactions.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),until:t+5,type,tag});else reactions.get(o).until=t+5;o.userData.batianDisruptedUntil=t+5;});}
 function impact(type,t){const d=st.target.dir.clone().normalize();const a=st.shots*2.399,e=right.clone(),n=fwd.clone();d.addScaledVector(e,Math.cos(a)*.035).addScaledVector(n,Math.sin(a)*.035).normalize();const point=d.clone().multiplyScalar(surface(d)+.6);st.shots++;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.8,1,32),new THREE.MeshBasicMaterial({color:type==='ion'?0x9a82bb:0x82d7c6,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));ring.position.copy(point);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);addFx(ring,3,'ripple');
  const from=aircraft.position.clone();if(type==='rain'){const sign=st.shots%2?1:-1;from.addScaledVector(right,sign*22);}const length=from.distanceTo(point),beam=new THREE.Mesh(new THREE.CylinderGeometry(type==='cannon'?1.8:.18,type==='cannon'?1.8:.5,length,8),new THREE.MeshBasicMaterial({color:type==='rain'?0xe88370:type==='ion'?0x9a82bb:0x82d7c6,transparent:true,opacity:.65,depthWrite:false}));beam.position.copy(from).add(point).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),from.sub(point).normalize());addFx(beam,.7,'beam');
  for(let i=0;i<6;i++){const smoke=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,0),new THREE.MeshBasicMaterial({color:i<2?0xe99a55:0x46515b,transparent:true,opacity:.45,depthWrite:false}));smoke.position.copy(point).addScaledVector(right,(i-2)*1.2).addScaledVector(d,1+i*.7);addFx(smoke,4,'smoke',point);}
  reactionTargets(point,type,t);st.energy=Math.max(0,st.energy-(type==='cannon'?8:type==='rain'?3:2));st.heat+=type==='cannon'?17:4;
 }
 function beforeSceneUpdate(){for(const [o,r]of reactions){o.position.copy(r.position);o.quaternion.copy(r.quaternion);o.scale.copy(r.scale);}}
 function applyReactions(t){for(const [o,r]of reactions){if(t>r.until){o.position.copy(r.position);o.quaternion.copy(r.quaternion);o.scale.copy(r.scale);delete o.userData.batianDisruptedUntil;reactions.delete(o);continue;}r.position.copy(o.position);r.quaternion.copy(o.quaternion);r.scale.copy(o.scale);if(/bird|firefly|insect/.test(r.tag)){o.position.y+=Math.sin((r.until-t)*.4)*3;}else if(/beluga|fish|salamander/.test(r.tag)){o.position.y-=.5;}else if(/robot/.test(r.tag)){o.rotateZ(Math.sin(t*9)*.05);}else{o.position.x+=Math.sin(t*2)*.4;}}}
 function update(dt,t){dt=Math.min(.1,Math.max(0,dt));lastTime=t;
  if(!canControl()){if(owner.active)retreat('pilot-or-story');return;}
  if(!owner.active){idleAge+=dt;if(auto&&idleAge>90&&targets.length){idleAge=0;start(targets[st.cycle%targets.length].id);}return;}
  st.age+=dt;combatTime+=dt;st.shield=['blockade','pincer','cannon','guard'].includes(st.phase)&&st.energy>20;
  if(st.shield)st.energy=Math.max(0,st.energy-dt*(st.phase==='guard'?1.6:.42));st.heat=Math.max(0,st.heat-dt*.4);
  if(st.energy<15||st.wingNodes===0||st.heat>95)retreat(st.energy<15?'energy':st.wingNodes===0?'wing-nodes':'overheat');
  if(st.energy<=35&&['pincer','cannon'].includes(st.phase))setPhase('guard');
  placeFlagship(dt);moveMembers(dt,t);shield.visible=st.shield;shield.material.opacity=st.energy<=35?.10+.09*Math.sin(t*15):.19;
  core.visible=st.phase==='cannon'||st.phase==='pincer';core.scale.setScalar(1.2+(st.age%6)/3);petals.children.forEach((p,i)=>{p.rotation.z=core.visible?Math.sin(i*Math.PI/3)*.6:0;});
  const period=st.phase==='cannon'?6:4;
  if(['pincer','cannon','guard'].includes(st.phase)&&combatTime-lastShot>period){lastShot=combatTime;impact(st.phase==='cannon'?'cannon':st.phase==='guard'?'ion':st.shots%3===2?'traction':'rain',t);}
  // Region counterfire is strongest during exposed-shield windows; buildings are never edited.
  if(!st.shield&&st.phase==='guard'&&Math.floor(st.age/3)>Math.floor((st.age-dt)/3))hit(10,st.age>9?'wing':null);
  if(st.age>durations[st.phase]){const next={assemble:'transit',transit:'blockade',blockade:'pincer',pincer:'cannon',cannon:'guard',guard:'withdraw',withdraw:'return',return:'dock'}[st.phase];if(next)setPhase(next);else if(st.phase==='dock'){owner.active=false;squad.userData.state=originalState;st.energy=100;st.heat=0;st.wingNodes=2;st.shield=false;shield.visible=false;core.visible=false;setPhase('idle');}}
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.age+=dt;const u=f.age/f.lifetime;if(u>=1){effects.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();fx.splice(i,1);continue;}if(f.type==='ripple')f.mesh.scale.setScalar(1+u*15);if(f.type==='smoke'){f.mesh.scale.setScalar(1+u*2);f.mesh.position.addScaledVector(up,dt*1.8);}f.mesh.material.opacity=.6*(1-u);}
  applyReactions(t);
 }
 return {start,retreat,hit,update,beforeSceneUpdate,get active(){return owner.active;},snapshot:()=>({...st,target:st.target?.id,members:members.length,roles:[...roles],events:events.map(e=>({...e})),objectsReused:members.map(m=>m.uuid)}),dispose(){owner.active=false;beforeSceneUpdate();saved.forEach(r=>{if(r.material&&r.m.userData.cockpitCore){r.m.userData.cockpitCore.material=r.material;r.roleMaterial?.dispose();}delete r.m.userData.batianFleetRole;});scene.remove(effects);aircraft.remove(shield,core,petals);const gs=new Set(),ms=new Set();for(const root of [effects,shield,core,petals])root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());delete squad.userData.batianFleetOwner;}};
}
