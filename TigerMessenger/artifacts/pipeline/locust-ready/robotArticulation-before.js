import * as THREE from 'three';
import {BEETLE_STANCE} from './beetleStance.js';
import {mergeStaticGroup} from '../world/geometryMerge.js';
const CACHE=new WeakMap();
const SEAM_MATERIAL=new THREE.LineBasicMaterial({color:0x34403d,transparent:true,opacity:.48});
function panelSeams(group){
 group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),positions=[],v=new THREE.Vector3();
 group.traverse(o=>{if(!o.isMesh||!o.userData.panel)return;const edges=new THREE.EdgesGeometry(o.geometry,35),p=edges.attributes.position,matrix=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<p.count;i++)positions.push(...v.fromBufferAttribute(p,i).applyMatrix4(matrix).toArray());edges.dispose();});
 if(!positions.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const seams=new THREE.LineSegments(geometry,SEAM_MATERIAL);seams.name='robot-panel-seams';group.add(seams);
}
// Rigid assembly joints, preserving the original authored plates and materials.
// Only the opt-in moving variant is partitioned; static reference factories stay intact.
export function articulateRobot(root,kind,name){
 root.updateWorldMatrix(true,true);const parts=[...root.children],joints={};
 const pivot=(id,x,y,z,parent=root)=>{const g=new THREE.Group();g.name='joint-'+id;g.position.set(x,y,z);root.add(g);g.updateWorldMatrix(true,false);if(parent!==root)parent.attach(g);joints[id]=g;return g;};
 const body=pivot('body',0,kind==='locust'?2.5:kind==='ant'?.8:.8,0);
 for(const side of[-1,1]){
  const key=side<0?'left':'right';
  if(kind==='beetle')for(const z of[-1,1]){const id=key+(z<0?'-rear':'-front'),leg=pivot(id,side*BEETLE_STANCE.hipHalfWidth,.93,z*BEETLE_STANCE.hipHalfLength);pivot(id+'-wheel',side*BEETLE_STANCE.halfWidth,.35,z*BEETLE_STANCE.halfLength,leg);}
  else{
   const hip=pivot(key+'-hip',side*(kind==='locust'?.58:.64),kind==='locust'?2.5:.83,kind==='locust'?0:-.13);
   const knee=pivot(key+'-knee',side*(kind==='locust'?.66:.64),kind==='locust'?1.65:.73,kind==='locust'?-.12:.62,hip);
   pivot(key+'-ankle',side*(kind==='locust'?.58:.65),kind==='locust'?.47:.17,kind==='locust'?0:.71,knee);
   if(kind==='ant'){root.attach(knee);knee.attach(hip);}
   const shoulder=pivot(key+'-shoulder',side*(kind==='locust'?1.0:1.0),kind==='locust'?3.62:1.85,kind==='locust'?0:-.17,body);
   pivot(key+'-elbow',side*(kind==='locust'?1.35:1.13),kind==='locust'?2.86:1.27,kind==='locust'?.02:.22,shoulder);
  }
 }
 if(kind==='locust')pivot('head',0,4.08,.30,body);
 if(kind==='beetle')pivot('turret',0,2.15,-.22,body);
 for(const part of parts){
  root.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(part),c=root.worldToLocal(bounds.getCenter(new THREE.Vector3()));let target=body;const side=c.x<0?'left':'right';
  if(kind==='locust'){
   if(part.name==='robot-head-assembly')target=joints.head;
   else if(part.name==='robot-rifle'){part.position.set(-1.43,1.94,.37);target=joints['left-elbow'];}
   else if(Math.abs(c.x)>.99&&c.y>1.75&&c.y<4.95)target=joints[side+(c.y<2.85?'-elbow':'-shoulder')];
   else if(c.y<2.48&&Math.abs(c.x)>.2)target=joints[side+(c.y<.5?'-ankle':c.y<1.6?'-knee':'-hip')];
  }else if(kind==='ant'){
   if(part.name.startsWith('robot-ant-knee-'))target=joints[side+'-knee'];
   else if(part.name.startsWith('robot-ant-shin-'))target=joints[side+'-ankle'];
   else if(part.name==='robot-cup'){target=body;part.userData.cup=true;}
   else if(part.name.includes('shoulder-detail'))target=joints[side+'-shoulder'];
   else if(Math.abs(c.x)>.93&&c.y>.87&&c.y<2.3)target=joints[side+(c.y<1.40?'-elbow':'-shoulder')];
   else if(part.name.includes('forearm')||part.name.includes('hand'))target=joints[side+'-elbow'];
   else if(c.y<.85)target=joints[side+(c.y<.5?'-ankle':c.z>.50?'-knee':'-hip')];
  }else{
   if(part.name==='robot-turret')target=joints.turret;
   else if(Math.abs(c.x)>.84&&c.y<1.5){const key=side+(c.z<0?'-rear':'-front');target=joints[key+(part.name!=='robot-leg-guard'&&c.y<.68?'-wheel':'')];}
  }
  target.attach(part);
 }
 // Add the accepted pressure-cannon as an attachment to the right forearm.
 if(kind==='ant'){
  const gun=new THREE.Group();gun.name='robot-pressure-cannon';gun.position.set(1.36,1.23,.44);root.add(gun);
  const metal=new THREE.MeshStandardMaterial({color:0x6a4938,metalness:.5,roughness:.65});const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,.72,16),metal);barrel.rotation.x=Math.PI/2;barrel.position.z=.2;gun.add(barrel);const mouth=new THREE.Mesh(new THREE.CircleGeometry(.132,20),new THREE.MeshBasicMaterial({color:0x121b1d}));mouth.position.z=.566;gun.add(mouth);const rim=new THREE.Mesh(new THREE.TorusGeometry(.148,.025,8,20),metal);rim.position.z=.564;gun.add(rim);joints['right-elbow'].attach(gun);
  const cup=root.getObjectByName('robot-cup');if(cup){const local=cup.position.clone();cup.userData.rest=local.toArray();}
 }
 // Sample actual sole vertices once; grounding remains cheap during animation.
 root.updateWorldMatrix(true,true);
 root.traverse(o=>{if(o.name!=='robot-sole'||!o.isMesh)return;let joint=o.parent;while(joint&&!joint.name.endsWith('-ankle'))joint=joint.parent;if(!joint)return;const matrix=joint.matrixWorld.clone().invert().multiply(o.matrixWorld),points=o.geometry.attributes.position,unique=new Set(),samples=[];for(let i=0;i<points.count;i++){const p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(matrix),key=p.toArray().map(n=>n.toFixed(4)).join(',');if(unique.has(key))continue;unique.add(key);samples.push(p.toArray());}joint.userData.supportPoints=samples;});
 if(kind==='beetle')for(const [id,j]of Object.entries(joints))if(id.endsWith('-wheel')){
  const samples=[],unique=new Set(),inverse=j.matrixWorld.clone().invert();
  j.traverse(o=>{if(!o.isMesh)return;const matrix=inverse.clone().multiply(o.matrixWorld),points=o.geometry.attributes.position;for(let i=0;i<points.count;i++){const p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(matrix),key=p.toArray().map(n=>n.toFixed(4)).join(',');if(unique.has(key))continue;unique.add(key);samples.push(p.toArray());}});
  j.userData.supportPoints=samples;
 }
 if(kind==='beetle')for(const side of[-1,1])for(const z of[-1,1]){
  const id=(side<0?'left':'right')+(z<0?'-rear':'-front');
  const strut=new THREE.Mesh(new THREE.CylinderGeometry(.062,.080,1,12),new THREE.MeshStandardMaterial({color:0x616c69,metalness:.7,roughness:.3}));strut.name='suspension-'+id;joints[id].add(strut);
 }
 // Batch surfaces within each independent joint only.
 for(const g of Object.values(joints)){
  const bucket=new THREE.Group();bucket.name='armor-'+g.name;g.add(bucket);
  for(const c of [...g.children])if(c!==bucket&&!(c.name.startsWith('joint-')||c.name.startsWith('suspension-')||c.name==='robot-leg-guard')&&!['robot-cup','robot-rifle','robot-pressure-cannon'].includes(c.name))bucket.attach(c);
  panelSeams(bucket);
  mergeStaticGroup(bucket);
  for(const c of g.children)if(['robot-rifle','robot-pressure-cannon'].includes(c.name)){panelSeams(c);mergeStaticGroup(c);}
 }
 if(kind==='ant'){
  const metal=new THREE.MeshStandardMaterial({color:0x3a4140,metalness:.55,roughness:.65});
  for(const side of[-1,1]){const piston=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.65,12),metal);piston.position.set(side*.64,.9,-.13);root.add(piston);joints[side<0?'left-hip':'right-hip'].attach(piston);}
 }
 root.name='bookshop-robot-'+kind+'-articulated';root.userData.kind='bookshop-robot';root.userData.robotName=name;root.userData.robotType=kind;root.userData.rigVersion=2;root.userData.modelVersion=4;
 for(const [id,g]of Object.entries(joints))g.userData.rest=g.position.toArray();
 const muzzle=new THREE.Object3D();muzzle.name='robot-muzzle';if(kind==='locust'){muzzle.position.set(0,-.86,0);root.getObjectByName('robot-rifle').add(muzzle);}else if(kind==='ant'){muzzle.position.set(0,0,.6);root.getObjectByName('robot-pressure-cannon').add(muzzle);}else{muzzle.position.set(.1,.09,.69);joints.turret.add(muzzle);const left=muzzle.clone();left.name='robot-muzzle-left';left.position.x=-.1;joints.turret.add(left);}
 const cannon=root.getObjectByName('robot-pressure-cannon');if(cannon){cannon.userData.restQuaternion=cannon.quaternion.toArray();cannon.userData.restPosition=cannon.position.toArray();}
 const rifle=root.getObjectByName('robot-rifle');if(rifle){rifle.userData.restPosition=rifle.position.toArray();rifle.userData.restQuaternion=rifle.quaternion.toArray();}
 let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});root.userData.stats={meshes,triangles};
 return root;
}
export function animateArticulatedRobot(root,{time=0,speed=0,state='idle',aim=0,pitch=0,aimPoint=null,fire=false,steer=0,braced=false,recoil=0,damage=0}={}){
 let joints=CACHE.get(root);if(!joints){joints={};root.traverse(o=>{if(o.name.startsWith('joint-'))joints[o.name.slice(6)]=o;});CACHE.set(root,joints);}
 const kind=root.userData.robotType,walk=Math.min(1,speed/(kind==='beetle'?3.8:kind==='ant'?1.5:2.2)),phase=time*(kind==='ant'?3.8:5),firing=fire||braced||['aim','attack','braced'].includes(state),transport=state==='transport';
 for(const g of Object.values(joints)){g.rotation.set(0,0,0);g.position.fromArray(g.userData.rest);}
 const body=joints.body;if(!body)return;
 const greetAge=root.userData.greetingStarted===undefined?Infinity:(performance.now()/1000-root.userData.greetingStarted);
 const greet=greetAge>=0&&greetAge<4?Math.min(1,greetAge/.7,(4-greetAge)/.7):0;
 root.userData.greetingActive=greet>0;
 if(joints.head)joints.head.rotation.x=greet*Math.max(0,Math.sin(greetAge*Math.PI*2))*.25;

 const rifle=root.getObjectByName('robot-rifle');if(rifle){rifle.position.fromArray(rifle.userData.restPosition);rifle.quaternion.fromArray(rifle.userData.restQuaternion);}
 const pulse=root.userData.weaponPulse;const pulseAge=pulse?performance.now()/1000-pulse.at:10;recoil=Math.max(recoil,pulseAge>=0?Math.max(0,1-pulseAge/(kind==='ant'?.45:.15)):0);
 const cannon=root.getObjectByName('robot-pressure-cannon');if(cannon){cannon.quaternion.fromArray(cannon.userData.restQuaternion);cannon.position.fromArray(cannon.userData.restPosition);}
 body.rotation.y=kind==='beetle'?0:THREE.MathUtils.clamp(aim,-1.4,1.4);body.rotation.x=recoil*.07-(kind==='beetle'?0:THREE.MathUtils.clamp(pitch,-.25,1.05));body.rotation.z=damage>=.7?Math.sin(phase)*walk*.075:0;
 const antStand=kind==='ant'?(transport?0:root.userData.displaySeated?greet:1):0;
 if(transport&&kind==='locust')body.position.y-=1.15;
 if(transport&&kind==='beetle')body.position.y-=.12;
 if(braced&&kind==='locust')body.position.y-=.14;
 for(const side of[-1,1]){
  const key=side<0?'left':'right',swing=Math.sin(phase+(side>0?Math.PI:0))*walk*(damage>=.7&&side<0?.55:1);
  if(kind==='beetle')for(const z of[-1,1]){const id=key+(z<0?'-rear':'-front');joints[id+'-wheel'].position.x+=side*.16*greet;joints[id+'-wheel'].position.z+=z*.10*greet;joints[id].position.y+=Math.sin(phase+z)*walk*.035;joints[id+'-wheel'].rotation.x=time*speed/.34;if(z>0)joints[id].rotation.y=THREE.MathUtils.clamp(steer,-.35,.35);
   const piston=root.getObjectByName('suspension-'+id),wheel=joints[id+'-wheel'];
   const guard=joints[id].getObjectByName('robot-leg-guard');if(guard){guard.position.copy(wheel.position).multiplyScalar(.5);guard.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),wheel.position.clone().negate().normalize());if(z<0)guard.rotateY(Math.PI);guard.scale.y=wheel.position.length()/.93;}
if(piston){const delta=wheel.position.clone();piston.position.copy(delta).multiplyScalar(.5);piston.scale.y=delta.length();piston.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
}
  else{
   joints[key+'-hip'].rotation.x=swing*(kind==='locust'?.24:.15);
   joints[key+'-knee'].rotation.x=-Math.max(0,-swing)*.32;
   joints[key+'-ankle'].rotation.x=-swing*.10;
   joints[key+'-shoulder'].rotation.x=-swing*.13;
   if(braced&&kind==='locust'){joints[key+'-hip'].position.x+=side*.18;joints[key+'-hip'].position.y-=.14;joints[key+'-hip'].rotation.x=-.10;joints[key+'-knee'].rotation.x=.20;joints[key+'-ankle'].rotation.x=-.10;}
   if(firing){joints[key+'-shoulder'].rotation.x=kind==='locust'?-.75:-.25;joints[key+'-elbow'].rotation.x=kind==='locust'?-.80:-.20;}
   if(transport&&kind==='locust'){joints[key+'-hip'].position.y-=1.15;joints[key+'-hip'].rotation.x=-1.3;joints[key+'-knee'].rotation.x=2.3;joints[key+'-ankle'].rotation.x=-1.0;joints[key+'-shoulder'].rotation.z=-side*.38;}
  }
 }
 if(kind==='ant'){
  const angle=antStand*Math.atan2(.75,.10),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle);
  const restHip=new THREE.Vector3(0,.10,-.75),movedHip=restHip.clone().applyQuaternion(rotation),delta=movedHip.sub(restHip);
  body.position.add(delta);body.rotation.x-=Math.sin(antStand*Math.PI)*.16;
  for(const key of['left','right']){
   const knee=joints[key+'-knee'],hip=joints[key+'-hip'],ankle=joints[key+'-ankle'];
   knee.rotation.x=angle;
   ankle.position.fromArray(ankle.userData.rest).applyQuaternion(rotation.clone().invert());ankle.rotation.x-=angle;
  }
 }
 if(kind==='locust'&&firing){
  root.updateWorldMatrix(true,true);
  solveArm(joints['left-shoulder'],joints['left-elbow'],new THREE.Vector3(-.08,-.92,.12),body.localToWorld(new THREE.Vector3(-.45,.35,1.12)),body.localToWorld(new THREE.Vector3(-1.8,-.3,.4)));
  root.updateWorldMatrix(true,true);
  solveArm(joints['right-shoulder'],joints['right-elbow'],new THREE.Vector3(.08,-.92,.12),body.localToWorld(new THREE.Vector3(-.35,.35,1.62)),body.localToWorld(new THREE.Vector3(1.8,-.25,.4)));
 }
 if(rifle&&firing){
  root.updateWorldMatrix(true,true);const arm=joints['left-elbow'];const hand=arm.localToWorld(new THREE.Vector3(-.08,-.92,.12));hand.add(new THREE.Vector3(0,0,.49).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(root.scale.x));rifle.position.copy(arm.worldToLocal(hand));
  rifle.quaternion.copy(arm.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(body.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2)));
 }
 if(kind==='ant'&&firing){root.updateWorldMatrix(true,true);const gun=root.getObjectByName('robot-pressure-cannon');gun.quaternion.copy(gun.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(body.getWorldQuaternion(new THREE.Quaternion())));}
 if(joints.turret){joints.turret.rotation.y=transport&&!firing?0:greetAge>=0&&greetAge<4?Math.PI*2*THREE.MathUtils.smoothstep(greetAge,.7,3.3):aim;joints.turret.rotation.x=firing?-THREE.MathUtils.clamp(pitch,-.25,1.05):transport?.18:0;}
 if(firing&&recoil>0){if(rifle)rifle.position.z-=recoil*.09;if(cannon)cannon.position.z-=recoil*.12;if(joints.turret)joints.turret.position.z-=recoil*.025;}
 if(state==='disabled'){body.rotation.z=.13;body.position.y-=kind==='locust'?.5:.15;}
 const cup=root.getObjectByName('robot-cup');if(cup&&kind==='ant'){if(state==='idle')cup.position.fromArray(cup.userData.rest);else cup.position.set(.34,-1.20,-1.53);}
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),support=new THREE.Vector3();let lowest=Infinity;
 for(const joint of Object.values(joints))if(joint.userData.supportPoints){const matrix=inverse.clone().multiply(joint.matrixWorld);for(const p of joint.userData.supportPoints){support.fromArray(p).applyMatrix4(matrix);lowest=Math.min(lowest,support.y);}}
 if(Number.isFinite(lowest)){for(const j of Object.values(joints))if(j.parent===root)j.position.y-=lowest;root.userData.supportShift=-lowest;}
 if(firing&&aimPoint)aimLocustRifle(root,aimPoint);
 root.userData.animationState=state;root.userData.mobileFire={firing,transport,speed,aim,pitch};
}

function solveArm(shoulder,elbow,lowerRest,target,pole){
 const origin=shoulder.getWorldPosition(new THREE.Vector3()),scale=shoulder.getWorldScale(new THREE.Vector3()).x,upper=elbow.position.clone();
 const l1=upper.length()*scale,l2=lowerRest.length()*scale,direction=target.clone().sub(origin),d=Math.min(l1+l2-.001,Math.max(Math.abs(l1-l2)+.001,direction.length()));direction.normalize();
 const across=pole.clone().sub(origin).addScaledVector(direction,-pole.clone().sub(origin).dot(direction)).normalize();
 const x=(l1*l1-l2*l2+d*d)/(2*d),y=Math.sqrt(Math.max(0,l1*l1-x*x)),mid=origin.clone().addScaledVector(direction,x).addScaledVector(across,y);
 const parentQ=shoulder.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 shoulder.quaternion.setFromUnitVectors(upper.normalize(),mid.clone().sub(origin).normalize().applyQuaternion(parentQ));shoulder.updateWorldMatrix(true,true);
 const desired=origin.clone().addScaledVector(direction,d).sub(mid).normalize().applyQuaternion(shoulder.getWorldQuaternion(new THREE.Quaternion()).invert());
 elbow.quaternion.setFromUnitVectors(lowerRest.clone().normalize(),desired);
}

// The rifle is authored along local -Y. Align that actual barrel, not only
// a tracer endpoint. Keep the rifle roll relative to the robot's upper body.
export function aimLocustRifle(root,target){
 if(root.userData.robotType!=='locust')return;
 const rifle=root.getObjectByName('robot-rifle'),body=root.getObjectByName('joint-body');if(!rifle||!body)return;
 root.updateWorldMatrix(true,true);
 const forward=target.clone().sub(rifle.getWorldPosition(new THREE.Vector3()));if(forward.lengthSq()<.0001)return;forward.normalize();
 const up=new THREE.Vector3(0,1,0).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
 const right=new THREE.Vector3().crossVectors(up,forward);if(right.lengthSq()<.0001)return;right.normalize();up.crossVectors(forward,right).normalize();
 const world=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
 rifle.quaternion.copy(rifle.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));rifle.updateWorldMatrix(true,true);
}
